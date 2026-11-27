import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import {
  getActiveDirectJobs, getCachedListingJobs, getCachedListingJobsCount,
  normaliseListingFilters, normaliseListingPage,
  getJobSitemapEntries, getJobSitemapChunk, getSimilarJobs, buildSimilarQuery,
  similarTitleTokens, SIMILAR_JOB_COLUMNS, getBrowsableJobsCount,
} from './jobs'
import { resetCacheGuard } from './cache-guard'

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
const cacheCalls = vi.hoisted(() => [] as Array<{ keyParts: string[]; options: unknown; args: unknown[]; result: unknown }>)
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown, keyParts: string[], options: unknown) =>
    (...args: unknown[]) => {
      const result = fn(...args)
      cacheCalls.push({ keyParts, options, args, result })
      return result
    },
}))

// Fake query builder for getJobSitemapEntries's keyset shape. Records every
// filter so a test can check exactly what each page asked for; .limit() is
// the call that resolves, returning the next scripted page (or, with
// `always`, a fresh full page every time).
function fakeEntriesSupabaseClient(
  pages: Array<{ data: unknown[] | null; error: unknown }>,
  always?: () => { data: unknown[]; error: null },
) {
  const calls: Array<{ gt: string | null; limit: number; order: [string, unknown]; eq: [string, unknown]; or: string; contains: [string, unknown]; select: string }> = []
  let current: { gt: string | null; order?: [string, unknown]; eq?: [string, unknown]; or?: string; contains?: [string, unknown]; select?: string } = { gt: null }
  let call = 0
  const builder = {
    from: () => {
      current = { gt: null }
      return builder
    },
    select: (cols: string) => {
      current.select = cols
      return builder
    },
    in: () => {
      throw new Error('in() must not be used: the sitemap reads status = active only')
    },
    eq: (col: string, val: unknown) => {
      current.eq = [col, val]
      return builder
    },
    or: (filter: string) => {
      current.or = filter
      return builder
    },
    contains: (col: string, val: unknown) => {
      current.contains = [col, val]
      return builder
    },
    gt: (col: string, val: string) => {
      expect(col).toBe('id')
      current.gt = val
      return builder
    },
    order: (col: string, opts: unknown) => {
      current.order = [col, opts]
      return builder
    },
    range: () => {
      throw new Error('range() must not be used: the sitemap pages by key')
    },
    limit: (n: number) => {
      calls.push({ ...current, limit: n } as (typeof calls)[number])
      const page = always ? always() : pages[call] ?? { data: [], error: null }
      call += 1
      return Promise.resolve(page)
    },
  }
  return { client: builder, calls }
}

const originalSimilarJobsEnabled = process.env.SIMILAR_JOBS_ENABLED

function setSimilarJobsEnabled(value: string | undefined) {
  if (value === undefined) delete process.env.SIMILAR_JOBS_ENABLED
  else process.env.SIMILAR_JOBS_ENABLED = value
}

// Each test starts with no remembered values (lib/cache-guard.ts).
afterEach(() => {
  vi.clearAllMocks()
  setSimilarJobsEnabled(originalSimilarJobsEnabled)
  resetCacheGuard()
})

function makeChunkJobs(n: number, startIndex = 0) {
  // status 'active' with expires_at: null keeps getJobLifecycleState at
  // 'open' for every row, so the open-jobs filter never drops any of these
  // test rows — the counts below are exact, not "at most." Ids sort in the
  // same order as startIndex.
  return Array.from({ length: n }, (_, i) => ({
    id: `id-${String(startIndex + i).padStart(6, '0')}`,
    slug: `job-${startIndex + i}`,
    status: 'active',
    closed_at: null,
    expires_at: null,
    published_at: '2024-01-01T00:00:00.000Z',
    created_at: '2024-01-01T00:00:00.000Z',
  }))
}

describe('getJobSitemapEntries — keyset pagination', () => {
  function useClient(fake: { client: unknown }) {
    vi.mocked(createClient).mockReturnValue(fake.client as unknown as ReturnType<typeof createClient>)
  }

  it('reads page after page by key: each page starts after the last id of the one before', async () => {
    const pages = [makeChunkJobs(PAGE_SIZE, 0), makeChunkJobs(PAGE_SIZE, PAGE_SIZE), makeChunkJobs(300, PAGE_SIZE * 2)]
    const fake = fakeEntriesSupabaseClient(pages.map(data => ({ data, error: null })))
    useClient(fake)

    const result = await getJobSitemapEntries('et')

    expect(result.ok).toBe(true)
    const entries = result.ok ? result.entries : []
    expect(entries).toHaveLength(PAGE_SIZE * 2 + 300)
    expect(new Set(entries.map(e => e.slug)).size).toBe(entries.length)
    expect(fake.calls.map(c => c.gt)).toEqual([null, pages[0][PAGE_SIZE - 1].id, pages[1][PAGE_SIZE - 1].id])
    const keys = fake.calls.map(c => c.gt).filter((k): k is string => k !== null)
    for (let i = 1; i < keys.length; i++) expect(keys[i] > keys[i - 1]).toBe(true)
    for (const c of fake.calls) {
      expect(c.limit).toBe(PAGE_SIZE)
      expect(c.order).toEqual(['id', { ascending: true }])
      expect(c.eq).toEqual(['status', 'active'])
      expect(c.or).toMatch(/^expires_at\.is\.null,expires_at\.gt\.\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      expect(c.or).toBe(fake.calls[0].or)
      expect(c.contains).toEqual(['platform', ['et']])
      expect(c.select).toBe('id, slug, status, expires_at, closed_at, published_at, created_at, platform, canonical_owner')
    }
  })

  it('does not fetch a second page when the first page is already short', async () => {
    const fake = fakeEntriesSupabaseClient([{ data: makeChunkJobs(5, 0), error: null }])
    useClient(fake)

    const result = await getJobSitemapEntries('et')

    expect(result.ok && result.entries).toHaveLength(5)
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0].gt).toBeNull()
  })

  it('stops on the empty page that follows an exactly full one', async () => {
    const fake = fakeEntriesSupabaseClient([
      { data: makeChunkJobs(PAGE_SIZE, 0), error: null },
      { data: [], error: null },
    ])
    useClient(fake)

    const result = await getJobSitemapEntries('et')

    expect(result.ok && result.entries).toHaveLength(PAGE_SIZE)
    expect(fake.calls).toHaveLength(2)
  })

  it('returns ok:false rather than a partial list when a later page errors', async () => {
    const fake = fakeEntriesSupabaseClient([
      { data: makeChunkJobs(PAGE_SIZE, 0), error: null },
      { data: makeChunkJobs(PAGE_SIZE, PAGE_SIZE), error: null },
      { data: null, error: new Error('connection refused') },
    ])
    useClient(fake)

    expect(await getJobSitemapEntries('et')).toEqual({ ok: false })
    expect(fake.calls).toHaveLength(3)
  })

  it('returns ok:false when a later page has no data and no error', async () => {
    const fake = fakeEntriesSupabaseClient([
      { data: makeChunkJobs(PAGE_SIZE, 0), error: null },
      { data: null, error: null },
    ])
    useClient(fake)

    expect(await getJobSitemapEntries('et')).toEqual({ ok: false })
  })

  it('leaves out every closed job (past its expiry, or no longer active) and keeps open ones', async () => {
    const day = 24 * 60 * 60 * 1000
    const rows = makeChunkJobs(5, 0)
    rows[0].expires_at = new Date(Date.now() - 400 * day).toISOString() as never
    rows[1].expires_at = new Date(Date.now() - 40 * day).toISOString() as never
    rows[3].status = 'expired'
    rows[3].expires_at = new Date(Date.now() + 10 * day).toISOString() as never
    rows[4].expires_at = new Date(Date.now() + 10 * day).toISOString() as never
    const fake = fakeEntriesSupabaseClient([{ data: rows, error: null }])
    useClient(fake)

    const result = await getJobSitemapEntries('et')

    expect(result.ok && result.entries.map(e => e.slug)).toEqual(['job-2', 'job-4'])
    expect(result.ok && result.entries[0].lastModified).toEqual(new Date('2024-01-01T00:00:00.000Z'))
  })

  it('stops at the 100-page safety bound even if every page is full', async () => {
    let next = 0
    const fake = fakeEntriesSupabaseClient([], () => {
      const data = makeChunkJobs(PAGE_SIZE, next)
      next += PAGE_SIZE
      return { data, error: null }
    })
    useClient(fake)

    const result = await getJobSitemapEntries('et')

    expect(fake.calls).toHaveLength(100)
    expect(result.ok && result.entries).toHaveLength(100 * PAGE_SIZE)
  })
})

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
    eq: () => builder,
    or: () => builder,
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
      limit: 24, offset: 0,
    })
    expect(empty).toBe(bare)
  })

  // Since the speed job (11 Nov 2026) no chosen sort and no search words is
  // the 'default' order, so an explicitly chosen relevance is its own entry.
  it('keeps an explicitly chosen relevance with no search words apart from the default', () => {
    expect(pageKey({ platform: 'ab', sortBy: 'relevance', limit: 24, offset: 0 }))
      .not.toBe(pageKey({ platform: 'ab', limit: 24, offset: 0 }))
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

    await expect(getCachedListingJobs({ platform: 'ab', search: 'tax', limit: 24, offset: 0 })).rejects.toThrow('search_jobs_ranked failed')
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

    expect(await getCachedListingJobs({ platform: 'ab', search: 'tax', limit: 24, offset: 0 })).toEqual([])
    expect(await getCachedListingJobsCount({ platform: 'ab' })).toBe(0)
  })

  it('never caches or returns description on listing rows', async () => {
    vi.mocked(createClient).mockReturnValue(
      fakeDirectJobsClient({ rpc: { data: [{ id: 'a', title: 'T', description: 'x'.repeat(50_000) }], error: null } }) as unknown as ReturnType<typeof createClient>
    )

    const rows = await getCachedListingJobs({ platform: 'ab', search: 'tax', limit: 24, offset: 0 })
    expect(rows).toEqual([{ id: 'a', title: 'T' }])
  })
})

// ── getSimilarJobs: the saved list ───────────────────────────────────────────

type QueryResult = { data: unknown[] | null; error: unknown }
type QueryRecord = Record<string, unknown[][]>

// Every query getSimilarJobs makes ends in .limit(), which resolves the
// next scripted result. Each .from() starts a new record of every chained
// call, so tests can check which read ran and with which filters.
function fakeSimilarClient(results: QueryResult[]) {
  const queries: QueryRecord[] = []
  const client = {
    from: (table: string) => {
      const record: QueryRecord = { from: [[table]] }
      queries.push(record)
      const builder: Record<string, (...args: unknown[]) => unknown> = {}
      for (const method of ['select', 'eq', 'in', 'contains', 'or', 'not', 'textSearch', 'neq', 'order']) {
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

// The saved list row (public.job_similar) for the viewed job.
const saved = (ids: string[]): QueryResult => ({ data: [{ similar_ids: ids }], error: null })
const tableOf = (q: QueryRecord) => q.from[0][0]

describe('getSimilarJobs — kill switch', () => {
  const params = { excludeId: 'self', platform: 'ab', title: 'Senior Practice Accountant', locationCountry: 'United Kingdom' }

  it.each([[undefined], ['false'], [''], ['TRUE'], ['1']])(
    'returns [] with no cache, database or log call when SIMILAR_JOBS_ENABLED is %j',
    async value => {
      setSimilarJobsEnabled(value)
      cacheCalls.length = 0
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { queries } = mockSimilarClient([{ data: [job('a')], error: null }])

      expect(await getSimilarJobs(params)).toEqual([])

      expect(vi.mocked(createClient)).not.toHaveBeenCalled()
      expect(queries).toHaveLength(0)
      expect(cacheCalls).toHaveLength(0)
      expect(consoleError).not.toHaveBeenCalled()
    }
  )

  it('runs the normal lookup when SIMILAR_JOBS_ENABLED is exactly "true"', async () => {
    setSimilarJobsEnabled('true')
    const { queries } = mockSimilarClient([
      saved(['a', 'b', 'c', 'd', 'e', 'f']),
      { data: ['a', 'b', 'c', 'd', 'e', 'f'].map(id => job(id)), error: null },
    ])

    const result = await getSimilarJobs(params)

    expect(result.map(j => j.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(queries).toHaveLength(2)
  })
})

describe('getSimilarJobs — saved list', () => {
  beforeEach(() => setSimilarJobsEnabled('true'))

  it('reads the saved list by key, then those jobs by id with the live filters, in the saved order', async () => {
    const { queries } = mockSimilarClient([
      saved(['f', 'e', 'd', 'c', 'b', 'a']),
      { data: ['a', 'b', 'c', 'd', 'e', 'f'].map(id => job(id)), error: null },
    ])

    const result = await getSimilarJobs({
      excludeId: 'self', platform: 'ab', title: 'Senior Practice Accountant', locationCountry: 'United Kingdom',
    })

    expect(result.map(j => j.id)).toEqual(['f', 'e', 'd', 'c', 'b', 'a'])
    expect(queries.map(tableOf)).toEqual(['job_similar', 'jobs'])
    expect(queries[0].select).toEqual([['similar_ids']])
    expect(queries[0].eq).toEqual([['job_id', 'self'], ['platform', 'ab']])
    expect(queries[0].limit).toEqual([[1]])
    expect(queries[1].in).toEqual([['id', ['f', 'e', 'd', 'c', 'b', 'a']]])
    expect(queries[1].eq).toEqual([['status', 'active']])
    expect(queries[1].contains).toEqual([['platform', ['ab']]])
    expect(String(queries[1].or[0][0])).toMatch(/^expires_at\.is\.null,expires_at\.gt\./)
    expect(queries[1].limit).toEqual([[6]])
    for (const q of queries) expect(q.textSearch).toBeUndefined()
  })

  it('drops saved jobs that are no longer live, keeping the saved order', async () => {
    mockSimilarClient([
      saved(['a', 'gone', 'c', 'b']),
      { data: [job('b'), job('c'), job('a')], error: null },
    ])

    const result = await getSimilarJobs({
      excludeId: 'self', platform: 'ab', title: 'Senior Practice Accountant', locationCountry: 'United Kingdom',
    })

    expect(result.map(j => j.id)).toEqual(['a', 'c', 'b'])
  })

  it('no saved list: [] and no jobs read', async () => {
    const { queries } = mockSimilarClient([{ data: [], error: null }])

    const result = await getSimilarJobs({
      excludeId: 'self', platform: 'ab', title: 'Senior Practice Accountant', locationCountry: 'United Kingdom',
    })

    expect(result).toEqual([])
    expect(queries.map(tableOf)).toEqual(['job_similar'])
  })

  it('does not read the title: a title with no usable words still gets its saved list', async () => {
    const { queries } = mockSimilarClient([saved(['x']), { data: [job('x', 'Anything')], error: null }])

    const result = await getSimilarJobs({
      excludeId: 'self', platform: 'ab', title: 'Remote Full Time UK Job', locationCountry: 'United Kingdom',
    })

    expect(result.map(j => j.id)).toEqual(['x'])
    expect(queries).toHaveLength(2)
    expect(queries[0].textSearch).toBeUndefined()
    expect(queries[0].neq).toBeUndefined()
  })

  it('logs a failed read (thrown, so never cached) and returns []', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSimilarClient([
      { data: null, error: { message: 'upstream request timeout' } },   // the saved list read fails
    ])

    const result = await getSimilarJobs({
      excludeId: 'self', platform: 'ab', title: 'Senior Practice Accountant', locationCountry: null,
    })

    expect(result).toEqual([])
    const [label, err] = consoleError.mock.calls[0]
    expect(label).toContain('saved list')
    // PRIV-8 S4: the log carries the short code only (this database error has none).
    expect(err).toBe('unknown')
  })

  it('returns [] when the jobs read fails, so the page just hides the section', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSimilarClient([saved(['a']), { data: null, error: { message: 'connection refused' } }])

    const result = await getSimilarJobs({
      excludeId: 'self', platform: 'ab', title: 'Senior Practice Accountant', locationCountry: 'United Kingdom',
    })

    expect(result).toEqual([])
  })

  it('never selects search_vector, description or raw_source_data', async () => {
    const { queries } = mockSimilarClient([saved(['a']), { data: [job('a')], error: null }])

    await getSimilarJobs({ excludeId: 'self', platform: 'ab', title: 'Senior Practice Accountant', locationCountry: 'United Kingdom' })

    expect(queries).toHaveLength(2)
    expect(queries[0].select).toEqual([['similar_ids']])
    const columns = String(queries[1].select[0][0])
    expect(columns).toBe(SIMILAR_JOB_COLUMNS)
    expect(columns).not.toMatch(/search_vector|description|raw_source_data/)
  })
})

describe('getSimilarJobs — cache keys', () => {
  beforeEach(() => setSimilarJobsEnabled('true'))

  const similarCacheArgs = () =>
    cacheCalls.filter(c => c.keyParts[0] === 'similar-jobs-saved').map(c => c.args)

  it('keys on the viewed job and platform only, with the similar-jobs tags', async () => {
    cacheCalls.length = 0
    mockSimilarClient([{ data: [], error: null }])

    await getSimilarJobs({ excludeId: 'viewed-123', platform: 'et', title: 'Senior Practice Accountant', locationCountry: 'Ethiopia' })

    expect(similarCacheArgs()).toEqual([['viewed-123', 'et']])
    const call = cacheCalls.find(c => c.keyParts[0] === 'similar-jobs-saved')
    expect(call?.options).toEqual({ revalidate: 3600, tags: ['jobs', 'related-jobs'] })
    expect(cacheCalls.map(c => c.keyParts[0])).toEqual(['similar-jobs-saved'])
  })

  it('the title and country are not part of the key', async () => {
    cacheCalls.length = 0
    mockSimilarClient([{ data: [], error: null }])
    await getSimilarJobs({ excludeId: 'job-1', platform: 'ab', title: 'Senior Practice Accountant', locationCountry: null })
    const first = similarCacheArgs()

    cacheCalls.length = 0
    resetCacheGuard()
    mockSimilarClient([{ data: [], error: null }])
    await getSimilarJobs({ excludeId: 'job-1', platform: 'ab', title: 'Practice Accountant, Senior', locationCountry: 'Ireland' })

    expect(similarCacheArgs()).toEqual(first)
  })

  it('removes the viewed job even if a saved list held it', async () => {
    mockSimilarClient([saved(['viewed-123', 'x']), { data: [job('viewed-123', 'Anything'), job('x', 'Anything')], error: null }])

    const result = await getSimilarJobs({ excludeId: 'viewed-123', platform: 'ab', title: 'Remote Job', locationCountry: 'United Kingdom' })

    expect(result.map(j => j.id)).toEqual(['x'])
  })

  it('gives different keys for a different job or platform; the limit is applied after the cache', async () => {
    const keysFor = async (excludeId: string, platform: string, limit = 6) => {
      cacheCalls.length = 0
      resetCacheGuard()
      mockSimilarClient([{ data: [], error: null }])
      await getSimilarJobs({ excludeId, platform, title: 'Senior Practice Accountant', locationCountry: 'United Kingdom', limit })
      return JSON.stringify(similarCacheArgs())
    }

    const base = await keysFor('self', 'ab')
    expect(await keysFor('self', 'et')).not.toBe(base)
    expect(await keysFor('other', 'ab')).not.toBe(base)
    expect(await keysFor('self', 'ab', 3)).toBe(base)
  })

  it('applies the limit to the saved list', async () => {
    mockSimilarClient([saved(['a', 'b', 'c', 'd']), { data: ['a', 'b', 'c', 'd'].map(id => job(id)), error: null }])

    const result = await getSimilarJobs({ excludeId: 'self', platform: 'ab', title: 'Tax Manager', limit: 2 })

    expect(result.map(j => j.id)).toEqual(['a', 'b'])
  })
})

describe('getBrowsableJobsCount', () => {
  // The chain ends in .or(), which resolves the scripted result.
  function mockCountClient(result: { count: number | null; error: unknown; status?: number }) {
    const builder = {
      from: () => builder,
      select: () => builder,
      eq: () => builder,
      contains: () => builder,
      or: () => Promise.resolve(result),
    }
    vi.mocked(createClient).mockReturnValue(builder as unknown as ReturnType<typeof createClient>)
  }
  const countCall = () => cacheCalls.find(c => c.keyParts[0] === 'getBrowsableJobsCount')

  it('caches a real count for an hour, keyed on the platform', async () => {
    cacheCalls.length = 0
    mockCountClient({ count: 13456, error: null })

    expect(await getBrowsableJobsCount('et')).toBe(13456)
    expect(countCall()?.args).toEqual(['et'])
    expect(countCall()?.options).toEqual({ revalidate: 3600, tags: ['counts', 'jobs'] })
  })

  it('caches a genuine zero', async () => {
    cacheCalls.length = 0
    mockCountClient({ count: 0, error: null })

    expect(await getBrowsableJobsCount('ab')).toBe(0)
    await expect(countCall()?.result).resolves.toBe(0)
  })

  // Rejecting inside the cached function is what keeps the result out of the
  // cache; the caller still gets today's fallback of 0.
  it.each([
    ['a query error with an empty message', { count: null, error: { message: '' }, status: 504 }],
    ['a missing count with no error', { count: null, error: null, status: 200 }],
  ])('throws inside the cache and returns 0 outside it on %s', async (_label, result) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    cacheCalls.length = 0
    mockCountClient(result)

    expect(await getBrowsableJobsCount('ab')).toBe(0)
    await expect(countCall()?.result).rejects.toThrow('status')
  })
})
