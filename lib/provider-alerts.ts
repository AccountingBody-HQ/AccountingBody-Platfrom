import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import type { JobProvider } from './providers'

// Every other Resend call site in this codebase instantiates the client
// inline — grep across lib/ and app/ turns up 15+ separate
// `new Resend(process.env.RESEND_API_KEY)` calls, no shared wrapper.
// lib/jobEmails.ts is the one existing shared email module, but every
// export in it is Job-listing-specific (branded HTML, manage-listing
// links, the `Job` type) and none of it fits a provider-ops alert.
// Following the established repo-wide convention here rather than
// building a second, competing email abstraction.
function getResend(): Resend {
  return new Resend(process.env.RESEND_API_KEY)
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

const ALERT_RECIPIENT = 'acctn.body@gmail.com'
const SITE_URL = 'https://accountingbody.com'

export type AlertState = 'ok' | 'zero_fetch' | 'poor_quality' | 'failing'

// Priority order matters: a zero-fetch run always also computes
// relevanceRate as null -> data quality status 'poor' (see
// lib/ingestion/quality.ts), so a dead provider would otherwise satisfy
// both the health and quality conditions at once. Checking in this
// order picks the single most actionable label instead of double-
// alerting on what is really one underlying problem.
export function deriveAlertState(
  healthStatus: string,
  dataQualityStatus: string | null,
  consecutiveFailures: number
): AlertState {
  if (consecutiveFailures >= 2) return 'failing'
  if (healthStatus === 'degraded') return 'zero_fetch'
  if (dataQualityStatus === 'poor') return 'poor_quality'
  return 'ok'
}

function stateLabel(state: AlertState): string {
  switch (state) {
    case 'failing': return 'repeated failures'
    case 'zero_fetch': return '0 jobs fetched'
    case 'poor_quality': return 'poor data quality'
    case 'ok': return 'recovered'
  }
}

function buildAlertEmail(
  provider: JobProvider,
  newState: AlertState,
  isRecovery: boolean,
  consecutiveFailures: number,
  justAutoPaused: boolean
): { subject: string; html: string } {
  const providerUrl = `${SITE_URL}/roodber8/providers/${provider.slug}`
  const subject = isRecovery
    ? `[AccountingBody] ${provider.slug}: recovered`
    : justAutoPaused
      ? `[AccountingBody] ${provider.slug}: PAUSED after ${consecutiveFailures} failures`
      : `[AccountingBody] ${provider.slug}: ${stateLabel(newState)}`

  const rows: string[] = [
    `<tr><td style="padding:6px 12px;color:#64748b;">Provider</td><td style="padding:6px 12px;color:#1e293b;font-weight:700;">${provider.name}</td></tr>`,
    `<tr><td style="padding:6px 12px;color:#64748b;">Slug</td><td style="padding:6px 12px;color:#1e293b;font-family:monospace;">${provider.slug}</td></tr>`,
    `<tr><td style="padding:6px 12px;color:#64748b;">Changed</td><td style="padding:6px 12px;color:#1e293b;">${provider.last_alert_state ?? 'unrecorded'} &rarr; ${newState}</td></tr>`,
  ]

  if (justAutoPaused) {
    rows.push(`<tr><td style="padding:6px 12px;color:#64748b;">Auto-paused</td><td style="padding:6px 12px;color:#ef4444;font-weight:700;">Yes — status set to 'paused', will not run again until manually reactivated</td></tr>`)
  }

  // The relevant numbers per state — JobProvider carries no direct
  // "jobs fetched this run" field (that lives on provider_runs, and
  // this function's signature is JobProvider-only), so each branch
  // surfaces only what JobProvider actually holds, honestly labelled.
  // consecutiveFailures is always the caller's freshly-known value
  // (0 on the success path, a just-re-read value on the failure path)
  // — never provider.consecutive_failures, which is this run's stale
  // pre-write snapshot and would misreport both a just-reset streak
  // (on recovery) and a just-incremented one (on failure).
  if (isRecovery) {
    rows.push(`<tr><td style="padding:6px 12px;color:#64748b;">Consecutive failures</td><td style="padding:6px 12px;color:#1e293b;">${consecutiveFailures}</td></tr>`)
  } else if (newState === 'zero_fetch') {
    // health_status becomes 'degraded' only when a run fetched exactly
    // zero jobs (see updateProviderHealth) — so "0 jobs" is implied by
    // this branch being reached, not a fabricated number.
    rows.push(`<tr><td style="padding:6px 12px;color:#64748b;">Fetched</td><td style="padding:6px 12px;color:#ef4444;font-weight:700;">0 jobs</td></tr>`)
    rows.push(`<tr><td style="padding:6px 12px;color:#64748b;">Health status</td><td style="padding:6px 12px;color:#1e293b;">${provider.health_status}</td></tr>`)
  } else if (newState === 'poor_quality') {
    rows.push(`<tr><td style="padding:6px 12px;color:#64748b;">Relevance rate</td><td style="padding:6px 12px;color:#ef4444;font-weight:700;">${provider.last_relevance_rate === null ? 'Not measured' : `${provider.last_relevance_rate}%`}</td></tr>`)
  } else if (newState === 'failing') {
    rows.push(`<tr><td style="padding:6px 12px;color:#64748b;">Consecutive failures</td><td style="padding:6px 12px;color:#ef4444;font-weight:700;">${consecutiveFailures}</td></tr>`)
    if (provider.last_error_message) {
      rows.push(`<tr><td style="padding:6px 12px;color:#64748b;">Last error</td><td style="padding:6px 12px;color:#1e293b;">${provider.last_error_message}</td></tr>`)
    }
  }

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;">
<div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
  <div style="background:${isRecovery ? '#16a34a' : '#0C1A3D'};padding:24px 32px;">
    <p style="color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 6px;">Provider Alert</p>
    <h1 style="color:#fff;font-size:20px;margin:0;">${isRecovery ? 'Provider recovered' : justAutoPaused ? 'Provider auto-paused' : `Provider needs attention: ${stateLabel(newState)}`}</h1>
  </div>
  <div style="padding:24px 32px;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">${rows.join('')}</table>
    <a href="${providerUrl}" style="display:inline-block;background:#0C1A3D;color:#fff;font-weight:700;font-size:13px;padding:10px 20px;border-radius:8px;text-decoration:none;">View provider &rarr;</a>
  </div>
</div>
</body></html>`

  return { subject, html }
}

// Alert on TRANSITIONS, not state — an email fires only when newState
// differs from the provider's last recorded alert state (and isn't
// 'ok'), plus one recovery email when it returns to 'ok' from anything
// else. Every call writes last_alert_state, whether or not an email
// was sent, so the next run always has an accurate transition baseline
// to diff against — that's what stops eight providers x 96 runs a day
// from re-alerting on every single run while a problem persists.
//
// consecutiveFailures is the caller's freshly-known value (never taken
// from provider.consecutive_failures, which is this run's stale
// pre-write snapshot) — used for display only, deriveAlertState's own
// threshold decision happens in the caller before this is invoked.
//
// justAutoPaused forces an email even when the label itself (e.g.
// 'failing') didn't change from the last run — an auto-pause is a
// materially new, more severe event than "still failing" and must
// never be silently swallowed by the same-label suppression below.
export async function maybeSendProviderAlert(
  provider: JobProvider,
  newState: AlertState,
  consecutiveFailures: number,
  justAutoPaused = false
): Promise<void> {
  // Defensive — the only current callers (app/api/ingest/[slug]/route.ts,
  // both the success and failure paths) already can't reach this function
  // for a paused provider on the SAME run that pauses it (justAutoPaused
  // covers that), and can't reach it at all for a provider already paused
  // from an earlier run (the route returns before creating a run at all).
  // This makes the guarantee hold even if a future caller doesn't share
  // either of those structural exits.
  if (provider.status === 'paused' && !justAutoPaused) return

  const previousState = provider.last_alert_state
  const shouldAlert = newState !== previousState && newState !== 'ok'
  const isRecovery = newState === 'ok' && previousState !== null && previousState !== 'ok'
  const shouldSend = shouldAlert || isRecovery || justAutoPaused

  if (shouldSend) {
    try {
      const { subject, html } = buildAlertEmail(provider, newState, isRecovery, consecutiveFailures, justAutoPaused)
      const { error: sendError } = await getResend().emails.send({
        from: 'AccountingBody Alerts <noreply@accountingbody.com>',
        to: ALERT_RECIPIENT,
        subject,
        html,
      })
      // Rule 101 — Resend's SDK returns { data, error } rather than
      // throwing on an API-level failure; check and log it explicitly,
      // never assume the call succeeded just because it didn't throw.
      if (sendError) {
        console.error('[maybeSendProviderAlert] Resend error:', sendError)
      }
    } catch (err: unknown) {
      console.error('[maybeSendProviderAlert] send threw:', err)
    }
  }

  const supabase = getSupabase()
  const { error: updateError } = await supabase
    .from('job_providers')
    .update({
      last_alert_state: newState,
      ...(shouldSend ? { last_alert_sent_at: new Date().toISOString() } : {}),
    })
    .eq('id', provider.id)
  if (updateError) {
    console.error('[maybeSendProviderAlert] failed to write last_alert_state:', updateError.message)
  }
}
