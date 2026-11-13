import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_SESSION_COOKIE, getAdminPath } from './middleware-logic'
import { TEST_ADMIN_PATH, TEST_ADMIN_SECRET, TEST_SESSION_SECRET, signTestSession } from './admin-session-fixtures'

// The admin routes report an unexpected problem from their final catch block
// with a fixed "admin …" label and area 'admin', next to their own log line,
// and keep every answer unchanged. Real supabase-js clients come from the
// factory and only the network is fake. The reporting helper is replaced by a
// recorder.

const state = vi.hoisted(() => ({
  reports: [] as unknown[][],
  order: [] as string[],
  sentry: [] as unknown[][],
  emails: [] as unknown[],
  ai: [] as unknown[],
  aiFails: null as Error | null,
  emailFails: null as Error | null,
  clientFails: null as Error | null,
  brokenClient: null as Error | null,
  adapterThrows: null as Error | null,
  adapterFetchFails: null as Error | null,
  failing: new Map<string, unknown>(),
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
      const client = original.getServerSupabase(...args)
      if (!state.brokenClient) return client
      const problem = state.brokenClient
      return new Proxy(client, {
        get: (target, key, receiver) =>
          key === 'from'
            ? () => {
                throw problem
              }
            : Reflect.get(target, key, receiver),
      })
    },
  }
})

vi.mock('@/lib/jobs', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/jobs')>()
  return {
    ...original,
    approveJob: (...args: Parameters<typeof original.approveJob>) =>
      state.failing.has('approveJob') ? Promise.reject(state.failing.get('approveJob')) : original.approveJob(...args),
  }
})

vi.mock('@/lib/adapters', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/adapters')>()
  return {
    ...original,
    getAdapter: (key: string) => {
      if (state.adapterThrows) throw state.adapterThrows
      if (state.adapterFetchFails) {
        const problem = state.adapterFetchFails
        return { fetch: () => Promise.reject(problem) }
      }
      return original.getAdapter(key)
    },
  }
})

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: async (request: unknown) => {
        state.ai.push(request)
        if (state.aiFails) throw state.aiFails
        return { content: [{ type: 'text', text: '{}' }], usage: { input_tokens: 1, output_tokens: 1 } }
      },
    }
  },
}))

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (message: unknown) => {
        state.emails.push(message)
        if (state.emailFails) throw state.emailFails
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

// The folder comes from the app's own default, so its name is not repeated here.
vi.stubEnv('ADMIN_PATH', undefined)
const folder = getAdminPath()
vi.unstubAllEnvs()

type Handler = (req: NextRequest, context?: unknown) => Promise<Response>
type RouteModule = Record<string, Handler>
type Loader = (suffix: string) => Promise<RouteModule>

const loadCurrent: Loader = (suffix) => import(/* @vite-ignore */ join(process.cwd(), 'app', 'api', `${folder}${suffix}`, 'route.ts'))

const DB_URL = 'https://example.supabase.co'
const SITE = 'https://accountingbody.com'
const NOW = Date.parse('2026-11-08T12:00:00.000Z')
const JOB_ID = '0f8fad5b-d9cb-469f-a165-70867728950e'
const COURSE_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const CRON_TEST_VALUE = 'cron-test-value'
const TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
const PROBLEM = 'unexpected problem'

type Row = Record<string, unknown>
const db = { tables: {} as Record<string, Row[]>, failing: false }
const ingest = { status: 200, body: { ok: true } as unknown, fails: null as Error | null }

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
  if (url.origin === SITE && url.pathname.startsWith('/api/ingest/')) {
    if (ingest.fails) throw ingest.fails
    return json(ingest.body, ingest.status)
  }
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
  const answer = (found: Row[], status: number) => {
    if (!single) return json(found, status)
    if (found.length === 1) return json(found[0], status)
    return json({ message: 'no single row', code: 'PGRST116', details: null, hint: null }, 406)
  }

  if (method === 'GET' || method === 'HEAD') return answer(rows.filter(matches), 200)
  const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
  if (method === 'POST') {
    const written = (Array.isArray(body) ? body : [body]).map((row) => ({ id: JOB_ID, ...(row as Row) }))
    rows.push(...written)
    return prefer.includes('return=representation') ? answer(written, 201) : new Response(null, { status: 201 })
  }
  if (method === 'PATCH') {
    const changed = rows.filter(matches)
    for (const row of changed) Object.assign(row, body)
    return prefer.includes('return=representation') ? answer(changed, 200) : new Response(null, { status: 204 })
  }
  if (method === 'DELETE') {
    const removed = rows.filter(matches)
    db.tables[table] = rows.filter((row) => !matches(row))
    return prefer.includes('return=representation') ? answer(removed, 200) : new Response(null, { status: 204 })
  }
  throw new Error(`unexpected ${method} to ${table}`)
}

let session = ''

type Call = { path?: string; method: string; body?: unknown; signedIn?: boolean }

function request({ path = '/api/admin-tool', method, body, signedIn = true }: Call): NextRequest {
  const text = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
  return new NextRequest(SITE + path, {
    method,
    body: text,
    headers: {
      ...(text ? { 'content-type': 'application/json' } : {}),
      ...(signedIn ? { cookie: `${ADMIN_SESSION_COOKIE}=${session}` } : {}),
    },
  })
}

// The body cannot be read; reading it throws the given problem.
function unreadable(req: NextRequest, problem: Error): NextRequest {
  Object.defineProperty(req, 'json', { value: async () => { throw problem } })
  Object.defineProperty(req, 'text', { value: async () => { throw problem } })
  return req
}

async function answerOf(response: Response) {
  const text = await response.text()
  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    if (key !== 'date') headers[key] = value
  })
  return { status: response.status, headers, cookies: response.headers.getSetCookie(), body: text }
}

const provider = {
  id: 'provider-1',
  slug: 'example',
  name: 'Example jobs',
  status: 'active',
  adapter_key: 'generic-rest',
  base_url: 'https://jobs.example/api',
  field_mapping: { title: 'title' },
  enforce_relevance: false,
}

const job = {
  id: JOB_ID,
  title: 'Management Accountant',
  company_name: 'Example Ltd',
  status: 'pending',
  manage_token: 'manage-token-1',
  employer_email: 'hiring@example.com',
  platform: ['ab'],
}

const seedProvider = () => {
  db.tables.job_providers = [{ ...provider }]
}

// One forced final catch: the problem it is reached with, the answer and the
// log line that comes before the report (null when the catch has none).
type Forced = {
  label: string
  log: string | null
  seed?: () => void
  run: (load: Loader, problem: Error) => Promise<Response>
  answer: { status: number; body: unknown }
  // The caught value is the given problem unless the route wraps it.
  wraps?: boolean
}

type Outcome = [string, (load: Loader) => Promise<Response>, number, (() => void)?]

type Route = {
  name: string
  suffix: string
  method: string
  signedOut: (load: Loader) => Promise<Response>
  forced: Forced[]
  outcomes: Outcome[]
}

const call = (suffix: string, method: string, context?: unknown) => async (load: Loader, req: NextRequest) =>
  (await load(suffix))[method](req, context)

const slugParams = { params: { slug: 'example' } }
const promisedSlug = () => ({ params: Promise.resolve({ slug: 'example' }) })

function route(
  name: string,
  suffix: string,
  method: string,
  context: () => unknown,
  forced: Forced[],
  outcomes: [string, Call, number, (() => void)?][],
): Route {
  const send = (load: Loader, req: NextRequest) => call(suffix, method, context())(load, req)
  return {
    name,
    suffix,
    method,
    signedOut: (load) => send(load, request({ method, body: method === 'GET' || method === 'DELETE' ? undefined : {}, signedIn: false })),
    forced: forced.map((item) => item),
    outcomes: outcomes.map(([label, input, status, seed]) => [label, (load) => send(load, request(input)), status, seed]),
  }
}

const bodyProblem = (suffix: string, method: string, context: () => unknown = () => undefined) => (load: Loader, problem: Error) =>
  call(suffix, method, context())(load, unreadable(request({ method, body: {} }), problem))

const error = (message: string) => JSON.stringify({ error: message })

const ROUTES: Route[] = [
  route('record actions', '/actions', 'POST', () => undefined, [
    { label: 'admin record action failed', log: 'admin/actions error:', run: bodyProblem('/actions', 'POST'), answer: { status: 500, body: error(PROBLEM) } },
  ], [
    ['missing fields', { method: 'POST', body: {} }, 400],
  ]),
  route('article publish', '/articles/publish', 'POST', () => undefined, [
    { label: 'admin article publish failed', log: null, run: bodyProblem('/articles/publish', 'POST'), answer: { status: 500, body: error(PROBLEM) } },
  ], [
    ['missing article', { method: 'POST', body: {} }, 400],
  ]),
  route('article search', '/articles/search', 'GET', () => undefined, [
    {
      label: 'admin article search failed',
      log: null,
      run: (load, problem) => {
        state.clientFails = problem
        return call('/articles/search', 'GET')(load, request({ method: 'GET', path: '/api/admin-tool?q=audit' }))
      },
      answer: { status: 500, body: error(PROBLEM) },
    },
  ], [
    ['healthy search', { method: 'GET', path: '/api/admin-tool?q=audit' }, 200],
    ['empty search', { method: 'GET' }, 200],
    ['database error', { method: 'GET', path: '/api/admin-tool?q=audit' }, 500, () => { db.failing = true }],
  ]),
  route('category list', '/categories', 'GET', () => undefined, [
    {
      label: 'admin category list failed',
      log: null,
      run: (load, problem) => {
        state.clientFails = problem
        return call('/categories', 'GET')(load, request({ method: 'GET' }))
      },
      answer: { status: 500, body: JSON.stringify({ error: 'Could not load categories.' }) },
    },
  ], [
    ['healthy list', { method: 'GET' }, 200, () => { db.tables.articles = [{ category: 'audit', category_title: 'Audit', status: 'published', platform: 'ab' }] }],
    ['empty list', { method: 'GET' }, 200],
  ]),
  route('AI content generate', '/content-factory/generate', 'POST', () => undefined, [
    { label: 'admin AI content generate failed', log: 'content-factory/generate error:', run: bodyProblem('/content-factory/generate', 'POST'), answer: { status: 500, body: error(PROBLEM) } },
    {
      label: 'admin AI content generate failed',
      log: 'content-factory/generate error:',
      run: (load, problem) => {
        state.aiFails = problem
        return call('/content-factory/generate', 'POST')(load, request({ method: 'POST', body: { contentType: 'article', qualification: 'ACCA', topic: 'Seed topic for a prompt' } }))
      },
      answer: { status: 500, body: error(PROBLEM) },
    },
  ], [
    ['missing fields', { method: 'POST', body: {} }, 400],
  ]),
  route('AI content publish', '/content-factory/publish', 'POST', () => undefined, [
    { label: 'admin AI content publish failed', log: 'content-factory/publish error:', run: bodyProblem('/content-factory/publish', 'POST'), answer: { status: 500, body: error(PROBLEM) } },
  ], [
    ['missing fields', { method: 'POST', body: {} }, 400],
  ]),
  route('course factory delete', '/course-factory/delete-course', 'DELETE', () => undefined, [
    { label: 'admin course factory delete failed', log: null, run: bodyProblem('/course-factory/delete-course', 'DELETE'), answer: { status: 500, body: error(PROBLEM) } },
  ], [
    ['missing slug', { method: 'DELETE', body: {} }, 400],
    ['no such course', { method: 'DELETE', body: { slug: 'missing' } }, 404],
    ['healthy delete', { method: 'DELETE', body: { slug: 'course-a' } }, 200, () => { db.tables.courses = [{ id: COURSE_ID, slug: 'course-a', course_chapters: [] }] }],
  ]),
  route('course save', '/course-factory/save', 'POST', () => undefined, [
    { label: 'admin course save request unreadable', log: null, run: bodyProblem('/course-factory/save', 'POST'), answer: { status: 400, body: error('Invalid JSON') } },
    {
      label: 'admin course save failed',
      log: null,
      run: (load, problem) => {
        state.clientFails = problem
        return call('/course-factory/save', 'POST')(load, request({ method: 'POST', body: { title: 'Course', slug: 'course-a' } }))
      },
      answer: { status: 500, body: error(PROBLEM) },
    },
  ], [
    ['missing title', { method: 'POST', body: {} }, 400],
    ['database error', { method: 'POST', body: { title: 'Course', slug: 'course-a' } }, 500, () => { db.failing = true }],
  ]),
  route('course update', '/courses/[courseId]', 'PATCH', () => ({ params: { courseId: COURSE_ID } }), [
    {
      label: 'admin course update request unreadable',
      log: null,
      run: bodyProblem('/courses/[courseId]', 'PATCH', () => ({ params: { courseId: COURSE_ID } })),
      answer: { status: 400, body: error('Invalid JSON') },
    },
  ], [
    ['unknown action', { method: 'PATCH', body: { action: 'unknown' } }, 400],
  ]),
  route('course delete', '/courses/[courseId]', 'DELETE', () => ({ params: { courseId: COURSE_ID } }), [
    {
      label: 'admin course delete failed',
      log: null,
      run: (load, problem) => {
        state.brokenClient = problem
        return call('/courses/[courseId]', 'DELETE', { params: { courseId: COURSE_ID } })(load, request({ method: 'DELETE' }))
      },
      answer: { status: 500, body: error(PROBLEM) },
    },
  ], [
    ['healthy delete', { method: 'DELETE' }, 200],
    ['database error', { method: 'DELETE' }, 500, () => { db.failing = true }],
  ]),
  route('job update', '/jobs/[id]', 'PATCH', () => ({ params: Promise.resolve({ id: JOB_ID }) }), [
    {
      label: 'admin job update failed',
      log: 'admin job update failed',
      seed: () => { db.tables.jobs = [{ ...job }] },
      run: (load, problem) => {
        state.failing.set('approveJob', problem)
        return call('/jobs/[id]', 'PATCH', { params: Promise.resolve({ id: JOB_ID }) })(load, request({ method: 'PATCH', body: { action: 'approve' } }))
      },
      answer: { status: 500, body: error(PROBLEM) },
    },
  ], [
    ['no such job', { method: 'PATCH', body: { action: 'approve' } }, 404],
    ['missing action', { method: 'PATCH', body: {} }, 400, () => { db.tables.jobs = [{ ...job }] }],
  ]),
  route('candidate email', '/notify-candidate', 'POST', () => undefined, [
    { label: 'admin candidate email failed', log: 'notify-candidate error:', run: bodyProblem('/notify-candidate', 'POST'), answer: { status: 500, body: error('Failed to send email') } },
    {
      label: 'admin candidate email failed',
      log: 'notify-candidate error:',
      run: (load, problem) => {
        state.emailFails = problem
        return call('/notify-candidate', 'POST')(load, request({ method: 'POST', body: { id: JOB_ID, status: 'rejected', email: 'candidate@example.com', name: 'Ada' } }))
      },
      answer: { status: 500, body: error('Failed to send email') },
    },
  ], [
    ['healthy email', { method: 'POST', body: { id: JOB_ID, status: 'rejected', email: 'candidate@example.com', name: 'Ada' } }, 200],
    ['token save error', { method: 'POST', body: { id: JOB_ID, status: 'active', email: 'candidate@example.com', name: 'Ada' } }, 500, () => { db.failing = true }],
  ]),
  route('firm email', '/notify-firm', 'POST', () => undefined, [
    { label: 'admin firm email failed', log: 'notify-firm error:', run: bodyProblem('/notify-firm', 'POST'), answer: { status: 500, body: error('Failed to send email') } },
  ], [
    ['missing fields', { method: 'POST', body: {} }, 400],
  ]),
  route('provider edit', '/providers/[slug]/edit', 'PATCH', () => slugParams, [
    {
      label: 'admin provider edit request unreadable',
      log: null,
      seed: seedProvider,
      run: bodyProblem('/providers/[slug]/edit', 'PATCH', () => slugParams),
      answer: { status: 400, body: error('Invalid JSON body') },
    },
  ], [
    ['no such provider', { method: 'PATCH', body: {} }, 404],
    ['not an object', { method: 'PATCH', body: '1' }, 400, seedProvider],
  ]),
  route('provider preview', '/providers/[slug]/preview', 'POST', () => slugParams, [
    {
      label: 'admin provider preview request unreadable',
      log: null,
      seed: seedProvider,
      run: bodyProblem('/providers/[slug]/preview', 'POST', () => slugParams),
      answer: { status: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON body' }) },
    },
    {
      label: 'admin provider preview adapter missing',
      log: null,
      seed: seedProvider,
      run: (load, problem) => {
        state.adapterThrows = problem
        return call('/providers/[slug]/preview', 'POST', slugParams)(load, request({ method: 'POST', body: {} }))
      },
      answer: { status: 400, body: JSON.stringify({ ok: false, error: PROBLEM }) },
    },
    {
      label: 'admin provider preview failed',
      log: null,
      seed: seedProvider,
      run: (load, problem) => {
        state.adapterFetchFails = problem
        return call('/providers/[slug]/preview', 'POST', slugParams)(load, request({ method: 'POST', body: {} }))
      },
      answer: { status: 502, body: JSON.stringify({ ok: false, error: PROBLEM, durationMs: 0 }) },
    },
  ], [
    ['no such provider', { method: 'POST', body: {} }, 404],
  ]),
  route('provider run start', '/providers/[slug]/trigger', 'POST', promisedSlug, [
    {
      label: 'admin provider run start failed',
      log: 'admin provider run start failed',
      run: (load, problem) => {
        ingest.fails = problem
        return call('/providers/[slug]/trigger', 'POST', promisedSlug())(load, request({ method: 'POST' }))
      },
      answer: { status: 500, body: JSON.stringify({ ok: false, error: 'Run failed' }) },
    },
  ], [
    ['healthy start', { method: 'POST' }, 200],
    ['import answers with a refusal', { method: 'POST' }, 409, () => { ingest.status = 409; ingest.body = { ok: false, error: 'already running' } }],
  ]),
  route('provider create', '/providers/create', 'POST', () => undefined, [
    { label: 'admin provider create request unreadable', log: null, run: bodyProblem('/providers/create', 'POST'), answer: { status: 400, body: error('Invalid JSON body') } },
  ], [
    ['missing slug', { method: 'POST', body: {} }, 400],
    ['not an object', { method: 'POST', body: '1' }, 400],
  ]),
  route('AI question generate', '/questions/generate', 'POST', () => undefined, [
    { label: 'admin AI question generate failed', log: 'questions/generate error:', run: bodyProblem('/questions/generate', 'POST'), answer: { status: 500, body: error(PROBLEM) } },
    {
      label: 'admin AI question generate failed',
      log: 'questions/generate error:',
      run: (load, problem) => {
        state.aiFails = problem
        return call('/questions/generate', 'POST')(load, request({ method: 'POST', body: { topic: 'Seed topic for a prompt', count: 1 } }))
      },
      answer: { status: 500, body: error(PROBLEM) },
    },
  ], []),
  route('question set publish', '/questions/publish', 'POST', () => undefined, [
    { label: 'admin question set publish failed', log: 'questions/publish error:', run: bodyProblem('/questions/publish', 'POST'), answer: { status: 500, body: error(PROBLEM) } },
  ], [
    ['missing bundle', { method: 'POST', body: {} }, 400],
  ]),
  route('reply email', '/reply', 'POST', () => undefined, [
    { label: 'admin reply email failed', log: 'Reply error:', run: bodyProblem('/reply', 'POST'), answer: { status: 500, body: error('Failed to send reply.') } },
    {
      label: 'admin reply email failed',
      log: 'Reply error:',
      run: (load, problem) => {
        state.emailFails = problem
        return call('/reply', 'POST')(load, request({ method: 'POST', body: { to: 'visitor@example.com', subject: 'Hello', message: 'Thanks', platform: 'ab' } }))
      },
      answer: { status: 500, body: error('Failed to send reply.') },
    },
  ], [
    ['missing fields', { method: 'POST', body: {} }, 400],
    ['healthy reply', { method: 'POST', body: { to: 'visitor@example.com', subject: 'Hello', message: 'Thanks', platform: 'ab' } }, 200],
  ]),
]

const recorded = (...args: unknown[]) => {
  state.order.push(`console ${String(args[0])}`)
}

function reset() {
  state.reports.length = 0
  state.order.length = 0
  state.sentry.length = 0
  state.emails.length = 0
  state.ai.length = 0
  state.aiFails = null
  state.emailFails = null
  state.clientFails = null
  state.brokenClient = null
  state.adapterThrows = null
  state.adapterFetchFails = null
  state.failing.clear()
  db.tables = {}
  db.failing = false
  ingest.status = 200
  ingest.body = { ok: true }
  ingest.fails = null
}

beforeEach(async () => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
  vi.stubEnv('CRON_SECRET', CRON_TEST_VALUE)
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE)
  vi.stubEnv('ADMIN_SECRET', TEST_ADMIN_SECRET)
  vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SESSION_SECRET)
  vi.stubEnv('ADMIN_TOTP_SECRET', TOTP_SECRET)
  for (const level of ['error', 'warn', 'log', 'info'] as const) vi.spyOn(console, level).mockImplementation(recorded)
  reset()
  session = await signTestSession()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const FORCED = ROUTES.flatMap((item) => item.forced.map((forced, index) => ({ ...forced, name: `${item.name} (${index + 1})` })))

describe.each(FORCED)('$name', (forced) => {
  it('reports an unexpected admin problem with its label', async () => {
    forced.seed?.()
    const problem = new Error(PROBLEM)
    await forced.run(loadCurrent, problem)
    expect(state.reports).toStrictEqual([[forced.label, problem, { area: 'admin' }]])
    expect(state.reports[0][1]).toBe(problem)
    expect(state.sentry).toStrictEqual([])
  })

  it('keeps the admin answer unchanged when reporting', async () => {
    forced.seed?.()
    const result = await answerOf(await forced.run(loadCurrent, new Error(PROBLEM)))
    expect(result.status).toBe(forced.answer.status)
    expect(result.body).toBe(forced.answer.body)
    expect(result.cookies).toStrictEqual([])
  })

  it('reports after the route log line', async () => {
    forced.seed?.()
    await forced.run(loadCurrent, new Error(PROBLEM))
    const at = state.order.indexOf(`report ${forced.label}`)
    expect(at).toBe(state.order.length - 1)
    if (forced.log) expect(state.order[at - 1]).toBe(`console ${forced.log}`)
  })
})

describe.each(ROUTES)('$name $method', (item) => {
  it('makes no report for a signed-out request', async () => {
    const result = await answerOf(await item.signedOut(loadCurrent))
    expect(result.status).toBe(401)
    expect(JSON.parse(result.body)).toStrictEqual({ error: 'Signed out' })
    expect(state.reports).toStrictEqual([])
    expect(fetch).not.toHaveBeenCalled()
    expect(state.emails).toStrictEqual([])
    expect(state.ai).toStrictEqual([])
  })

  if (item.outcomes.length > 0) {
    it.each(item.outcomes)('makes no report for an expected outcome: %s', async (_name, run, status, seed) => {
      seed?.()
      const result = await run(loadCurrent)
      expect(result.status).toBe(status)
      // A failed read reports through checkRead with its own label; the
      // route's final catch makes no report.
      expect(state.reports.filter(([label]) => String(label).startsWith('admin '))).toStrictEqual([])
      expect(state.sentry).toStrictEqual([])
    })
  }
})

describe('sign-in', () => {
  const STEP_MS = 30_000
  const send = async (body: unknown) => {
    const { POST } = await loadCurrent('-auth')
    return POST(request({ method: 'POST', body, signedIn: false }))
  }
  const codeAt = async (timeMs: number) => {
    const { createHmac } = await import('node:crypto')
    const counter = Buffer.alloc(8)
    counter.writeBigUInt64BE(BigInt(Math.floor(timeMs / STEP_MS)))
    const digest = createHmac('sha1', '12345678901234567890').update(counter).digest()
    const offset = digest[digest.length - 1] & 0x0f
    return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0')
  }
  const wrong = (code: string) => (code === '000000' ? '000001' : '000000')
  const DENIED = { status: 401, body: JSON.stringify({ error: 'Access denied.' }) }

  const REFUSALS: [string, () => Promise<unknown>, (() => void)?][] = [
    ['unreadable body', async () => '{'],
    ['missing fields', async () => ({})],
    ['missing code', async () => ({ password: TEST_ADMIN_SECRET })],
    ['wrong password', async () => ({ password: 'not-the-password', totpCode: await codeAt(NOW) })],
    ['wrong code', async () => ({ password: TEST_ADMIN_SECRET, totpCode: wrong(await codeAt(NOW)) })],
    ['code from an old time step', async () => ({ password: TEST_ADMIN_SECRET, totpCode: await codeAt(NOW - 10 * STEP_MS) })],
    ['sign-in not set up', async () => ({ password: TEST_ADMIN_SECRET, totpCode: await codeAt(NOW) }), () => vi.stubEnv('ADMIN_TOTP_SECRET', '')],
    ['session not set up', async () => ({ password: TEST_ADMIN_SECRET, totpCode: await codeAt(NOW) }), () => vi.stubEnv('ADMIN_SESSION_SECRET', '')],
  ]

  it.each(REFUSALS)('keeps the sign-in answer the same for every refusal: %s', async (name, body, setup) => {
    setup?.()
    const result = await answerOf(await send(await body()))
    expect({ status: result.status, body: result.body }).toStrictEqual(DENIED)
    expect(result.cookies).toStrictEqual([])
    const setupReport = [['admin sign-in not set up', new Error('sign-in not set up'), { area: 'admin' }]]
    expect(state.reports).toStrictEqual(name.endsWith('not set up') ? setupReport : [])
  })

  it('makes no report for a successful sign-in', async () => {
    const result = await answerOf(await send({ password: TEST_ADMIN_SECRET, totpCode: await codeAt(NOW) }))
    expect(result.status).toBe(200)
    expect(result.cookies).toHaveLength(1)
    expect(state.reports).toStrictEqual([])
  })

  it('reports an unexpected sign-in problem with its label and keeps the answer', async () => {
    const problem = new Error(PROBLEM)
    vi.spyOn(crypto.subtle, 'importKey').mockRejectedValue(problem)
    const result = await answerOf(await send({ password: TEST_ADMIN_SECRET, totpCode: await codeAt(NOW) }))
    expect({ status: result.status, body: result.body }).toStrictEqual(DENIED)
    expect(result.cookies).toStrictEqual([])
    expect(state.reports).toStrictEqual([['admin sign-in failed', problem, { area: 'admin' }]])
    expect(state.order).toStrictEqual(['console Admin sign-in failed unexpectedly', 'report admin sign-in failed'])
  })
})

describe('AI routes', () => {
  it.each([
    ['/content-factory/generate', { contentType: 'article', qualification: 'ACCA', topic: 'Seed topic for a prompt' }, 'admin AI content generate failed'],
    ['/questions/generate', { topic: 'Seed topic for a prompt', count: 1 }, 'admin AI question generate failed'],
  ])('%s sends only the caught problem with an AI failure, never the prompt or request', async (suffix, body, label) => {
    const problem = new Error(PROBLEM)
    state.aiFails = problem
    const { POST } = await loadCurrent(suffix)
    await POST(request({ method: 'POST', body }))
    expect(state.ai).toHaveLength(1)
    expect(JSON.stringify(state.ai)).toContain('Seed topic for a prompt')
    expect(state.reports).toStrictEqual([[label, problem, { area: 'admin' }]])
    expect(state.reports[0][1]).toBe(problem)
  })
})

// ── Source checks ───────────────────────────────────────────────────────────

const ROOT = process.cwd()
const ADMIN_API = join('app', 'api', folder)

function sourceOf(suffix: string): string {
  return readFileSync(join(ROOT, `${ADMIN_API}${suffix}`, 'route.ts'), 'utf8')
}

// Labels of the final catch blocks (a try directly in an exported handler),
// in order; null for a catch that does not report.
function finalCatchLabels(source: string): (string | null)[] {
  const file = ts.createSourceFile('route.ts', source, ts.ScriptTarget.Latest, true)
  const found: (string | null)[] = []
  const reportIn = (node: ts.Node): string | null => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'reportServerError') {
      const label = node.arguments[0]
      return label && ts.isStringLiteral(label) ? label.text : ''
    }
    return ts.forEachChild(node, reportIn) ?? null
  }
  for (const statement of file.statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.body) continue
    if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue
    for (const inner of statement.body.statements) {
      if (ts.isTryStatement(inner) && inner.catchClause) found.push(reportIn(inner.catchClause.block))
    }
  }
  return found
}

const SOURCES: [string, (string | null)[]][] = [
  ['-auth', ['admin sign-in failed']],
  ['/actions', ['admin record action failed']],
  ['/articles/publish', ['admin article publish failed']],
  ['/articles/search', ['admin article search failed']],
  ['/categories', ['admin category list failed']],
  ['/content-factory/generate', ['admin AI content generate failed']],
  ['/content-factory/publish', ['admin AI content publish failed']],
  ['/course-factory/delete-course', ['admin course factory delete failed']],
  ['/course-factory/save', ['admin course save request unreadable', 'admin course save failed']],
  ['/courses/[courseId]', ['admin course update request unreadable', 'admin course delete failed']],
  ['/jobs/[id]', ['admin job update failed']],
  ['/notify-candidate', ['admin candidate email failed']],
  ['/notify-firm', ['admin firm email failed']],
  ['/providers/[slug]/edit', ['admin provider edit request unreadable']],
  ['/providers/[slug]/preview', ['admin provider preview request unreadable', 'admin provider preview adapter missing', 'admin provider preview failed']],
  ['/providers/[slug]/trigger', ['admin provider run start failed']],
  ['/providers/create', ['admin provider create request unreadable']],
  ['/questions/generate', ['admin AI question generate failed']],
  ['/questions/publish', ['admin question set publish failed']],
  ['/reply', ['admin reply email failed']],
  ['/articles/import', [null]],
  ['/questions/import', [null]],
  ['/providers/[slug]/test', [null]],
  ['/studio/post-social', [null]],
]

describe('admin route sources', () => {
  it.each(SOURCES)('%s reports from the expected final catch blocks', (suffix, labels) => {
    expect(finalCatchLabels(sourceOf(suffix))).toStrictEqual(labels)
  })

  it.each(SOURCES.filter(([, labels]) => labels.some(Boolean)))('%s reports with fixed labels and the admin area only', (suffix) => {
    const calls = sourceOf(suffix).match(/reportServerError\(.*\)$/gm) ?? []
    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) {
      expect(call).toMatch(/^reportServerError\((['"])admin [A-Za-z -]+\1, (?:err|error|e|new Error\((['"])(?:admin )?[a-z -]+\2\)), \{ area: (['"])admin\3 \}\)$/)
    }
  })

  it('gives each admin report its own label', () => {
    const labels = SOURCES.flatMap(([, list]) => list).filter((label): label is string => label !== null)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('keeps folder names, paths and values out of admin labels', () => {
    const labels = SOURCES.flatMap(([, list]) => list).filter((label): label is string => label !== null)
    for (const label of labels) {
      expect(label.startsWith('admin ')).toBe(true)
      expect(label).not.toContain('/')
      expect(label.toLowerCase()).not.toContain(folder.toLowerCase())
      expect(label.toLowerCase()).not.toContain(TEST_ADMIN_PATH)
      expect(label).toMatch(/^[A-Za-z -]+$/)
    }
  })

  it('every admin-area report in the codebase has a plain "admin" label', () => {
    const walk = (dir: string): string[] =>
      readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(path)
        return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
      })
    const calls = ['app', 'lib', 'components']
      .flatMap(walk)
      .flatMap((file) => readFileSync(join(ROOT, file), 'utf8').match(/reportServerError\([^)]*area: ['"]admin['"][^)]*\)/g) ?? [])
    expect(calls).toHaveLength(24)
    const labels = calls.map((text) => text.match(/^reportServerError\((['"])(.*?)\1/)?.[2] ?? '')
    expect(new Set(labels).size).toBe(labels.length)
    for (const label of labels) {
      expect(label).toMatch(/^admin [A-Za-z -]+$/)
      expect(label.toLowerCase()).not.toContain(folder.toLowerCase())
      expect(label.toLowerCase()).not.toContain(TEST_ADMIN_PATH)
    }
  })

  it('every forced catch in the tests matches a source label', () => {
    const labels = new Set(SOURCES.flatMap(([, list]) => list))
    for (const forced of FORCED) expect(labels.has(forced.label)).toBe(true)
    const tested = new Set(FORCED.map((forced) => forced.label))
    for (const label of Array.from(labels)) if (label !== null && label !== 'admin sign-in failed') expect(tested.has(label)).toBe(true)
  })
})
