import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_SESSION_COOKIE, getAdminPath } from './middleware-logic'
import { TEST_ADMIN_SECRET, TEST_SESSION_SECRET, signTestSession } from './admin-session-fixtures'

// Job, expiry and provider-run problems carry fixed text and a short code;
// the course load and the admin job update answer bad input or a failed
// read with fixed text; the import due check and the import runner log
// short codes only, and their short code reader never throws.

type Result = { data?: unknown; error?: unknown; count?: number | null; status?: number }

const state = vi.hoisted(() => ({
  reports: [] as unknown[][],
  logs: [] as unknown[][],
  db: {} as Record<string, Result>,
  // Answers used once each, in order, before the table's standing answer.
  queue: {} as Record<string, Result[]>,
  rpc: null as Result | null,
}))

vi.mock('@/lib/report-error', () => ({
  reportServerError: (...args: unknown[]) => {
    state.reports.push(args)
  },
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: () => {},
  captureMessage: () => {},
}))

// A small stand-in for a supabase-js client: any chain of calls ends with the
// answer set for its table (or for the search RPC).
vi.mock('@/lib/supabase-server', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/supabase-server')>()
  const answerFor = (table: string): Result =>
    state.queue[table]?.shift() ?? state.db[table] ?? { data: [], error: null, count: 0, status: 200 }
  const chainOf = (answer: () => Result): unknown => {
    const chain: unknown = new Proxy(() => chain, {
      get: (_target, prop) =>
        prop === 'then'
          ? (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
              Promise.resolve(answer()).then(resolve, reject)
          : () => chain,
    })
    return chain
  }
  return {
    ...original,
    getServerSupabase: () => ({
      from: (table: string) => chainOf(() => answerFor(table)),
      rpc: () => chainOf(() => state.rpc ?? { data: [], error: null }),
    }),
  }
})

vi.mock('@/lib/providers', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/providers')>()
  return {
    ...original,
    getProvidersDueForFetch: vi.fn(() => original.getProvidersDueForFetch()),
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
import * as jobs from '@/lib/jobs'
import { problemCode, reportableProblem } from '@/lib/job-expiry'
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

const DB_PROBLEM = { message: 'seed database detail seed-person@example.com', code: 'XX000', details: 'seed', hint: 'seed' }
const failedRead = (status = 500): Result => ({ data: null, error: DB_PROBLEM, status })
// A value whose code cannot even be read.
const hostile = () => {
  const value = {}
  Object.defineProperty(value, 'code', { get() { throw new Error('seed getter detail') } })
  return value
}

let session = ''
function admin(path: string, init: { method?: string; body?: unknown; raw?: string } = {}) {
  const text = init.raw ?? (init.body === undefined ? undefined : JSON.stringify(init.body))
  const req = new NextRequest(SITE + path, {
    method: init.method ?? 'GET',
    body: text,
    headers: text !== undefined ? { 'content-type': 'application/json' } : {},
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

// A real Error with exactly this text and code, and nothing else from the database.
function expectFixedProblem(problem: unknown, message: string, code: string | null = 'XX000') {
  expect(problem).toBeInstanceOf(Error)
  const fixed = problem as Error & Record<string, unknown>
  expect(fixed.message).toBe(message)
  expect(fixed.code ?? null).toBe(code)
  expect(fixed.details).toBeUndefined()
  expect(fixed.hint).toBeUndefined()
  expect(JSON.stringify({ message: fixed.message, code: fixed.code })).not.toMatch(SEED)
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
  state.logs.length = 0
  state.db = {}
  state.queue = {}
  state.rpc = null
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

// ── K1: the job search ──────────────────────────────────────────────────────

describe('job search problem', () => {
  it('throws fixed text and the code', async () => {
    state.rpc = { data: null, error: DB_PROBLEM }
    expectFixedProblem(
      await thrownBy(() => jobs.getActiveDirectJobs({ platform: 'ab' })),
      'getActiveDirectJobs: search_jobs_ranked failed',
    )
  })

  it('throws fixed text and no code when the code is not short', async () => {
    state.rpc = { data: null, error: { message: 'seed detail', code: 'seed code with spaces' } }
    expectFixedProblem(
      await thrownBy(() => jobs.getActiveDirectJobs({ platform: 'ab' })),
      'getActiveDirectJobs: search_jobs_ranked failed',
      null,
    )
  })

  it('passes a healthy answer through', async () => {
    state.rpc = { data: [{ id: 'job-1' }], error: null }
    expect(await jobs.getActiveDirectJobs({ platform: 'ab' })).toStrictEqual([{ id: 'job-1' }])
  })
})

// ── K2: latest provider runs ────────────────────────────────────────────────

describe('latest provider runs problem', () => {
  it('throws fixed text and the code', async () => {
    state.db.provider_runs = failedRead()
    expectFixedProblem(
      await thrownBy(() => providers.getLatestRunPerProvider()),
      'getLatestRunPerProvider: provider runs query failed',
    )
  })

  it('passes a healthy answer through', async () => {
    state.db.provider_runs = { data: [{ provider_slug: 'a', id: 'r2' }, { provider_slug: 'a', id: 'r1' }], error: null }
    expect(await providers.getLatestRunPerProvider()).toStrictEqual({ a: { provider_slug: 'a', id: 'r2' } })
  })
})

// ── K3: job writes and reads that used to throw the whole database error ────

describe('job write and read problems', () => {
  const ROW = { id: 'job-1', status: 'active', manage_token: 't' }
  const cases: [string, () => Promise<unknown>, string][] = [
    ['getJobByManageToken', () => jobs.getJobByManageToken('t'), 'getJobByManageToken: jobs query failed'],
    ['getExpiringJobs', () => jobs.getExpiringJobs(0), 'job expiry database request failed'],
    ['expireJobsByIds', () => jobs.expireJobsByIds(['job-1'], new Date()), 'job expiry database request failed'],
    ['expireJob', () => jobs.expireJob('job-1'), 'expireJob: update failed'],
    ['approveJob', () => jobs.approveJob('job-1'), 'approveJob: update failed'],
    ['rejectJob', () => jobs.rejectJob('job-1', 'reason'), 'rejectJob: update failed'],
    ['markJobPaid', () => jobs.markJobPaid('job-1', 's', 'o', 1), 'markJobPaid: update failed'],
  ]

  it.each(cases)('%s throws fixed text and the code', async (_name, run, message) => {
    state.db.jobs = failedRead()
    expectFixedProblem(await thrownBy(run), message)
  })

  it('closeJobByManageToken throws fixed text and the code when the update fails', async () => {
    state.queue.jobs = [{ data: ROW, error: null }, failedRead()]
    expectFixedProblem(await thrownBy(() => jobs.closeJobByManageToken('t')), 'closeJobByManageToken: update failed')
  })

  it('getJobByManageToken still answers null for zero rows', async () => {
    state.db.jobs = { data: null, error: { message: 'seed', code: 'PGRST116' }, status: 406 }
    expect(await jobs.getJobByManageToken('t')).toBeNull()
  })

  it.each<[string, () => Promise<unknown>, string]>([
    ['approveJob', () => jobs.approveJob('job-1'), 'approveJob: update returned no row'],
    ['rejectJob', () => jobs.rejectJob('job-1', 'reason'), 'rejectJob: update returned no row'],
    ['markJobPaid', () => jobs.markJobPaid('job-1', 's', 'o', 1), 'markJobPaid: update returned no row'],
  ])('%s keeps its "no row" text', async (_name, run, message) => {
    state.db.jobs = { data: null, error: null }
    expectFixedProblem(await thrownBy(run), message, null)
  })

  it('closeJobByManageToken keeps its "no row" text', async () => {
    state.queue.jobs = [{ data: ROW, error: null }, { data: null, error: null }]
    expectFixedProblem(await thrownBy(() => jobs.closeJobByManageToken('t')), 'closeJobByManageToken: update returned no row', null)
  })

  it('the expiry run reports and logs exactly what it did for the old plain database error', async () => {
    for (const error of [DB_PROBLEM, { message: 'AbortError: seed', details: 'seed', hint: 'seed', code: '' }]) {
      state.db.jobs = { data: null, error }
      for (const run of [() => jobs.getExpiringJobs(0), () => jobs.expireJobsByIds(['job-1'], new Date())]) {
        const thrown = await thrownBy(run)
        const before = reportableProblem(error) as Error & { code?: string }
        const after = reportableProblem(thrown) as Error & { code?: string }
        expect(after).toBe(thrown)
        expect([after.name, after.message, after.code]).toStrictEqual([before.name, before.message, before.code])
        expect(problemCode(thrown)).toBe(problemCode(error))
      }
    }
  })

  it('the job manage link answers as before and reports fixed text only', async () => {
    const { GET } = await import('@/app/api/jobs/manage/route')
    state.db.jobs = failedRead()
    const answer = await answerOf(await GET(new NextRequest(`${SITE}/api/jobs/manage?token=t`)))
    expect(answer).toStrictEqual({ status: 500, body: { error: 'Internal server error' } })
    expect(state.reports).toHaveLength(1)
    expect(state.reports[0][0]).toBe('job manage link failed')
    expectFixedProblem(state.reports[0][1], 'getJobByManageToken: jobs query failed')
    expect(String(state.logs.map((line) => line.map(String)))).not.toMatch(SEED)
  })

  it('an admin approve problem answers as before with the code in its log line', async () => {
    state.queue.jobs = [{ data: ROW, error: null, status: 200 }, failedRead()]
    const answer = await answerOf(await (await handler('/jobs/[id]', 'PATCH'))(
      admin(`/api/${folder}/jobs/job-1`, { method: 'PATCH', body: { action: 'approve' } }),
      { params: Promise.resolve({ id: 'job-1' }) },
    ))
    expect(answer).toStrictEqual({ status: 500, body: { error: 'Job update failed' } })
    expect(state.logs).toStrictEqual([['admin job update failed', 'XX000']])
    expect(state.reports).toHaveLength(1)
    expect(state.reports[0][0]).toBe('admin job update failed')
    expectFixedProblem(state.reports[0][1], 'approveJob: update failed')
    expectPlainLogs()
  })
})

// ── K4: admin course load ───────────────────────────────────────────────────

describe('admin course load', () => {
  const call = async (slug = 'course') =>
    (await handler('/course-factory/load-course', 'GET'))(admin(`/api/${folder}/course-factory/load-course?action=load&slug=${slug}`))

  it('a load problem answers "Course load failed" with a code-only log line and no report', async () => {
    state.db.courses = failedRead()
    expect(await answerOf(await call())).toStrictEqual({ status: 500, body: { error: 'Course load failed' } })
    expect(state.logs.at(-1)).toStrictEqual(['admin course load failed', 'XX000'])
    expect(state.logs.filter((line) => line[0] === 'admin course load failed')).toHaveLength(1)
    expect(state.reports).toStrictEqual([])
    expect(String(state.logs.map((line) => line.map(String)))).not.toMatch(SEED)
  })

  it('a missing course still answers "Course not found"', async () => {
    state.db.courses = { data: null, error: { message: 'seed', code: 'PGRST116' }, status: 406 }
    expect(await answerOf(await call())).toStrictEqual({ status: 404, body: { error: 'Course not found' } })
    expect(state.logs).toStrictEqual([])
  })

  it('a signed-out call answers 401 and logs nothing', async () => {
    state.db.courses = failedRead()
    session = 'not-a-session'
    expect((await call()).status).toBe(401)
    expect(state.logs).toStrictEqual([])
    expect(state.reports).toStrictEqual([])
  })
})

// ── K5: admin job update with bad input ─────────────────────────────────────

describe('admin job update with bad input', () => {
  const ROW = { id: 'job-1', title: 'Role', status: 'active', is_featured: false }
  const call = async (raw: string) =>
    (await handler('/jobs/[id]', 'PATCH'))(
      admin(`/api/${folder}/jobs/job-1`, { method: 'PATCH', raw }),
      { params: Promise.resolve({ id: 'job-1' }) },
    )

  it.each([
    ['bad JSON', '{not json'],
    ['an empty body', ''],
    ['a JSON null', 'null'],
  ])('%s answers 400 "action is required" with no log and no report', async (_name, raw) => {
    state.db.jobs = { data: ROW, error: null, status: 200 }
    expect(await answerOf(await call(raw))).toStrictEqual({ status: 400, body: { error: 'action is required' } })
    expect(state.logs).toStrictEqual([])
    expect(state.reports).toStrictEqual([])
  })

  it('a missing job still answers "Job not found" first', async () => {
    state.db.jobs = { data: null, error: { message: 'seed', code: 'PGRST116' }, status: 406 }
    expect(await answerOf(await call('{not json'))).toStrictEqual({ status: 404, body: { error: 'Job not found' } })
  })

  it('a good body still works', async () => {
    state.db.jobs = { data: ROW, error: null, status: 200 }
    expect(await answerOf(await call(JSON.stringify({ action: 'expire' })))).toStrictEqual({ status: 200, body: { success: true } })
  })
})

// ── K6: import due check ────────────────────────────────────────────────────

describe('import due check log line', () => {
  const run = async () => {
    const { GET } = await import('@/app/api/ingest/orchestrator/route')
    vi.stubEnv('CRON_SECRET', 'test-secret')
    return answerOf(await GET(new NextRequest(`${SITE}/api/ingest/orchestrator`, { headers: { authorization: 'Bearer test-secret' } })))
  }
  const FAILED = { status: 500, body: { ok: false, error: 'Failed to determine due providers', reaped: 0 } }

  it('logs the short code only and answers as before', async () => {
    // The first provider_runs call is the stale-run clean-up; the second is the due check.
    state.queue.provider_runs = [{ data: [], error: null }, failedRead()]
    expect(await run()).toStrictEqual(FAILED)
    expect(state.logs).toStrictEqual([['[orchestrator] getProvidersDueForFetch failed:', 'XX000']])
    expect(state.reports).toHaveLength(1)
    expect(state.reports[0][0]).toBe('job import due check failed')
    expectFixedProblem(state.reports[0][1], 'getProvidersDueForFetch: running-runs query failed')
    expectPlainLogs()
  })

  it.each<[string, () => unknown]>([
    ['a value with no code', () => new Error('seed detail')],
    ['a thrown null', () => null],
    ['a value whose code cannot be read', hostile],
  ])('logs "no-code" for %s and answers as before', async (_name, make) => {
    state.queue.provider_runs = [{ data: [], error: null }]
    vi.mocked(providers.getProvidersDueForFetch).mockRejectedValueOnce(make())
    expect(await run()).toStrictEqual(FAILED)
    expect(state.logs).toStrictEqual([['[orchestrator] getProvidersDueForFetch failed:', 'no-code']])
    expectPlainLogs()
  })
})

// ── K7: the import runner's short code reader ──────────────────────────────

describe('import runner short codes never throw', () => {
  it('a side step whose problem code cannot be read logs "no-code" and the import still succeeds', async () => {
    state.db.jobs = { data: [{ id: 'job-1' }], error: null }
    vi.mocked(providers.updateProviderDataQuality).mockRejectedValue(hostile())
    const result = await runProviderImport('example', 'cron')
    expect(result.status).toBe(200)
    expect(state.logs).toContainEqual(['[ingest] quality metrics failed:', 'no-code'])
    expectPlainLogs()
  })

  it('a failed import whose problem code cannot be read answers its fixed failure text', async () => {
    vi.mocked(getAdapter).mockReturnValue({ fetch: vi.fn().mockRejectedValue(hostile()) } as never)
    state.db.job_providers = { data: { consecutive_failures: 1, health_status: 'degraded', status: 'active', data_quality_status: null }, error: null }
    const result = await runProviderImport('example', 'cron')
    expect(result).toMatchObject({ status: 500, body: { ok: false, error: 'Import failed (no-code)' } })
    expect(state.logs).toContainEqual(['[ingest/example] Fatal error:', 'no-code'])
    expectPlainLogs()
  })
})

// ── Source checks ───────────────────────────────────────────────────────────

describe('source checks', () => {
  it('lib/jobs.ts throws no whole database error and no database text in these functions', () => {
    const source = sourceOf('lib/jobs.ts')
    for (const name of [
      'getActiveDirectJobs: search_jobs_ranked failed', 'getJobByManageToken: jobs query failed',
      'approveJob: update failed', 'rejectJob: update failed', 'expireJob: update failed',
      'closeJobByManageToken: update failed', 'markJobPaid: update failed',
    ]) expect(source).toContain(`throw readProblem('${name}', error)`)
    expect(source.match(/throw readProblem\('job expiry database request failed', error\)/g)).toHaveLength(2)
    const whole = source.split('\n').filter((line) => /\bthrow error\b/.test(line))
    // Only createJob still throws the whole error; it is outside this change.
    expect(whole).toStrictEqual(["    throw error ?? new Error('createJob: insert returned no row')"])
    expect(source).not.toMatch(/throw new Error\([^\n]*\.message/)
  })

  it('lib/providers.ts throws no database text', () => {
    expect(sourceOf('lib/providers.ts')).not.toMatch(/throw new Error\([^\n]*\.message/)
  })

  it('the import due check logs a short code, not the whole value', () => {
    const source = sourceOf('app/api/ingest/orchestrator/route.ts')
    expect(source).toContain("console.error('[orchestrator] getProvidersDueForFetch failed:', shortCode(err))")
  })

  it('the course load and the admin job update name no folder and add no report', () => {
    for (const suffix of ['/course-factory/load-course', '/jobs/[id]']) {
      const source = adminSource(suffix)
      expect(source).not.toMatch(/(error|err)\.message/)
    }
    expect(adminSource('/course-factory/load-course')).not.toContain('reportServerError')
    expect(adminSource('/jobs/[id]').toLowerCase()).not.toContain(folder.toLowerCase())
  })
})
