import { createHmac } from 'node:crypto'
import { SignJWT } from 'jose'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Each public form and payment route asks the factory for one context for
// all of its database work: routes that write use the public write limit
// throughout (also for the reads before the write); the two lookup routes
// that only read use the public read limit. The real factory is wrapped so
// every request it creates a client for is recorded, and the network answers
// every database request with one healthy row.

const contexts = vi.hoisted(() => [] as string[])

vi.mock('@/lib/supabase-server', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/supabase-server')>()
  return {
    ...original,
    getServerSupabase: (context: Parameters<typeof original.getServerSupabase>[0]) => {
      contexts.push(context)
      return original.getServerSupabase(context)
    },
  }
})
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: async () => ({ data: { id: 'email' }, error: null }) }
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

// One row that has every field these routes read.
const ROW = {
  id: ID,
  platform: 'ab',
  status: 'pending_verification',
  email: 'ada@example.com',
  full_name: 'Ada Lovelace',
  contact_name: 'Ada Lovelace',
  contact_email: 'ada@example.com',
  company_name: 'Example Ltd',
  role_title: 'Accountant',
  reference_number: 'AB-0001',
  title: 'Accountant',
  employer_email: 'hr@example.com',
  employer_name: 'Ada Lovelace',
  manage_token: 'manage',
  location_country: null,
}

let paymentsFail = false

const fakeFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  if (url.startsWith('https://challenges.cloudflare.com/')) return json({ success: true })
  if (url.startsWith('https://api.lemonsqueezy.com/')) {
    return paymentsFail ? json({ errors: [] }, 422) : json({ data: { attributes: { url: 'https://checkout.example/s' } } })
  }
  if (!url.startsWith(DB_URL)) throw new Error(`unexpected request to ${url}`)
  const method = (init?.method ?? 'GET').toUpperCase()
  const headers = new Headers(init?.headers)
  const single = (headers.get('accept') ?? '').includes('vnd.pgrst.object')
  const returnsRows = method === 'GET' || (headers.get('prefer') ?? '').includes('return=representation')
  if (!returnsRows) return new Response(null, { status: method === 'POST' ? 201 : 204 })
  return json(single ? ROW : [ROW], method === 'POST' ? 201 : 200)
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(SITE + path, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
  })
const get = (pathAndQuery: string) => new NextRequest(SITE + pathAndQuery)

function webhookRequest(event: string) {
  const raw = JSON.stringify({
    meta: { custom_data: { job_id: ID, manage_token: 'manage' } },
    data: { id: 4242, attributes: { status: 'paid', total: 4900 } },
  })
  const signature = createHmac('sha256', WEBHOOK_TEST_VALUE).update(raw).digest('hex')
  return post('/api/jobs/employer/webhook', raw, { 'X-Signature': signature, 'X-Event-Name': event })
}

const turnstile = { 'cf-turnstile-response': 'token' }
const jobPost = {
  title: 'Accountant',
  company_name: 'Example Ltd',
  description: 'Prepare monthly management accounts.',
  location_text: 'London',
  employer_email: 'hr@example.com',
  employer_name: 'Ada Lovelace',
  employer_company: 'Example Ltd',
}

type Case = [string, () => Promise<unknown>]

const writeRoutes: Case[] = [
  [
    'subscription confirmation link',
    async () => {
      const token = await new SignJWT({ email: 'ada@example.com', platform: 'ab' })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('7d')
        .sign(new TextEncoder().encode(JWT_TEST_VALUE))
      return confirmSubscription(get('/api/confirm-subscription?token=' + token))
    },
  ],
  [
    'contact form',
    () =>
      contact(
        post('/api/contact', {
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          message: 'I would like some help with my annual accounts.',
          subscribe: true,
          ...turnstile,
        }),
      ),
  ],
  [
    'network application form',
    () =>
      firmsApplication(
        post('/api/firms-application', {
          contact_name: 'Ada Lovelace',
          email: 'ada@example.com',
          practice_type: 'Accountancy practice',
          location: 'London',
          about: 'A small practice serving local businesses.',
          ...turnstile,
        }),
      ),
  ],
  [
    'help request form',
    () =>
      helpRequest(
        post('/api/help-request', {
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          service_type: 'Bookkeeping',
          message: 'I need help with my monthly bookkeeping.',
          ...turnstile,
        }),
      ),
  ],
  ['job listing checkout', () => checkout(post('/api/jobs/employer/checkout', jobPost))],
  [
    'job listing checkout when the payment provider declines',
    () => {
      paymentsFail = true
      return checkout(post('/api/jobs/employer/checkout', jobPost))
    },
  ],
  ['payment notification for a paid order', () => webhook(webhookRequest('order_created'))],
  ['payment notification for a refund', () => webhook(webhookRequest('order_refunded'))],
  ['hiring brief confirmation link', () => confirmBrief(get('/api/recruitment/confirm-brief?token=t&action=confirm'))],
  ['hiring brief cancellation link', () => confirmBrief(get('/api/recruitment/confirm-brief?token=t&action=cancel'))],
  [
    'hiring brief form',
    () =>
      employerBrief(
        post('/api/recruitment/employer-brief', {
          company_name: 'Example Ltd',
          contact_name: 'Ada Lovelace',
          contact_email: 'ada@example.com',
          role_title: 'Accountant',
          contract_type: 'permanent',
          location: 'London',
          role_description: 'Prepare monthly management accounts.',
          edit_token: 'previous',
        }),
      ),
  ],
  [
    'job seeker registration form',
    () =>
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
        }),
      ),
  ],
  ['candidate profile update', () => updateCandidate(post('/api/recruitment/update-candidate', { token: 't', phone: '1' }))],
  ['hiring brief update', () => updateEmployer(post('/api/recruitment/update-employer', { token: 't', contact_phone: '1' }))],
  ['job seeker email verification link', () => verifyEmail(get('/api/recruitment/verify-email?token=t'))],
  ['newsletter signup', () => subscribe(post('/api/subscribe', { email: 'ada@example.com', ...turnstile }))],
]

const readRoutes: Case[] = [
  ['hiring brief lookup', () => fetchBrief(get('/api/recruitment/fetch-brief?token=t'))],
  ['candidate profile lookup', () => getProfile(get('/api/recruitment/get-profile?token=t&type=candidate'))],
  ['hiring brief profile lookup', () => getProfile(get('/api/recruitment/get-profile?token=t&type=employer'))],
]

beforeEach(() => {
  contexts.length = 0
  paymentsFail = false
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
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function contextsOf(run: () => Promise<unknown>): Promise<string[]> {
  contexts.length = 0
  const response = await run()
  expect(response).toBeInstanceOf(Response)
  return contexts.slice()
}

describe('public form and payment routes use the limit for their work', () => {
  it.each(writeRoutes)('%s uses the public write limit for all its database work', async (_name, run) => {
    const used = await contextsOf(run)
    expect(used.length).toBeGreaterThan(0)
    expect(new Set(used)).toEqual(new Set(['publicWrite']))
  })

  it.each(readRoutes)('%s uses the public read limit', async (_name, run) => {
    const used = await contextsOf(run)
    expect(used.length).toBeGreaterThan(0)
    expect(new Set(used)).toEqual(new Set(['publicRead']))
  })

  it('the checkout clean-up after a declined payment uses its own write-limited client', async () => {
    const used = await contextsOf(writeRoutes.find(([name]) => name.includes('declines'))![1])
    // One client for the listing insert, one for the clean-up.
    expect(used).toEqual(['publicWrite', 'publicWrite'])
  })

  it('the paid-order notification records the order on its own write-limited client', async () => {
    const used = await contextsOf(() => webhook(webhookRequest('order_created')))
    // One client for marking the listing paid, one for the order reference.
    expect(used).toEqual(['publicWrite', 'publicWrite'])
  })
})
