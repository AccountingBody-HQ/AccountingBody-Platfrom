import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  getBrowsableJobsTotal, getBrowsableJobsCount, getCachedListingJobs,
  getCachedListingJobsCount, getCachedActiveJobCountries, countryListFromPrecounts, COUNTRY_LIST_LOG, jobsTotalSource, resetJobsTotalSourceWarning,
  normaliseListingPage, normaliseListingFilters, isUnfilteredListing, siteCountKey,
  filterPrecountKey, getPrecountedFilterTotal, FILTER_TOTAL_LOG,
  DEFAULT_LIST_ORDER, PRECOUNT_MAX_AGE_MS, JOBS_TOTAL_LOG, RELEVANCE_FALLBACK_LOG,
} from './jobs'
import { resetCacheGuard } from './cache-guard'

// The speed job (D108): the jobs total comes from a pre-counted row, and
// the default list (no search words, no chosen sort) is a plain,
// index-ordered select instead of the ranked search.

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
const cacheCalls = vi.hoisted(() => [] as Array<{ keyParts: string[]; options: unknown; args: unknown[] }>)
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown, keyParts: string[], options: unknown) =>
    (...args: unknown[]) => {
      cacheCalls.push({ keyParts, options, args })
      return fn(...args)
    },
}))

type Answer = { data?: unknown; count?: number | null; error: unknown; status?: number }

// A recording fake: every builder call is written to `calls` (per query,
// starting at .from()), and each query settles with the answer scripted
// for its table ('site_counts', 'jobs') or for .rpc().
interface Script { site_counts?: Answer; jobs?: Answer; rpc?: Answer }
let script: Script
let queries: Array<{ table: string; calls: Array<[string, ...unknown[]]> }>
let rpcCalls: Array<[string, unknown]>

function fakeClient() {
  let current: { table: string; calls: Array<[string, ...unknown[]]> } | null = null
  const settle = () => {
    const table = current?.table ?? ''
    const answer = (script as Record<string, Answer | undefined>)[table] ?? { data: null, count: null, error: null }
    return Promise.resolve({ data: null, count: null, status: 200, ...answer })
  }
  const builder: Record<string, unknown> = {}
  const chain = (name: string) => (...args: unknown[]) => {
    current?.calls.push([name, ...args])
    return builder
  }
  for (const name of ['select', 'eq', 'contains', 'or', 'in', 'ilike', 'like', 'gte', 'lte', 'textSearch', 'order', 'range']) {
    builder[name] = chain(name)
  }
  builder.from = (table: string) => {
    current = { table, calls: [] }
    queries.push(current)
    return builder
  }
  builder.maybeSingle = () => { current?.calls.push(['maybeSingle']); return settle() }
  builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => settle().then(resolve, reject)
  builder.rpc = (name: string, args: unknown) => {
    rpcCalls.push([name, args])
    return Promise.resolve({ data: null, count: null, status: 200, ...(script.rpc ?? { data: [], error: null }) })
  }
  return builder
}

const NOW = new Date('2026-11-11T12:00:00Z')
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString()
const tableQueries = (table: string) => queries.filter(q => q.table === table)

let warn: ReturnType<typeof vi.spyOn>
let error: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  script = {}
  queries = []
  rpcCalls = []
  cacheCalls.length = 0
  vi.mocked(createClient).mockImplementation(() => fakeClient() as unknown as ReturnType<typeof createClient>)
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  error = vi.spyOn(console, 'error').mockImplementation(() => {})
  resetJobsTotalSourceWarning()
})

afterEach(() => {
  resetCacheGuard()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

function logLines(): string[] {
  return [...warn.mock.calls, ...error.mock.calls].map(c => c.join(' '))
}

// ── JOBS_TOTAL_SOURCE ───────────────────────────────────────────────────────

describe('jobsTotalSource', () => {
  it('defaults to precount when the variable is not set', () => {
    expect(jobsTotalSource()).toBe('precount')
    expect(logLines()).toEqual([])
  })

  it.each(['precount', 'estimate', 'none'] as const)('accepts %s', (value) => {
    vi.stubEnv('JOBS_TOTAL_SOURCE', value)
    expect(jobsTotalSource()).toBe(value)
  })

  it('treats an unknown value as precount and logs one fixed line, once', () => {
    vi.stubEnv('JOBS_TOTAL_SOURCE', 'exact-please')
    expect(jobsTotalSource()).toBe('precount')
    expect(jobsTotalSource()).toBe('precount')
    expect(logLines()).toEqual([JOBS_TOTAL_LOG.invalidSource])
    expect(logLines().join()).not.toContain('exact-please')
  })
})

// ── The jobs total ──────────────────────────────────────────────────────────

describe('getBrowsableJobsTotal — precount (default)', () => {
  it('returns the exact pre-counted number when the row is fresh, with no count query', async () => {
    script.site_counts = { data: { value: 13254, updated_at: minutesAgo(12) }, error: null }

    expect(await getBrowsableJobsTotal('ab')).toBe(13254)
    expect(tableQueries('site_counts')[0].calls).toEqual([
      ['select', 'value, updated_at'],
      ['eq', 'key', 'jobs_browsable:ab'],
      ['maybeSingle'],
    ])
    expect(tableQueries('jobs')).toHaveLength(0)
    expect(logLines()).toEqual([])
  })

  it('keys the row on the platform', async () => {
    expect(siteCountKey('ab')).toBe('jobs_browsable:ab')
    expect(siteCountKey('et')).toBe('jobs_browsable:et')
    script.site_counts = { data: { value: 812, updated_at: minutesAgo(1) }, error: null }
    expect(await getBrowsableJobsTotal('et')).toBe(812)
    expect(tableQueries('site_counts')[0].calls[1]).toEqual(['eq', 'key', 'jobs_browsable:et'])
  })

  it('caches the row read for two minutes, keyed on the platform', async () => {
    script.site_counts = { data: { value: 1, updated_at: minutesAgo(1) }, error: null }
    await getBrowsableJobsTotal('et')
    const call = cacheCalls.find(c => c.keyParts[0] === 'site-counts-jobs-browsable')
    expect(call?.args).toEqual(['et'])
    expect(call?.options).toEqual({ revalidate: 120, tags: ['counts', 'jobs'] })
  })

  it('still uses a row just under six hours old', async () => {
    script.site_counts = { data: { value: 500, updated_at: new Date(NOW.getTime() - PRECOUNT_MAX_AGE_MS + 1000).toISOString() }, error: null }
    expect(await getBrowsableJobsTotal('ab')).toBe(500)
  })

  it('falls through to the estimate when the row is missing', async () => {
    script.site_counts = { data: null, error: null }
    script.jobs = { count: 13000, error: null }

    expect(await getBrowsableJobsTotal('ab')).toBe(13000)
    expect(logLines()).toEqual([JOBS_TOTAL_LOG.precountMissing])
  })

  it('falls through to the estimate when the row is older than six hours', async () => {
    script.site_counts = { data: { value: 999, updated_at: new Date(NOW.getTime() - PRECOUNT_MAX_AGE_MS - 1000).toISOString() }, error: null }
    script.jobs = { count: 13000, error: null }

    expect(await getBrowsableJobsTotal('ab')).toBe(13000)
    expect(logLines()).toEqual([JOBS_TOTAL_LOG.precountStale])
  })

  it('falls through to the estimate when the row read fails (for example, table not created yet)', async () => {
    script.site_counts = { data: null, error: { message: 'relation "public.site_counts" does not exist zqx' }, status: 404 }
    script.jobs = { count: 13000, error: null }

    expect(await getBrowsableJobsTotal('ab')).toBe(13000)
    expect(logLines()).toEqual([JOBS_TOTAL_LOG.precountFailed])
    expect(logLines().join()).not.toContain('zqx')
  })

  it('falls through to the estimate when the row has an unexpected shape', async () => {
    script.site_counts = { data: { value: 'lots', updated_at: null }, error: null }
    script.jobs = { count: 13000, error: null }

    expect(await getBrowsableJobsTotal('ab')).toBe(13000)
    expect(logLines()).toEqual([JOBS_TOTAL_LOG.precountFailed])
  })

  it('falls all the way to no total when the row is missing and the estimate fails', async () => {
    script.site_counts = { data: null, error: null }
    script.jobs = { count: null, error: { message: 'timeout zqx' }, status: 504 }

    expect(await getBrowsableJobsTotal('ab')).toBeNull()
    expect(logLines()).toEqual([JOBS_TOTAL_LOG.precountMissing, JOBS_TOTAL_LOG.estimateFailed])
    expect(logLines().join()).not.toContain('zqx')
  })
})

describe('getBrowsableJobsTotal — estimate', () => {
  beforeEach(() => { vi.stubEnv('JOBS_TOTAL_SOURCE', 'estimate') })

  it('skips the pre-counted row and asks for an estimated count with the browsable filter', async () => {
    script.jobs = { count: 13100, error: null }

    expect(await getBrowsableJobsTotal('ab')).toBe(13100)
    expect(tableQueries('site_counts')).toHaveLength(0)
    expect(tableQueries('jobs')[0].calls).toEqual([
      ['select', '*', { count: 'estimated', head: true }],
      ['eq', 'status', 'active'],
      ['contains', 'platform', ['ab']],
      ['or', `expires_at.is.null,expires_at.gt.${NOW.toISOString()}`],
    ])
  })

  it('returns no total when the estimate errors', async () => {
    script.jobs = { count: null, error: { message: '' }, status: 504 }
    expect(await getBrowsableJobsTotal('ab')).toBeNull()
    expect(logLines()).toEqual([JOBS_TOTAL_LOG.estimateFailed])
  })

  it('returns no total when the estimate comes back without a count', async () => {
    script.jobs = { count: null, error: null }
    expect(await getBrowsableJobsTotal('ab')).toBeNull()
  })
})

describe('getBrowsableJobsTotal — none', () => {
  it('returns no total and touches no table', async () => {
    vi.stubEnv('JOBS_TOTAL_SOURCE', 'none')
    expect(await getBrowsableJobsTotal('ab')).toBeNull()
    expect(queries).toHaveLength(0)
    expect(logLines()).toEqual([])
  })
})

describe('getBrowsableJobsCount (footer, home page, jobs hub) keeps its number contract', () => {
  it('returns the pre-counted number', async () => {
    script.site_counts = { data: { value: 13254, updated_at: minutesAgo(3) }, error: null }
    expect(await getBrowsableJobsCount('ab')).toBe(13254)
  })

  it('returns 0, as before, when there is no total', async () => {
    vi.stubEnv('JOBS_TOTAL_SOURCE', 'none')
    expect(await getBrowsableJobsCount('ab')).toBe(0)
  })

  it('never throws, even when every source fails', async () => {
    script.site_counts = { data: null, error: { message: 'x' } }
    script.jobs = { count: null, error: { message: 'y' } }
    await expect(getBrowsableJobsCount('ab')).resolves.toBe(0)
  })
})

// ── The default list order ──────────────────────────────────────────────────

describe('default jobs list (no search words, no chosen sort)', () => {
  it('pins the order: posted date (newest first, undated last), then created, then id, with no boost', () => {
    expect(DEFAULT_LIST_ORDER).toEqual([
      { column: 'published_at', ascending: false, nullsFirst: false },
      { column: 'created_at', ascending: false },
      { column: 'id', ascending: false },
    ])
  })

  it('page 2 is a plain select in that order for rows 25 to 48, never the ranked search', async () => {
    script.jobs = { data: [{ id: 'j25', slug: 'a' }], error: null }

    const rows = await getCachedListingJobs({ platform: 'ab', limit: 24, offset: 24 })

    expect(rows).toEqual([{ id: 'j25', slug: 'a' }])
    expect(rpcCalls).toEqual([])
    const calls = tableQueries('jobs')[0].calls
    expect(calls[0][0]).toBe('select')
    expect(String(calls[0][1])).not.toMatch(/\bdescription\b/)
    expect(calls.slice(1, 4)).toEqual([
      ['eq', 'status', 'active'],
      ['contains', 'platform', ['ab']],
      ['or', `expires_at.is.null,expires_at.gt.${NOW.toISOString()}`],
    ])
    expect(calls.filter(c => c[0] === 'order')).toEqual([
      ['order', 'published_at', { ascending: false, nullsFirst: false }],
      ['order', 'created_at', { ascending: false }],
      ['order', 'id', { ascending: false }],
    ])
    expect(calls[calls.length - 1]).toEqual(['range', 24, 47])
  })

  it('never orders by source_score, quality_score or is_featured', () => {
    const columns: string[] = DEFAULT_LIST_ORDER.map(o => o.column)
    for (const boost of ['source_score', 'quality_score', 'is_featured']) expect(columns).not.toContain(boost)
  })

  it('pages 1, 2 and 3 ask for consecutive, non-overlapping row ranges', async () => {
    script.jobs = { data: [], error: null }
    for (const offset of [0, 24, 48]) await getCachedListingJobs({ platform: 'ab', limit: 24, offset })
    expect(tableQueries('jobs').map(q => q.calls[q.calls.length - 1])).toEqual([
      ['range', 0, 23], ['range', 24, 47], ['range', 48, 71],
    ])
  })

  it('returns the same columns as the ranked search (no description, no salary_is_predicted)', async () => {
    script.jobs = { data: [], error: null }
    await getCachedListingJobs({ platform: 'ab', limit: 24, offset: 0 })
    const columns = String(tableQueries('jobs')[0].calls[0][1]).split(',').map(c => c.trim())
    expect(columns).toEqual([
      'id', 'slug', 'title', 'company_name', 'company_domain', 'excerpt',
      'location_text', 'location_city', 'location_country', 'location_remote',
      'salary_text', 'salary_min', 'salary_max', 'salary_currency',
      'employment_type', 'seniority_level', 'category',
      'qualifications_required', 'skills_required', 'skills_nice_to_have',
      'apply_method', 'application_url', 'application_email',
      'source', 'source_url', 'platform', 'is_featured',
      'published_at', 'created_at', 'expires_at',
    ])
  })

  it('applies every filter exactly as the exact count of the same list does', async () => {
    const filters = {
      platform: 'ab',
      location: 'London',
      locationCountry: 'United Kingdom',
      employmentTypes: ['permanent' as const],
      seniorityLevels: ['senior' as const],
      remoteOnly: true,
      salaryMin: 30000,
      salaryMax: 90000,
      postedWithin: 7,
      qualifications: ['ACCA'],
      sources: ['adzuna' as const],
    }
    script.jobs = { data: [], count: 0, error: null }

    await getCachedListingJobs({ ...filters, limit: 24, offset: 0 })
    await getCachedListingJobsCount(filters)

    const [list, count] = tableQueries('jobs').map(q => q.calls)
    const filterCalls = (calls: Array<[string, ...unknown[]]>) =>
      calls.filter(c => !['select', 'order', 'range'].includes(c[0])).map(c => JSON.stringify(c)).sort()
    expect(filterCalls(list)).toEqual(filterCalls(count))
    expect(rpcCalls).toEqual([])
  })

  it('throws (never caches) a database error', async () => {
    script.jobs = { data: null, error: { message: 'timeout' } }
    await expect(getCachedListingJobs({ platform: 'ab', limit: 24, offset: 24 })).rejects.toThrow('default jobs list query failed')
  })
})

describe('searches with words and chosen sorts keep the ranked search unchanged', () => {
  it('a search with words and no chosen sort ranks by relevance', async () => {
    await getCachedListingJobs({ platform: 'ab', search: 'tax', limit: 24, offset: 24 })
    expect(rpcCalls).toHaveLength(1)
    expect(rpcCalls[0][0]).toBe('search_jobs_ranked')
    expect(rpcCalls[0][1]).toMatchObject({ p_search: 'tax', p_sort_by: 'relevance', p_limit: 24, p_offset: 24 })
    expect(tableQueries('jobs')).toHaveLength(0)
  })

  it.each(['recent', 'salary_high', 'salary_low'] as const)('a chosen %s sort with no words uses the ranked search', async (sortBy) => {
    await getCachedListingJobs({ platform: 'ab', sortBy, limit: 24, offset: 0 })
    expect(rpcCalls[0][1]).toMatchObject({ p_search: null, p_sort_by: sortBy })
  })

  it('an explicitly chosen Most relevant with no words still uses the ranked search', async () => {
    await getCachedListingJobs({ platform: 'ab', sortBy: 'relevance', limit: 24, offset: 0 })
    expect(rpcCalls[0][1]).toMatchObject({ p_search: null, p_sort_by: 'relevance' })
    expect(tableQueries('jobs')).toHaveLength(0)
  })

  it('...and falls back to the default order, with one fixed log line, when the ranked search fails', async () => {
    script.rpc = { data: null, error: { message: 'canceling statement due to statement timeout zqx' } }
    script.jobs = { data: [{ id: 'fallback' }], error: null }

    expect(await getCachedListingJobs({ platform: 'ab', sortBy: 'relevance', limit: 24, offset: 24 })).toEqual([{ id: 'fallback' }])
    expect(logLines()).toEqual([RELEVANCE_FALLBACK_LOG])
    expect(tableQueries('jobs')[0].calls.at(-1)).toEqual(['range', 24, 47])
  })

  it('a failed search with words is not replaced by the default order', async () => {
    script.rpc = { data: null, error: { message: 'timeout' } }
    await expect(getCachedListingJobs({ platform: 'ab', search: 'tax', limit: 24, offset: 0 })).rejects.toThrow('search_jobs_ranked failed')
    expect(tableQueries('jobs')).toHaveLength(0)
  })
})

describe('listing cache keys for the new default', () => {
  it('no words and no chosen sort is the default order', () => {
    expect(normaliseListingPage({ platform: 'ab' }).sortBy).toBe('default')
  })

  it('words and no chosen sort stay on relevance, the same key as an explicit relevance', () => {
    expect(normaliseListingPage({ platform: 'ab', search: 'tax' }).sortBy).toBe('relevance')
    expect(JSON.stringify(normaliseListingPage({ platform: 'ab', search: 'tax' })))
      .toBe(JSON.stringify(normaliseListingPage({ platform: 'ab', search: 'tax', sortBy: 'relevance' })))
  })

  it('an explicit Most relevant with no words is a different entry from the default', () => {
    expect(JSON.stringify(normaliseListingPage({ platform: 'ab', sortBy: 'relevance' })))
      .not.toBe(JSON.stringify(normaliseListingPage({ platform: 'ab' })))
  })
})

describe('isUnfilteredListing', () => {
  it('is true for the plain list, including "no filter" spellings', () => {
    expect(isUnfilteredListing({ platform: 'ab' })).toBe(true)
    expect(isUnfilteredListing({ platform: 'et', search: '  ', locationCountry: 'all', employmentTypes: [], remoteOnly: false, sortBy: 'salary_high' })).toBe(true)
  })

  it.each([
    { search: 'tax' }, { location: 'leeds' }, { locationCountry: 'Ethiopia' },
    { employmentTypes: ['contract' as const] }, { seniorityLevels: ['mid' as const] }, { remoteOnly: true },
    { salaryMin: 1 }, { salaryMax: 1 }, { postedWithin: 1 }, { qualifications: ['acca'] }, { sources: ['employer' as const] },
  ])('is false with %j', (filter) => {
    expect(isUnfilteredListing({ platform: 'ab', ...filter })).toBe(false)
  })
})

// Speed job part 2: the database function is rewritten for speed with the
// same name, inputs and output, so the app's call must stay exactly this.
describe('word search keeps calling the ranked search with the same inputs', () => {
  it('sends every input, by name, exactly as before', async () => {
    script.rpc = { data: [{ id: 'c1', slug: 'cfo', title: 'CFO', description: 'long' }], error: null }

    const rows = await getCachedListingJobs({ platform: 'ab', search: '  CFO ', limit: 24, offset: 48 })

    expect(rpcCalls).toEqual([['search_jobs_ranked', {
      p_platform: 'ab',
      p_search: 'cfo',
      p_location: null,
      p_location_country: null,
      p_employment_types: null,
      p_seniority_levels: null,
      p_remote_only: null,
      p_salary_min: null,
      p_salary_max: null,
      p_posted_within_days: null,
      p_qualifications: null,
      p_sources: null,
      p_sort_by: 'relevance',
      p_limit: 24,
      p_offset: 48,
    }]])
    // Rows come back in the function's own order, without description.
    expect(rows).toEqual([{ id: 'c1', slug: 'cfo', title: 'CFO' }])
  })

  it('keeps the function\'s row order as given', async () => {
    const order = ['c3', 'c1', 'c2']
    script.rpc = { data: order.map(id => ({ id })), error: null }
    const rows = await getCachedListingJobs({ platform: 'et', search: 'tax manager', limit: 24, offset: 0 })
    expect(rows.map(r => r.id)).toEqual(order)
  })
})

// ── The country menu reads the pre-counted country rows ─────────────────────

const row = (key: string, value: number, updatedAt = NOW.getTime() - 4 * 60_000) => ({ key, value, updatedAt })
const dbRow = (key: string, value: number | string, m = 4) => ({ key, value, updated_at: minutesAgo(m) })

// Live rows as read on 13 Nov (same numbers as get_active_job_countries
// returned on 11 Nov), plus the plain-list rows that share the prefix.
const LIVE_ROWS = [
  dbRow('jobs_browsable:ab', 14351),
  dbRow('jobs_browsable:ab:country:Australia', 1380),
  dbRow('jobs_browsable:ab:country:Canada', 1364),
  dbRow('jobs_browsable:ab:country:Ireland', 2),
  dbRow('jobs_browsable:ab:country:Singapore', 1579),
  dbRow('jobs_browsable:ab:country:South Africa', 3089),
  dbRow('jobs_browsable:ab:country:United Arab Emirates', 1),
  dbRow('jobs_browsable:ab:country:United Kingdom', 1979),
  dbRow('jobs_browsable:ab:country:United States', 2957),
  dbRow('jobs_browsable:et', 3089),
  dbRow('jobs_browsable:et:country:South Africa', 3089),
]

describe('countryListFromPrecounts', () => {
  const now = NOW.getTime()

  it('keeps only this platform\'s country rows, takes the whole name after the prefix, and skips counts that are not whole numbers above zero', () => {
    const rows = [
      row('jobs_browsable:ab', 9000),
      row('jobs_browsable:ab:country:United Kingdom', 40),
      row('jobs_browsable:ab:country:Korea, Republic of', 7),
      row("jobs_browsable:ab:country:Côte d'Ivoire", 5),
      row('jobs_browsable:ab:country:Bosnia: Herzegovina', 4),
      row('jobs_browsable:ab:search:cfo', 140),
      row('jobs_browsable:ab:countryX', 99),
      row('jobs_browsable:ab:country:', 98),
      row('jobs_browsable:et:country:Ethiopia', 97),
      row('xjobs_browsable:ab:country:Kenya', 96),
      row('jobs_browsable:ab:country:Zero', 0),
      row('jobs_browsable:ab:country:Negative', -3),
      row('jobs_browsable:ab:country:Fraction', 2.5),
      row('jobs_browsable:ab:country:NotANumber', NaN),
    ]
    expect(countryListFromPrecounts(rows, 'ab', now)).toEqual([
      { country: 'United Kingdom', count: 40 },
      { country: 'Korea, Republic of', count: 7 },
      { country: "Côte d'Ivoire", count: 5 },
      { country: 'Bosnia: Herzegovina', count: 4 },
    ])
  })

  it('orders by count descending, then name ascending for equal counts (as the SQL ORDER BY job_count DESC, country ASC)', () => {
    const rows = [
      row('jobs_browsable:ab:country:Canada', 10),
      row('jobs_browsable:ab:country:Zambia', 50),
      row('jobs_browsable:ab:country:Australia', 10),
      row('jobs_browsable:ab:country:Belgium', 10),
      row('jobs_browsable:ab:country:Mexico', 1),
    ]
    expect(countryListFromPrecounts(rows, 'ab', now).map(c => c.country)).toEqual(['Zambia', 'Australia', 'Belgium', 'Canada', 'Mexico'])
  })

  it('applies the 6-hour rule of getPrecountedFilterTotal to each row', () => {
    const rows = [
      row('jobs_browsable:ab:country:Fresh', 3, now - PRECOUNT_MAX_AGE_MS),
      row('jobs_browsable:ab:country:Stale', 9, now - PRECOUNT_MAX_AGE_MS - 1),
    ]
    expect(countryListFromPrecounts(rows, 'ab', now)).toEqual([{ country: 'Fresh', count: 3 }])
  })

  it('gives the 11 Nov list for ab and et from the live rows', () => {
    const rows = LIVE_ROWS.map(r => row(r.key, r.value as number))
    expect(countryListFromPrecounts(rows, 'ab', now)).toEqual([
      { country: 'South Africa', count: 3089 },
      { country: 'United States', count: 2957 },
      { country: 'United Kingdom', count: 1979 },
      { country: 'Singapore', count: 1579 },
      { country: 'Australia', count: 1380 },
      { country: 'Canada', count: 1364 },
      { country: 'Ireland', count: 2 },
      { country: 'United Arab Emirates', count: 1 },
    ])
    expect(countryListFromPrecounts(rows, 'et', now)).toEqual([{ country: 'South Africa', count: 3089 }])
  })
})

describe('getCachedActiveJobCountries — from the pre-counted rows', () => {
  it('ab: one read of the filter rows, the 11 Nov list, no database function call, no log', async () => {
    script.site_counts = { data: LIVE_ROWS, error: null }
    const list = await getCachedActiveJobCountries('ab')
    expect(list.map(c => `${c.country} ${c.count}`)).toEqual([
      'South Africa 3089', 'United States 2957', 'United Kingdom 1979', 'Singapore 1579',
      'Australia 1380', 'Canada 1364', 'Ireland 2', 'United Arab Emirates 1',
    ])
    expect(tableQueries('site_counts')).toHaveLength(1)
    expect(tableQueries('site_counts')[0].calls).toEqual([
      ['select', 'key, value, updated_at'],
      ['like', 'key', 'jobs_browsable:ab:%'],
    ])
    expect(rpcCalls).toEqual([])
    expect(tableQueries('jobs')).toHaveLength(0)
    expect(logLines()).toEqual([])
  })

  it('et: reads the et rows and gets only South Africa', async () => {
    script.site_counts = { data: LIVE_ROWS, error: null }
    expect(await getCachedActiveJobCountries('et')).toEqual([{ country: 'South Africa', count: 3089 }])
    expect(tableQueries('site_counts')[0].calls[1]).toEqual(['like', 'key', 'jobs_browsable:et:%'])
    expect(rpcCalls).toEqual([])
  })

  it('shares the cached read with the one-country total: one query for both', async () => {
    script.site_counts = { data: LIVE_ROWS, error: null }
    expect(await getPrecountedFilterTotal({ platform: 'ab', locationCountry: 'United States' })).toBe(2957)
    expect(await getCachedActiveJobCountries('ab')).toHaveLength(8)
    expect(tableQueries('site_counts')).toHaveLength(1)
    expect(new Set(cacheCalls.map(c => c.keyParts[0]))).toEqual(new Set(['site-counts-jobs-filters']))
  })

  it('gives [] (the built-in list) with one fixed line when every country row is older than six hours', async () => {
    script.site_counts = { data: [dbRow('jobs_browsable:ab', 14351, 3), dbRow('jobs_browsable:ab:country:United States', 2957, 6 * 60 + 1)], error: null }
    expect(await getCachedActiveJobCountries('ab')).toEqual([])
    expect(logLines()).toEqual([COUNTRY_LIST_LOG.stale])
    expect(rpcCalls).toEqual([])
  })

  it('gives [] (the built-in list) with one fixed line when there are no country rows', async () => {
    script.site_counts = { data: [dbRow('jobs_browsable:ab', 14351), dbRow('jobs_browsable:et:country:South Africa', 3089)], error: null }
    expect(await getCachedActiveJobCountries('ab')).toEqual([])
    expect(logLines()).toEqual([COUNTRY_LIST_LOG.missing])
    expect(rpcCalls).toEqual([])
  })

  it('gives [] (the built-in list) with one fixed line, no upstream text, when the read fails', async () => {
    script.site_counts = { data: null, error: { message: 'canceling statement due to statement timeout zqx' }, status: 500 }
    expect(await getCachedActiveJobCountries('ab')).toEqual([])
    expect(logLines()).toEqual([COUNTRY_LIST_LOG.failed])
    expect(logLines().join()).not.toContain('zqx')
    expect(rpcCalls).toEqual([])
  })

  it('gives [] (the built-in list) when any row has an unexpected shape (the shared reader rejects the whole read)', async () => {
    script.site_counts = { data: [...LIVE_ROWS, dbRow('jobs_browsable:ab:country:Bad', -1)], error: null }
    expect(await getCachedActiveJobCountries('ab')).toEqual([])
    expect(logLines()).toEqual([COUNTRY_LIST_LOG.failed])
  })

  it.each(['estimate', 'none'] as const)('%s mode: the menu still reads the rows (the switch is about totals only)', async (mode) => {
    vi.stubEnv('JOBS_TOTAL_SOURCE', mode)
    script.site_counts = { data: LIVE_ROWS, error: null }
    expect(await getCachedActiveJobCountries('et')).toEqual([{ country: 'South Africa', count: 3089 }])
  })
})

describe('the app no longer calls get_active_job_countries', () => {
  const ROOT = process.cwd()
  const SOURCE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/
  const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') return []
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return files(path)
    return SOURCE.test(entry.name) ? [relative(ROOT, path).split(sep).join('/')] : []
  })

  it('no file under app/ or lib/ calls rpc() with that function name', () => {
    const all = [...files(join(ROOT, 'app')), ...files(join(ROOT, 'lib'))]
    expect(all.length).toBeGreaterThan(100)
    const calls = all.filter(f => /\brpc\s*\(\s*['"`]get_active_job_countries['"`]/.test(readFileSync(join(ROOT, f), 'utf8')))
    expect(calls).toEqual([])
  })
})

// ── Speed job part 3: pre-counted one-country totals ────────────────────────

// The Popular buttons exactly as written in the hero component.
function popularButtons(): string[] {
  const source = readFileSync(join(process.cwd(), 'app', 'jobs', 'listings', 'JobSearchHero.tsx'), 'utf8')
  const list = source.match(/const POPULAR = \[([\s\S]*?)\]/)
  if (!list) throw new Error('POPULAR list not found')
  return Array.from(list[1].matchAll(/'([^']*)'/g), m => m[1])
}

describe('Popular searches always count live (no pre-counted search rows)', () => {
  it('a pill search never reads site_counts, on either platform, with or without a sort', async () => {
    const buttons = popularButtons()
    expect(buttons.length).toBeGreaterThan(0)
    // Even if old search rows were still stored, nothing may read them.
    script.site_counts = { data: [{ key: 'jobs_browsable:ab:search:cfo', value: 140, updated_at: minutesAgo(1) }], error: null }
    for (const search of buttons) {
      for (const platform of ['ab', 'et']) {
        for (const sortBy of [undefined, 'recent'] as const) {
          expect(filterPrecountKey({ platform, search, sortBy })).toBeNull()
          expect(await getPrecountedFilterTotal({ platform, search, sortBy })).toBeNull()
        }
      }
      // The button text still reaches the word count unchanged apart from
      // trimming and lowercasing.
      expect(normaliseListingFilters({ platform: 'ab', search }).search).toBe(search.trim().toLowerCase())
    }
    expect(tableQueries('site_counts')).toHaveLength(0)
    expect(queries).toHaveLength(0)
    expect(logLines()).toEqual([])
  })
})

describe('filterPrecountKey', () => {
  it('one country and nothing else: the country row, name exactly as given after trimming', () => {
    expect(filterPrecountKey({ platform: 'ab', locationCountry: 'United Kingdom' })).toBe('jobs_browsable:ab:country:United Kingdom')
    expect(filterPrecountKey({ platform: 'et', locationCountry: '  Ethiopia ' })).toBe('jobs_browsable:et:country:Ethiopia')
    // Case is kept: the country filter is an exact match.
    expect(filterPrecountKey({ platform: 'ab', locationCountry: 'united kingdom' })).toBe('jobs_browsable:ab:country:united kingdom')
  })

  it.each(['relevance', 'recent', 'salary_high', 'salary_low', undefined] as const)('any sort (%s) keeps the same row', (sortBy) => {
    expect(filterPrecountKey({ platform: 'ab', locationCountry: 'United States', sortBy })).toBe('jobs_browsable:ab:country:United States')
  })

  it('search words of any kind have no row', () => {
    for (const search of ['CFO', 'cfo', 'tax manager', 'FP&A Analyst', 'tax', 'cfo uk', '"tax manager"']) {
      expect(filterPrecountKey({ platform: 'ab', search })).toBeNull()
      expect(filterPrecountKey({ platform: 'et', search })).toBeNull()
    }
  })

  it('the plain list has no filter row (it keeps its own row)', () => {
    expect(filterPrecountKey({ platform: 'ab' })).toBeNull()
    expect(filterPrecountKey({ platform: 'ab', locationCountry: 'all', search: '  ' })).toBeNull()
  })

  it('a country with search words has no row', () => {
    expect(filterPrecountKey({ platform: 'ab', locationCountry: 'United Kingdom', search: 'cfo' })).toBeNull()
    expect(filterPrecountKey({ platform: 'ab', locationCountry: 'United Kingdom', search: 'accountant' })).toBeNull()
  })

  it.each([
    ['location', { location: 'London' }],
    ['employment types', { employmentTypes: ['permanent' as const] }],
    ['seniority', { seniorityLevels: ['senior' as const] }],
    ['remote only', { remoteOnly: true }],
    ['minimum salary', { salaryMin: 30000 }],
    ['maximum salary', { salaryMax: 90000 }],
    ['posted within', { postedWithin: 7 }],
    ['qualifications', { qualifications: ['ACCA'] }],
    ['sources', { sources: ['employer' as const] }],
  ])('any other filter (%s) has no row', (_name, extra) => {
    expect(filterPrecountKey({ platform: 'ab', locationCountry: 'United Kingdom', ...extra })).toBeNull()
    expect(filterPrecountKey({ platform: 'ab', search: 'CFO', ...extra })).toBeNull()
  })
})

describe('getPrecountedFilterTotal — precount (default)', () => {
  it('returns the fresh country row, from one read of the platform\'s filter rows, with no count query', async () => {
    script.site_counts = {
      data: [
        { key: 'jobs_browsable:ab:country:United Kingdom', value: 6123, updated_at: minutesAgo(4) },
        { key: 'jobs_browsable:ab:country:United States', value: 2210, updated_at: minutesAgo(4) },
        { key: 'jobs_browsable:ab:search:cfo', value: 140, updated_at: minutesAgo(4) },
      ],
      error: null,
    }

    expect(await getPrecountedFilterTotal({ platform: 'ab', locationCountry: 'United States' })).toBe(2210)
    expect(tableQueries('site_counts')).toHaveLength(1)
    expect(tableQueries('site_counts')[0].calls).toEqual([
      ['select', 'key, value, updated_at'],
      ['like', 'key', 'jobs_browsable:ab:%'],
    ])
    expect(tableQueries('jobs')).toHaveLength(0)
    expect(logLines()).toEqual([])
  })

  it('returns the fresh et country row with a chosen sort, and reads the et rows for et', async () => {
    script.site_counts = { data: [{ key: 'jobs_browsable:et:country:Ethiopia', value: 12, updated_at: minutesAgo(1) }], error: null }

    expect(await getPrecountedFilterTotal({ platform: 'et', locationCountry: 'Ethiopia', sortBy: 'recent' })).toBe(12)
    expect(tableQueries('site_counts')[0].calls[1]).toEqual(['like', 'key', 'jobs_browsable:et:%'])
  })

  it('accepts a count sent as text', async () => {
    script.site_counts = { data: [{ key: 'jobs_browsable:ab:country:Singapore', value: '57', updated_at: minutesAgo(1) }], error: null }
    expect(await getPrecountedFilterTotal({ platform: 'ab', locationCountry: 'Singapore' })).toBe(57)
  })

  it('caches the read for two minutes, keyed on the platform', async () => {
    script.site_counts = { data: [], error: null }
    await getPrecountedFilterTotal({ platform: 'ab', locationCountry: 'Ethiopia' })
    const call = cacheCalls.find(c => c.keyParts[0] === 'site-counts-jobs-filters')
    expect(call).toEqual({ keyParts: ['site-counts-jobs-filters'], options: { revalidate: 120, tags: ['counts', 'jobs'] }, args: ['ab'] })
  })

  it('ignores a row whose key only looks like the prefix (LIKE treats "_" as any character)', async () => {
    script.site_counts = { data: [{ key: 'jobsXbrowsable:ab:country:Ethiopia', value: 5, updated_at: minutesAgo(1) }], error: null }
    expect(await getPrecountedFilterTotal({ platform: 'ab', locationCountry: 'Ethiopia' })).toBeNull()
    expect(logLines()).toEqual([FILTER_TOTAL_LOG.missing])
  })

  it('still uses a row just under six hours old', async () => {
    script.site_counts = { data: [{ key: 'jobs_browsable:ab:country:Australia', value: 9, updated_at: new Date(NOW.getTime() - PRECOUNT_MAX_AGE_MS + 1000).toISOString() }], error: null }
    expect(await getPrecountedFilterTotal({ platform: 'ab', locationCountry: 'Australia' })).toBe(9)
  })

  it('gives null (count live) with one fixed line when the row is missing', async () => {
    script.site_counts = { data: [{ key: 'jobs_browsable:ab:country:United Kingdom', value: 6123, updated_at: minutesAgo(4) }], error: null }
    expect(await getPrecountedFilterTotal({ platform: 'ab', locationCountry: 'Ethiopia' })).toBeNull()
    expect(logLines()).toEqual([FILTER_TOTAL_LOG.missing])
    expect(logLines().join()).not.toContain('Ethiopia')
  })

  it('gives null (count live) with one fixed line when the row is older than six hours', async () => {
    script.site_counts = { data: [{ key: 'jobs_browsable:ab:country:Ethiopia', value: 3, updated_at: new Date(NOW.getTime() - PRECOUNT_MAX_AGE_MS - 1000).toISOString() }], error: null }
    expect(await getPrecountedFilterTotal({ platform: 'ab', locationCountry: 'Ethiopia' })).toBeNull()
    expect(logLines()).toEqual([FILTER_TOTAL_LOG.stale])
  })

  it('gives null (count live) with one fixed line when the read fails, with no upstream text', async () => {
    script.site_counts = { data: null, error: { message: 'relation "public.site_counts" does not exist zqx' }, status: 404 }
    expect(await getPrecountedFilterTotal({ platform: 'ab', locationCountry: 'United Kingdom' })).toBeNull()
    expect(logLines()).toEqual([FILTER_TOTAL_LOG.failed])
    expect(logLines().join()).not.toContain('zqx')
  })

  it('gives null (count live) when a row has an unexpected shape', async () => {
    script.site_counts = { data: [{ key: 'jobs_browsable:ab:country:United Kingdom', value: 'lots', updated_at: null }], error: null }
    expect(await getPrecountedFilterTotal({ platform: 'ab', locationCountry: 'United Kingdom' })).toBeNull()
    expect(logLines()).toEqual([FILTER_TOTAL_LOG.failed])
  })

  it('reads nothing and gives null for any request without a filter row', async () => {
    for (const params of [
      { platform: 'ab' },
      { platform: 'ab', search: 'tax' },
      { platform: 'ab', locationCountry: 'United Kingdom', remoteOnly: true },
      { platform: 'ab', search: 'CFO', locationCountry: 'United Kingdom' },
    ]) {
      expect(await getPrecountedFilterTotal(params)).toBeNull()
    }
    expect(queries).toHaveLength(0)
    expect(logLines()).toEqual([])
  })
})

describe('getPrecountedFilterTotal — estimate and none modes are unaffected', () => {
  it.each(['estimate', 'none'] as const)('%s: gives null and reads nothing, so filtered lists count live as before', async (mode) => {
    vi.stubEnv('JOBS_TOTAL_SOURCE', mode)
    script.site_counts = { data: [{ key: 'jobs_browsable:ab:country:United Kingdom', value: 140, updated_at: minutesAgo(1) }], error: null }

    expect(await getPrecountedFilterTotal({ platform: 'ab', locationCountry: 'United Kingdom' })).toBeNull()
    expect(queries).toHaveLength(0)
  })

  it('the plain list still reads only its own row', async () => {
    script.site_counts = { data: { value: 13254, updated_at: minutesAgo(3) }, error: null }
    expect(await getBrowsableJobsTotal('ab')).toBe(13254)
    expect(tableQueries('site_counts')).toHaveLength(1)
    expect(tableQueries('site_counts')[0].calls[1]).toEqual(['eq', 'key', 'jobs_browsable:ab'])
  })
})
