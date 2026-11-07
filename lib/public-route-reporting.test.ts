import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SERVER_PROBLEM_TEXT } from './message-rules'

// The public form and recruitment routes report an unexpected problem from
// their final catch block with a fixed label and area 'public', next to their
// own log line, and keep the visitor's answer unchanged. A real supabase-js
// client comes from the factory; only the network is fake. The reporting
// helper is replaced by a recorder.

const state = vi.hoisted(() => ({
  reports: [] as unknown[][],
  order: [] as string[],
  clientFails: null as Error | null,
  personOk: true,
}))

vi.mock('@/lib/report-error', () => ({
  reportServerError: (...args: unknown[]) => {
    state.reports.push(args)
    state.order.push(`report ${String(args[0])}`)
  },
}))

vi.mock('@/lib/supabase-server', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/supabase-server')>()
  return {
    ...original,
    getServerSupabase: (...args: Parameters<typeof original.getServerSupabase>) => {
      if (state.clientFails) throw state.clientFails
      return original.getServerSupabase(...args)
    },
  }
})

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: async () => ({ data: { id: 'email' }, error: null, headers: {} }) }
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: () => {}, captureMessage: () => {} }))

import { POST as contact } from '@/app/api/contact/route'
import { GET as eticpaMockExam } from '@/app/api/eticpa/mock-exam/route'
import { POST as firmsApplication } from '@/app/api/firms-application/route'
import { GET as health } from '@/app/api/health/route'
import { POST as helpRequest } from '@/app/api/help-request/route'
import { GET as mockExam } from '@/app/api/mock-exam/route'
import { GET as confirmBrief } from '@/app/api/recruitment/confirm-brief/route'
import { POST as employerBrief } from '@/app/api/recruitment/employer-brief/route'
import { GET as fetchBrief } from '@/app/api/recruitment/fetch-brief/route'
import { GET as getProfile } from '@/app/api/recruitment/get-profile/route'
import { POST as jobSeekerApply } from '@/app/api/recruitment/job-seeker-apply/route'
import { POST as updateCandidate } from '@/app/api/recruitment/update-candidate/route'
import { POST as updateEmployer } from '@/app/api/recruitment/update-employer/route'
import { GET as verifyEmail } from '@/app/api/recruitment/verify-email/route'
import { POST as subscribe } from '@/app/api/subscribe/route'

const DB_URL = 'https://example.supabase.co'
const SITE = 'https://accountingbody.com'
const ID = '0f8fad5b-d9cb-469f-a165-70867728950e'
const TOKEN = 'link-token-1'

type Row = Record<string, unknown>
const db = { tables: {} as Record<string, Row[]>, failing: false }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function filtersOf(params: URLSearchParams) {
  const eq: [string, string][] = []
  const lists: [string, string[]][] = []
  params.forEach((value, key) => {
    if (value.startsWith('eq.')) eq.push([key, value.slice(3)])
    if (value.startsWith('in.(') && value.endsWith(')')) lists.push([key, value.slice(4, -1).split(',')])
  })
  return (row: Row) =>
    eq.every(([key, value]) => String(row[key]) === value) &&
    lists.every(([key, allowed]) => allowed.includes(String(row[key])))
}

const fakeFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.origin === 'https://challenges.cloudflare.com') return json({ success: state.personOk })
  if (url.origin !== DB_URL) throw new Error(`unexpected request to ${url.href}`)
  if (db.failing) return json({ message: 'database detail', code: 'XX000', details: null, hint: null }, 500)

  const method = (init?.method ?? 'GET').toUpperCase()
  const table = url.pathname.replace('/rest/v1/', '')
  const accept = new Headers(init?.headers).get('accept') ?? ''
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
  const rows = (db.tables[table] ??= [])
  const matches = filtersOf(url.searchParams)
  if (method === 'GET') {
    const found = rows.filter(matches)
    if (!accept.includes('vnd.pgrst.object')) return json(found)
    if (found.length === 1) return json(found[0])
    return json({ message: 'no single row', code: 'PGRST116', details: null, hint: null }, 406)
  }
  if (method === 'POST') {
    for (const row of Array.isArray(body) ? body : [body]) rows.push({ ...row })
    return new Response(null, { status: 201 })
  }
  if (method === 'PATCH') {
    for (const row of rows) if (matches(row)) Object.assign(row, body)
    return new Response(null, { status: 204 })
  }
  if (method === 'DELETE') {
    const removed = rows.filter(matches)
    db.tables[table] = rows.filter((row) => !matches(row))
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

async function answer(response: Response) {
  const text = await response.text()
  return {
    status: response.status,
    location: response.headers.get('location'),
    body: text && (response.headers.get('content-type') ?? '').includes('json') ? JSON.parse(text) : text,
  }
}

const turnstile = { 'cf-turnstile-response': 'token' }
const brief = {
  id: ID,
  platform: 'ab',
  company_name: 'Acme Ltd',
  contact_name: 'Ada Lovelace',
  contact_email: 'ada@example.com',
  contact_phone: '0100',
  role_title: 'Accountant',
  reference_number: 'AB-E-1',
}
const candidate = {
  id: ID,
  platform: 'ab',
  full_name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '0100',
  professional_role: 'Accountant',
  reference_number: 'AB-C-1',
}

type Expected = { status: number; body?: unknown; location?: string }
type Route = {
  name: string
  label: string
  // The route's own log line in its final catch block, if it has one.
  log?: string
  handler: (req: NextRequest) => Promise<Response>
  seed?: () => void
  healthy: () => NextRequest
  healthyAnswer: Expected
  // How the final catch block is reached: an unreadable body, or a database
  // client that cannot be created.
  via: 'body' | 'client'
  caught: (message: string) => Expected
  refusals: [string, () => void | NextRequest][]
}

const somethingWrong = { status: 500, body: { error: 'Something went wrong.' } }

const ROUTES: Route[] = [
  {
    name: 'contact',
    label: 'contact submit failed',
    log: 'Contact route error:',
    handler: contact,
    healthy: () =>
      post('/api/contact', { name: 'Ada', email: 'ada@example.com', message: 'I would like some help with my accounts.', ...turnstile }),
    healthyAnswer: { status: 200, body: { success: true } },
    via: 'body',
    caught: () => somethingWrong,
    refusals: [
      ['validation', () => post('/api/contact', { name: 'Ada', message: 'I would like some help with my accounts.', ...turnstile })],
      ['person check', () => { state.personOk = false }],
      ['database error', () => { db.failing = true }],
    ],
  },
  {
    name: 'help-request',
    label: 'help request submit failed',
    log: 'Help request error:',
    handler: helpRequest,
    healthy: () =>
      post('/api/help-request', {
        name: 'Ada',
        email: 'ada@example.com',
        service_type: 'Bookkeeping',
        message: 'I need help with my monthly bookkeeping.',
        ...turnstile,
      }),
    healthyAnswer: { status: 200, body: { success: true } },
    via: 'body',
    caught: () => somethingWrong,
    refusals: [
      ['validation', () => post('/api/help-request', { name: 'Ada', email: 'ada@example.com', ...turnstile })],
      ['person check', () => { state.personOk = false }],
      ['database error', () => { db.failing = true }],
    ],
  },
  {
    name: 'firms-application',
    label: 'firms application submit failed',
    log: 'Firms application error:',
    handler: firmsApplication,
    healthy: () =>
      post('/api/firms-application', {
        contact_name: 'Ada',
        email: 'ada@example.com',
        practice_type: 'Practice',
        location: 'London',
        about: '[FIRM] A small practice serving local businesses.',
        ...turnstile,
      }),
    healthyAnswer: { status: 200, body: { success: true } },
    via: 'body',
    caught: () => somethingWrong,
    refusals: [
      ['validation', () => post('/api/firms-application', { contact_name: 'Ada', ...turnstile })],
      ['person check', () => { state.personOk = false }],
      ['database error', () => { db.failing = true }],
    ],
  },
  {
    name: 'subscribe',
    label: 'subscribe failed',
    log: 'Subscribe error:',
    handler: subscribe,
    healthy: () => post('/api/subscribe', { email: 'ada@example.com', ...turnstile }),
    healthyAnswer: { status: 200, body: { success: true } },
    via: 'body',
    caught: () => ({ status: 500, body: { error: 'Something went wrong. Please try again.' } }),
    refusals: [
      ['validation', () => post('/api/subscribe', { email: 'not-an-email', ...turnstile })],
      ['person check', () => { state.personOk = false }],
      ['database error', () => { db.failing = true }],
    ],
  },
  {
    name: 'eticpa/mock-exam',
    label: 'eticpa mock exam load failed',
    handler: eticpaMockExam,
    healthy: () => get('/api/eticpa/mock-exam?level=level-1'),
    healthyAnswer: { status: 200, body: { questions: [], poolTotal: 0 } },
    via: 'client',
    caught: (message) => ({ status: 500, body: { error: message } }),
    refusals: [['database error', () => { db.failing = true }]],
  },
  {
    name: 'mock-exam',
    label: 'mock exam load failed',
    handler: mockExam,
    healthy: () => get('/api/mock-exam?category=tax'),
    healthyAnswer: { status: 200, body: { questions: [], poolTotal: 0 } },
    via: 'client',
    caught: (message) => ({ status: 500, body: { error: message } }),
    refusals: [
      ['validation', () => get('/api/mock-exam')],
      ['database error', () => { db.failing = true }],
    ],
  },
  {
    name: 'health',
    label: 'health check failed',
    handler: () => health(),
    healthy: () => get('/api/health'),
    healthyAnswer: { status: 200, body: { status: 'ok' } },
    via: 'client',
    caught: () => ({ status: 503, body: { status: 'error' } }),
    refusals: [['database error', () => { db.failing = true }]],
  },
  {
    name: 'recruitment/employer-brief',
    label: 'hiring brief submit failed',
    log: 'employer-brief error:',
    handler: employerBrief,
    healthy: () =>
      post('/api/recruitment/employer-brief', {
        company_name: 'Acme Ltd',
        contact_name: 'Ada Lovelace',
        contact_email: 'ada@example.com',
        role_title: 'Accountant',
        contract_type: 'permanent',
        location: 'London',
        role_description: 'Month-end close and reporting.',
        ...turnstile,
      }),
    healthyAnswer: { status: 200, body: { success: true } },
    via: 'body',
    caught: () => ({ status: 500, body: { error: 'Server error' } }),
    refusals: [
      ['validation', () => post('/api/recruitment/employer-brief', { company_name: 'Acme Ltd', ...turnstile })],
      ['person check', () => { state.personOk = false }],
      ['database error', () => { db.failing = true }],
    ],
  },
  {
    name: 'recruitment/confirm-brief',
    label: 'hiring brief confirm failed',
    log: 'confirm-brief error:',
    handler: confirmBrief,
    seed: () => { db.tables.employer_briefs = [{ ...brief, confirmation_token: TOKEN, status: 'pending_confirmation' }] },
    healthy: () => get(`/api/recruitment/confirm-brief?token=${TOKEN}&action=confirm`),
    healthyAnswer: { status: 307, location: `${SITE}/jobs/hire-talent?brief=confirmed` },
    via: 'client',
    caught: () => ({ status: 307, location: `${SITE}/jobs/hire-talent?brief=invalid` }),
    refusals: [
      ['validation', () => get('/api/recruitment/confirm-brief')],
      ['no row', () => get('/api/recruitment/confirm-brief?token=unknown&action=confirm')],
      ['database error', () => { db.failing = true }],
    ],
  },
  {
    name: 'recruitment/fetch-brief',
    label: 'hiring brief lookup failed',
    log: 'fetch-brief error:',
    handler: fetchBrief,
    seed: () => { db.tables.employer_briefs = [{ ...brief, confirmation_token: TOKEN, status: 'pending_confirmation' }] },
    healthy: () => get(`/api/recruitment/fetch-brief?token=${TOKEN}`),
    healthyAnswer: { status: 200 },
    via: 'client',
    caught: () => ({ status: 500, body: { error: SERVER_PROBLEM_TEXT } }),
    refusals: [
      ['validation', () => get('/api/recruitment/fetch-brief')],
      ['no row', () => get('/api/recruitment/fetch-brief?token=unknown')],
      ['database error', () => { db.failing = true }],
    ],
  },
  {
    name: 'recruitment/get-profile',
    label: 'profile lookup failed',
    log: 'get-profile error:',
    handler: getProfile,
    seed: () => { db.tables.job_seeker_registrations = [{ ...candidate, update_token: TOKEN, status: 'active' }] },
    healthy: () => get(`/api/recruitment/get-profile?token=${TOKEN}&type=candidate`),
    healthyAnswer: { status: 200 },
    via: 'client',
    caught: () => ({ status: 500, body: { error: SERVER_PROBLEM_TEXT } }),
    refusals: [
      ['validation', () => get('/api/recruitment/get-profile?token=x')],
      ['no row', () => get('/api/recruitment/get-profile?token=unknown&type=candidate')],
      ['database error', () => { db.failing = true }],
    ],
  },
  {
    name: 'recruitment/job-seeker-apply',
    label: 'job seeker registration failed',
    log: 'Job seeker apply error:',
    handler: jobSeekerApply,
    healthy: () =>
      post('/api/recruitment/job-seeker-apply', {
        full_name: 'Ada Lovelace',
        email: 'ada@example.com',
        location_city: 'London',
        professional_role: 'Accountant',
        qualification: 'ACCA',
        years_experience: '5',
        employment_status: 'employed',
        biography: 'Ten years in practice.',
        ...turnstile,
      }),
    healthyAnswer: { status: 200, body: { success: true } },
    via: 'body',
    caught: () => ({ status: 500, body: { error: SERVER_PROBLEM_TEXT } }),
    refusals: [
      ['validation', () => post('/api/recruitment/job-seeker-apply', { full_name: 'Ada', ...turnstile })],
      ['person check', () => { state.personOk = false }],
      ['database error', () => { db.failing = true }],
    ],
  },
  {
    name: 'recruitment/update-candidate',
    label: 'candidate profile update failed',
    log: 'update-candidate error:',
    handler: updateCandidate,
    seed: () => { db.tables.job_seeker_registrations = [{ ...candidate, update_token: TOKEN, status: 'active' }] },
    healthy: () => post('/api/recruitment/update-candidate', { token: TOKEN, phone: '0200' }),
    healthyAnswer: { status: 200, body: { success: true } },
    via: 'body',
    caught: () => ({ status: 500, body: { error: SERVER_PROBLEM_TEXT } }),
    refusals: [
      ['validation', () => post('/api/recruitment/update-candidate', { phone: '0200' })],
      ['no row', () => post('/api/recruitment/update-candidate', { token: 'unknown', phone: '0200' })],
      ['database error', () => { db.failing = true }],
    ],
  },
  {
    name: 'recruitment/update-employer',
    label: 'hiring brief update failed',
    log: 'update-employer error:',
    handler: updateEmployer,
    seed: () => { db.tables.employer_briefs = [{ ...brief, update_token: TOKEN, status: 'pending' }] },
    healthy: () => post('/api/recruitment/update-employer', { token: TOKEN, contact_phone: '0200' }),
    healthyAnswer: { status: 200, body: { success: true } },
    via: 'body',
    caught: () => ({ status: 500, body: { error: SERVER_PROBLEM_TEXT } }),
    refusals: [
      ['validation', () => post('/api/recruitment/update-employer', { contact_phone: '0200' })],
      ['no row', () => post('/api/recruitment/update-employer', { token: 'unknown', contact_phone: '0200' })],
      ['database error', () => { db.failing = true }],
    ],
  },
  {
    name: 'recruitment/verify-email',
    label: 'email verify failed',
    log: 'Verify email error:',
    handler: verifyEmail,
    seed: () => {
      db.tables.job_seeker_registrations = [{ ...candidate, verification_token: TOKEN, status: 'pending_verification' }]
    },
    healthy: () => get(`/api/recruitment/verify-email?token=${TOKEN}`),
    healthyAnswer: { status: 307, location: `${SITE}/jobs/find-work?verified=true` },
    via: 'client',
    caught: () => ({ status: 307, location: `${SITE}/jobs/find-work?verified=error` }),
    refusals: [
      ['validation', () => get('/api/recruitment/verify-email')],
      ['no row', () => get('/api/recruitment/verify-email?token=unknown')],
      ['database error', () => { db.failing = true }],
    ],
  },
]

const recorded = (...args: unknown[]) => {
  state.order.push(`console ${String(args[0])}`)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-key')
  vi.stubEnv('TURNSTILE_SECRET_KEY_AB', 'test-key')
  vi.stubEnv('JWT_SECRET', 'jwt-test-value-0123456789abcdef')
  vi.spyOn(console, 'error').mockImplementation(recorded)
  vi.spyOn(console, 'warn').mockImplementation(recorded)
  state.reports.length = 0
  state.order.length = 0
  state.clientFails = null
  state.personOk = true
  db.tables = {}
  db.failing = false
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const reportsFor = (label: string) => state.reports.filter((args) => args[0] === label)

// Reaches the final catch block with a known problem.
function caughtRequest(route: Route, problem: Error): NextRequest {
  route.seed?.()
  const req = route.healthy()
  if (route.via === 'client') state.clientFails = problem
  else Object.defineProperty(req, 'json', { value: async () => { throw problem } })
  return req
}

describe.each(ROUTES)('$name', (route) => {
  it('reports an unexpected problem with its route label', async () => {
    const problem = new Error('unexpected problem')
    await route.handler(caughtRequest(route, problem))
    expect(reportsFor(route.label)).toStrictEqual([[route.label, problem, { area: 'public' }]])
  })

  it('keeps the visitor answer unchanged when reporting', async () => {
    const problem = new Error('unexpected problem')
    const result = await answer(await route.handler(caughtRequest(route, problem)))
    const expected = route.caught(problem.message)
    expect(result.status).toBe(expected.status)
    if (expected.body !== undefined) expect(result.body).toStrictEqual(expected.body)
    if (expected.location !== undefined) expect(result.location).toBe(expected.location)
  })

  it('reports after the route log line', async () => {
    await route.handler(caughtRequest(route, new Error('unexpected problem')))
    const lines = state.order.filter((line) => line.startsWith('console') || line === `report ${route.label}`)
    expect(lines).toStrictEqual([...(route.log ? [`console ${route.log}`] : []), `report ${route.label}`])
  })

  it('makes no report for a healthy request', async () => {
    route.seed?.()
    const result = await answer(await route.handler(route.healthy()))
    expect(result.status).toBe(route.healthyAnswer.status)
    if (route.healthyAnswer.body !== undefined) expect(result.body).toStrictEqual(route.healthyAnswer.body)
    if (route.healthyAnswer.location !== undefined) expect(result.location).toBe(route.healthyAnswer.location)
    expect(state.reports).toStrictEqual([])
  })

  it.each(route.refusals)('makes no route report for an expected outcome: %s', async (_name, setUp) => {
    route.seed?.()
    const req = setUp() ?? route.healthy()
    await route.handler(req)
    expect(reportsFor(route.label)).toStrictEqual([])
  })
})

describe('public route reporting', () => {
  it('uses a different label for every route', () => {
    const labels = ROUTES.map((route) => route.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it.each(ROUTES)('$name reports with a fixed label and the area only', ({ name, label }) => {
    const source = readFileSync(join(process.cwd(), 'app/api', name, 'route.ts'), 'utf8')
    const calls = source.match(/reportServerError\([^)]*\)/g) ?? []
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatch(new RegExp(`^reportServerError\\((['"])${label}\\1, (e|err|error), \\{ area: (['"])public\\3 \\}\\)$`))
  })
})
