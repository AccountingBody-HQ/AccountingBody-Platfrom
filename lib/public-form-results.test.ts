import { SignJWT } from 'jose'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CONFIRMATION_EMAIL_FAILED_TEXT, SERVER_PROBLEM_TEXT, messageTooShortText } from './message-rules'

// What visitors see from the public form routes when saving or sending an
// email fails. A real supabase-js client comes from the factory; only the
// network is fake. The database is a small in-memory store reached through
// the global `fetch`, and every request to it is logged. Emails are recorded
// instead of sent, and the recorder can be told to report a failed send the
// way the email provider does (a result with `error`, not a throw).

type Mail = { from: unknown; to: unknown; subject: unknown; replyTo: unknown }

const mail = vi.hoisted(() => ({
  sent: [] as Mail[],
  fail: (() => false) as (message: Mail) => boolean,
}))

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (message: Mail) => {
        mail.sent.push({ from: message.from, to: message.to, subject: message.subject, replyTo: message.replyTo })
        if (mail.fail(message)) {
          return {
            data: null,
            error: { name: 'application_error', statusCode: null, message: 'provider detail for ada@example.com' },
            headers: null,
          }
        }
        return { data: { id: 'email' }, error: null, headers: {} }
      },
    }
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: () => {}, captureMessage: () => {} }))

import { GET as confirmSubscription } from '@/app/api/confirm-subscription/route'
import { POST as contact } from '@/app/api/contact/route'
import { POST as firmsApplication } from '@/app/api/firms-application/route'
import { POST as helpRequest } from '@/app/api/help-request/route'
import { POST as jobSeekerApply } from '@/app/api/recruitment/job-seeker-apply/route'
import { POST as subscribe } from '@/app/api/subscribe/route'

const DB_URL = 'https://example.supabase.co'
const SITE = 'https://accountingbody.com'
const JWT_TEST_VALUE = 'jwt-test-value-0123456789abcdef'
const RAW_DB_TEXT = 'raw database detail'

type Row = Record<string, unknown>
type DbRequest = { method: string; table: string; query: string; prefer: string; body: unknown }
type Rule = { method?: string; table?: string; answer: 'error' }

const db = {
  tables: {} as Record<string, Row[]>,
  requests: [] as DbRequest[],
  rules: [] as Rule[],
}
let turnstileRequests = 0

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

// Supports what these routes send: eq filters on select and delete, insert
// and upsert (merged on the given columns).
function eqFilters(params: URLSearchParams): [string, string][] {
  const filters: [string, string][] = []
  params.forEach((value, key) => {
    if (value.startsWith('eq.')) filters.push([key, value.slice(3)])
  })
  return filters
}
const matches = (row: Row, filters: [string, string][]) => filters.every(([key, value]) => String(row[key]) === value)

const fakeFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.origin === 'https://challenges.cloudflare.com') {
    turnstileRequests += 1
    return json({ success: true })
  }
  if (url.origin !== DB_URL) throw new Error(`unexpected request to ${url.href}`)

  const method = (init?.method ?? 'GET').toUpperCase()
  const table = url.pathname.replace('/rest/v1/', '')
  const headers = new Headers(init?.headers)
  const prefer = headers.get('prefer') ?? ''
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
  db.requests.push({ method, table, query: url.search, prefer, body })

  const rule = db.rules.find((r) => (!r.method || r.method === method) && (!r.table || r.table === table))
  if (rule?.answer === 'error') {
    return json({ message: RAW_DB_TEXT, code: 'XX000', details: null, hint: null }, 500)
  }

  const rows = (db.tables[table] ??= [])
  const filters = eqFilters(url.searchParams)
  if (method === 'GET') {
    const found = rows.filter((row) => matches(row, filters))
    if (!(headers.get('accept') ?? '').includes('vnd.pgrst.object')) return json(found)
    if (found.length === 1) return json(found[0])
    return json({ message: 'no single row', code: 'PGRST116', details: null, hint: null }, 406)
  }
  if (method === 'POST') {
    const incoming: Row[] = Array.isArray(body) ? body : [body]
    const onConflict = url.searchParams.get('on_conflict')?.split(',') ?? null
    for (const row of incoming) {
      const existing = onConflict ? rows.find((r) => onConflict.every((key) => r[key] === row[key])) : undefined
      if (existing) Object.assign(existing, row)
      else rows.push({ ...row })
    }
    return new Response(null, { status: 201 })
  }
  if (method === 'DELETE') {
    const removed = rows.filter((row) => matches(row, filters))
    db.tables[table] = rows.filter((row) => !matches(row, filters))
    return new Response(null, { status: 204, headers: { 'content-range': `*/${removed.length}` } })
  }
  throw new Error(`unexpected ${method} to ${table}`)
}

const post = (path: string, body: unknown) =>
  new NextRequest(SITE + path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
  })

async function read(response: Response) {
  const text = await response.text()
  return {
    status: response.status,
    location: response.headers.get('location'),
    body: text && (response.headers.get('content-type') ?? '').includes('json') ? JSON.parse(text) : text,
  }
}

let logs: string[] = []
const logged = (...args: unknown[]) => {
  logs.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-06-01T09:00:00Z'))
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-key')
  vi.stubEnv('TURNSTILE_SECRET_KEY_AB', 'test-key')
  vi.stubEnv('JWT_SECRET', JWT_TEST_VALUE)
  vi.spyOn(console, 'error').mockImplementation(logged)
  vi.spyOn(console, 'warn').mockImplementation(logged)
  logs = []
  mail.sent.length = 0
  mail.fail = () => false
  db.tables = {}
  db.requests = []
  db.rules = []
  turnstileRequests = 0
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const writes = () => db.requests.filter((r) => r.method !== 'GET')
const failSendsTo = (to: string) => (message: Mail) => message.to === to
const expectNothingRevealed = (body: unknown) => {
  expect(JSON.stringify(body)).not.toContain(RAW_DB_TEXT)
  expect(JSON.stringify(body)).not.toContain('provider detail')
}
// New log lines carry no visitor details and no provider or database text.
const expectQuietLogs = () => {
  for (const line of logs) {
    expect(line).not.toContain('ada@example.com')
    expect(line).not.toContain(RAW_DB_TEXT)
    expect(line).not.toContain('provider detail')
  }
}

const turnstile = { 'cf-turnstile-response': 'token' }
const contactForm = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  subject: 'Accounts',
  message: 'I would like some help with my annual accounts.',
  ...turnstile,
}
const firmsForm = {
  contact_name: 'Ada Lovelace',
  email: 'ada@example.com',
  practice_type: 'Accountancy practice',
  location: 'London',
  about: '[FIRM] A small practice serving local businesses.',
  ...turnstile,
}
const helpForm = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  service_type: 'Bookkeeping',
  message: 'I need help with my monthly bookkeeping.',
  ...turnstile,
}
const jobSeekerForm = {
  full_name: 'Ada Lovelace',
  email: 'Ada@Example.com ',
  location_city: 'London',
  professional_role: 'Accountant',
  qualification: 'ACCA',
  years_experience: '5',
  employment_status: 'employed',
  biography: 'Experienced management accountant.',
  ...turnstile,
}

describe('contact form', () => {
  it('saves the message and sends both emails as before', async () => {
    const result = await read(await contact(post('/api/contact', contactForm)))
    expect(result).toEqual({ status: 200, location: null, body: { success: true } })
    expect(writes().map((r) => `${r.method} ${r.table}`)).toEqual(['POST contact_submissions'])
    expect(mail.sent).toEqual([
      {
        from: 'Accounting Body <info@accountingbody.com>',
        to: 'info@accountingbody.com',
        subject: 'New Contact Submission — Accounts',
        replyTo: 'ada@example.com',
      },
      {
        from: 'Accounting Body <info@accountingbody.com>',
        to: 'ada@example.com',
        subject: 'We have received your message — Accounting Body',
        replyTo: undefined,
      },
    ])
    expect(logs).toEqual([])
  })

  it('tells the visitor when the message is too short, and saves and sends nothing', async () => {
    const result = await read(await contact(post('/api/contact', { ...contactForm, message: 'Help me please' })))
    expect(result.status).toBe(400)
    expect(result.body).toEqual({ error: messageTooShortText() })
    expect(result.body).toEqual({ error: 'Please write a little more so we can help (at least 20 characters).' })
    expect(db.requests).toEqual([])
    expect(mail.sent).toEqual([])
  })

  it('keeps its existing answer for filtered submissions', async () => {
    const filtered = [
      { ...contactForm, _h: 'x' },
      { ...contactForm, message: 'Helpme' },
      { ...contactForm, message: 'a'.repeat(40) },
      { ...contactForm, email: 'ada@mailinator.com' },
    ]
    for (const form of filtered) {
      const result = await read(await contact(post('/api/contact', form)))
      expect(result).toEqual({ status: 200, location: null, body: { success: true } })
    }
    expect(db.requests).toEqual([])
    expect(mail.sent).toEqual([])
  })

  it('shows a friendly message when the message cannot be saved, and sends nothing', async () => {
    db.rules = [{ table: 'contact_submissions', answer: 'error' }]
    const result = await read(await contact(post('/api/contact', contactForm)))
    expect(result).toEqual({ status: 500, location: null, body: { error: SERVER_PROBLEM_TEXT } })
    expectNothingRevealed(result.body)
    expect(mail.sent).toEqual([])
    expect(logs).toEqual(['contact: save failed XX000'])
  })

  it('shows a friendly message when a newsletter-only signup cannot be saved', async () => {
    db.rules = [{ table: 'email_subscribers', answer: 'error' }]
    const result = await read(
      await contact(post('/api/contact', { email: 'ada@example.com', subscribeOnly: true, ...turnstile })),
    )
    expect(result).toEqual({ status: 500, location: null, body: { error: SERVER_PROBLEM_TEXT } })
    expect(logs).toEqual(['contact: newsletter save failed XX000'])
  })

  it('still confirms a saved message when the team notification fails, and logs it', async () => {
    mail.fail = failSendsTo('info@accountingbody.com')
    const result = await read(await contact(post('/api/contact', contactForm)))
    expect(result).toEqual({ status: 200, location: null, body: { success: true } })
    expect(mail.sent).toHaveLength(2)
    expect(logs).toEqual(['email: send failed (contact team notification) application_error'])
    expectQuietLogs()
  })

  it('still confirms a saved message when the acknowledgement fails, and logs it', async () => {
    mail.fail = failSendsTo('ada@example.com')
    const result = await read(await contact(post('/api/contact', contactForm)))
    expect(result).toEqual({ status: 200, location: null, body: { success: true } })
    expect(logs).toEqual(['email: send failed (contact acknowledgement) application_error'])
    expectQuietLogs()
  })
})

describe('network application form', () => {
  it('saves the application and sends both emails as before', async () => {
    const result = await read(await firmsApplication(post('/api/firms-application', firmsForm)))
    expect(result).toEqual({ status: 200, location: null, body: { success: true } })
    expect(writes().map((r) => `${r.method} ${r.table}`)).toEqual(['POST firms_applications'])
    expect(mail.sent.map((m) => [m.to, m.subject])).toEqual([
      ['info@accountingbody.com', 'New Network Application — Firm: Ada Lovelace'],
      ['ada@example.com', 'We have received your application — Accounting Body'],
    ])
    expect(logs).toEqual([])
  })

  it('keeps its existing answer for filtered submissions', async () => {
    const result = await read(await firmsApplication(post('/api/firms-application', { ...firmsForm, _h: 'x' })))
    expect(result).toEqual({ status: 200, location: null, body: { success: true } })
    expect(db.requests).toEqual([])
    expect(mail.sent).toEqual([])
  })

  it('shows a friendly message when the application cannot be saved', async () => {
    db.rules = [{ answer: 'error' }]
    const result = await read(await firmsApplication(post('/api/firms-application', firmsForm)))
    expect(result).toEqual({ status: 500, location: null, body: { error: SERVER_PROBLEM_TEXT } })
    expectNothingRevealed(result.body)
    expect(mail.sent).toEqual([])
    expect(logs).toEqual(['firms application: save failed XX000'])
  })

  it('still confirms a saved application when either email fails, and logs each', async () => {
    mail.fail = () => true
    const result = await read(await firmsApplication(post('/api/firms-application', firmsForm)))
    expect(result).toEqual({ status: 200, location: null, body: { success: true } })
    expect(logs).toEqual([
      'email: send failed (firms application team notification) application_error',
      'email: send failed (firms application acknowledgement) application_error',
    ])
    expectQuietLogs()
  })
})

describe('help request form', () => {
  it('saves the request and sends both emails as before', async () => {
    const result = await read(await helpRequest(post('/api/help-request', helpForm)))
    expect(result).toEqual({ status: 200, location: null, body: { success: true } })
    expect(writes().map((r) => `${r.method} ${r.table}`)).toEqual(['POST help_requests'])
    expect(mail.sent.map((m) => [m.to, m.subject, m.replyTo])).toEqual([
      ['info@accountingbody.com', 'New Service Brief — Bookkeeping', 'ada@example.com'],
      ['ada@example.com', 'We have received your enquiry — Bookkeeping', undefined],
    ])
  })

  it('tells the visitor when the message is too short, and saves and sends nothing', async () => {
    const result = await read(await helpRequest(post('/api/help-request', { ...helpForm, message: 'Help me please' })))
    expect(result).toEqual({ status: 400, location: null, body: { error: messageTooShortText() } })
    expect(db.requests).toEqual([])
    expect(mail.sent).toEqual([])
  })

  it('keeps its existing answer for filtered submissions', async () => {
    const filtered = [
      { ...helpForm, _h: 'x' },
      { ...helpForm, message: 'Helpme' },
      { ...helpForm, message: 'a'.repeat(40) },
      { ...helpForm, email: 'ada@mailinator.com' },
    ]
    for (const form of filtered) {
      const result = await read(await helpRequest(post('/api/help-request', form)))
      expect(result).toEqual({ status: 200, location: null, body: { success: true } })
    }
    expect(db.requests).toEqual([])
    expect(mail.sent).toEqual([])
  })

  it('shows a friendly message when the request cannot be saved', async () => {
    db.rules = [{ answer: 'error' }]
    const result = await read(await helpRequest(post('/api/help-request', helpForm)))
    expect(result).toEqual({ status: 500, location: null, body: { error: SERVER_PROBLEM_TEXT } })
    expect(mail.sent).toEqual([])
    expect(logs).toEqual(['help request: save failed XX000'])
  })

  it('still confirms a saved request when either email fails, and logs each', async () => {
    mail.fail = () => true
    const result = await read(await helpRequest(post('/api/help-request', helpForm)))
    expect(result).toEqual({ status: 200, location: null, body: { success: true } })
    expect(logs).toEqual([
      'email: send failed (help request team notification) application_error',
      'email: send failed (help request acknowledgement) application_error',
    ])
    expectQuietLogs()
  })
})

describe('newsletter signup', () => {
  const signup = () => subscribe(post('/api/subscribe', { email: 'ada@example.com', ...turnstile }))

  it('sends the confirmation email and records the pending signup as before', async () => {
    const result = await read(await signup())
    expect(result).toEqual({ status: 200, location: null, body: { success: true } })
    expect(mail.sent.map((m) => [m.from, m.to, m.subject])).toEqual([
      ['Accounting Body <noreply@accountingbody.com>', 'ada@example.com', 'Confirm your subscription - Accounting Body'],
    ])
    expect(db.tables.email_subscribers).toEqual([
      { email: 'ada@example.com', platform: 'ab', status: 'pending', last_confirmation_sent_at: '2026-06-01T09:00:00.000Z' },
    ])
    expect(logs).toEqual([])
  })

  it('asks the visitor to try again when the confirmation email fails, and records nothing', async () => {
    mail.fail = () => true
    const result = await read(await signup())
    expect(result).toEqual({ status: 502, location: null, body: { error: CONFIRMATION_EMAIL_FAILED_TEXT } })
    expect(writes()).toEqual([])
    expect(db.tables.email_subscribers ?? []).toEqual([])
    expect(logs).toEqual(['email: send failed (subscribe confirmation) application_error'])
    expectQuietLogs()
  })

  it('lets the visitor try again straight away after a failed confirmation email', async () => {
    mail.fail = () => true
    await signup()
    mail.fail = () => false
    const result = await read(await signup())
    expect(result).toEqual({ status: 200, location: null, body: { success: true } })
    expect(mail.sent).toHaveLength(2)
  })

  it('shows a friendly message and sends nothing when the signup lookup fails', async () => {
    db.rules = [{ method: 'GET', table: 'email_subscribers', answer: 'error' }]
    const result = await read(await signup())
    expect(result).toEqual({ status: 500, location: null, body: { error: SERVER_PROBLEM_TEXT } })
    expectNothingRevealed(result.body)
    expect(mail.sent).toEqual([])
    expect(writes()).toEqual([])
  })

  it('keeps the recently-sent answer when a confirmation went out within the hour', async () => {
    db.tables.email_subscribers = [
      { email: 'ada@example.com', platform: 'ab', status: 'pending', last_confirmation_sent_at: '2026-06-01T08:30:00.000Z' },
    ]
    const result = await read(await signup())
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ success: true, alreadySent: true })
    expect(mail.sent).toEqual([])
    expect(writes()).toEqual([])
  })

  it('sends a confirmation to an existing subscriber without changing their row, as before', async () => {
    const row = { email: 'ada@example.com', platform: 'ab', status: 'subscribed', last_confirmation_sent_at: null }
    db.tables.email_subscribers = [{ ...row }]
    const result = await read(await signup())
    expect(result).toEqual({ status: 200, location: null, body: { success: true } })
    expect(mail.sent).toHaveLength(1)
    expect(writes()).toEqual([])
    expect(db.tables.email_subscribers).toEqual([row])
  })

  it('keeps its existing answer for filtered submissions', async () => {
    for (const form of [
      { email: 'ada@example.com', _h: 'x', ...turnstile },
      { email: 'ada@mailinator.com', ...turnstile },
    ]) {
      const result = await read(await subscribe(post('/api/subscribe', form)))
      expect(result).toEqual({ status: 200, location: null, body: { success: true } })
    }
    expect(db.requests).toEqual([])
    expect(mail.sent).toEqual([])
  })
})

describe('subscription confirmation link', () => {
  const link = async () => {
    const token = await new SignJWT({ email: 'ada@example.com', platform: 'ab' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .setIssuedAt()
      .sign(new TextEncoder().encode(JWT_TEST_VALUE))
    return confirmSubscription(new NextRequest(SITE + '/api/confirm-subscription?token=' + token))
  }

  it('confirms the subscription and notifies the team as before', async () => {
    db.tables.email_subscribers = [{ email: 'ada@example.com', platform: 'ab', status: 'pending' }]
    const result = await read(await link())
    expect(result.location).toBe(SITE + '/?confirmed=true')
    expect(mail.sent.map((m) => m.to)).toEqual(['info@accountingbody.com'])
    expect(logs).toEqual([])
  })

  it('still confirms the subscription when the team notification fails, and logs it', async () => {
    db.tables.email_subscribers = [{ email: 'ada@example.com', platform: 'ab', status: 'pending' }]
    mail.fail = () => true
    const result = await read(await link())
    expect(result).toEqual({ status: 307, location: SITE + '/?confirmed=true', body: '' })
    expect(db.tables.email_subscribers[0].status).toBe('subscribed')
    expect(logs).toEqual(['email: send failed (subscription team notification) application_error'])
  })
})

describe('job seeker registration form', () => {
  const register = (form: Row = jobSeekerForm) => jobSeekerApply(post('/api/recruitment/job-seeker-apply', form))

  it('saves the registration and sends the verification email as before', async () => {
    const result = await read(await register())
    expect(result).toEqual({ status: 200, location: null, body: { success: true } })
    expect(writes().map((r) => `${r.method} ${r.table}`)).toEqual(['POST job_seeker_registrations'])
    expect(db.tables.job_seeker_registrations).toHaveLength(1)
    expect(mail.sent.map((m) => [m.from, m.to, m.subject])).toEqual([
      ['Accounting Body <noreply@accountingbody.com>', 'Ada@Example.com', 'Verify your email address — Accounting Body'],
    ])
    expect(logs).toEqual([])
  })

  it('removes only the new registration and asks the visitor to try again when the verification email fails', async () => {
    const other = { email: 'ada@example.com', status: 'pending_verification', verification_token: 'earlier' }
    db.tables.job_seeker_registrations = [{ ...other }]
    mail.fail = () => true

    const result = await read(await register())

    expect(result).toEqual({ status: 500, location: null, body: { error: SERVER_PROBLEM_TEXT } })
    expect(db.tables.job_seeker_registrations).toEqual([other])
    const [insert, removal] = writes()
    expect(removal.method).toBe('DELETE')
    expect(removal.prefer).toContain('count=exact')
    const token = (insert.body as Row).verification_token as string
    const filters = new URLSearchParams(removal.query)
    expect(filters.get('verification_token')).toBe(`eq.${token}`)
    expect(filters.get('email')).toBe('eq.ada@example.com')
    expect(filters.get('status')).toBe('eq.pending_verification')
    expect(logs).toEqual(['email: send failed (job seeker verification) application_error'])
    expectQuietLogs()
  })

  it('still asks the visitor to try again when the new registration cannot be removed, and logs it', async () => {
    mail.fail = () => true
    db.rules = [{ method: 'DELETE', answer: 'error' }]
    const result = await read(await register())
    expect(result).toEqual({ status: 500, location: null, body: { error: SERVER_PROBLEM_TEXT } })
    expect(logs).toEqual([
      'email: send failed (job seeker verification) application_error',
      'job seeker apply: unsent registration not removed XX000',
    ])
    expectQuietLogs()
  })

  it('logs when no registration matched the removal', async () => {
    mail.fail = (message) => {
      db.tables.job_seeker_registrations = []
      return message.to !== undefined
    }
    const result = await read(await register())
    expect(result.status).toBe(500)
    expect(logs).toContain('job seeker apply: unsent registration not removed count 0')
  })

  it('keeps its existing answer for filtered submissions', async () => {
    const result = await read(await register({ ...jobSeekerForm, _h: 'x' }))
    expect(result).toEqual({ status: 400, location: null, body: { error: 'Invalid submission' } })
    expect(db.requests).toEqual([])
    expect(mail.sent).toEqual([])
  })
})

describe('bot check calls', () => {
  it('are made as before by the forms that use them', async () => {
    await contact(post('/api/contact', contactForm))
    await firmsApplication(post('/api/firms-application', firmsForm))
    await helpRequest(post('/api/help-request', helpForm))
    await subscribe(post('/api/subscribe', { email: 'ada@example.com', ...turnstile }))
    expect(turnstileRequests).toBe(4)
  })
})
