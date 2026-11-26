import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getPublicQuestionSets } from './db'
import { resetCacheGuard } from './cache-guard'

// The public /practice-questions list reads plain list pages through a
// one-hour cache; searches (including the letter filter), out-of-range
// pages, unknown difficulties and other page sizes read fresh. A failed read
// is thrown and never stored.

const fake = vi.hoisted(() => ({
  result: { data: [], error: null, count: 0, status: 200 } as { data: unknown; error: unknown; count: number | null; status: number },
  calls: [] as Array<[method: string, ...args: unknown[]]>,
  cacheCalls: [] as Array<{ keyParts: string[]; options: { revalidate?: number; tags?: string[] }; args: unknown[] }>,
  store: new Map<string, unknown>(),
}))

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: () => ({
    from: () => {
      const builder: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'order', 'contains', 'limit', 'ilike', 'range']) {
        builder[m] = (...args: unknown[]) => {
          fake.calls.push([m, ...args])
          return builder
        }
      }
      builder.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(fake.result).then(res, rej)
      return builder
    },
  }),
}))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
// A small stand-in for Next's data cache: records each use and stores only
// values that resolved, as unstable_cache does.
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>, keyParts: string[], options: { revalidate?: number; tags?: string[] }) =>
    async (...args: unknown[]) => {
      fake.cacheCalls.push({ keyParts, options, args })
      const key = JSON.stringify([keyParts, args])
      if (fake.store.has(key)) return fake.store.get(key)
      const value = await fn(...args)
      fake.store.set(key, value)
      return value
    },
  revalidateTag: () => undefined,
}))

const ROWS = [{ id: 'r1', title: 'Set one', slug: 'set-one' }]

beforeEach(() => {
  resetCacheGuard()
  fake.result = { data: ROWS, error: null, count: 37, status: 200 }
  fake.calls = []
  fake.cacheCalls = []
  fake.store.clear()
})

const base = { difficulty: undefined as string | undefined, search: undefined as string | undefined, page: 1, perPage: 12, sortBy: 'alpha' }

describe('getPublicQuestionSets', () => {
  it('reads a plain list page through the cache with the key, both tags and one hour', async () => {
    const out = await getPublicQuestionSets(base)
    expect(out).toEqual({ sets: ROWS, total: 37 })
    expect(fake.cacheCalls).toEqual([{
      keyParts: ['public-question-sets-list'],
      options: { revalidate: 3600, tags: ['question-sets', 'question-sets-list'] },
      args: ['', 1, 'alpha', ''],
    }])
    expect(fake.calls).toContainEqual(['range', 0, 11])
  })

  it('caches a known difficulty and page up to 20', async () => {
    await getPublicQuestionSets({ ...base, difficulty: 'beginner', page: 20, sortBy: 'newest' })
    expect(fake.cacheCalls.map((c) => c.args)).toEqual([['beginner', 20, 'newest', '']])
    expect(fake.calls).toContainEqual(['eq', 'difficulty', 'beginner'])
    expect(fake.calls).toContainEqual(['order', 'published_at', { ascending: false }])
  })

  it('reads fresh when a search is present', async () => {
    await getPublicQuestionSets({ ...base, search: 'cost' })
    expect(fake.cacheCalls).toEqual([])
    expect(fake.calls).toContainEqual(['ilike', 'title', '%cost%'])
  })

  it('reads fresh for the letter filter (passed as search)', async () => {
    await getPublicQuestionSets({ ...base, search: 'A' })
    expect(fake.cacheCalls).toEqual([])
  })

  it.each([21, 0, NaN, 1.5])('reads fresh for page %s', async (page) => {
    await getPublicQuestionSets({ ...base, page })
    expect(fake.cacheCalls).toEqual([])
  })

  it('reads fresh for an unknown difficulty', async () => {
    await getPublicQuestionSets({ ...base, difficulty: 'expert' })
    expect(fake.cacheCalls).toEqual([])
    expect(fake.calls).toContainEqual(['eq', 'difficulty', 'expert'])
  })

  it('reads fresh for another page size', async () => {
    await getPublicQuestionSets({ ...base, perPage: 50 })
    expect(fake.cacheCalls).toEqual([])
  })

  it("shares one key form for 'whatever' and 'alpha'", async () => {
    await getPublicQuestionSets({ ...base, sortBy: 'whatever' })
    resetCacheGuard()
    await getPublicQuestionSets({ ...base, sortBy: 'alpha' })
    resetCacheGuard()
    await getPublicQuestionSets({ ...base, sortBy: undefined as unknown as string })
    expect(fake.cacheCalls.map((c) => c.args)).toEqual([['', 1, 'alpha', ''], ['', 1, 'alpha', ''], ['', 1, 'alpha', '']])
  })

  it('throws a failed read and does not store it', async () => {
    fake.result = { data: null, error: { code: 'XX000', message: 'x' }, count: null, status: 500 }
    await expect(getPublicQuestionSets(base)).rejects.toThrow('getQuestionSets: question_sets query failed (status 500)')
    expect(fake.store.size).toBe(0)

    resetCacheGuard()
    fake.result = { data: ROWS, error: null, count: 37, status: 200 }
    await expect(getPublicQuestionSets(base)).resolves.toEqual({ sets: ROWS, total: 37 })
  })
})
