// The daily job expiry run (app/api/cron/expire-jobs/route.ts).
//
// - Reads active jobs past their expiry 500 at a time, oldest first, each
//   page starting after the last row of the one before.
// - Closes them with one update per group of at most 100 ids; only jobs that
//   are still active change.
// - Closes at most JOB_EXPIRY_MAX_PER_RUN jobs per run (default 1,000).
// - Starts no new page, group or email once 35 s have passed; every request
//   it makes ends by 45 s after the start.
// - Emails only employers who posted on the site, at most 40 per run.
// - Never retries.

import type { CreateEmailResponse } from 'resend'
import { checkEmailSend } from '@/lib/email-check'
import type { ExpiringJobsPage, ExpiryCursor, Job } from '@/lib/jobs'

export const EXPIRY_PAGE_SIZE = 500
export const EXPIRY_GROUP_SIZE = 100
export const JOB_EXPIRY_DEFAULT_MAX = 1_000
export const JOB_EXPIRY_HIGHEST_MAX = 10_000
export const JOB_EMAILS_PER_RUN_CAP = 40

// Measured from the start of the run (route limit 60 s).
export const START_BUDGET_MS = 35_000
export const WORK_END_MS = 45_000
export const RESET_END_MS = 55_000

// The owner setting JOB_EXPIRY_MAX_PER_RUN: a whole number from 1 to 10,000,
// written plainly; anything else means the default.
export function jobExpiryMaxPerRun(value: string | undefined): number {
  if (value === undefined || !/^[1-9][0-9]{0,4}$/.test(value)) return JOB_EXPIRY_DEFAULT_MAX
  const max = Number(value)
  return max <= JOB_EXPIRY_HIGHEST_MAX ? max : JOB_EXPIRY_DEFAULT_MAX
}

export function inGroups<T>(items: T[], size: number): T[][] {
  const groups: T[][] = []
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size))
  return groups
}

// ── Who is emailed ──────────────────────────────────────────────────────────

const PLAUSIBLE_EMAIL =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,63}$/
const NO_REPLY = /(^|[._+-])no-?reply([._+-]|@)/i
// The address the provider import gives every job it adds.
const IMPORT_ADDRESS = /^noreply\+[^@]*@accountingbody\.com$/i

export const SITE_EMPLOYER_SOURCE = 'employer'

export function mayEmailEmployer(job: Pick<Job, 'source' | 'employer_email'>): boolean {
  if (job.source !== SITE_EMPLOYER_SOURCE) return false
  const address = job.employer_email
  if (typeof address !== 'string' || address.length > 254) return false
  if (!PLAUSIBLE_EMAIL.test(address)) return false
  if (NO_REPLY.test(address)) return false
  if (IMPORT_ADDRESS.test(address)) return false
  return true
}

// Only warn once per listing: a job's 60-day window means "expiring within
// 7 days" is true for 7 consecutive daily cron runs. Narrowing to the
// 6–7 day band means the warning condition is true on exactly one of those
// runs (assuming the cron fires roughly once every 24h).
export function isInWarningWindow(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  const daysUntilExpiry = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return daysUntilExpiry > 6 && daysUntilExpiry <= 7
}

// ── Short codes for log lines ───────────────────────────────────────────────

const SHORT_CODE = /^[A-Za-z0-9_.-]{1,40}$/

// The problem's own short code, else its short name, else "Error". Never its
// message or any other field.
export function problemCode(problem: unknown): string {
  if (typeof problem === 'object' && problem !== null) {
    const { code, name } = problem as { code?: unknown; name?: unknown }
    if (typeof code === 'string' && SHORT_CODE.test(code)) return code
    if (typeof name === 'string' && SHORT_CODE.test(name)) return name
  }
  return 'Error'
}

// What the run reports: a database problem (a plain object whose text can
// quote row values) becomes a fixed error with only its short code; an
// error thrown by code is reported as it is.
export function reportableProblem(problem: unknown): unknown {
  if (problem instanceof Error) return problem
  const fixed = new Error('job expiry database request failed') as Error & { code?: string }
  const code = typeof problem === 'object' && problem !== null ? (problem as { code?: unknown }).code : undefined
  if (typeof code === 'string' && SHORT_CODE.test(code)) fixed.code = code
  return fixed
}

// ── Time limits ─────────────────────────────────────────────────────────────

const RUN_TIME_LIMIT = 'job expiry run time limit reached'

// Runs `work` with a signal that aborts at `endsAt` on the run's clock.
export async function untilEnd<T>(endsAt: number, now: () => number, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new DOMException(RUN_TIME_LIMIT, 'TimeoutError')), Math.max(0, endsAt - now()))
  if (typeof timer === 'object' && timer !== null && 'unref' in timer) timer.unref()
  try {
    return await work(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

// An email still waiting when the signal aborts counts as not sent.
function sendResultBy(send: Promise<CreateEmailResponse>, signal: AbortSignal): Promise<CreateEmailResponse | FailedSend> {
  send.catch(() => {})
  return Promise.race([
    send,
    new Promise<FailedSend>((resolve) => {
      const late = () => resolve({ data: null, error: { name: 'timeout' } })
      if (signal.aborted) late()
      else signal.addEventListener('abort', late, { once: true })
    }),
  ])
}

type FailedSend = { data: null; error: { name: string } }

// ── The run ─────────────────────────────────────────────────────────────────

export type ExpiryStep = 'expire' | 'warn'

export type ExpiryRunDeps = {
  now: () => number
  maxClosed: number
  // `page.now` is the start of the run: the windows are measured from it.
  readPage: (step: ExpiryStep, page: ExpiringJobsPage) => Promise<Job[]>
  closeIds: (ids: string[], at: Date, signal: AbortSignal) => Promise<string[]>
  sendExpired: (job: Job) => Promise<CreateEmailResponse>
  sendWarning: (job: Job) => Promise<CreateEmailResponse>
}

export type ExpiryRunResult = {
  start: number
  expired: number
  warned: number
  more: boolean
  // Emails started this run.
  emails: number
  // An email was left unsent because the run's email limit was reached.
  emailCapReached: boolean
  // A group of jobs could not be closed; closing stopped there.
  closeFailed: boolean
  // The first read or write problem; the run answers a failure when set.
  failed: boolean
  problem: unknown
}

export async function runJobExpiry(deps: ExpiryRunDeps): Promise<ExpiryRunResult> {
  const start = deps.now()
  const timeLeft = () => deps.now() - start < START_BUDGET_MS
  const workEnd = start + WORK_END_MS

  let expired = 0
  let warned = 0
  let more = false
  let failed = false
  let problem: unknown = null
  let emails = 0
  let emailCapReached = false
  let closeFailed = false

  const fail = (found: unknown) => {
    if (!failed) problem = found
    failed = true
  }

  const sendEmail = async (job: Job, send: (job: Job) => Promise<CreateEmailResponse>): Promise<boolean> => {
    if (!mayEmailEmployer(job)) return false
    if (emails >= JOB_EMAILS_PER_RUN_CAP) {
      emailCapReached = true
      return false
    }
    if (!timeLeft()) return false
    emails += 1
    let result: CreateEmailResponse | FailedSend
    try {
      result = await untilEnd(workEnd, deps.now, (signal) => sendResultBy(send(job), signal))
    } catch (error: unknown) {
      result = { data: null, error: { name: problemCode(error) } }
    }
    return checkEmailSend(result, 'job expiry email')
  }

  // 1 & 2. Close jobs already past their expiry and tell each employer.
  let after: ExpiryCursor | null = null
  expiry: while (true) {
    if (expired >= deps.maxClosed || !timeLeft()) {
      more = true
      break
    }
    const limit = Math.min(EXPIRY_PAGE_SIZE, deps.maxClosed - expired)
    let rows: Job[]
    try {
      rows = await untilEnd(workEnd, deps.now, (signal) => deps.readPage('expire', { now: start, after, limit, signal }))
    } catch (error: unknown) {
      fail(error)
      break
    }

    for (const group of inGroups(rows, EXPIRY_GROUP_SIZE)) {
      if (!timeLeft()) {
        more = true
        break expiry
      }
      let closed: string[]
      try {
        closed = await untilEnd(workEnd, deps.now, (signal) =>
          deps.closeIds(group.map((job) => job.id), new Date(deps.now()), signal),
        )
      } catch (error: unknown) {
        closeFailed = true
        fail(error)
        break expiry
      }
      expired += closed.length
      const closedIds = new Set(closed)
      for (const job of group) {
        if (closedIds.has(job.id)) await sendEmail(job, deps.sendExpired)
      }
    }

    if (rows.length < limit) break
    const last = rows[rows.length - 1]
    after = { expires_at: String(last.expires_at), id: last.id }
  }

  // 3 & 4. Warn employers of listings expiring within 7 days — only ones
  // that have had at least one impression, and only once (6-7 day band).
  let warnAfter: ExpiryCursor | null = null
  while (timeLeft() && emails < JOB_EMAILS_PER_RUN_CAP) {
    let rows: Job[]
    try {
      rows = await untilEnd(workEnd, deps.now, (signal) =>
        deps.readPage('warn', { now: start, after: warnAfter, limit: EXPIRY_PAGE_SIZE, signal }),
      )
    } catch (error: unknown) {
      fail(error)
      break
    }
    for (const job of rows) {
      if (job.impression_count <= 0) continue
      if (!isInWarningWindow(job.expires_at)) continue
      if (await sendEmail(job, deps.sendWarning)) warned += 1
    }
    if (rows.length < EXPIRY_PAGE_SIZE) break
    const last = rows[rows.length - 1]
    warnAfter = { expires_at: String(last.expires_at), id: last.id }
  }

  return { start, expired, warned, more, emails, emailCapReached, closeFailed, failed, problem }
}
