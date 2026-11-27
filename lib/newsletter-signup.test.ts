import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: () => {}, captureMessage: () => {} }))

import { fakeTables, type FakeTables, type Row } from './test-helpers/fake-rest-tables'
import { getServerSupabase } from './supabase-server'
import { hashConfirmationToken } from './newsletter-tokens'
import { confirmationEmailHtml, newsletterBrand, startNewsletterSignup, type NewsletterMailer } from './newsletter-signup'

const DB_URL = 'https://example.supabase.co'
const NOW = new Date('2026-06-01T09:00:00Z')

type Sent = { from: string; to: string; subject: string; html: string }
let sent: Sent[] = []
let sendFails = false
const mailer: NewsletterMailer = {
  emails: {
    send: async (message) => {
      sent.push(message)
      return sendFails
        ? { data: null, error: { name: 'application_error', statusCode: null } }
        : { data: { id: 'email' }, error: null }
    },
  },
}

let db: FakeTables
let logs: string[] = []

function setup(rows: Row[] = []) {
  db = fakeTables(DB_URL, { email_subscribers: rows })
  vi.stubGlobal('fetch', vi.fn(db.fetch))
}

const run = (overrides: Partial<Parameters<typeof startNewsletterSignup>[0]> = {}) =>
  startNewsletterSignup({
    supabase: getServerSupabase('publicWrite'),
    resend: mailer,
    email: 'Ada@Example.com ',
    platform: 'ab',
    source: 'footer',
    now: NOW,
    ...overrides,
  })

const writes = () => db.requests.filter((r) => r.method !== 'GET')
const linkToken = (html: string) => /confirm-subscription\?token=([^"]+)"/.exec(html)?.[1] ?? ''

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  logs = []
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    logs.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
  })
  sent = []
  sendFails = false
  setup()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('newsletter sign-up', () => {
  it('a new address: sends first, then records a pending row with the token hash and where they signed up', async () => {
    expect(await run({ source: 'contact_form' })).toEqual({ kind: 'sent' })
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({
      from: 'Accounting Body <noreply@accountingbody.com>',
      to: 'Ada@Example.com ',
      subject: 'Confirm your subscription - Accounting Body',
    })
    const token = linkToken(sent[0].html)
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(db.tables.email_subscribers).toEqual([
      {
        email: 'ada@example.com',
        platform: 'ab',
        status: 'pending',
        last_confirmation_sent_at: '2026-06-01T09:00:00.000Z',
        confirmation_token: hashConfirmationToken(token),
        source: 'contact_form',
      },
    ])
    expect(db.tables.email_subscribers[0].confirmation_token).not.toBe(token)
    expect(logs).toEqual([])
  })

  it('uses the EthioTax brand and address for an EthioTax sign-up', async () => {
    await run({ platform: 'et' })
    expect(sent[0].from).toBe('EthioTax <noreply@accountingbody.com>')
    expect(sent[0].subject).toBe('Confirm your subscription - EthioTax')
    expect(sent[0].html).toContain('https://ethiotax.com/api/confirm-subscription?token=')
    expect(sent[0].html).toContain('<a href="https://ethiotax.com/unsubscribe">ethiotax.com/unsubscribe</a>.')
    expect(db.tables.email_subscribers[0]).toMatchObject({ platform: 'et', status: 'pending', source: 'footer' })
  })

  it('an already subscribed address: sends, stores only the new token hash, never changes the status', async () => {
    setup([{ id: 'r1', email: 'ada@example.com', platform: 'ab', status: 'subscribed', source: 'footer', last_confirmation_sent_at: null }])
    expect(await run({ source: 'contact_form' })).toEqual({ kind: 'sent' })
    expect(sent).toHaveLength(1)
    expect(writes().map((r) => [r.method, r.body])).toEqual([
      ['PATCH', { confirmation_token: hashConfirmationToken(linkToken(sent[0].html)) }],
    ])
    expect(db.tables.email_subscribers[0]).toMatchObject({ status: 'subscribed', source: 'footer', last_confirmation_sent_at: null })
  })

  it('a confirmation sent within the hour: already-sent, no send, no write', async () => {
    setup([{ email: 'ada@example.com', platform: 'ab', status: 'pending', last_confirmation_sent_at: '2026-06-01T08:30:00.000Z' }])
    expect(await run()).toEqual({ kind: 'already-sent' })
    expect(sent).toEqual([])
    expect(writes()).toEqual([])
  })

  it('an unsubscribed address signing up again must confirm again', async () => {
    setup([{ id: 'r1', email: 'ada@example.com', platform: 'ab', status: 'unsubscribed', last_confirmation_sent_at: '2026-01-01T00:00:00.000Z' }])
    expect(await run()).toEqual({ kind: 'sent' })
    expect(db.tables.email_subscribers[0]).toMatchObject({ status: 'pending', source: 'footer' })
  })

  it('a failed send records nothing', async () => {
    sendFails = true
    expect(await run()).toEqual({ kind: 'send-failed' })
    expect(writes()).toEqual([])
    expect(logs).toEqual(['email: send failed (subscribe confirmation) application_error'])
  })

  it('a failed lookup sends nothing and logs the code only', async () => {
    db.problem = (r) => (r.method === 'GET' ? 'fail' : undefined)
    expect(await run()).toEqual({ kind: 'server-error' })
    expect(sent).toEqual([])
    expect(writes()).toEqual([])
    expect(logs).toEqual(['newsletter signup: lookup failed 22P02'])
  })

  it('a failed pending write still counts as sent, and logs the code only', async () => {
    db.problem = (r) => (r.method === 'POST' ? 'fail' : undefined)
    expect(await run()).toEqual({ kind: 'sent' })
    expect(logs).toEqual(['newsletter signup: pending row not recorded (non-fatal) 22P02'])
  })

  it('no e-mail address appears in any link or log line', async () => {
    await run()
    const hrefs = Array.from(sent[0].html.matchAll(/href="([^"]+)"/g), (m) => m[1])
    expect(hrefs).toHaveLength(3)
    for (const href of hrefs) {
      expect(href.toLowerCase()).not.toContain('ada')
      expect(href).not.toContain('@')
      expect(href).not.toContain('%40')
    }
    for (const line of logs) expect(line).not.toContain('ada')
  })
})

describe('confirmation e-mail', () => {
  // The e-mail as it was before, with only its sentence changed.
  const before = (name: string, domain: string, color: string, url: string) =>
    "<!DOCTYPE html><html><body style=\"margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;\"><div style=\"max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;\"><div style=\"background:" + color + ";padding:32px 40px;\"><p style=\"color:#C9982A;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;\">" + name + "</p><h1 style=\"color:#fff;font-size:24px;margin:0;line-height:1.3;\">Confirm your subscription.</h1></div><div style=\"padding:32px 40px;\"><p style=\"color:#475569;font-size:15px;line-height:1.7;margin:0 0 28px;\">One last step - click below to confirm your subscription. No spam. Unsubscribe any time.</p><a href=\"" + url + "\" style=\"display:inline-block;background:#C9982A;color:#0a0f2e;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;\">Confirm subscription</a><p style=\"color:#94a3b8;font-size:13px;margin-top:32px;\">This link expires in 7 days. If you did not sign up, ignore this email.</p></div><div style=\"background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;\"><p style=\"color:#94a3b8;font-size:12px;margin:0;\">" + name + " - Expert accounting and finance services. <a href=\"https://" + domain + "\" style=\"color:#94a3b8;\">" + domain + "</a></p></div></div></body></html>"

  it.each([
    ['ab', 'Accounting Body', 'accountingbody.com', '#0C1A3D'],
    ['et', 'EthioTax', 'ethiotax.com', '#1A4731'],
  ] as const)('%s: is byte-identical apart from the new sentence', (platform, name, domain, color) => {
    const url = 'https://' + domain + '/api/confirm-subscription?token=x'
    const expected = before(name, domain, color, url).replace(
      'Unsubscribe any time.',
      'You can unsubscribe at any time at <a href="https://' + domain + '/unsubscribe">' + domain + '/unsubscribe</a>.',
    )
    expect(confirmationEmailHtml(newsletterBrand(platform), url)).toBe(expected)
    expect(confirmationEmailHtml(newsletterBrand(platform), url)).not.toContain('Unsubscribe any time.')
  })
})
