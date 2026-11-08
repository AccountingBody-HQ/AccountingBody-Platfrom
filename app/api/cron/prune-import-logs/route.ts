import { NextRequest, NextResponse } from 'next/server'
import { IMPORT_LOG_TABLE, retentionMode, runRetention, type RetentionStore } from '@/lib/import-log-retention'
import { reportServerError } from '@/lib/report-error'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
// force-dynamic alone does NOT stop Next 14.2 caching fetch() calls in route
// handlers (Data Cache, up to 1 year, survives deploys). Do not remove.
export const fetchCache = 'force-no-store'
export const maxDuration = 60

const SHORT_CODE = /^[A-Za-z0-9_.-]{1,40}$/

// The error's short code only; its message is never logged or reported.
function errorCode(error: unknown): string | undefined {
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined
  return typeof code === 'string' && SHORT_CODE.test(code) ? code : undefined
}

function databaseStore(): RetentionStore {
  const supabase = getServerSupabase('cron')
  return {
    findDue: async (cutoff, limit) => {
      const { data, error } = await supabase.from(IMPORT_LOG_TABLE).select('id').lt('created_at', cutoff).limit(limit)
      if (error) throw error
      return (data ?? []).map((row) => row.id)
    },
    remove: async (ids) => {
      const { data, error } = await supabase.from(IMPORT_LOG_TABLE).delete().in('id', ids).select('id')
      if (error) throw error
      return (data ?? []).length
    },
  }
}

// Deletes import error log rows older than 90 days (lib/import-log-retention.ts).
// Off unless IMPORT_LOG_RETENTION is exactly "on" (delete) or "dry-run" (count).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('cron/prune-import-logs: not configured')
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const mode = retentionMode(process.env.IMPORT_LOG_RETENTION)
  if (mode === 'off') return NextResponse.json({ mode: 'off' })

  let deleted = 0
  try {
    const result = await runRetention(mode, databaseStore(), () => Date.now())
    if (!result.ok) {
      deleted = result.deleted
      throw result.error
    }
    if (result.mode === 'dry-run') return NextResponse.json({ mode: 'dry-run', wouldDeleteAtLeast: result.wouldDeleteAtLeast })
    return NextResponse.json({ mode: 'on', deleted: result.deleted, more: result.more })
  } catch (err: unknown) {
    const code = errorCode(err)
    console.error(`cron/prune-import-logs: fatal error (${code ?? 'no code'})`)
    const report = Object.assign(new Error('import log retention failed'), code ? { code } : {})
    reportServerError('import log retention run failed', report, { area: 'cron' })
    return NextResponse.json({ error: 'Cron run failed', deleted }, { status: 500 })
  }
}
