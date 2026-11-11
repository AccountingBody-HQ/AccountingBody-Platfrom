import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  getBrowsableJobsTotal, getBrowsableJobsCount, getCachedListingJobs,
  getCachedListingJobsCount, getActiveJobCountries, jobsTotalSource, resetJobsTotalSourceWarning,
  normaliseListingPage, normaliseListingFilters, isUnfilteredListing, siteCountKey,
  filterPrecountKey, getPrecountedFilterTotal, PRECOUNTED_SEARCHES, FILTER_TOTAL_LOG,
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

describe('countries list calls get_active_job_countries as the SQL defines it', () => {
  it('passes p_platform and reads country and job_count', async () => {
    script.rpc = { data: [{ country: 'United Kingdom', job_count: 12 }, { country: 'Ethiopia', job_count: 3 }], error: null }

    expect(await getActiveJobCountries('et')).toEqual([
      { country: 'United Kingdom', count: 12 },
      { country: 'Ethiopia', count: 3 },
    ])
    expect(rpcCalls).toEqual([['get_active_job_countries', { p_platform: 'et' }]])
  })

  it('returns [] (the page then uses its built-in list) while the function is missing', async () => {
    script.rpc = { data: null, error: { message: 'Could not find the function public.get_active_job_countries(p_platform) in the schema cache' }, status: 404 }
    expect(await getActiveJobCountries('ab')).toEqual([])
  })
})

// ── Speed job part 3: pre-counted one-country and Popular-search totals ─────

// The Popular buttons exactly as written in the hero component.
function popularButtons(): string[] {
  const source = readFileSync(join(process.cwd(), 'app', 'jobs', 'listings', 'JobSearchHero.tsx'), 'utf8')
  const list = source.match(/const POPULAR = \[([\s\S]*?)\]/)
  if (!list) throw new Error('POPULAR list not found')
  return Array.from(list[1].matchAll(/'([^']*)'/g), m => m[1])
}

describe('the pre-counted searches are the Popular buttons, as the word count receives them', () => {
  it('has six buttons', () => {
    expect(popularButtons()).toEqual([
      'Management Accountant', 'Tax Manager', 'Financial Controller',
      'Audit Senior', 'FP&A Analyst', 'CFO',
    ])
  })

  it('normalises each button to exactly one pre-counted string, "&" kept', () => {
    const normalised = popularButtons().map(term => normaliseListingFilters({ platform: 'ab', search: term }).search)
    expect(normalised).toEqual([...PRECOUNTED_SEARCHES])
    expect(PRECOUNTED_SEARCHES).toEqual([
      'management accountant', 'tax manager', 'financial controller',
      'audit senior', 'fp&a analyst', 'cfo',
    ])
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
    expect(filterPrecountKey({ platform: 'ab', search: 'CFO', sortBy })).toBe('jobs_browsable:ab:search:cfo')
  })

  it.each([
    ['Management Accountant', 'management accountant'],
    ['Tax Manager', 'tax manager'],
    ['Financial Controller', 'financial controller'],
    ['Audit Senior', 'audit senior'],
    ['FP&A Analyst', 'fp&a analyst'],
    ['CFO', 'cfo'],
  ])('the Popular search %s uses the row for "%s"', (button, words) => {
    expect(filterPrecountKey({ platform: 'ab', search: button })).toBe(`jobs_browsable:ab:search:${words}`)
    expect(filterPrecountKey({ platform: 'et', search: ` ${button.toLowerCase()} ` })).toBe(`jobs_browsable:et:search:${words}`)
  })

  it('other words, phrases or spellings have no row', () => {
    for (const search of ['tax', 'cfo uk', '"tax manager"', 'tax  manager', 'FP and A Analyst', 'fpa analyst']) {
      expect(filterPrecountKey({ platform: 'ab', search })).toBeNull()
    }
  })

  it('the plain list has no filter row (it keeps its own row)', () => {
    expect(filterPrecountKey({ platform: 'ab' })).toBeNull()
    expect(filterPrecountKey({ platform: 'ab', locationCountry: 'all', search: '  ' })).toBeNull()
  })

  it('a country with words, or a Popular search with a country, has no row', () => {
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

  it('returns the fresh Popular-search row, and reads the et rows for et', async () => {
    script.site_counts = { data: [{ key: 'jobs_browsable:et:search:fp&a analyst', value: 12, updated_at: minutesAgo(1) }], error: null }

    expect(await getPrecountedFilterTotal({ platform: 'et', search: 'FP&A Analyst', sortBy: 'recent' })).toBe(12)
    expect(tableQueries('site_counts')[0].calls[1]).toEqual(['like', 'key', 'jobs_browsable:et:%'])
  })

  it('accepts a count sent as text', async () => {
    script.site_counts = { data: [{ key: 'jobs_browsable:ab:search:cfo', value: '57', updated_at: minutesAgo(1) }], error: null }
    expect(await getPrecountedFilterTotal({ platform: 'ab', search: 'cfo' })).toBe(57)
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
    script.site_counts = { data: [{ key: 'jobs_browsable:ab:search:cfo', value: 9, updated_at: new Date(NOW.getTime() - PRECOUNT_MAX_AGE_MS + 1000).toISOString() }], error: null }
    expect(await getPrecountedFilterTotal({ platform: 'ab', search: 'CFO' })).toBe(9)
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
    expect(await getPrecountedFilterTotal({ platform: 'ab', search: 'tax manager' })).toBeNull()
    expect(logLines()).toEqual([FILTER_TOTAL_LOG.failed])
    expect(logLines().join()).not.toContain('zqx')
  })

  it('gives null (count live) when a row has an unexpected shape', async () => {
    script.site_counts = { data: [{ key: 'jobs_browsable:ab:search:cfo', value: 'lots', updated_at: null }], error: null }
    expect(await getPrecountedFilterTotal({ platform: 'ab', search: 'cfo' })).toBeNull()
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
    script.site_counts = { data: [{ key: 'jobs_browsable:ab:search:cfo', value: 140, updated_at: minutesAgo(1) }], error: null }

    expect(await getPrecountedFilterTotal({ platform: 'ab', search: 'CFO' })).toBeNull()
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
