import { NextRequest, NextResponse } from 'next/server'
import { reportServerError } from '@/lib/report-error'
import {
  LIVE_JOB_COLUMNS,
  runSimilarJobsRefresh,
  type LiveJobRow,
  type SimilarJobsStore,
} from '@/lib/similar-jobs'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
// force-dynamic alone does NOT stop Next caching fetch() calls in route
// handlers (Data Cache, up to 1 year, survives deploys). Do not remove.
export const fetchCache = 'force-no-store'
// About 16 page reads, the computation and about 40 writes; each database
// request keeps the cron context's own limit.
export const maxDuration = 300

const SHORT_CODE = /^[A-Za-z0-9_.-]{1,40}$/

// The error's short code only; its message is never logged or reported.
function errorCode(error: unknown): string | undefined {
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined
  return typeof code === 'string' && SHORT_CODE.test(code) ? code : undefined
}

function databaseStore(): SimilarJobsStore {
  const supabase = getServerSupabase('cron')
  return {
    readLivePage: async (after, limit, nowIso) => {
      let query = supabase
        .from('jobs')
        .select(LIVE_JOB_COLUMNS)
        .eq('status', 'active')
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      if (after !== null) query = query.gt('id', after)
      const { data, error } = await query.order('id', { ascending: true }).limit(limit)
      if (error) throw error
      return (data ?? []) as unknown as LiveJobRow[]
    },
    upsertLists: async (rows, computedAt) => {
      const { error } = await supabase
        .from('job_similar')
        .upsert(rows.map((row) => ({ ...row, computed_at: computedAt })), { onConflict: 'job_id,platform' })
      if (error) throw error
    },
    deleteStale: async (before) => {
      const { error, count } = await supabase.from('job_similar').delete({ count: 'exact' }).lt('computed_at', before)
      if (error) throw error
      return count ?? 0
    },
  }
}

// Nightly (vercel.json, 03:04 UTC): computes every live job's "Similar
// current roles" list and saves it to public.job_similar (lib/similar-jobs.ts,
// D277). The only writer of that table. Job pages read the saved lists, and
// show them only when SIMILAR_JOBS_ENABLED is "true".
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('cron/similar-jobs: not configured')
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let step = 'start'
  try {
    const result = await runSimilarJobsRefresh(databaseStore(), () => Date.now())
    if (!result.ok) {
      step = result.step
      throw result.error
    }
    const { live, pairs, written, deleted, ms } = result
    return NextResponse.json({ ok: true, live, pairs, written, deleted, ms })
  } catch (err: unknown) {
    const code = errorCode(err)
    console.error(`cron/similar-jobs: ${step} failed (${code ?? 'no code'})`)
    const report = Object.assign(new Error('similar jobs refresh failed'), code ? { code } : {})
    reportServerError('similar jobs refresh failed', report, { area: 'cron' })
    return NextResponse.json({ error: 'Cron run failed' }, { status: 500 })
  }
}
