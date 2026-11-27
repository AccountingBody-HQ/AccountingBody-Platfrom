// Unsubscribing from the newsletter. Server only.
//
// - With a link: the signed token names the row and site; that row, if it is
//   subscribed or pending, becomes unsubscribed. A row that is already
//   unsubscribed or missing gets the same answer, so a link works every time.
// - Without a link: the visitor types an address and, if it is on the list
//   for this site, one e-mail with an unsubscribe link is sent. The caller
//   always gives the same answer, so nobody can learn who is on the list.
//   The typed address is used only for the lookup and that e-mail; it is
//   never stored. Best-effort limits in memory, per running instance: per IP
//   address 5 requests in 10 minutes, and per e-mail address 1 e-mail an hour,
//   keyed on a sha256 of the lower-cased address, never the address itself.
// - Log lines are a short label and an error code only.

import { createHash } from 'node:crypto'
import { checkEmailSend } from './email-check'
import { reportServerError } from './report-error'
import { type ContactBrand } from './contact-brand'
import { NEWSLETTER_SENDER, errorCode, newsletterBrand, newsletterEmailHtml, type NewsletterMailer } from './newsletter-signup'
import { unsubscribeUrl, verifyUnsubscribeToken, type NewsletterPlatform } from './newsletter-tokens'
import type { getServerSupabase } from './supabase-server'

type Db = ReturnType<typeof getServerSupabase>

export const IP_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 }
export const ADDRESS_LIMIT = { max: 1, windowMs: 60 * 60 * 1000 }
const MAX_KEYS = 10_000

type Window = { count: number; resetTime: number }
const ipWindows = new Map<string, Window>()
const addressWindows = new Map<string, Window>()

// Counts one use of `key`; false once the window's limit is reached.
function take(store: Map<string, Window>, key: string, limit: { max: number; windowMs: number }, now: number): boolean {
  const entry = store.get(key)
  if (!entry || entry.resetTime <= now) {
    store.delete(key)
    while (store.size >= MAX_KEYS) {
      const oldest = store.keys().next().value
      if (oldest === undefined) break
      store.delete(oldest)
    }
    store.set(key, { count: 1, resetTime: now + limit.windowMs })
    return true
  }
  if (entry.count >= limit.max) return false
  entry.count += 1
  return true
}

export function addressKey(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase(), 'utf8').digest('hex')
}

// Clears the limits (tests).
export function clearUnsubscribeLimits(): void {
  ipWindows.clear()
  addressWindows.clear()
}

export function unsubscribeLinkEmailHtml(brand: ContactBrand, url: string): string {
  return newsletterEmailHtml({
    brand,
    heading: 'Unsubscribe from our e-mails.',
    textHtml: 'Click below to stop receiving our newsletter e-mails.',
    buttonLabel: 'Unsubscribe',
    buttonUrl: url,
    small: 'If you did not ask for this, you can ignore this e-mail and nothing will change.',
  })
}

export type UnsubscribeResult = { kind: 'done' } | { kind: 'invalid' } | { kind: 'server-error' }

export async function unsubscribeByToken(supabase: Db, token: unknown, now = new Date()): Promise<UnsubscribeResult> {
  const claim = await verifyUnsubscribeToken(token)
  if (!claim) return { kind: 'invalid' }
  const { error } = await supabase
    .from('email_subscribers')
    .update({ status: 'unsubscribed', unsubscribed_at: now.toISOString(), confirmation_token: null })
    .eq('id', claim.id)
    .eq('platform', claim.platform)
    .in('status', ['subscribed', 'pending'])
  if (error) {
    console.error('unsubscribe: save failed', errorCode(error))
    reportServerError('unsubscribe: save failed', error, { area: 'public' })
    return { kind: 'server-error' }
  }
  return { kind: 'done' }
}

// Sends the unsubscribe-link e-mail when the address is on the list and the
// limits allow. Never throws and returns nothing the caller could reveal.
export async function requestUnsubscribeLink({
  supabase,
  resend,
  email,
  platform,
  ip,
  now = Date.now(),
}: {
  supabase: Db
  resend: NewsletterMailer
  email: string
  platform: NewsletterPlatform
  ip: string
  now?: number
}): Promise<void> {
  try {
    if (!take(ipWindows, ip || 'unknown', IP_LIMIT, now)) return
    const { data: row, error } = await supabase
      .from('email_subscribers')
      .select('id, status')
      .eq('email', email.trim().toLowerCase())
      .eq('platform', platform)
      .in('status', ['subscribed', 'pending'])
      .maybeSingle()
    if (error) {
      console.error('unsubscribe request: lookup failed', errorCode(error))
      reportServerError('unsubscribe request: lookup failed', error, { area: 'public' })
      return
    }
    if (!row || typeof row.id !== 'string') return
    if (!take(addressWindows, addressKey(email), ADDRESS_LIMIT, now)) return

    const brand = newsletterBrand(platform)
    const sendResult = await resend.emails.send({
      from: brand.name + ' <' + NEWSLETTER_SENDER + '>',
      to: email.trim(),
      subject: 'Your unsubscribe link - ' + brand.name,
      html: unsubscribeLinkEmailHtml(brand, await unsubscribeUrl(row.id, platform)),
    })
    checkEmailSend(sendResult, 'unsubscribe link')
  } catch (error) {
    console.error('unsubscribe request: failed', errorCode(error))
    reportServerError('unsubscribe request: failed', error, { area: 'public' })
  }
}
