import { describe, it, expect, vi, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { getArticleBySlug, getCategoryCounts, getPagesSitemapContent, getPublishedArticleCount, getPublishedQuestionCount, getQuestionSetCount } from './db'
import { resetCacheGuard } from './cache-guard'
import { reportServerError } from '@/lib/report-error'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

// Reports are recorded, not sent (no Sentry is set up in tests either way).
vi.mock('@/lib/report-error', () => ({
  reportServerError: vi.fn(),
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

// Fake client for the pages sitemap: each from(table) starts its own query,
// records its calls, and resolves to that table's result.
function fakeSitemapClient(results: Record<string, { data: unknown; error: unknown }>) {
  const queries: { table: string; calls: { method: string; args: unknown[] }[] }[] = []
  const client = {
    from: (table: string) => {
      const query = { table, calls: [] as { method: string; args: unknown[] }[] }
      queries.push(query)
      const builder = {
        select: (...args: unknown[]) => { query.calls.push({ method: 'select', args }); return builder },
        eq:     (...args: unknown[]) => { query.calls.push({ method: 'eq', args }); return builder },
        contains: (...args: unknown[]) => { query.calls.push({ method: 'contains', args }); return builder },
        in:     (...args: unknown[]) => { query.calls.push({ method: 'in', args }); return builder },
        then:   (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve(results[table]).then(resolve, reject),
      }
      return builder
    },
  }
  vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)
  return queries
}

describe('getPagesSitemapContent', () => {
  const ARTICLE = { slug: 'fixed-costs', updated_at: '2026-10-01T00:00:00Z', category: 'cost', canonical_owner: null, show_on_sites: ['ab'] }
  const QUESTION_SET = { slug: 'variance-quiz', updated_at: '2026-10-02T00:00:00Z' }
  const ok = (data: unknown) => ({ data, error: null })
  const failed = { data: null, error: { message: 'database detail', code: '57014' } }

  it('reads published AB articles and question sets with the same columns and filters as before', async () => {
    const queries = fakeSitemapClient({ articles: ok([ARTICLE]), question_sets: ok([QUESTION_SET]), courses: ok([]) })

    expect(await getPagesSitemapContent()).toStrictEqual({ ok: true, articles: [ARTICLE], questionSets: [QUESTION_SET], courses: [] })
    expect(queries.slice(0, 2)).toStrictEqual([
      {
        table: 'articles',
        calls: [
          { method: 'select', args: ['slug, updated_at, category, canonical_owner, show_on_sites'] },
          { method: 'eq', args: ['status', 'published'] },
          { method: 'eq', args: ['platform', 'ab'] },
        ],
      },
      {
        table: 'question_sets',
        calls: [
          { method: 'select', args: ['slug, updated_at'] },
          { method: 'eq', args: ['status', 'published'] },
          { method: 'eq', args: ['platform', 'ab'] },
        ],
      },
    ])
    expect(reportServerError).not.toHaveBeenCalled()
  })

  const COURSE = { slug: 'costing', updated_at: '2026-10-03T00:00:00Z', canonical_owner: 'accountingbody', show_on_sites: ['ab', 'et'] }

  it('reads published courses shown on AB only, flat, and each lesson inside a chapter of its own course (VF-2)', async () => {
    const queries = fakeSitemapClient({
      articles: ok([]), question_sets: ok([]),
      courses: ok([{ id: 'c1', ...COURSE }, { id: 'c2', ...COURSE, slug: 'tax' }]),
      course_chapters: ok([{ id: 'ch1', course_id: 'c1' }, { id: 'ch2', course_id: 'c2' }]),
      course_lessons: ok([
        { slug: 'intro', course_id: 'c1', chapter_id: 'ch1' },
        { slug: 'intro', course_id: 'c1', chapter_id: 'ch1' },
        { slug: null, course_id: 'c1', chapter_id: 'ch1' },
        { slug: 'lost', course_id: 'c1', chapter_id: 'ch2' },
        { slug: 'no-chapter', course_id: 'c1', chapter_id: 'gone' },
        { slug: 'vat', course_id: 'c2', chapter_id: 'ch2' },
      ]),
    })

    expect(await getPagesSitemapContent()).toStrictEqual({
      ok: true, articles: [], questionSets: [],
      courses: [{ ...COURSE, lessonSlugs: ['intro'] }, { ...COURSE, slug: 'tax', lessonSlugs: ['vat'] }],
    })
    // The status filter is what keeps a draft course (and so its lessons) out of the sitemap.
    expect(queries.slice(2)).toStrictEqual([
      {
        table: 'courses',
        calls: [
          { method: 'select', args: ['id, slug, updated_at, canonical_owner, show_on_sites'] },
          { method: 'eq', args: ['status', 'published'] },
          { method: 'contains', args: ['show_on_sites', ['ab']] },
        ],
      },
      { table: 'course_chapters', calls: [{ method: 'select', args: ['id, course_id'] }, { method: 'in', args: ['course_id', ['c1', 'c2']] }] },
      { table: 'course_lessons', calls: [{ method: 'select', args: ['slug, course_id, chapter_id'] }, { method: 'in', args: ['course_id', ['c1', 'c2']] }] },
    ])
    expect(reportServerError).not.toHaveBeenCalled()
  })

  it('treats real empty lists as a good result', async () => {
    fakeSitemapClient({ articles: ok([]), question_sets: ok([]), courses: ok([]) })
    expect(await getPagesSitemapContent()).toStrictEqual({ ok: true, articles: [], questionSets: [], courses: [] })
    expect(reportServerError).not.toHaveBeenCalled()
  })

  const COURSES_OK = { courses: ok([{ id: 'c1', ...COURSE }]), course_chapters: ok([]), course_lessons: ok([]) }

  it.each([
    ['articles', { articles: failed, question_sets: ok([QUESTION_SET]) }],
    ['question sets', { articles: ok([ARTICLE]), question_sets: failed }],
    ['courses', { articles: ok([ARTICLE]), question_sets: ok([QUESTION_SET]), ...COURSES_OK, courses: failed }],
    ['course chapters', { articles: ok([ARTICLE]), question_sets: ok([QUESTION_SET]), ...COURSES_OK, course_chapters: failed }],
    ['course lessons', { articles: ok([ARTICLE]), question_sets: ok([QUESTION_SET]), ...COURSES_OK, course_lessons: failed }],
  ] as [string, Record<string, { data: unknown; error: unknown }>][])('fails, logs the short code only and reports once when the %s read fails', async (_name, results) => {
    fakeSitemapClient(results)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await getPagesSitemapContent()).toStrictEqual({ ok: false })
    expect(log.mock.calls).toStrictEqual([['getPagesSitemapContent error:', '57014']])
    expect(reportServerError).toHaveBeenCalledTimes(1)
    const [label, error, extra] = vi.mocked(reportServerError).mock.calls[0]
    expect(label).toBe('sitemap pages read failed')
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe('sitemap pages read failed')
    expect((error as Error & { code?: string }).code).toBe('57014')
    expect(extra).toStrictEqual({ area: 'public' })
  })

  it.each([
    ['articles', { articles: ok(null), question_sets: ok([QUESTION_SET]) }],
    ['question sets', { articles: ok([ARTICLE]), question_sets: ok(null) }],
    ['courses', { articles: ok([ARTICLE]), question_sets: ok([QUESTION_SET]), ...COURSES_OK, courses: ok(null) }],
    ['course chapters', { articles: ok([ARTICLE]), question_sets: ok([QUESTION_SET]), ...COURSES_OK, course_chapters: ok(null) }],
    ['course lessons', { articles: ok([ARTICLE]), question_sets: ok([QUESTION_SET]), ...COURSES_OK, course_lessons: ok(null) }],
  ] as [string, Record<string, { data: unknown; error: unknown }>][])('fails and reports once when the %s read returns no data', async (_name, results) => {
    fakeSitemapClient(results)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await getPagesSitemapContent()).toStrictEqual({ ok: false })
    expect(reportServerError).toHaveBeenCalledTimes(1)
    expect(vi.mocked(reportServerError).mock.calls[0][0]).toBe('sitemap pages read failed')
  })
})
