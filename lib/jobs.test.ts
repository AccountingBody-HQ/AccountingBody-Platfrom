import { describe, it, expect, vi, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import {
  getActiveDirectJobs, getCachedListingJobs, getCachedListingJobsCount,
  normaliseListingFilters, normaliseListingPage,
  getJobSitemapEntries, getJobSitemapChunk, getSimilarJobs, buildSimilarQuery, type Job,
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
vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
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
})

// Minimal fake client covering both call shapes getSimilarJobs uses:
// .rpc() for the two ranked phases (queued responses, consumed in call
// order) and the plain .from() chain for the phase C fallback (a single
// scripted response, since no test here needs more than one fallback call).
function fakeSimilarJobsClient(
  rpcQueue: Array<{ data: unknown[] | null; error: unknown }>,
  fallbackData: unknown[] = []
) {
  const rpcCalls: unknown[] = []
  const rpc = vi.fn((_name: string, params: unknown) => {
    rpcCalls.push(params)
    const next = rpcQueue.shift() ?? { data: [], error: null }
    return Promise.resolve(next)
  })
  const builder = {
    from: () => builder,
    select: () => builder,
    eq: () => builder,
    contains: () => builder,
    or: () => builder,
    neq: () => builder,
    order: () => builder,
    limit: () => Promise.resolve({ data: fallbackData, error: null }),
  }
  return { client: { rpc, from: builder.from }, rpcCalls }
}

function row(id: string): Job {
  return { id } as unknown as Job
}

describe('getSimilarJobs', () => {
  it('excludes excludeId when the ranked RPC returns the current job first', async () => {
    const { client } = fakeSimilarJobsClient([
      {
        data: [row('self'), row('a'), row('b'), row('c'), row('d'), row('e'), row('f')],
        error: null,
      },
    ])
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    const result = await getSimilarJobs({
      excludeId: 'self',
      platform: 'ab',
      title: 'Senior Practice Accountant',
      locationCountry: 'United Kingdom',
    })

    expect(result.map(j => j.id)).not.toContain('self')
    expect(result).toHaveLength(6)
    expect(result.map(j => j.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })

  it('never returns more than limit rows, even if the RPC returns more', async () => {
    const { client } = fakeSimilarJobsClient([
      {
        data: Array.from({ length: 10 }, (_, i) => row(`job-${i}`)),
        error: null,
      },
    ])
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    const result = await getSimilarJobs({
      excludeId: 'self',
      platform: 'ab',
      title: 'Senior Practice Accountant',
      locationCountry: 'United Kingdom',
      limit: 6,
    })

    expect(result).toHaveLength(6)
  })

  it('returns [] rather than throwing when the ranked RPC errors', async () => {
    const { client } = fakeSimilarJobsClient([
      { data: null, error: new Error('connection refused') },
    ])
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    const result = await getSimilarJobs({
      excludeId: 'self',
      platform: 'ab',
      title: 'Senior Practice Accountant',
      locationCountry: null,
    })

    expect(result).toEqual([])
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

describe('getSimilarJobs — cached ranked calls', () => {
  it('calls the ranked RPC with only platform, search term, country and limit+1 varying', async () => {
    const { client, rpcCalls } = fakeSimilarJobsClient([{ data: [], error: null }, { data: [], error: null }])
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    await getSimilarJobs({ excludeId: 'self', platform: 'et', title: 'Senior Tax Accountant', locationCountry: null, limit: 6 })

    expect(rpcCalls[0]).toMatchObject({
      p_platform: 'et',
      p_search: buildSimilarQuery('Senior Tax Accountant'),
      p_location_country: null,
      p_limit: 7,
      p_offset: 0,
      p_sort_by: 'relevance',
    })
  })

  it('returns only the fields the similar-jobs list renders (no description)', async () => {
    const { client } = fakeSimilarJobsClient([
      { data: [{ ...row('a'), slug: 'a', title: 'A', company_name: 'Co', description: 'x'.repeat(50_000) }], error: null },
    ])
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    const result = await getSimilarJobs({ excludeId: 'self', platform: 'ab', title: 'Senior Practice Accountant', locationCountry: null })

    expect(result).toHaveLength(1)
    expect(result[0]).not.toHaveProperty('description')
    expect(result[0]).toMatchObject({ id: 'a', slug: 'a', title: 'A', company_name: 'Co' })
  })
})
