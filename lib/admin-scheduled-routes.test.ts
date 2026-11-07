import { join } from 'node:path'
import { NextRequest } from 'next/server'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_ADMIN_PATH, TEST_ADMIN_SECRET, TEST_SESSION_SECRET, signTestSession } from './admin-session-fixtures'
import { ADMIN_SESSION_COOKIE, getAdminPath } from './middleware-logic'
import { DB_LIMITS_MS, type DbContext } from './supabase-server'

// Admin pages and APIs, the scheduled routes and the provider import route,
// run with real supabase-js clients from the factory. Only the network is
// fake: the database answers through the global `fetch`, emails are recorded
// instead of sent, and the provider adapter returns one fixed job. Time is
// fake, so a database that never answers can be followed to the end of each
// time limit.

const sent = vi.hoisted(() => [] as { to: unknown; subject: unknown }[])
const revalidated = vi.hoisted(() => [] as string[])
const jar = vi.hoisted(() => ({ token: undefined as string | undefined }))

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
  unstable_noStore: () => {},
  revalidateTag: (tag: string) => {
    revalidated.push(tag)
  },
  revalidatePath: () => {},
}))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === 'admin_token' && jar.token ? { name, value: jar.token } : undefined),
  }),
  headers: async () => new Headers(),
}))
vi.mock('@/lib/adapters', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/adapters')>()),
  getAdapter: () => ({
    fetch: async () => ({
      jobs: [
        {
          title: 'Management Accountant',
          company: 'Example Ltd',
          url: 'https://jobs.example.com/1',
          description: 'Prepare monthly management accounts, budgets and variance analysis for the finance team.',
          location: 'London, UK',
        },
      ],
      pagesFetched: 1,
      totalAvailable: 1,
    }),
  }),
}))

// The folder comes from the app's own default, so its name is not repeated here.
vi.stubEnv('ADMIN_PATH', undefined)
const ADMIN = getAdminPath()
vi.unstubAllEnvs()

type Handler = (req: NextRequest, context: { params: unknown }) => Promise<Response>
type Module = Record<string, Handler> & { default?: (props: unknown) => Promise<unknown> }

const load = (path: string): Promise<Module> => import(/* @vite-ignore */ join(process.cwd(), path))
const api = (path: string) => load(`app/api/${ADMIN}/${path}`)
const page = (path: string) => load(`app/${ADMIN}/${path}`)

const DB_URL = 'https://example.supabase.co'
const SITE = 'https://accountingbody.com'
const ID = '0f8fad5b-d9cb-469f-a165-70867728950e'
const CRON_TEST_VALUE = 'cron-test-value'

type Row = Record<string, unknown>
type Call = { method: string; table: string }
type Stall = 'none' | 'all' | ((call: Call) => boolean)

const network = { stall: 'none' as Stall, rows: {} as Record<string, Row[]>, calls: [] as Call[] }

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...extra } })
}

const fakeFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.origin !== DB_URL) throw new Error(`unexpected request to ${url.href}`)
  const method = (init?.method ?? 'GET').toUpperCase()
  const call = { method, table: url.pathname.replace('/rest/v1/', '') }
  network.calls.push(call)

  const stall = network.stall
  if (stall === 'all' || (typeof stall === 'function' && stall(call))) {
    // Never answers, but stops when its signal aborts (like Node's fetch).
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
    })
  }

  const headers = new Headers(init?.headers)
  const prefer = headers.get('prefer') ?? ''
  const counted: Record<string, string> = prefer.includes('count=') ? { 'content-range': '0-0/3' } : {}
  if (method === 'HEAD') return new Response(null, { status: 200, headers: counted })

  let rows = network.rows[call.table] ?? []
  if (method !== 'GET') {
    if (!prefer.includes('return=representation')) {
      return new Response(null, { status: method === 'POST' ? 201 : 204, headers: counted })
    }
    // A write that returns rows answers with what was written, plus an id.
    const written: unknown = init?.body ? JSON.parse(String(init.body)) : {}
    rows = (Array.isArray(written) ? written : [written]).map((row) => ({ id: ID, ...(row as Row) }))
  }
  if ((headers.get('accept') ?? '').includes('vnd.pgrst.object')) {
    if (rows.length !== 1) {
      return json({ code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'no rows' }, 406)
    }
    return json(rows[0], method === 'POST' ? 201 : 200, counted)
  }
  return json(rows, method === 'POST' ? 201 : 200, counted)
}

// Captured before any test fakes the timers.
const realSetTimeout = globalThis.setTimeout

type Answer = {
  status: number | 'page' | 'thrown'
  body: unknown
  emails: number
  dbRequests: number
  revalidated: string[]
  elapsed: number
}

// A page's answer is its element tree: each element's type and props, with
// components and icons by name.
function simplify(value: unknown, parents: unknown[] = []): unknown {
  if (typeof value === 'function') return `<${(value as { name?: string }).name || 'component'}>`
  if (typeof value === 'symbol') return String(value)
  if (value === null || typeof value !== 'object') return value
  if (parents.includes(value)) return '<repeat>'
  const inner = [...parents, value]
  if (Array.isArray(value)) return value.map((item) => simplify(item, inner))
  const record = value as Record<string, unknown>
  if ('$$typeof' in record && 'props' in record) {
    const type = record.type as { name?: string; displayName?: string } | string
    const name = typeof type === 'string' ? type : (type?.displayName ?? type?.name ?? String(record.$$typeof))
    return { type: name, key: record.key, props: simplify(record.props, inner) }
  }
  if ('$$typeof' in record) return `<${(record.displayName as string) ?? String(record.$$typeof)}>`
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, simplify(item, inner)]))
}

function tree(element: unknown): string {
  return JSON.stringify(simplify(element))
}

// Runs a route or page to its answer. Real work (request parsing, session
// signatures) is given real time to finish; fake time then jumps straight to
// the next pending timer, so `elapsed` is exactly the time spent waiting on
// timers, in fake milliseconds.
async function answer(call: () => Promise<unknown>): Promise<Answer> {
  const start = Date.now()
  let value: unknown
  let failure: unknown
  let failed = false
  let done = false
  call().then(
    (result) => {
      value = result
      done = true
    },
    (error: unknown) => {
      failure = error
      failed = true
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
    if (Date.now() - start > 600_000) throw new Error('route did not answer')
    await vi.advanceTimersToNextTimerAsync()
  }
  const elapsed = Date.now() - start
  const common = { emails: sent.length, dbRequests: network.calls.length, revalidated: [...revalidated], elapsed }
  if (failed) {
    const error = failure as { digest?: string; message?: string }
    return { status: 'thrown', body: error?.digest ?? error?.message ?? String(failure), ...common }
  }
  if (!(value instanceof Response)) return { status: 'page', body: tree(value), ...common }
  const text = await value.text()
  const body = text && (value.headers.get('content-type') ?? '').includes('json') ? JSON.parse(text) : text
  return { status: value.status, body, ...common }
}

let session = ''

const request = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(SITE + path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json', cookie: `${ADMIN_SESSION_COOKIE}=${session}`, ...headers },
  })
const adminPath = (path: string) => `/api/${TEST_ADMIN_PATH}/${path}`
const cron = (path: string, secret = CRON_TEST_VALUE) =>
  new NextRequest(SITE + path, { method: path.startsWith('/api/ingest') ? 'POST' : 'GET', headers: { authorization: `Bearer ${secret}` } })

const writes = (call: Call) => call.method !== 'GET' && call.method !== 'HEAD'
const except = (table: string) => (call: Call) => call.table !== table

const job = {
  id: ID,
  title: 'Management Accountant',
  slug: 'management-accountant',
  company_name: 'Example Ltd',
  status: 'active',
  is_featured: false,
  manage_token: 'manage',
}
const provider = {
  id: ID,
  slug: 'example',
  name: 'Example Jobs',
  status: 'active',
  adapter_key: 'generic-rest',
  base_url: 'https://jobs.example.com',
  rate_limit_daily: null,
  requests_today: 0,
  enforce_relevance: false,
  platform_tags: ['ab'],
  country_codes: ['gb'],
  regions: [],
  keywords: [],
  source_name: null,
  source_score: 0.5,
  fetch_interval_minutes: 1440,
  field_mapping: {
    title: 'title',
    company_name: 'company',
    application_url: 'url',
    description: 'description',
    location_text: 'location',
  },
}
const run = { id: ID, provider_slug: 'example', status: 'completed', started_at: '2026-05-31T09:00:00Z' }

type Expected = Partial<Omit<Answer, 'elapsed'>>

type Scenario = {
  name: string
  context: DbContext
  rows?: Record<string, Row[]>
  call: () => Promise<unknown>
  healthy: Expected
  // What the route or page answers when the database does not answer (all
  // requests, or only the ones `stall` picks), and how many database
  // requests it waits for one after another before answering.
  stalled: Expected & { waits: number; stall?: Stall }
}

const TIMEOUT = (ms: number) => `TimeoutError: db: request time limit reached (${ms} ms)`

// The provider import of the adapter's one job.
const importedSlug = 'management-accountant-example-ltd-i'
const imported = {
  ok: true,
  provider: 'example',
  fetched: 1,
  deduplicated: 0,
  rejected: 0,
  pagesFetched: 1,
  totalAvailable: 1,
}

const scenarios: Scenario[] = [
  {
    name: 'job notes update',
    context: 'admin',
    rows: { jobs: [job] },
    call: async () =>
      (await api('jobs/[id]/route.ts')).PATCH(
        request('PATCH', adminPath(`jobs/${ID}`), { action: 'update_notes', admin_notes: 'Checked' }),
        { params: Promise.resolve({ id: ID }) },
      ),
    healthy: { status: 200, body: { job: { id: ID, admin_notes: 'Checked' } }, dbRequests: 2 },
    stalled: { stall: writes, waits: 1, status: 500, body: { error: 'Internal server error' }, dbRequests: 2 },
  },
  {
    name: 'job close',
    context: 'admin',
    rows: { jobs: [job] },
    call: async () =>
      (await api('jobs/[id]/route.ts')).DELETE(request('DELETE', adminPath(`jobs/${ID}`)), {
        params: Promise.resolve({ id: ID }),
      }),
    healthy: { status: 200, body: { success: true }, dbRequests: 2 },
    stalled: { stall: writes, waits: 1, status: 500, body: { error: TIMEOUT(20_000) }, dbRequests: 2 },
  },
  {
    name: 'provider detail',
    context: 'admin',
    rows: { job_providers: [provider], provider_runs: [run], provider_errors: [] },
    call: async () =>
      (await api('providers/[slug]/route.ts')).GET(request('GET', adminPath('providers/example')), {
        params: { slug: 'example' },
      }),
    healthy: { status: 200, body: { provider, runs: [run], errors: [], active_job_count: 3 }, dbRequests: 4 },
    stalled: {
      stall: except('job_providers'),
      waits: 3,
      status: 200,
      body: { provider, runs: [], errors: [], active_job_count: 0 },
      dbRequests: 4,
    },
  },
  {
    name: 'provider detail with no answer at all',
    context: 'admin',
    rows: { job_providers: [provider] },
    call: async () =>
      (await api('providers/[slug]/route.ts')).GET(request('GET', adminPath('providers/example')), {
        params: { slug: 'example' },
      }),
    healthy: { status: 200, body: { provider, runs: [], errors: [], active_job_count: 3 }, dbRequests: 4 },
    stalled: { waits: 1, status: 404, body: { error: 'Provider not found' }, dbRequests: 1 },
  },
  {
    name: 'course save',
    context: 'admin',
    call: async () =>
      (await api('course-factory/save/route.ts')).POST(
        request('POST', adminPath('course-factory/save'), {
          title: 'Course',
          slug: 'course',
          chapters: [{ chapterTitle: 'One', lessonRefs: [{ title: 'Lesson', articleIds: [ID] }] }],
        }),
        { params: {} },
      ),
    healthy: { status: 200, body: { success: true, id: ID }, dbRequests: 6 },
    // The first read gets no answer, so nothing is written.
    stalled: {
      waits: 1,
      status: 500,
      body: { error: 'Could not read the current course. Nothing was changed.' },
      dbRequests: 1,
    },
  },
  {
    name: 'question set publish',
    context: 'admin',
    call: async () =>
      (await api('questions/publish/route.ts')).POST(
        request('POST', adminPath('questions/publish'), {
          bundle: { title: 'Set', questions: [{ questionText: 'Q', options: ['a', 'b', 'c', 'd'], correctIndex: 0 }] },
        }),
        { params: {} },
      ),
    healthy: {
      status: 200,
      body: { success: true, documentId: ID, contentId: 'AB-QZ-00001', title: 'Set', slug: 'set', questionCount: 1 },
      dbRequests: 3,
    },
    stalled: {
      waits: 1,
      status: 500,
      body: { error: 'Could not assign a content ID. Nothing was published.' },
      dbRequests: 1,
    },
  },
  {
    name: 'article publish',
    context: 'admin',
    call: async () =>
      (await api('articles/publish/route.ts')).POST(
        request('POST', adminPath('articles/publish'), { article: { title: 'Title', content: 'Body', slug: 'title' } }),
        { params: {} },
      ),
    healthy: {
      status: 200,
      body: { success: true, documentId: ID, contentId: 'AB-ART-00001', title: 'Title', slug: 'title' },
      dbRequests: 2,
      revalidated: ['article:title'],
    },
    stalled: {
      waits: 1,
      status: 500,
      body: { error: 'Could not assign a content ID. Nothing was published.' },
      dbRequests: 1,
      revalidated: [],
    },
  },
  {
    name: 'candidate approval email',
    context: 'admin',
    call: async () =>
      (await api('notify-candidate/route.ts')).POST(
        request('POST', adminPath('notify-candidate'), {
          id: ID,
          status: 'active',
          email: 'ada@example.com',
          name: 'Ada Lovelace',
          platform: 'ab',
        }),
        { params: {} },
      ),
    healthy: { status: 200, body: { success: true }, emails: 1, dbRequests: 1 },
    stalled: {
      waits: 1,
      status: 500,
      body: { error: 'Failed to save candidate token — email not sent', detail: TIMEOUT(20_000) },
      emails: 0,
      dbRequests: 1,
    },
  },
  {
    name: 'relevance sweep',
    context: 'admin',
    rows: { jobs: [{ ...job, title: 'Gardener', description: 'Looking after the grounds and the plants every day.' }] },
    call: async () =>
      (await api('jobs/reevaluate-relevance/route.ts')).POST(
        request('POST', adminPath('jobs/reevaluate-relevance'), { dry_run: false }),
        { params: {} },
      ),
    healthy: {
      status: 200,
      body: {
        ok: true,
        dry_run: false,
        offset: 0,
        limit: 500,
        examined: 1,
        irrelevant: 1,
        updated: 1,
        sample: [{ id: ID, title: 'Gardener', company_name: 'Example Ltd' }],
      },
      dbRequests: 3,
    },
    stalled: { waits: 1, status: 500, body: { ok: false, error: TIMEOUT(20_000) }, dbRequests: 1 },
  },
  {
    name: 'relevance sweep with updates that get no answer',
    context: 'admin',
    rows: { jobs: [{ ...job, title: 'Gardener', description: 'Looking after the grounds and the plants every day.' }] },
    call: async () =>
      (await api('jobs/reevaluate-relevance/route.ts')).POST(
        request('POST', adminPath('jobs/reevaluate-relevance'), { dry_run: false }),
        { params: {} },
      ),
    healthy: { status: 200, dbRequests: 3 },
    stalled: {
      stall: writes,
      waits: 1,
      status: 200,
      body: {
        ok: true,
        dry_run: false,
        offset: 0,
        limit: 500,
        examined: 1,
        irrelevant: 1,
        updated: 0,
        sample: [{ id: ID, title: 'Gardener', company_name: 'Example Ltd' }],
      },
      dbRequests: 3,
    },
  },
  {
    name: 'reference list',
    context: 'admin',
    rows: { studio_references: [{ id: ID, label: 'BBC', url: 'https://bbc.com', category: 'news', display_order: 1 }] },
    call: async () => (await api('studio/references/route.ts')).GET(request('GET', adminPath('studio/references')), { params: {} }),
    healthy: {
      status: 200,
      body: { references: [{ id: ID, label: 'BBC', url: 'https://bbc.com', category: 'news', display_order: 1 }] },
      dbRequests: 1,
    },
    stalled: { waits: 1, status: 500, body: { error: 'Failed to fetch references' }, dbRequests: 1 },
  },
  {
    name: 'reference add',
    context: 'admin',
    call: async () =>
      (await api('studio/references/route.ts')).POST(
        request('POST', adminPath('studio/references'), { label: 'BBC', url: 'https://bbc.com' }),
        { params: {} },
      ),
    healthy: {
      status: 200,
      body: { reference: { id: ID, label: 'BBC', url: 'https://bbc.com', category: 'news', display_order: 3 } },
      dbRequests: 2,
    },
    stalled: { waits: 1, status: 500, body: { error: 'Could not work out the next position. Nothing was added.' }, dbRequests: 1 },
  },
  {
    name: 'submission delete',
    context: 'admin',
    call: async () =>
      (await api('actions/route.ts')).POST(
        request('POST', adminPath('actions'), { action: 'delete', table: 'help_requests', id: ID }),
        { params: {} },
      ),
    healthy: { status: 200, body: { success: true }, dbRequests: 1 },
    stalled: { waits: 1, status: 500, body: { error: TIMEOUT(20_000) }, dbRequests: 1 },
  },
  {
    name: 'article delete',
    context: 'admin',
    call: async () =>
      (await api('articles/[articleId]/route.ts')).DELETE(request('DELETE', adminPath(`articles/${ID}`)), {
        params: Promise.resolve({ articleId: ID }),
      }),
    healthy: { status: 200, body: { success: true }, dbRequests: 1 },
    stalled: { waits: 1, status: 500, body: { error: TIMEOUT(20_000) }, dbRequests: 1 },
  },
  {
    name: 'pending subscriber clean-up',
    context: 'cron',
    call: async () => (await load('app/api/cron/prune-pending-subscribers/route.ts')).GET(cron('/api/cron/prune-pending-subscribers'), { params: {} }),
    healthy: { status: 200, body: { pruned: 3 }, dbRequests: 1 },
    stalled: { waits: 1, status: 500, body: { error: 'Prune failed' }, dbRequests: 1 },
  },
  {
    name: 'daily job expiry',
    context: 'cron',
    call: async () => (await load('app/api/cron/expire-jobs/route.ts')).GET(cron('/api/cron/expire-jobs'), { params: {} }),
    healthy: { status: 200, body: { expired: 0, warned: 0 }, dbRequests: 3 },
    stalled: { waits: 3, status: 200, body: { expired: 0, warned: 0 }, dbRequests: 3 },
  },
  {
    name: 'provider import',
    context: 'ingest',
    rows: { job_providers: [provider] },
    call: async () =>
      (await load('app/api/ingest/[slug]/route.ts')).POST(cron('/api/ingest/example'), { params: { slug: 'example' } }),
    healthy: { status: 200, body: { ...imported, inserted: 1, durationMs: 0 }, emails: 1, dbRequests: 11 },
    stalled: {
      // Only the job inserts get no answer: the batch insert, then the
      // one-by-one insert it falls back to.
      stall: (call) => call.table === 'jobs' && call.method === 'POST',
      waits: 2,
      status: 200,
      body: {
        ...imported,
        inserted: 0,
        insertErrors: [`${importedSlug}: ${TIMEOUT(60_000)}`],
        durationMs: 120_000,
      },
      emails: 1,
      dbRequests: 11,
    },
  },
  {
    name: 'provider import with no answer at all',
    context: 'admin',
    rows: { job_providers: [provider] },
    call: async () =>
      (await load('app/api/ingest/[slug]/route.ts')).POST(cron('/api/ingest/example'), { params: { slug: 'example' } }),
    healthy: { status: 200, emails: 1, dbRequests: 11 },
    stalled: { waits: 1, status: 404, body: { ok: false, error: 'Provider not found' }, dbRequests: 1 },
  },
  {
    name: 'subscribers page',
    context: 'admin',
    rows: {
      email_subscribers: [
        { id: ID, email: 'ada@example.com', status: 'subscribed', source: 'footer', subscribed_at: '2026-05-01T00:00:00Z' },
      ],
    },
    call: async () => (await page('subscribers/page.tsx')).default!({ searchParams: Promise.resolve({}) }),
    healthy: { status: 'page', dbRequests: 2 },
    stalled: { waits: 1, status: 'page', dbRequests: 2 },
  },
  {
    name: 'provider page',
    context: 'admin',
    rows: { job_providers: [provider], provider_runs: [run] },
    call: async () => (await page('providers/[slug]/page.tsx')).default!({ params: Promise.resolve({ slug: 'example' }) }),
    healthy: { status: 'page', dbRequests: 4 },
    stalled: { waits: 1, status: 'thrown', body: 'NEXT_NOT_FOUND', dbRequests: 1 },
  },
  {
    name: 'dashboard',
    context: 'admin',
    call: async () => (await page('page.tsx')).default!({}),
    healthy: { status: 'page', dbRequests: 25 },
    stalled: { waits: 7, status: 'page', dbRequests: 25 },
  },
]

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(new Date('2026-06-01T09:00:00Z'))
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  vi.stubGlobal('React', React)
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  vi.stubEnv('CRON_SECRET', CRON_TEST_VALUE)
  vi.stubEnv('ADMIN_PATH', TEST_ADMIN_PATH)
  vi.stubEnv('ADMIN_SECRET', TEST_ADMIN_SECRET)
  vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SESSION_SECRET)
  vi.stubEnv('PROVIDER_ALERT_EMAIL', undefined)
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', undefined)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
  sent.length = 0
  revalidated.length = 0
  Object.assign(network, { stall: 'none', rows: {}, calls: [] })
  session = await signTestSession()
  jar.token = session
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function expectAnswer(actual: Answer, expected: Expected) {
  const wanted = { emails: 0, ...expected }
  const picked = Object.fromEntries(Object.keys(wanted).map((key) => [key, actual[key as keyof Answer]]))
  expect(picked).toEqual(JSON.parse(JSON.stringify(wanted)))
}

describe('admin, scheduled and import routes', () => {
  it.each(scenarios)('$name answers as before when the database responds', async (scenario) => {
    network.rows = scenario.rows ?? {}
    const result = await answer(scenario.call)
    expectAnswer(result, scenario.healthy)
    expect(result.elapsed).toBe(0)
  })

  it.each(scenarios)('$name ends at its time limit when the database does not respond', async (scenario) => {
    network.rows = scenario.rows ?? {}
    const { stall = 'all', waits, ...expected } = scenario.stalled
    network.stall = stall
    const result = await answer(scenario.call)
    expectAnswer(result, expected)
    expect(result.elapsed).toBe(DB_LIMITS_MS[scenario.context] * waits)
  })

  it('an admin API route answers a signed-out request before any database request', async () => {
    session = 'not-a-session'
    const result = await answer(async () =>
      (await api('studio/references/route.ts')).GET(request('GET', adminPath('studio/references')), { params: {} }),
    )
    expectAnswer(result, { status: 401, body: { error: 'Signed out' }, dbRequests: 0 })
  })

  it('an admin page sends a signed-out visitor to sign in before any database request', async () => {
    jar.token = undefined
    const result = await answer(async () => (await page('subscribers/page.tsx')).default!({ searchParams: Promise.resolve({}) }))
    expect(result.status).toBe('thrown')
    expect(String(result.body)).toContain(`/${TEST_ADMIN_PATH}-login`)
    expect(result.dbRequests).toBe(0)
  })

  it.each([
    ['pending subscriber clean-up', 'app/api/cron/prune-pending-subscribers/route.ts', '/api/cron/prune-pending-subscribers', 'GET'],
    ['daily job expiry', 'app/api/cron/expire-jobs/route.ts', '/api/cron/expire-jobs', 'GET'],
    ['provider import', 'app/api/ingest/[slug]/route.ts', '/api/ingest/example', 'POST'],
  ])('%s checks the scheduler password before any database request', async (_name, path, url, method) => {
    const result = await answer(async () =>
      (await load(path))[method](cron(url, 'wrong-value'), { params: { slug: 'example' } }),
    )
    expect(result.status).toBe(401)
    expect(result.dbRequests).toBe(0)
  })

  it('a page shows the rows the database returns, and none when it does not answer', async () => {
    network.rows = {
      email_subscribers: [
        { id: ID, email: 'ada@example.com', status: 'subscribed', source: 'footer', subscribed_at: '2026-05-01T00:00:00Z' },
      ],
    }
    const call = async () => (await page('subscribers/page.tsx')).default!({ searchParams: Promise.resolve({}) })
    expect(String((await answer(call)).body)).toContain('ada@example.com')
    network.calls = []
    network.stall = 'all'
    expect(String((await answer(call)).body)).not.toContain('ada@example.com')
  })
})
