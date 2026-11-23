import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getServerSupabase } from './supabase-server'
import { reportServerError } from './report-error'
import { getFeaturedArticlesForSite } from './featured-articles'
import { getPublishedArticlesForSite } from './articles-list'
import { getCategoryCounts } from './db'
import { resetCacheGuard, BACKOFF_MS } from './cache-guard'

// Batch 8: the home featured-articles read and the /articles list read are
// cached for an hour per site through the cache guard, and the study
// category counts are read in parallel.

vi.mock('./supabase-server', () => ({ getServerSupabase: vi.fn() }))
vi.mock('./report-error', () => ({ reportServerError: vi.fn() }))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
// unstable_cache records its key parts, options and arguments and calls
// straight through, so each call reaches the fake database.
const cacheCalls = vi.hoisted(() => [] as Array<{ keyParts: string[]; options: unknown; args: unknown[] }>)
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>, keyParts: string[], options: unknown) =>
    (...args: unknown[]) => {
      cacheCalls.push({ keyParts, options, args })
      return fn(...args)
    },
}))

type Result = { data?: unknown; count?: number | null; error: unknown; status: number }

// Every awaited query takes the current answer; `queries` counts them.
let answer: Result
let queries = 0
function useClient() {
  const builder: Record<string, unknown> = {}
  for (const m of ['from', 'select', 'eq', 'contains', 'order', 'limit', 'range']) builder[m] = () => builder
  builder.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
    queries += 1
    return Promise.resolve({ data: null, count: null, ...answer }).then(res, rej)
  }
  vi.mocked(getServerSupabase).mockReturnValue(builder as unknown as ReturnType<typeof getServerSupabase>)
}

const DB_PROBLEM = { code: 'XX000', message: 'seed detail', details: 'seed detail', hint: null }
const ROWS = [{ id: 'a1', title: 'Accruals', slug: 'accruals' }, { id: 'a2', title: 'Budgets', slug: 'budgets' }]
const ok = (fields: { data?: unknown; count?: number | null }) => { answer = { error: null, status: 200, ...fields } }
const fail = () => { answer = { data: null, count: null, error: DB_PROBLEM, status: 500 } }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  vi.mocked(getServerSupabase).mockReset()
  vi.mocked(reportServerError).mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  resetCacheGuard()
  cacheCalls.length = 0
  queries = 0
  useClient()
})

afterEach(() => {
  resetCacheGuard()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('home featured articles (F1)', () => {
  it('uses its own key parts, one hour, and a per-site tag', async () => {
    ok({ data: ROWS })
    expect(await getFeaturedArticlesForSite('ab')).toStrictEqual(ROWS)
    expect(cacheCalls).toHaveLength(1)
    expect(cacheCalls[0].keyParts).toStrictEqual(['featured-articles', 'published'])
    expect(cacheCalls[0].args).toStrictEqual(['ab'])
    expect(cacheCalls[0].options).toStrictEqual({ revalidate: 3600, tags: ['articles', 'featured-articles:ab'] })
  })

  it('keeps the two sites apart', async () => {
    ok({ data: ROWS })
    await getFeaturedArticlesForSite('ab')
    ok({ data: [] })
    expect(await getFeaturedArticlesForSite('et')).toStrictEqual([])
    expect(queries).toBe(2)
    expect(cacheCalls[1].options).toStrictEqual({ revalidate: 3600, tags: ['articles', 'featured-articles:et'] })
    expect(await getFeaturedArticlesForSite('ab')).toStrictEqual(ROWS)
    expect(queries).toBe(2)
  })

  it('a failure is reported once with the same label, answers [], and is not stored', async () => {
    fail()
    expect(await getFeaturedArticlesForSite('ab')).toStrictEqual([])
    expect(reportServerError).toHaveBeenCalledTimes(1)
    expect(vi.mocked(reportServerError).mock.calls[0][0]).toBe('home featured articles read failed')
    expect(vi.mocked(reportServerError).mock.calls[0][2]).toStrictEqual({ area: 'public' })
    ok({ data: ROWS })
    vi.advanceTimersByTime(BACKOFF_MS)
    expect(await getFeaturedArticlesForSite('ab')).toStrictEqual(ROWS)
    expect(queries).toBe(2)
  })

  it('a genuine empty result is [] and is not reported', async () => {
    ok({ data: [] })
    expect(await getFeaturedArticlesForSite('ab')).toStrictEqual([])
    expect(reportServerError).not.toHaveBeenCalled()
  })
})

describe('/articles list (F2)', () => {
  const LIST = { articles: ROWS, total: 2, totalPages: 1 }

  it('uses its own key parts, the site and the page, one hour, and a per-site tag', async () => {
    ok({ data: ROWS, count: 2 })
    expect(await getPublishedArticlesForSite('ab', 1)).toStrictEqual(LIST)
    expect(cacheCalls).toHaveLength(1)
    expect(cacheCalls[0].keyParts).toStrictEqual(['published-articles-for-site'])
    expect(cacheCalls[0].args).toStrictEqual(['ab', 1])
    expect(cacheCalls[0].options).toStrictEqual({ revalidate: 3600, tags: ['articles', 'articles-list:ab'] })
  })

  it('keeps the two sites apart', async () => {
    ok({ data: ROWS, count: 2 })
    await getPublishedArticlesForSite('ab', 1)
    ok({ data: [], count: 0 })
    expect(await getPublishedArticlesForSite('et', 1)).toStrictEqual({ articles: [], total: 0, totalPages: 1 })
    expect(queries).toBe(2)
    expect(cacheCalls[1].options).toStrictEqual({ revalidate: 3600, tags: ['articles', 'articles-list:et'] })
    expect(await getPublishedArticlesForSite('ab', 1)).toStrictEqual(LIST)
    expect(queries).toBe(2)
  })

  it('keeps the pages apart: each page is its own entry, read once', async () => {
    ok({ data: ROWS, count: 120 })
    await getPublishedArticlesForSite('ab', 1)
    ok({ data: [ROWS[1]] })
    expect(await getPublishedArticlesForSite('ab', 2)).toStrictEqual({ articles: [ROWS[1]], total: 120, totalPages: 3 })
    ok({ data: [ROWS[0]] })
    expect((await getPublishedArticlesForSite('ab', 3))?.articles).toStrictEqual([ROWS[0]])
    expect((await getPublishedArticlesForSite('ab', 2))?.articles).toStrictEqual([ROWS[1]])
    expect((await getPublishedArticlesForSite('ab', 1))?.articles).toStrictEqual(ROWS)
    expect(cacheCalls.map((c) => c.args)).toStrictEqual([['ab', 1], ['ab', 2], ['ab', 3]])
    expect(await getPublishedArticlesForSite('ab', 4)).toBeNull()
    expect(queries).toBe(3)
  })

  it('a failure throws the same fixed text and is not stored', async () => {
    fail()
    await expect(getPublishedArticlesForSite('ab', 1)).rejects.toThrow('getPublishedArticlesForSite: articles query failed (status 500)')
    ok({ data: ROWS, count: 2 })
    vi.advanceTimersByTime(BACKOFF_MS)
    expect(await getPublishedArticlesForSite('ab', 1)).toStrictEqual(LIST)
    expect(queries).toBe(2)
  })

  it('a genuine empty result is an empty list', async () => {
    ok({ data: [], count: 0 })
    expect(await getPublishedArticlesForSite('et', 1)).toStrictEqual({ articles: [], total: 0, totalPages: 1 })
  })
})

describe('study category counts in parallel (F3)', () => {
  const CATEGORIES = [
    'financial-accounting', 'financial-management', 'management-accounting',
    'financial-market', 'business-management', 'audit-assurance',
    'taxation', 'economics', 'cryptocurrency', 'tools-templates',
  ]

  it('asks for all ten counts before any answer arrives', async () => {
    const waiting: Array<() => void> = []
    const builder: Record<string, unknown> = {}
    for (const m of ['from', 'select', 'eq', 'contains']) builder[m] = () => builder
    builder.then = (res: (v: unknown) => unknown) => {
      waiting.push(() => res({ count: 3, error: null, status: 200 }))
    }
    vi.mocked(getServerSupabase).mockReturnValue(builder as unknown as ReturnType<typeof getServerSupabase>)
    const counts = getCategoryCounts()
    await vi.advanceTimersByTimeAsync(0)
    expect(waiting).toHaveLength(10)
    for (const release of waiting) release()
    expect(Object.values(await counts)).toStrictEqual(Array(10).fill(3))
  })

  it('one failing category reads 0 with one report; the others keep their values; key order unchanged', async () => {
    let call = 0
    const builder: Record<string, unknown> = {}
    for (const m of ['from', 'select', 'eq', 'contains']) builder[m] = () => builder
    builder.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(++call === 3 ? { count: null, error: DB_PROBLEM, status: 500 } : { count: 5, error: null, status: 200 }).then(res, rej)
    vi.mocked(getServerSupabase).mockReturnValue(builder as unknown as ReturnType<typeof getServerSupabase>)
    const counts = await getCategoryCounts()
    expect(Object.keys(counts)).toStrictEqual(CATEGORIES)
    expect(counts['management-accounting']).toBe(0)
    expect(Object.values(counts).filter((n) => n === 5)).toHaveLength(9)
    expect(reportServerError).toHaveBeenCalledTimes(1)
    expect(reportServerError).toHaveBeenCalledWith('article category count read failed', expect.any(Error), { area: 'public' })
  })
})
