import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_SESSION_COOKIE, getAdminPath } from './middleware-logic'
import { TEST_ADMIN_SECRET, TEST_SESSION_SECRET, signTestSession } from './admin-session-fixtures'

// Import log lines and insert notes carry a short code; job and provider
// read problems carry fixed text and a short code; the course list and admin
// job reads answer with fixed text.

type Result = { data?: unknown; error?: unknown; count?: number | null; status?: number }

const state = vi.hoisted(() => ({
  reports: [] as unknown[][],
  sentry: [] as unknown[][],
  logs: [] as unknown[][],
  db: {} as Record<string, Result>,
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

// A small stand-in for a supabase-js client: any chain of calls ends with the
// answer set for its table.
vi.mock('@/lib/supabase-server', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/supabase-server')>()
  const chainFor = (table: string): unknown => {
    const answer = () => Promise.resolve(state.db[table] ?? { data: [], error: null, count: 0, status: 200 })
    const chain: unknown = new Proxy(() => chain, {
      get: (_target, prop) =>
        prop === 'then'
          ? (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => answer().then(resolve, reject)
          : () => chain,
    })
    return chain
  }
  return { ...original, getServerSupabase: () => ({ from: (table: string) => chainFor(table) }) }
})

vi.mock('@/lib/providers', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/providers')>()
  return {
    ...original,
    findProvider: vi.fn(),
    createProviderRun: vi.fn(),
    completeProviderRun: vi.fn(),
    failProviderRun: vi.fn(),
    updateProviderHealth: vi.fn(),
    updateProviderDataQuality: vi.fn(),
    logProviderError: vi.fn(),
    incrementProviderJobsToday: vi.fn(),
    updateProviderKeywordCursor: vi.fn(),
  }
})

vi.mock('@/lib/adapters', () => ({ getAdapter: vi.fn() }))
vi.mock('@/lib/ingestion/normalise', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ingestion/normalise')>()),
  normalise: vi.fn((raw: Record<string, unknown>) => ({ ...raw, raw_source_data: raw })),
}))
vi.mock('@/lib/ingestion/validate', () => ({
  validate: vi.fn((jobs: unknown[]) => ({ valid: jobs, rejected: [] })),
}))
vi.mock('@/lib/ingestion/deduplicate', () => ({
  deduplicate: vi.fn(async (jobs: unknown[]) => ({ toInsert: jobs, duplicateCount: 0 })),
}))
vi.mock('@/lib/ingestion/quality', () => ({
  computeQualityMetrics: vi.fn(() => ({ status: 'ok', relevanceRate: 1, avgDescriptionLength: 10, fieldCoverage: {} })),
}))
vi.mock('@/lib/provider-alerts', () => ({
  deriveAlertState: vi.fn(() => 'ok'),
  maybeSendProviderAlert: vi.fn(),
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

import * as providers from '@/lib/providers'
import { getAdapter } from '@/lib/adapters'
import { maybeSendProviderAlert } from '@/lib/provider-alerts'
import { runProviderImport } from '@/lib/ingestion/run-provider-import'
import {
  getActiveDirectJobs,
  getBrowsableJobsTotal,
  getCachedListingJobs,
  getJobById,
  getJobBySlug,
  getSimilarJobs,
} from '@/lib/jobs'
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
const adminSource = (suffix: string) => readFileSync(adminFile(suffix), 'utf8')

const SITE = 'https://accountingbody.com'
const SEED = /seed|example\.com/i
const SEED_SLUG = 'seed-slug-example'

const PROVIDER = {
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

const seeded = (code?: string) => Object.assign(new Error('seed detail seed-person@example.com'), code ? { code } : {})
const DB_PROBLEM = { message: 'seed database detail seed-person@example.com', code: 'XX000', details: 'seed', hint: null }
const failedRead = (status = 500): Result => ({ data: null, error: DB_PROBLEM, status })

let session = ''
function admin(path: string, init: { method?: string; body?: unknown } = {}) {
  const text = init.body === undefined ? undefined : JSON.stringify(init.body)
  const req = new NextRequest(SITE + path, {
    method: init.method ?? 'GET',
    body: text,
    headers: text ? { 'content-type': 'application/json' } : {},
  })
  req.cookies.set(ADMIN_SESSION_COOKIE, session)
  return req
}

async function answerOf(response: Response) {
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : text }
}

// Every log argument is a short string and none holds the admin folder or a seeded value.
function expectPlainLogs() {
  for (const line of state.logs) for (const part of line) expect(typeof part).toBe('string')
  const text = JSON.stringify(state.logs).toLowerCase()
  expect(text).not.toContain(folder.toLowerCase())
  expect(text).not.toMatch(SEED)
}

async function thrownBy(run: () => Promise<unknown>): Promise<Error & { code?: string }> {
  try {
    await run()
  } catch (problem) {
    return problem as Error & { code?: string }
  }
  throw new Error('expected a thrown problem')
}

function expectFixedProblem(problem: Error & { code?: string }, message: string, code: string | null = 'XX000') {
  expect(problem).toBeInstanceOf(Error)
  expect(problem.message).toBe(message)
  expect(problem.code ?? null).toBe(code)
  expect(JSON.stringify({ message: problem.message, code: problem.code })).not.toMatch(SEED)
  expect(problem.message).not.toContain(SEED_SLUG)
}

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => {
    throw new Error('no network in tests')
  }))
  vi.stubEnv('ADMIN_SECRET', TEST_ADMIN_SECRET)
  vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SESSION_SECRET)
  for (const level of ['error', 'warn', 'log', 'info'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      state.logs.push(args)
    })
  }
  state.reports.length = 0
  state.sentry.length = 0
  state.logs.length = 0
  state.db = {}
  resetCacheGuard()

  vi.mocked(providers.findProvider).mockReset().mockResolvedValue({ ...PROVIDER } as never)
  vi.mocked(providers.createProviderRun).mockReset().mockResolvedValue({ id: 'run-1' } as never)
  for (const name of [
    'completeProviderRun', 'failProviderRun', 'updateProviderHealth', 'updateProviderDataQuality',
    'logProviderError', 'incrementProviderJobsToday', 'updateProviderKeywordCursor',
  ] as const) {
    vi.mocked(providers[name]).mockReset().mockResolvedValue(undefined as never)
  }
  vi.mocked(maybeSendProviderAlert).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(getAdapter).mockReset().mockReturnValue({
    fetch: vi.fn().mockResolvedValue({ jobs: [{ title: 'Role', slug: 'role-1' }], pagesFetched: 1, totalAvailable: 1 }),
  } as never)
  session = await signTestSession()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ── Import runner log lines and insert notes ────────────────────────────────

describe('import runner log lines', () => {
  it.each([
    ['the short code', 'XX000'],
    ['no-code when there is none', undefined],
  ])('side steps that fail log their fixed line with %s', async (_name, code) => {
    state.db.jobs = { data: [{ id: 'job-1' }], error: null }
    vi.mocked(getAdapter).mockReturnValue({
      fetch: vi.fn().mockResolvedValue({ jobs: [{ title: 'Role', slug: 'role-1' }], pagesFetched: 1, totalAvailable: 1, nextCursor: 3 }),
    } as never)
    vi.mocked(providers.updateProviderDataQuality).mockRejectedValue(seeded(code))
    vi.mocked(providers.updateProviderKeywordCursor).mockRejectedValue(seeded(code))
    vi.mocked(providers.incrementProviderJobsToday).mockRejectedValue(seeded(code))
    vi.mocked(maybeSendProviderAlert).mockRejectedValue(seeded(code))

    const result = await runProviderImport('example', 'cron')

    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ ok: true, provider: 'example', fetched: 1, inserted: 1 })
    const shown = code ?? 'no-code'
    expect(state.logs).toStrictEqual([
      ['[ingest] quality metrics failed:', shown],
      ['[ingest] keyword cursor update failed:', shown],
      ['[ingest] jobs_today counter failed:', shown],
      ['[ingest] provider alert failed:', shown],
    ])
    expect(state.reports).toStrictEqual([])
    expectPlainLogs()
  })

  it('a failed insert logs its fixed line and lists the job with the short code', async () => {
    state.db.jobs = { data: null, error: DB_PROBLEM }

    const result = await runProviderImport('example', 'cron')

    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ ok: true, inserted: 0, insertErrors: ['role-1: XX000'] })
    expect(state.logs).toStrictEqual([
      ['[ingest/example] Batch insert failed, falling back to individual inserts:', 'XX000'],
    ])
    expect(JSON.stringify(result.body)).not.toMatch(SEED)
    expect(providers.logProviderError).toHaveBeenCalledTimes(1)
    expectPlainLogs()
  })

  it('a failed insert with no code lists the job with no-code', async () => {
    state.db.jobs = { data: null, error: { message: 'seed database detail', code: '' } }

    const result = await runProviderImport('example', 'cron')

    expect(result.body).toMatchObject({ insertErrors: ['role-1: no-code'] })
    expect(state.logs).toStrictEqual([
      ['[ingest/example] Batch insert failed, falling back to individual inserts:', 'no-code'],
    ])
    expectPlainLogs()
  })

  it('an existing job still counts as deduplicated with no log line', async () => {
    state.db.jobs = { data: null, error: { message: 'duplicate key value', code: '23505' } }

    const result = await runProviderImport('example', 'cron')

    expect(result.body).toMatchObject({ ok: true, inserted: 0, deduplicated: 1 })
    expect((result.body as Record<string, unknown>).insertErrors).toBeUndefined()
    expect(state.logs).toStrictEqual([])
  })

  it('a failed alert after a failed run logs its fixed line with the short code', async () => {
    vi.mocked(getAdapter).mockReturnValue({ fetch: vi.fn().mockRejectedValue(seeded('XX001')) } as never)
    state.db.job_providers = {
      data: { consecutive_failures: 2, health_status: 'failing', status: 'active', data_quality_status: null },
      error: null,
    }
    vi.mocked(maybeSendProviderAlert).mockRejectedValue(seeded('XX000'))

    const result = await runProviderImport('example', 'cron')

    expect(result.status).toBe(500)
    expect(state.logs).toStrictEqual([
      ['[ingest] provider alert failed (failure path):', 'XX000'],
      ['[ingest/example] Fatal error:', 'XX001'],
    ])
    expect(state.reports.map((report) => report[0])).toStrictEqual(['job import run failed'])
    expectPlainLogs()
  })
})

// ── Job and provider read problems ──────────────────────────────────────────

describe('job read problems', () => {
  it('job count for a search: fixed text and the code', async () => {
    state.db.jobs = failedRead()
    expectFixedProblem(
      await thrownBy(() => getActiveDirectJobs({ platform: 'ab', countOnly: true })),
      'getActiveDirectJobs: count query failed',
    )
  })

  it('default jobs list: fixed text and the code', async () => {
    state.db.jobs = failedRead()
    expectFixedProblem(
      await thrownBy(() => getCachedListingJobs({ platform: 'ab', limit: 24, offset: 24 })),
      'default jobs list query failed',
    )
  })

  it('job by id: fixed text, status and the code', async () => {
    state.db.jobs = failedRead()
    expectFixedProblem(await thrownBy(() => getJobById('job-1')), 'getJobById: jobs query failed (status 500)')
  })

  it('job by id: a problem with no usable code carries none', async () => {
    state.db.jobs = { data: null, error: { message: 'seed database detail', code: 'not a short code!' }, status: 500 }
    expectFixedProblem(await thrownBy(() => getJobById('job-1')), 'getJobById: jobs query failed (status 500)', null)
  })

  it('job by id: zero rows still reads as not found', async () => {
    state.db.jobs = { data: null, error: { message: 'seed', code: 'PGRST116' }, status: 406 }
    expect(await getJobById('job-1')).toBeNull()
  })

  it('job by slug: fixed text, status and the code', async () => {
    state.db.jobs = failedRead()
    expectFixedProblem(await thrownBy(() => getJobBySlug(SEED_SLUG)), 'getJobBySlug: jobs query failed (status 500)')
  })

  it('job by slug: an empty answer names no slug', async () => {
    state.db.jobs = { data: null, error: null, status: 200 }
    const problem = await thrownBy(() => getJobBySlug(SEED_SLUG))
    expect(problem.message).toBe('getJobBySlug: empty response')
  })

  it('similar jobs: each step logs fixed text and the code', async () => {
    vi.stubEnv('SIMILAR_JOBS_ENABLED', 'true')
    state.db.jobs = failedRead()

    const result = await getSimilarJobs({
      excludeId: 'job-1', platform: 'ab', title: 'Senior Practice Accountant', locationCountry: 'United Kingdom',
    })

    expect(result).toStrictEqual([])
    const problems = state.logs.map((line) => line[1] as Error & { code?: string })
    expect(problems.map((problem) => problem.message)).toStrictEqual([
      'getSimilarJobs: and query failed',
      'getSimilarJobs: or query failed',
      'getSimilarJobs: or query failed',
      'getSimilarJobs: fallback query failed',
    ])
    for (const problem of problems) expectFixedProblem(problem, problem.message)
  })

  it('similar jobs stay off by default and read nothing', async () => {
    state.db.jobs = failedRead()
    expect(await getSimilarJobs({ excludeId: 'job-1', platform: 'ab', title: 'Senior Practice Accountant', locationCountry: 'United Kingdom' })).toStrictEqual([])
    expect(state.logs).toStrictEqual([])
  })

  it('jobs count: fixed text, status and the code in its one report', async () => {
    vi.stubEnv('JOBS_TOTAL_SOURCE', 'estimate')
    state.db.jobs = failedRead()

    expect(await getBrowsableJobsTotal('ab')).toBeNull()

    expect(state.reports).toHaveLength(1)
    expect(state.reports[0][0]).toBe('job count read failed')
    expectFixedProblem(state.reports[0][1] as Error, 'jobs count query failed (status 500)')
    expectPlainLogs()
  })
})

describe('provider read problems', () => {
  it('running imports read: fixed text and the code', async () => {
    state.db.provider_runs = failedRead()
    expectFixedProblem(
      await thrownBy(() => providers.getProvidersDueForFetch()),
      'getProvidersDueForFetch: running-runs query failed',
    )
  })

  it('due providers read: fixed text and the code', async () => {
    state.db.provider_runs = { data: [], error: null }
    state.db.job_providers = failedRead()
    expectFixedProblem(
      await thrownBy(() => providers.getProvidersDueForFetch()),
      'getProvidersDueForFetch: due-providers query failed',
    )
  })

  it('due providers read: a healthy answer is passed through', async () => {
    state.db.provider_runs = { data: [], error: null }
    state.db.job_providers = { data: [{ id: 'provider-1', slug: 'example' }], error: null }
    expect(await providers.getProvidersDueForFetch()).toStrictEqual([{ id: 'provider-1', slug: 'example' }])
  })
})

// ── Admin course list ───────────────────────────────────────────────────────

describe('admin course list', () => {
  const call = async () => (await handler('/course-factory/load-course', 'GET'))(admin(`/api/${folder}/course-factory/load-course?action=list`))

  it('a list problem answers "Course list failed" and logs the code only', async () => {
    state.db.courses = { data: null, error: DB_PROBLEM }
    expect(await answerOf(await call())).toStrictEqual({ status: 500, body: { error: 'Course list failed' } })
    expect(state.logs).toStrictEqual([['admin course list failed', 'XX000']])
    expect(state.reports).toStrictEqual([])
    expectPlainLogs()
  })

  it('a healthy list answers the courses as before', async () => {
    state.db.courses = {
      data: [{ id: 'c1', title: 'Course', slug: 'course', status: 'published', level: 'beginner', course_chapters: [{ id: 'x' }] }],
      error: null,
    }
    expect(await answerOf(await call())).toStrictEqual({
      status: 200,
      body: { courses: [{ _id: 'c1', title: 'Course', slug: 'course', status: 'published', level: 'beginner', chapterCount: 1 }] },
    })
    expect(state.logs).toStrictEqual([])
  })

  it('a signed-out call answers 401 and logs and reports nothing', async () => {
    state.db.courses = { data: null, error: DB_PROBLEM }
    session = 'not-a-session'
    expect((await call()).status).toBe(401)
    expect(state.logs).toStrictEqual([])
    expect(state.reports).toStrictEqual([])
  })
})

// ── Admin job reads ─────────────────────────────────────────────────────────

describe('admin job reads', () => {
  const ROW = { id: 'job-1', title: 'Role', status: 'active', is_featured: false }
  const context = { params: Promise.resolve({ id: 'job-1' }) }
  const calls: [string, () => Promise<Response>][] = [
    ['GET', async () => (await handler('/jobs/[id]', 'GET'))(admin(`/api/${folder}/jobs/job-1`), context)],
    ['PATCH', async () => (await handler('/jobs/[id]', 'PATCH'))(admin(`/api/${folder}/jobs/job-1`, { method: 'PATCH', body: { action: 'expire' } }), context)],
    ['DELETE', async () => (await handler('/jobs/[id]', 'DELETE'))(admin(`/api/${folder}/jobs/job-1`, { method: 'DELETE' }), context)],
  ]

  it.each(calls)('%s: a read problem answers "Job read failed" with a code-only log and one report', async (_method, call) => {
    state.db.jobs = failedRead()
    expect(await answerOf(await call())).toStrictEqual({ status: 500, body: { error: 'Job read failed' } })
    expect(state.logs).toStrictEqual([['admin job read failed', 'XX000']])
    expect(state.reports).toHaveLength(1)
    const [label, problem, extras] = state.reports[0]
    expect(label).toBe('admin job read failed')
    expect(extras).toStrictEqual({ area: 'admin' })
    expectFixedProblem(problem as Error, 'getJobById: jobs query failed (status 500)')
    expectPlainLogs()
  })

  it.each(calls)('%s: a missing job still answers "Job not found"', async (_method, call) => {
    state.db.jobs = { data: null, error: { message: 'seed', code: 'PGRST116' }, status: 406 }
    expect(await answerOf(await call())).toStrictEqual({ status: 404, body: { error: 'Job not found' } })
    expect(state.logs).toStrictEqual([])
    expect(state.reports).toStrictEqual([])
  })

  it.each(calls)('%s: a signed-out call answers 401 and reads nothing', async (_method, call) => {
    state.db.jobs = failedRead()
    session = 'not-a-session'
    expect((await call()).status).toBe(401)
    expect(state.logs).toStrictEqual([])
    expect(state.reports).toStrictEqual([])
  })

  it('GET answers the job as before', async () => {
    state.db.jobs = { data: ROW, error: null, status: 200 }
    expect(await answerOf(await calls[0][1]())).toStrictEqual({ status: 200, body: { job: ROW } })
  })

  it('DELETE closes the job as before', async () => {
    state.db.jobs = { data: ROW, error: null, status: 200 }
    expect(await answerOf(await calls[2][1]())).toStrictEqual({ status: 200, body: { success: true } })
    expect(state.reports).toStrictEqual([])
  })
})

// ── Source checks ───────────────────────────────────────────────────────────

describe('source checks', () => {
  it('the import runner logs short codes, not message text', () => {
    const source = sourceOf('lib/ingestion/run-provider-import.ts')
    for (const line of [
      "console.error('[ingest] quality metrics failed:', shortCode(qualityErr))",
      'console.warn(`[ingest/${slug}] Batch insert failed, falling back to individual inserts:`, shortCode(error))',
      'insertErrors.push(`${job.slug}: ${shortCode(singleError)}`)',
      'shortCode(cursorErr))',
      "console.error('[ingest] jobs_today counter failed:', shortCode(counterErr))",
      "console.error('[ingest] provider alert failed:', shortCode(alertErr))",
      "console.error('[ingest] provider alert failed (failure path):', shortCode(alertErr))",
    ]) expect(source).toContain(line)
    expect(source).not.toMatch(/console\.(error|warn)\([^\n]*\.message/)
    expect(source).not.toMatch(/insertErrors\.push\([^\n]*\.message/)
  })

  it.each([
    ['lib/jobs.ts', ['getActiveDirectJobs: count query failed', 'default jobs list query failed', 'getJobById', 'getJobBySlug', 'getSimilarJobs', 'jobs count query failed']],
    ['lib/providers.ts', ['getProvidersDueForFetch']],
  ])('%s: the listed reads throw fixed text only', (path, names) => {
    const source = sourceOf(path)
    const throws = source.split('\n').filter((line) => /\bthrow\b/.test(line) && names.some((name) => line.includes(name)))
    expect(throws.length).toBeGreaterThan(0)
    for (const line of throws) {
      expect(line).not.toMatch(/\.message/)
      expect(line).not.toMatch(/\$\{slug\}/)
    }
    expect(source).not.toContain('empty response for')
    expect(source).not.toContain('@sentry/nextjs')
  })

  it.each(['/course-factory/load-course', '/jobs/[id]'])('%s answers fixed text only', (suffix) => {
    const source = adminSource(suffix)
    expect(source).not.toMatch(/(error|err)\.message/)
    expect(source).not.toContain('@sentry/nextjs')
  })

  it('the admin job route names no folder and reports its read problem once', () => {
    const source = adminSource('/jobs/[id]')
    expect(source.toLowerCase()).not.toContain(folder.toLowerCase())
    expect(source.match(/reportServerError\('admin job read failed'[^\n]*/g)).toStrictEqual([
      "reportServerError('admin job read failed', err, { area: 'admin' })",
    ])
  })

  it('each admin job handler checks the session before it reads the job', () => {
    const source = adminSource('/jobs/[id]')
    for (const method of ['GET', 'PATCH', 'DELETE']) {
      const start = source.indexOf(`export async function ${method}(`)
      const check = source.indexOf('if (!(await isAuthenticated(req)))', start)
      const read = source.indexOf('await readJob(id)', start)
      expect(start).toBeGreaterThan(-1)
      expect(check).toBeGreaterThan(start)
      expect(read).toBeGreaterThan(check)
    }
  })

  it('the new report label is listed once in the label list', () => {
    const list = sourceOf('lib/no-direct-sentry.test.ts')
    expect(list.match(/'admin job read failed'/g)).toHaveLength(1)
  })

  it('the import route comment names its current callers', () => {
    const source = sourceOf('app/api/ingest/[slug]/route.ts')
    expect(source).not.toContain('admin trigger route')
    expect(source).toContain('Neither the admin Run now button nor')
  })
})
