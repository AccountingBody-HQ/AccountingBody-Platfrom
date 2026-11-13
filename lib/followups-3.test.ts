import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_SESSION_COOKIE, getAdminPath } from './middleware-logic'
import { TEST_ADMIN_SECRET, TEST_SESSION_SECRET, signTestSession } from './admin-session-fixtures'

// Run now starts imports directly; the import runner always answers and
// reports an unexpected stop; the orchestrator closing line names skipped
// imports; admin job answers use fixed text; admin email and import log lines
// carry a short code; database read problems carry a short code.

type Result = { data?: unknown; error?: unknown; count?: number | null; status?: number }

const state = vi.hoisted(() => ({
  reports: [] as unknown[][],
  sentry: [] as unknown[][],
  logs: [] as unknown[][],
  emails: [] as unknown[],
  db: {} as Record<string, Result>,
  clientFails: null as unknown,
  jobFails: null as unknown,
  adapterFails: null as unknown,
  runFails: null as unknown,
  provider: null as Record<string, unknown> | null,
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

// A small stand-in for a supabase-js client: every chain ends with the
// answer set for its table.
vi.mock('@/lib/supabase-server', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/supabase-server')>()
  const client = {
    from(table: string) {
      const chain: Record<string, unknown> = {}
      for (const method of ['select', 'eq', 'contains', 'in', 'order', 'update', 'single', 'limit']) chain[method] = () => chain
      chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(state.db[table] ?? { data: [], error: null, count: 0, status: 200 }).then(resolve, reject)
      return chain
    },
  }
  return {
    ...original,
    getServerSupabase: () => {
      if (state.clientFails) throw state.clientFails
      return client
    },
  }
})

const JOB = { id: 'job-1', title: 'Seed Title', status: 'pending', is_featured: false, manage_token: 'seed-token', contact_email: 'seed-person@example.com' }

vi.mock('@/lib/jobs', () => ({
  getJobById: async (id: string) => (id === JOB.id ? { ...JOB } : null),
  approveJob: async () => {
    if (state.jobFails) throw state.jobFails
    return { ...JOB, status: 'active' }
  },
  rejectJob: async () => ({ ...JOB, status: 'rejected' }),
  expireJob: async () => undefined,
}))

vi.mock('@/lib/jobEmails', () => ({
  sendJobApprovalEmail: async () => undefined,
  sendJobRejectionEmail: async () => undefined,
}))

vi.mock('@/lib/providers', () => ({
  findProvider: async () => state.provider,
  createProviderRun: async () => {
    if (state.runFails) throw state.runFails
    return { id: 'run-1' }
  },
  completeProviderRun: async () => undefined,
  failProviderRun: async () => undefined,
  updateProviderHealth: async () => undefined,
  updateProviderDataQuality: async () => undefined,
  logProviderError: async () => undefined,
  incrementProviderJobsToday: async () => undefined,
  updateProviderKeywordCursor: async () => undefined,
}))

vi.mock('@/lib/adapters', () => ({
  getAdapter: () => {
    if (state.adapterFails) throw state.adapterFails
    return { fetch: async () => ({ jobs: [], pagesFetched: 1, totalAvailable: 0 }) }
  },
}))

// The real runner, watched, so Run now can be checked with set answers.
vi.mock('@/lib/ingestion/run-provider-import', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/ingestion/run-provider-import')>()
  return { ...original, runProviderImport: vi.fn(original.runProviderImport) }
})

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

import { runProviderImport } from '@/lib/ingestion/run-provider-import'
import { closingLogLine, countImports, summariseImport } from '@/lib/ingestion/orchestrator-plan'
import { getCategoryCounts, getPublishedArticleCount, getPublishedQuestionCount, getQuestionSetBySlug, getQuestionSetCount } from '@/lib/db'
import { getCourseBySlug } from '@/lib/coursesNew'
import { resetCacheGuard } from '@/lib/cache-guard'

// The folder comes from the app's own default, so its name is not repeated here.
vi.stubEnv('ADMIN_PATH', undefined)
const folder = getAdminPath()
vi.unstubAllEnvs()

type Handler = (req: NextRequest, context?: unknown) => Promise<Response>
const adminFile = (suffix: string) => join(process.cwd(), 'app', 'api', `${folder}${suffix}`, 'route.ts')
const loadAdmin = (suffix: string): Promise<Record<string, unknown>> => import(/* @vite-ignore */ adminFile(suffix))
const handler = async (suffix: string, method: string) => (await loadAdmin(suffix))[method] as Handler
const sourceOf = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

const SITE = 'https://accountingbody.com'
const JSON_HEADERS = { 'content-type': 'application/json' }
const SEED = /seed|example\.com/i
const runner = vi.mocked(runProviderImport)

const ACTIVE_PROVIDER = {
  id: 'provider-1',
  slug: 'example',
  name: 'Example',
  status: 'active',
  adapter_key: 'example',
  rate_limit_daily: null,
  requests_today: 0,
  field_mapping: { title: 'title', company_name: 'company', application_url: 'url' },
  enforce_relevance: false,
}

function request(path: string, init: { method?: string; body?: unknown } = {}) {
  const text = init.body === undefined ? undefined : JSON.stringify(init.body)
  return new NextRequest(SITE + path, {
    method: init.method ?? 'GET',
    body: text,
    headers: text ? { 'content-type': 'application/json' } : {},
  })
}

let session = ''
function admin(path: string, init: { method?: string; body?: unknown } = {}) {
  const req = request(path, init)
  req.cookies.set(ADMIN_SESSION_COOKIE, session)
  return req
}

async function answerOf(response: Response) {
  const text = await response.text()
  return { status: response.status, headers: { 'content-type': response.headers.get('content-type') ?? '' }, body: text ? JSON.parse(text) : text }
}

// Every log argument is a short string and none holds the admin folder or a seeded value.
function expectPlainLogs() {
  for (const line of state.logs) for (const part of line) expect(typeof part).toBe('string')
  const text = JSON.stringify(state.logs).toLowerCase()
  expect(text).not.toContain(folder.toLowerCase())
  expect(text).not.toMatch(SEED)
}

const seeded = (code?: string) => Object.assign(new Error('seed detail seed-person@example.com'), code ? { code } : {})
const DB_PROBLEM = { message: 'seed database detail seed-person@example.com', code: 'XX000', details: 'seed', hint: null }

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => {
    throw new Error('no network in tests')
  }))
  vi.stubEnv('CRON_SECRET', 'cron-test-value')
  vi.stubEnv('ADMIN_SECRET', TEST_ADMIN_SECRET)
  vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SESSION_SECRET)
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  for (const level of ['error', 'warn', 'log', 'info'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      state.logs.push(args)
    })
  }
  state.reports.length = 0
  state.sentry.length = 0
  state.logs.length = 0
  state.emails.length = 0
  state.db = {}
  state.clientFails = null
  state.jobFails = null
  state.adapterFails = null
  state.runFails = null
  state.provider = { ...ACTIVE_PROVIDER }
  runner.mockClear()
  resetCacheGuard()
  session = await signTestSession()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ── Run now ─────────────────────────────────────────────────────────────────

describe('run now starts the import directly', () => {
  const run = async (signedIn = true) => {
    const POST = await handler('/providers/[slug]/trigger', 'POST')
    const req = signedIn ? admin('/api/admin-tool', { method: 'POST' }) : request('/api/admin-tool', { method: 'POST' })
    return answerOf(await POST(req, { params: Promise.resolve({ slug: 'example' }) }))
  }

  it('runs the import for the slug as a manual run, with no web request', async () => {
    runner.mockResolvedValueOnce({ status: 200, body: { ok: true, inserted: 3, fetched: 5 } })
    expect(await run()).toStrictEqual({ status: 200, headers: JSON_HEADERS, body: { ok: true, inserted: 3, fetched: 5 } })
    expect(runner.mock.calls).toStrictEqual([['example', 'manual']])
    expect(fetch).not.toHaveBeenCalled()
    expect(state.reports).toStrictEqual([])
  })

  it.each([
    ['a skip', 200, { ok: true, skipped: true, reason: 'Daily rate limit reached' }],
    ['a missing provider', 404, { ok: false, error: 'Provider not found' }],
    ['a provider read problem', 503, { ok: false, error: 'Provider could not be read' }],
    ['an unexpected stop', 500, { ok: false, error: 'Import stopped unexpectedly' }],
  ])('passes the import answer on unchanged: %s', async (_name, status, body) => {
    runner.mockResolvedValueOnce({ status, body })
    expect(await run()).toStrictEqual({ status, headers: JSON_HEADERS, body })
    expect(state.reports).toStrictEqual([])
  })

  it('a real run for an inactive provider answers its skip with no web request', async () => {
    state.provider = { ...ACTIVE_PROVIDER, status: 'paused' }
    expect(await run()).toStrictEqual({ status: 200, headers: JSON_HEADERS, body: { ok: true, skipped: true, reason: 'Provider inactive' } })
    expect(runner.mock.calls).toStrictEqual([['example', 'manual']])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('answers "Not configured" without the scheduled-import secret and never runs the import', async () => {
    vi.stubEnv('CRON_SECRET', '')
    expect(await run()).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: { ok: false, error: 'Not configured' } })
    expect(runner).not.toHaveBeenCalled()
    expect(state.reports).toStrictEqual([])
  })

  it('a signed-out request gets the usual 401 and never runs the import', async () => {
    const result = await run(false)
    expect(result.status).toBe(401)
    expect(result.body).toStrictEqual({ error: 'Signed out' })
    expect(runner).not.toHaveBeenCalled()
    expect(state.reports).toStrictEqual([])
  })

  it('a stop while starting answers "Run failed", logs the code only and reports once', async () => {
    const problem = seeded('E_TEST1')
    runner.mockRejectedValueOnce(problem)
    expect(await run()).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: { ok: false, error: 'Run failed' } })
    expect(state.logs).toStrictEqual([['admin provider run start failed', 'E_TEST1']])
    expect(state.reports).toStrictEqual([['admin provider run start failed', problem, { area: 'admin' }]])
    expectPlainLogs()
  })

  it('allows the same running time as the scheduled import', async () => {
    expect((await loadAdmin('/providers/[slug]/trigger')).maxDuration).toBe(300)
  })
})

// ── Import runner ───────────────────────────────────────────────────────────

describe('the import runner always answers', () => {
  it.each([
    ['an Error with a code', () => seeded('E_TEST1')],
    ['a value that is not an Error', () => 'seed detail seed-person@example.com'],
  ])('a stop outside its own steps gives a fixed 500 answer, one fixed log line and one report: %s', async (_name, make) => {
    const problem = make()
    state.runFails = problem
    await expect(runProviderImport('example', 'cron')).resolves.toStrictEqual({ status: 500, body: { ok: false, error: 'Import stopped unexpectedly' } })
    expect(state.logs).toStrictEqual([['[ingest/example] import stopped unexpectedly']])
    expect(state.reports).toStrictEqual([['job import stopped unexpectedly', problem, { area: 'ingest' }]])
    expect(state.sentry).toStrictEqual([])
    expectPlainLogs()
  })

  it('a healthy run makes no report', async () => {
    const result = await runProviderImport('example', 'cron')
    expect(result.status).toBe(200)
    expect(state.reports).toStrictEqual([])
  })

  it('a failed run logs its fixed line with the short code only', async () => {
    const problem = seeded('E_TEST1')
    state.adapterFails = problem
    state.db.job_providers = { data: null, error: null, status: 200 }
    const result = await runProviderImport('example', 'cron')
    expect(result.status).toBe(500)
    expect(state.logs).toStrictEqual([['[ingest/example] Fatal error:', 'E_TEST1']])
    expect(state.reports).toStrictEqual([['job import run failed', problem, { area: 'ingest' }]])
    expectPlainLogs()
  })

  it('a failed run with no usable code logs no-code', async () => {
    state.adapterFails = Object.assign(new Error('seed detail'), { code: 'seed person@example.com' })
    state.db.job_providers = { data: null, error: null, status: 200 }
    await runProviderImport('example', 'cron')
    expect(state.logs).toStrictEqual([['[ingest/example] Fatal error:', 'no-code']])
    expectPlainLogs()
  })
})

// ── Orchestrator closing line ───────────────────────────────────────────────

describe('the orchestrator closing line names skipped imports', () => {
  it('counts skipped imports in the closing line', () => {
    const results = [
      summariseImport('a', { status: 'fulfilled', value: { status: 200, body: { ok: true } } }),
      summariseImport('b', { status: 'fulfilled', value: { status: 200, body: { ok: true, skipped: true } } }),
      summariseImport('c', { status: 'fulfilled', value: { status: 200, body: { ok: true, skipped: true } } }),
      summariseImport('d', { status: 'fulfilled', value: { status: 500, body: { ok: false } } }),
    ]
    expect(closingLogLine(countImports(results, 7))).toBe('[orchestrator] imports: 4 started, 1 ok, 2 skipped, 1 failed, 3 still due')
  })

  it('keeps the order of the counts', () => {
    expect(closingLogLine({ started: 1, ok: 0, skipped: 1, failed: 0, stillDue: 0 })).toBe('[orchestrator] imports: 1 started, 0 ok, 1 skipped, 0 failed, 0 still due')
  })
})

// ── Admin job answers ───────────────────────────────────────────────────────

describe('admin job answers use fixed text', () => {
  const patch = async (body: unknown) => {
    const PATCH = await handler('/jobs/[id]', 'PATCH')
    return answerOf(await PATCH(admin('/api/admin-tool', { method: 'PATCH', body }), { params: Promise.resolve({ id: JOB.id }) }))
  }
  const close = async () => {
    const DELETE = await handler('/jobs/[id]', 'DELETE')
    return answerOf(await DELETE(admin('/api/admin-tool', { method: 'DELETE' }), { params: Promise.resolve({ id: JOB.id }) }))
  }

  it('an update problem answers "Job update failed", logs the code and reports once', async () => {
    const problem = seeded('E_TEST1')
    state.jobFails = problem
    expect(await patch({ action: 'approve' })).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: { error: 'Job update failed' } })
    expect(state.logs).toStrictEqual([['admin job update failed', 'E_TEST1']])
    expect(state.reports).toStrictEqual([['admin job update failed', problem, { area: 'admin' }]])
    expectPlainLogs()
  })

  it('a database problem on a notes update answers the same fixed text', async () => {
    state.db.jobs = { data: null, error: DB_PROBLEM, status: 500 }
    expect(await patch({ action: 'update_notes', admin_notes: 'x' })).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: { error: 'Job update failed' } })
    expect(state.logs).toStrictEqual([['admin job update failed', 'XX000']])
    expectPlainLogs()
  })

  it('a close problem answers "Job close failed" and logs the code only', async () => {
    state.db.jobs = { data: null, error: DB_PROBLEM, status: 500 }
    expect(await close()).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: { error: 'Job close failed' } })
    expect(state.logs).toStrictEqual([['admin job close failed', 'XX000']])
    expect(state.reports).toStrictEqual([])
    expectPlainLogs()
  })

  it('a healthy close and update keep their answers', async () => {
    state.db.jobs = { data: null, error: null, status: 204 }
    expect(await close()).toStrictEqual({ status: 200, headers: JSON_HEADERS, body: { success: true } })
    expect((await patch({ action: 'approve' })).status).toBe(200)
    expect(state.logs).toStrictEqual([])
  })
})

// ── Admin email log lines ───────────────────────────────────────────────────

describe('admin email problems log a short code', () => {
  it.each([
    ['/notify-firm', { id: 'app-1', status: 'approved' }, 'notify-firm error:', 'admin firm email failed'],
    ['/notify-candidate', { id: 'c-1', status: 'active', email: 'seed-person@example.com', name: 'Seed Person', platform: 'ab' }, 'notify-candidate error:', 'admin candidate email failed'],
  ])('%s logs its fixed line and code, keeps its answer and reports once', async (suffix, body, line, label) => {
    const problem = seeded('E_TEST1')
    state.clientFails = problem
    const POST = await handler(suffix, 'POST')
    expect(await answerOf(await POST(admin('/api/admin-tool', { method: 'POST', body })))).toStrictEqual({
      status: 500,
      headers: JSON_HEADERS,
      body: { error: 'Failed to send email' },
    })
    expect(state.logs).toStrictEqual([[line, 'E_TEST1']])
    expect(state.reports).toStrictEqual([[label, problem, { area: 'admin' }]])
    expect(state.emails).toStrictEqual([])
    expectPlainLogs()
  })

  it.each(['/notify-firm', '/notify-candidate'])('%s logs no-code when there is no usable code', async (suffix) => {
    state.clientFails = 'seed detail seed-person@example.com'
    const POST = await handler(suffix, 'POST')
    await POST(admin('/api/admin-tool', { method: 'POST', body: { id: 'x', status: 'approved' } }))
    expect(state.logs).toHaveLength(1)
    expect(state.logs[0][1]).toBe('no-code')
    expectPlainLogs()
  })
})

// ── Database read problems ──────────────────────────────────────────────────

describe('database read problems carry a short code', () => {
  const thrownBy = async (run: () => Promise<unknown>) => run().then(() => null, (error: unknown) => error as Error & { code?: string })

  it.each([
    ['question set count', 'question_sets', () => getQuestionSetCount(), 'question set count query failed (status 500)', 'question set count read failed'],
    ['question count', 'questions', () => getPublishedQuestionCount(), 'question count query failed (status 500)', 'question count read failed'],
    ['article count', 'articles', () => getPublishedArticleCount('ab'), 'article count query failed (status 500)', 'article count read failed'],
  ])('%s: the problem has fixed text, the status and the code; the reader still answers 0', async (_name, table, run, message, label) => {
    state.db[table] = { count: null, error: DB_PROBLEM, status: 500 }
    expect(await run()).toBe(0)
    expect(state.reports).toHaveLength(1)
    const [reported, problem] = state.reports[0] as [string, Error & { code?: string }]
    expect(reported).toBe(label)
    expect(problem).toBeInstanceOf(Error)
    expect(problem.message).toBe(message)
    expect(problem.code).toBe('XX000')
    expect(JSON.stringify([problem.message, problem.stack])).not.toMatch(SEED)
  })

  it('category counts: each problem has fixed text and the code', async () => {
    state.db.articles = { count: null, error: DB_PROBLEM, status: 500 }
    const counts = await getCategoryCounts()
    expect(Object.values(counts).every((value) => value === 0)).toBe(true)
    expect(state.reports.length).toBeGreaterThan(0)
    for (const [label, problem] of state.reports as [string, Error & { code?: string }][]) {
      expect(label).toBe('article category count read failed')
      expect(problem.message).toBe('category count query failed (status 500)')
      expect(problem.code).toBe('XX000')
    }
  })

  it('question set page: the problem has fixed text, the status and the code', async () => {
    state.db.question_sets = { data: null, error: DB_PROBLEM, status: 500 }
    const thrown = await thrownBy(() => getQuestionSetBySlug('seed-slug-k4'))
    expect(thrown?.message).toBe('getQuestionSetBySlug: question_sets query failed (status 500)')
    expect(thrown?.code).toBe('XX000')
  })

  it('question set page: an empty answer names no slug', async () => {
    state.db.question_sets = { data: null, error: null, status: 200 }
    const thrown = await thrownBy(() => getQuestionSetBySlug('seed-slug-k4'))
    expect(thrown?.message).toBe('getQuestionSetBySlug: empty response')
  })

  it('a code that does not look like a code is left off', async () => {
    state.db.question_sets = { data: null, error: { ...DB_PROBLEM, code: 'seed person@example.com' }, status: 500 }
    const thrown = await thrownBy(() => getQuestionSetBySlug('s'))
    expect(thrown?.code).toBeUndefined()
  })

  const COURSE = { id: 'course-1', title: 'Seed Course', slug: 'seed-course', status: 'published', is_featured: false, show_on_sites: ['ab'], canonical_owner: 'ab' }

  it.each([
    ['courses', {}, 'getCourseBySlug: courses query failed (status 500)'],
    ['course_chapters', { courses: { data: COURSE, error: null, status: 200 } }, 'getCourseBySlug: course_chapters query failed'],
    ['course_lessons', { courses: { data: COURSE, error: null, status: 200 } }, 'getCourseBySlug: course_lessons query failed'],
    ['course_lesson_articles', { courses: { data: COURSE, error: null, status: 200 }, course_lessons: { data: [{ id: 'l1' }], error: null } }, 'getCourseBySlug: course_lesson_articles query failed'],
    ['articles', { courses: { data: COURSE, error: null, status: 200 }, course_lessons: { data: [{ id: 'l1' }], error: null }, course_lesson_articles: { data: [{ lesson_id: 'l1', article_order: 1, article_id: 'a1' }], error: null } }, 'getCourseBySlug: articles query failed'],
  ] as [string, Record<string, Result>, string][])('course read (%s): the problem has fixed text, the table name and the code', async (table, healthy, message) => {
    state.db = { ...healthy, [table]: { data: null, error: DB_PROBLEM, status: 500 } }
    const thrown = await thrownBy(() => getCourseBySlug('seed-course'))
    expect(thrown?.message).toBe(message)
    expect(thrown?.code).toBe('XX000')
    expect(state.logs.map((line) => line.map(String).join(' ')).join('\n')).not.toMatch(/seed database detail|seed-person/)
  })

  it('course read: an empty answer names no slug', async () => {
    state.db.courses = { data: null, error: null, status: 200 }
    const thrown = await thrownBy(() => getCourseBySlug('seed-course-k4'))
    expect(thrown?.message).toBe('getCourseBySlug: empty response')
  })
})

// ── Source checks ───────────────────────────────────────────────────────────

describe('source checks', () => {
  const ADMIN_ROUTES = ['/providers/[slug]/trigger', '/jobs/[id]', '/notify-firm', '/notify-candidate']
  const adminSource = (suffix: string) => readFileSync(adminFile(suffix), 'utf8')

  it('run now names no web address of its own and calls the runner as a manual run', () => {
    const source = adminSource('/providers/[slug]/trigger')
    expect(source).not.toMatch(/\bfetch\(/)
    expect(source).not.toContain('/api/ingest/')
    expect(source).not.toContain('NEXT_PUBLIC_SITE_URL')
    expect(source).toContain("runProviderImport(slug, 'manual')")
    expect(source).toMatch(/^export const maxDuration = 300$/m)
  })

  it('run now checks the session, then the secret, then runs the import', () => {
    const source = adminSource('/providers/[slug]/trigger')
    const signedIn = source.indexOf('if (!(await isAuthenticated(req))) {')
    const secret = source.indexOf('if (!cronSecret) {')
    const start = source.indexOf('runProviderImport(slug')
    expect(signedIn).toBeGreaterThan(0)
    expect(signedIn).toBeLessThan(secret)
    expect(secret).toBeLessThan(start)
  })

  it.each(ADMIN_ROUTES)('%s answers no raw problem text and names no admin folder', (suffix) => {
    const source = adminSource(suffix)
    expect(source).not.toMatch(/\b(err|error)\.message\b/)
    expect(source.toLowerCase()).not.toContain(folder.toLowerCase())
    expect(source).not.toContain('@sentry/nextjs')
  })

  it.each(['lib/db.ts', 'lib/coursesNew.ts'])('%s throws no database text and no slug', (path) => {
    const source = sourceOf(path)
    expect(source).not.toMatch(/throw new Error\(.*(rror|Error)\.message/)
    expect(source).not.toContain('empty response for')
    expect(source.toLowerCase()).not.toContain(folder.toLowerCase())
  })

  it('the import runner reports an unexpected stop with its fixed label and area only', () => {
    const source = sourceOf('lib/ingestion/run-provider-import.ts')
    expect(source.match(/reportServerError\('job import stopped unexpectedly'[^\n]*/g)).toStrictEqual([
      "reportServerError('job import stopped unexpectedly', err, { area: 'ingest' })",
    ])
    expect(source).toContain("console.error(`[ingest/${slug}] Fatal error:`, shortCode(err))")
    expect(source).not.toContain('@sentry/nextjs')
  })

  it('the new report label is listed once in the label list', () => {
    const list = sourceOf('lib/no-direct-sentry.test.ts')
    expect(list.match(/'job import stopped unexpectedly'/g)).toHaveLength(1)
  })
})
