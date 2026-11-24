import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getServerSupabase } from './supabase-server'
import { getPublishedArticlesForSite } from './articles-list'
import { resetCacheGuard } from './cache-guard'

vi.mock('./supabase-server', () => ({ getServerSupabase: vi.fn() }))
// Same reasons as lib/study-category-read.test.ts: no real React cache() or
// Next incremental cache outside a Next server.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}))

type Result = { data: unknown; error: unknown; status: number; count?: number | null }
type Call = [method: string, ...args: unknown[]]

// A fake client in the style of lib/not-found-readers.test.ts: every chain
// method returns the builder and awaiting it gives the scripted answer. It
// also records the context asked for, the table and each chain call, so a
// test can see exactly which query the reader built.
function use(result: Result) {
  const contexts: unknown[] = []
  const tables: string[] = []
  const calls: Call[] = []
  const client = {
    from: (table: string) => {
      tables.push(table)
      const builder: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'order', 'contains', 'range']) {
        builder[m] = (...args: unknown[]) => {
          calls.push([m, ...args])
          return builder
        }
      }
      builder.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej)
      return builder
    },
  }
  vi.mocked(getServerSupabase).mockImplementation(((context: unknown) => {
    contexts.push(context)
    return client
  }) as unknown as typeof getServerSupabase)
  return { contexts, tables, calls }
}

const thrownBy = async (run: () => Promise<unknown>) =>
  run().then(() => null, (error: unknown) => error as Error & { code?: string })

const SEED = /seed detail|seed-person/
const DB_PROBLEM = { code: 'XX000', message: 'seed detail seed-person@example.com', details: 'seed detail', hint: null }
const ROWS = [
  { id: 'a1', title: 'Accruals', slug: 'accruals', excerpt: 'Seed excerpt', category: 'financial-accounting', published_at: '2026-01-02T00:00:00Z' },
  { id: 'a2', title: 'Budgets', slug: 'budgets' },
]

beforeEach(() => {
  vi.mocked(getServerSupabase).mockReset()
  resetCacheGuard()
})
afterEach(() => {
  resetCacheGuard()
})

describe('getPublishedArticlesForSite: a failed read is thrown, not shown as an empty list', () => {
  it('a database error rejects with exactly the fixed message and carries the short code', async () => {
    use({ data: null, error: DB_PROBLEM, status: 500 })
    const thrown = await thrownBy(() => getPublishedArticlesForSite('ab', 1))
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe('getPublishedArticlesForSite: articles query failed (status 500)')
    expect(thrown?.code).toBe('XX000')
    expect(JSON.stringify([thrown?.message, thrown?.stack])).not.toMatch(SEED)
  })

  it('a code that is not a plain short code is left off and the message is unchanged', async () => {
    use({ data: null, error: { ...DB_PROBLEM, code: 'seed person@example.com' }, status: 500 })
    const thrown = await thrownBy(() => getPublishedArticlesForSite('ab', 1))
    expect(thrown?.message).toBe('getPublishedArticlesForSite: articles query failed (status 500)')
    expect(thrown?.code).toBeUndefined()
    expect(thrown && 'code' in thrown).toBe(false)
  })

  it('a missing code is left off too', async () => {
    use({ data: null, error: { message: 'seed detail' }, status: 500 })
    const thrown = await thrownBy(() => getPublishedArticlesForSite('et', 1))
    expect(thrown?.message).toBe('getPublishedArticlesForSite: articles query failed (status 500)')
    expect(thrown && 'code' in thrown).toBe(false)
  })

  it.each([
    ['a 503 from the gateway', { data: null, error: { code: '', message: 'Service Unavailable' }, status: 503 }],
    ['a network failure or the time limit (status 0)', { data: null, error: { code: '', message: 'TypeError: fetch failed' }, status: 0 }],
  ] as Array<[string, Result]>)('%s rejects with the fixed message and its status', async (_name, result) => {
    use(result)
    const thrown = await thrownBy(() => getPublishedArticlesForSite('ab', 1))
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe(`getPublishedArticlesForSite: articles query failed (status ${result.status})`)
  })

  it('an error that arrives together with rows is still thrown', async () => {
    use({ data: ROWS, error: DB_PROBLEM, status: 500 })
    const thrown = await thrownBy(() => getPublishedArticlesForSite('ab', 1))
    expect(thrown?.message).toBe('getPublishedArticlesForSite: articles query failed (status 500)')
  })
})

describe('getPublishedArticlesForSite: answers that are not failures', () => {
  it('a genuine empty result resolves to an empty list (the EthioTax view today)', async () => {
    use({ data: [], error: null, status: 200, count: 0 })
    expect(await getPublishedArticlesForSite('et', 1)).toStrictEqual({ articles: [], total: 0, totalPages: 1 })
  })

  it.each([
    ['no data and no error', { data: null, error: null, status: 204, count: 0 }, 'getPublishedArticlesForSite: empty response'],
    ['no total', { data: ROWS, error: null, status: 200, count: null }, 'getPublishedArticlesForSite: no total'],
  ] as Array<[string, Result, string]>)('%s is a failure, never an empty list', async (_name, result, message) => {
    use(result)
    expect((await thrownBy(() => getPublishedArticlesForSite('ab', 1)))?.message).toBe(message)
  })

  it('a normal result is returned unchanged', async () => {
    use({ data: ROWS, error: null, status: 200, count: 2 })
    const list = await getPublishedArticlesForSite('ab', 1)
    expect(list).toStrictEqual({ articles: ROWS, total: 2, totalPages: 1 })
    expect(list?.articles).toStrictEqual([
      { id: 'a1', title: 'Accruals', slug: 'accruals', excerpt: 'Seed excerpt', category: 'financial-accounting', published_at: '2026-01-02T00:00:00Z' },
      { id: 'a2', title: 'Budgets', slug: 'budgets' },
    ])
  })
})

describe('getPublishedArticlesForSite: the query it builds', () => {
  it.each(['ab', 'et'] as const)('%s: one read of published articles for that site, newest first, the first 50 with the total', async (siteCode) => {
    const { tables, calls } = use({ data: ROWS, error: null, status: 200, count: 2 })
    await getPublishedArticlesForSite(siteCode, 1)
    expect(tables).toStrictEqual(['articles'])
    expect(calls).toStrictEqual([
      ['select', 'id, title, slug, excerpt, category, published_at', { count: 'exact' }],
      ['eq', 'status', 'published'],
      ['contains', 'show_on_sites', [siteCode]],
      ['order', 'published_at', { ascending: false }],
      ['order', 'id', { ascending: true }],
      ['range', 0, 49],
    ])
  })

  it.each([[2, 50, 99], [41, 2000, 2049]])('page %i reads rows %i to %i, same filter and order, without counting again', async (page, from, to) => {
    const { calls } = use({ data: ROWS, error: null, status: 200, count: 2017 })
    expect(await getPublishedArticlesForSite('et', page)).toStrictEqual({ articles: ROWS, total: 2017, totalPages: 41 })
    expect(calls.slice(6)).toStrictEqual([
      ['select', 'id, title, slug, excerpt, category, published_at', undefined],
      ['eq', 'status', 'published'],
      ['contains', 'show_on_sites', ['et']],
      ['order', 'published_at', { ascending: false }],
      ['order', 'id', { ascending: true }],
      ['range', from, to],
    ])
  })

  it.each([42, 1000, 1e20, Infinity])('a page above the last (%s) is null and is never read', async (page) => {
    const { calls } = use({ data: ROWS, error: null, status: 200, count: 2017 })
    expect(await getPublishedArticlesForSite('ab', page)).toBeNull()
    expect(calls).toHaveLength(6)
  })

  it('50 articles are one page and 51 are two', async () => {
    use({ data: ROWS, error: null, status: 200, count: 50 })
    expect((await getPublishedArticlesForSite('ab', 1))?.totalPages).toBe(1)
    resetCacheGuard()
    use({ data: ROWS, error: null, status: 200, count: 51 })
    expect((await getPublishedArticlesForSite('ab', 1))?.totalPages).toBe(2)
  })

  it('a later page with no rows (the list got shorter) is null; a later page that fails is thrown', async () => {
    const answers: Result[] = [
      { data: ROWS, error: null, status: 200, count: 2017 },
      { data: [], error: null, status: 200 },
      { data: null, error: DB_PROBLEM, status: 500 },
    ]
    const { calls } = use(answers[0])
    await getPublishedArticlesForSite('ab', 1)
    use(answers[1])
    expect(await getPublishedArticlesForSite('ab', 41)).toBeNull()
    use(answers[2])
    expect((await thrownBy(() => getPublishedArticlesForSite('ab', 40)))?.message)
      .toBe('getPublishedArticlesForSite: articles query failed (status 500)')
    expect(calls).toHaveLength(6)
  })

  it('the whole query is applied before a failure is thrown', async () => {
    const { tables, calls } = use({ data: null, error: DB_PROBLEM, status: 500 })
    await thrownBy(() => getPublishedArticlesForSite('ab', 1))
    expect(tables).toStrictEqual(['articles'])
    expect(calls).toHaveLength(6)
  })

  it.each(['ab', 'et'] as const)('%s: the client is asked for once, with the public read limit', async (siteCode) => {
    const { contexts } = use({ data: [], error: null, status: 200, count: 0 })
    await getPublishedArticlesForSite(siteCode, 1)
    expect(contexts).toStrictEqual(['publicRead'])
  })
})
