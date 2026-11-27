import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// SJ-1 guards (D277): similar jobs come from a saved list that a nightly
// cron route computes in memory and writes to public.job_similar. Job pages
// read that list by key; no text search runs at request time. The kill
// switch stays exactly as it was.

type Result = { data?: unknown; error?: unknown; count?: number | null; status?: number }
type Query = { table: string; calls: [string, unknown[]][] }

const state = vi.hoisted(() => ({
  contexts: [] as string[],
  queries: [] as Query[],
  answer: null as null | ((query: Query) => Result),
  reports: [] as unknown[][],
  cacheCalls: [] as { keyParts: string[]; options: unknown; args: unknown[] }[],
}))

vi.mock('@/lib/report-error', () => ({
  reportServerError: (...args: unknown[]) => {
    state.reports.push(args)
  },
}))

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))

vi.mock('next/cache', () => ({
  unstable_cache:
    (fn: (...args: unknown[]) => Promise<unknown>, keyParts: string[], options: unknown) =>
    (...args: unknown[]) => {
      state.cacheCalls.push({ keyParts, options, args })
      return fn(...args)
    },
  unstable_noStore: () => {},
  revalidateTag: () => {},
  revalidatePath: () => {},
}))

// A recording stand-in for a supabase-js client: every chained call is kept,
// and awaiting the chain gives the answer set for that query.
vi.mock('@/lib/supabase-server', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/supabase-server')>()
  const chainFor = (table: string): unknown => {
    const query: Query = { table, calls: [] }
    state.queries.push(query)
    const chain: unknown = new Proxy(function () {}, {
      get: (_target, prop) =>
        prop === 'then'
          ? (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
              Promise.resolve(state.answer ? state.answer(query) : { data: [], error: null, count: 0 }).then(resolve, reject)
          : (...args: unknown[]) => {
              query.calls.push([String(prop), args])
              return chain
            },
    })
    return chain
  }
  return {
    ...original,
    getServerSupabase: (context: string) => {
      state.contexts.push(context)
      return { from: (table: string) => chainFor(table) }
    },
  }
})

import { resetCacheGuard } from '@/lib/cache-guard'
import { buildSimilarQuery, getSimilarJobs, similarTitleTokens, SIMILAR_JOB_COLUMNS } from '@/lib/jobs'

// Loaded per test, so each guard fails on its own while the code is missing.
const MODULE_PATH = '@/lib/similar-jobs'
const ROUTE_PATH = '@/app/api/cron/similar-jobs/route'
type SimilarModule = typeof import('@/lib/similar-jobs')
type RouteModule = typeof import('@/app/api/cron/similar-jobs/route')
const loadModule = () => import(/* @vite-ignore */ MODULE_PATH) as Promise<SimilarModule>
const loadRoute = () => import(/* @vite-ignore */ ROUTE_PATH) as Promise<RouteModule>

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const sha16 = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16)

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e'
const CRON_VALUE = 'sj-one-cron-test-value'
const originalEnabled = process.env.SIMILAR_JOBS_ENABLED
const originalCron = process.env.CRON_SECRET

function setEnv(name: 'SIMILAR_JOBS_ENABLED' | 'CRON_SECRET', value: string | undefined) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

beforeEach(() => {
  state.contexts.length = 0
  state.queries.length = 0
  state.answer = null
  state.reports.length = 0
  state.cacheCalls.length = 0
  resetCacheGuard()
})

afterEach(() => {
  setEnv('SIMILAR_JOBS_ENABLED', originalEnabled)
  setEnv('CRON_SECRET', originalCron)
  vi.restoreAllMocks()
})

const methods = (query: Query) => query.calls.map(([name]) => name)
const argsOf = (query: Query, name: string) => query.calls.filter(([method]) => method === name).map(([, args]) => args)

function savedRow(ids: string[]): Result {
  return { data: [{ similar_ids: ids }], error: null }
}

function similarJob(id: string) {
  return {
    id, slug: `slug-${id}`, title: 'Tax Manager', company_name: 'Co', location_text: 'London', location_country: 'United Kingdom',
    salary_text: null, salary_min: null, salary_max: null, salary_currency: null, published_at: '2026-11-01T00:00:00+00:00',
  }
}

// ── G1 kill switch ──────────────────────────────────────────────────────────

describe('G1 the kill switch', () => {
  it.each([[undefined], ['false'], [''], ['TRUE'], ['1'], [' true']])(
    'SIMILAR_JOBS_ENABLED %j: [] with no cache, database or log call',
    async (value) => {
      setEnv('SIMILAR_JOBS_ENABLED', value)
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(await getSimilarJobs({ excludeId: ID, platform: 'ab', title: 'Senior Tax Accountant', locationCountry: 'United Kingdom' })).toStrictEqual([])
      expect(state.contexts).toStrictEqual([])
      expect(state.queries).toStrictEqual([])
      expect(state.cacheCalls).toStrictEqual([])
      expect(state.reports).toStrictEqual([])
      expect(error).not.toHaveBeenCalled()
    },
  )

  it('the switch is still the first statement, byte for byte', () => {
    const source = read('lib/jobs.ts')
    const start = source.indexOf('export async function getSimilarJobs(params: GetSimilarJobsParams): Promise<SimilarJob[]> {\n')
    expect(start).toBeGreaterThan(0)
    expect(source.slice(start)).toMatch(
      /^export async function getSimilarJobs\(params: GetSimilarJobsParams\): Promise<SimilarJob\[\]> \{\n  \/\/ Emergency kill switch \(incident 2026-11-05\): off unless explicitly "true"\.\n  \/\/ Returns before any cache or database call, and logs nothing per request\.\n  if \(process\.env\.SIMILAR_JOBS_ENABLED !== 'true'\) return \[\]\n/,
    )
  })

  it('exactly "true" reads the saved list', async () => {
    setEnv('SIMILAR_JOBS_ENABLED', 'true')
    state.answer = (query) => (query.table === 'job_similar' ? savedRow(['a']) : { data: [similarJob('a')], error: null })
    expect((await getSimilarJobs({ excludeId: ID, platform: 'ab', title: 'Tax Manager' })).map((job) => job.id)).toStrictEqual(['a'])
    expect(state.queries.map((query) => query.table)).toStrictEqual(['job_similar', 'jobs'])
  })
})

// ── G2 no text search at request time ───────────────────────────────────────

describe('G2 no text search at request time', () => {
  it('with the switch on, no query uses textSearch, rpc or a websearch term', async () => {
    setEnv('SIMILAR_JOBS_ENABLED', 'true')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    state.answer = (query) => (query.table === 'job_similar' ? savedRow(['a', 'b']) : { data: [similarJob('b'), similarJob('a')], error: null })
    await getSimilarJobs({ excludeId: ID, platform: 'ab', title: 'Senior Practice Accountant', locationCountry: 'United Kingdom' })
    expect(state.queries.length).toBeGreaterThan(0)
    for (const query of state.queries) {
      expect(methods(query)).not.toContain('textSearch')
      expect(methods(query)).not.toContain('rpc')
      expect(JSON.stringify(query.calls)).not.toMatch(/websearch| OR /)
    }
  })

  it('the similar-jobs block of lib/jobs.ts has no text search, rpc or old step', () => {
    const source = read('lib/jobs.ts')
    const block = source.slice(source.indexOf('export interface GetSimilarJobsParams'), source.indexOf('export async function getJobByManageToken'))
    expect(block.length).toBeGreaterThan(500)
    for (const banned of ['textSearch(', '.rpc(', 'websearch', 'fetchSimilarCandidates', 'fetchSimilarCountryFallback', 'getCachedSimilarCandidates', 'rankByTitleOverlap']) {
      expect(block).not.toContain(banned)
    }
  })
})

// ── G3 the saved-list read ──────────────────────────────────────────────────

describe('G3 the saved-list read', () => {
  beforeEach(() => setEnv('SIMILAR_JOBS_ENABLED', 'true'))

  it('reads job_similar by key, then the jobs by id with the live filters', async () => {
    state.answer = (query) => (query.table === 'job_similar' ? savedRow(['c', 'a', 'b']) : { data: [similarJob('a'), similarJob('b'), similarJob('c')], error: null })
    const result = await getSimilarJobs({ excludeId: ID, platform: 'et', title: 'Tax Manager', limit: 6 })
    expect(result.map((job) => job.id)).toStrictEqual(['c', 'a', 'b'])
    const [saved, jobs] = state.queries
    expect(saved.table).toBe('job_similar')
    expect(argsOf(saved, 'select')).toStrictEqual([['similar_ids']])
    expect(argsOf(saved, 'eq')).toStrictEqual([['job_id', ID], ['platform', 'et']])
    expect(jobs.table).toBe('jobs')
    expect(argsOf(jobs, 'select')).toStrictEqual([[SIMILAR_JOB_COLUMNS]])
    expect(argsOf(jobs, 'in')).toStrictEqual([['id', ['c', 'a', 'b']]])
    expect(argsOf(jobs, 'eq')).toStrictEqual([['status', 'active']])
    expect(argsOf(jobs, 'contains')).toStrictEqual([['platform', ['et']]])
    const or = argsOf(jobs, 'or')
    expect(or).toHaveLength(1)
    expect(String(or[0][0])).toMatch(/^expires_at\.is\.null,expires_at\.gt\.\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(state.queries).toHaveLength(2)
  })

  it('keeps the saved order, drops missing or no longer live jobs, the viewed job and repeats, and stops at the limit', async () => {
    state.answer = (query) =>
      query.table === 'job_similar'
        ? savedRow(['d', 'gone', 'a', ID, 'a', 'c', 'b'])
        : { data: [similarJob('a'), similarJob('b'), similarJob('c'), similarJob('d')], error: null }
    expect((await getSimilarJobs({ excludeId: ID, platform: 'ab', title: 'Tax Manager', limit: 3 })).map((job) => job.id)).toStrictEqual(['d', 'a', 'c'])
  })

  it('no saved row: [] and no jobs read', async () => {
    state.answer = () => ({ data: [], error: null })
    expect(await getSimilarJobs({ excludeId: ID, platform: 'ab', title: 'Tax Manager' })).toStrictEqual([])
    expect(state.queries.map((query) => query.table)).toStrictEqual(['job_similar'])
    expect(state.reports).toStrictEqual([])
  })

  it.each([
    ['the saved list', 'job_similar', 'getSimilarJobs: saved list query failed'],
    ['the jobs', 'jobs', 'getSimilarJobs: jobs query failed'],
  ])('a failed read of %s: [] and exactly one report', async (_name, table, message) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    state.answer = (query) =>
      query.table === table
        ? { data: null, error: { message: 'seed database detail', code: 'XX000' }, status: 500 }
        : savedRow(['a'])
    expect(await getSimilarJobs({ excludeId: ID, platform: 'ab', title: 'Tax Manager' })).toStrictEqual([])
    expect(state.reports).toStrictEqual([['similar jobs saved list read failed', new Error('similar jobs query failed'), { area: 'public' }]])
    expect(error).toHaveBeenCalledTimes(1)
    const [label, problem] = error.mock.calls[0]
    expect(label).toBe('getSimilarJobs (saved list) error:')
    // PRIV-8 S4: the log carries the short code only, not the read problem's text.
    expect(problem).toBe('XX000')
    expect(JSON.stringify(error.mock.calls)).not.toContain(message)
    expect(JSON.stringify(state.reports)).not.toContain('seed database detail')
  })

  it('is cached by (job, platform) through the cache guard with the same key parts', async () => {
    state.answer = (query) => (query.table === 'job_similar' ? savedRow(['a']) : { data: [similarJob('a')], error: null })
    await getSimilarJobs({ excludeId: ID, platform: 'ab', title: 'Tax Manager', limit: 2 })
    expect(state.cacheCalls).toStrictEqual([{ keyParts: ['similar-jobs-saved'], options: { revalidate: 3600, tags: ['jobs', 'related-jobs'] }, args: [ID, 'ab'] }])
    const source = read('lib/jobs.ts')
    expect(source).toMatch(/guardCachedRead\(\['similar-jobs-saved'\],\s*unstable_cache\(fetchSavedSimilarJobs, \['similar-jobs-saved'\], \{ revalidate: 3600, tags: \['jobs', 'related-jobs'\] \}\)/)
  })

  it('uses the public read context only', async () => {
    state.answer = (query) => (query.table === 'job_similar' ? savedRow(['a']) : { data: [similarJob('a')], error: null })
    await getSimilarJobs({ excludeId: ID, platform: 'ab', title: 'Tax Manager' })
    expect(state.contexts.length).toBeGreaterThan(0)
    expect(new Set(state.contexts)).toStrictEqual(new Set(['publicRead']))
  })
})

// ── G4 the compute module ───────────────────────────────────────────────────

type Row = { id: string; title: string; location_country: string | null; platform: string[]; published_at: string | null; created_at: string }
const BASE = Date.parse('2026-11-01T00:00:00.000Z')
const at = (minutes: number) => new Date(BASE + minutes * 60_000).toISOString()

function live(id: string, title: string, options: { country?: string | null; platform?: string[]; pub?: number | null; created?: number } = {}): Row {
  const pub = options.pub === undefined ? 0 : options.pub
  return {
    id,
    title,
    location_country: options.country === undefined ? 'United Kingdom' : options.country,
    platform: options.platform ?? ['ab'],
    published_at: pub === null ? null : at(pub),
    created_at: at(options.created ?? (pub ?? 0)),
  }
}

async function listFor(rows: Row[], id: string, platform = 'ab'): Promise<string[] | null> {
  const { computeSimilarLists } = await loadModule()
  return computeSimilarLists(rows).find((row) => row.job_id === id && row.platform === platform)?.similar_ids ?? null
}

describe('G4 compute parity with the step rules (method B)', () => {
  it('step 1 is same-country only; steps 2 then 3 pad by shared words, then worldwide', async () => {
    const rows = [
      live('v', 'Senior Practice Accountant', { pub: 0 }),
      live('us-all', 'Senior Practice Accountant', { country: 'United States', pub: 50 }),
      live('uk-all', 'Practice Accountant Senior', { pub: 10 }),
      live('uk-two', 'Practice Accountant', { pub: 20 }),
      live('uk-one', 'Senior Developer', { pub: 30 }),
    ]
    expect(await listFor(rows, 'v')).toStrictEqual(['uk-all', 'uk-two', 'uk-one', 'us-all'])
  })

  it('step 2 takes the 40 newest matches, then re-ranks them by shared title words', async () => {
    const many = Array.from({ length: 40 }, (_, i) => live(`s${String(i).padStart(2, '0')}`, 'Senior Developer', { pub: 100 + i }))
    const outside = [live('v', 'Senior Practice Accountant', { pub: 0 }), live('old-two', 'Practice Accountant', { pub: 50 }), ...many]
    expect(await listFor(outside, 'v')).toStrictEqual(['s39', 's38', 's37', 's36', 's35', 's34'])
    const inside = [live('v', 'Senior Practice Accountant', { pub: 0 }), live('new-two', 'Practice Accountant', { pub: 120 }), ...many]
    expect(await listFor(inside, 'v')).toStrictEqual(['new-two', 's39', 's38', 's37', 's36', 's35'])
  })

  it('a one-word title lists the newest same-country matches', async () => {
    const rows = [
      live('v', 'Bookkeeper', { pub: 0 }),
      live('a', 'Bookkeeper Assistant', { pub: 5 }),
      live('b', 'Senior Bookkeeper', { pub: 9 }),
      live('c', 'Bookkeeper', { country: 'Ireland', pub: 20 }),
    ]
    expect(await listFor(rows, 'v')).toStrictEqual(['b', 'a', 'c'])
  })

  it.each([[null], ['']])('country %j counts as none: steps 1-2 worldwide, no step 3, no Phase C', async (country) => {
    const rows = [
      live('v', 'Senior Practice Accountant', { country, pub: 0 }),
      live('fr', 'Senior Practice Accountant', { country: 'France', pub: 5 }),
      live('same', 'Payroll Clerk', { country, pub: 9 }),
    ]
    expect(await listFor(rows, 'v')).toStrictEqual(['fr'])
    expect(await listFor([live('v', 'Remote Job', { country, pub: 0 }), live('same', 'Payroll Clerk', { country, pub: 9 })], 'v')).toBeNull()
  })

  it('Phase C: same country by created_at, with (), stripped from the country', async () => {
    const stripped = [
      live('v', 'Remote Job', { country: 'Congo (DRC)', pub: 0 }),
      live('raw', 'Tax Manager', { country: 'Congo (DRC)', created: 5 }),
      live('clean', 'Tax Manager', { country: 'Congo DRC', created: 3 }),
    ]
    expect(await listFor(stripped, 'v')).toStrictEqual(['clean'])
    const order = [
      live('v', 'Remote Job', { pub: 0 }),
      live('a', 'Tax Manager', { pub: 100, created: 1 }),
      live('b', 'Audit Clerk', { pub: 1, created: 100 }),
      live('undated', 'Payroll Lead', { pub: null, created: 50 }),
    ]
    expect(await listFor(order, 'v')).toStrictEqual(['b', 'undated', 'a'])
  })

  it('a title with no usable words goes to Phase C only', async () => {
    const rows = [
      live('v', 'Remote Full Time UK Job', { pub: 0 }),
      live('c1', 'Remote Job Hybrid', { created: 1 }),
      live('c3', 'Tax Manager', { created: 5 }),
      live('fr', 'Remote Full Time Job', { country: 'France', created: 9 }),
    ]
    expect(await listFor(rows, 'v')).toStrictEqual(['c3', 'c1'])
  })

  it('a title the token rules cannot read goes to Phase C only', async () => {
    const rows = [
      { ...live('v', 'x', { pub: 0 }), title: null as unknown as string },
      live('a', 'Senior Accountant', { created: 2 }),
      live('fr', 'Senior Accountant', { country: 'France', created: 9 }),
    ]
    expect(await listFor(rows, 'v')).toStrictEqual(['a'])
  })

  it('each platform separately; other platform values are ignored', async () => {
    const rows = [
      live('v', 'Tax Manager', { platform: ['ab', 'et'], pub: 0 }),
      live('a', 'Tax Manager', { platform: ['ab'], pub: 10 }),
      live('b', 'Tax Manager', { platform: ['et', 'ab'], pub: 5 }),
      live('c', 'Tax Manager', { platform: ['et'], pub: 3 }),
      live('d', 'Tax Manager', { platform: ['gpe'], pub: 20 }),
    ]
    expect(await listFor(rows, 'v', 'ab')).toStrictEqual(['a', 'b'])
    expect(await listFor(rows, 'v', 'et')).toStrictEqual(['b', 'c'])
    const { computeSimilarLists } = await loadModule()
    expect(computeSimilarLists(rows).some((row) => row.job_id === 'd')).toBe(false)
    expect(new Set(computeSimilarLists(rows).map((row) => row.platform))).toStrictEqual(new Set(['ab', 'et']))
  })

  it('equal timestamps: published_at, then created_at, then id, newest first — whatever the input order', async () => {
    const rows = [
      live('v', 'Audit Senior', { pub: 0 }),
      live('a', 'Audit Senior', { pub: 10, created: 1 }),
      live('b', 'Audit Senior', { pub: 10, created: 2 }),
      live('c', 'Audit Senior', { pub: 10, created: 2 }),
    ]
    expect(await listFor(rows, 'v')).toStrictEqual(['c', 'b', 'a'])
    expect(await listFor([...rows].reverse(), 'v')).toStrictEqual(['c', 'b', 'a'])
  })

  it('every list: 1 to 6 ids, never the job itself, no repeats, all on the same platform', async () => {
    const { computeSimilarLists } = await loadModule()
    const rows = synthetic(2_000)
    const byId = new Map(rows.map((row) => [row.id, row]))
    const lists = computeSimilarLists(rows)
    expect(lists.length).toBeGreaterThan(2_000)
    for (const list of lists) {
      expect(['ab', 'et']).toContain(list.platform)
      expect(list.similar_ids.length).toBeGreaterThanOrEqual(1)
      expect(list.similar_ids.length).toBeLessThanOrEqual(6)
      expect(list.similar_ids).not.toContain(list.job_id)
      expect(new Set(list.similar_ids).size).toBe(list.similar_ids.length)
      expect(byId.get(list.job_id)!.platform).toContain(list.platform)
      for (const id of list.similar_ids) expect(byId.get(id)!.platform).toContain(list.platform)
    }
  })

  it('uses the real title rules and the moved overlap ranking: nothing copied, no Next, database or settings', () => {
    const source = read('lib/similar-jobs.ts')
    expect(source).toMatch(/^import \{ similarTitleTokens \} from '@\/lib\/jobs'$/m)
    const imports = source.match(/^import .* from '([^']+)'$/gm) ?? []
    expect(imports.map((line) => line.replace(/^.* from '([^']+)'$/, '$1'))).toStrictEqual(['@/lib/jobs', '@/lib/job-duplicates'])
    for (const banned of ['next/', '@supabase/', 'process.env', 'SIMILAR_QUERY_NOISE_TOKENS', 'SINGLE_WORD_COUNTRY_NAMES', 'SALARY_TOKEN', "'hybrid'", 'toLowerCase']) {
      expect(source).not.toContain(banned)
    }
    expect(source).toContain('export function rankByTitleOverlap')
    expect(read('lib/jobs.ts')).not.toContain('function rankByTitleOverlap')
  })

  it('computes 16,000 synthetic jobs well within the route limit', async () => {
    const { computeSimilarLists } = await loadModule()
    const rows = synthetic(16_000)
    const heapBefore = process.memoryUsage().heapUsed
    const started = performance.now()
    const lists = computeSimilarLists(rows)
    const ms = Math.round(performance.now() - started)
    const heapMb = Math.round((process.memoryUsage().heapUsed - heapBefore) / 1_048_576)
    console.info(`sj-one timing|jobs:${rows.length}|lists:${lists.length}|ms:${ms}|heap_delta_mb:${heapMb}`)
    expect(ms).toBeLessThan(10_000)
    expect(lists.length).toBeGreaterThan(16_000)
  })
})

// Realistic title shapes, 22 countries, every job on ab and a quarter also on
// et; deterministic (no random source).
function synthetic(count: number): Row[] {
  const levels = ['Senior', 'Junior', 'Assistant', 'Trainee', 'Lead', 'Head of', 'Graduate', '']
  const areas = ['Tax', 'Audit', 'Payroll', 'Accounts Payable', 'Accounts Receivable', 'Finance', 'Management', 'Practice', 'Credit Control', 'Treasury', 'Financial Planning', 'Purchase Ledger', 'Bookkeeping', 'Compliance', 'VAT']
  const roles = ['Accountant', 'Manager', 'Analyst', 'Clerk', 'Administrator', 'Controller', 'Officer', 'Advisor', 'Supervisor', 'Specialist']
  const extras = ['', '', ' - London', ' (Hybrid)', ' £35,000', ' - Remote', ' Manchester', ' Part Time']
  const countries = ['United Kingdom', 'United Kingdom', 'United Kingdom', 'United Kingdom', 'Ireland', 'United States', 'Ethiopia', 'Canada', 'Australia', 'India', 'South Africa', 'Kenya', 'Nigeria', 'Germany', 'France', 'Netherlands', 'Spain', 'United Arab Emirates', 'Singapore', 'New Zealand', 'Poland', 'Congo (DRC)', 'Korea, Republic of', null]
  let seed = 7
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed
  }
  return Array.from({ length: count }, (_, i) => {
    const title = `${levels[next() % levels.length]} ${areas[next() % areas.length]} ${roles[next() % roles.length]}${extras[next() % extras.length]}`.trim()
    const pub = next() % 40_000
    return live(`job-${String(i).padStart(6, '0')}`, title, {
      country: countries[next() % countries.length],
      platform: i % 4 === 0 ? ['ab', 'et'] : ['ab'],
      pub,
      created: pub - (next() % 60),
    })
  })
}

// ── G5 the nightly run ──────────────────────────────────────────────────────

function fakeStore(options: { pages?: Row[][]; pageError?: number; upsertErrorAt?: number; deleted?: number } = {}) {
  const log: string[] = []
  const reads: { after: string | null; limit: number; nowIso: string }[] = []
  const upserts: { rows: { job_id: string; platform: string; similar_ids: string[] }[]; computedAt: string }[] = []
  const deletes: string[] = []
  const pages = options.pages ?? []
  const store = {
    readLivePage: async (after: string | null, limit: number, nowIso: string) => {
      const index = reads.length
      reads.push({ after, limit, nowIso })
      log.push(`read ${index}`)
      if (options.pageError === index) throw Object.assign(new Error('seed read problem'), { code: 'XX000' })
      return pages[index] ?? []
    },
    upsertLists: async (rows: { job_id: string; platform: string; similar_ids: string[] }[], computedAt: string) => {
      const index = upserts.length
      upserts.push({ rows, computedAt })
      log.push(`upsert ${index}`)
      if (options.upsertErrorAt === index) throw Object.assign(new Error('seed write problem'), { code: '23503' })
    },
    deleteStale: async (before: string) => {
      deletes.push(before)
      log.push('delete')
      return options.deleted ?? 0
    },
  }
  return { store, log, reads, upserts, deletes }
}

const pagesOf = (rows: Row[], size: number) => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size))
const CLOCK_START = Date.parse('2026-11-22T03:04:00.000Z')
const clock = () => {
  let now = CLOCK_START
  return () => (now += 7)
}

describe('G5 the nightly run (fake store)', () => {
  it('reads by key in pages of 1,000 until a short page, all with the run start time', async () => {
    const { runSimilarJobsRefresh } = await loadModule()
    const rows = synthetic(2_345)
    const fake = fakeStore({ pages: pagesOf(rows, 1_000) })
    const result = await runSimilarJobsRefresh(fake.store, clock())
    expect(result.ok).toBe(true)
    expect(fake.reads.map((r) => r.after)).toStrictEqual([null, 'job-000999', 'job-001999'])
    expect(fake.reads.every((r) => r.limit === 1_000)).toBe(true)
    const runStart = fake.reads[0].nowIso
    expect(fake.reads.every((r) => r.nowIso === runStart)).toBe(true)
    if (result.ok) expect(result.live).toBe(2_345)
  })

  it('a page error: no write, no delete', async () => {
    const { runSimilarJobsRefresh } = await loadModule()
    const fake = fakeStore({ pages: pagesOf(synthetic(1_500), 1_000), pageError: 1 })
    const result = await runSimilarJobsRefresh(fake.store, clock())
    expect(result).toMatchObject({ ok: false, step: 'read' })
    expect(fake.upserts).toStrictEqual([])
    expect(fake.deletes).toStrictEqual([])
  })

  it('zero live jobs: no write, no delete', async () => {
    const { runSimilarJobsRefresh } = await loadModule()
    const fake = fakeStore({ pages: [] })
    expect(await runSimilarJobsRefresh(fake.store, clock())).toMatchObject({ ok: false, step: 'empty' })
    expect(fake.upserts).toStrictEqual([])
    expect(fake.deletes).toStrictEqual([])
  })

  it('more pages than the cap: stops, no write, no delete', async () => {
    const { runSimilarJobsRefresh, SIMILAR_REFRESH_MAX_PAGES } = await loadModule()
    expect(SIMILAR_REFRESH_MAX_PAGES).toBe(40)
    const full = Array.from({ length: 1_000 }, (_, i) => live(`p-${i}`, 'Tax Manager'))
    const fake = fakeStore({ pages: Array.from({ length: 41 }, (_, p) => full.map((row) => ({ ...row, id: `${String(p).padStart(2, '0')}-${row.id}` }))) })
    expect(await runSimilarJobsRefresh(fake.store, clock())).toMatchObject({ ok: false, step: 'page-limit' })
    expect(fake.reads).toHaveLength(40)
    expect(fake.upserts).toStrictEqual([])
    expect(fake.deletes).toStrictEqual([])
  })

  it('a failed write batch: no delete, older lists stay', async () => {
    const { runSimilarJobsRefresh } = await loadModule()
    const fake = fakeStore({ pages: pagesOf(synthetic(1_200), 1_000), upsertErrorAt: 1 })
    expect(await runSimilarJobsRefresh(fake.store, clock())).toMatchObject({ ok: false, step: 'write' })
    expect(fake.upserts).toHaveLength(2)
    expect(fake.deletes).toStrictEqual([])
  })

  it('success: every list in batches of at most 500 with computed_at = run start, then one delete of older rows', async () => {
    const { runSimilarJobsRefresh, computeSimilarLists } = await loadModule()
    const rows = synthetic(1_200)
    const fake = fakeStore({ pages: pagesOf(rows, 1_000), deleted: 17 })
    const result = await runSimilarJobsRefresh(fake.store, clock())
    const runStart = fake.reads[0].nowIso
    expect(runStart).toBe(new Date(CLOCK_START + 7).toISOString())
    const expected = computeSimilarLists(rows)
    expect(fake.upserts.flatMap((u) => u.rows)).toStrictEqual(expected)
    expect(fake.upserts.every((u) => u.rows.length <= 500 && u.rows.length > 0 && u.computedAt === runStart)).toBe(true)
    expect(fake.deletes).toStrictEqual([runStart])
    expect(fake.log.at(-1)).toBe('delete')
    expect(fake.log.filter((line) => line === 'delete')).toHaveLength(1)
    expect(result).toStrictEqual({ ok: true, live: 1_200, pairs: 1_500, written: expected.length, deleted: 17, ms: expect.any(Number) })
  })
})

describe('G5 the cron route', () => {
  const request = (authorization?: string) =>
    new NextRequest('https://example.test/api/cron/similar-jobs', authorization ? { headers: { authorization } } : undefined)
  const bodyOf = async (response: Response) => ({ status: response.status, body: await response.json() })

  it('exports force-dynamic, force-no-store, 300 s and uses the cron context', async () => {
    const route = await loadRoute()
    expect(route.dynamic).toBe('force-dynamic')
    expect(route.fetchCache).toBe('force-no-store')
    expect(route.maxDuration).toBe(300)
    const source = read('app/api/cron/similar-jobs/route.ts')
    expect(source.match(/getServerSupabase\('[a-zA-Z]+'\)/g)).toStrictEqual(["getServerSupabase('cron')"])
  })

  it('503 when the cron secret is not set, 401 when the header is wrong or missing; no database use', async () => {
    const { GET } = await loadRoute()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    setEnv('CRON_SECRET', undefined)
    expect(await bodyOf(await GET(request(`Bearer ${CRON_VALUE}`)))).toStrictEqual({ status: 503, body: { error: 'Not configured' } })
    setEnv('CRON_SECRET', CRON_VALUE)
    expect(await bodyOf(await GET(request('Bearer wrong')))).toStrictEqual({ status: 401, body: { error: 'Unauthorised' } })
    expect(await bodyOf(await GET(request()))).toStrictEqual({ status: 401, body: { error: 'Unauthorised' } })
    expect(state.contexts).toStrictEqual([])
    expect(state.queries).toStrictEqual([])
  })

  it('a run: keyset reads of live jobs, upsert on (job_id, platform), then the delete; numbers only in the answer', async () => {
    const { GET } = await loadRoute()
    setEnv('CRON_SECRET', CRON_VALUE)
    const rows = [live('a', 'Tax Manager', { pub: 3 }), live('b', 'Tax Manager', { pub: 2 }), live('c', 'Tax Advisor', { pub: 1 })]
    state.answer = (query) => {
      if (query.table === 'jobs') return { data: rows, error: null }
      if (methods(query).includes('delete')) return { data: null, error: null, count: 4 }
      return { data: null, error: null }
    }
    const answer = await bodyOf(await GET(request(`Bearer ${CRON_VALUE}`)))
    expect(answer.status).toBe(200)
    expect(Object.keys(answer.body)).toStrictEqual(['ok', 'live', 'pairs', 'written', 'deleted', 'ms', 'marks'])
    expect(answer.body).toMatchObject({ ok: true, live: 3, pairs: 3, written: 3, deleted: 4 })
    expect(typeof answer.body.ms).toBe('number')
    expect(new Set(state.contexts)).toStrictEqual(new Set(['cron']))

    const [readJobs, write, remove] = state.queries
    expect(state.queries.map((query) => query.table)).toStrictEqual(['jobs', 'job_similar', 'job_similar'])
    expect(argsOf(readJobs, 'select')).toStrictEqual([['id,title,location_country,platform,published_at,created_at,company_name,provider_id,source,ai_duplicate_of,expires_at']])
    expect(argsOf(readJobs, 'eq')).toStrictEqual([['status', 'active']])
    expect(String(argsOf(readJobs, 'or')[0][0])).toMatch(/^expires_at\.is\.null,expires_at\.gt\.\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(argsOf(readJobs, 'gt')).toStrictEqual([])
    expect(argsOf(readJobs, 'order')).toStrictEqual([['id', { ascending: true }]])
    expect(argsOf(readJobs, 'limit')).toStrictEqual([[1000]])
    const runStart = String(argsOf(readJobs, 'or')[0][0]).replace('expires_at.is.null,expires_at.gt.', '')

    const [written, options] = argsOf(write, 'upsert')[0] as [{ computed_at: string }[], unknown]
    expect(options).toStrictEqual({ onConflict: 'job_id,platform' })
    expect(written).toStrictEqual([
      { job_id: 'a', platform: 'ab', similar_ids: ['b', 'c'], computed_at: runStart },
      { job_id: 'b', platform: 'ab', similar_ids: ['a', 'c'], computed_at: runStart },
      { job_id: 'c', platform: 'ab', similar_ids: ['a', 'b'], computed_at: runStart },
    ])
    expect(argsOf(remove, 'delete')).toStrictEqual([[{ count: 'exact' }]])
    expect(argsOf(remove, 'lt')).toStrictEqual([['computed_at', runStart]])
    expect(state.reports).toStrictEqual([])
  })

  it.each([
    ['a read error', 'jobs', false],
    ['a write error', 'job_similar', true],
  ])('%s: 500, one report with a short code only, and no delete', async (_name, failing, write) => {
    const { GET } = await loadRoute()
    setEnv('CRON_SECRET', CRON_VALUE)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    state.answer = (query) =>
      query.table === failing && (!write || methods(query).includes('upsert'))
        ? { data: null, error: { message: 'seed database detail Tax Manager', code: 'XX000' } }
        : query.table === 'jobs'
          ? { data: [live('a', 'Tax Manager'), live('b', 'Tax Manager')], error: null }
          : { data: null, error: null }
    expect(await bodyOf(await GET(request(`Bearer ${CRON_VALUE}`)))).toStrictEqual({ status: 500, body: { error: 'Cron run failed' } })
    expect(state.queries.some((query) => methods(query).includes('delete'))).toBe(false)
    expect(state.reports).toHaveLength(1)
    const [label, problem, extra] = state.reports[0]
    expect(label).toBe('similar jobs refresh failed')
    expect((problem as Error).message).toBe('similar jobs refresh failed')
    expect((problem as Error & { code?: string }).code).toBe('XX000')
    expect(extra).toStrictEqual({ area: 'cron' })
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0]).toStrictEqual([`cron/similar-jobs: ${write ? 'write' : 'read'} failed (XX000)`])
    expect(JSON.stringify([state.reports, error.mock.calls])).not.toMatch(/seed|Tax Manager/)
  })

  it('zero live jobs: 500 and nothing written or deleted', async () => {
    const { GET } = await loadRoute()
    setEnv('CRON_SECRET', CRON_VALUE)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    state.answer = () => ({ data: [], error: null })
    expect((await GET(request(`Bearer ${CRON_VALUE}`))).status).toBe(500)
    expect(state.queries.map((query) => query.table)).toStrictEqual(['jobs'])
  })
})

// ── G6 vercel.json ──────────────────────────────────────────────────────────

describe('G6 vercel.json', () => {
  const config = () => JSON.parse(read('vercel.json')) as { crons: unknown[]; headers: unknown }

  it('the six crons unchanged in order, then the nightly similar-jobs run at 03:04 UTC', () => {
    expect(config().crons).toStrictEqual([
      { path: '/api/cron/expire-jobs', schedule: '0 6 * * *' },
      { path: '/api/ingest/orchestrator', schedule: '*/15 * * * *' },
      { path: '/api/cron/prune-pending-subscribers', schedule: '30 6 * * *' },
      { path: '/api/cron/prune-saved-jobs', schedule: '0 7 * * *' },
      { path: '/api/cron/prune-expired-jobs', schedule: '30 7 * * *' },
      { path: '/api/cron/prune-import-logs', schedule: '45 7 * * *' },
      { path: '/api/cron/similar-jobs', schedule: '4 3 * * *' },
    ])
    expect(read('vercel.json')).toContain('    { "path": "/api/cron/similar-jobs", "schedule": "4 3 * * *" }\n  ],')
  })

  it('the headers block is exactly as on main (fingerprint pinned at fb4d411)', () => {
    expect(sha16(JSON.stringify(config().headers))).toBe('5a9351cb24daaa81')
  })
})

// ── G7 the record file ──────────────────────────────────────────────────────

describe('G7 migrations/0020_job_similar.sql', () => {
  const ANNEX_START = '-- sjdb.sql - SJ-DB (owner D278, design D277)'

  it('after its header comment, the file is the applied script byte for byte', () => {
    const file = read('migrations/0020_job_similar.sql')
    const at = file.indexOf(ANNEX_START)
    expect(at).toBeGreaterThan(0)
    const header = file.slice(0, at)
    expect(header.split('\n').filter(Boolean).every((line) => line.startsWith('--'))).toBe(true)
    const script = file.slice(at)
    expect(sha16(script)).toBe('267e78c841c5b88e')
    expect(script.split('\n')).toHaveLength(74)
    expect(Buffer.byteLength(script)).toBe(3_585)
    for (const line of [
      'ALTER TABLE public.job_similar ENABLE ROW LEVEL SECURITY;',
      'REVOKE ALL ON TABLE public.job_similar FROM PUBLIC, anon, authenticated, service_role;',
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.job_similar TO service_role;',
    ]) expect(script.split('\n')).toContain(line)
    expect(header).toContain('Applied 21 Nov 2026, 02:18:12 UTC (D279)')
    expect(header).toContain('DROP TABLE IF EXISTS public.job_similar;')
  })

  it('the README lists the table and the file', () => {
    const readme = read('migrations/README.md')
    const owned = readme.slice(readme.indexOf('Migrations in this directory cover only'), readme.indexOf('## Files'))
    expect(owned).toContain('job_similar')
    expect(readme).toMatch(/^\| `0020_job_similar\.sql` \| .*Applied once; do not run it again.*\|$/m)
  })
})

// ── G8 search helpers unchanged ─────────────────────────────────────────────

describe('G8 the title rules and the search helper behave as before', () => {
  it('similarTitleTokens and buildSimilarQuery give the same answers', () => {
    expect(similarTitleTokens('Senior Accountant ("Practice & Audit") - London £35,000 Hybrid')).toStrictEqual(['senior', 'accountant', 'practice', 'audit', 'london'])
    expect(similarTitleTokens('Tax Manager Ireland 45,000 - 55,000', 6)).toStrictEqual(['tax', 'manager'])
    expect(buildSimilarQuery('Senior Practice Accountant')).toBe('senior OR practice OR accountant')
    expect(buildSimilarQuery('Remote Full Time UK Job')).toBeNull()
  })
})
