// Newsletter sign-up with a confirmation e-mail (double opt-in), shared by
// every place a visitor can ask for the newsletter: the newsletter forms
// (/api/subscribe) and the contact form (/api/contact). Server only.
//
// - An address that is already subscribed gets a fresh confirmation e-mail;
//   its row keeps its status and only the new token hash is stored.
// - Otherwise a confirmation sent within the last hour is not sent again.
// - The e-mail is sent first. Only after the provider confirms the send is
//   the pending row recorded (status, time sent, token hash, where the person
//   signed up). A failed send records nothing, so the person can try again.
// - Log lines are a short label and an error code only: never an e-mail
//   address, a token or a whole error object.

import { shouldSendConfirmationEmail } from './subscribe-dedup'
import { checkEmailSend, type EmailSendResultLike } from './email-check'
import { reportServerError } from './report-error'
import { getContactBrand, type ContactBrand } from './contact-brand'
import { createConfirmationToken, type NewsletterPlatform } from './newsletter-tokens'
import type { getServerSupabase } from './supabase-server'
import type { HumanCheckReason } from './turnstile-verify'

export type NewsletterSource = 'footer' | 'contact_form'

export type NewsletterSignupResult =
  | { kind: 'sent' }
  | { kind: 'already-sent' }
  | { kind: 'send-failed' }
  | { kind: 'server-error' }

export type NewsletterMailer = {
  emails: {
    send(message: { from: string; to: string; subject: string; html: string }): Promise<EmailSendResultLike>
  }
}

type Db = ReturnType<typeof getServerSupabase>

export const NEWSLETTER_SENDER = 'noreply@accountingbody.com'

// The answer to a refused person check on the newsletter routes
// (/api/subscribe, /api/unsubscribe). "unreachable" covers a network failure
// or no answer in time from Cloudflare, an unreadable reply, and a
// missing/misconfigured secret — none of them is something the visitor did
// wrong, so they all get the same user-facing copy.
export type NewsletterCheckReason = 'missing_token' | 'invalid_token' | 'unreachable'

const CHECK_REASON: Record<HumanCheckReason, NewsletterCheckReason> = {
  missing: 'missing_token',
  'not-confirmed': 'invalid_token',
  unreadable: 'unreachable',
  unavailable: 'unreachable',
}

export function personCheckRefusal(humanReason: HumanCheckReason): {
  reason: NewsletterCheckReason
  body: { error: string; code: string }
  status: number
} {
  const reason = CHECK_REASON[humanReason]
  const unreachable = reason === 'unreachable'
  return {
    reason,
    body: {
      error: unreachable
        ? "We couldn't verify your request right now. Please try again in a moment."
        : "We couldn't verify your request. If you're using an ad blocker or privacy extension, please disable it for this page and try again.",
      code: unreachable ? 'turnstile_unreachable' : 'turnstile_failed',
    },
    status: unreachable ? 503 : 400,
  }
}

const SHORT_CODE = /^[A-Za-z0-9_.-]{1,40}$/

// The error's code only, for a log line ('no-code' when it has none that
// looks like a code). Never the message, which can echo an address.
export function errorCode(error: unknown): string {
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined
  return typeof code === 'string' && SHORT_CODE.test(code) ? code : 'no-code'
}

export function newsletterBrand(platform: NewsletterPlatform): ContactBrand {
  return getContactBrand(platform === 'et')
}

// The layout of the newsletter e-mails: brand bar with a heading, one
// paragraph, one gold button and one line of small text.
export function newsletterEmailHtml(parts: {
  brand: ContactBrand
  heading: string
  textHtml: string
  buttonLabel: string
  buttonUrl: string
  small: string
}): string {
  const { brand } = parts
  return "<!DOCTYPE html><html><body style=\"margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;\"><div style=\"max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;\"><div style=\"background:" + brand.color + ";padding:32px 40px;\"><p style=\"color:#C9982A;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;\">" + brand.name + "</p><h1 style=\"color:#fff;font-size:24px;margin:0;line-height:1.3;\">" + parts.heading + "</h1></div><div style=\"padding:32px 40px;\"><p style=\"color:#475569;font-size:15px;line-height:1.7;margin:0 0 28px;\">" + parts.textHtml + "</p><a href=\"" + parts.buttonUrl + "\" style=\"display:inline-block;background:#C9982A;color:#0a0f2e;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;\">" + parts.buttonLabel + "</a><p style=\"color:#94a3b8;font-size:13px;margin-top:32px;\">" + parts.small + "</p></div><div style=\"background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;\"><p style=\"color:#94a3b8;font-size:12px;margin:0;\">" + brand.name + " - Expert accounting and finance services. <a href=\"https://" + brand.domain + "\" style=\"color:#94a3b8;\">" + brand.domain + "</a></p></div></div></body></html>"
}

export function confirmationEmailHtml(brand: ContactBrand, confirmUrl: string): string {
  return newsletterEmailHtml({
    brand,
    heading: 'Confirm your subscription.',
    textHtml:
      'One last step - click below to confirm your subscription. No spam. You can unsubscribe at any time at <a href="https://' +
      brand.domain + '/unsubscribe">' + brand.domain + '/unsubscribe</a>.',
    buttonLabel: 'Confirm subscription',
    buttonUrl: confirmUrl,
    small: 'This link expires in 7 days. If you did not sign up, ignore this email.',
  })
}

export async function startNewsletterSignup({
  supabase,
  resend,
  email,
  platform,
  source,
  now = new Date(),
}: {
  supabase: Db
  resend: NewsletterMailer
  email: string
  platform: NewsletterPlatform
  source: NewsletterSource
  now?: Date
}): Promise<NewsletterSignupResult> {
  const normalisedEmail = email.toLowerCase().trim()

  // If the lookup fails nothing is sent: without it the code cannot tell
  // whether a confirmation went out recently.
  const { data: existing, error: readError } = await supabase
    .from('email_subscribers')
    .select('status, last_confirmation_sent_at, source')
    .eq('email', normalisedEmail)
    .eq('platform', platform)
    .maybeSingle()
  if (readError) {
    console.error('newsletter signup: lookup failed', errorCode(readError))
    reportServerError('newsletter signup: lookup failed', readError, { area: 'public' })
    return { kind: 'server-error' }
  }

  const alreadySubscribed = existing?.status === 'subscribed'
  if (!alreadySubscribed) {
    const lastSentAt = existing?.last_confirmation_sent_at ? new Date(existing.last_confirmation_sent_at) : null
    if (!shouldSendConfirmationEmail({ lastSentAt, now })) return { kind: 'already-sent' }
  }

  const brand = newsletterBrand(platform)
  const { token, hash } = createConfirmationToken()
  const confirmUrl = 'https://' + brand.domain + '/api/confirm-subscription?token=' + token

  const sendResult = await resend.emails.send({
    from: brand.name + ' <' + NEWSLETTER_SENDER + '>',
    to: email,
    subject: 'Confirm your subscription - ' + brand.name,
    html: confirmationEmailHtml(brand, confirmUrl),
  })
  if (!checkEmailSend(sendResult, 'subscribe confirmation')) return { kind: 'send-failed' }

  if (alreadySubscribed) {
    // Never changes the status of a subscribed row.
    const { error } = await supabase
      .from('email_subscribers')
      .update({ confirmation_token: hash })
      .eq('email', normalisedEmail)
      .eq('platform', platform)
      .eq('status', 'subscribed')
    if (error) console.error('newsletter signup: token not stored (non-fatal)', errorCode(error))
  } else {
    const { error } = await supabase
      .from('email_subscribers')
      .upsert(
        {
          email: normalisedEmail,
          platform,
          status: 'pending',
          last_confirmation_sent_at: now.toISOString(),
          confirmation_token: hash,
          source,
        },
        { onConflict: 'email,platform' },
      )
    if (error) console.error('newsletter signup: pending row not recorded (non-fatal)', errorCode(error))
  }

  return { kind: 'sent' }
}
