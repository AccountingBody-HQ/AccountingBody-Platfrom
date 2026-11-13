import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The job, saved-job, payment, scheduled and import routes report an
// unexpected problem from their final catch block with a fixed label and
// area, next to their own log line, and keep their answer unchanged. Real
// supabase-js clients come from the factory and only the network is fake.
// A named library function can be made to fail; the reporting helper is
// replaced by a recorder.

const state = vi.hoisted(() => ({
  reports: [] as unknown[][],
  order: [] as string[],
  sentry: [] as unknown[][],
  emails: [] as unknown[],
  clientFails: null as Error | null,
  failing: new Map<string, unknown>(),
  hanging: new Set<string>(),
  due: null as unknown[] | null,
  personOk: true,
}))

vi.mock('@/lib/report-error', () => ({
  reportServerError: (...args: unknown[]) => {
    state.reports.push(args)
    state.order.push(`report ${String(args[0])}`)
  },
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => state.sentry.push(args),
  captureMessage: (...args: unknown[]) => state.sentry.push(args),
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

// Each listed function can be made to fail (state.failing) or never answer
// (state.hanging); otherwise the real one runs.
function failable<T extends Record<string, unknown>>(original: T, names: string[]): T {
  const wrapped: Record<string, unknown> = { ...original }
  for (const name of names) {
    const real = original[name] as (...args: unknown[]) => unknown
    wrapped[name] = (...args: unknown[]) => {
      if (state.failing.has(name)) return Promise.reject(state.failing.get(name))
      if (state.hanging.has(name)) return new Promise(() => {})
      if (name === 'getProvidersDueForFetch' && state.due) return Promise.resolve(state.due)
      return real(...args)
    }
  }
  return wrapped as T
}

vi.mock('@/lib/jobs', async (importOriginal) =>
  failable(await importOriginal<typeof import('@/lib/jobs')>(), [
    'getExpiringJobs',
    'getCachedListingJobs',
    'getCachedListingJobsCount',
    'getJobByManageToken',
    'createJob',
    'getActiveDirectJobs',
  ]),
)
vi.mock('@/lib/saved-jobs-store', async (importOriginal) =>
  failable(await importOriginal<typeof import('@/lib/saved-jobs-store')>(), [
    'pruneInactive',
    'listSaved',
    'findSavableJob',
    'deleteSaved',
    'insertManySaved',
  ]),
)
vi.mock('@/lib/providers', async (importOriginal) =>
  failable(await importOriginal<typeof import('@/lib/providers')>(), ['reapStaleRuns', 'getProvidersDueForFetch']),
)
vi.mock('@/lib/adapters', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/adapters')>()),
  getAdapter: () => {
    if (state.failing.has('getAdapter')) throw state.failing.get('getAdapter')
    return { fetch: async () => ({ jobs: [], pagesFetched: 1, totalAvailable: 0 }) }
  },
}))
vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (message: unknown) => {
        state.emails.push(message)
        return { data: { id: 'email' }, error: null, headers: {} }
      },
    }
  },
}))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>) => (...args: unknown[]) => fn(...args),
  unstable_noStore: () => {},
  revalidateTag: () => {},
  revalidatePath: () => {},
}))

import { GET as expireJobs } from '@/app/api/cron/expire-jobs/route'
import { GET as prunePendingSubscribers } from '@/app/api/cron/prune-pending-subscribers/route'
import { GET as pruneSavedJobs } from '@/app/api/cron/prune-saved-jobs/route'
import { POST as ingest } from '@/app/api/ingest/[slug]/route'
import { GET as orchestrator } from '@/app/api/ingest/orchestrator/route'
import { POST as jobClick } from '@/app/api/jobs/click/[id]/route'
import { GET as directJobs } from '@/app/api/jobs/direct/route'
import { POST as checkout } from '@/app/api/jobs/employer/checkout/route'
import { POST as webhook } from '@/app/api/jobs/employer/webhook/route'
import { GET as manageGet, POST as managePost } from '@/app/api/jobs/manage/route'
import { DELETE as savedDelete, GET as savedGet, POST as savedPost } from '@/app/api/saved-jobs/route'
import { POST as savedImport } from '@/app/api/saved-jobs/import/route'
import { GET as search } from '@/app/api/search/route'
import { POST as subscribe } from '@/app/api/subscribe/route'

const DB_URL = 'https://example.supabase.co'
const SITE = 'https://accountingbody.com'
const NOW = Date.parse('2026-11-07T12:00:00.000Z')
const JOB_ID = '0f8fad5b-d9cb-469f-a165-70867728950e'
const VISITOR = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const MANAGE_TOKEN = 'manage-token-1'
const CRON_TEST_VALUE = 'cron-test-value'
const WEBHOOK_TEST_VALUE = 'webhook-test-value'

type Row = Record<string, unknown>
const db = { tables: {} as Record<string, Row[]>, failing: false }

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

function filtersOf(params: URLSearchParams) {
  const eq: [string, string][] = []
  params.forEach((value, key) => {
    if (value.startsWith('eq.')) eq.push([key, value.slice(3)])
  })
  return (row: Row) => eq.every(([key, value]) => String(row[key]) === value)
}

const fakeFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.origin === 'https://challenges.cloudflare.com') return json({ success: state.personOk })
  if (url.origin === 'https://api.lemonsqueezy.com') return json({ data: { attributes: { url: 'https://pay.example/checkout' } } }, 201)
  if (url.origin !== DB_URL) throw new Error(`unexpected request to ${url.href}`)
  if (db.failing) return json({ message: 'database detail', code: 'XX000', details: null, hint: null }, 500)

  const method = (init?.method ?? 'GET').toUpperCase()
  const headers = new Headers(init?.headers)
  const prefer = headers.get('prefer') ?? ''
  const single = (headers.get('accept') ?? '').includes('vnd.pgrst.object')
  const table = url.pathname.replace('/rest/v1/', '')
  if (table.startsWith('rpc/')) return json([])
  const rows = (db.tables[table] ??= [])
  const matches = filtersOf(url.searchParams)
  const counted = (n: number): Record<string, string> => (prefer.includes('count=') ? { 'content-range': `0-0/${n}` } : {})
  const answer = (found: Row[], status: number) => {
    if (!single) return json(found, status, counted(found.length))
    if (found.length === 1) return json(found[0], status)
    return json({ message: 'no single row', code: 'PGRST116', details: null, hint: null }, 406)
  }

  if (method === 'HEAD') return new Response(null, { status: 200, headers: counted(rows.filter(matches).length) })
  if (method === 'GET') return answer(rows.filter(matches), 200)
  const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
  if (method === 'POST') {
    const written = (Array.isArray(body) ? body : [body]).map((row) => ({ id: JOB_ID, ...(row as Row) }))
    rows.push(...written)
    return prefer.includes('return=representation') ? answer(written, 201) : new Response(null, { status: 201 })
  }
  if (method === 'PATCH') {
    const changed = rows.filter(matches)
    for (const row of changed) Object.assign(row, body)
    return prefer.includes('return=representation') ? answer(changed, 200) : new Response(null, { status: 204, headers: counted(changed.length) })
  }
  if (method === 'DELETE') {
    const removed = rows.filter(matches)
    db.tables[table] = rows.filter((row) => !matches(row))
    return prefer.includes('return=representation') ? answer(removed, 200) : new Response(null, { status: 204, headers: counted(removed.length) })
  }
  throw new Error(`unexpected ${method} to ${table}`)
}

let address = 0
const nextAddress = () => `203.0.113.${(address = (address % 250) + 1)}`

function request(path: string, init: { method?: string; body?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(SITE + path, {
    method: init.method ?? 'GET',
    body: init.body,
    headers: { 'x-forwarded-for': nextAddress(), ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
  })
}
const cron = (path: string, method = 'GET') => request(path, { method, headers: { authorization: `Bearer ${CRON_TEST_VALUE}` } })
const withVisitor = (path: string, method: string, body?: unknown) =>
  request(path, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { cookie: `ab_vid=${VISITOR}` } })

async function signed(raw: string, event: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(WEBHOOK_TEST_VALUE), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw))))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return request('/api/jobs/employer/webhook', { method: 'POST', body: raw, headers: { 'X-Signature': signature, 'X-Event-Name': event } })
}

const unreadable = (req: NextRequest, problem: Error) => {
  Object.defineProperty(req, 'json', { value: async () => { throw problem } })
  return req
}

async function answerOf(response: Response) {
  const text = await response.text()
  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    if (key !== 'date') headers[key] = value
  })
  return { status: response.status, headers, body: text && (response.headers.get('content-type') ?? '').includes('json') ? JSON.parse(text) : text }
}

const provider = {
  id: 'provider-1',
  slug: 'example',
  name: 'Example jobs',
  status: 'active',
  adapter_key: 'generic-rest',
  rate_limit_daily: null,
  requests_today: 0,
  field_mapping: { title: 'title', company_name: 'company', application_url: 'url' },
  enforce_relevance: false,
  consecutive_failures: 0,
  health_status: 'healthy',
  data_quality_status: null,
}

const jobPost = {
  title: 'Management Accountant',
  company_name: 'Example Ltd',
  description: 'Prepare monthly management accounts.',
  location_text: 'London',
  employer_email: 'hiring@example.com',
  employer_name: 'Ada Lovelace',
  employer_company: 'Example Ltd',
}

const job = {
  id: JOB_ID,
  title: 'Management Accountant',
  company_name: 'Example Ltd',
  status: 'active',
  manage_token: MANAGE_TOKEN,
  employer_email: 'hiring@example.com',
  platform: ['ab'],
}

type Expected = { status: number; body: unknown; headers?: Record<string, string> }

type Route = {
  name: string
  label: string
  area: 'cron' | 'ingest' | 'public'
  log: string
  file: string
  seed?: () => void
  healthy: () => Promise<Response>
  healthyStatus: number
  // Reaches the final catch block with the given problem.
  caught: (problem: Error) => Promise<Response>
  caughtAnswer: Expected
  refusals: [string, () => Promise<Response>, number][]
}

const NO_STORE = { 'cache-control': 'no-store' }

const ROUTES: Route[] = [
  {
    name: 'cron/expire-jobs',
    label: 'job expiry run failed',
    area: 'cron',
    log: 'cron/expire-jobs: fatal error',
    file: 'app/api/cron/expire-jobs/route.ts',
    healthy: () => expireJobs(cron('/api/cron/expire-jobs')),
    healthyStatus: 200,
    caught: (problem) => {
      state.failing.set('getExpiringJobs', problem)
      return expireJobs(cron('/api/cron/expire-jobs'))
    },
    caughtAnswer: { status: 500, body: { error: 'Cron run failed', expired: 0, warned: 0 } },
    refusals: [['cron auth refusal', () => expireJobs(request('/api/cron/expire-jobs')), 401]],
  },
  {
    name: 'cron/prune-pending-subscribers',
    label: 'pending subscriber cleanup failed',
    area: 'cron',
    log: 'cron/prune-pending-subscribers: fatal error',
    file: 'app/api/cron/prune-pending-subscribers/route.ts',
    healthy: () => prunePendingSubscribers(cron('/api/cron/prune-pending-subscribers')),
    healthyStatus: 200,
    caught: (problem) => {
      state.clientFails = problem
      return prunePendingSubscribers(cron('/api/cron/prune-pending-subscribers'))
    },
    caughtAnswer: { status: 500, body: { error: 'Cron run failed' } },
    refusals: [
      ['cron auth refusal', () => prunePendingSubscribers(request('/api/cron/prune-pending-subscribers')), 401],
      ['database error', () => { db.failing = true; return prunePendingSubscribers(cron('/api/cron/prune-pending-subscribers')) }, 500],
    ],
  },
  {
    name: 'cron/prune-saved-jobs',
    label: 'saved jobs cleanup failed',
    area: 'cron',
    log: 'cron/prune-saved-jobs: fatal error',
    file: 'app/api/cron/prune-saved-jobs/route.ts',
    healthy: () => pruneSavedJobs(cron('/api/cron/prune-saved-jobs')),
    healthyStatus: 200,
    caught: (problem) => {
      state.failing.set('pruneInactive', problem)
      return pruneSavedJobs(cron('/api/cron/prune-saved-jobs'))
    },
    caughtAnswer: { status: 500, body: { error: 'Cron run failed' } },
    refusals: [['cron auth refusal', () => pruneSavedJobs(request('/api/cron/prune-saved-jobs')), 401]],
  },
  {
    name: 'ingest/[slug]',
    label: 'job import run failed',
    area: 'ingest',
    log: '[ingest/example] Fatal error:',
    file: 'app/api/ingest/[slug]/route.ts',
    seed: () => { db.tables.job_providers = [{ ...provider }] },
    healthy: () => ingest(cron('/api/ingest/example', 'POST'), { params: { slug: 'example' } }),
    healthyStatus: 200,
    caught: (problem) => {
      state.failing.set('getAdapter', problem)
      return ingest(cron('/api/ingest/example', 'POST'), { params: { slug: 'example' } })
    },
    caughtAnswer: { status: 500, body: { ok: false, error: 'Import failed (Error)', durationMs: 0 } },
    refusals: [
      ['cron auth refusal', () => ingest(request('/api/ingest/example', { method: 'POST' }), { params: { slug: 'example' } }), 401],
      ['no row', () => ingest(cron('/api/ingest/unknown', 'POST'), { params: { slug: 'unknown' } }), 404],
      [
        'provider inactive',
        () => {
          db.tables.job_providers = [{ ...provider, status: 'paused' }]
          return ingest(cron('/api/ingest/example', 'POST'), { params: { slug: 'example' } })
        },
        200,
      ],
    ],
  },
  {
    name: 'jobs/click/[id]',
    label: 'job click failed',
    area: 'public',
    log: 'api/jobs/click error (non-fatal):',
    file: 'app/api/jobs/click/[id]/route.ts',
    healthy: () => jobClick(request(`/api/jobs/click/${JOB_ID}`, { method: 'POST' }), { params: Promise.resolve({ id: JOB_ID }) }),
    healthyStatus: 200,
    caught: (problem) => jobClick(request(`/api/jobs/click/${JOB_ID}`, { method: 'POST' }), { params: Promise.reject(problem) }),
    caughtAnswer: { status: 200, body: { success: true } },
    refusals: [['database error', () => { db.failing = true; return jobClick(request(`/api/jobs/click/${JOB_ID}`, { method: 'POST' }), { params: Promise.resolve({ id: JOB_ID }) }) }, 200]],
  },
  {
    name: 'jobs/direct',
    label: 'job listings load failed',
    area: 'public',
    log: 'api/jobs/direct error:',
    file: 'app/api/jobs/direct/route.ts',
    healthy: () => directJobs(request('/api/jobs/direct?count=true')),
    healthyStatus: 200,
    caught: (problem) => {
      state.failing.set('getCachedListingJobs', problem)
      state.failing.set('getCachedListingJobsCount', problem)
      return directJobs(request('/api/jobs/direct?platform=ab'))
    },
    caughtAnswer: { status: 503, body: { error: 'Could not load jobs right now.' }, headers: { 'cache-control': 'no-store, no-cache, must-revalidate' } },
    refusals: [],
  },
  {
    name: 'jobs/employer/checkout',
    label: 'employer checkout failed',
    area: 'public',
    log: 'jobs/employer/checkout error:',
    file: 'app/api/jobs/employer/checkout/route.ts',
    healthy: () => checkout(request('/api/jobs/employer/checkout', { method: 'POST', body: JSON.stringify(jobPost) })),
    healthyStatus: 200,
    caught: (problem) => checkout(unreadable(request('/api/jobs/employer/checkout', { method: 'POST', body: '{}' }), problem)),
    caughtAnswer: { status: 500, body: { error: 'Could not start checkout. Please try again.' } },
    refusals: [
      ['validation', () => checkout(request('/api/jobs/employer/checkout', { method: 'POST', body: JSON.stringify({ title: 'x' }) })), 400],
      [
        'duplicate listing',
        () => {
          state.failing.set('createJob', { code: '23505', message: 'duplicate key value' })
          return checkout(request('/api/jobs/employer/checkout', { method: 'POST', body: JSON.stringify(jobPost) }))
        },
        409,
      ],
      [
        'not configured',
        () => {
          vi.stubEnv('LEMONSQUEEZY_API_KEY', '')
          return checkout(request('/api/jobs/employer/checkout', { method: 'POST', body: JSON.stringify(jobPost) }))
        },
        500,
      ],
    ],
  },
  {
    name: 'jobs/employer/webhook',
    label: 'payment notice failed',
    area: 'public',
    log: 'jobs/employer/webhook processing error:',
    file: 'app/api/jobs/employer/webhook/route.ts',
    healthy: async () => webhook(await signed('{"meta":{}}', 'subscription_created')),
    healthyStatus: 200,
    caught: async () => webhook(await signed('not readable', 'order_created')),
    caughtAnswer: { status: 200, body: { received: true } },
    refusals: [
      ['missing signature', () => webhook(request('/api/jobs/employer/webhook', { method: 'POST', body: '{}' })), 400],
      ['signature refusal', () => webhook(request('/api/jobs/employer/webhook', { method: 'POST', body: '{}', headers: { 'X-Signature': 'bad' } })), 400],
      ['unpaid order', async () => webhook(await signed('{"data":{"attributes":{"status":"pending"}}}', 'order_created')), 200],
    ],
  },
  {
    name: 'jobs/manage GET',
    label: 'job manage link failed',
    area: 'public',
    log: 'jobs/manage GET error:',
    file: 'app/api/jobs/manage/route.ts',
    seed: () => { db.tables.jobs = [{ ...job }] },
    healthy: () => manageGet(request(`/api/jobs/manage?token=${MANAGE_TOKEN}`)),
    healthyStatus: 200,
    caught: (problem) => {
      state.failing.set('getJobByManageToken', problem)
      return manageGet(request(`/api/jobs/manage?token=${MANAGE_TOKEN}`))
    },
    caughtAnswer: { status: 500, body: { error: 'Internal server error' } },
    refusals: [
      ['validation', () => manageGet(request('/api/jobs/manage')), 400],
      ['no row', () => manageGet(request('/api/jobs/manage?token=unknown')), 404],
    ],
  },
  {
    name: 'jobs/manage POST',
    label: 'job withdraw failed',
    area: 'public',
    log: 'jobs/manage POST error:',
    file: 'app/api/jobs/manage/route.ts',
    seed: () => { db.tables.jobs = [{ ...job }] },
    healthy: () => managePost(request('/api/jobs/manage', { method: 'POST', body: JSON.stringify({ token: MANAGE_TOKEN, action: 'close' }) })),
    healthyStatus: 200,
    caught: (problem) => managePost(unreadable(request('/api/jobs/manage', { method: 'POST', body: '{}' }), problem)),
    caughtAnswer: { status: 500, body: { error: 'Internal server error' } },
    refusals: [
      ['validation', () => managePost(request('/api/jobs/manage', { method: 'POST', body: JSON.stringify({ action: 'close' }) })), 400],
      ['unknown action', () => managePost(request('/api/jobs/manage', { method: 'POST', body: JSON.stringify({ token: MANAGE_TOKEN, action: 'x' }) })), 400],
      ['no row', () => managePost(request('/api/jobs/manage', { method: 'POST', body: JSON.stringify({ token: 'unknown', action: 'close' }) })), 404],
    ],
  },
  {
    name: 'saved-jobs GET',
    label: 'saved jobs load failed',
    area: 'public',
    log: 'api/saved-jobs GET error:',
    file: 'app/api/saved-jobs/route.ts',
    healthy: () => savedGet(withVisitor('/api/saved-jobs', 'GET')),
    healthyStatus: 200,
    caught: (problem) => {
      state.failing.set('listSaved', problem)
      return savedGet(withVisitor('/api/saved-jobs', 'GET'))
    },
    caughtAnswer: { status: 500, body: { error: 'server_error' }, headers: NO_STORE },
    refusals: [['no visitor', () => savedGet(request('/api/saved-jobs')), 200]],
  },
  {
    name: 'saved-jobs POST',
    label: 'saved job save failed',
    area: 'public',
    log: 'api/saved-jobs POST error:',
    file: 'app/api/saved-jobs/route.ts',
    seed: () => { db.tables.jobs = [{ ...job }] },
    healthy: () => savedPost(withVisitor('/api/saved-jobs', 'POST', { jobId: JOB_ID })),
    healthyStatus: 200,
    caught: (problem) => {
      state.failing.set('findSavableJob', problem)
      return savedPost(withVisitor('/api/saved-jobs', 'POST', { jobId: JOB_ID }))
    },
    caughtAnswer: { status: 500, body: { error: 'server_error' }, headers: NO_STORE },
    refusals: [
      ['validation', () => savedPost(withVisitor('/api/saved-jobs', 'POST', { jobId: 'x' })), 400],
      ['no row', () => { db.tables.jobs = []; return savedPost(withVisitor('/api/saved-jobs', 'POST', { jobId: JOB_ID })) }, 404],
    ],
  },
  {
    name: 'saved-jobs DELETE',
    label: 'saved job remove failed',
    area: 'public',
    log: 'api/saved-jobs DELETE error:',
    file: 'app/api/saved-jobs/route.ts',
    healthy: () => savedDelete(withVisitor('/api/saved-jobs', 'DELETE', { jobId: JOB_ID })),
    healthyStatus: 200,
    caught: (problem) => {
      state.failing.set('deleteSaved', problem)
      return savedDelete(withVisitor('/api/saved-jobs', 'DELETE', { jobId: JOB_ID }))
    },
    caughtAnswer: { status: 500, body: { error: 'server_error' }, headers: NO_STORE },
    refusals: [
      ['validation', () => savedDelete(withVisitor('/api/saved-jobs', 'DELETE', {})), 400],
      ['no visitor', () => savedDelete(request('/api/saved-jobs', { method: 'DELETE', body: JSON.stringify({ jobId: JOB_ID }) })), 200],
    ],
  },
  {
    name: 'saved-jobs/import',
    label: 'saved jobs import failed',
    area: 'public',
    log: 'api/saved-jobs/import POST error:',
    file: 'app/api/saved-jobs/import/route.ts',
    healthy: () => savedImport(withVisitor('/api/saved-jobs/import', 'POST', { jobIds: [] })),
    healthyStatus: 200,
    caught: (problem) => {
      state.failing.set('insertManySaved', problem)
      return savedImport(withVisitor('/api/saved-jobs/import', 'POST', { jobIds: [JOB_ID] }))
    },
    caughtAnswer: { status: 500, body: { error: 'server_error' }, headers: NO_STORE },
    refusals: [['validation', () => savedImport(withVisitor('/api/saved-jobs/import', 'POST', { jobIds: 'x' })), 400]],
  },
]

const recorded = (...args: unknown[]) => {
  state.order.push(`console ${String(args[0])}`)
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-key')
  vi.stubEnv('TURNSTILE_SECRET_KEY_AB', 'test-key')
  vi.stubEnv('JWT_SECRET', 'jwt-test-value-0123456789abcdef')
  vi.stubEnv('CRON_SECRET', CRON_TEST_VALUE)
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE)
  vi.stubEnv('LEMONSQUEEZY_API_KEY', 'test-key')
  vi.stubEnv('LEMONSQUEEZY_STORE_ID', '1')
  vi.stubEnv('LEMONSQUEEZY_VARIANT_ID_GBP', '2')
  vi.stubEnv('LEMONSQUEEZY_VARIANT_ID_USD', '3')
  vi.stubEnv('LEMONSQUEEZY_WEBHOOK_SECRET', WEBHOOK_TEST_VALUE)
  for (const level of ['error', 'warn', 'log', 'info'] as const) vi.spyOn(console, level).mockImplementation(recorded)
  state.reports.length = 0
  state.order.length = 0
  state.sentry.length = 0
  state.emails.length = 0
  state.clientFails = null
  state.failing.clear()
  state.hanging.clear()
  state.due = null
  state.personOk = true
  db.tables = {}
  db.failing = false
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const reportsFor = (label: string) => state.reports.filter((args) => args[0] === label)

describe.each(ROUTES)('$name', (route) => {
  it('reports an unexpected problem with its route label', async () => {
    route.seed?.()
    const problem = new Error('unexpected problem')
    await route.caught(problem)
    const reports = reportsFor(route.label)
    expect(reports).toHaveLength(1)
    expect(reports[0][0]).toBe(route.label)
    expect(reports[0][2]).toStrictEqual({ area: route.area })
    expect(reports[0]).toHaveLength(3)
    expect(state.reports).toHaveLength(1)
    expect(state.sentry).toStrictEqual([])
  })

  it('reports the very problem it caught', async () => {
    route.seed?.()
    const problem = new Error('unexpected problem')
    await route.caught(problem)
    if (route.name === 'jobs/employer/webhook') expect(reportsFor(route.label)[0][1]).toBeInstanceOf(SyntaxError)
    else expect(reportsFor(route.label)[0][1]).toBe(problem)
  })

  it('keeps the answer unchanged when reporting', async () => {
    route.seed?.()
    const result = await answerOf(await route.caught(new Error('unexpected problem')))
    expect(result.status).toBe(route.caughtAnswer.status)
    expect(result.body).toStrictEqual(route.caughtAnswer.body)
    for (const [key, value] of Object.entries(route.caughtAnswer.headers ?? {})) expect(result.headers[key]).toBe(value)
  })

  it('reports after the route log line', async () => {
    route.seed?.()
    await route.caught(new Error('unexpected problem'))
    const at = state.order.indexOf(`report ${route.label}`)
    expect(at).toBeGreaterThan(-1)
    expect(state.order.slice(0, at)).toContain(`console ${route.log}`)
    expect(state.order.indexOf(`console ${route.log}`)).toBeLessThan(at)
  })

  it('makes no report for a healthy request', async () => {
    route.seed?.()
    const result = await route.healthy()
    expect(result.status).toBe(route.healthyStatus)
    expect(state.reports).toStrictEqual([])
    expect(state.sentry).toStrictEqual([])
  })

  if (route.refusals.length > 0) {
    it.each(route.refusals)('makes no report for an expected outcome: %s', async (_name, run, status) => {
      route.seed?.()
      const result = await run()
      expect(result.status).toBe(status)
      expect(reportsFor(route.label)).toStrictEqual([])
      expect(state.sentry).toStrictEqual([])
    })
  }
})

describe('orchestrator', () => {
  const run = (req = cron('/api/ingest/orchestrator')) => orchestrator(req)
  const due = (...slugs: string[]) => {
    state.due = slugs.map((slug, i) => ({ ...provider, id: `provider-${i}`, slug }))
  }

  it('makes no report when nothing is due', async () => {
    const result = await answerOf(await run())
    expect(result.status).toBe(200)
    expect(result.body).toStrictEqual({ ok: true, dispatched: [], reaped: 0, message: 'No providers due' })
    expect(state.reports).toStrictEqual([])
  })

  it('makes no report for a cron auth refusal', async () => {
    expect((await run(request('/api/ingest/orchestrator'))).status).toBe(401)
    expect(state.reports).toStrictEqual([])
  })

  it('reports a stale run clean-up problem and carries on', async () => {
    const problem = new Error('unexpected problem')
    state.failing.set('reapStaleRuns', problem)
    const result = await answerOf(await run())
    expect(result.status).toBe(200)
    expect(result.body).toStrictEqual({ ok: true, dispatched: [], reaped: 0, message: 'No providers due' })
    expect(state.reports).toStrictEqual([['job import stale run cleanup failed', problem, { area: 'ingest' }]])
    expect(state.order).toStrictEqual(['console [orchestrator] reaper failed:', 'report job import stale run cleanup failed'])
  })

  it('reports a due check problem with its route label', async () => {
    const problem = new Error('unexpected problem')
    state.failing.set('getProvidersDueForFetch', problem)
    const result = await answerOf(await run())
    expect(result.status).toBe(500)
    expect(result.body).toStrictEqual({ ok: false, error: 'Failed to determine due providers', reaped: 0 })
    expect(state.reports).toStrictEqual([['job import due check failed', problem, { area: 'ingest' }]])
    expect(state.order).toStrictEqual(['console [orchestrator] getProvidersDueForFetch failed:', 'report job import due check failed'])
  })

  it('reports once with a fixed problem when every dispatched import fails', async () => {
    due('first-provider', 'second-provider')
    const result = await answerOf(await run())
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ ok: true, dispatched: ['first-provider'], count: 1 })
    expect(state.reports).toHaveLength(1)
    const [label, problem, extra] = state.reports[0] as [string, Error, unknown]
    expect(label).toBe('job import dispatch failed')
    expect(problem).toBeInstanceOf(Error)
    expect(problem.name).toBe('Error')
    expect(problem.message).toBe('every dispatched import failed')
    expect(extra).toStrictEqual({ area: 'ingest' })
    expect(Object.keys(problem)).toStrictEqual([])
  })

  it('keeps provider names and error text out of the report', async () => {
    due('seed-provider-x1')
    db.tables.job_providers = [{ ...provider, slug: 'seed-provider-x1' }]
    state.failing.set('getAdapter', new Error('seed-sub-error-4k'))
    await run()
    const dispatchReports = state.reports.filter(([label]) => label === 'job import dispatch failed')
    expect(dispatchReports).toHaveLength(1)
    const text = JSON.stringify(dispatchReports, (_key, value: unknown) => (value instanceof Error ? { name: value.name, message: value.message } : value))
    expect(text).not.toContain('seed-provider-x1')
    expect(text).not.toContain('seed-sub-error-4k')
  })

  it('makes no report when one dispatched import works', async () => {
    due('first-provider', 'second-provider')
    // Only the first due provider runs on a tick. It has a row, so its
    // import works; the second stays due.
    db.tables.job_providers = [{ ...provider, slug: 'first-provider' }]
    const result = await answerOf(await run())
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      summary: [
        { slug: 'first-provider', result: { status: 200, ok: true } },
      ],
    })
    expect(state.reports).toStrictEqual([])
  })
})

describe('search', () => {
  const run = (q: string) => search(request(`/api/search?q=${encodeURIComponent(q)}`))

  it('makes no report for a healthy search', async () => {
    const result = await answerOf(await run('management accountant'))
    expect(result.status).toBe(200)
    expect(state.reports).toStrictEqual([])
  })

  it('reports a job lookup problem and still answers with content results', async () => {
    const problem = new Error('unexpected problem')
    state.failing.set('getActiveDirectJobs', problem)
    const result = await answerOf(await run('management accountant'))
    expect(result.status).toBe(200)
    expect(result.body).toStrictEqual({ results: [], jobs: [], jobsTotal: 0, jobsSearchQuery: null })
    expect(state.reports).toStrictEqual([['search job lookup failed', problem, { area: 'public' }]])
    expect(state.order).toStrictEqual(['console [search] job query failed:', 'report search job lookup failed'])
  })

  it('keeps search words out of problem reports', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    state.hanging.add('getActiveDirectJobs')
    const pending = run('seed-search-7f3q')
    await vi.advanceTimersByTimeAsync(2_500)
    const result = await answerOf(await pending)
    expect(result.status).toBe(200)
    expect(result.body).toStrictEqual({ results: [], jobs: [], jobsTotal: 0, jobsSearchQuery: null })
    expect(state.reports).toHaveLength(1)
    const [label, problem, extra] = state.reports[0] as [string, Error, unknown]
    expect(label).toBe('search job lookup timed out')
    expect(problem.message).toBe('job lookup took too long')
    expect(extra).toStrictEqual({ area: 'public', code: 'ab' })
    expect(JSON.stringify([label, problem.message, extra])).not.toContain('seed-search')
  })

  it('names the site in a timed-out lookup report', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    state.hanging.add('getActiveDirectJobs')
    const pending = search(request('/api/search?q=audit', { headers: { 'x-et-platform': 'ethiotax' } }))
    await vi.advanceTimersByTimeAsync(2_500)
    await pending
    expect(state.reports.map((args) => args[2])).toStrictEqual([{ area: 'public', code: 'et' }])
  })

  it('makes no report for a rate-limited or too-short search', async () => {
    expect((await run('a')).status).toBe(200)
    const req = () => search(request('/api/search?q=audit', { headers: { 'x-forwarded-for': '198.51.100.9' } }))
    for (let i = 0; i < 30; i++) await req()
    state.reports.length = 0
    expect((await req()).status).toBe(429)
    expect(state.reports).toStrictEqual([])
  })
})

describe('subscribe person check', () => {
  const run = (body: Record<string, unknown>) => subscribe(request('/api/subscribe', { method: 'POST', body: JSON.stringify(body) }))
  const refused = () => reportsFor('subscribe person check refused')

  it('reports a refused person check with its reason only', async () => {
    state.personOk = false
    const result = await answerOf(await run({ email: 'seed-person@example.com', 'cf-turnstile-response': 'token' }))
    expect(result.status).toBe(400)
    expect(refused()).toHaveLength(1)
    const [label, problem, extra] = refused()[0] as [string, Error, unknown]
    expect(label).toBe('subscribe person check refused')
    expect(problem.message).toBe('person check refused')
    expect(extra).toStrictEqual({ area: 'public', code: 'invalid_token' })
  })

  it('reports a missing person check token', async () => {
    const result = await answerOf(await run({ email: 'seed-person@example.com' }))
    expect(result.status).toBe(400)
    expect(refused().map((args) => args[2])).toStrictEqual([{ area: 'public', code: 'missing_token' }])
  })

  it('reports an unreachable person check', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
    vi.stubEnv('TURNSTILE_SECRET_KEY_AB', '')
    const result = await answerOf(await run({ email: 'seed-person@example.com', 'cf-turnstile-response': 'token' }))
    expect(result.status).toBe(503)
    expect(refused().map((args) => args[2])).toStrictEqual([{ area: 'public', code: 'unreachable' }])
  })

  it('makes no person check report when the check passes', async () => {
    await run({ email: 'ada@example.com', 'cf-turnstile-response': 'token' })
    expect(refused()).toStrictEqual([])
  })
})

describe('job route reporting', () => {
  it('uses a different label for every handler', () => {
    const labels = ROUTES.map((route) => route.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  const SOURCES: [string, number][] = [
    ['app/api/cron/expire-jobs/route.ts', 1],
    ['app/api/cron/prune-pending-subscribers/route.ts', 1],
    ['app/api/cron/prune-saved-jobs/route.ts', 1],
    ['lib/ingestion/run-provider-import.ts', 3],
    ['app/api/ingest/orchestrator/route.ts', 3],
    ['app/api/jobs/click/[id]/route.ts', 1],
    ['app/api/jobs/direct/route.ts', 1],
    ['app/api/jobs/employer/checkout/route.ts', 1],
    ['app/api/jobs/employer/webhook/route.ts', 1],
    ['app/api/jobs/manage/route.ts', 2],
    ['app/api/saved-jobs/route.ts', 3],
    ['app/api/saved-jobs/import/route.ts', 1],
    ['app/api/search/route.ts', 2],
  ]

  it.each(SOURCES)('%s reports with fixed labels, its area and fixed words only', (file, count) => {
    const source = readFileSync(join(process.cwd(), file), 'utf8')
    const calls = source.match(/reportServerError\(.*\)$/gm) ?? []
    expect(calls).toHaveLength(count)
    for (const call of calls) {
      expect(call).toMatch(
        /^reportServerError\('[a-z ]+', (err|reapErr|new Error\('[a-z ]+'\)), \{ area: '(cron|ingest|public)'(, code: platform)? \}\)$/,
      )
    }
    expect(source).not.toContain('@sentry/nextjs')
  })

  it('subscribe reports a refused person check with fixed words only', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/subscribe/route.ts'), 'utf8')
    expect(source).toContain(
      'reportServerError("subscribe person check refused", new Error("person check refused"), { area: "public", code: reason })',
    )
    expect(source).not.toContain('@sentry/nextjs')
  })

  it('each route file reports with the area of its kind', () => {
    for (const [file] of SOURCES) {
      const source = readFileSync(join(process.cwd(), file), 'utf8')
      const areas = Array.from(source.matchAll(/area: '(\w+)'/g), (match) => match[1])
      const expected = file.includes('/cron/') ? 'cron' : /\/ingest(ion)?\//.test(file) ? 'ingest' : 'public'
      expect(new Set(areas)).toStrictEqual(new Set([expected]))
    }
  })
})
