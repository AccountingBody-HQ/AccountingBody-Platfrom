import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { getArticlesByCategory } from './db'
import { resetCacheGuard, BACKOFF_MS, HOLD_MS } from './cache-guard'

// The study category list is cached for an hour, one entry per category.
// unstable_cache is mocked to RECORD its key parts, options, arguments and
// the promise the cached function returned (Next stores nothing when that
// promise rejects), then call straight through.
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

type Result = { data: unknown; error: unknown; status: number }

// Every chain method returns the builder; awaiting it gives the answer for
// the category the query filtered on, and counts one database read.
let answers: Record<string, Result> = {}
let queries = 0
function fakeClient() {
  let filter = ''
  const builder: Record<string, unknown> = {}
  for (const m of ['from', 'select', 'eq', 'order', 'limit']) builder[m] = (...args: unknown[]) => {
    if (m === 'eq' && args[0] === 'category') filter = String(args[1])
    return builder
  }
  builder.contains = (column: string, value: string[]) => {
    if (column === 'exam_body') filter = value[0]
    return builder
  }
  builder.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
    queries += 1
    return Promise.resolve(answers[filter]).then(res, rej)
  }
  return builder
}

const ACCA = [{ id: 'a1', title: 'Accruals', slug: 'accruals', exam_body: ['acca'] }]
const CIMA = [{ id: 'c1', title: 'Costing', slug: 'costing', exam_body: ['cima'] }]
const FAILED: Result = { data: null, error: { code: 'XX000', message: 'upstream failure' }, status: 500 }

beforeEach(() => {
  resetCacheGuard()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  vi.mocked(createClient).mockImplementation(() => fakeClient() as unknown as ReturnType<typeof createClient>)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  cacheCalls.length = 0
  queries = 0
  answers = {}
})

afterEach(() => {
  resetCacheGuard()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('getArticlesByCategory cache', () => {
  it('caches for an hour under its own key parts, with a per-category tag', async () => {
    answers.acca = { data: ACCA, error: null, status: 200 }
    await getArticlesByCategory('acca')
    expect(cacheCalls).toHaveLength(1)
    expect(cacheCalls[0].keyParts).toEqual(['articles-by-category', 'published', 'ab'])
    expect(cacheCalls[0].args).toEqual(['acca'])
    const options = cacheCalls[0].options as { revalidate: number; tags: string[] }
    expect(options.revalidate).toBe(3600)
    expect(options.tags).toContain('articles')
    expect(options.tags).toContain('articles-category:acca')
  })

  it('keeps two categories in separate entries that never return each other\'s rows', async () => {
    answers.acca = { data: ACCA, error: null, status: 200 }
    answers.cima = { data: CIMA, error: null, status: 200 }
    expect(await getArticlesByCategory('acca')).toStrictEqual(ACCA)
    expect(await getArticlesByCategory('cima')).toStrictEqual(CIMA)
    expect(await getArticlesByCategory('acca')).toStrictEqual(ACCA)
    expect(await getArticlesByCategory('cima')).toStrictEqual(CIMA)
    expect(queries).toBe(2)
    expect(cacheCalls.map(c => c.args)).toEqual([['acca'], ['cima']])
    expect((cacheCalls[1].options as { tags: string[] }).tags).toContain('articles-category:cima')
    expect((cacheCalls[1].options as { tags: string[] }).tags).not.toContain('articles-category:acca')
  })

  it('throws on a database error, stores nothing, and reads fresh rows later', async () => {
    answers.acca = FAILED
    await expect(getArticlesByCategory('acca')).rejects.toThrow('getArticlesByCategory: articles query failed (status 500)')
    await expect(cacheCalls[0].result).rejects.toThrow('getArticlesByCategory: articles query failed (status 500)')
    answers.acca = { data: ACCA, error: null, status: 200 }
    vi.advanceTimersByTime(Math.max(BACKOFF_MS, HOLD_MS))
    expect(await getArticlesByCategory('acca')).toStrictEqual(ACCA)
    expect(queries).toBe(2)
  })

  it('returns [] for a genuine empty result', async () => {
    answers.acca = { data: [], error: null, status: 200 }
    expect(await getArticlesByCategory('acca')).toStrictEqual([])
    await expect(cacheCalls[0].result).resolves.toStrictEqual([])
  })
})
