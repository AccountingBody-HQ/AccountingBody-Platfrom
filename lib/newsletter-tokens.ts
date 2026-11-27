// Tokens for newsletter e-mail links. No e-mail address is ever put inside a
// link or a token.
//
// - Confirmation link: 32 random bytes (base64url). Only the sha256 hash is
//   stored, in email_subscribers.confirmation_token; the raw token exists only
//   in the e-mail. A token works while last_confirmation_sent_at is less than
//   7 days old.
// - Unsubscribe link: a signed token (HS256, JWT_SECRET) holding only the row
//   id, the site code and its purpose. It has no expiry on purpose: an
//   unsubscribe link must keep working for as long as e-mails can arrive.

import { createHash, randomBytes } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'

export type NewsletterPlatform = 'ab' | 'et'

export const CONFIRMATION_TOKEN_LIFE_MS = 7 * 24 * 60 * 60 * 1000

const CONFIRMATION_TOKEN = /^[A-Za-z0-9_-]{43}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const UNSUBSCRIBE_PURPOSE = 'unsubscribe'

export function newsletterDomain(platform: NewsletterPlatform): string {
  return platform === 'et' ? 'ethiotax.com' : 'accountingbody.com'
}

export function hashConfirmationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function createConfirmationToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashConfirmationToken(token) }
}

// True for a value shaped like a token from createConfirmationToken.
export function isConfirmationTokenShape(value: unknown): value is string {
  return typeof value === 'string' && CONFIRMATION_TOKEN.test(value)
}

// True while a confirmation sent at `sentAt` may still be used.
export function isConfirmationFresh(sentAt: unknown, now: Date): boolean {
  if (typeof sentAt !== 'string' || !sentAt) return false
  const sent = Date.parse(sentAt)
  if (Number.isNaN(sent)) return false
  return now.getTime() - sent <= CONFIRMATION_TOKEN_LIFE_MS
}

function signingKey(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('signing key is not set')
  return new TextEncoder().encode(secret)
}

export async function signUnsubscribeToken({ id, platform }: { id: string; platform: NewsletterPlatform }): Promise<string> {
  if (!UUID.test(id)) throw new Error('unsubscribe token needs a row id')
  if (platform !== 'ab' && platform !== 'et') throw new Error('unsubscribe token needs a site code')
  return new SignJWT({ sid: id, p: platform, purpose: UNSUBSCRIBE_PURPOSE })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(signingKey())
}

// The row and site an unsubscribe token names, or null for any token that is
// not one of ours: bad signature, wrong purpose, a missing or malformed id or
// site code, or no signing key set.
export async function verifyUnsubscribeToken(
  token: unknown,
): Promise<{ id: string; platform: NewsletterPlatform } | null> {
  if (typeof token !== 'string' || !token) return null
  try {
    const { payload } = await jwtVerify(token, signingKey(), { algorithms: ['HS256'] })
    if (payload.purpose !== UNSUBSCRIBE_PURPOSE) return null
    if (typeof payload.sid !== 'string' || !UUID.test(payload.sid)) return null
    if (payload.p !== 'ab' && payload.p !== 'et') return null
    return { id: payload.sid, platform: payload.p }
  } catch {
    return null
  }
}

export async function unsubscribeUrl(id: string, platform: NewsletterPlatform): Promise<string> {
  const token = await signUnsubscribeToken({ id, platform })
  return `https://${newsletterDomain(platform)}/unsubscribe?token=${encodeURIComponent(token)}`
}

// For future newsletter sends only: no e-mail sent by the code today uses
// these. One-click unsubscribe headers (RFC 8058); the address is the API
// route, which accepts a POST with the form body List-Unsubscribe=One-Click.
export async function listUnsubscribeHeaders(
  id: string,
  platform: NewsletterPlatform,
): Promise<{ 'List-Unsubscribe': string; 'List-Unsubscribe-Post': string }> {
  const token = await signUnsubscribeToken({ id, platform })
  return {
    'List-Unsubscribe': `<https://${newsletterDomain(platform)}/api/unsubscribe?token=${encodeURIComponent(token)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
