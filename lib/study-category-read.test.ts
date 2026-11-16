import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { getArticlesByCategory } from './db'
import { resetCacheGuard } from './cache-guard'

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))
// Same reasons as lib/db.test.ts and lib/not-found-readers.test.ts: no real
// React cache() or Next incremental cache outside a Next server.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}))

type Result = { data: unknown; error: unknown; status: number }
type Call = [method: string, ...args: unknown[]]

// A fake client in the style of lib/not-found-readers.test.ts: every chain
// method returns the builder and awaiting it gives the scripted answer. It
// also records the table and each chain call, so a test can see which
// filters the reader applied.
function use(result: Result) {
  const tables: string[] = []
  const calls: Call[] = []
  const client = {
    from: (table: string) => {
      tables.push(table)
      const builder: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'order', 'contains', 'limit']) {
        builder[m] = (...args: unknown[]) => {
          calls.push([m, ...args])
          return builder
        }
      }
      builder.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej)
      return builder
    },
  }
  vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)
  return { tables, calls }
}

const thrownBy = async (run: () => Promise<unknown>) =>
  run().then(() => null, (error: unknown) => error as Error & { code?: string })

const SEED = /seed detail|seed-person/
const DB_PROBLEM = { code: 'XX000', message: 'seed detail seed-person@example.com', details: 'seed detail', hint: null }
const ROWS = [
  { id: 'a1', title: 'Accruals', slug: 'accruals', excerpt: 'Seed excerpt', category: 'financial-accounting', category_title: 'Financial Accounting', exam_body: ['acca'], read_time: 4, published_at: '2026-01-02T00:00:00Z', author_name: 'Seed Author' },
  { id: 'a2', title: 'Budgets', slug: 'budgets', category: 'financial-accounting', exam_body: ['acca', 'cima'] },
]

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  resetCacheGuard()
})

describe('getArticlesByCategory: a failed read is thrown, not shown as an empty category', () => {
  it('a database error rejects with exactly the fixed message and carries the short code', async () => {
    use({ data: null, error: DB_PROBLEM, status: 500 })
    const thrown = await thrownBy(() => getArticlesByCategory('acca'))
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe('getArticlesByCategory: articles query failed (status 500)')
    expect(thrown?.code).toBe('XX000')
    expect(JSON.stringify([thrown?.message, thrown?.stack])).not.toMatch(SEED)
  })

  it.each([
    ['a 503 from the gateway', { data: null, error: { code: '', message: 'Service Unavailable' }, status: 503 }],
    ['a network failure or aborted request (status 0)', { data: null, error: { code: '', message: 'TypeError: fetch failed' }, status: 0 }],
    ['a statement time-out', { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' }, status: 500 }],
  ] as Array<[string, Result]>)('%s rejects with the fixed message and its status', async (_name, result) => {
    use(result)
    const thrown = await thrownBy(() => getArticlesByCategory('financial-accounting'))
    expect(thrown?.message).toBe(`getArticlesByCategory: articles query failed (status ${result.status})`)
  })

  it('an error that arrives together with rows is still thrown', async () => {
    use({ data: ROWS, error: DB_PROBLEM, status: 500 })
    const thrown = await thrownBy(() => getArticlesByCategory('acca'))
    expect(thrown?.message).toBe('getArticlesByCategory: articles query failed (status 500)')
  })

  it('a code that is not a plain short code is left off and the message is unchanged', async () => {
    use({ data: null, error: { ...DB_PROBLEM, code: 'seed person@example.com' }, status: 500 })
    const thrown = await thrownBy(() => getArticlesByCategory('acca'))
    expect(thrown?.message).toBe('getArticlesByCategory: articles query failed (status 500)')
    expect(thrown?.code).toBeUndefined()
    expect(thrown && 'code' in thrown).toBe(false)
  })

  it('a missing code is left off too', async () => {
    use({ data: null, error: { message: 'seed detail' }, status: 500 })
    const thrown = await thrownBy(() => getArticlesByCategory('acca'))
    expect(thrown?.message).toBe('getArticlesByCategory: articles query failed (status 500)')
    expect(thrown && 'code' in thrown).toBe(false)
  })
})

describe('getArticlesByCategory: answers that are not failures', () => {
  it('a genuine empty result resolves to an empty list', async () => {
    use({ data: [], error: null, status: 200 })
    expect(await getArticlesByCategory('acca')).toStrictEqual([])
  })

  it('no data and no error stays an empty list', async () => {
    use({ data: null, error: null, status: 204 })
    expect(await getArticlesByCategory('acca')).toStrictEqual([])
  })

  it('a normal result is returned unchanged', async () => {
    use({ data: ROWS, error: null, status: 200 })
    const articles = await getArticlesByCategory('acca')
    expect(articles).toStrictEqual(ROWS)
    expect(articles).not.toBe(ROWS)
    expect(articles).toStrictEqual([
      { id: 'a1', title: 'Accruals', slug: 'accruals', excerpt: 'Seed excerpt', category: 'financial-accounting', category_title: 'Financial Accounting', exam_body: ['acca'], read_time: 4, published_at: '2026-01-02T00:00:00Z', author_name: 'Seed Author' },
      { id: 'a2', title: 'Budgets', slug: 'budgets', category: 'financial-accounting', exam_body: ['acca', 'cima'] },
    ])
  })
})

describe('getArticlesByCategory: each branch of the query still applies its filter', () => {
  const sharedCalls: Call[] = [
    ['select', 'id, title, slug, excerpt, category, category_title, exam_body, read_time, published_at, author_name'],
    ['eq', 'status', 'published'],
    ['contains', 'show_on_sites', ['ab']],
    ['order', 'title', { ascending: true }],
  ]

  // The four study pages built ahead of time, plus the EthioTax
  // qualifications, all take the exam-body branch.
  it.each(['acca', 'cima', 'aat', 'icaew', 'eticpa', 'eticpa-atq', 'eticpa-cpa'])('%s is read by exam body', async (slug) => {
    const { tables, calls } = use({ data: ROWS, error: null, status: 200 })
    await getArticlesByCategory(slug)
    expect(tables).toStrictEqual(['articles'])
    expect(calls).toStrictEqual([...sharedCalls, ['contains', 'exam_body', [slug]], ['limit', 3000]])
  })

  it('a qualification slug in capitals is read by exam body in lower case', async () => {
    const { calls } = use({ data: ROWS, error: null, status: 200 })
    await getArticlesByCategory('ACCA')
    expect(calls).toContainEqual(['contains', 'exam_body', ['acca']])
    expect(calls.some(([method, column]) => method === 'eq' && column === 'category')).toBe(false)
  })

  it('any other slug is read by category', async () => {
    const { tables, calls } = use({ data: ROWS, error: null, status: 200 })
    await getArticlesByCategory('financial-accounting')
    expect(tables).toStrictEqual(['articles'])
    expect(calls).toStrictEqual([...sharedCalls, ['eq', 'category', 'financial-accounting'], ['limit', 3000]])
    expect(calls.some(([method, column]) => method === 'contains' && column === 'exam_body')).toBe(false)
  })

  it.each(['acca', 'financial-accounting'])('%s: the filter is applied before a failure is thrown', async (slug) => {
    const { calls } = use({ data: null, error: DB_PROBLEM, status: 500 })
    const thrown = await thrownBy(() => getArticlesByCategory(slug))
    expect(thrown?.message).toBe('getArticlesByCategory: articles query failed (status 500)')
    expect(calls).toHaveLength(6)
  })
})
