import { SignJWT } from 'jose'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HUMAN_CHECK_FAILED_TEXT } from './message-rules'

// Public form and link routes: the person check is verified on the server
// before anything is saved or sent, and visitor text appears in our emails as
// plain text. A real supabase-js client comes from the factory; only the
// network is fake. The database is a small in-memory store reached through the
// global `fetch`; Cloudflare's check answers as each test sets it; emails are
// recorded instead of sent.

type Mail = { from: unknown; to: unknown; subject: unknown; html: unknown; replyTo: unknown }

const mail = vi.hoisted(() => ({ sent: [] as Mail[] }))

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (message: Mail) => {
        mail.sent.push({
          from: message.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          replyTo: message.replyTo,
        })
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
import { GET as confirmBrief } from '@/app/api/recruitment/confirm-brief/route'
import { POST as employerBrief } from '@/app/api/recruitment/employer-brief/route'
import { POST as jobSeekerApply } from '@/app/api/recruitment/job-seeker-apply/route'
import { POST as updateCandidate } from '@/app/api/recruitment/update-candidate/route'
import { POST as updateEmployer } from '@/app/api/recruitment/update-employer/route'
import { GET as verifyEmail } from '@/app/api/recruitment/verify-email/route'

const DB_URL = 'https://example.supabase.co'
const SITE = 'https://accountingbody.com'
const JWT_TEST_VALUE = 'jwt-test-value-0123456789abcdef'
const TOKEN = 'widget-token-value'
const VISITOR_IP = '203.0.113.7'

// A value with each of the five HTML characters, and how it must appear.
const SPECIAL = `Tom & "Jerry" <b>O'Neil</b>`
const SPECIAL_SHOWN = 'Tom &amp; &quot;Jerry&quot; &lt;b&gt;O&#39;Neil&lt;/b&gt;'
const RAW_MARKUP = '<b>O'

type Row = Record<string, unknown>
const db = {
  tables: {} as Record<string, Row[]>,
  requests: [] as { method: string; table: string }[],
  keepRowsOnUpdate: false,
}

type CheckAnswer = 'confirmed' | 'rejected' | 'unreadable' | 'down' | 'silent'
const check = { answer: 'confirmed' as CheckAnswer, requests: [] as Row[] }

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

function filtersOf(params: URLSearchParams): ((row: Row) => boolean)[] {
  const filters: ((row: Row) => boolean)[] = []
  params.forEach((value, key) => {
    if (value.startsWith('eq.')) filters.push((row) => String(row[key]) === value.slice(3))
    if (value.startsWith('in.(')) {
      const allowed = value.slice(4, -1).split(',')
      filters.push((row) => allowed.includes(String(row[key])))
    }
  })
  return filters
}

const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.origin === 'https://challenges.cloudflare.com') {
    check.requests.push(JSON.parse(String(init?.body)))
    if (check.answer === 'confirmed') return json({ success: true, 'error-codes': [] })
    if (check.answer === 'rejected') return json({ success: false, 'error-codes': ['invalid-input-response'] })
    if (check.answer === 'unreadable') return new Response('<html>gateway</html>', { status: 502 })
    if (check.answer === 'down') throw new TypeError('fetch failed')
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })
  }
  if (url.origin !== DB_URL) throw new Error(`unexpected request to ${url.href}`)

  const method = (init?.method ?? 'GET').toUpperCase()
  const table = url.pathname.replace('/rest/v1/', '')
  db.requests.push({ method, table })
  const headers = new Headers(init?.headers)
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
  const rows = (db.tables[table] ??= [])
  const filters = filtersOf(url.searchParams)
  const matches = (row: Row) => filters.every((f) => f(row))

  if (method === 'GET') {
    const found = rows.filter(matches)
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
  if (method === 'PATCH') {
    if (!db.keepRowsOnUpdate) for (const row of rows.filter(matches)) Object.assign(row, body)
    return new Response(null, { status: 204 })
  }
  if (method === 'DELETE') {
    const removed = rows.filter(matches)
    db.tables[table] = rows.filter((row) => !matches(row))
    return new Response(null, { status: 204, headers: { 'content-range': `*/${removed.length}` } })
  }
  throw new Error(`unexpected ${method} to ${table}`)
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(SITE + path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': VISITOR_IP, ...headers },
  })
const get = (path: string) => new NextRequest(SITE + path)

async function read(response: Response) {
  const text = await response.text()
  return {
    status: response.status,
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
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret-et')
  vi.stubEnv('TURNSTILE_SECRET_KEY_AB', 'test-secret-ab')
  vi.stubEnv('JWT_SECRET', JWT_TEST_VALUE)
  for (const level of ['log', 'info', 'warn', 'error'] as const) vi.spyOn(console, level).mockImplementation(logged)
  logs = []
  mail.sent.length = 0
  db.tables = {}
  db.requests = []
  db.keepRowsOnUpdate = false
  check.answer = 'confirmed'
  check.requests = []
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// Only the time-limit timers are fake, so reading the request body still
// works; the clock is moved on once the request to Cloudflare has gone out.
function startTimeLimitClock() {
  vi.useRealTimers()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(new Date('2026-06-01T09:00:00Z'))
}
async function untilCheckRequested() {
  for (let i = 0; i < 200 && check.requests.length === 0; i++) await new Promise((r) => setImmediate(r))
  expect(check.requests).toHaveLength(1)
}

const writes = () => db.requests.filter((r) => r.method !== 'GET')
const htmlOf = (index: number) => String(mail.sent[index]?.html)
const expectPlainTextShown = (html: string) => {
  expect(html).toContain(SPECIAL_SHOWN)
  expect(html).not.toContain(RAW_MARKUP)
}

const turnstile = { 'cf-turnstile-response': TOKEN }
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

const failingChecks: [string, () => void, Record<string, unknown>][] = [
  ['no token is sent', () => {}, { 'cf-turnstile-response': '' }],
  ['Cloudflare does not confirm the token', () => (check.answer = 'rejected'), {}],
  ['Cloudflare sends an unreadable reply', () => (check.answer = 'unreadable'), {}],
  ['Cloudflare cannot be reached', () => (check.answer = 'down'), {}],
]

describe('contact form and the person check', () => {
  it('saves and sends as today when the person check passes', async () => {
    const result = await read(await contact(post('/api/contact', contactForm)))
    expect(result).toEqual({ status: 200, body: { success: true } })
    expect(writes()).toEqual([{ method: 'POST', table: 'contact_submissions' }])
    expect(mail.sent).toHaveLength(2)
    expect(check.requests).toEqual([{ secret: 'test-secret-ab', response: TOKEN, remoteip: VISITOR_IP }])
  })

  it.each(failingChecks)('asks the visitor to refresh when %s, and saves and sends nothing', async (_name, arrange, override) => {
    arrange()
    const result = await read(await contact(post('/api/contact', { ...contactForm, subscribe: true, ...override })))
    expect(result).toEqual({ status: 400, body: { error: HUMAN_CHECK_FAILED_TEXT } })
    expect(writes()).toEqual([])
    expect(mail.sent).toEqual([])
  })

  it('asks the visitor to refresh when Cloudflare gives no answer within 5 seconds', async () => {
    startTimeLimitClock()
    check.answer = 'silent'
    let settled = false
    const pending = contact(post('/api/contact', contactForm)).then((r) => {
      settled = true
      return r
    })
    await untilCheckRequested()
    await vi.advanceTimersByTimeAsync(4999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(await read(await pending)).toEqual({ status: 400, body: { error: HUMAN_CHECK_FAILED_TEXT } })
    expect(check.requests).toHaveLength(1)
    expect(writes()).toEqual([])
    expect(mail.sent).toEqual([])
    expect(logs).toEqual(['person check: contact unavailable'])
  })

  it('needs the person check for a newsletter-only request too', async () => {
    check.answer = 'rejected'
    const result = await read(await contact(post('/api/contact', { email: 'ada@example.com', subscribeOnly: true, ...turnstile })))
    expect(result).toEqual({ status: 400, body: { error: HUMAN_CHECK_FAILED_TEXT } })
    expect(writes()).toEqual([])
  })

  it('uses the second site secret when the request is marked for the second site', async () => {
    await contact(post('/api/contact', contactForm, { 'x-et-platform': 'ethiotax' }))
    expect(check.requests.map((r) => r.secret)).toEqual(['test-secret-et'])
  })

  it('keeps its existing answer for filtered submissions, whatever the person check says', async () => {
    for (const answer of ['confirmed', 'rejected', 'down'] as CheckAnswer[]) {
      check.answer = answer
      for (const form of [
        { ...contactForm, _h: 'x' },
        { ...contactForm, email: 'ada@mailinator.com' },
        { ...contactForm, message: 'nospacesatallinthismessage' },
      ]) {
        expect(await read(await contact(post('/api/contact', form)))).toEqual({ status: 200, body: { success: true } })
      }
    }
    expect(writes()).toEqual([])
    expect(mail.sent).toEqual([])
  })

  it('writes log lines without the token, secret, visitor email or address', async () => {
    for (const arrange of [() => (check.answer = 'rejected'), () => (check.answer = 'down')]) {
      arrange()
      await contact(post('/api/contact', contactForm))
      await firmsApplication(post('/api/firms-application', firmsForm))
      await helpRequest(post('/api/help-request', helpForm))
    }
    expect(logs.length).toBeGreaterThan(0)
    for (const line of logs) {
      for (const hidden of [TOKEN, 'test-secret', 'ada@example.com', VISITOR_IP]) expect(line).not.toContain(hidden)
    }
  })
})

describe('network application form and the person check', () => {
  it('saves and sends as today when the person check passes', async () => {
    const result = await read(await firmsApplication(post('/api/firms-application', firmsForm)))
    expect(result).toEqual({ status: 200, body: { success: true } })
    expect(writes()).toEqual([{ method: 'POST', table: 'firms_applications' }])
    expect(mail.sent).toHaveLength(2)
  })

  it.each(failingChecks)('asks the visitor to refresh when %s, and saves and sends nothing', async (_name, arrange, override) => {
    arrange()
    const result = await read(await firmsApplication(post('/api/firms-application', { ...firmsForm, ...override })))
    expect(result).toEqual({ status: 400, body: { error: HUMAN_CHECK_FAILED_TEXT } })
    expect(writes()).toEqual([])
    expect(mail.sent).toEqual([])
  })

  it('asks the visitor to refresh when Cloudflare gives no answer within 5 seconds', async () => {
    startTimeLimitClock()
    check.answer = 'silent'
    const pending = firmsApplication(post('/api/firms-application', firmsForm))
    await untilCheckRequested()
    await vi.advanceTimersByTimeAsync(5000)
    expect(await read(await pending)).toEqual({ status: 400, body: { error: HUMAN_CHECK_FAILED_TEXT } })
    expect(writes()).toEqual([])
    expect(mail.sent).toEqual([])
  })

  it('keeps its existing answer for filtered submissions, whatever the person check says', async () => {
    for (const answer of ['confirmed', 'rejected', 'down'] as CheckAnswer[]) {
      check.answer = answer
      const result = await read(await firmsApplication(post('/api/firms-application', { ...firmsForm, _h: 'x' })))
      expect(result).toEqual({ status: 200, body: { success: true } })
    }
    expect(writes()).toEqual([])
    expect(mail.sent).toEqual([])
  })
})

describe('visitor text appears as plain text in emails', () => {
  it('contact emails', async () => {
    const result = await read(
      await contact(
        post('/api/contact', {
          ...contactForm,
          name: SPECIAL,
          email: "o'neil@example.com",
          subject: `${SPECIAL}\r\nBcc: someone@example.com`,
          message: `Hello there, ${SPECIAL}\nsecond line`,
        }),
      ),
    )
    expect(result.status).toBe(200)
    expectPlainTextShown(htmlOf(0))
    expectPlainTextShown(htmlOf(1))
    expect(htmlOf(0)).toContain('href="mailto:o&#39;neil@example.com"')
    expect(htmlOf(0)).toContain(`Hello there, ${SPECIAL_SHOWN}<br>second line`)
    expect(htmlOf(1)).toContain(`Dear ${SPECIAL_SHOWN},`)
    expect(mail.sent[0].subject).toBe(`New Contact Submission — ${SPECIAL}Bcc: someone@example.com`)
    expect(mail.sent[0].replyTo).toBe("o'neil@example.com")
  })

  it('contact emails keep plain text exactly as typed', async () => {
    await contact(post('/api/contact', contactForm))
    expect(htmlOf(0)).toContain('<span style="color:#0C1A3D;font-size:14px;">Ada Lovelace</span>')
    expect(htmlOf(0)).toContain('<a href="mailto:ada@example.com" style="color:#0C1A3D;font-size:14px;">ada@example.com</a>')
    expect(htmlOf(0)).toContain('<span style="color:#0C1A3D;font-size:14px;">Accounts</span>')
    expect(htmlOf(1)).toContain('I would like some help with my annual accounts.</p>')
    expect(mail.sent[0].subject).toBe('New Contact Submission — Accounts')
  })

  it('network application emails', async () => {
    await firmsApplication(
      post('/api/firms-application', {
        ...firmsForm,
        practice_name: `${SPECIAL}\nLtd`,
        contact_name: SPECIAL,
        phone: SPECIAL,
        practice_type: SPECIAL,
        location: SPECIAL,
        years_of_experience: SPECIAL,
        languages: SPECIAL,
        specialisms: SPECIAL,
        website: `https://example.com/?a=1&b="2"`,
        about: `[FIRM] ${SPECIAL}`,
      }),
    )
    const team = htmlOf(0)
    expectPlainTextShown(team)
    expectPlainTextShown(htmlOf(1))
    expect(team.split(SPECIAL_SHOWN).length - 1).toBeGreaterThanOrEqual(9)
    expect(team).toContain('<a href="https://example.com/?a=1&amp;b=&quot;2&quot;"')
    expect(mail.sent[0].subject).toBe(`New Network Application — Firm: ${SPECIAL}Ltd`)
  })

  it('help request emails', async () => {
    await helpRequest(
      post('/api/help-request', {
        ...helpForm,
        name: SPECIAL,
        phone: SPECIAL,
        service_type: `${SPECIAL}\r\n`,
        message: `Please help ${SPECIAL}`,
      }),
    )
    expectPlainTextShown(htmlOf(0))
    expectPlainTextShown(htmlOf(1))
    expect(htmlOf(1)).toContain(`<strong style="color:#0C1A3D;">${SPECIAL_SHOWN}\r\n</strong>`)
    expect(mail.sent[0].subject).toBe(`New Service Brief — ${SPECIAL}`)
    expect(mail.sent[1].subject).toBe(`We have received your enquiry — ${SPECIAL}`)
  })

  it('newsletter team notification', async () => {
    const token = await new SignJWT({ email: `<b>o'neil@example.com\n`, platform: 'ab' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .setIssuedAt()
      .sign(new TextEncoder().encode(JWT_TEST_VALUE))
    await confirmSubscription(get('/api/confirm-subscription?token=' + token))
    expect(htmlOf(0)).toContain('&lt;b&gt;o&#39;neil@example.com')
    expect(htmlOf(0)).not.toContain('<b>o')
    expect(mail.sent[0].subject).toBe("New subscriber - <b>o'neil@example.com")
  })

  it('job-seeker verification email', async () => {
    await jobSeekerApply(
      post('/api/recruitment/job-seeker-apply', {
        full_name: `<b>O'Neil</b> Smith`,
        email: 'ada@example.com',
        location_city: 'London',
        professional_role: 'Accountant',
        qualification: 'ACCA',
        years_experience: '5',
        employment_status: 'Employed',
        biography: 'Experienced accountant.',
      }),
    )
    expect(htmlOf(0)).toContain('Thank you for registering, &lt;b&gt;O&#39;Neil&lt;/b&gt;')
    expect(htmlOf(0)).not.toContain(RAW_MARKUP)
    expect(htmlOf(0)).toMatch(/verify-email\?token=[0-9a-z]+"/)
  })

  it('hiring brief confirmation email', async () => {
    await employerBrief(
      post('/api/recruitment/employer-brief', {
        company_name: SPECIAL,
        contact_name: `<b>O'Neil</b> Smith`,
        contact_email: 'ada@example.com',
        role_title: SPECIAL,
        contract_type: SPECIAL,
        location: SPECIAL,
        salary_budget: SPECIAL,
        start_date: SPECIAL,
        role_description: SPECIAL,
        must_haves: SPECIAL,
      }),
    )
    const html = htmlOf(0)
    expect(html.split(SPECIAL_SHOWN).length - 1).toBe(8)
    expect(html).toContain('Dear &lt;b&gt;O&#39;Neil&lt;/b&gt;')
    expect(html).not.toContain(RAW_MARKUP)
    expect(html).toMatch(/confirm-brief\?token=[0-9a-f-]{36}&action=confirm"/)
  })

  it('job-seeker verified emails', async () => {
    db.tables.job_seeker_registrations = [
      {
        id: 'r1',
        verification_token: 'vt1',
        status: 'pending_verification',
        platform: `ab<i>`,
        full_name: `<b>O'Neil</b> Smith`,
        email: SPECIAL,
        phone: SPECIAL,
        location_city: SPECIAL,
        location_country: SPECIAL,
        linkedin_url: `https://example.com/in/a"b`,
        professional_role: `${SPECIAL}\n`,
        qualification: SPECIAL,
        years_experience: SPECIAL,
        employment_status: SPECIAL,
        salary_expectation: SPECIAL,
        role_types: [SPECIAL],
        jurisdictions: SPECIAL,
        languages: [SPECIAL, 'English'],
        biography: SPECIAL,
        created_at: '2026-05-01T00:00:00Z',
      },
    ]
    await verifyEmail(get('/api/recruitment/verify-email?token=vt1'))
    expect(htmlOf(0)).toContain('Thank you, &lt;b&gt;O&#39;Neil&lt;/b&gt;')
    const team = htmlOf(1)
    expect(team.split(SPECIAL_SHOWN).length - 1).toBeGreaterThanOrEqual(12)
    expect(team).toContain('href="https://example.com/in/a&quot;b"')
    expect(team).toContain('AB&lt;I&gt;')
    expect(team).not.toContain(RAW_MARKUP)
    expect(team).not.toContain('<I>')
    expect(mail.sent[1].subject).toBe(`[AB<I>] New candidate verified — <b>O'Neil</b> Smith — ${SPECIAL}`)
  })

  it('hiring brief confirmed emails', async () => {
    db.tables.employer_briefs = [
      {
        id: 'b1',
        confirmation_token: 'ct1',
        status: 'pending_confirmation',
        platform: 'ab<i>',
        company_name: SPECIAL,
        contact_name: `<b>O'Neil</b> Smith`,
        contact_email: SPECIAL,
        contact_phone: SPECIAL,
        role_title: `${SPECIAL}\r\n`,
        contract_type: SPECIAL,
        location: SPECIAL,
        salary_budget: SPECIAL,
        start_date: SPECIAL,
        role_description: SPECIAL,
      },
    ]
    await confirmBrief(get('/api/recruitment/confirm-brief?token=ct1&action=confirm'))
    expect(htmlOf(0)).toContain('Dear &lt;b&gt;O&#39;Neil&lt;/b&gt;')
    expect(htmlOf(0).split(SPECIAL_SHOWN).length - 1).toBe(2)
    expect(htmlOf(0)).toMatch(/[A-Z]{2}-E-\d{4}-[0-9A-F]{8}/)
    const team = htmlOf(1)
    expect(team.split(SPECIAL_SHOWN).length - 1).toBeGreaterThanOrEqual(9)
    expect(team).toContain('AB&lt;I&gt;')
    expect(team).not.toContain(RAW_MARKUP)
    expect(mail.sent[1].subject).toBe(`[AB<I>] Employer confirmed brief - ${SPECIAL} at ${SPECIAL}`)
  })

  it('profile update notifications', async () => {
    db.keepRowsOnUpdate = true
    db.tables.job_seeker_registrations = [
      { id: 'r1', update_token: 'ut1', status: 'active', platform: 'ab\n', full_name: SPECIAL, email: 'a@example.com', reference_number: 'AB-C-2026-0000ABCD', biography: 'old' },
    ]
    db.tables.employer_briefs = [
      { id: 'b1', update_token: 'ut2', status: 'pending', platform: 'ab', company_name: SPECIAL, reference_number: 'AB-E-2026-0000ABCD', must_haves: 'old' },
    ]
    await updateCandidate(post('/api/recruitment/update-candidate', { token: 'ut1', biography: 'new' }))
    await updateEmployer(post('/api/recruitment/update-employer', { token: 'ut2', must_haves: 'new' }))
    expect(mail.sent).toHaveLength(2)
    for (const index of [0, 1]) {
      expect(htmlOf(index)).toContain(`<strong>${SPECIAL_SHOWN}</strong>`)
      expect(htmlOf(index)).not.toContain(RAW_MARKUP)
    }
    expect(mail.sent[0].subject).toBe('[AB] Candidate profile updated - AB-C-2026-0000ABCD')
    expect(mail.sent[1].subject).toBe('[AB] Employer brief updated - AB-E-2026-0000ABCD')
  })
})
