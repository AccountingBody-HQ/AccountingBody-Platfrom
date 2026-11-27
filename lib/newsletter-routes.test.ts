import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SignJWT } from 'jose'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// PRIV-1: every newsletter sign-up path uses the shared double opt-in, and the
// confirmation link keeps where the person signed up. Real supabase-js
// clients run against the shared in-memory tables; e-mails are recorded.

type Mail = { from: string; to: string; subject: string; html: string }
const mail = vi.hoisted(() => ({ sent: [] as Mail[], fail: (() => false) as (m: Mail) => boolean }))

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (message: Mail) => {
        mail.sent.push(message)
        return mail.fail(message)
          ? { data: null, error: { name: 'application_error', statusCode: null }, headers: null }
          : { data: { id: 'email' }, error: null, headers: {} }
      },
    }
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: () => {}, captureMessage: () => {} }))

import { GET as confirmSubscription } from '@/app/api/confirm-subscription/route'
import { POST as contact } from '@/app/api/contact/route'
import { POST as subscribe } from '@/app/api/subscribe/route'
import { fakeTables, type FakeTables, type Row } from './test-helpers/fake-rest-tables'
import { createConfirmationToken } from './newsletter-tokens'

const DB_URL = 'https://example.supabase.co'
const SITE = 'https://accountingbody.com'
const SECRET = 'jwt-test-value-0123456789abcdef'
const ID = '0f8fad5b-d9cb-469f-a165-70867728950e'
const NOW = new Date('2026-06-01T09:00:00Z')

let db: FakeTables
let logs: string[] = []

function setup(tables: Record<string, Row[]> = {}) {
  db = fakeTables(DB_URL, { email_subscribers: [], contact_submissions: [], ...tables })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.startsWith('https://challenges.cloudflare.com/')) {
        return new Response(JSON.stringify({ success: true }), { headers: { 'content-type': 'application/json' } })
      }
      return db.fetch(input, init)
    }),
  )
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(SITE + path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7', ...headers },
  })
const confirm = (token: string) => confirmSubscription(new NextRequest(SITE + '/api/confirm-subscription?token=' + encodeURIComponent(token)))

const turnstile = { 'cf-turnstile-response': 'token' }
const contactForm = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  subject: 'Accounts',
  message: 'I would like some help with my annual accounts.',
  ...turnstile,
}
const subscribers = () => db.tables.email_subscribers
const subscriberWrites = () => db.requests.filter((r) => r.table === 'email_subscribers' && r.method !== 'GET')
const confirmations = () => mail.sent.filter((m) => m.subject.startsWith('Confirm your subscription'))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-key')
  vi.stubEnv('TURNSTILE_SECRET_KEY_AB', 'test-key')
  vi.stubEnv('JWT_SECRET', SECRET)
  logs = []
  const logged = (...args: unknown[]) => logs.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
  vi.spyOn(console, 'error').mockImplementation(logged)
  vi.spyOn(console, 'warn').mockImplementation(logged)
  mail.sent.length = 0
  mail.fail = () => false
  setup()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('contact form newsletter box', () => {
  const source = readFileSync(join(process.cwd(), 'app/contact/ContactForm.tsx'), 'utf8')

  it('starts unticked, with its label unchanged', () => {
    const box = /<input id="subscribe"[^>]*>/.exec(source)?.[0] ?? ''
    expect(box).toContain('type="checkbox"')
    expect(box).not.toContain('defaultChecked')
    expect(box).not.toMatch(/\bchecked\b/)
    expect(source).toContain(
      'Also subscribe me to the free weekly email — exam tips and study guides written by qualified accountants.',
    )
  })

  it('shows the check-inbox line only when the answer says so', () => {
    expect(source).toContain("setNewsletterCheckInbox(json.newsletter === 'check-inbox')")
    expect(source).toMatch(/\{newsletterCheckInbox && \(\s*<p className="text-slate-500 text-sm max-w-sm leading-relaxed">\s*Check your inbox to confirm your newsletter sign-up\.\s*<\/p>/)
  })
})

describe('contact route newsletter part', () => {
  it('ticked: sends the confirmation through the shared sign-up, never writes subscribed', async () => {
    const result = await contact(post('/api/contact', { ...contactForm, subscribe: true }))
    expect(await result.json()).toEqual({ success: true, newsletter: 'check-inbox' })
    expect(subscribers()).toEqual([
      expect.objectContaining({ email: 'ada@example.com', platform: 'ab', status: 'pending', source: 'contact_form' }),
    ])
    expect(subscriberWrites().every((r) => JSON.stringify(r.body).includes('"status":"pending"'))).toBe(true)
    expect(JSON.stringify(db.requests)).not.toContain('"status":"subscribed"')
    expect(mail.sent.map((m) => m.subject)).toEqual([
      'Confirm your subscription - Accounting Body',
      'New Contact Submission — Accounts',
      'We have received your message — Accounting Body',
    ])
    expect(db.tables.contact_submissions).toHaveLength(1)
  })

  it('ticked on EthioTax: an EthioTax pending row and an EthioTax confirmation', async () => {
    const result = await contact(post('/api/contact', { ...contactForm, subscribe: true }, { 'x-et-platform': 'ethiotax' }))
    expect(await result.json()).toEqual({ success: true, newsletter: 'check-inbox' })
    expect(subscribers()[0]).toMatchObject({ platform: 'et', status: 'pending', source: 'contact_form' })
    expect(confirmations()[0].subject).toBe('Confirm your subscription - EthioTax')
    expect(confirmations()[0].html).toContain('https://ethiotax.com/api/confirm-subscription?token=')
  })

  it('ticked when a confirmation went out within the hour: check-inbox, no second confirmation', async () => {
    setup({ email_subscribers: [{ email: 'ada@example.com', platform: 'ab', status: 'pending', last_confirmation_sent_at: '2026-06-01T08:30:00.000Z' }] })
    const result = await contact(post('/api/contact', { ...contactForm, subscribe: true }))
    expect(await result.json()).toEqual({ success: true, newsletter: 'check-inbox' })
    expect(confirmations()).toEqual([])
    expect(subscriberWrites()).toEqual([])
  })

  it('not ticked: nothing newsletter-related happens and the answer is unchanged', async () => {
    const result = await contact(post('/api/contact', contactForm))
    expect(await result.json()).toEqual({ success: true })
    expect(db.requests.filter((r) => r.table === 'email_subscribers')).toEqual([])
    expect(confirmations()).toEqual([])
  })

  it('the message is saved and both e-mails go even when the newsletter lookup fails', async () => {
    db.problem = (r) => (r.table === 'email_subscribers' ? 'fail' : undefined)
    const result = await contact(post('/api/contact', { ...contactForm, subscribe: true }))
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ success: true })
    expect(db.tables.contact_submissions).toHaveLength(1)
    expect(mail.sent.map((m) => m.to)).toEqual(['info@accountingbody.com', 'ada@example.com'])
    expect(logs).toEqual(['newsletter signup: lookup failed 22P02'])
  })

  it('the message is saved and both e-mails go even when the newsletter lookup throws', async () => {
    db.problem = (r) => (r.table === 'email_subscribers' ? 'throw' : undefined)
    const result = await contact(post('/api/contact', { ...contactForm, subscribe: true }))
    expect(await result.json()).toEqual({ success: true })
    expect(db.tables.contact_submissions).toHaveLength(1)
    expect(mail.sent.map((m) => m.to)).toEqual(['info@accountingbody.com', 'ada@example.com'])
    for (const line of logs) expect(line).not.toContain('ada@')
  })

  it('the message is saved when the confirmation e-mail fails, with no check-inbox line', async () => {
    mail.fail = (m) => m.subject.startsWith('Confirm your subscription')
    const result = await contact(post('/api/contact', { ...contactForm, subscribe: true }))
    expect(await result.json()).toEqual({ success: true })
    expect(subscribers()).toEqual([])
    expect(db.tables.contact_submissions).toHaveLength(1)
  })

  it('newsletter-only request: the shared sign-up, with source contact_form', async () => {
    const result = await contact(post('/api/contact', { email: 'ada@example.com', subscribeOnly: true, ...turnstile }))
    expect(await result.json()).toEqual({ success: true })
    expect(subscribers()).toEqual([expect.objectContaining({ status: 'pending', source: 'contact_form' })])
    expect(confirmations()).toHaveLength(1)
  })

  it('newsletter-only request: a failed send keeps the existing error answer', async () => {
    mail.fail = () => true
    const result = await contact(post('/api/contact', { email: 'ada@example.com', subscribeOnly: true, ...turnstile }))
    expect(result.status).toBe(500)
    expect(subscribers()).toEqual([])
  })
})

describe('newsletter forms', () => {
  it('record source footer and a link with a random token', async () => {
    await subscribe(post('/api/subscribe', { email: 'ada@example.com', ...turnstile }))
    expect(subscribers()[0]).toMatchObject({ status: 'pending', source: 'footer' })
    const link = /href="(https:\/\/accountingbody\.com\/api\/confirm-subscription\?token=[^"]+)"/.exec(confirmations()[0].html)?.[1] ?? ''
    expect(new URL(link).searchParams.get('token')).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(link).not.toContain('ada')
  })
})

describe('confirmation link', () => {
  const pending = (fields: Row = {}) => {
    const { token, hash } = createConfirmationToken()
    setup({
      email_subscribers: [
        {
          id: ID,
          email: 'ada@example.com',
          platform: 'ab',
          status: 'pending',
          source: 'contact_form',
          confirmation_token: hash,
          last_confirmation_sent_at: '2026-05-30T09:00:00.000Z',
          subscribed_at: null,
          unsubscribed_at: null,
          ...fields,
        },
      ],
    })
    return token
  }

  it('a new token confirms the row and keeps where they signed up', async () => {
    const token = pending()
    const result = await confirm(token)
    expect(result.headers.get('location')).toBe(SITE + '/?confirmed=true')
    expect(subscribers()[0]).toMatchObject({
      status: 'subscribed',
      source: 'contact_form',
      subscribed_at: '2026-06-01T09:00:00.000Z',
      unsubscribed_at: null,
      confirmation_token: null,
    })
    expect(mail.sent.map((m) => m.to)).toEqual(['info@accountingbody.com'])
    expect(subscriberWrites().map((r) => r.method)).toEqual(['PATCH'])
    expect(logs).toEqual([])
  })

  it('records footer only when no source was recorded', async () => {
    const token = pending({ source: null })
    await confirm(token)
    expect(subscribers()[0]).toMatchObject({ status: 'subscribed', source: 'footer' })
  })

  it('clears unsubscribed_at for someone who signed up again', async () => {
    const token = pending({ unsubscribed_at: '2026-04-01T00:00:00.000Z' })
    await confirm(token)
    expect(subscribers()[0]).toMatchObject({ status: 'subscribed', unsubscribed_at: null })
  })

  it('an EthioTax row confirms on ethiotax.com', async () => {
    const token = pending({ platform: 'et' })
    const result = await confirm(token)
    expect(result.headers.get('location')).toBe('https://ethiotax.com/?confirmed=true')
    expect(mail.sent[0].from).toBe('EthioTax <noreply@accountingbody.com>')
  })

  it('a wrong token is invalid and changes nothing', async () => {
    pending()
    const result = await confirm(createConfirmationToken().token)
    expect(result.headers.get('location')).toBe(SITE + '/?confirmed=invalid')
    expect(subscriberWrites()).toEqual([])
    expect(subscribers()[0].status).toBe('pending')
  })

  it('a token sent more than 7 days ago is invalid and changes nothing', async () => {
    const token = pending({ last_confirmation_sent_at: '2026-05-25T08:59:00.000Z' })
    const result = await confirm(token)
    expect(result.headers.get('location')).toBe(SITE + '/?confirmed=invalid')
    expect(subscriberWrites()).toEqual([])
  })

  it('an already subscribed row answers already', async () => {
    const token = pending({ status: 'subscribed' })
    const result = await confirm(token)
    expect(result.headers.get('location')).toBe(SITE + '/?confirmed=already')
    expect(subscriberWrites()).toEqual([])
  })

  it('a failed lookup answers error and logs the code only', async () => {
    const token = pending()
    db.problem = () => 'fail'
    const result = await confirm(token)
    expect(result.headers.get('location')).toBe(SITE + '/?confirmed=error')
    expect(logs).toEqual(['confirm subscription: lookup failed 22P02'])
  })

  it('a failed save answers error and logs the code only', async () => {
    const token = pending()
    db.problem = (r) => (r.method === 'PATCH' ? 'fail' : undefined)
    const result = await confirm(token)
    expect(result.headers.get('location')).toBe(SITE + '/?confirmed=error')
    expect(logs).toEqual(['confirm subscription: save failed 22P02'])
    expect(mail.sent).toEqual([])
  })

  const legacy = (payload: Record<string, unknown>, expiry: string | Date = '7d') =>
    new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setExpirationTime(expiry).setIssuedAt().sign(new TextEncoder().encode(SECRET))

  it('a legacy signed link still confirms the existing row, keeping its source', async () => {
    pending({ confirmation_token: null })
    const result = await confirm(await legacy({ email: 'ada@example.com', platform: 'ab' }))
    expect(result.headers.get('location')).toBe(SITE + '/?confirmed=true')
    expect(subscribers()[0]).toMatchObject({ status: 'subscribed', source: 'contact_form' })
  })

  it('a legacy signed link never creates a row', async () => {
    const result = await confirm(await legacy({ email: 'nobody@example.com', platform: 'ab' }))
    expect(result.headers.get('location')).toBe(SITE + '/?confirmed=invalid')
    expect(subscriberWrites()).toEqual([])
  })

  it('an expired legacy link or an unsubscribe token is invalid', async () => {
    pending()
    for (const token of [
      await legacy({ email: 'ada@example.com', platform: 'ab' }, new Date('2026-05-31T00:00:00Z')),
      await new SignJWT({ sid: ID, p: 'ab', purpose: 'unsubscribe' }).setProtectedHeader({ alg: 'HS256' }).sign(new TextEncoder().encode(SECRET)),
      'not-a-real-token',
    ]) {
      expect((await confirm(token)).headers.get('location')).toBe(SITE + '/?confirmed=invalid')
    }
    expect(subscriberWrites()).toEqual([])
  })
})
