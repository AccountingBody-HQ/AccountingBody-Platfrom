import { NextResponse } from 'next/server'
import { checkRead, type DbResultLike } from '@/lib/db-check'
import {
  DAILY_GRACE_MS,
  PENDING_SUBSCRIBER_MAX_AGE_MS,
  SAVED_JOB_MAX_AGE_MS,
  cutoffs,
  judgeDue,
  judgeRuns,
  neutralAttention,
  summarise,
} from '@/lib/ops-status'
import { reportServerError } from '@/lib/report-error'
import { getServerSupabase } from '@/lib/supabase-server'

// Whether the scheduled jobs have done their work recently, for an uptime
// monitor: 200 when every alerting check is ok, otherwise 503. One small read
// per check; never cached. See lib/ops-status.ts for the words.
export const dynamic = 'force-dynamic'
// force-dynamic alone does NOT stop Next 14.2 caching fetch() calls in route
// handlers (Data Cache, up to 1 year, survives deploys). This froze the sitemap
// at 13 Sept 2026. Do not remove. See Session 15 handover.
export const fetchCache = 'force-no-store'
export const maxDuration = 10

const READ_LABEL = 'ops status read'
const HEADERS = { 'Cache-Control': 'no-store' }

// The rows read, or null when the read did not work.
function rowsOf(result: DbResultLike<Record<string, unknown>[]>): Record<string, unknown>[] | null {
  const read = checkRead(result, READ_LABEL)
  return read.ok ? (read.data ?? []) : null
}

export async function GET() {
  try {
    const now = Date.now()
    const at = cutoffs(now)
    const supabase = getServerSupabase('publicRead')

    const [runs, expiring, pending, saved] = await Promise.all([
      // 'completed' sorts before 'failed', so one row tells whether any
      // run in the window completed.
      supabase
        .from('provider_runs')
        .select('status, started_at')
        .eq('trigger', 'cron')
        .in('status', ['completed', 'failed'])
        .gte('started_at', at.importSince)
        .order('status', { ascending: true })
        .limit(1),
      supabase
        .from('jobs')
        .select('expires_at')
        .eq('status', 'active')
        .not('expires_at', 'is', null)
        .lt('expires_at', at.expiryBefore)
        .limit(1),
      supabase
        .from('email_subscribers')
        .select('last_confirmation_sent_at')
        .eq('status', 'pending')
        .lt('last_confirmation_sent_at', at.subscriberBefore)
        .limit(1),
      supabase
        .from('saved_jobs')
        .select('last_seen_at')
        .lt('last_seen_at', at.savedJobBefore)
        .limit(1),
    ])

    const answer = summarise({
      'job-import': judgeRuns(rowsOf(runs), now),
      'job-expiry': judgeDue(rowsOf(expiring), 'expires_at', now, DAILY_GRACE_MS),
      'subscriber-cleanup': judgeDue(
        rowsOf(pending),
        'last_confirmation_sent_at',
        now,
        PENDING_SUBSCRIBER_MAX_AGE_MS + DAILY_GRACE_MS,
      ),
      'saved-jobs-cleanup': judgeDue(rowsOf(saved), 'last_seen_at', now, SAVED_JOB_MAX_AGE_MS + DAILY_GRACE_MS),
    })
    return NextResponse.json(answer.body, { status: answer.httpStatus, headers: HEADERS })
  } catch (error) {
    console.error('ops status check failed:', error)
    reportServerError('ops status check failed', error, { area: 'public' })
    const answer = neutralAttention()
    return NextResponse.json(answer.body, { status: answer.httpStatus, headers: HEADERS })
  }
}
