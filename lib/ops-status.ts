// Status words for the scheduled jobs, shown by /api/ops-status.
//
// Each check is judged from rows the jobs already leave behind, read by the
// route with one small query per check. The answer names only the check and
// one word, so it is safe to show to anyone.
//
// - ok: the job has done its work recently.
// - late: the job has not done its work within its time allowance.
// - failing: the job ran within its time allowance and every run failed.
// - unknown: the rows could not be read.
//
// A check with alerting: false is shown but never changes the overall answer.

export type CheckWord = 'ok' | 'late' | 'failing' | 'unknown'
export type OverallWord = 'ok' | 'attention'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

// Imports run per provider, each at its own interval (1,440 minutes by
// default), dispatched by the 15-minute schedule once a provider is due.
// 26 hours covers one default interval, the wait for the next tick and the
// run itself, with margin.
export const IMPORT_WINDOW_MS = 26 * HOUR_MS

// The daily jobs (expiry 06:00, subscriber clean-up 06:30, saved-jobs
// clean-up 07:00 UTC) can leave a due row in place for up to a day. 26 hours
// covers the day between runs and the run itself, with margin.
export const DAILY_GRACE_MS = 26 * HOUR_MS

// Same values as the clean-up routes use.
export const PENDING_SUBSCRIBER_MAX_AGE_MS = 7 * DAY_MS
export const SAVED_JOB_MAX_AGE_MS = 7 * DAY_MS

export const CHECKS = [
  { name: 'job-import', alerting: true },
  { name: 'job-expiry', alerting: false },
  { name: 'subscriber-cleanup', alerting: true },
  { name: 'saved-jobs-cleanup', alerting: true },
] as const

export type CheckName = (typeof CHECKS)[number]['name']

// Cut-off times for the reads, from one clock reading.
export function cutoffs(now: number) {
  return {
    importSince: new Date(now - IMPORT_WINDOW_MS).toISOString(),
    expiryBefore: new Date(now - DAILY_GRACE_MS).toISOString(),
    subscriberBefore: new Date(now - PENDING_SUBSCRIBER_MAX_AGE_MS - DAILY_GRACE_MS).toISOString(),
    savedJobBefore: new Date(now - SAVED_JOB_MAX_AGE_MS - DAILY_GRACE_MS).toISOString(),
  }
}

function age(now: number, value: unknown): number | null {
  if (typeof value !== 'string') return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : now - time
}

// Import runs started within the window: any completed run → ok; runs that
// all failed → failing; none → late. null rows means the read failed.
export function judgeRuns(rows: { status?: unknown; started_at?: unknown }[] | null, now: number, windowMs = IMPORT_WINDOW_MS): CheckWord {
  if (rows === null) return 'unknown'
  const recent = rows.filter((row) => {
    const runAge = age(now, row.started_at)
    return runAge !== null && runAge <= windowMs
  })
  if (recent.some((row) => row.status === 'completed')) return 'ok'
  if (recent.some((row) => row.status === 'failed')) return 'failing'
  return 'late'
}

// Rows that are due for a clean-up job: any row older than the allowance →
// late; none → ok. null rows means the read failed.
export function judgeDue(rows: Record<string, unknown>[] | null, column: string, now: number, allowanceMs: number): CheckWord {
  if (rows === null) return 'unknown'
  return rows.some((row) => {
    const rowAge = age(now, row[column])
    return rowAge !== null && rowAge > allowanceMs
  })
    ? 'late'
    : 'ok'
}

export type StatusAnswer = {
  httpStatus: 200 | 503
  body: { status: OverallWord; checks: Record<string, CheckWord> }
}

// 200 only when every alerting check is ok.
export function summarise(words: Record<CheckName, CheckWord>): StatusAnswer {
  const checks: Record<string, CheckWord> = {}
  let attention = false
  for (const check of CHECKS) {
    const word = words[check.name] ?? 'unknown'
    checks[check.name] = word
    if (check.alerting && word !== 'ok') attention = true
  }
  return { httpStatus: attention ? 503 : 200, body: { status: attention ? 'attention' : 'ok', checks } }
}

// The answer when the checks could not be completed at all.
export function neutralAttention(): StatusAnswer {
  return { httpStatus: 503, body: { status: 'attention', checks: {} } }
}

// How long one computed answer is reused, per server instance.
export const OPS_STATUS_HOLD_MS = 60_000

export type AnswerHold<T> = {
  get: (compute: () => Promise<T>) => Promise<T>
  clear: () => void
}

// Keeps one computed answer for holdMs from when its computation started.
// Callers that arrive while it runs share it. Any answer the computation
// returns is kept, ok or attention. A computation that throws is not kept,
// and a new computation always replaces the previous answer, so no older
// answer is ever returned once the hold has run out.
export function createAnswerHold<T>(holdMs: number = OPS_STATUS_HOLD_MS, clock: () => number = () => Date.now()): AnswerHold<T> {
  let held: { startedAt: number; answer: Promise<T> } | null = null
  return {
    get(compute) {
      const now = clock()
      if (held && now >= held.startedAt && now - held.startedAt < holdMs) return held.answer
      const entry = { startedAt: now, answer: new Promise<T>((resolve) => resolve(compute())) }
      held = entry
      entry.answer.catch(() => {
        if (held === entry) held = null
      })
      return entry.answer
    },
    clear() {
      held = null
    },
  }
}

export const opsStatusHold = createAnswerHold<StatusAnswer>()
