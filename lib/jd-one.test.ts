import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// JD-1 guards (D283): the nightly run can mark extra copies of one advert
// (write switch JOB_DUPLICATE_MARKING, exactly "on"), and visitor lists,
// counts, search and the similar lists can hide them (read switch
// JOB_DUPLICATES_HIDDEN, exactly "true"). With both switches off nothing
// is written and every reader asks exactly what it asked before.

type Query ={ table: string; calls: [string, unknown[]][] }
type DbRow = Record<string, unknown>

const state = vi.hoisted(() => ({
  contexts: [] as string[],
  queries: [] as { table: string; calls: [string, unknown[]][] }[],
  db: { jobs: [] as Record<string, unknown>[], site_counts: [] as Record<string, unknown>[], job_similar: [] as Record<string, unknown>[] } as Record<string, Record<string, unknown>[]>,
  failOn: null as null | ((query: { table: string; calls: [string, unknown[]][] }) => unknown),
  reports: [] as unknown[][],
  cacheCalls: [] as { keyParts: string[]; args: unknown[] }[],
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
    (fn: (...args: unknown[]) => Promise<unknown>, keyParts: string[]) =>
    (...args: unknown[]) => {
      state.cacheCalls.push({ keyParts, args })
      return fn(...args)
    },
  unstable_noStore: () => {},
  revalidateTag: () => {},
  revalidatePath: () => {},
}))

// A small in-memory PostgREST: every chained call is recorded, and awaiting
// the chain evaluates the filters this file's readers use on state.db.
vi.mock('@/lib/supabase-server', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/supabase-server')>()
  type Q = { table: string; calls: [string, unknown[]][] }
  const cmp = (a: unknown, b: unknown) => (a === b ? 0 : a === null || a === undefined ? 1 : b === null || b === undefined ? -1 : (a as string) < (b as string) ? -1 : 1)
  const live = (row: Record<string, unknown>, nowIso: string) =>
    row.status === 'active' && (row.expires_at === null || (row.expires_at as string) > nowIso)
  function rpcResult(query: Q) {
    const [name, args] = query.calls[0][1] as [string, Record<string, unknown>]
    const nowIso = new Date().toISOString()
    let rows = state.db.jobs.filter((row) => live(row, nowIso) && (row.platform as string[]).includes(args.p_platform as string))
    if (name === 'search_jobs_ranked_primary') rows = rows.filter((row) => row.ai_duplicate_of === null)
    else if (name !== 'search_jobs_ranked') return { data: null, error: { code: 'PGRST202' } }
    if (args.p_location_country) rows = rows.filter((row) => row.location_country === args.p_location_country)
    if (args.p_remote_only === true) rows = rows.filter((row) => row.location_remote === true)
    rows = [...rows].sort((a, b) => cmp(b.created_at, a.created_at) || cmp(b.id, a.id))
    const offset = (args.p_offset as number) ?? 0
    return { data: rows.slice(offset, offset + ((args.p_limit as number) ?? 24)), error: null }
  }
  function evaluate(query: Q): unknown {
    const failure = state.failOn ? state.failOn(query) : null
    if (failure) return { data: null, error: failure, status: 500 }
    if (query.table.startsWith('rpc:')) return rpcResult(query)
    const names = query.calls.map(([name]) => name)
    if (names.includes('update') || names.includes('upsert')) return { data: null, error: null }
    if (names.includes('delete')) return { data: null, error: null, count: 0 }
    let rows = [...(state.db[query.table] ?? [])]
    let counted = false
    let single = false
    let window: [number, number] | null = null
    let limit: number | null = null
    const orders: [string, { ascending?: boolean; nullsFirst?: boolean }][] = []
    for (const [name, args] of query.calls) {
      const [column, value] = args as [string, unknown]
      if (name === 'select') counted = Boolean((args[1] as { count?: string } | undefined)?.count)
      else if (name === 'eq') rows = rows.filter((row) => row[column] === value)
      else if (name === 'neq') rows = rows.filter((row) => row[column] !== value)
      else if (name === 'in') rows = rows.filter((row) => (value as unknown[]).includes(row[column]))
      else if (name === 'gt') rows = rows.filter((row) => (row[column] as string) > (value as string))
      else if (name === 'contains') rows = rows.filter((row) => (value as unknown[]).every((v) => (row[column] as unknown[]).includes(v)))
      else if (name === 'is') rows = rows.filter((row) => (row[column] ?? null) === value)
      else if (name === 'like') rows = rows.filter((row) => String(row[column]).startsWith(String(value).replace(/%$/, '')))
      else if (name === 'or') {
        const match = /^expires_at\.is\.null,expires_at\.gt\.(.+)$/.exec(String(column))
        if (!match) throw new Error('unsupported or filter')
        rows = rows.filter((row) => row.expires_at === null || (row.expires_at as string) > match[1])
      } else if (name === 'order') orders.push([column, (value ?? {}) as { ascending?: boolean }])
      else if (name === 'range') window = [args[0] as number, args[1] as number]
      else if (name === 'limit') limit = args[0] as number
      else if (name === 'maybeSingle') single = true
      else if (name === 'textSearch') continue // words are not modelled: every row matches
      else throw new Error(`unsupported call ${name}`)
    }
    if (orders.length > 0) {
      rows.sort((a, b) => {
        for (const [column, options] of orders) {
          const ascending = options.ascending !== false
          const [x, y] = [a[column] ?? null, b[column] ?? null]
          if (x === y) continue
          if (x === null) return options.nullsFirst ? -1 : 1
          if (y === null) return options.nullsFirst ? 1 : -1
          return (ascending ? 1 : -1) * ((x as string) < (y as string) ? -1 : 1)
        }
        return 0
      })
    }
    if (counted) return { data: null, error: null, count: rows.length }
    if (window) rows = rows.slice(window[0], window[1] + 1)
    if (limit !== null) rows = rows.slice(0, limit)
    if (single) return { data: rows[0] ?? null, error: null }
    return { data: rows, error: null }
  }
  const chainFor = (table: string, first?: [string, unknown[]]): unknown => {
    const query: Q = { table, calls: first ? [first] : [] }
    state.queries.push(query)
    const chain: unknown = new Proxy(function () {}, {
      get: (_target, prop) =>
        prop === 'then'
          ? (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve().then(() => evaluate(query)).then(resolve, reject)
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
      return {
        from: (table: string) => chainFor(table),
        rpc: (name: string, args: unknown) => chainFor(`rpc:${name}`, ['rpc', [name, args]]),
      }
    },
  }
})

import { resetCacheGuard } from '@/lib/cache-guard'
import * as jobs from '@/lib/jobs'
import { computeSimilarLists, runSimilarJobsRefresh, type LiveJobRow } from '@/lib/similar-jobs'

const DUPLICATES_PATH = '@/lib/job-duplicates'
const loadDuplicates = () => import(/* @vite-ignore */ DUPLICATES_PATH) as Promise<typeof import('@/lib/job-duplicates')>
const ROUTE_PATH = '@/app/api/cron/similar-jobs/route'
const DIRECT_PATH = '@/app/api/jobs/direct/route'
const loadCron = () => import(/* @vite-ignore */ ROUTE_PATH) as Promise<typeof import('@/app/api/cron/similar-jobs/route')>
const loadDirect = () => import(/* @vite-ignore */ DIRECT_PATH) as Promise<typeof import('@/app/api/jobs/direct/route')>

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const md5 = (text: string) => createHash('md5').update(text).digest('hex')

const SWITCHES = ['JOB_DUPLICATE_MARKING', 'JOB_DUPLICATES_HIDDEN', 'SIMILAR_JOBS_ENABLED', 'CRON_SECRET'] as const
const original = Object.fromEntries(SWITCHES.map((name) => [name, process.env[name]]))
function setEnv(name: (typeof SWITCHES)[number], value: string | undefined) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}
const CRON_VALUE = 'jd-one-cron-test-value'

// ── Fixtures ────────────────────────────────────────────────────────────────

const BASE = Date.parse('2026-11-01T00:00:00.000Z')
const at = (minutes: number) => new Date(BASE + minutes * 60_000).toISOString()
const FUTURE = '2099-01-01T00:00:00.000Z'
const PAST = '2020-01-01T00:00:00.000Z'

function job(id: string, minute: number, options: DbRow = {}): DbRow {
  return {
    id, slug: `slug-${id}`, title: 'Tax Manager', company_name: 'Acme Recruitment', provider_id: 'prov-1', source: 'adzuna',
    platform: ['ab'], status: 'active', expires_at: FUTURE, published_at: at(minute), created_at: at(minute),
    ai_duplicate_of: null, location_country: 'United Kingdom', location_remote: false, location_text: 'London',
    salary_text: null, salary_min: null, salary_max: null, salary_currency: 'GBP',
    ...options,
  }
}

// Marked copies (a1, a2 -> p1; b1 -> p2 in another country; k1 -> p3, the
// only Kenya row), a same-title-and-company primary from another provider
// (p4), singles, an employer row, one expired and one closed row.
function fixtureJobs(): DbRow[] {
  return [
    job('p1', 10),
    job('a1', 11, { ai_duplicate_of: 'p1', location_remote: true }),
    job('a2', 12, { ai_duplicate_of: 'p1' }),
    job('p2', 20, { title: 'Audit Senior', company_name: 'Beta', platform: ['ab', 'et'] }),
    job('b1', 21, { title: 'Audit Senior', company_name: 'Beta', platform: ['ab', 'et'], ai_duplicate_of: 'p2', location_country: 'Ireland' }),
    job('p3', 30, { title: 'Payroll Clerk', company_name: 'Gamma' }),
    job('k1', 31, { title: 'Payroll Clerk', company_name: 'Gamma', ai_duplicate_of: 'p3', location_country: 'Kenya' }),
    job('p4', 40, { provider_id: 'prov-2' }),
    job('s1', 50, { title: 'Credit Controller', company_name: 'Delta', location_remote: true }),
    job('s2', 51, { title: 'Finance Analyst', company_name: 'Eps', platform: ['ab', 'et'] }),
    job('s3', 52, { title: 'Treasury Analyst', company_name: 'Zeta', location_country: 'Ireland' }),
    job('s4', 53, { title: 'VAT Specialist', company_name: 'Eta', platform: ['et', 'ab'], location_remote: true }),
    job('e1', 60, { title: 'Tax Manager', company_name: 'Acme Recruitment', source: 'employer', provider_id: null }),
    job('x1', 70, { title: 'Old Role', company_name: 'Theta', expires_at: PAST }),
    job('x2', 71, { title: 'Closed Role', company_name: 'Iota', status: 'closed' }),
  ]
}

// The site_counts rows public.refresh_site_counts() writes after 0021: the
// same live filter, all live rows and live primaries, plain and per country.
function fixtureCounts(rows: DbRow[]): DbRow[] {
  const nowIso = new Date().toISOString()
  const liveRows = rows.filter((row) => row.status === 'active' && (row.expires_at === null || (row.expires_at as string) > nowIso))
  const out: DbRow[] = []
  for (const platform of ['ab', 'et']) {
    const onSite = liveRows.filter((row) => (row.platform as string[]).includes(platform))
    for (const [prefix, set] of [['jobs_browsable', onSite], ['jobs_primary', onSite.filter((row) => row.ai_duplicate_of === null)]] as const) {
      out.push({ key: `${prefix}:${platform}`, value: set.length, updated_at: nowIso })
      for (const country of Array.from(new Set(onSite.map((row) => row.location_country as string)))) {
        out.push({ key: `${prefix}:${platform}:country:${country}`, value: set.filter((row) => row.location_country === country).length, updated_at: nowIso })
      }
    }
  }
  return out
}

beforeEach(() => {
  state.contexts.length = 0
  state.queries.length = 0
  state.reports.length = 0
  state.cacheCalls.length = 0
  state.failOn = null
  state.db.jobs = fixtureJobs()
  state.db.site_counts = fixtureCounts(state.db.jobs)
  state.db.job_similar = []
  resetCacheGuard()
})

afterEach(() => {
  for (const name of SWITCHES) setEnv(name, original[name])
  vi.restoreAllMocks()
})

const methods = (query: Query) => query.calls.map(([name]) => name)
const argsOf = (query: Query, name: string) => query.calls.filter(([method]) => method === name).map(([, args]) => args)
const jobsQueries = () => state.queries.filter((query) => query.table === 'jobs')
const ids = (rows: unknown) => (rows as { id: string }[]).map((row) => row.id)

const OFF_READ = [undefined, '', 'TRUE', 'True', '1', 'yes', 'on', ' true', 'true ']
const OFF_WRITE = [undefined, '', 'ON', 'On', 'true', 'off', '1', ' on', 'on ']

// ── G3 readers, read switch off: exactly today's queries ────────────────────

describe('G3 read switch off: every reader asks exactly what it asked before', () => {
  it.each(OFF_READ.map((value) => [value]))('JOB_DUPLICATES_HIDDEN %j', async (value) => {
    setEnv('JOB_DUPLICATES_HIDDEN', value)
    setEnv('SIMILAR_JOBS_ENABLED', 'true')
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const list = await jobs.getCachedListingJobs({ platform: 'ab' })
    expect(methods(state.queries[0])).toStrictEqual(['select', 'eq', 'contains', 'or', 'order', 'order', 'order', 'range'])
    expect(ids(list)).toStrictEqual(['e1', 's4', 's3', 's2', 's1', 'p4', 'k1', 'p3', 'b1', 'p2', 'a2', 'a1', 'p1'])

    state.queries.length = 0
    await jobs.getCachedListingJobs({ platform: 'ab', search: 'tax' })
    expect(state.queries.map((query) => query.table)).toStrictEqual(['rpc:search_jobs_ranked'])
    expect(Object.keys((argsOf(state.queries[0], 'rpc')[0] as [string, object])[1])).toStrictEqual([
      'p_platform', 'p_search', 'p_location', 'p_location_country', 'p_employment_types', 'p_seniority_levels', 'p_remote_only',
      'p_salary_min', 'p_salary_max', 'p_posted_within_days', 'p_qualifications', 'p_sources', 'p_sort_by', 'p_limit', 'p_offset',
    ])

    state.queries.length = 0
    expect(await jobs.getCachedListingJobsCount({ platform: 'ab', remoteOnly: true })).toBe(3)
    expect(methods(state.queries[0])).toStrictEqual(['select', 'eq', 'contains', 'or', 'eq'])

    state.queries.length = 0
    expect(await jobs.getBrowsableJobsTotal('ab')).toBe(13)
    expect(argsOf(state.queries[0], 'eq')).toStrictEqual([['key', 'jobs_browsable:ab']])

    state.queries.length = 0
    expect(await jobs.getPrecountedFilterTotal({ platform: 'ab', locationCountry: 'Kenya' })).toBe(1)
    expect(argsOf(state.queries[0], 'like')).toStrictEqual([['key', 'jobs_browsable:ab:%']])
    expect((await jobs.getCachedActiveJobCountries('ab')).map((row) => row.country)).toContain('Kenya')

    state.queries.length = 0
    state.db.job_similar = [{ job_id: 's1', platform: 'ab', similar_ids: ['p4', 's2', 'p1', 'a1'] }]
    expect(ids(await jobs.getSimilarJobs({ excludeId: 's1', platform: 'ab', title: 'Credit Controller' }))).toStrictEqual(['p4', 's2', 'p1', 'a1'])
    expect(methods(jobsQueries()[0])).toStrictEqual(['select', 'in', 'eq', 'contains', 'or', 'limit'])

    // Nothing anywhere names the new column, key or function.
    expect(JSON.stringify(state.queries)).not.toMatch(/ai_duplicate_of|jobs_primary|search_jobs_ranked_primary/)
    expect(state.queries.every((query) => !methods(query).includes('is'))).toBe(true)
    // Cache keys exactly as before: no extra argument, no hideCopies field.
    expect(JSON.stringify(state.cacheCalls)).not.toMatch(/hideCopies/)
    for (const call of state.cacheCalls) {
      if (call.keyParts[0] === 'similar-jobs-saved') expect(call.args).toHaveLength(2)
      if (call.keyParts[0].startsWith('site-counts') || call.keyParts[0] === 'getBrowsableJobsCount') expect(call.args).toHaveLength(1)
    }
  })

  it('the estimate fallback (precount row missing) has no new filter and keeps its key', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    state.db.site_counts = []
    expect(await jobs.getBrowsableJobsTotal('ab')).toBe(13)
    const estimate = jobsQueries()[0]
    expect(methods(estimate)).toStrictEqual(['select', 'eq', 'contains', 'or'])
    expect(state.cacheCalls.find((call) => call.keyParts[0] === 'getBrowsableJobsCount')?.args).toStrictEqual(['ab'])
  })

  it('the /api/search counts (getActiveDirectJobs called directly) have no new filter', async () => {
    expect(await jobs.getActiveDirectJobs({ platform: 'ab', countOnly: true })).toBe(13)
    expect(methods(jobsQueries()[0])).not.toContain('is')
  })
})

// ── G3 readers, read switch on: copies hidden, lists agree with totals ──────

describe('G3 read switch on: every reader hides marked copies', () => {
  beforeEach(() => {
    setEnv('JOB_DUPLICATES_HIDDEN', 'true')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  const HIDE = ['is', ['ai_duplicate_of', null]]

  it('the default list adds the filter once and returns no marked row', async () => {
    const list = await jobs.getCachedListingJobs({ platform: 'ab' })
    expect(state.queries[0].calls.filter(([name]) => name === 'is')).toStrictEqual([HIDE])
    expect(ids(list).sort()).toStrictEqual(['e1', 'p1', 'p2', 'p3', 'p4', 's1', 's2', 's3', 's4'])
  })

  it('the ranked search calls search_jobs_ranked_primary with exactly the same arguments', async () => {
    const params = { platform: 'ab', search: 'tax', remoteOnly: true as const, sortBy: 'recent' as const, limit: 5, offset: 0 }
    setEnv('JOB_DUPLICATES_HIDDEN', undefined)
    await jobs.getCachedListingJobs(params)
    const offArgs = argsOf(state.queries[0], 'rpc')[0] as [string, object]
    state.queries.length = 0
    resetCacheGuard()
    setEnv('JOB_DUPLICATES_HIDDEN', 'true')
    await jobs.getCachedListingJobs(params)
    const onArgs = argsOf(state.queries[0], 'rpc')[0] as [string, object]
    expect(offArgs[0]).toBe('search_jobs_ranked')
    expect(onArgs[0]).toBe('search_jobs_ranked_primary')
    expect(onArgs[1]).toStrictEqual(offArgs[1])
  })

  it('a failing primary search (0021 not applied) takes the same error path as today, never a blank list', async () => {
    state.failOn = (query) => (query.table === 'rpc:search_jobs_ranked_primary' ? { code: 'PGRST202', message: 'seed detail' } : null)
    await expect(jobs.getActiveDirectJobs({ platform: 'ab', search: 'tax' })).rejects.toThrow('getActiveDirectJobs: search_jobs_ranked failed')
    const { GET } = await loadDirect()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await GET(new NextRequest('https://example.test/api/jobs/direct?platform=ab&search=tax'))
    expect(response.status).toBe(503)
  })

  it('counts, precounts, the estimate and the country menu read primaries', async () => {
    expect(await jobs.getCachedListingJobsCount({ platform: 'ab', remoteOnly: true })).toBe(2)
    expect(state.queries[0].calls.filter(([name]) => name === 'is')).toStrictEqual([HIDE])
    expect(await jobs.getActiveDirectJobs({ platform: 'ab', countOnly: true })).toBe(9)

    state.queries.length = 0
    expect(await jobs.getBrowsableJobsTotal('ab')).toBe(9)
    expect(await jobs.getBrowsableJobsTotal('et')).toBe(3)
    expect(argsOf(state.queries[0], 'eq')).toStrictEqual([['key', 'jobs_primary:ab']])

    state.queries.length = 0
    expect(await jobs.getPrecountedFilterTotal({ platform: 'ab', locationCountry: 'Ireland' })).toBe(1)
    expect(argsOf(state.queries[0], 'like')).toStrictEqual([['key', 'jobs_primary:ab:%']])
    expect(await jobs.getPrecountedFilterTotal({ platform: 'ab', locationCountry: 'Kenya' })).toBe(0)

    const countries = await jobs.getCachedActiveJobCountries('ab')
    expect(countries).toStrictEqual([{ country: 'United Kingdom', count: 8 }, { country: 'Ireland', count: 1 }])

    state.db.site_counts = []
    resetCacheGuard()
    state.queries.length = 0
    expect(await jobs.getBrowsableJobsTotal('ab')).toBe(9)
    expect(jobsQueries()[0].calls.filter(([name]) => name === 'is')).toStrictEqual([HIDE])
  })

  it.each([
    ['plain ab', 'platform=ab'],
    ['plain et', 'platform=et'],
    ['one country', 'platform=ab&location_country=United%20Kingdom'],
    ['remote only', 'platform=ab&remote=true'],
    ['newest first (ranked)', 'platform=ab&sort_by=recent'],
    ['words', 'platform=ab&search=tax'],
  ])('/api/jobs/direct %s: every page together is exactly the total, no marked row, no empty last page', async (_name, query) => {
    const { GET } = await loadDirect()
    const seen: string[] = []
    let total: number | null = null
    for (let offset = 0; offset < 40; offset += 3) {
      const response = await GET(new NextRequest(`https://example.test/api/jobs/direct?${query}&limit=3&offset=${offset}`))
      expect(response.status).toBe(200)
      const body = (await response.json()) as { jobs: { id: string }[]; total: number | null }
      total = body.total
      if (offset < (total ?? 0)) expect(body.jobs.length).toBeGreaterThan(0)
      seen.push(...body.jobs.map((row) => row.id))
      if (body.jobs.length < 3) break
    }
    expect(total).toBe(seen.length)
    expect(new Set(seen).size).toBe(seen.length)
    const marked = new Set(state.db.jobs.filter((row) => row.ai_duplicate_of !== null).map((row) => row.id))
    expect(seen.filter((id) => marked.has(id))).toStrictEqual([])
  })

  it('the similar read drops marked rows and repeats of title and company, in saved order, within the limit', async () => {
    setEnv('SIMILAR_JOBS_ENABLED', 'true')
    state.db.job_similar = [{ job_id: 's1', platform: 'ab', similar_ids: ['p4', 's2', 'p1', 'a1', 's3', 'p2', 'p3'] }]
    expect(ids(await jobs.getSimilarJobs({ excludeId: 's1', platform: 'ab', title: 'Credit Controller' }))).toStrictEqual(['p4', 's2', 's3', 'p2', 'p3'])
    expect(jobsQueries()[0].calls.filter(([name]) => name === 'is')).toStrictEqual([HIDE])
    state.queries.length = 0
    expect(ids(await jobs.getSimilarJobs({ excludeId: 's1', platform: 'ab', title: 'Credit Controller', limit: 2 }))).toStrictEqual(['p4', 's2'])
  })

  it('the kill switch still comes first: off means no read at all, whatever the read switch', async () => {
    setEnv('SIMILAR_JOBS_ENABLED', undefined)
    expect(await jobs.getSimilarJobs({ excludeId: 's1', platform: 'ab', title: 'Credit Controller' })).toStrictEqual([])
    expect(state.queries).toStrictEqual([])
    expect(state.cacheCalls).toStrictEqual([])
  })
})

// ── G5 cache keys ───────────────────────────────────────────────────────────

describe('G5 every cached reader keys on the read switch (only when it is on)', () => {
  async function keysFor(value: string | undefined) {
    setEnv('JOB_DUPLICATES_HIDDEN', value)
    setEnv('SIMILAR_JOBS_ENABLED', 'true')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    state.db.site_counts = fixtureCounts(state.db.jobs)
    state.cacheCalls.length = 0
    resetCacheGuard()
    await jobs.getCachedListingJobs({ platform: 'ab', locationCountry: 'Ireland' })
    await jobs.getCachedListingJobsCount({ platform: 'ab', locationCountry: 'Ireland' })
    await jobs.getBrowsableJobsTotal('ab')
    await jobs.getPrecountedFilterTotal({ platform: 'ab', locationCountry: 'Ireland' })
    state.db.job_similar = [{ job_id: 's1', platform: 'ab', similar_ids: ['s2'] }]
    await jobs.getSimilarJobs({ excludeId: 's1', platform: 'ab', title: 'Credit Controller' })
    state.db.site_counts = []
    resetCacheGuard()
    await jobs.getBrowsableJobsTotal('ab')
    return Object.fromEntries(state.cacheCalls.map((call) => [call.keyParts[0], call.args]))
  }

  it('off: the same arguments as before; on: the switch is part of each key', async () => {
    const off = await keysFor(undefined)
    const on = await keysFor('true')
    expect(off['listing-jobs']).toStrictEqual([jobs.normaliseListingPage({ platform: 'ab', locationCountry: 'Ireland' })])
    expect(on['listing-jobs']).toStrictEqual([{ ...jobs.normaliseListingPage({ platform: 'ab', locationCountry: 'Ireland' }), hideCopies: true }])
    expect(off['listing-jobs-count']).toStrictEqual([jobs.normaliseListingFilters({ platform: 'ab', locationCountry: 'Ireland' })])
    expect(on['listing-jobs-count']).toStrictEqual([{ ...jobs.normaliseListingFilters({ platform: 'ab', locationCountry: 'Ireland' }), hideCopies: true }])
    expect(off['site-counts-jobs-browsable']).toStrictEqual(['ab'])
    expect(on['site-counts-jobs-browsable']).toStrictEqual(['ab', true])
    expect(off['site-counts-jobs-filters']).toStrictEqual(['ab'])
    expect(on['site-counts-jobs-filters']).toStrictEqual(['ab', true])
    expect(off['getBrowsableJobsCount']).toStrictEqual(['ab'])
    expect(on['getBrowsableJobsCount']).toStrictEqual(['ab', true])
    expect(off['similar-jobs-saved']).toStrictEqual(['s1', 'ab'])
    expect(on['similar-jobs-saved']).toStrictEqual(['s1', 'ab', true])
  })

  it('the key parts and lifetimes of every cached reader are unchanged', () => {
    const source = read('lib/jobs.ts')
    for (const line of [
      "unstable_cache(fetchListingJobs, ['listing-jobs'], { revalidate: 300, tags: ['jobs', 'jobs:listings'] })",
      "unstable_cache(fetchListingJobsCount, ['listing-jobs-count'], { revalidate: 300, tags: ['jobs', 'jobs:listings'] })",
      "unstable_cache(fetchSavedSimilarJobs, ['similar-jobs-saved'], { revalidate: 3600, tags: ['jobs', 'related-jobs'] })",
      "guardCachedRead(['site-counts-jobs-browsable'], unstable_cache(fetchJobsPrecount, ['site-counts-jobs-browsable'], {",
      "guardCachedRead(['getBrowsableJobsCount'], unstable_cache(fetchBrowsableJobsCount, ['getBrowsableJobsCount'], {",
      "guardCachedRead(['site-counts-jobs-filters'], unstable_cache(fetchFilterPrecounts, ['site-counts-jobs-filters'], {",
    ]) expect(source).toContain(line)
  })

  it('the read switch is read in one place, exactly "true"', () => {
    const source = read('lib/jobs.ts')
    expect(source.match(/process\.env\.JOB_DUPLICATES_HIDDEN/g)).toHaveLength(1)
    expect(source).toContain("return process.env.JOB_DUPLICATES_HIDDEN === 'true'")
  })
})

// ── G4 the similar compute ──────────────────────────────────────────────────

type LiveRow = LiveJobRow & { company_name: string; provider_id: string | null; source: string; ai_duplicate_of: string | null }

// Deterministic rows: 40 adverts, many posted several times by one provider
// (the copies after the first are marked to it), across two countries.
function liveRows(marked: boolean): LiveRow[] {
  const titles = ['Tax Manager', 'Tax Senior', 'Audit Manager', 'Payroll Manager', 'Senior Tax Accountant', 'Finance Manager', 'Tax Advisor', 'Audit Senior']
  const rows: LiveRow[] = []
  let n = 0
  for (let advert = 0; advert < 40; advert++) {
    const copies = 1 + (advert % 4)
    const firstId = `r-${String(n).padStart(4, '0')}`
    for (let copy = 0; copy < copies; copy++) {
      const id = `r-${String(n).padStart(4, '0')}`
      rows.push({
        id,
        title: titles[advert % titles.length],
        company_name: `Company ${advert % 13}`,
        provider_id: `prov-${advert % 3}`,
        source: 'adzuna',
        location_country: advert % 5 === 0 ? 'Ireland' : 'United Kingdom',
        platform: advert % 6 === 0 ? ['ab', 'et'] : ['ab'],
        published_at: at(1000 - n),
        created_at: at(1000 - n + copy),
        ai_duplicate_of: marked && copy > 0 ? firstId : null,
      })
      n++
    }
  }
  return rows
}

const fakeClock = () => {
  let now = Date.parse('2026-11-22T03:04:00.000Z')
  return () => (now += 5)
}

function fakeStores(rows: LiveRow[], options: { markErrorAt?: number } = {}) {
  const upserts: unknown[] = []
  const writes: { kind: 'mark' | 'clear'; primary?: string; ids: string[] }[] = []
  const store = {
    readLivePage: async (after: string | null) => rows.filter((row) => after === null || row.id > after).slice(0, 1000),
    upsertLists: async (lists: unknown[]) => {
      upserts.push(...lists)
    },
    deleteStale: async () => 0,
  }
  const marks = {
    markCopies: async (primary: string, batch: string[]) => {
      writes.push({ kind: 'mark', primary, ids: batch })
      if (options.markErrorAt === writes.filter((write) => write.kind === 'mark').length - 1) throw Object.assign(new Error('seed'), { code: '57014' })
    },
    clearMarks: async (batch: string[]) => {
      writes.push({ kind: 'clear', ids: batch })
    },
  }
  return { store, marks, upserts, writes }
}

describe('G4 the similar compute', () => {
  it('read switch off: lists identical to today, with or without the new columns and marks', async () => {
    const rows = liveRows(true)
    const stripped = rows.map(({ id, title, location_country, platform, published_at, created_at }) => ({ id, title, location_country, platform, published_at, created_at }))
    const today = computeSimilarLists(stripped)
    expect(computeSimilarLists(rows)).toStrictEqual(today)
    const fake = fakeStores(rows)
    const result = await runSimilarJobsRefresh(fake.store, fakeClock(), { marks: { write: false, store: fake.marks }, hideCopies: false })
    expect(result.ok).toBe(true)
    expect(fake.upserts).toStrictEqual(today)
    expect(fake.writes).toStrictEqual([])
  })

  it('read switch on: candidates are primaries only, never the viewed advert, never a repeat; copies still get a list', async () => {
    const rows = liveRows(true)
    const fake = fakeStores(rows)
    await runSimilarJobsRefresh(fake.store, fakeClock(), { marks: { write: false, store: fake.marks }, hideCopies: true })
    const lists = fake.upserts as { job_id: string; platform: string; similar_ids: string[] }[]
    const byId = new Map(rows.map((row) => [row.id, row]))
    const shown = (id: string) => jobs.visibleAdvertKey(byId.get(id)!.title, byId.get(id)!.company_name)
    expect(lists.length).toBeGreaterThan(0)
    for (const list of lists) {
      for (const id of list.similar_ids) expect(byId.get(id)!.ai_duplicate_of).toBeNull()
      expect(list.similar_ids.map(shown)).not.toContain(shown(list.job_id))
      expect(new Set(list.similar_ids.map(shown)).size).toBe(list.similar_ids.length)
    }
    const copies = rows.filter((row) => row.ai_duplicate_of !== null)
    expect(copies.length).toBeGreaterThan(10)
    expect(copies.every((copy) => lists.some((list) => list.job_id === copy.id))).toBe(true)
  })

  it('marks applied in this run: the lists use the new marks', async () => {
    setEnv('JOB_DUPLICATES_HIDDEN', 'true')
    const unmarked = liveRows(false)
    const fake = fakeStores(unmarked)
    const result = await runSimilarJobsRefresh(fake.store, fakeClock(), { marks: { write: true, store: fake.marks }, hideCopies: true })
    expect(result).toMatchObject({ ok: true, marks: { applied: true, failed: false } })
    const reference = fakeStores(liveRows(true))
    await runSimilarJobsRefresh(reference.store, fakeClock(), { marks: { write: false, store: reference.marks }, hideCopies: true })
    expect(fake.upserts).toStrictEqual(reference.upserts)
  })

  it('a failed mark write: the lists use the marks as read, never the half-applied plan', async () => {
    const unmarked = liveRows(false)
    const failing = fakeStores(unmarked, { markErrorAt: 1 })
    const result = await runSimilarJobsRefresh(failing.store, fakeClock(), { marks: { write: true, store: failing.marks }, hideCopies: true })
    expect(result).toMatchObject({ ok: true, marks: { applied: false, failed: true } })
    // MW-1: 6 marks start together; the 1st (already resolved) takes the 7th
    // before the 2nd's failure is seen; nothing starts after that.
    expect(failing.writes.filter((write) => write.kind === 'mark')).toHaveLength(7)
    const asRead = fakeStores(liveRows(false))
    await runSimilarJobsRefresh(asRead.store, fakeClock(), { marks: { write: false, store: asRead.marks }, hideCopies: true })
    expect(failing.upserts).toStrictEqual(asRead.upserts)
  })
})

// ── G2 the nightly marking ──────────────────────────────────────────────────

function cronRows(): DbRow[] {
  // One advert posted 131 times (a write batch is at most 100), a group whose
  // primary has gone (b-copies point at a missing row), a marked singleton,
  // an employer row with a stale mark, and correct marks already in place.
  const rows: DbRow[] = []
  for (let i = 0; i < 131; i++) rows.push(job(`g-${String(i).padStart(3, '0')}`, 100 + i, { title: 'Big Advert', company_name: 'Bulk Co' }))
  rows.push(job('h-1', 300, { title: 'Moved Advert', company_name: 'Hop', ai_duplicate_of: 'gone' }))
  rows.push(job('h-2', 301, { title: 'Moved Advert', company_name: 'Hop', ai_duplicate_of: 'gone' }))
  rows.push(job('solo', 400, { title: 'Lonely Role', company_name: 'One', ai_duplicate_of: 'g-000' }))
  rows.push(job('emp', 500, { source: 'employer', provider_id: null, ai_duplicate_of: 'g-000' }))
  rows.push(job('ok-1', 600, { title: 'Settled', company_name: 'Calm' }))
  rows.push(job('ok-2', 601, { title: 'Settled', company_name: 'Calm', ai_duplicate_of: 'ok-1' }))
  return rows
}

describe('G2 the nightly marking', () => {
  const request = () => new NextRequest('https://example.test/api/cron/similar-jobs', { headers: { authorization: `Bearer ${CRON_VALUE}` } })
  const updates = () => state.queries.filter((query) => methods(query).includes('update'))

  beforeEach(() => {
    setEnv('CRON_SECRET', CRON_VALUE)
    state.db.jobs = cronRows()
  })

  it.each(OFF_WRITE.map((value) => [value]))('JOB_DUPLICATE_MARKING %j: not one write to jobs, lists exactly as today', async (value) => {
    setEnv('JOB_DUPLICATE_MARKING', value)
    const { GET } = await loadCron()
    const response = await GET(request())
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(updates()).toStrictEqual([])
    expect(state.queries.filter((query) => query.table === 'jobs').every((query) => methods(query)[0] === 'select')).toBe(true)
    expect(body.marks).toStrictEqual({ groups: 3, toMark: 131, toClear: 3, writes: 0, applied: false, failed: false, timedOut: false, ms: 0 })
    const upserted = state.queries.filter((query) => methods(query).includes('upsert')).flatMap((query) => (argsOf(query, 'upsert')[0][0] as { job_id: string; platform: string; similar_ids: string[] }[]).map(({ job_id, platform, similar_ids }) => ({ job_id, platform, similar_ids })))
    const byIdOrder = [...state.db.jobs].sort((a, b) => ((a.id as string) < (b.id as string) ? -1 : 1))
    expect(upserted).toStrictEqual(computeSimilarLists(byIdOrder as unknown as LiveJobRow[]))
  })

  it('"on": only ai_duplicate_of, clears first, at most 100 ids per statement, marks only live imported rows', async () => {
    setEnv('JOB_DUPLICATE_MARKING', 'on')
    const { GET } = await loadCron()
    const response = await GET(request())
    const body = await response.json()
    expect(response.status).toBe(200)
    const all = updates()
    expect(all.length).toBeGreaterThan(0)
    for (const query of all) {
      expect(query.table).toBe('jobs')
      const [values] = argsOf(query, 'update')[0] as [Record<string, unknown>]
      expect(Object.keys(values)).toStrictEqual(['ai_duplicate_of'])
      const [[column, list]] = argsOf(query, 'in') as [[string, string[]]]
      expect(column).toBe('id')
      expect(list.length).toBeGreaterThan(0)
      expect(list.length).toBeLessThanOrEqual(100)
      if (values.ai_duplicate_of === null) {
        expect(methods(query)).toStrictEqual(['update', 'in'])
      } else {
        expect(methods(query)).toStrictEqual(['update', 'in', 'eq', 'neq'])
        expect(argsOf(query, 'eq')).toStrictEqual([['status', 'active']])
        expect(argsOf(query, 'neq')).toStrictEqual([['source', 'employer']])
      }
    }
    const kinds = all.map((query) => ((argsOf(query, 'update')[0][0] as Record<string, unknown>).ai_duplicate_of === null ? 'clear' : 'mark'))
    expect(kinds).toStrictEqual(['clear', 'mark', 'mark', 'mark'])
    const cleared = (argsOf(all[0], 'in')[0][1] as string[])
    expect(cleared).toStrictEqual(['emp', 'h-1', 'solo'])
    expect(all.slice(1).map((query) => [(argsOf(query, 'update')[0][0] as Record<string, unknown>).ai_duplicate_of, (argsOf(query, 'in')[0][1] as string[]).length]))
      .toStrictEqual([['g-000', 100], ['g-000', 30], ['h-1', 1]])
    expect(body.marks).toStrictEqual({ groups: 3, toMark: 131, toClear: 3, writes: 4, applied: true, failed: false, timedOut: false, ms: expect.any(Number) })
    expect(state.reports).toStrictEqual([])
    expect(Object.keys(body)).toStrictEqual(['ok', 'live', 'pairs', 'written', 'deleted', 'ms', 'marks'])
  })

  it('"on" and a write error: no further mark write, one report with a short code, lists from the marks as read, 200', async () => {
    setEnv('JOB_DUPLICATE_MARKING', 'on')
    setEnv('JOB_DUPLICATES_HIDDEN', 'true')
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    state.failOn = (query) => (methods(query).includes('update') && (argsOf(query, 'update')[0][0] as Record<string, unknown>).ai_duplicate_of !== null ? { code: '57014', message: 'seed detail Big Advert' } : null)
    const { GET } = await loadCron()
    const response = await GET(request())
    const body = await response.json()
    expect(response.status).toBe(200)
    // MW-1: the three mark batches start together (at most 6 in flight)
    // before the first failure is seen; nothing starts after it.
    expect(updates().map((query) => ((argsOf(query, 'update')[0][0] as Record<string, unknown>).ai_duplicate_of === null ? 'clear' : 'mark'))).toStrictEqual(['clear', 'mark', 'mark', 'mark'])
    expect(body.marks).toMatchObject({ applied: false, failed: true, writes: 4 })
    expect(state.reports).toHaveLength(1)
    const [label, problem, extra] = state.reports[0] as [string, Error & { code?: string }, unknown]
    expect(label).toBe('similar jobs marking failed')
    expect(problem.message).toBe('similar jobs marking failed')
    expect(problem.code).toBe('57014')
    expect(extra).toStrictEqual({ area: 'cron' })
    expect(error.mock.calls).toStrictEqual([['cron/similar-jobs: marking failed (57014)']])
    expect(JSON.stringify([state.reports, error.mock.calls, body])).not.toMatch(/seed|Big Advert/)
    expect(state.queries.some((query) => methods(query).includes('upsert'))).toBe(true)
    expect(state.queries.some((query) => methods(query).includes('delete'))).toBe(true)
  })

  it('"on" and a read error: no mark write and no list write', async () => {
    setEnv('JOB_DUPLICATE_MARKING', 'on')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    state.failOn = (query) => (query.table === 'jobs' && methods(query)[0] === 'select' ? { code: 'XX000' } : null)
    const { GET } = await loadCron()
    expect((await GET(request())).status).toBe(500)
    expect(updates()).toStrictEqual([])
    expect(state.queries.some((query) => methods(query).includes('upsert'))).toBe(false)
  })

  it('the nightly read carries the four extra light columns in the same keyset pages', async () => {
    const { LIVE_JOB_COLUMNS } = await import('@/lib/similar-jobs')
    expect(LIVE_JOB_COLUMNS).toBe('id,title,location_country,platform,published_at,created_at,company_name,provider_id,source,ai_duplicate_of,expires_at')
  })

  it('the write switch is read in the route only, exactly "on"; the run takes it as a flag', () => {
    const route = read('app/api/cron/similar-jobs/route.ts')
    expect(route).toContain("process.env.JOB_DUPLICATE_MARKING === 'on'")
    expect(route.match(/process\.env\.JOB_DUPLICATE_MARKING/g)).toHaveLength(1)
    expect(read('lib/similar-jobs.ts')).not.toContain('process.env')
    expect(read('lib/job-duplicates.ts')).not.toContain('process.env')
  })

  it('past the time budget the run stops marking, keeps the marks as read and still saves the lists', async () => {
    const rows = liveRows(false)
    const fake = fakeStores(rows)
    let now = Date.parse('2026-11-22T03:04:00.000Z')
    const slowClock = () => (now += 30_000)
    const result = await runSimilarJobsRefresh(fake.store, slowClock, { marks: { write: true, store: fake.marks }, hideCopies: false })
    expect(result).toMatchObject({ ok: true, marks: { applied: false, failed: false, timedOut: true } })
    expect(fake.writes.length).toBeLessThan(5)
    expect(fake.upserts).toStrictEqual(computeSimilarLists(rows))
  })

  it('without options the run answers exactly as before (no marks key)', async () => {
    const fake = fakeStores(liveRows(true))
    const result = await runSimilarJobsRefresh(fake.store, fakeClock())
    expect(Object.keys(result)).toStrictEqual(['ok', 'live', 'pairs', 'written', 'deleted', 'ms'])
    expect(fake.writes).toStrictEqual([])
  })

  it('the plan the route applies is the module plan', async () => {
    const { planDuplicateMarks } = await loadDuplicates()
    const plan = planDuplicateMarks(cronRows() as never)
    expect(plan.toClear).toStrictEqual(['emp', 'h-1', 'solo'])
    expect(plan.toMark.map(([primary, list]) => [primary, list.length])).toStrictEqual([['g-000', 130], ['h-1', 1]])
  })
})

// ── G6 the record file 0021 ─────────────────────────────────────────────────

describe('G6 migrations/0021 (record file, not applied)', () => {
  const files = () => execFileSync('git', ['ls-files', 'migrations'], { encoding: 'utf8' }).split('\n').filter((f) => /^migrations\/0021_/.test(f))
  const sql = () => read(files()[0])
  const code = () => sql().split('\n').filter((line) => !line.trim().startsWith('--')).join('\n')
  const bodyAfter = (text: string, start: string) => {
    const i = text.indexOf(start)
    const a = text.indexOf('AS $$', i) + 5
    return text.slice(a, text.indexOf('\n$$;', a) + 1)
  }

  it('exactly one 0021 file with the header: date, why, D283, not applied', () => {
    expect(files()).toStrictEqual(['migrations/0021_duplicate_adverts_counts_and_search.sql'])
    const header = sql().split('\n').slice(0, 40).join('\n')
    for (const words of ['21 Nov 2026', 'D283', 'NOT APPLIED', 'applied later by an owner-approved database job after a fresh backup', 'JOB_DUPLICATES_HIDDEN']) {
      expect(header).toContain(words)
    }
  })

  it('only additive statements: no DROP, TRUNCATE, ALTER, no write to jobs, no new right taken from a role in use', () => {
    const text = code()
    expect(text).not.toMatch(/\bDROP\b|\bTRUNCATE\b|\bALTER\b|\bUPDATE\s+public\.jobs\b|\bINSERT\s+INTO\s+public\.jobs\b|\bDELETE\s+FROM\s+public\.jobs\b/i)
    const statements = text.split('\n').filter((line) => /^(CREATE|REVOKE|GRANT|COMMENT|BEGIN|COMMIT|SELECT|DO|NOTIFY|SET)\b/.test(line))
    expect(statements.filter((line) => line.startsWith('CREATE'))).toStrictEqual([
      'CREATE OR REPLACE FUNCTION public.refresh_site_counts()',
      'CREATE OR REPLACE FUNCTION public.search_jobs_ranked_primary(',
    ])
    expect(text.match(/^REVOKE[^;]*;/gm)).toStrictEqual([
      'REVOKE ALL ON FUNCTION public.refresh_site_counts() FROM PUBLIC, anon, authenticated, service_role;',
      'REVOKE ALL ON FUNCTION public.search_jobs_ranked_primary(\n  text, text, text, text, text[], text[], boolean, integer, integer,\n  integer, text[], text[], text, integer, integer\n) FROM PUBLIC, anon, authenticated;',
    ])
    expect(text.match(/^GRANT[^;]*;/gm)).toStrictEqual([
      'GRANT EXECUTE ON FUNCTION public.search_jobs_ranked_primary(\n  text, text, text, text, text[], text[], boolean, integer, integer,\n  integer, text[], text[], text, integer, integer\n) TO service_role;',
    ])
    // The only DELETE is the refresh's own clean-up of site_counts rows.
    expect(text.match(/\bDELETE\b/g)).toHaveLength(1)
    expect(text).toContain('DELETE FROM public.site_counts')
  })

  it('the ranked search for primaries is the live v2 body with exactly one added condition', () => {
    const v2 = bodyAfter(read('migrations/0010_search_jobs_ranked_v2_and_countries.sql'), 'CREATE OR REPLACE FUNCTION public.search_jobs_ranked(')
    const primary = bodyAfter(sql(), 'CREATE OR REPLACE FUNCTION public.search_jobs_ranked_primary(')
    expect(md5(v2)).toBe('562f61be14d4f61b16bb023067641559')
    const added = '\n          AND j.ai_duplicate_of IS NULL'
    expect(primary.split(added)).toHaveLength(2)
    expect(primary.replace(added, '')).toBe(v2)
    const signature = (text: string, name: string) => text.slice(text.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`), text.indexOf('AS $$', text.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`))).replace(`public.${name}(`, 'public.F(')
    expect(signature(sql(), 'search_jobs_ranked_primary')).toBe(signature(read('migrations/0010_search_jobs_ranked_v2_and_countries.sql'), 'search_jobs_ranked'))
  })

  it('the refresh keeps every 0011 row and adds the primaries with the same live filter', () => {
    const body = bodyAfter(sql(), 'CREATE OR REPLACE FUNCTION public.refresh_site_counts()')
    for (const part of [
      "WHERE j.status = 'active'\n      AND (j.expires_at IS NULL OR j.expires_at > now())",
      "'jobs_browsable:' || p.platform AS key",
      "'jobs_browsable:' || g.platform || ':country:' || g.location_country",
      "'jobs_primary:' || p.platform",
      "'jobs_primary:' || g.platform || ':country:' || g.location_country",
      '(j.ai_duplicate_of IS NULL) AS is_primary',
      'count(*) FILTER (WHERE b.is_primary) AS n_primary',
      "starts_with(key, 'jobs_primary:ab:country:')",
      "starts_with(key, 'jobs_primary:et:country:')",
      'ON CONFLICT (key) DO UPDATE',
    ]) expect(body).toContain(part)
    expect(body.match(/FROM public\.jobs/g)).toHaveLength(1)
  })

  it('the header fingerprints match the bodies, and the guard accepts the live 0011 body', () => {
    const text = sql()
    for (const start of ['CREATE OR REPLACE FUNCTION public.refresh_site_counts()', 'CREATE OR REPLACE FUNCTION public.search_jobs_ranked_primary(']) {
      const body = bodyAfter(text, start)
      expect(text).toContain(md5(body))
      expect(text).toContain(md5(body.replace(/\n/g, '\r\n')))
    }
    for (const live of ['e2fa7cc06c83cef715c3e087180c19be', 'f5a0f31a2f07fac7c832745d2b301607']) expect(code()).toContain(`'${live}'`)
  })

  it('the undo is written as comments, and the code uses exactly the names 0021 creates', () => {
    const comments = sql().split('\n').filter((line) => line.trim().startsWith('--')).join('\n')
    expect(comments).toContain('DROP FUNCTION IF EXISTS public.search_jobs_ranked_primary(')
    expect(comments).toContain("DELETE FROM public.site_counts WHERE starts_with(key, 'jobs_primary:');")
    expect(comments).toContain('migrations/0011')
    const jobsSource = read('lib/jobs.ts')
    expect(jobsSource).toContain("'search_jobs_ranked_primary'")
    expect(jobsSource).toContain("'jobs_primary'")
  })

  it('the README lists 0021 as applied', () => {
    const row = read('migrations/README.md').split('\n').find((line) => line.startsWith('| `0021_'))
    expect(row).toBeDefined()
    expect(row).toContain('**Applied (see ab-control FINDINGS) (JD-1, D283).**')
  })
})

// ── G7 nothing out of scope ─────────────────────────────────────────────────

describe('G7 scope', () => {
  const OUT = ['lib/ingestion/', 'lib/canonical.ts', 'app/sitemap', 'app/sitemaps/', 'app/et-sitemap/', 'app/jobs/[slug]/', 'components/', 'vercel.json', 'next.config', 'middleware', 'package.json', 'package-lock.json', 'CLAUDE.md', 'docs/AGENT-RULES.md']

  it('no JD-1 commit touches a file out of scope (checked where the history is available)', () => {
    const commits = execFileSync('git', ['log', '--format=%H', '--grep=^JD-1:', 'HEAD'], { encoding: 'utf8' }).split('\n').filter(Boolean)
    const touched = commits.flatMap((sha) => execFileSync('git', ['diff-tree', '-r', '--name-only', '--no-commit-id', sha], { encoding: 'utf8' }).split('\n').filter(Boolean))
    expect(touched.filter((file) => OUT.some((out) => file.startsWith(out)))).toStrictEqual([])
  })

  it('.env.example gains the two switches, each with a one-line comment, off by default', () => {
    const lines = read('.env.example').split('\n')
    for (const name of ['JOB_DUPLICATE_MARKING', 'JOB_DUPLICATES_HIDDEN']) {
      const at = lines.indexOf(`${name}=`)
      expect(at).toBeGreaterThan(0)
      expect(lines[at - 1]).toMatch(/^# Jobs: .*(off|unset)/i)
      expect(lines.filter((line) => line.startsWith(`${name}=`))).toHaveLength(1)
    }
    expect(lines[lines.indexOf('JOB_DUPLICATES_HIDDEN=') - 1]).toContain('0021')
  })
})
