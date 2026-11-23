import { NextRequest, NextResponse } from 'next/server'
import { duplicatesHidden } from '@/lib/jobs'
import { reportServerError } from '@/lib/report-error'
import {
  LIVE_JOB_COLUMNS,
  runSimilarJobsRefresh,
  type DuplicateMarksStore,
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

function databaseStores(): { store: SimilarJobsStore; marks: DuplicateMarksStore } {
  const supabase = getServerSupabase('cron')
  const store: SimilarJobsStore = {
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
  // Duplicate-advert marks (D283). Called only when JOB_DUPLICATE_MARKING
  // is exactly "on"; a mark is only ever set on a live imported row.
  const marks: DuplicateMarksStore = {
    markCopies: async (primaryId, ids) => {
      const { error } = await supabase
        .from('jobs')
        .update({ ai_duplicate_of: primaryId })
        .in('id', ids)
        .eq('status', 'active')
        .neq('source', 'employer')
      if (error) throw error
    },
    clearMarks: async (ids) => {
      const { error } = await supabase.from('jobs').update({ ai_duplicate_of: null }).in('id', ids)
      if (error) throw error
    },
  }
  return { store, marks }
}

// Nightly (vercel.json, 03:04 UTC): computes every live job's "Similar
// current roles" list and saves it to public.job_similar (lib/similar-jobs.ts,
// D277). The only writer of that table. Job pages read the saved lists, and
// show them only when SIMILAR_JOBS_ENABLED is "true".
//
// Before the lists it plans the duplicate-advert marks (D283) and writes
// them to jobs.ai_duplicate_of only when JOB_DUPLICATE_MARKING is exactly
// "on" (the owner's switch, after a backup). With JOB_DUPLICATES_HIDDEN
// exactly "true" the lists suggest primaries only. A marking problem is
// reported and the lists are still saved.
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
    const marking = process.env.JOB_DUPLICATE_MARKING === 'on'
    const { store, marks } = databaseStores()
    const result = await runSimilarJobsRefresh(store, () => Date.now(), {
      marks: { write: marking, store: marks },
      hideCopies: duplicatesHidden(),
    })
    if (!result.ok) {
      step = result.step
      throw result.error
    }
    if (result.marks?.failed) {
      const markCode = errorCode(result.markError)
      console.error(`cron/similar-jobs: marking failed (${markCode ?? 'no code'})`)
      const markReport = Object.assign(new Error('similar jobs marking failed'), markCode ? { code: markCode } : {})
      reportServerError('similar jobs marking failed', markReport, { area: 'cron' })
    }
    if (result.marks) console.log(`cron/similar-jobs: marks groups=${result.marks.groups} toMark=${result.marks.toMark} toClear=${result.marks.toClear} writes=${result.marks.writes} applied=${result.marks.applied} failed=${result.marks.failed} timedOut=${result.marks.timedOut} ms=${result.marks.ms}`)
    const { live, pairs, written, deleted, ms } = result
    return NextResponse.json({ ok: true, live, pairs, written, deleted, ms, marks: result.marks })
  } catch (err: unknown) {
    const code = errorCode(err)
    console.error(`cron/similar-jobs: ${step} failed (${code ?? 'no code'})`)
    const report = Object.assign(new Error('similar jobs refresh failed'), code ? { code } : {})
    reportServerError('similar jobs refresh failed', report, { area: 'cron' })
    return NextResponse.json({ error: 'Cron run failed' }, { status: 500 })
  }
}
