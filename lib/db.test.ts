import { describe, it, expect, vi, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { getArticleBySlug, getCategoryCounts, getPublishedArticleCount, getPublishedQuestionCount, getQuestionSetCount } from './db'
import { resetCacheGuard } from './cache-guard'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

// Same workaround as lib/jobs.test.ts: plain vitest resolves 'react' to a
// build that doesn't export cache() at all (only Next's bundled/canary
// React does), and this module now imports { cache } from 'react' at the
// top level for getCachedPublishedArticleCount/getCachedQuestionSetCount —
// the import runs on load regardless of which export a given test touches.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))

// unstable_cache needs Next's incremental cache, which only exists inside a
// real Next server. Identity is enough here: these tests cover what
// getArticleBySlug returns or throws, and Next itself guarantees a thrown
// result is never stored (see tmp-audit/incident-step1-article-cache.md).
// Each call is recorded, so the count tests can assert on the cache options
// and on whether the cached function itself rejected.
const cacheCalls = vi.hoisted(() => [] as Array<{ keyParts: string[]; options: unknown; args: unknown[]; result: unknown }>)
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown, keyParts: string[], options: unknown) =>
    (...args: unknown[]) => {
      const result = fn(...args)
      cacheCalls.push({ keyParts, options, args, result })
      return result
    },
}))

// Minimal fake query builder: every chained call before the final one
// returns the same object so the chain keeps going, and records what it
// was called with; the final call in each real query below (`.contains`)
// resolves the whole chain, mirroring how the real Supabase client's
// query builder is itself a thenable.
function fakeCountClient(result: { count: number | null; error: unknown }) {
  const calls: { method: string; args: unknown[] }[] = []
  const builder = {
    from:     (...args: unknown[]) => { calls.push({ method: 'from', args }); return builder },
    select:   (...args: unknown[]) => { calls.push({ method: 'select', args }); return builder },
    eq:       (...args: unknown[]) => { calls.push({ method: 'eq', args }); return builder },
    contains: (...args: unknown[]) => { calls.push({ method: 'contains', args }); return Promise.resolve(result) },
  }
  return { client: builder, calls }
}

// Each test starts with no remembered values (lib/cache-guard.ts).
afterEach(() => {
  vi.clearAllMocks()
  resetCacheGuard()
})

describe('getPublishedArticleCount', () => {
  it('returns the real count for the requested host', async () => {
    const { client } = fakeCountClient({ count: 2017, error: null })
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    expect(await getPublishedArticleCount('ab')).toBe(2017)
  })

  it('filters by the given site code, not a fixed one', async () => {
    const { client, calls } = fakeCountClient({ count: 0, error: null })
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    await getPublishedArticleCount('et')

    const containsCall = calls.find(c => c.method === 'contains')
    expect(containsCall?.args).toEqual(['show_on_sites', ['et']])
  })

  it('returns 0 on a query error rather than throwing', async () => {
    const { client } = fakeCountClient({ count: null, error: new Error('connection refused') })
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    expect(await getPublishedArticleCount('ab')).toBe(0)
  })

  it('returns 0 rather than null when the query succeeds with no count', async () => {
    const { client } = fakeCountClient({ count: null, error: null })
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    expect(await getPublishedArticleCount('ab')).toBe(0)
  })
})

describe('getQuestionSetCount', () => {
  it('always filters show_on_sites for "ab", regardless of host — practice-questions itself has no per-host split yet', async () => {
    const { client, calls } = fakeCountClient({ count: 181, error: null })
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    const result = await getQuestionSetCount()

    expect(result).toBe(181)
    const containsCall = calls.find(c => c.method === 'contains')
    expect(containsCall?.args).toEqual(['show_on_sites', ['ab']])
  })
})

describe('getPublishedQuestionCount', () => {
  it('returns the real individual-question count', async () => {
    const { client } = fakeCountClient({ count: 24531, error: null })
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    expect(await getPublishedQuestionCount()).toBe(24531)
  })

  it('filters through the parent question_sets row, not a status/show_on_sites column on questions itself', async () => {
    const { client, calls } = fakeCountClient({ count: 0, error: null })
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    await getPublishedQuestionCount()

    const eqCall = calls.find(c => c.method === 'eq')
    const containsCall = calls.find(c => c.method === 'contains')
    expect(eqCall?.args).toEqual(['question_sets.status', 'published'])
    expect(containsCall?.args).toEqual(['question_sets.show_on_sites', ['ab']])
  })

  it('returns 0 on a query error rather than throwing', async () => {
    const { client } = fakeCountClient({ count: null, error: new Error('connection refused') })
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    expect(await getPublishedQuestionCount()).toBe(0)
  })

  it('returns 0 rather than null when the query succeeds with no count', async () => {
    const { client } = fakeCountClient({ count: null, error: null })
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    expect(await getPublishedQuestionCount()).toBe(0)
  })
})

describe('count caching', () => {
  const cases: Array<[string, () => Promise<number>, unknown[], string]> = [
    ['getPublishedArticleCount', () => getPublishedArticleCount('et'), ['et'], 'articles'],
    ['getPublishedQuestionCount', () => getPublishedQuestionCount(), [], 'questions'],
    ['getQuestionSetCount', () => getQuestionSetCount(), [], 'questions'],
  ]

  it.each(cases)('%s caches a real count for an hour, keyed on its inputs', async (name, run, args, domain) => {
    cacheCalls.length = 0
    const { client } = fakeCountClient({ count: 42, error: null })
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    expect(await run()).toBe(42)
    expect(cacheCalls[0].keyParts).toEqual([name])
    expect(cacheCalls[0].args).toEqual(args)
    expect(cacheCalls[0].options).toEqual({ revalidate: 3600, tags: ['counts', domain] })
  })

  // Rejecting inside the cached function is what keeps the result out of the
  // cache; the caller still gets today's fallback of 0.
  it.each(cases)('%s throws inside the cache and returns 0 outside it', async (_name, run) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const result of [{ count: null, error: { message: '' } }, { count: null, error: null }]) {
      resetCacheGuard()
      cacheCalls.length = 0
      const { client } = fakeCountClient(result)
      vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

      expect(await run()).toBe(0)
      await expect(cacheCalls[0].result).rejects.toThrow()
    }
  })

  it('getCategoryCounts keys each category separately, so one failure stays 0 for that category only', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    cacheCalls.length = 0
    let call = 0
    const builder = {
      from: () => builder,
      select: () => builder,
      eq: () => builder,
      contains: () => Promise.resolve(++call === 2 ? { count: null, error: { message: '' } } : { count: 7, error: null }),
    }
    vi.mocked(createClient).mockReturnValue(builder as unknown as ReturnType<typeof createClient>)

    const counts = await getCategoryCounts()

    expect(counts['financial-accounting']).toBe(7)
    expect(counts['financial-management']).toBe(0)
    expect(counts['tools-templates']).toBe(7)
    expect(cacheCalls.map(c => c.args[0])).toContain('taxation')
    expect(cacheCalls[0].keyParts).toEqual(['getCategoryCounts'])
    expect(cacheCalls[0].options).toEqual({ revalidate: 3600, tags: ['counts', 'articles'] })
    await expect(cacheCalls[1].result).rejects.toThrow()
  })
})

// getArticleBySlug's chain ends in .single(), which resolves with the
// { data, error, status } shape postgrest-js returns.
function fakeArticleClient(result: { data: unknown; error: unknown; status: number }) {
  const builder = {
    from:   () => builder,
    select: () => builder,
    eq:     () => builder,
    single: () => Promise.resolve(result),
  }
  return builder
}

describe('getArticleBySlug', () => {
  it('returns the article when it exists', async () => {
    const article = { id: '1', slug: 'fixed-costs', title: 'Fixed costs', content: '<p>x</p>' }
    vi.mocked(createClient).mockReturnValue(
      fakeArticleClient({ data: article, error: null, status: 200 }) as unknown as ReturnType<typeof createClient>
    )

    expect(await getArticleBySlug('fixed-costs')).toEqual(article)
  })

  it('returns null for a genuine not-found (406 + PGRST116)', async () => {
    vi.mocked(createClient).mockReturnValue(
      fakeArticleClient({
        data: null,
        error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
        status: 406,
      }) as unknown as ReturnType<typeof createClient>
    )

    expect(await getArticleBySlug('no-such-article')).toBeNull()
  })

  it.each([503, 504])('throws on a %i from the API gateway instead of returning null', async (status) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(createClient).mockReturnValue(
      fakeArticleClient({ data: null, error: { message: 'upstream request timeout' }, status }) as unknown as ReturnType<typeof createClient>
    )

    await expect(getArticleBySlug('fixed-costs')).rejects.toThrow(`status ${status}`)
  })

  it('throws on a network error (status 0)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(createClient).mockReturnValue(
      fakeArticleClient({
        data: null,
        error: { message: 'TypeError: fetch failed', code: '' },
        status: 0,
      }) as unknown as ReturnType<typeof createClient>
    )

    await expect(getArticleBySlug('fixed-costs')).rejects.toThrow('status 0')
  })

  it('throws, not returns null, when a PGRST116 arrives with a non-406 status', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(createClient).mockReturnValue(
      fakeArticleClient({ data: null, error: { code: 'PGRST116', message: 'x' }, status: 500 }) as unknown as ReturnType<typeof createClient>
    )

    await expect(getArticleBySlug('fixed-costs')).rejects.toThrow()
  })
})
