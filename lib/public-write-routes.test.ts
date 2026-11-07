import { createHmac } from 'node:crypto'
import { SignJWT } from 'jose'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SERVER_PROBLEM_TEXT } from './message-rules'
import { DB_LIMITS_MS, type DbContext } from './supabase-server'

// Public form and payment routes, run with a real supabase-js client from
// the factory. Only the network is fake: the database, the Turnstile check
// and the payment provider answer through the global `fetch`, and emails are
// recorded instead of sent. Time is fake, so a database that never answers
// can be followed to the end of its time limit.

const sent = vi.hoisted(() => [] as { to: unknown; subject: unknown }[])

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (message: { to: unknown; subject: unknown }) => {
        sent.push({ to: message.to, subject: message.subject })
        return { data: { id: 'email' }, error: null }
      },
    }
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: () => {}, captureMessage: () => {} }))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>) => (...args: unknown[]) => fn(...args),
}))

import { GET as confirmSubscription } from '@/app/api/confirm-subscription/route'
import { POST as contact } from '@/app/api/contact/route'
import { POST as firmsApplication } from '@/app/api/firms-application/route'
import { POST as helpRequest } from '@/app/api/help-request/route'
import { POST as checkout } from '@/app/api/jobs/employer/checkout/route'
import { POST as webhook } from '@/app/api/jobs/employer/webhook/route'
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
const JWT_TEST_VALUE = 'jwt-test-value-0123456789abcdef'
const WEBHOOK_TEST_VALUE = 'webhook-test-value'

type Db = 'healthy' | 'never'
type Row = Record<string, unknown>

const network = { db: 'healthy' as Db, row: {} as Row, dbRequests: 0, turnstile: 0, payments: 0 }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

const fakeFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.startsWith('https://challenges.cloudflare.com/')) {
    network.turnstile += 1
    return json({ success: true })
  }
  if (url.startsWith('https://api.lemonsqueezy.com/')) {
    network.payments += 1
    return json({ data: { attributes: { url: 'https://checkout.example/session' } } })
  }
  if (!url.startsWith(DB_URL)) throw new Error(`unexpected request to ${url}`)

  network.dbRequests += 1
  if (network.db === 'never') {
    // Never answers, but stops when its signal aborts (like Node's fetch).
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
    })
  }
  const method = (init?.method ?? 'GET').toUpperCase()
  const headers = new Headers(init?.headers)
  const single = (headers.get('accept') ?? '').includes('vnd.pgrst.object')
  const returnsRows = method === 'GET' || (headers.get('prefer') ?? '').includes('return=representation')
  if (!returnsRows) return new Response(null, { status: method === 'POST' ? 201 : 204 })
  return json(single ? network.row : [network.row], method === 'POST' ? 201 : 200)
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(SITE + path, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7', ...headers },
  })
const get = (pathAndQuery: string) => new NextRequest(SITE + pathAndQuery)

const signedToken = () =>
  new SignJWT({ email: 'ada@example.com', platform: 'ab' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .setIssuedAt()
    .sign(new TextEncoder().encode(JWT_TEST_VALUE))

function webhookRequest(event: string, payload: unknown, signature?: string) {
  const raw = JSON.stringify(payload)
  const sig = signature ?? createHmac('sha256', WEBHOOK_TEST_VALUE).update(raw).digest('hex')
  return post('/api/jobs/employer/webhook', raw, { 'X-Signature': sig, 'X-Event-Name': event })
}

const order = (status = 'paid') => ({
  meta: { custom_data: { job_id: ID, manage_token: 'manage' } },
  data: { id: 4242, attributes: { status, total: 4900 } },
})

type Answer = {
  status: number
  location: string | null
  body: unknown
  emails: number
  dbRequests: number
  turnstile: number
  payments: number
  elapsed: number
}

// Captured before any test fakes the timers.
const realSetTimeout = globalThis.setTimeout

// Runs a route to its answer. Real work (request parsing, signing, hashing)
// is given real time to finish; fake time then jumps straight to the next
// pending timer, so `elapsed` is exactly the time the route spent waiting on
// timers, in fake milliseconds.
async function answer(call: () => Promise<Response>): Promise<Answer> {
  const start = Date.now()
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
    if (Date.now() - start > 120_000) throw new Error('route did not answer')
    await vi.advanceTimersToNextTimerAsync()
  }
  const elapsed = Date.now() - start
  if (failure !== undefined || !response) throw failure
  const text = await response.text()
  return {
    status: response.status,
    location: response.headers.get('location'),
    body: text && (response.headers.get('content-type') ?? '').includes('json') ? JSON.parse(text) : text,
    emails: sent.length,
    dbRequests: network.dbRequests,
    turnstile: network.turnstile,
    payments: network.payments,
    elapsed,
  }
}

type Expected = Partial<Omit<Answer, 'elapsed'>>

type Scenario = {
  name: string
  context: DbContext
  row: Row
  call: () => Promise<Response>
  healthy: Expected
  // What the route answers when the database never answers, and how many
  // database requests it waits for one after another before answering.
  never: Expected & { dbRequests: number }
}

const person = { id: ID, platform: 'ab', full_name: 'Ada Lovelace', email: 'ada@example.com' }
const brief = {
  id: ID,
  platform: 'ab',
  company_name: 'Example Ltd',
  contact_name: 'Ada Lovelace',
  contact_email: 'ada@example.com',
  role_title: 'Accountant',
  reference_number: 'AB-E-0001',
}
const job = {
  id: ID,
  title: 'Accountant',
  company_name: 'Example Ltd',
  employer_email: 'hr@example.com',
  employer_name: 'Ada Lovelace',
  manage_token: 'manage',
  location_country: null,
  platform: ['ab'],
}
const turnstile = { 'cf-turnstile-response': 'token' }
const serverProblem = { error: SERVER_PROBLEM_TEXT }

const scenarios: Scenario[] = [
  {
    name: 'subscription confirmation link',
    context: 'publicWrite',
    row: { email: 'ada@example.com', status: 'pending' },
    call: async () => confirmSubscription(get('/api/confirm-subscription?token=' + (await signedToken()))),
    healthy: { status: 307, location: SITE + '/?confirmed=true', emails: 1, dbRequests: 2 },
    never: { status: 307, location: SITE + '/?confirmed=error', emails: 0, dbRequests: 2 },
  },
  {
    name: 'contact form',
    context: 'publicWrite',
    row: {},
    call: async () =>
      contact(
        post('/api/contact', {
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          subject: 'Accounts',
          message: 'I would like some help with my annual accounts.',
          ...turnstile,
        }),
      ),
    healthy: { status: 200, body: { success: true }, emails: 2, dbRequests: 1, turnstile: 1 },
    never: { status: 500, body: serverProblem, emails: 0, dbRequests: 1, turnstile: 1 },
  },
  {
    name: 'contact newsletter-only form',
    context: 'publicWrite',
    row: {},
    call: async () => contact(post('/api/contact', { email: 'ada@example.com', subscribeOnly: true, ...turnstile })),
    healthy: { status: 200, body: { success: true }, emails: 0, dbRequests: 1, turnstile: 1 },
    never: { status: 500, body: serverProblem, emails: 0, dbRequests: 1, turnstile: 1 },
  },
  {
    name: 'network application form',
    context: 'publicWrite',
    row: {},
    call: async () =>
      firmsApplication(
        post('/api/firms-application', {
          contact_name: 'Ada Lovelace',
          email: 'ada@example.com',
          practice_type: 'Accountancy practice',
          location: 'London',
          about: '[FIRM] A small practice serving local businesses.',
          ...turnstile,
        }),
      ),
    healthy: { status: 200, body: { success: true }, emails: 2, dbRequests: 1, turnstile: 1 },
    never: { status: 500, body: serverProblem, emails: 0, dbRequests: 1, turnstile: 1 },
  },
  {
    name: 'help request form',
    context: 'publicWrite',
    row: {},
    call: async () =>
      helpRequest(
        post('/api/help-request', {
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          service_type: 'Bookkeeping',
          message: 'I need help with my monthly bookkeeping.',
          ...turnstile,
        }),
      ),
    healthy: { status: 200, body: { success: true }, emails: 2, dbRequests: 1, turnstile: 1 },
    never: { status: 500, body: serverProblem, emails: 0, dbRequests: 1, turnstile: 1 },
  },
  {
    name: 'job listing checkout',
    context: 'publicWrite',
    row: job,
    call: async () =>
      checkout(
        post('/api/jobs/employer/checkout', {
          title: 'Accountant',
          company_name: 'Example Ltd',
          description: 'Prepare monthly management accounts.',
          location_text: 'London',
          employer_email: 'hr@example.com',
          employer_name: 'Ada Lovelace',
          employer_company: 'Example Ltd',
        }),
      ),
    healthy: { status: 200, body: { checkoutUrl: 'https://checkout.example/session' }, dbRequests: 1, payments: 1 },
    never: {
      status: 500,
      body: { error: 'Could not start checkout. Please try again.' },
      dbRequests: 1,
      payments: 0,
    },
  },
  {
    name: 'payment notification for a paid order',
    context: 'publicWrite',
    row: job,
    call: async () => webhook(webhookRequest('order_created', order())),
    healthy: { status: 200, body: { received: true }, emails: 2, dbRequests: 2 },
    never: { status: 200, body: { received: true }, emails: 0, dbRequests: 1 },
  },
  {
    name: 'payment notification for a refund',
    context: 'publicWrite',
    row: job,
    call: async () => webhook(webhookRequest('order_refunded', order('refunded'))),
    healthy: { status: 200, body: { received: true }, emails: 1, dbRequests: 1 },
    never: { status: 200, body: { received: true }, emails: 0, dbRequests: 1 },
  },
  {
    name: 'hiring brief confirmation link',
    context: 'publicWrite',
    row: brief,
    call: async () => confirmBrief(get('/api/recruitment/confirm-brief?token=t&action=confirm')),
    healthy: { status: 307, location: SITE + '/jobs/hire-talent?brief=confirmed', emails: 2, dbRequests: 2 },
    never: { status: 307, location: SITE + '/jobs/hire-talent?brief=error', emails: 0, dbRequests: 1 },
  },
  {
    name: 'hiring brief cancellation link',
    context: 'publicWrite',
    row: brief,
    call: async () => confirmBrief(get('/api/recruitment/confirm-brief?token=t&action=cancel')),
    healthy: { status: 307, location: SITE + '/jobs/hire-talent?brief=cancelled', emails: 0, dbRequests: 2 },
    never: { status: 307, location: SITE + '/jobs/hire-talent?brief=error', emails: 0, dbRequests: 1 },
  },
  ...[undefined, 'previous'].map(
    (editToken): Scenario => ({
      name: editToken ? 'edited hiring brief form' : 'hiring brief form',
      context: 'publicWrite',
      row: {},
      call: async () =>
        employerBrief(
          post('/api/recruitment/employer-brief', {
            company_name: 'Example Ltd',
            contact_name: 'Ada Lovelace',
            contact_email: 'ada@example.com',
            role_title: 'Accountant',
            contract_type: 'permanent',
            location: 'London',
            role_description: 'Prepare monthly management accounts.',
            ...(editToken ? { edit_token: editToken } : {}),
            ...turnstile,
          }),
        ),
      healthy: { status: 200, body: { success: true }, emails: 1, dbRequests: editToken ? 2 : 1, turnstile: 1 },
      // The new brief is saved first, so when that does not answer the route
      // stops there, also when editing.
      never: { status: 500, body: serverProblem, emails: 0, dbRequests: 1, turnstile: 1 },
    }),
  ),
  {
    name: 'hiring brief lookup',
    context: 'publicRead',
    row: brief,
    call: async () => fetchBrief(get('/api/recruitment/fetch-brief?token=t')),
    healthy: { status: 200, body: { data: brief }, dbRequests: 1 },
    never: { status: 404, body: { error: 'Not found' }, dbRequests: 1 },
  },
  ...(['candidate', 'employer'] as const).map(
    (type): Scenario => ({
      name: `${type} profile lookup`,
      context: 'publicRead',
      row: type === 'candidate' ? person : brief,
      call: async () => getProfile(get(`/api/recruitment/get-profile?token=t&type=${type}`)),
      healthy: { status: 200, body: { data: type === 'candidate' ? person : brief, type }, dbRequests: 1 },
      never: { status: 404, body: { error: 'Invalid or expired link' }, dbRequests: 1 },
    }),
  ),
  {
    name: 'job seeker registration form',
    context: 'publicWrite',
    row: {},
    call: async () =>
      jobSeekerApply(
        post('/api/recruitment/job-seeker-apply', {
          full_name: 'Ada Lovelace',
          email: 'ada@example.com',
          location_city: 'London',
          professional_role: 'Accountant',
          qualification: 'ACCA',
          years_experience: '5',
          employment_status: 'employed',
          biography: 'Experienced management accountant.',
          ...turnstile,
        }),
      ),
    healthy: { status: 200, body: { success: true }, emails: 1, dbRequests: 1, turnstile: 1 },
    never: { status: 500, body: { error: 'Database error' }, emails: 0, dbRequests: 1, turnstile: 1 },
  },
  {
    name: 'candidate profile update',
    context: 'publicWrite',
    row: { ...person, reference_number: 'AB-C-0001' },
    call: async () => updateCandidate(post('/api/recruitment/update-candidate', { token: 't', phone: '0123 456' })),
    healthy: { status: 200, body: { success: true }, emails: 1, dbRequests: 3 },
    never: { status: 404, body: { error: 'Invalid or expired link' }, emails: 0, dbRequests: 1 },
  },
  {
    name: 'hiring brief update',
    context: 'publicWrite',
    row: brief,
    call: async () => updateEmployer(post('/api/recruitment/update-employer', { token: 't', contact_phone: '0123 456' })),
    healthy: { status: 200, body: { success: true }, emails: 1, dbRequests: 3 },
    never: { status: 404, body: { error: 'Invalid or expired link' }, emails: 0, dbRequests: 1 },
  },
  {
    name: 'job seeker email verification link',
    context: 'publicWrite',
    row: {
      ...person,
      status: 'pending_verification',
      professional_role: 'Accountant',
      role_types: ['Permanent'],
      jurisdictions: ['UK'],
      languages: ['English'],
    },
    call: async () => verifyEmail(get('/api/recruitment/verify-email?token=t')),
    healthy: { status: 307, location: SITE + '/jobs/find-work?verified=true', emails: 2, dbRequests: 2 },
    never: { status: 307, location: SITE + '/jobs/find-work?verified=invalid', emails: 0, dbRequests: 1 },
  },
  {
    name: 'newsletter signup',
    context: 'publicWrite',
    row: {},
    call: async () => subscribe(post('/api/subscribe', { email: 'ada@example.com', ...turnstile })),
    healthy: { status: 200, body: { success: true }, emails: 1, dbRequests: 2, turnstile: 1 },
    never: { status: 500, body: serverProblem, emails: 0, dbRequests: 1, turnstile: 1 },
  },
]

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(new Date('2026-06-01T09:00:00Z'))
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-key')
  vi.stubEnv('TURNSTILE_SECRET_KEY_AB', 'test-key')
  vi.stubEnv('JWT_SECRET', JWT_TEST_VALUE)
  vi.stubEnv('LEMONSQUEEZY_API_KEY', 'test-key')
  vi.stubEnv('LEMONSQUEEZY_STORE_ID', '1')
  vi.stubEnv('LEMONSQUEEZY_VARIANT_ID_GBP', '2')
  vi.stubEnv('LEMONSQUEEZY_VARIANT_ID_USD', '3')
  vi.stubEnv('LEMONSQUEEZY_WEBHOOK_SECRET', WEBHOOK_TEST_VALUE)
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', undefined)
  vi.stubEnv('ADMIN_EMAIL', undefined)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  sent.length = 0
  Object.assign(network, { db: 'healthy', row: {}, dbRequests: 0, turnstile: 0, payments: 0 })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function expectAnswer(actual: Answer, expected: Expected) {
  const defaults = { emails: 0, turnstile: 0, payments: 0 }
  const wanted = { ...defaults, ...expected }
  const picked = Object.fromEntries(Object.keys(wanted).map((key) => [key, actual[key as keyof Answer]]))
  expect(picked).toEqual(wanted)
}

describe('public form and payment routes', () => {
  it.each(scenarios)('$name answers as before when the database responds', async (scenario) => {
    network.row = scenario.row
    const result = await answer(scenario.call)
    expectAnswer(result, scenario.healthy)
    expect(result.elapsed).toBe(0)
  })

  it.each(scenarios)(
    '$name answers within its time limit when the database does not respond',
    async (scenario) => {
      network.row = scenario.row
      network.db = 'never'
      const result = await answer(scenario.call)
      expectAnswer(result, scenario.never)
      expect(result.elapsed).toBe(DB_LIMITS_MS[scenario.context] * scenario.never.dbRequests)
    },
  )

  it('payment notification checks its signature before any database request', async () => {
    const result = await answer(() => webhook(webhookRequest('order_created', order(), '0'.repeat(64))))
    expectAnswer(result, { status: 400, body: { error: 'Invalid signature' }, dbRequests: 0 })
  })
})
