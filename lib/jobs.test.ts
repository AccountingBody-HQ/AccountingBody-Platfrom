import { describe, it, expect, vi, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import {
  getActiveDirectJobs, getCachedListingJobs, getCachedListingJobsCount,
  normaliseListingFilters, normaliseListingPage,
  getJobSitemapEntries, getJobSitemapChunk, getSimilarJobs, buildSimilarQuery,
  similarTitleTokens, SIMILAR_JOB_COLUMNS,
} from './jobs'

const PAGE_SIZE = 1000

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

// react's stable channel (what plain vitest resolves 'react' to, outside
// Next's own build pipeline) doesn't export cache() at all — only Next's
// bundled/canary React does. lib/jobs.ts:1 imports { cache } from 'react'
// for an unrelated export (getCachedBrowsableJobsCount) that this test
// doesn't touch, but the module-level import still runs on load and
// throws without this. Identity function is correct for a test: cache()
// only memoizes, it doesn't change behavior.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))

// unstable_cache needs Next's incremental cache, which only exists inside a
// real Next server. Identity is enough here: these tests cover the cache
// keys (via the normalisers, whose JSON is exactly what unstable_cache
// keys on) and what the wrappers return or throw. That a thrown result is
// never stored is Next's own behaviour (unstable-cache.js; see
// tmp-audit/jobs-perf-option1-cache.md).
// Records every cached call (key parts, options, arguments) and then just
// runs the function, so tests can assert on exactly what unstable_cache
// would key on: keyParts plus JSON.stringify(args).
const cacheCalls = vi.hoisted(() => [] as Array<{ keyParts: string[]; options: unknown; args: unknown[] }>)
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown, keyParts: string[], options: unknown) =>
    (...args: unknown[]) => {
      cacheCalls.push({ keyParts, options, args })
      return fn(...args)
    },
}))

function makeJobs(n: number, startIndex = 0) {
  // expires_at: null keeps getJobLifecycleState at 'active' for every row,
  // so the archived-filter inside getJobSitemapEntries never drops any of
  // these — the counts below are exact, not "at most."
  return Array.from({ length: n }, (_, i) => ({
    slug: `job-${startIndex + i}`,
    expires_at: null,
    published_at: '2024-01-01T00:00:00.000Z',
    created_at: '2024-01-01T00:00:00.000Z',
  }))
}

// Minimal fake query builder: .from/.select/.in/.contains all return the
// same object so the chain keeps going; .range() is the only call that
// resolves, returning the next scripted page each time it's invoked —
// mirroring how getJobSitemapEntries calls .range() once per loop
// iteration on the same client returned by a single getSupabase() call.
function fakeSupabaseClient(pages: Array<{ data: unknown[] | null; error: unknown }>) {
  const rangeCalls: Array<[number, number]> = []
  let call = 0
  const builder = {
    from: () => builder,
    select: () => builder,
    in: () => builder,
    contains: () => builder,
    order: () => builder,
    range: (from: number, to: number) => {
      rangeCalls.push([from, to])
      const page = pages[call] ?? { data: [], error: null }
      call += 1
      return Promise.resolve(page)
    },
  }
  return { client: builder, rangeCalls }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('getJobSitemapEntries — internal pagination', () => {
  it('concatenates a full page followed by a partial page, and stops after the partial one', async () => {
    const { client, rangeCalls } = fakeSupabaseClient([
      { data: makeJobs(PAGE_SIZE, 0), error: null },
      { data: makeJobs(300, PAGE_SIZE), error: null },
    ])
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    const result = await getJobSitemapEntries('ab')

    expect(result).toHaveLength(PAGE_SIZE + 300)
    expect(rangeCalls).toHaveLength(2)
    expect(rangeCalls[0]).toEqual([0, PAGE_SIZE - 1])
    expect(rangeCalls[1]).toEqual([PAGE_SIZE, PAGE_SIZE * 2 - 1])
  })

  it('does not fetch a second page when the first page is already short', async () => {
    const { client, rangeCalls } = fakeSupabaseClient([
      { data: makeJobs(5, 0), error: null },
    ])
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    const result = await getJobSitemapEntries('ab')

    expect(result).toHaveLength(5)
    expect(rangeCalls).toHaveLength(1)
  })

  it('returns [] rather than a partial list when a later page errors', async () => {
    const { client } = fakeSupabaseClient([
      { data: makeJobs(PAGE_SIZE, 0), error: null },
      { data: null, error: new Error('connection refused') },
    ])
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    const result = await getJobSitemapEntries('ab')

    expect(result).toEqual([])
  })
})

function makeChunkJobs(n: number, startIndex = 0) {
  // Same expires_at: null convention as makeJobs — keeps every row 'active'
  // so the archived-filter never drops any of these test rows.
  return Array.from({ length: n }, (_, i) => ({
    id: `id-${String(startIndex + i).padStart(6, '0')}`,
    slug: `job-${startIndex + i}`,
    expires_at: null,
    published_at: '2024-01-01T00:00:00.000Z',
    created_at: '2024-01-01T00:00:00.000Z',
  }))
}

// Minimal fake query builder for getJobSitemapChunk's keyset shape:
// .gte/.lt/.gt are recorded (not just passed through) so a test can assert
// exactly which bound each page's query carried; .limit() is the call that
// resolves, returning the next scripted page — mirroring how
// getJobSitemapChunk calls .limit() once per loop iteration.
function fakeChunkSupabaseClient(pages: Array<{ data: unknown[] | null; error: unknown }>) {
  const gteCalls: string[] = []
  const ltCalls: string[] = []
  const gtCalls: string[] = []
  let call = 0
  const builder = {
    from: () => builder,
    select: () => builder,
    in: () => builder,
    contains: () => builder,
    gte: (_col: string, val: string) => {
      gteCalls.push(val)
      return builder
    },
    lt: (_col: string, val: string) => {
      ltCalls.push(val)
      return builder
    },
    gt: (_col: string, val: string) => {
      gtCalls.push(val)
      return builder
    },
    order: () => builder,
    limit: () => {
      const page = pages[call] ?? { data: [], error: null }
      call += 1
      return Promise.resolve(page)
    },
  }
  return { client: builder, gteCalls, ltCalls, gtCalls }
}

describe('getJobSitemapChunk — keyset pagination', () => {
  it('continues to a second page using gt(lastId) from the first page', async () => {
    const { client, gtCalls } = fakeChunkSupabaseClient([
      { data: makeChunkJobs(1000, 0), error: null },
      { data: makeChunkJobs(300, 1000), error: null },
    ])
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    const result = await getJobSitemapChunk('ab', 0)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.entries).toHaveLength(1300)
    expect(gtCalls).toEqual(['id-000999'])
  })

  it('stops after a short page without an extra call', async () => {
    const { client, gtCalls } = fakeChunkSupabaseClient([
      { data: makeChunkJobs(5, 0), error: null },
    ])
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    const result = await getJobSitemapChunk('ab', 0)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.entries).toHaveLength(5)
    expect(gtCalls).toHaveLength(0)
  })

  it('the last bucket (63) never calls .lt() — it has no upper bound', async () => {
    const { client, ltCalls } = fakeChunkSupabaseClient([
      { data: makeChunkJobs(5, 0), error: null },
    ])
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    await getJobSitemapChunk('ab', 63)

    expect(ltCalls).toHaveLength(0)
  })

  it('a non-last bucket calls .lt() with its upper bound', async () => {
    const { client, ltCalls } = fakeChunkSupabaseClient([
      { data: makeChunkJobs(5, 0), error: null },
    ])
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    await getJobSitemapChunk('ab', 0)

    expect(ltCalls).toHaveLength(1)
  })

  it('returns ok:false rather than a partial chunk when a later page errors', async () => {
    const { client } = fakeChunkSupabaseClient([
      { data: makeChunkJobs(1000, 0), error: null },
      { data: null, error: new Error('connection refused') },
    ])
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    const result = await getJobSitemapChunk('ab', 0)

    expect(result).toEqual({ ok: false })
  })
})

describe('buildSimilarQuery', () => {
  it('turns a multi-word title into an OR-joined tsquery string', () => {
    expect(buildSimilarQuery('Senior Practice Accountant'))
      .toBe('senior OR practice OR accountant')
  })

  it('strips websearch_to_tsquery operator characters (&, quotes) before joining', () => {
    expect(buildSimilarQuery('Senior Accountant ("Practice & Audit")'))
      .toBe('senior OR accountant OR practice OR audit')
  })

  it('returns null when every token is job-board noise', () => {
    expect(buildSimilarQuery('Remote Full Time UK Job')).toBeNull()
  })

  it('produces a single term with no OR for a single-word title', () => {
    expect(buildSimilarQuery('Bookkeeper')).toBe('bookkeeper')
  })

  it('drops salary figures and single-word country names', () => {
    expect(buildSimilarQuery('Accounts Payable Assistant, London, £28k'))
      .toBe('accounts OR payable OR assistant OR london')
    expect(buildSimilarQuery('Tax Manager Ireland 45,000 - 55,000')).toBe('tax OR manager')
    expect(buildSimilarQuery('Audit Senior 28k-32k')).toBe('audit OR senior')
  })

  it('strips leading and trailing hyphens so no token reads as a websearch NOT', () => {
    expect(buildSimilarQuery('Accountant -Senior- Role')).toBe('accountant OR senior')
    expect(similarTitleTokens('Part-Qualified Accountant')).toEqual(['part-qualified', 'accountant'])
  })
})

// getActiveDirectJobs's count path is a chain that is itself awaited (the
// real query builder is a thenable); its row path is a single .rpc() call.
function fakeDirectJobsClient(opts: {
  count?: { count: number | null; error: unknown }
  rpc?: { data: unknown; error: unknown }
}) {
  const builder = {
    from:       () => builder,
    select:     () => builder,
    eq:         () => builder,
    contains:   () => builder,
    or:         () => builder,
    in:         () => builder,
    textSearch: () => builder,
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(opts.count ?? { count: 0, error: null }).then(resolve, reject),
    rpc: () => Promise.resolve(opts.rpc ?? { data: [], error: null }),
  }
  return builder
}

describe('getActiveDirectJobs — errors are thrown, never returned as empty', () => {
  it('throws when the count query errors', async () => {
    vi.mocked(createClient).mockReturnValue(
      fakeDirectJobsClient({ count: { count: null, error: { message: 'upstream request timeout' } } }) as unknown as ReturnType<typeof createClient>
    )

    await expect(getActiveDirectJobs({ platform: 'ab', countOnly: true })).rejects.toThrow('count query failed')
  })

  it('throws when the ranked search RPC errors', async () => {
    vi.mocked(createClient).mockReturnValue(
      fakeDirectJobsClient({ rpc: { data: null, error: { message: 'canceling statement due to statement timeout' } } }) as unknown as ReturnType<typeof createClient>
    )

    await expect(getActiveDirectJobs({ platform: 'ab' })).rejects.toThrow('search_jobs_ranked failed')
  })

  it('returns 0 and [] for a genuine empty result', async () => {
    vi.mocked(createClient).mockReturnValue(
      fakeDirectJobsClient({ count: { count: 0, error: null }, rpc: { data: [], error: null } }) as unknown as ReturnType<typeof createClient>
    )

    expect(await getActiveDirectJobs({ platform: 'ab', countOnly: true })).toBe(0)
    expect(await getActiveDirectJobs({ platform: 'ab' })).toEqual([])
  })
})

// unstable_cache's key is the wrapper's fixed parts plus
// JSON.stringify(args), so two calls share an entry exactly when these
// strings are equal.
const pageKey = (p: Parameters<typeof normaliseListingPage>[0]) => JSON.stringify(normaliseListingPage(p))
const countKey = (p: Parameters<typeof normaliseListingFilters>[0]) => JSON.stringify(normaliseListingFilters(p))

describe('listings cache keys', () => {
  it('ignores array order, case and surrounding whitespace', () => {
    const a = pageKey({
      platform: 'ab',
      search: '  Senior Accountant ',
      location: 'London',
      employmentTypes: ['permanent', 'contract'],
      seniorityLevels: ['senior', 'mid'],
      qualifications: ['ACCA', 'cima'],
      sortBy: 'recent', limit: 24, offset: 0,
    })
    const b = pageKey({
      platform: 'ab',
      search: 'senior accountant',
      location: '  LONDON',
      employmentTypes: ['contract', 'permanent', 'contract'],
      seniorityLevels: ['mid', 'senior'],
      qualifications: [' cima', 'acca'],
      sortBy: 'recent', limit: 24, offset: 0,
    })
    expect(a).toBe(b)
  })

  it('treats empty strings, empty arrays, "all", remoteOnly=false and undefined identically', () => {
    const bare = pageKey({ platform: 'ab', limit: 24, offset: 0 })
    const empty = pageKey({
      platform: 'ab',
      search: '   ', location: '', locationCountry: 'all',
      employmentTypes: [], seniorityLevels: [], qualifications: [], sources: [],
      remoteOnly: false,
      sortBy: 'relevance', limit: 24, offset: 0,
    })
    expect(empty).toBe(bare)
  })

  it('does not lowercase platform or country, which are exact matches in the query', () => {
    expect(countKey({ platform: 'ab', locationCountry: 'United Kingdom' }))
      .not.toBe(countKey({ platform: 'ab', locationCountry: 'united kingdom' }))
  })

  it('gives a different key for a different platform, sort, offset, limit or any filter', () => {
    const base = { platform: 'ab', sortBy: 'relevance' as const, limit: 24, offset: 0 }
    const baseKey = pageKey(base)
    const variants: Array<Parameters<typeof normaliseListingPage>[0]> = [
      { ...base, platform: 'et' },
      { ...base, sortBy: 'recent' },
      { ...base, offset: 24 },
      { ...base, limit: 48 },
      { ...base, search: 'tax' },
      { ...base, location: 'london' },
      { ...base, locationCountry: 'United Kingdom' },
      { ...base, employmentTypes: ['permanent'] },
      { ...base, seniorityLevels: ['senior'] },
      { ...base, remoteOnly: true },
      { ...base, salaryMin: 30000 },
      { ...base, salaryMax: 90000 },
      { ...base, postedWithin: 7 },
      { ...base, qualifications: ['acca'] },
      { ...base, sources: ['employer'] },
    ]
    const keys = variants.map(pageKey)
    for (const key of keys) expect(key).not.toBe(baseKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('count key ignores sort, limit and offset but not filters or platform', () => {
    const filters = { platform: 'ab', search: 'tax', employmentTypes: ['permanent' as const] }
    expect(countKey({ ...filters, sortBy: 'salary_high', limit: 48, offset: 96 })).toBe(countKey(filters))
    expect(countKey({ ...filters, platform: 'et' })).not.toBe(countKey(filters))
    expect(countKey({ ...filters, search: 'audit' })).not.toBe(countKey(filters))
  })
})

describe('cached listings wrappers', () => {
  it('throws through the cached rows wrapper on a DB error, so nothing is cached', async () => {
    vi.mocked(createClient).mockReturnValue(
      fakeDirectJobsClient({ rpc: { data: null, error: { message: 'upstream request timeout' } } }) as unknown as ReturnType<typeof createClient>
    )

    await expect(getCachedListingJobs({ platform: 'ab', limit: 24, offset: 0 })).rejects.toThrow('search_jobs_ranked failed')
  })

  it('throws through the cached count wrapper on a DB error', async () => {
    vi.mocked(createClient).mockReturnValue(
      fakeDirectJobsClient({ count: { count: null, error: { message: 'upstream request timeout' } } }) as unknown as ReturnType<typeof createClient>
    )

    await expect(getCachedListingJobsCount({ platform: 'ab' })).rejects.toThrow('count query failed')
  })

  it('returns [] and 0 for a genuine empty result', async () => {
    vi.mocked(createClient).mockReturnValue(
      fakeDirectJobsClient({ count: { count: 0, error: null }, rpc: { data: [], error: null } }) as unknown as ReturnType<typeof createClient>
    )

    expect(await getCachedListingJobs({ platform: 'ab', limit: 24, offset: 0 })).toEqual([])
    expect(await getCachedListingJobsCount({ platform: 'ab' })).toBe(0)
  })

  it('never caches or returns description on listing rows', async () => {
    vi.mocked(createClient).mockReturnValue(
      fakeDirectJobsClient({ rpc: { data: [{ id: 'a', title: 'T', description: 'x'.repeat(50_000) }], error: null } }) as unknown as ReturnType<typeof createClient>
    )

    const rows = await getCachedListingJobs({ platform: 'ab', limit: 24, offset: 0 })
    expect(rows).toEqual([{ id: 'a', title: 'T' }])
  })
})

// ── getSimilarJobs: indexed newest-first steps ───────────────────────────────

type QueryResult = { data: unknown[] | null; error: unknown }
type QueryRecord = Record<string, unknown[][]>

// Every query getSimilarJobs makes ends in .limit(), which resolves the
// next scripted result. Each .from() starts a new record of every chained
// call, so tests can check which step ran and with which filters.
function fakeSimilarClient(results: QueryResult[]) {
  const queries: QueryRecord[] = []
  const client = {
    from: (table: string) => {
      const record: QueryRecord = { from: [[table]] }
      queries.push(record)
      const builder: Record<string, (...args: unknown[]) => unknown> = {}
      for (const method of ['select', 'eq', 'contains', 'or', 'not', 'textSearch', 'neq', 'order']) {
        builder[method] = (...args: unknown[]) => {
          ;(record[method] ??= []).push(args)
          return builder
        }
      }
      builder.limit = (...args: unknown[]) => {
        ;(record.limit ??= []).push(args)
        return Promise.resolve(results.shift() ?? { data: [], error: null })
      }
      return builder
    },
  }
  return { client, queries }
}

function mockSimilarClient(results: QueryResult[]) {
  const fake = fakeSimilarClient(results)
  vi.mocked(createClient).mockReturnValue(fake.client as unknown as ReturnType<typeof createClient>)
  return fake
}

function job(id: string, title = 'Senior Practice Accountant') {
  return {
    id, slug: id, title, company_name: 'Co', location_text: 'London', location_country: 'United Kingdom',
    salary_text: null, salary_min: null, salary_max: null, salary_currency: null, published_at: '2026-09-01T00:00:00Z',
  }
}

const searchTermOf = (q: QueryRecord) => (q.textSearch?.[0]?.[1] as string | undefined) ?? null
const countryOf = (q: QueryRecord) =>
  (q.eq?.find(args => args[0] === 'location_country')?.[1] as string | undefined) ?? null

describe('getSimilarJobs — indexed steps', () => {
  it('stops after step 1 when the AND match fills the list (no OR query)', async () => {
    const { queries } = mockSimilarClient([
      { data: [job('self'), ...['a', 'b', 'c', 'd', 'e', 'f'].map(id => job(id))], error: null },
    ])

    const result = await getSimilarJobs({
      excludeId: 'self', platform: 'ab', title: 'Senior Practice Accountant', locationCountry: 'United Kingdom',
    })

    expect(result.map(j => j.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(queries).toHaveLength(1)
    expect(searchTermOf(queries[0])).toBe('senior practice accountant')
    expect(queries[0].textSearch[0][2]).toEqual({ type: 'websearch', config: 'english' })
    expect(countryOf(queries[0])).toBe('United Kingdom')
    expect(queries[0].not).toEqual([['published_at', 'is', null]])
    expect(queries[0].order).toEqual([['published_at', { ascending: false }]])
    expect(queries[0].limit).toEqual([[7]])
  })

  it('pads a short AND result with OR candidates ranked by shared title words, then recency', async () => {
    const { queries } = mockSimilarClient([
      // step 1 (AND): the viewed job and one strong match
      { data: [job('self'), job('a')], error: null },
      // step 2 (OR, same country), newest first
      {
        data: [
          job('b', 'Senior Developer'),        // 1 shared word
          job('a'),                            // duplicate of step 1
          job('c', 'Practice Accountant'),     // 2 shared words
          job('self'),                         // the viewed job
          job('d', 'Payroll Clerk'),           // matched on description only
          job('e', 'Senior Tax Advisor'),      // 1 shared word, older than b
        ],
        error: null,
      },
    ])

    const result = await getSimilarJobs({
      excludeId: 'self', platform: 'ab', title: 'Senior Practice Accountant', locationCountry: 'United Kingdom',
    })

    expect(result.map(j => j.id)).toEqual(['a', 'c', 'b', 'e', 'd'])
    expect(searchTermOf(queries[1])).toBe('senior OR practice OR accountant')
    expect(countryOf(queries[1])).toBe('United Kingdom')
    expect(queries[1].limit).toEqual([[40]])
  })

  it('searches worldwide when the same-country steps come up short', async () => {
    const { queries } = mockSimilarClient([
      { data: [], error: null },                          // step 1: AND, same country
      { data: [job('uk-1')], error: null },               // step 2: OR, same country
      { data: [job('us-1'), job('us-2')], error: null },  // step 3: OR, worldwide
      { data: [], error: null },                          // phase C fallback
    ])

    const result = await getSimilarJobs({
      excludeId: 'self', platform: 'ab', title: 'Senior Practice Accountant', locationCountry: 'United Kingdom',
    })

    expect(result.map(j => j.id)).toEqual(['uk-1', 'us-1', 'us-2'])
    expect(searchTermOf(queries[2])).toBe('senior OR practice OR accountant')
    expect(countryOf(queries[2])).toBeNull()
  })

  it('goes straight to the country fallback when the title has no usable words', async () => {
    const { queries } = mockSimilarClient([{ data: [job('x', 'Anything')], error: null }])

    const result = await getSimilarJobs({
      excludeId: 'self', platform: 'ab', title: 'Remote Full Time UK Job', locationCountry: 'United Kingdom',
    })

    expect(result.map(j => j.id)).toEqual(['x'])
    expect(queries).toHaveLength(1)
    expect(queries[0].textSearch).toBeUndefined()
    expect(queries[0].neq).toEqual([['id', 'self']])
  })

  it('logs a failed step (thrown, so never cached) and carries on with the next', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSimilarClient([
      { data: null, error: { message: 'upstream request timeout' } },   // step 1 fails
      { data: [job('a'), job('b')], error: null },                       // step 2 still runs
    ])

    const result = await getSimilarJobs({
      excludeId: 'self', platform: 'ab', title: 'Senior Practice Accountant', locationCountry: null,
    })

    expect(result.map(j => j.id)).toEqual(['a', 'b'])
    const [label, err] = consoleError.mock.calls[0]
    expect(label).toContain('and, same country')
    expect((err as Error).message).toBe('getSimilarJobs: and query failed: upstream request timeout')
  })

  it('returns [] when every step fails, so the page just hides the section', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const failure = { data: null, error: { message: 'connection refused' } }
    mockSimilarClient([failure, failure, failure, failure])

    const result = await getSimilarJobs({
      excludeId: 'self', platform: 'ab', title: 'Senior Practice Accountant', locationCountry: 'United Kingdom',
    })

    expect(result).toEqual([])
  })

  it('never selects search_vector, description or raw_source_data', async () => {
    const { queries } = mockSimilarClient([{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }])

    await getSimilarJobs({ excludeId: 'self', platform: 'ab', title: 'Senior Practice Accountant', locationCountry: 'United Kingdom' })

    const titleSteps = queries.filter(q => q.textSearch)
    expect(titleSteps).toHaveLength(3)
    for (const q of titleSteps) {
      const columns = String(q.select[0][0])
      expect(columns).toBe(SIMILAR_JOB_COLUMNS)
      expect(columns).not.toMatch(/search_vector|description|raw_source_data/)
    }
  })
})

describe('getSimilarJobs — cache keys', () => {
  const similarCacheArgs = () =>
    cacheCalls.filter(c => c.keyParts[0] === 'similar-jobs-candidates').map(c => c.args)

  it('keys on platform, mode, term, country and limit only, with the similar-jobs tags', async () => {
    cacheCalls.length = 0
    mockSimilarClient([{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }])

    await getSimilarJobs({ excludeId: 'viewed-123', platform: 'et', title: 'Senior Practice Accountant', locationCountry: 'Ethiopia' })

    expect(similarCacheArgs()).toEqual([
      ['et', 'and', 'senior practice accountant', 'Ethiopia', 7],
      ['et', 'or', 'senior OR practice OR accountant', 'Ethiopia', 40],
      ['et', 'or', 'senior OR practice OR accountant', null, 40],
    ])
    expect(JSON.stringify(similarCacheArgs())).not.toContain('viewed-123')
    const call = cacheCalls.find(c => c.keyParts[0] === 'similar-jobs-candidates')
    expect(call?.options).toEqual({ revalidate: 3600, tags: ['jobs', 'jobs:similar'] })
  })

  it('shares entries between different viewed jobs with the same title', async () => {
    cacheCalls.length = 0
    mockSimilarClient([{ data: [job('a')], error: null }, { data: [], error: null }])
    await getSimilarJobs({ excludeId: 'job-1', platform: 'ab', title: 'Senior Practice Accountant', locationCountry: null })
    const first = similarCacheArgs()

    cacheCalls.length = 0
    mockSimilarClient([{ data: [job('a')], error: null }, { data: [], error: null }])
    await getSimilarJobs({ excludeId: 'job-2', platform: 'ab', title: 'Senior Practice Accountant', locationCountry: null })

    expect(similarCacheArgs()).toEqual(first)
  })

  it('gives different keys for a different platform, country or title', async () => {
    const keysFor = async (platform: string, country: string | null, title: string, limit = 6) => {
      cacheCalls.length = 0
      mockSimilarClient([{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }])
      await getSimilarJobs({ excludeId: 'self', platform, title, locationCountry: country, limit })
      return JSON.stringify(similarCacheArgs())
    }

    const base = await keysFor('ab', 'United Kingdom', 'Senior Practice Accountant')
    expect(await keysFor('et', 'United Kingdom', 'Senior Practice Accountant')).not.toBe(base)
    expect(await keysFor('ab', 'Ireland', 'Senior Practice Accountant')).not.toBe(base)
    expect(await keysFor('ab', 'United Kingdom', 'Senior Audit Accountant')).not.toBe(base)
    expect(await keysFor('ab', 'United Kingdom', 'Senior Practice Accountant', 3)).not.toBe(base)
  })
})
