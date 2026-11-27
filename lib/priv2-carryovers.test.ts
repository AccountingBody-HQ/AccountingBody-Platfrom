import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// PRIV-2 S3 (D338): the PRIV-1 carry-overs.
// (1) An address is found in any letter case and that row is updated by id;
//     % and _ never act as wildcards.
// (2) Each newsletter form records where the person signed up.
// (3) Error logs carry a code only, never the whole error object.

type Mail = { from: string; to: string; subject: string; html: string }
const mail = vi.hoisted(() => ({ sent: [] as Mail[] }))

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (message: Mail) => {
        mail.sent.push(message)
        return { data: { id: 'email' }, error: null, headers: {} }
      },
    }
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: () => {}, captureMessage: () => {} }))

import { POST as contact } from '@/app/api/contact/route'
import { POST as subscribe } from '@/app/api/subscribe/route'
import { GET as prunePending } from '@/app/api/cron/prune-pending-subscribers/route'
import { GET as opsStatus } from '@/app/api/ops-status/route'
import { opsStatusHold } from './ops-status'
import { fakeTables, type FakeTables, type Row } from './test-helpers/fake-rest-tables'
import { getServerSupabase } from './supabase-server'
import {
  NEWSLETTER_FORM_SOURCES,
  findSubscriber,
  newsletterFormSource,
  pickSubscriberRow,
  startNewsletterSignup,
  type NewsletterMailer,
  type SubscriberRow,
} from './newsletter-signup'
import { clearUnsubscribeLimits, requestUnsubscribeLink } from './newsletter-unsubscribe'

const DB_URL = 'https://example.supabase.co'
const SITE = 'https://accountingbody.com'
const NOW = new Date('2026-06-01T09:00:00Z')
const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')

let db: FakeTables
let logs: string[] = []
let rawLogs: unknown[][] = []

function setup(rows: Row[] = []) {
  db = fakeTables(DB_URL, { email_subscribers: rows, contact_submissions: [] })
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

const recorder: NewsletterMailer = {
  emails: {
    send: async (message) => {
      mail.sent.push(message)
      return { data: { id: 'email' }, error: null }
    },
  },
}

const post = (path: string, body: unknown) =>
  new NextRequest(SITE + path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
  })
const turnstile = { 'cf-turnstile-response': 'token' }
const writes = () => db.requests.filter((r) => r.table === 'email_subscribers' && r.method !== 'GET')
const lookups = () => db.requests.filter((r) => r.table === 'email_subscribers' && r.method === 'GET')

const stored = (fields: Row = {}): Row => ({
  id: 'r-mixed',
  email: 'Name@Example.com',
  platform: 'ab',
  status: 'unsubscribed',
  source: 'footer',
  created_at: '2026-01-01T00:00:00.000Z',
  last_confirmation_sent_at: '2026-01-01T00:00:00.000Z',
  ...fields,
})

const signup = (email: string) =>
  startNewsletterSignup({ supabase: getServerSupabase('publicWrite'), resend: recorder, email, platform: 'ab', source: 'footer', now: NOW })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-key')
  vi.stubEnv('TURNSTILE_SECRET_KEY_AB', 'test-key')
  vi.stubEnv('JWT_SECRET', 'jwt-test-value-0123456789abcdef')
  logs = []
  rawLogs = []
  const logged = (...args: unknown[]) => {
    rawLogs.push(args)
    logs.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
  }
  vi.spyOn(console, 'error').mockImplementation(logged)
  vi.spyOn(console, 'warn').mockImplementation(logged)
  mail.sent.length = 0
  clearUnsubscribeLimits()
  setup()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('(1) any letter case finds the same row', () => {
  it('a stored mixed-case row is updated by id when a lower-case address signs up; no insert', async () => {
    setup([stored()])
    expect(await signup('name@example.com')).toEqual({ kind: 'sent' })
    expect(writes().map((r) => r.method)).toEqual(['PATCH'])
    expect(writes()[0].params).toContainEqual(['id', 'eq.r-mixed'])
    expect(db.tables.email_subscribers).toHaveLength(1)
    expect(db.tables.email_subscribers[0]).toMatchObject({ id: 'r-mixed', email: 'Name@Example.com', status: 'pending', source: 'footer' })
  })

  it('a stored mixed-case subscribed row gets only the new token, by id, never a second row', async () => {
    setup([stored({ status: 'subscribed' })])
    expect(await signup(' NAME@example.COM ')).toEqual({ kind: 'sent' })
    expect(writes().map((r) => [r.method, Object.keys(r.body as object)])).toEqual([['PATCH', ['confirmation_token']]])
    expect(writes()[0].params).toEqual(expect.arrayContaining([['id', 'eq.r-mixed'], ['status', 'eq.subscribed']]))
    expect(db.tables.email_subscribers).toEqual([expect.objectContaining({ id: 'r-mixed', status: 'subscribed' })])
  })

  it('the look-up is ilike with the address escaped, and selects id', async () => {
    await signup('a_b%c@example.com')
    const params = lookups()[0].params
    expect(params).toContainEqual(['email', 'ilike.a\\_b\\%c@example.com'])
    expect(params.find(([k]) => k === 'select')?.[1]).toMatch(/^id,/)
  })

  it('% and _ in an address never act as wildcards', async () => {
    setup([stored({ id: 'r-other', email: 'axb@example.com', status: 'subscribed' })])
    expect(await signup('a_b@example.com')).toEqual({ kind: 'sent' })
    expect(writes().map((r) => r.method)).toEqual(['POST'])
    expect(db.tables.email_subscribers.find((r) => r.id === 'r-other')).toMatchObject({ email: 'axb@example.com', status: 'subscribed' })
    setup([stored({ id: 'r-other', email: 'abcd@example.com', status: 'subscribed' })])
    expect(await signup('ab%@example.com')).toEqual({ kind: 'sent' })
    expect(writes().map((r) => r.method)).toEqual(['POST'])
  })

  it('an address with * is looked up exactly (PostgREST cannot escape it)', async () => {
    setup([stored({ id: 'r-other', email: 'anything@example.com', status: 'subscribed' })])
    await signup('*@example.com')
    expect(lookups()[0].params).toContainEqual(['email', 'eq.*@example.com'])
    expect(writes().map((r) => r.method)).toEqual(['POST'])
  })

  it('two rows in different letter cases: the subscribed one is used, and no third row is made', async () => {
    setup([
      stored({ id: 'r-new', email: 'name@example.com', status: 'unsubscribed', created_at: '2026-05-01T00:00:00.000Z' }),
      stored({ id: 'r-sub', email: 'NAME@example.com', status: 'subscribed', created_at: '2026-02-01T00:00:00.000Z' }),
    ])
    await signup('Name@Example.com')
    expect(writes()).toHaveLength(1)
    expect(writes()[0].params).toContainEqual(['id', 'eq.r-sub'])
    expect(db.tables.email_subscribers).toHaveLength(2)
  })

  it('pickSubscriberRow: subscribed first, otherwise the newest, none → null', () => {
    const r = (id: string, status: string | null, created_at: string | null) => ({ id, status, created_at }) as SubscriberRow
    expect(pickSubscriberRow([])).toBeNull()
    expect(pickSubscriberRow([r('a', 'pending', '2026-05-01'), r('b', 'subscribed', '2026-01-01')])?.id).toBe('b')
    expect(pickSubscriberRow([r('a', 'pending', '2026-01-01'), r('b', 'unsubscribed', '2026-05-01')])?.id).toBe('b')
    expect(pickSubscriberRow([r('a', 'pending', null), r('b', 'pending', '2026-05-01')])?.id).toBe('b')
  })

  it('findSubscriber keeps only rows equal to the address in lower case', async () => {
    setup([stored({ id: 'x', email: 'name@example.com.evil' }), stored({ id: 'y', email: 'NAME@EXAMPLE.COM' })])
    const { row, error } = await findSubscriber(getServerSupabase('publicWrite'), 'name@example.com', 'ab')
    expect(error).toBeNull()
    expect(row?.id).toBe('y')
  })

  it('the unsubscribe form without a link finds a stored mixed-case row and sends one e-mail', async () => {
    setup([stored({ id: '0f8fad5b-d9cb-469f-a165-70867728950e', status: 'subscribed' })])
    await requestUnsubscribeLink({ supabase: getServerSupabase('publicWrite'), resend: recorder, email: 'name@example.com', platform: 'ab', ip: '203.0.113.7', now: NOW.getTime() })
    expect(mail.sent).toHaveLength(1)
    expect(mail.sent[0].subject).toBe('Your unsubscribe link - Accounting Body')
    expect(lookups()[0].params).toEqual(expect.arrayContaining([['email', 'ilike.name@example.com'], ['status', 'in.(subscribed,pending)']]))
  })

  it('the unsubscribe form: % and _ never match another address', async () => {
    setup([stored({ email: 'axb@example.com', status: 'subscribed' })])
    await requestUnsubscribeLink({ supabase: getServerSupabase('publicWrite'), resend: recorder, email: 'a_b@example.com', platform: 'ab', ip: '203.0.113.8', now: NOW.getTime() })
    expect(mail.sent).toEqual([])
  })
})

describe('(2) where the person signed up', () => {
  it('the allow-list is footer, home and contact_page; anything else or missing is footer', () => {
    expect(NEWSLETTER_FORM_SOURCES).toEqual(['footer', 'home', 'contact_page'])
    for (const s of ['footer', 'home', 'contact_page']) expect(newsletterFormSource(s)).toBe(s)
    for (const s of [undefined, null, '', 'contact_form', 'HOME', ' home', 'admin', 42, {}]) expect(newsletterFormSource(s)).toBe('footer')
  })

  for (const [source, want] of [['home', 'home'], ['contact_page', 'contact_page'], ['footer', 'footer'], ['nonsense', 'footer'], [undefined, 'footer']] as const) {
    it(`/api/subscribe with source ${String(source)} records ${want}`, async () => {
      await subscribe(post('/api/subscribe', { email: 'ada@example.com', ...turnstile, ...(source === undefined ? {} : { source }) }))
      expect(db.tables.email_subscribers).toEqual([expect.objectContaining({ status: 'pending', source: want })])
    })
  }

  it('each form sends its own value', () => {
    expect(read('components/layout/Footer.tsx')).toContain("JSON.stringify({ email, _h: honeypot, 'cf-turnstile-response': turnstileToken.current, source: 'footer' })")
    expect(read('components/EmailSignupForm.tsx')).toContain("JSON.stringify({ email, _h: honeypot, 'cf-turnstile-response': token, source: 'home' })")
    expect(read('app/contact/ContactForm.tsx')).toContain("JSON.stringify({ email, _h: '', 'cf-turnstile-response': token, source: 'contact_page' })")
  })

  it("the contact form's own tick box still records contact_form", async () => {
    await contact(post('/api/contact', { name: 'Ada', email: 'ada@example.com', subject: 'A', message: 'Hello there, a question.', subscribe: true, ...turnstile }))
    expect(db.tables.email_subscribers).toEqual([expect.objectContaining({ status: 'pending', source: 'contact_form' })])
  })
})

describe('(3) error logs carry a code only', () => {
  it('the pending clean-up logs a fatal error as a code, never the whole error', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-test-value')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    const res = await prunePending(new NextRequest(SITE + '/api/cron/prune-pending-subscribers', { headers: { authorization: 'Bearer cron-test-value' } }))
    expect(res.status).toBe(500)
    const line = rawLogs.find((args) => args[0] === 'cron/prune-pending-subscribers: fatal error')
    expect(line).toEqual(['cron/prune-pending-subscribers: fatal error', 'unknown'])
    for (const args of rawLogs) for (const a of args) expect(typeof a).toBe('string')
  })

  // S6: the pending clean-up's delete failure and the ops-status catch.
  it('the pending clean-up logs a failed delete as a code, not the database message', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-test-value')
    db.problem = (r) => (r.method === 'DELETE' ? 'fail' : undefined)
    const res = await prunePending(new NextRequest(SITE + '/api/cron/prune-pending-subscribers', { headers: { authorization: 'Bearer cron-test-value' } }))
    expect(res.status).toBe(500)
    expect(rawLogs).toContainEqual(['cron/prune-pending-subscribers: delete failed', '22P02'])
    expect(logs.join('\n')).not.toContain('seed problem text')
  })

  it('/api/ops-status logs a failed check as a code, never the whole error', async () => {
    opsStatusHold.clear()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    const res = await opsStatus()
    expect(res.status).toBe(503)
    expect(rawLogs).toContainEqual(['ops status check failed:', 'unknown'])
    for (const args of rawLogs) for (const a of args) expect(typeof a).toBe('string')
    opsStatusHold.clear()
  })

  it('a failed look-up logs the code only, never the address', async () => {
    db.problem = (r) => (r.method === 'GET' ? 'fail' : undefined)
    expect(await signup('Name@Example.com')).toEqual({ kind: 'server-error' })
    expect(logs).toEqual(['newsletter signup: lookup failed 22P02'])
  })
})
