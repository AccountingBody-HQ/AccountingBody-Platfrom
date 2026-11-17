import { NextRequest, NextResponse } from 'next/server'
import {
  RETENTION_DUE_STATUS,
  RETENTION_KEEP_SOURCE,
  jobRetentionDays,
  jobRetentionMode,
  runJobRetention,
  type JobRetentionStore,
} from '@/lib/job-retention'
import { reportServerError } from '@/lib/report-error'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
// force-dynamic alone does NOT stop Next 14.2 caching fetch() calls in route
// handlers (Data Cache, up to 1 year, survives deploys). Do not remove.
export const fetchCache = 'force-no-store'
export const maxDuration = 60

const SHORT_CODE = /^[A-Za-z0-9_.-]{1,40}$/
// Rows per page when reading job_applications; pages are read until one
// comes back short, and a run that would need more than MAX_GUARD_PAGES
// pages for one part stops rather than guess.
const GUARD_PAGE = 1000
const MAX_GUARD_PAGES = 50

// The error's short code only; its message is never logged or reported.
function errorCode(error: unknown): string | undefined {
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined
  return typeof code === 'string' && SHORT_CODE.test(code) ? code : undefined
}

function databaseStore(): JobRetentionStore {
  const supabase = getServerSupabase('cron')
  return {
    findDue: async (cutoff, limit, after) => {
      let query = supabase
        .from('jobs')
        .select('id')
        .neq('source', RETENTION_KEEP_SOURCE)
        .eq('status', RETENTION_DUE_STATUS)
        .not('closed_at', 'is', null)
        .lt('closed_at', cutoff)
      if (after !== null) query = query.gt('id', after)
      const { data, error } = await query.order('id', { ascending: true }).limit(limit)
      if (error) throw error
      return (data ?? []).map((row) => row.id as string)
    },
    withApplications: async (ids) => {
      const found = new Set<string>()
      for (let page = 0; page < MAX_GUARD_PAGES; page++) {
        const from = page * GUARD_PAGE
        const { data, error } = await supabase
          .from('job_applications')
          .select('job_id')
          .in('job_id', ids)
          .order('id', { ascending: true })
          .range(from, from + GUARD_PAGE - 1)
        if (error) throw error
        const rows = data ?? []
        for (const row of rows) found.add(row.job_id as string)
        if (rows.length < GUARD_PAGE) return found
      }
      throw Object.assign(new Error('job retention guard read too large'), { code: 'guard-limit' })
    },
    remove: async (ids, cutoff) => {
      const { data, error } = await supabase
        .from('jobs')
        .delete()
        .in('id', ids)
        .neq('source', RETENTION_KEEP_SOURCE)
        .eq('status', RETENTION_DUE_STATUS)
        .lt('closed_at', cutoff)
        .select('id')
      if (error) throw error
      return (data ?? []).length
    },
  }
}

// Deletes expired imported jobs closed more than JOB_RETENTION_DAYS ago
// (lib/job-retention.ts, owner decision D140). Employer jobs and jobs with an
// application are never deleted. Off unless JOB_RETENTION is exactly "on"
// (delete) or "dry-run" (count).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('cron/prune-expired-jobs: not configured')
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const mode = jobRetentionMode(process.env.JOB_RETENTION)
  if (mode === 'off') return NextResponse.json({ mode: 'off' })
  const days = jobRetentionDays(process.env.JOB_RETENTION_DAYS)

  let deleted = 0
  try {
    const result = await runJobRetention(mode, days, databaseStore(), () => Date.now())
    if (!result.ok) {
      deleted = result.deleted
      throw result.error
    }
    if (result.mode === 'dry-run') {
      return NextResponse.json({ mode: 'dry-run', days, wouldDeleteAtLeast: result.wouldDeleteAtLeast, kept: result.kept })
    }
    return NextResponse.json({ mode: 'on', days, deleted: result.deleted, kept: result.kept, more: result.more })
  } catch (err: unknown) {
    const code = errorCode(err)
    console.error(`cron/prune-expired-jobs: fatal error (${code ?? 'no code'})`)
    const report = Object.assign(new Error('job retention failed'), code ? { code } : {})
    reportServerError('job retention run failed', report, { area: 'cron' })
    return NextResponse.json({ error: 'Cron run failed', deleted }, { status: 500 })
  }
}
