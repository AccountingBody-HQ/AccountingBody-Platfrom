import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_SESSION_COOKIE, getAdminPath } from './middleware-logic'
import { SERVER_PROBLEM_TEXT } from './message-rules'
import { TEST_ADMIN_SECRET, TEST_SESSION_SECRET, signTestSession } from './admin-session-fixtures'

// Scheduled routes need their configuration; plainer visitor messages and
// logs; admin sign-in setup reports; admin email sends answer honestly. Real
// supabase-js clients come from the factory and only the network is fake.

const state = vi.hoisted(() => ({
  reports: [] as unknown[][],
  sentry: [] as unknown[][],
  logs: [] as unknown[][],
  emails: [] as unknown[],
  emailRefused: false,
  clientFails: null as Error | null,
  hanging: new Set<string>(),
  due: null as unknown[] | null,
}))

vi.mock('@/lib/report-error', () => ({
  reportServerError: (...args: unknown[]) => {
    state.reports.push(args)
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

vi.mock('@/lib/jobs', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/jobs')>()
  return {
    ...original,
    getActiveDirectJobs: (...args: Parameters<typeof original.getActiveDirectJobs>) =>
      state.hanging.has('getActiveDirectJobs') ? new Promise(() => {}) : original.getActiveDirectJobs(...args),
  }
})

vi.mock('@/lib/providers', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/providers')>()
  return {
    ...original,
    getProvidersDueForFetch: (...args: Parameters<typeof original.getProvidersDueForFetch>) =>
      state.due ? Promise.resolve(state.due as Awaited<ReturnType<typeof original.getProvidersDueForFetch>>) : original.getProvidersDueForFetch(...args),
  }
})

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (message: unknown) => {
        state.emails.push(message)
        if (state.emailRefused) return { data: null, error: { name: 'validation_error', statusCode: 422, message: 'provider detail' }, headers: {} }
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
import { GET as pruneImportLogs } from '@/app/api/cron/prune-import-logs/route'
import { GET as prunePendingSubscribers } from '@/app/api/cron/prune-pending-subscribers/route'
import { GET as pruneSavedJobs } from '@/app/api/cron/prune-saved-jobs/route'
import { POST as ingest } from '@/app/api/ingest/[slug]/route'
import { GET as orchestrator } from '@/app/api/ingest/orchestrator/route'
import { GET as search } from '@/app/api/search/route'
import { POST as employerBrief } from '@/app/api/recruitment/employer-brief/route'
import { GET as mockExam } from '@/app/api/mock-exam/route'
import { GET as eticpaMockExam } from '@/app/api/eticpa/mock-exam/route'
import { POST as updateCandidate } from '@/app/api/recruitment/update-candidate/route'
import { POST as updateEmployer } from '@/app/api/recruitment/update-employer/route'
import { POST as jobSeekerApply } from '@/app/api/recruitment/job-seeker-apply/route'
import { getArticleBySlug } from '@/lib/db'

// The folder comes from the app's own default, so its name is not repeated here.
vi.stubEnv('ADMIN_PATH', undefined)
const folder = getAdminPath()
vi.unstubAllEnvs()

type Handler = (req: NextRequest, context?: unknown) => Promise<Response>
const loadAdmin = (suffix: string): Promise<Record<string, Handler>> =>
  import(/* @vite-ignore */ join(process.cwd(), 'app', 'api', `${folder}${suffix}`, 'route.ts'))

const DB_URL = 'https://example.supabase.co'
const SITE = 'https://accountingbody.com'
const NOW = Date.parse('2026-11-08T12:00:00.000Z')
const CRON_TEST_VALUE = 'cron-test-value'
const TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
const JSON_HEADERS = { 'content-type': 'application/json' }

type Row = Record<string, unknown>
const net = {
  requests: [] as string[],
  dispatches: [] as (string | null)[],
  tables: {} as Record<string, Row[]>,
  failing: false,
  failMethod: null as string | null,
  nullSingle: false,
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

function matcher(params: URLSearchParams) {
  const eq: [string, string][] = []
  params.forEach((value, key) => {
    if (value.startsWith('eq.')) eq.push([key, value.slice(3)])
  })
  return (row: Row) => eq.every(([key, value]) => String(row[key]) === value)
}

const DB_PROBLEM = { message: 'database detail', code: 'XX000', details: null, hint: null }

const fakeFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.origin === 'https://challenges.cloudflare.com') return json({ success: true })
  if (url.origin === SITE && url.pathname.startsWith('/api/ingest/')) {
    const headers = new Headers(init?.headers)
    net.dispatches.push(headers.get('authorization'))
    const slug = url.pathname.split('/').pop() ?? ''
    return ingest(new NextRequest(url.href, { method: init?.method ?? 'POST', headers }), { params: { slug } })
  }
  if (url.origin !== DB_URL) throw new Error(`unexpected request to ${url.href}`)

  const method = (init?.method ?? 'GET').toUpperCase()
  const table = url.pathname.replace('/rest/v1/', '')
  net.requests.push(`${method} ${table}`)
  if (net.failing || net.failMethod === method) return json(DB_PROBLEM, 500)

  const headers = new Headers(init?.headers)
  const prefer = headers.get('prefer') ?? ''
  const single = (headers.get('accept') ?? '').includes('vnd.pgrst.object')
  if (table.startsWith('rpc/')) return json([])
  if (single && net.nullSingle) return json(null)
  const rows = (net.tables[table] ??= [])
  const matches = matcher(url.searchParams)
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
    const written = (Array.isArray(body) ? body : [body]).map((row) => ({ id: 'row-1', ...(row as Row) }))
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
    net.tables[table] = rows.filter((row) => !matches(row))
    return prefer.includes('return=representation') ? answer(removed, 200) : new Response(null, { status: 204, headers: counted(removed.length) })
  }
  throw new Error(`unexpected ${method} to ${table}`)
}

let address = 0
function request(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const text = init.body === undefined ? undefined : typeof init.body === 'string' ? init.body : JSON.stringify(init.body)
  return new NextRequest(SITE + path, {
    method: init.method ?? 'GET',
    body: text,
    headers: {
      'x-forwarded-for': `203.0.113.${(address = (address % 250) + 1)}`,
      ...(text ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  })
}

function unreadable(req: NextRequest, problem: unknown) {
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

let session = ''

beforeEach(async () => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-key')
  vi.stubEnv('TURNSTILE_SECRET_KEY_AB', 'test-key')
  vi.stubEnv('CRON_SECRET', CRON_TEST_VALUE)
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE)
  vi.stubEnv('ADMIN_SECRET', TEST_ADMIN_SECRET)
  vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SESSION_SECRET)
  vi.stubEnv('ADMIN_TOTP_SECRET', TOTP_SECRET)
  for (const level of ['error', 'warn', 'log', 'info'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      state.logs.push(args)
    })
  }
  state.reports.length = 0
  state.sentry.length = 0
  state.logs.length = 0
  state.emails.length = 0
  state.emailRefused = false
  state.clientFails = null
  state.hanging.clear()
  state.due = null
  net.requests = []
  net.dispatches = []
  net.tables = {}
  net.failing = false
  net.failMethod = null
  net.nullSingle = false
  session = await signTestSession()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ── Scheduled routes ────────────────────────────────────────────────────────

const authHeaders = (authorization?: string): Record<string, string> => (authorization === undefined ? {} : { authorization })

const SCHEDULED: {
  name: string
  run: (authorization?: string) => Promise<Response>
  log: string
  refused: { status: number; headers: Record<string, string>; body: unknown }
  healthy: { status: number; body: unknown }
}[] = [
  {
    name: 'cron/expire-jobs',
    run: (a) => expireJobs(request('/api/cron/expire-jobs', { headers: authHeaders(a) })),
    log: 'cron/expire-jobs: not configured',
    refused: { status: 401, headers: JSON_HEADERS, body: { error: 'Unauthorised' } },
    healthy: { status: 200, body: { expired: 0, warned: 0 } },
  },
  {
    name: 'cron/prune-pending-subscribers',
    run: (a) => prunePendingSubscribers(request('/api/cron/prune-pending-subscribers', { headers: authHeaders(a) })),
    log: 'cron/prune-pending-subscribers: not configured',
    refused: { status: 401, headers: JSON_HEADERS, body: { error: 'Unauthorised' } },
    healthy: { status: 200, body: { pruned: 0 } },
  },
  {
    name: 'cron/prune-saved-jobs',
    run: (a) => pruneSavedJobs(request('/api/cron/prune-saved-jobs', { headers: authHeaders(a) })),
    log: 'cron/prune-saved-jobs: not configured',
    refused: { status: 401, headers: JSON_HEADERS, body: { error: 'Unauthorised' } },
    healthy: { status: 200, body: { ok: true, deleted: 0 } },
  },
  {
    name: 'ingest/orchestrator',
    run: (a) => orchestrator(request('/api/ingest/orchestrator', { headers: authHeaders(a) })),
    log: '[orchestrator] not configured',
    refused: { status: 401, headers: { 'content-type': 'text/plain;charset=UTF-8' }, body: 'Unauthorized' },
    healthy: { status: 200, body: { ok: true, dispatched: [], reaped: 0, message: 'No providers due' } },
  },
  {
    name: 'ingest/[slug]',
    run: (a) => ingest(request('/api/ingest/example', { method: 'POST', headers: authHeaders(a) }), { params: { slug: 'example' } }),
    log: 'ingest: not configured',
    refused: { status: 401, headers: { 'content-type': 'text/plain;charset=UTF-8' }, body: 'Unauthorized' },
    healthy: { status: 404, body: { ok: false, error: 'Provider not found' } },
  },
]

describe.each(SCHEDULED)('$name', (route) => {
  it.each([[undefined], ['']])('refuses to run without its configuration (CRON_SECRET %j)', async (value) => {
    vi.stubEnv('CRON_SECRET', value)
    const attempts = [undefined, 'Bearer ', 'Bearer undefined', `Bearer ${CRON_TEST_VALUE}`]
    for (const authorization of attempts) {
      expect(await answerOf(await route.run(authorization))).toStrictEqual({ status: 503, headers: JSON_HEADERS, body: { error: 'Not configured' } })
    }
    expect(net.requests).toStrictEqual([])
    expect(net.dispatches).toStrictEqual([])
    expect(state.reports).toStrictEqual([])
    expect(state.emails).toStrictEqual([])
    expect(state.logs).toStrictEqual(attempts.map(() => [route.log]))
  })

  it('answers like the import log clean-up when its configuration is missing', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const ours = await answerOf(await route.run())
    const reference = await answerOf(await pruneImportLogs(request('/api/cron/prune-import-logs')))
    expect(ours).toStrictEqual(reference)
  })

  it.each([[undefined], ['Bearer wrong-value'], [CRON_TEST_VALUE], [`bearer ${CRON_TEST_VALUE}`], ['Bearer undefined']])(
    'keeps its refusal for a wrong request (authorization %j)',
    async (authorization) => {
      expect(await answerOf(await route.run(authorization))).toStrictEqual(route.refused)
      expect(net.requests).toStrictEqual([])
      expect(state.reports).toStrictEqual([])
      expect(state.logs).toStrictEqual([])
    },
  )

  it('runs with the right request', async () => {
    const result = await answerOf(await route.run(`Bearer ${CRON_TEST_VALUE}`))
    expect({ status: result.status, body: result.body }).toStrictEqual(route.healthy)
    expect(net.requests.length).toBeGreaterThan(0)
    expect(state.reports).toStrictEqual([])
  })
})

describe('import callers', () => {
  const inactive = { id: 'provider-1', slug: 'example', name: 'Example jobs', status: 'inactive', adapter_key: 'generic-rest' }

  it('the scheduler still starts each import with its configuration', async () => {
    net.tables.job_providers = [{ ...inactive }]
    state.due = [{ ...inactive }]
    const result = await answerOf(await orchestrator(request('/api/ingest/orchestrator', { headers: { authorization: `Bearer ${CRON_TEST_VALUE}` } })))
    expect(net.dispatches).toStrictEqual([`Bearer ${CRON_TEST_VALUE}`])
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      ok: true,
      dispatched: ['example'],
      count: 1,
      summary: [{ slug: 'example', result: { slug: 'example', status: 200, ok: true } }],
    })
    expect(state.reports).toStrictEqual([])
  })

  it('the admin run-now button still starts an import with its configuration', async () => {
    net.tables.job_providers = [{ ...inactive }]
    const { POST } = await loadAdmin('/providers/[slug]/trigger')
    const result = await answerOf(await POST(withSession(request('/api/admin-tool', { method: 'POST' })), { params: Promise.resolve({ slug: 'example' }) }))
    expect(net.dispatches).toStrictEqual([`Bearer ${CRON_TEST_VALUE}`])
    expect(result).toStrictEqual({ status: 200, headers: JSON_HEADERS, body: { ok: true, skipped: true, reason: 'Provider inactive' } })
  })

  it('the admin run-now button keeps its own answer without the configuration', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const { POST } = await loadAdmin('/providers/[slug]/trigger')
    const result = await answerOf(await POST(withSession(request('/api/admin-tool', { method: 'POST' })), { params: Promise.resolve({ slug: 'example' }) }))
    expect(result).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: { ok: false, error: 'CRON_SECRET is not configured' } })
    expect(net.dispatches).toStrictEqual([])
  })
})

// ── Visitor messages and logs ───────────────────────────────────────────────

describe('search', () => {
  it('logs the search length only when the job lookup takes too long', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    state.hanging.add('getActiveDirectJobs')
    const words = 'seedword-7f3q audit'
    const pending = search(request(`/api/search?q=${encodeURIComponent(words)}`))
    await vi.advanceTimersByTimeAsync(2_500)
    expect((await pending).status).toBe(200)
    expect(state.logs).toContainEqual(['[search] job query timed out', { platform: 'ab', length: words.length }])
    expect(JSON.stringify(state.logs)).not.toContain('seedword')
  })
})

describe('hiring brief', () => {
  it('answers a temporary problem in plain words', async () => {
    const result = await answerOf(await employerBrief(unreadable(request('/api/recruitment/employer-brief', { method: 'POST', body: {} }), new Error('unexpected'))))
    expect(result).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: { error: SERVER_PROBLEM_TEXT } })
    expect(state.reports).toHaveLength(1)
  })
})

describe.each([
  { name: 'mock-exam', run: () => mockExam(request('/api/mock-exam?category=tax')), log: 'mock exam: read failed', label: 'mock exam load failed' },
  { name: 'eticpa/mock-exam', run: () => eticpaMockExam(request('/api/eticpa/mock-exam?level=level-1')), log: 'eticpa mock exam: read failed', label: 'eticpa mock exam load failed' },
])('$name', (route) => {
  it('answers a read problem in plain words and logs the code only', async () => {
    net.failing = true
    const result = await answerOf(await route.run())
    expect(result).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: { error: SERVER_PROBLEM_TEXT } })
    expect(state.logs).toStrictEqual([[route.log, 'XX000']])
    expect(state.reports).toStrictEqual([])
  })

  it('answers an unexpected problem in plain words and reports it once', async () => {
    const problem = new Error('database detail')
    state.clientFails = problem
    const result = await answerOf(await route.run())
    expect(result).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: { error: SERVER_PROBLEM_TEXT } })
    expect(state.reports).toStrictEqual([[route.label, problem, { area: 'public' }]])
    expect(JSON.stringify(result)).not.toContain('database detail')
  })

  it('keeps the empty answer', async () => {
    expect(await answerOf(await route.run())).toStrictEqual({ status: 200, headers: JSON_HEADERS, body: { questions: [], poolTotal: 0 } })
  })
})

describe('recruitment logs', () => {
  const TOKEN = 'update-token-1'

  it.each([
    ['update-candidate', 'job_seeker_registrations', () => updateCandidate(request('/api/recruitment/update-candidate', { method: 'POST', body: { token: TOKEN, phone: '0123' } }))],
    ['update-employer', 'employer_briefs', () => updateEmployer(request('/api/recruitment/update-employer', { method: 'POST', body: { token: TOKEN, contact_phone: '0123' } }))],
  ])('%s logs the short code of a failed update', async (_name, table, run) => {
    net.tables[table] = [{ id: 'row-1', update_token: TOKEN, status: 'active', platform: 'ab', reference_number: 'R-1', full_name: 'A', company_name: 'C', email: 'a@example.com' }]
    net.failMethod = 'PATCH'
    const result = await answerOf(await run())
    expect(result.status).toBe(500)
    expect(state.logs).toStrictEqual([['Update error:', 'XX000']])
  })

  it.each([
    ['update-candidate', 'update-candidate error:', () => updateCandidate],
    ['update-employer', 'update-employer error:', () => updateEmployer],
    ['job-seeker-apply', 'Job seeker apply error:', () => jobSeekerApply],
  ])('%s logs the short code of an unexpected problem', async (name, line, handler) => {
    const problem = Object.assign(new Error('seed detail a@example.com'), { code: 'E_SEED' })
    await handler()(unreadable(request(`/api/recruitment/${name}`, { method: 'POST', body: {} }), problem))
    await handler()(unreadable(request(`/api/recruitment/${name}`, { method: 'POST', body: {} }), new Error('seed detail')))
    expect(state.logs).toStrictEqual([[line, 'E_SEED'], [line, 'no-code']])
  })

  it('job-seeker-apply logs the short code of a failed save', async () => {
    net.failMethod = 'POST'
    const body = {
      full_name: 'Ada Lovelace',
      email: 'ada@example.com',
      location_city: 'London',
      professional_role: 'Accountant',
      qualification: 'ACCA',
      years_experience: '5',
      employment_status: 'employed',
      biography: 'Seed biography text',
      'cf-turnstile-response': 'token',
    }
    const result = await answerOf(await jobSeekerApply(request('/api/recruitment/job-seeker-apply', { method: 'POST', body })))
    expect(result).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: { error: SERVER_PROBLEM_TEXT } })
    expect(state.logs).toStrictEqual([['Supabase insert error:', 'XX000']])
  })
})

describe('article read', () => {
  it('throws a fixed message when the read returns no data', async () => {
    net.nullSingle = true
    await expect(getArticleBySlug('seed-slug-9k2v')).rejects.toThrow(new Error('getArticleBySlug: article read returned no data'))
    expect(state.logs).toHaveLength(1)
    expect(state.logs[0][0]).toBe('getArticleBySlug error:')
    expect(String(state.logs[0][1])).not.toContain('seed-slug')
  })
})

// ── Admin ───────────────────────────────────────────────────────────────────

function withSession(req: NextRequest): NextRequest {
  req.cookies.set(ADMIN_SESSION_COOKIE, session)
  return req
}

describe('admin sign-in', () => {
  const DENIED = { status: 401, headers: JSON_HEADERS, body: { error: 'Access denied.' } }
  const signIn = async (body: unknown) => (await loadAdmin('-auth')).POST(request('/api/admin-tool', { method: 'POST', body }))

  it.each([
    ['sign-in', () => vi.stubEnv('ADMIN_SECRET', '')],
    ['code', () => vi.stubEnv('ADMIN_TOTP_SECRET', '')],
    ['session', () => vi.stubEnv('ADMIN_SESSION_SECRET', '')],
  ])('reports when sign-in is not set up (%s)', async (_name, setup) => {
    setup()
    const { createHmac } = await import('node:crypto')
    const counter = Buffer.alloc(8)
    counter.writeBigUInt64BE(BigInt(Math.floor(NOW / 30_000)))
    const digest = createHmac('sha1', '12345678901234567890').update(counter).digest()
    const offset = digest[digest.length - 1] & 0x0f
    const code = String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0')
    const result = await answerOf(await signIn({ password: TEST_ADMIN_SECRET, totpCode: code }))
    expect(result).toStrictEqual(DENIED)
    expect(state.logs).toStrictEqual([['Admin sign-in is not set up']])
    expect(state.reports).toStrictEqual([['admin sign-in not set up', new Error('sign-in not set up'), { area: 'admin' }]])
  })

  it.each([
    ['wrong password', { password: 'not-the-password', totpCode: '000000' }],
    ['wrong code', { password: TEST_ADMIN_SECRET, totpCode: 'abcdef' }],
    ['missing fields', {}],
  ])('makes no report for an ordinary refusal (%s)', async (_name, body) => {
    expect(await answerOf(await signIn(body))).toStrictEqual(DENIED)
    expect(state.reports).toStrictEqual([])
    expect(state.logs).toStrictEqual([])
  })
})

describe('admin email sends', () => {
  const SENDS = [
    {
      name: 'candidate approval',
      suffix: '/notify-candidate',
      body: { id: 'row-1', status: 'active', email: 'seed-person@example.com', name: 'Seed Person', platform: 'ab' },
      seed: () => { net.tables.job_seeker_registrations = [{ id: 'row-1' }] },
      failed: { error: 'Failed to send email' },
      label: 'admin candidate approval',
    },
    {
      name: 'candidate decision',
      suffix: '/notify-candidate',
      body: { id: 'row-1', status: 'rejected', email: 'seed-person@example.com', name: 'Seed Person', platform: 'ab' },
      seed: () => {},
      failed: { error: 'Failed to send email' },
      label: 'admin candidate decision',
    },
    {
      name: 'reply',
      suffix: '/reply',
      body: { to: 'seed-person@example.com', name: 'Seed Person', subject: 'Seed subject', message: 'Seed message text', platform: 'ab' },
      seed: () => {},
      failed: { error: 'Failed to send reply.' },
      label: 'admin reply',
    },
  ]

  it.each(SENDS)('answers a failed send honestly ($name)', async (send) => {
    send.seed()
    state.emailRefused = true
    const { POST } = await loadAdmin(send.suffix)
    const result = await answerOf(await POST(withSession(request('/api/admin-tool', { method: 'POST', body: send.body }))))
    expect(result).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: send.failed })
    expect(state.emails).toHaveLength(1)
    expect(state.logs).toStrictEqual([[`email: send failed (${send.label}) validation_error 422`]])
    expect(state.reports).toHaveLength(1)
    expect(state.reports[0][0]).toBe(`email: ${send.label}`)
    expect(JSON.stringify([state.logs, state.reports])).not.toMatch(/seed|provider detail/i)
  })

  it.each(SENDS)('keeps the success answer for a sent email ($name)', async (send) => {
    send.seed()
    const { POST } = await loadAdmin(send.suffix)
    const result = await answerOf(await POST(withSession(request('/api/admin-tool', { method: 'POST', body: send.body }))))
    expect(result).toStrictEqual({ status: 200, headers: JSON_HEADERS, body: { success: true } })
    expect(state.emails).toHaveLength(1)
    expect(state.logs).toStrictEqual([])
    expect(state.reports).toStrictEqual([])
  })
})

describe('admin category list', () => {
  it('answers an unexpected problem as an error and reports it once', async () => {
    const problem = new Error('unexpected')
    state.clientFails = problem
    const { GET } = await loadAdmin('/categories')
    const result = await answerOf(await GET(withSession(request('/api/admin-tool'))))
    expect(result).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: { error: 'Could not load categories.' } })
    expect(state.reports).toStrictEqual([['admin category list failed', problem, { area: 'admin' }]])
  })

  it('keeps the empty list', async () => {
    const { GET } = await loadAdmin('/categories')
    expect(await answerOf(await GET(withSession(request('/api/admin-tool'))))).toStrictEqual({ status: 200, headers: JSON_HEADERS, body: { categories: [] } })
  })
})

// ── Source checks ───────────────────────────────────────────────────────────

describe('source checks', () => {
  const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

  it('the orchestrator comment matches its fixed report', () => {
    const text = source('app/api/ingest/orchestrator/route.ts')
    expect(text).toContain('The report below carries a fixed message only.')
    expect(text).not.toContain('Sentry alert')
  })
})
