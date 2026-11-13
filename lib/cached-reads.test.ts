import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import {
  getArticleBySlug, getCategoryCounts, getQuestionSetCount, getPublishedQuestionCount, getPublishedArticleCount,
} from './db'
import {
  getCachedListingJobs, getCachedListingJobsCount, getBrowsableJobsCount,
  getCachedActiveJobCountries, COUNTRY_LIST_LOG,
} from './jobs'
import { resetCacheGuard, HOLD_MS, BACKOFF_MS } from './cache-guard'

// Same mocks as lib/db.test.ts and lib/jobs.test.ts: no real React cache()
// or Next incremental cache outside a Next server. unstable_cache is an
// identity wrapper that records its key parts, options, arguments and the
// promise the cached function returned, so a test can tell whether the
// cached function itself rejected (Next stores nothing in that case).
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
const cacheCalls = vi.hoisted(() => [] as Array<{ keyParts: string[]; options: unknown; args: unknown[]; result: Promise<unknown> }>)
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>, keyParts: string[], options: unknown) =>
    (...args: unknown[]) => {
      const result = fn(...args)
      cacheCalls.push({ keyParts, options, args, result })
      return result
    },
}))

// One fake client for every query shape used by the guarded readers. Each
// awaited query takes the current scripted answer; `queries` counts how many
// reached the "database".
let answer: { data?: unknown; count?: number | null; error: unknown; status: number }
let queries = 0
function fakeClient() {
  const settle = () => { queries += 1; return Promise.resolve({ data: null, count: null, ...answer }) }
  const builder: Record<string, unknown> = {
    from: () => builder, select: () => builder, eq: () => builder, in: () => builder,
    or: () => builder, textSearch: () => builder, order: () => builder, range: () => builder,
    contains: () => builder, like: () => builder,
    single: settle,
    rpc: settle,
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => settle().then(resolve, reject),
  }
  return builder
}

const ok = (fields: { data?: unknown; count?: number | null }) => { answer = { error: null, status: 200, ...fields } }
const fail = () => { answer = { data: null, count: null, error: { message: 'upstream request timeout', code: '' }, status: 504 } }

beforeEach(() => {
  // The estimate path: these tests cover one guarded read per reader. The
  // pre-counted row and its fall-throughs are covered in jobs-speed.test.ts.
  vi.stubEnv('JOBS_TOTAL_SOURCE', 'estimate')
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  vi.mocked(createClient).mockImplementation(() => fakeClient() as unknown as ReturnType<typeof createClient>)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  cacheCalls.length = 0
  queries = 0
})

afterEach(() => {
  resetCacheGuard()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const article = { id: '1', slug: 'fixed-costs', title: 'Fixed costs', content: '<p>x</p>' }
const row = { id: 'a', title: 'Tax Manager', slug: 'tax-manager', excerpt: 'Short text' }
// The pre-counted country rows the country menu now reads (fresh: 5 minutes old).
const countries = [
  { key: 'jobs_browsable:ab:country:Ethiopia', value: 3, updated_at: '2025-12-31T23:55:00Z' },
  { key: 'jobs_browsable:ab:country:United Kingdom', value: 12, updated_at: '2025-12-31T23:55:00Z' },
]

// Each reader with: a healthy answer, what that answer returns today, and
// the caller-visible fallback when the database fails with no good value.
type Reader = {
  name: string
  run: () => Promise<unknown>
  healthy: () => void
  expected: unknown
  fallback: { value: unknown } | { throws: string }
}
const readers: Reader[] = [
  { name: 'getArticleBySlug', run: () => getArticleBySlug('fixed-costs'), healthy: () => ok({ data: article }), expected: article, fallback: { throws: 'status 504' } },
  { name: 'getQuestionSetCount', run: () => getQuestionSetCount(), healthy: () => ok({ count: 181 }), expected: 181, fallback: { value: 0 } },
  { name: 'getPublishedQuestionCount', run: () => getPublishedQuestionCount(), healthy: () => ok({ count: 24531 }), expected: 24531, fallback: { value: 0 } },
  { name: 'getPublishedArticleCount', run: () => getPublishedArticleCount('ab'), healthy: () => ok({ count: 2017 }), expected: 2017, fallback: { value: 0 } },
  { name: 'getBrowsableJobsCount', run: () => getBrowsableJobsCount('et'), healthy: () => ok({ count: 13456 }), expected: 13456, fallback: { value: 0 } },
  { name: 'getCachedListingJobs', run: () => getCachedListingJobs({ platform: 'ab', search: 'tax', limit: 24, offset: 0 }), healthy: () => ok({ data: [{ ...row, description: 'long' }] }), expected: [row], fallback: { throws: 'search_jobs_ranked failed' } },
  { name: 'getCachedListingJobs (default order)', run: () => getCachedListingJobs({ platform: 'ab', limit: 24, offset: 24 }), healthy: () => ok({ data: [row] }), expected: [row], fallback: { throws: 'default jobs list query failed' } },
  { name: 'getCachedListingJobsCount', run: () => getCachedListingJobsCount({ platform: 'ab' }), healthy: () => ok({ count: 640 }), expected: 640, fallback: { throws: 'count query failed' } },
  { name: 'getCachedActiveJobCountries', run: () => getCachedActiveJobCountries('ab'), healthy: () => ok({ data: countries }), expected: [{ country: 'United Kingdom', count: 12 }, { country: 'Ethiopia', count: 3 }], fallback: { value: [] } },
]

async function outcome(run: () => Promise<unknown>) {
  try { return { value: await run() } } catch (error) { return { throws: (error as Error).message } }
}

describe.each(readers)('$name through the cache guard', ({ run, healthy, expected, fallback }) => {
  it('returns the same value as before with a healthy database', async () => {
    healthy()
    expect(await run()).toEqual(expected)
  })

  it('reads the database once for repeated calls within the hold, then again after it', async () => {
    healthy()
    await run()
    await run()
    expect(queries).toBe(1)
    vi.advanceTimersByTime(HOLD_MS)
    expect(await run()).toEqual(expected)
    expect(queries).toBe(2)
  })

  it('reads the database once for concurrent calls', async () => {
    healthy()
    const results = await Promise.all([run(), run(), run(), run()])
    expect(results).toEqual([expected, expected, expected, expected])
    expect(queries).toBe(1)
  })

  it('returns the last good value when a later refresh fails', async () => {
    healthy()
    await run()
    vi.advanceTimersByTime(HOLD_MS)
    fail()
    expect(await run()).toEqual(expected)
  })

  it('gives the existing fallback when the database fails and there is no good value', async () => {
    fail()
    const result = await outcome(run)
    if ('value' in fallback) expect(result).toEqual({ value: fallback.value })
    else expect((result as { throws: string }).throws).toContain(fallback.throws)
  })

  it('does not read the database again during the pause after a failure', async () => {
    fail()
    const first = await outcome(run)
    healthy()
    vi.advanceTimersByTime(BACKOFF_MS - 1)
    expect(await outcome(run)).toEqual(first)
    expect(queries).toBe(1)
    vi.advanceTimersByTime(1)
    expect(await run()).toEqual(expected)
    expect(queries).toBe(2)
  })
})

describe('getCategoryCounts through the cache guard', () => {
  it('returns the same counts as before, one query per category, then none within the hold', async () => {
    ok({ count: 7 })
    const first = await getCategoryCounts()
    expect(Object.values(first)).toEqual(Array(10).fill(7))
    expect(queries).toBe(10)
    expect(await getCategoryCounts()).toEqual(first)
    expect(queries).toBe(10)
  })

  it('keeps each category\'s last good count when refreshes fail, and 0 where there is none', async () => {
    ok({ count: 7 })
    await getCategoryCounts()
    vi.advanceTimersByTime(HOLD_MS)
    fail()
    expect(Object.values(await getCategoryCounts())).toEqual(Array(10).fill(7))
    resetCacheGuard()
    expect(Object.values(await getCategoryCounts())).toEqual(Array(10).fill(0))
  })
})

describe('cache settings are unchanged', () => {
  it('getArticleBySlug keeps its key parts, duration and per-slug tag', async () => {
    ok({ data: article })
    await getArticleBySlug('fixed-costs')
    expect(cacheCalls[0].keyParts).toEqual(['article-by-slug', 'published'])
    expect(cacheCalls[0].args).toEqual(['fixed-costs'])
    expect(cacheCalls[0].options).toEqual({ revalidate: 3600, tags: ['articles', 'article:fixed-costs'] })
  })

  it('listing readers keep their key parts, duration and tags', async () => {
    ok({ data: [], count: 0 })
    await getCachedListingJobs({ platform: 'ab' })
    await getCachedListingJobsCount({ platform: 'ab' })
    expect(cacheCalls.map(c => [c.keyParts, c.options])).toEqual([
      [['listing-jobs'], { revalidate: 300, tags: ['jobs', 'jobs:listings'] }],
      [['listing-jobs-count'], { revalidate: 300, tags: ['jobs', 'jobs:listings'] }],
    ])
  })

  it('the country list reuses the pre-counted filter rows entry (no cache entry of its own)', async () => {
    ok({ data: [] })
    await getCachedActiveJobCountries('et')
    expect(cacheCalls.map(c => [c.keyParts, c.args, c.options])).toEqual([
      [['site-counts-jobs-filters'], ['et'], { revalidate: 120, tags: ['counts', 'jobs'] }],
    ])
  })

  it('different articles never share a remembered value', async () => {
    ok({ data: article })
    await getArticleBySlug('fixed-costs')
    ok({ data: { ...article, slug: 'variable-costs' } })
    expect(await getArticleBySlug('variable-costs')).toMatchObject({ slug: 'variable-costs' })
    expect(queries).toBe(2)
  })

  it('different listing filters never share a remembered value', async () => {
    ok({ count: 5 })
    expect(await getCachedListingJobsCount({ platform: 'ab' })).toBe(5)
    ok({ count: 9 })
    expect(await getCachedListingJobsCount({ platform: 'ab', search: 'tax' })).toBe(9)
    expect(await getCachedListingJobsCount({ platform: 'et' })).toBe(9)
    expect(queries).toBe(3)
  })

  it('a genuine not-found article (null) is returned as before', async () => {
    answer = { data: null, error: { code: 'PGRST116', message: 'no rows' }, status: 406 }
    expect(await getArticleBySlug('missing')).toBeNull()
  })
})

describe('active job countries (from the pre-counted rows)', () => {
  it('throws inside the cached function on a database error, so nothing is stored, and returns [] outside it', async () => {
    fail()
    expect(await getCachedActiveJobCountries('ab')).toEqual([])
    await expect(cacheCalls[0].result).rejects.toThrow('site_counts filter read failed (status 504)')
  })

  it('stores a genuine empty list of rows, and returns [] (the built-in list) for it', async () => {
    ok({ data: [] })
    expect(await getCachedActiveJobCountries('ab')).toEqual([])
    await expect(cacheCalls[0].result).resolves.toEqual([])
    expect(console.warn).toHaveBeenCalledWith(COUNTRY_LIST_LOG.missing)
  })

  it('logs one fixed line on a failed read, with no upstream text', async () => {
    fail()
    await getCachedActiveJobCountries('ab')
    expect(console.warn).toHaveBeenCalledWith(COUNTRY_LIST_LOG.failed)
    expect(console.error).not.toHaveBeenCalled()
  })
})
