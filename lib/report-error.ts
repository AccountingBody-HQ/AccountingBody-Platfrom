// Sends a server problem to Sentry as one short report.
//
// reportServerError(label, error, extra) is called next to a route's own log
// line. It adds nothing to the answer and never throws.
//
// What a report contains:
// - the label: fixed text chosen by the code, e.g. 'contact submit failed'
// - the error's name, its code when it looks like a code, and the first 120
//   characters of its message with email addresses, long token-like strings
//   and long digit runs replaced by "[removed]"
// - the area (public, admin, cron or ingest) and, when given, a short code
// - how many repeats were held back since the last report for this label
//
// What it never contains: the request (address, query, headers, cookies,
// body), the visitor, breadcrumbs, the route name, file paths, source lines,
// the server's host name or database rows. The report is built from the
// values above only; everything else Sentry would add is removed before it
// is sent (see keepReportFields in ./sentry-privacy).
//
// At most one report per label per 10 minutes is sent from each running
// instance; repeats in between are counted and sent with the next report.
// All problem reports together are also limited per hour (see
// REPORTS_PER_HOUR in ./sentry-privacy).
// When Sentry is not set up (no DSN, or in tests) nothing happens.

import * as Sentry from '@sentry/nextjs'
import { clearReportQuota, keepReportFields, markHelperReport, scrubText } from './sentry-privacy'

export { keepReportFields, scrubText, REPORTS_PER_HOUR, REPORT_HOUR_MS } from './sentry-privacy'

export type ReportArea = 'public' | 'admin' | 'cron' | 'ingest'

export type ReportExtra = { area?: ReportArea; code?: string }

export const REPORT_WINDOW_MS = 10 * 60 * 1000
export const MAX_REPORT_LABELS = 500

const LABEL_LENGTH = 80

const SHORT_CODE = /^[A-Za-z0-9_.-]{1,40}$/
const ERROR_NAME = /^[A-Za-z][A-Za-z0-9_]{0,40}$/
const AREAS: readonly ReportArea[] = ['public', 'admin', 'cron', 'ingest']

function shortCode(value: unknown): string | undefined {
  if (typeof value === 'string' && SHORT_CODE.test(value)) return value
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 1_000_000) return String(value)
  return undefined
}

export type ErrorSummary = { name: string; code?: string; message: string }

// Reads only name, code and message; never walks or serialises the value.
export function summariseError(error: unknown): ErrorSummary {
  if (typeof error === 'string') return { name: 'Error', message: scrubText(error) }
  if (typeof error !== 'object' || error === null) {
    return { name: 'Error', message: error === null ? 'null value' : `${typeof error} value` }
  }
  const { name, code, message } = error as { name?: unknown; code?: unknown; message?: unknown }
  return {
    name: typeof name === 'string' && ERROR_NAME.test(name) ? name : 'Error',
    code: shortCode(code),
    message: typeof message === 'string' ? scrubText(message) : '',
  }
}

// ── Once per label per window ───────────────────────────────────────────────

type Window = { sentAt: number; heldBack: number }
const windows = new Map<string, Window>()

// Returns the number of repeats held back since the last report, or null when
// this one is held back.
function admit(label: string, now: number): number | null {
  const open = windows.get(label)
  if (open && now >= open.sentAt && now - open.sentAt < REPORT_WINDOW_MS) {
    open.heldBack += 1
    return null
  }
  const heldBack = open?.heldBack ?? 0
  windows.delete(label)
  while (windows.size >= MAX_REPORT_LABELS) {
    const oldest = windows.keys().next().value
    if (oldest === undefined) break
    windows.delete(oldest)
  }
  windows.set(label, { sentAt: now, heldBack: 0 })
  return heldBack
}

// Clears the per-label windows and the hourly count (tests).
export function clearReportWindows(): void {
  windows.clear()
  clearReportQuota()
}

// ── The report ──────────────────────────────────────────────────────────────

export function reportServerError(label: string, error: unknown, extra: ReportExtra = {}): void {
  try {
    if (!Sentry.isInitialized()) return
    const safeLabel = scrubText(String(label), LABEL_LENGTH) || 'server problem'
    const heldBack = admit(safeLabel, Date.now())
    if (heldBack === null) return

    const summary = summariseError(error)
    const report = new Error(summary.message)
    report.name = summary.name
    report.stack = undefined
    markHelperReport(report)

    const area = AREAS.includes(extra.area as ReportArea) ? extra.area : undefined
    const code = shortCode(extra.code)

    Sentry.startNewTrace(() => {
      Sentry.withScope((scope) => {
        scope.setFingerprint([safeLabel])
        scope.setLevel('error')
        scope.setTag('label', safeLabel)
        if (area) scope.setTag('area', area)
        if (summary.code) scope.setExtra('error_code', summary.code)
        if (code) scope.setExtra('code', code)
        scope.setExtra('held_back', heldBack)
        scope.addEventProcessor((event) => (event.type === undefined ? keepReportFields(event) : event))
        Sentry.captureException(report)
      })
    })
  } catch {
    // Reporting must never change the answer.
  }
}
