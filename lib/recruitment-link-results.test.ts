import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CONFIRMATION_EMAIL_FAILED_TEXT, SERVER_PROBLEM_TEXT } from './message-rules'

// What visitors see from the hiring brief form and from the links in the
// recruitment emails (job-seeker verify, brief confirm and cancel) when a
// database step or an email fails. A real supabase-js client comes from the
// factory; only the network is fake. The database is a small in-memory store
// reached through the global `fetch`, and every request to it, and every
// email, is written to one timeline so their order can be checked. Emails are
// recorded instead of sent, and the recorder can be told to report a failed
// send the way the email provider does (a result with `error`, not a throw).

type Mail = { from: unknown; to: unknown; subject: unknown }

const mail = vi.hoisted(() => ({
  sent: [] as Mail[],
  timeline: [] as string[],
  fail: (() => false) as (message: Mail) => boolean,
}))

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (message: Mail) => {
        mail.sent.push({ from: message.from, to: message.to, subject: message.subject })
        mail.timeline.push(`email ${String(message.to)}`)
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

import { GET as confirmBrief } from '@/app/api/recruitment/confirm-brief/route'
import { POST as employerBrief } from '@/app/api/recruitment/employer-brief/route'
import { GET as verifyEmail } from '@/app/api/recruitment/verify-email/route'

const DB_URL = 'https://example.supabase.co'
const SITE = 'https://accountingbody.com'
const RAW_DB_TEXT = 'raw database detail'
const ID = '0f8fad5b-d9cb-469f-a165-70867728950e'

type Row = Record<string, unknown>
type DbRequest = { method: string; table: string; query: string; prefer: string; body: unknown }
type Rule = { method?: string; table?: string; answer: 'error' | 'never' }

const db = {
  tables: {} as Record<string, Row[]>,
  requests: [] as DbRequest[],
  rules: [] as Rule[],
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function eqFilters(params: URLSearchParams): [string, string][] {
  const filters: [string, string][] = []
  params.forEach((value, key) => {
    if (value.startsWith('eq.')) filters.push([key, value.slice(3)])
  })
  return filters
}
const matches = (row: Row, filters: [string, string][]) => filters.every(([key, value]) => String(row[key]) === value)

// Supports what these routes send: eq filters on select, update and delete,
// and insert.
const fakeFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.origin === 'https://challenges.cloudflare.com') return json({ success: true })
  if (url.origin !== DB_URL) throw new Error(`unexpected request to ${url.href}`)

  const method = (init?.method ?? 'GET').toUpperCase()
  const table = url.pathname.replace('/rest/v1/', '')
  const headers = new Headers(init?.headers)
  const prefer = headers.get('prefer') ?? ''
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
  db.requests.push({ method, table, query: decodeURIComponent(url.search), prefer, body })
  mail.timeline.push(`db ${method} ${table}`)

  const rule = db.rules.find((r) => (!r.method || r.method === method) && (!r.table || r.table === table))
  if (rule?.answer === 'never') {
    // Never answers, but stops when its signal aborts (like Node's fetch).
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
    })
  }
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
    for (const row of incoming) rows.push({ ...row })
    return new Response(null, { status: 201 })
  }
  if (method === 'PATCH') {
    for (const row of rows) if (matches(row, filters)) Object.assign(row, body)
    return new Response(null, { status: 204 })
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
const get = (pathAndQuery: string) => new NextRequest(SITE + pathAndQuery)

// Captured before any test fakes the timers.
const realSetTimeout = globalThis.setTimeout

// Runs a route to its answer. Fake time jumps to the next pending timer only
// while the route is waiting, so a database that never answers is followed to
// the end of its time limit.
async function run(call: () => Promise<Response>) {
  let response: Response | undefined
  let failure: unknown
  let done = false
  call().then(
    (value) => {
      response = value
      done = true
    },
    (error: unknown) => {
      failure = error
      done = true
    },
  )
  let idle = 0
  while (!done) {
    await new Promise((resolve) => realSetTimeout(resolve, 1))
    if (done) break
    if (vi.getTimerCount() === 0) {
      if ((idle += 1) > 2000) throw new Error('route is not waiting on anything')
      continue
    }
    idle = 0
    await vi.advanceTimersToNextTimerAsync()
  }
  if (failure !== undefined || !response) throw failure
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
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(new Date('2026-06-01T09:00:00Z'))
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-key')
  vi.stubEnv('TURNSTILE_SECRET_KEY_AB', 'test-key')
  vi.spyOn(console, 'error').mockImplementation(logged)
  vi.spyOn(console, 'warn').mockImplementation(logged)
  logs = []
  mail.sent.length = 0
  mail.timeline.length = 0
  mail.fail = () => false
  db.tables = {}
  db.requests = []
  db.rules = []
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const writes = () => db.requests.filter((r) => r.method !== 'GET')
const failSendsTo = (to: string) => (message: Mail) => message.to === to
const failAllSends = () => true
const expectNothingRevealed = (body: unknown) => {
  expect(JSON.stringify(body)).not.toContain(RAW_DB_TEXT)
  expect(JSON.stringify(body)).not.toContain('provider detail')
}
const briefs = () => db.tables.employer_briefs ?? []

// ---------------------------------------------------------------------------
// Hiring brief form
// ---------------------------------------------------------------------------

const briefForm = {
  company_name: 'Example Ltd',
  contact_name: 'Ada Lovelace',
  contact_email: 'Ada@Example.com ',
  role_title: 'Accountant',
  contract_type: 'permanent',
  location: 'London',
  role_description: 'Prepare monthly management accounts.',
  'cf-turnstile-response': 'token',
}
const earlierBrief: Row = {
  id: 'earlier',
  platform: 'ab',
  contact_email: 'ada@example.com',
  status: 'pending_confirmation',
  confirmation_token: 'earlier-token',
}
const submitBrief = (form: Row = briefForm) => run(() => employerBrief(post('/api/recruitment/employer-brief', form)))
const newToken = () => (db.requests.find((r) => r.method === 'POST')?.body as Row).confirmation_token as string
const confirmationEmail = {
  from: 'Accounting Body <noreply@accountingbody.com>',
  to: 'Ada@Example.com',
  subject: 'Please confirm your hiring brief - Accounting Body',
}

describe('hiring brief form, new brief', () => {
  it('saves the brief and sends the confirmation email as before', async () => {
    const result = await submitBrief()
    expect(result).toEqual({ status: 200, location: null, body: { success: true } })
    expect(writes().map((r) => `${r.method} ${r.table}`)).toEqual(['POST employer_briefs'])
    expect(briefs()).toHaveLength(1)
    expect(briefs()[0]).toMatchObject({
      contact_email: 'ada@example.com',
      status: 'pending_confirmation',
      confirmation_token: newToken(),
    })
    expect(mail.sent).toEqual([confirmationEmail])
    expect(logs).toEqual([])
  })

  it('shows a friendly message and sends nothing when the brief cannot be saved', async () => {
    db.rules = [{ method: 'POST', table: 'employer_briefs', answer: 'error' }]
    const result = await submitBrief()
    expect(result).toEqual({ status: 500, location: null, body: { error: SERVER_PROBLEM_TEXT } })
    expectNothingRevealed(result.body)
    expect(mail.sent).toEqual([])
    expect(briefs()).toEqual([])
    expect(logs).toEqual(['employer brief: save failed XX000'])
  })

  it('shows a friendly message and sends nothing when saving does not answer', async () => {
    db.rules = [{ method: 'POST', table: 'employer_briefs', answer: 'never' }]
    const result = await submitBrief()
    expect(result).toEqual({ status: 500, location: null, body: { error: SERVER_PROBLEM_TEXT } })
    expectNothingRevealed(result.body)
    expect(mail.sent).toEqual([])
    expect(db.requests).toHaveLength(1)
  })

  it('asks the visitor to try again and removes only the new brief when its email is not sent', async () => {
    db.tables.employer_briefs = [{ ...earlierBrief }]
    mail.fail = failAllSends
    const result = await submitBrief()
    expect(result).toEqual({ status: 502, location: null, body: { error: CONFIRMATION_EMAIL_FAILED_TEXT } })
    expectNothingRevealed(result.body)
    const removal = writes()[1]
    expect(removal).toMatchObject({ method: 'DELETE', table: 'employer_briefs', prefer: 'count=exact' })
    expect(removal.query).toContain(`confirmation_token=eq.${newToken()}`)
    expect(removal.query).toContain('contact_email=eq.ada@example.com')
    expect(removal.query).toContain('status=eq.pending_confirmation')
    // The visitor's earlier brief, with its own token, is still there.
    expect(briefs()).toEqual([earlierBrief])
    expect(logs).toEqual(['email: send failed (hiring brief confirmation) application_error'])
  })

  it('still asks the visitor to try again when removing the unsent brief fails', async () => {
    mail.fail = failAllSends
    db.rules = [{ method: 'DELETE', table: 'employer_briefs', answer: 'error' }]
    const result = await submitBrief()
    expect(result).toEqual({ status: 502, location: null, body: { error: CONFIRMATION_EMAIL_FAILED_TEXT } })
    expect(logs).toEqual([
      'email: send failed (hiring brief confirmation) application_error',
      'employer brief: unsent brief not removed XX000',
    ])
  })

  it('keeps its existing answer for filtered submissions', async () => {
    const result = await submitBrief({ ...briefForm, _h: 'x' })
    expect(result).toEqual({ status: 400, location: null, body: { error: 'Invalid submission' } })
    expect(db.requests).toEqual([])
    expect(mail.sent).toEqual([])
  })
})

describe('hiring brief form, editing a brief', () => {
  const editForm = { ...briefForm, edit_token: 'earlier-token' }

  it('saves the new brief and sends its email before removing the earlier one', async () => {
    db.tables.employer_briefs = [{ ...earlierBrief }]
    const result = await submitBrief(editForm)
    expect(result).toEqual({ status: 200, location: null, body: { success: true } })
    expect(mail.timeline).toEqual(['db POST employer_briefs', 'email Ada@Example.com', 'db DELETE employer_briefs'])
    const removal = writes()[1]
    expect(removal.query).toBe('?confirmation_token=eq.earlier-token&status=eq.pending_confirmation')
    expect(removal.prefer).toBe('')
    expect(briefs()).toHaveLength(1)
    expect(briefs()[0].confirmation_token).toBe(newToken())
    expect(mail.sent).toEqual([confirmationEmail])
    expect(logs).toEqual([])
  })

  it('keeps the earlier brief and sends nothing when the new brief cannot be saved', async () => {
    db.tables.employer_briefs = [{ ...earlierBrief }]
    db.rules = [{ method: 'POST', table: 'employer_briefs', answer: 'error' }]
    const result = await submitBrief(editForm)
    expect(result).toEqual({ status: 500, location: null, body: { error: SERVER_PROBLEM_TEXT } })
    expect(writes().map((r) => r.method)).toEqual(['POST'])
    expect(briefs()).toEqual([earlierBrief])
    expect(mail.sent).toEqual([])
  })

  it('keeps the earlier brief and removes only the new one when its email is not sent', async () => {
    db.tables.employer_briefs = [{ ...earlierBrief }]
    mail.fail = failAllSends
    const result = await submitBrief(editForm)
    expect(result).toEqual({ status: 502, location: null, body: { error: CONFIRMATION_EMAIL_FAILED_TEXT } })
    expect(writes()).toHaveLength(2)
    expect(writes()[1].query).toContain(`confirmation_token=eq.${newToken()}`)
    expect(writes()[1].query).not.toContain('earlier-token')
    expect(briefs()).toEqual([earlierBrief])
  })

  it('still answers success when the earlier brief cannot be removed, because the new brief is safe', async () => {
    db.tables.employer_briefs = [{ ...earlierBrief }]
    db.rules = [{ method: 'DELETE', table: 'employer_briefs', answer: 'error' }]
    const result = await submitBrief(editForm)
    expect(result).toEqual({ status: 200, location: null, body: { success: true } })
    expect(briefs().map((b) => b.confirmation_token)).toEqual(['earlier-token', newToken()])
    expect(mail.sent).toEqual([confirmationEmail])
    expect(logs).toEqual(['employer brief: earlier brief not removed XX000'])
  })
})

// ---------------------------------------------------------------------------
// Job-seeker verify link
// ---------------------------------------------------------------------------

const registration: Row = {
  id: ID,
  platform: 'ab',
  full_name: 'Ada Lovelace',
  email: 'ada@example.com',
  professional_role: 'Accountant',
  status: 'pending_verification',
  verification_token: 'verify-token',
  role_types: ['Permanent'],
  jurisdictions: ['UK'],
  languages: ['English'],
  created_at: '2026-06-01T08:00:00Z',
}
const registrations = () => db.tables.job_seeker_registrations ?? []
const openVerifyLink = (token = 'verify-token') =>
  run(() => verifyEmail(get('/api/recruitment/verify-email?token=' + token)))
const verified = (value: string) => SITE + '/jobs/find-work?verified=' + value

describe('job-seeker verify link', () => {
  beforeEach(() => {
    db.tables.job_seeker_registrations = [{ ...registration }]
  })

  it('verifies the registration and sends both emails as before', async () => {
    const result = await openVerifyLink()
    expect(result).toMatchObject({ status: 307, location: verified('true') })
    expect(writes()).toHaveLength(1)
    expect(writes()[0]).toMatchObject({
      method: 'PATCH',
      table: 'job_seeker_registrations',
      body: { status: 'pending_review', verified_at: '2026-06-01T09:00:00.000Z', verification_token: null },
    })
    expect(registrations()[0].status).toBe('pending_review')
    expect(mail.sent.map((m) => m.to)).toEqual(['ada@example.com', 'info@accountingbody.com'])
    expect(logs).toEqual([])
  })

  it('keeps the invalid-link answer for an unknown or missing token', async () => {
    expect(await openVerifyLink('unknown')).toMatchObject({ status: 307, location: verified('invalid') })
    expect(await run(() => verifyEmail(get('/api/recruitment/verify-email')))).toMatchObject({
      status: 307,
      location: verified('invalid'),
    })
    expect(writes()).toEqual([])
    expect(mail.sent).toEqual([])
  })

  it('keeps the already-verified answer', async () => {
    db.tables.job_seeker_registrations = [{ ...registration, status: 'pending_review' }]
    expect(await openVerifyLink()).toMatchObject({ status: 307, location: verified('already') })
    expect(writes()).toEqual([])
    expect(mail.sent).toEqual([])
  })

  it('asks the visitor to try the link again and sends no email when verifying cannot be saved', async () => {
    db.rules = [{ method: 'PATCH', table: 'job_seeker_registrations', answer: 'error' }]
    const result = await openVerifyLink()
    expect(result).toMatchObject({ status: 307, location: verified('error') })
    expect(registrations()[0]).toMatchObject({ status: 'pending_verification', verification_token: 'verify-token' })
    expect(mail.sent).toEqual([])
    expect(logs).toEqual(['verify email: update failed XX000'])
  })

  it('asks the visitor to try the link again and sends no email when verifying does not answer', async () => {
    db.rules = [{ method: 'PATCH', table: 'job_seeker_registrations', answer: 'never' }]
    const result = await openVerifyLink()
    expect(result).toMatchObject({ status: 307, location: verified('error') })
    expect(mail.sent).toEqual([])
  })

  it('still shows success when an acknowledgement email is not sent', async () => {
    mail.fail = failAllSends
    const result = await openVerifyLink()
    expect(result).toMatchObject({ status: 307, location: verified('true') })
    expect(registrations()[0].status).toBe('pending_review')
    expect(mail.sent).toHaveLength(2)
    expect(logs).toEqual([
      'email: send failed (job seeker verified acknowledgement) application_error',
      'email: send failed (job seeker verified team notification) application_error',
    ])
  })
})

// ---------------------------------------------------------------------------
// Hiring brief confirm and cancel links
// ---------------------------------------------------------------------------

const pendingBrief: Row = {
  id: ID,
  platform: 'ab',
  company_name: 'Example Ltd',
  contact_name: 'Ada Lovelace',
  contact_email: 'ada@example.com',
  role_title: 'Accountant',
  status: 'pending_confirmation',
  confirmation_token: 'brief-token',
}
const openBriefLink = (action: string, token = 'brief-token') =>
  run(() => confirmBrief(get(`/api/recruitment/confirm-brief?token=${token}&action=${action}`)))
const briefState = (value: string, site = SITE) => site + '/jobs/hire-talent?brief=' + value

describe('hiring brief confirm and cancel links', () => {
  beforeEach(() => {
    db.tables.employer_briefs = [{ ...pendingBrief }]
  })

  it('confirms the brief and sends both emails as before', async () => {
    const result = await openBriefLink('confirm')
    expect(result).toMatchObject({ status: 307, location: briefState('confirmed') })
    expect(writes().map((r) => `${r.method} ${r.table}`)).toEqual(['PATCH employer_briefs'])
    expect(briefs()[0]).toMatchObject({ status: 'pending', confirmation_token: null })
    expect(mail.sent.map((m) => m.to)).toEqual(['ada@example.com', 'info@accountingbody.com'])
    expect(logs).toEqual([])
  })

  it('cancels the brief as before', async () => {
    const result = await openBriefLink('cancel')
    expect(result).toMatchObject({ status: 307, location: briefState('cancelled') })
    expect(writes().map((r) => `${r.method} ${r.table}`)).toEqual(['DELETE employer_briefs'])
    expect(briefs()).toEqual([])
    expect(mail.sent).toEqual([])
    expect(logs).toEqual([])
  })

  it.each(['confirm', 'cancel'])('keeps the invalid-link answer when no brief matches (%s)', async (action) => {
    expect(await openBriefLink(action, 'unknown')).toMatchObject({ status: 307, location: briefState('invalid') })
    expect(writes()).toEqual([])
    expect(mail.sent).toEqual([])
  })

  it('keeps the invalid-link answer for a missing token or action, and an unknown action', async () => {
    expect(await run(() => confirmBrief(get('/api/recruitment/confirm-brief?token=brief-token')))).toMatchObject({
      location: briefState('invalid'),
    })
    expect(await run(() => confirmBrief(get('/api/recruitment/confirm-brief?action=confirm')))).toMatchObject({
      location: briefState('invalid'),
    })
    expect(await openBriefLink('other')).toMatchObject({ location: briefState('invalid') })
    expect(writes()).toEqual([])
    expect(mail.sent).toEqual([])
  })

  it.each(['confirm', 'cancel'])(
    'asks the visitor to try the link again when the brief cannot be looked up (%s)',
    async (action) => {
      db.rules = [{ method: 'GET', table: 'employer_briefs', answer: 'error' }]
      const result = await openBriefLink(action)
      expect(result).toMatchObject({ status: 307, location: briefState('error') })
      expect(writes()).toEqual([])
      expect(mail.sent).toEqual([])
      expect(briefs()).toEqual([pendingBrief])
    },
  )

  it.each(['confirm', 'cancel'])(
    'asks the visitor to try the link again when the lookup does not answer (%s)',
    async (action) => {
      db.rules = [{ method: 'GET', table: 'employer_briefs', answer: 'never' }]
      const result = await openBriefLink(action)
      expect(result).toMatchObject({ status: 307, location: briefState('error') })
      expect(writes()).toEqual([])
      expect(mail.sent).toEqual([])
    },
  )

  it('asks the visitor to try again and sends no email when confirming cannot be saved', async () => {
    db.rules = [{ method: 'PATCH', table: 'employer_briefs', answer: 'error' }]
    const result = await openBriefLink('confirm')
    expect(result).toMatchObject({ status: 307, location: briefState('error') })
    expect(briefs()).toEqual([pendingBrief])
    expect(mail.sent).toEqual([])
    expect(logs).toEqual(['confirm brief: confirm failed XX000'])
  })

  it('asks the visitor to try again when cancelling cannot be saved', async () => {
    db.rules = [{ method: 'DELETE', table: 'employer_briefs', answer: 'error' }]
    const result = await openBriefLink('cancel')
    expect(result).toMatchObject({ status: 307, location: briefState('error') })
    expect(briefs()).toEqual([pendingBrief])
    expect(mail.sent).toEqual([])
    expect(logs).toEqual(['confirm brief: cancel failed XX000'])
  })

  it('sends the visitor back to their own site when a write fails', async () => {
    db.tables.employer_briefs = [{ ...pendingBrief, platform: 'et' }]
    db.rules = [{ method: 'PATCH', table: 'employer_briefs', answer: 'error' }]
    const result = await openBriefLink('confirm')
    expect(result).toMatchObject({ status: 307, location: briefState('error', 'https://ethiotax.com') })
  })

  it('still shows the brief as confirmed when an acknowledgement email is not sent', async () => {
    mail.fail = failSendsTo('ada@example.com')
    const result = await openBriefLink('confirm')
    expect(result).toMatchObject({ status: 307, location: briefState('confirmed') })
    expect(briefs()[0].status).toBe('pending')
    expect(mail.sent).toHaveLength(2)
    expect(logs).toEqual(['email: send failed (hiring brief confirmed acknowledgement) application_error'])
  })

  it('still shows the brief as confirmed when the team notification is not sent', async () => {
    mail.fail = failSendsTo('info@accountingbody.com')
    const result = await openBriefLink('confirm')
    expect(result).toMatchObject({ status: 307, location: briefState('confirmed') })
    expect(logs).toEqual(['email: send failed (hiring brief confirmed team notification) application_error'])
  })
})
