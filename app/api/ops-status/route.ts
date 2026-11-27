import { NextResponse } from 'next/server'
import { checkRead, type DbResultLike } from '@/lib/db-check'
import {
  PART_SIZE,
  RETENTION_DUE_STATUS,
  RETENTION_KEEP_SOURCE,
  jobRetentionDays,
  jobRetentionMode,
} from '@/lib/job-retention'
import {
  DAILY_GRACE_MS,
  PENDING_SUBSCRIBER_MAX_AGE_MS,
  RETENTION_GUARD_ROWS,
  SAVED_JOB_MAX_AGE_MS,
  cutoffs,
  dataRetentionOverdueBefore,
  judgeDataRetention,
  judgeDatabaseSize,
  judgeDue,
  judgeRetention,
  judgeRuns,
  neutralAttention,
  opsStatusHold,
  retentionOverdueBefore,
  summarise,
  type CheckWord,
  type StatusAnswer,
} from '@/lib/ops-status'
import { reportServerError } from '@/lib/report-error'
import { getServerSupabase } from '@/lib/supabase-server'
import { RETENTION_RULES, applyRuleFilter, dataRetentionMode } from '@/lib/data-retention'

// Whether the scheduled jobs have done their work recently, for an uptime
// monitor: 200 when every alerting check is ok, otherwise 503. One small read
// per check (when switched on, the job retention check may need a second and
// the data retention check reads once per deleting rule), at most once a
// minute per instance (OPS_STATUS_HOLD_MS); the
// HTTP answer is never cached. See lib/ops-status.ts for the words.
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

// The job retention check (owner decision D147). Unless JOB_RETENTION is
// exactly "on" (the cron's own parser), the cron deletes nothing, so this
// answers ok with no read. When on: read 1 finds up to PART_SIZE jobs that
// match the cron's filter and closed more than JOB_RETENTION_DAYS plus
// DAILY_GRACE_MS ago; none → ok, with no second read. Otherwise read 2 finds
// which of them have an application, because the cron keeps those jobs.
// Known limit: kept jobs never trip the alarm, and if PART_SIZE kept jobs
// fill read 1, an overdue job behind them is not seen. So it can miss an
// alarm, but it cannot give a false one.
async function retentionWord(supabase: ReturnType<typeof getServerSupabase>, now: number): Promise<CheckWord> {
  if (jobRetentionMode(process.env.JOB_RETENTION) !== 'on') return 'ok'
  const days = jobRetentionDays(process.env.JOB_RETENTION_DAYS)
  const due = rowsOf(
    await supabase
      .from('jobs')
      .select('id')
      .neq('source', RETENTION_KEEP_SOURCE)
      .eq('status', RETENTION_DUE_STATUS)
      .not('closed_at', 'is', null)
      .lt('closed_at', retentionOverdueBefore(now, days))
      .limit(PART_SIZE),
  )
  const dueIds = due === null ? null : due.map((row) => String(row.id))
  if (dueIds === null || dueIds.length === 0) return judgeRetention(dueIds, [])
  const guarded = rowsOf(
    await supabase.from('job_applications').select('job_id').in('job_id', dueIds).limit(RETENTION_GUARD_ROWS),
  )
  return judgeRetention(dueIds, guarded === null ? null : guarded.map((row) => String(row.job_id)))
}

// The personal-data clean-up check (PRIV-5, D356). Unless RETENTION_DELETE
// is exactly "on" (the cron's own parser), the cron deletes nothing, so this
// answers ok with no read. When on: one limit(1) read per deleting rule, with
// the cron's own filter, for a row overdue by more than DAILY_GRACE_MS → late.
// R5 never deletes and is never read.
async function dataRetentionWord(supabase: ReturnType<typeof getServerSupabase>, now: number): Promise<CheckWord> {
  if (dataRetentionMode(process.env.RETENTION_DELETE) !== 'on') return 'ok'
  const reads = await Promise.all(
    RETENTION_RULES.filter((rule) => rule.deletes).map(async (rule) =>
      rowsOf(await applyRuleFilter(supabase.from(rule.table).select('id'), rule, dataRetentionOverdueBefore(rule, now)).limit(1)),
    ),
  )
  return judgeDataRetention(reads)
}

// The database size check: one read of public.ops_database_size()
// (migrations/0023, service_role only) as a GET. A failed read, or one that
// throws, answers unknown; the size itself never leaves this function.
async function databaseSizeWord(supabase: ReturnType<typeof getServerSupabase>): Promise<CheckWord> {
  try {
    const read = checkRead(await supabase.rpc('ops_database_size', {}, { get: true }), READ_LABEL)
    return judgeDatabaseSize(read.ok ? read.data : null)
  } catch (error) {
    console.error(`${READ_LABEL} failed`)
    reportServerError(READ_LABEL, error)
    return 'unknown'
  }
}

async function computeAnswer(): Promise<StatusAnswer> {
  const now = Date.now()
  const at = cutoffs(now)
  const supabase = getServerSupabase('publicRead')

  const [runs, expiring, pending, saved, retention, databaseSize, dataRetention] = await Promise.all([
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
    retentionWord(supabase, now),
    databaseSizeWord(supabase),
    dataRetentionWord(supabase, now),
  ])

  return summarise({
    'job-import': judgeRuns(rowsOf(runs), now),
    'job-expiry': judgeDue(rowsOf(expiring), 'expires_at', now, DAILY_GRACE_MS),
    'subscriber-cleanup': judgeDue(
      rowsOf(pending),
      'last_confirmation_sent_at',
      now,
      PENDING_SUBSCRIBER_MAX_AGE_MS + DAILY_GRACE_MS,
    ),
    'saved-jobs-cleanup': judgeDue(rowsOf(saved), 'last_seen_at', now, SAVED_JOB_MAX_AGE_MS + DAILY_GRACE_MS),
    'job-retention': retention,
    'database-size': databaseSize,
    'data-retention': dataRetention,
  })
}

export async function GET() {
  try {
    const answer = await opsStatusHold.get(computeAnswer)
    return NextResponse.json(answer.body, { status: answer.httpStatus, headers: HEADERS })
  } catch (error) {
    console.error('ops status check failed:', error)
    reportServerError('ops status check failed', error, { area: 'public' })
    const answer = neutralAttention()
    return NextResponse.json(answer.body, { status: answer.httpStatus, headers: HEADERS })
  }
}
