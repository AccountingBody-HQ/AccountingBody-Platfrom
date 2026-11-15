import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getServerSupabase } from './supabase-server'
import { getPublishedArticlesForSite } from './articles-list'

vi.mock('./supabase-server', () => ({ getServerSupabase: vi.fn() }))

type Result = { data: unknown; error: unknown; status: number }
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
})

describe('getPublishedArticlesForSite: a failed read is thrown, not shown as an empty list', () => {
  it('a database error rejects with exactly the fixed message and carries the short code', async () => {
    use({ data: null, error: DB_PROBLEM, status: 500 })
    const thrown = await thrownBy(() => getPublishedArticlesForSite('ab'))
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe('getPublishedArticlesForSite: articles query failed (status 500)')
    expect(thrown?.code).toBe('XX000')
    expect(JSON.stringify([thrown?.message, thrown?.stack])).not.toMatch(SEED)
  })

  it('a code that is not a plain short code is left off and the message is unchanged', async () => {
    use({ data: null, error: { ...DB_PROBLEM, code: 'seed person@example.com' }, status: 500 })
    const thrown = await thrownBy(() => getPublishedArticlesForSite('ab'))
    expect(thrown?.message).toBe('getPublishedArticlesForSite: articles query failed (status 500)')
    expect(thrown?.code).toBeUndefined()
    expect(thrown && 'code' in thrown).toBe(false)
  })

  it('a missing code is left off too', async () => {
    use({ data: null, error: { message: 'seed detail' }, status: 500 })
    const thrown = await thrownBy(() => getPublishedArticlesForSite('et'))
    expect(thrown?.message).toBe('getPublishedArticlesForSite: articles query failed (status 500)')
    expect(thrown && 'code' in thrown).toBe(false)
  })

  it.each([
    ['a 503 from the gateway', { data: null, error: { code: '', message: 'Service Unavailable' }, status: 503 }],
    ['a network failure or the time limit (status 0)', { data: null, error: { code: '', message: 'TypeError: fetch failed' }, status: 0 }],
  ] as Array<[string, Result]>)('%s rejects with the fixed message and its status', async (_name, result) => {
    use(result)
    const thrown = await thrownBy(() => getPublishedArticlesForSite('ab'))
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe(`getPublishedArticlesForSite: articles query failed (status ${result.status})`)
  })

  it('an error that arrives together with rows is still thrown', async () => {
    use({ data: ROWS, error: DB_PROBLEM, status: 500 })
    const thrown = await thrownBy(() => getPublishedArticlesForSite('ab'))
    expect(thrown?.message).toBe('getPublishedArticlesForSite: articles query failed (status 500)')
  })
})

describe('getPublishedArticlesForSite: answers that are not failures', () => {
  it('a genuine empty result resolves to an empty list (the EthioTax view today)', async () => {
    use({ data: [], error: null, status: 200 })
    expect(await getPublishedArticlesForSite('et')).toStrictEqual([])
  })

  it('no data and no error stays an empty list', async () => {
    use({ data: null, error: null, status: 204 })
    expect(await getPublishedArticlesForSite('ab')).toStrictEqual([])
  })

  it('a normal result is returned unchanged', async () => {
    use({ data: ROWS, error: null, status: 200 })
    const articles = await getPublishedArticlesForSite('ab')
    expect(articles).toBe(ROWS)
    expect(articles).toStrictEqual([
      { id: 'a1', title: 'Accruals', slug: 'accruals', excerpt: 'Seed excerpt', category: 'financial-accounting', published_at: '2026-01-02T00:00:00Z' },
      { id: 'a2', title: 'Budgets', slug: 'budgets' },
    ])
  })
})

describe('getPublishedArticlesForSite: the query it builds', () => {
  it.each(['ab', 'et'] as const)('%s: one read of published articles for that site, newest first, at most 100', async (siteCode) => {
    const { tables, calls } = use({ data: ROWS, error: null, status: 200 })
    await getPublishedArticlesForSite(siteCode)
    expect(tables).toStrictEqual(['articles'])
    expect(calls).toStrictEqual([
      ['select', 'id, title, slug, excerpt, category, published_at'],
      ['eq', 'status', 'published'],
      ['contains', 'show_on_sites', [siteCode]],
      ['order', 'published_at', { ascending: false }],
      ['limit', 100],
    ])
  })

  it('the whole query is applied before a failure is thrown', async () => {
    const { tables, calls } = use({ data: null, error: DB_PROBLEM, status: 500 })
    await thrownBy(() => getPublishedArticlesForSite('ab'))
    expect(tables).toStrictEqual(['articles'])
    expect(calls).toHaveLength(5)
  })

  it.each(['ab', 'et'] as const)('%s: the client is asked for once, with the public read limit', async (siteCode) => {
    const { contexts } = use({ data: [], error: null, status: 200 })
    await getPublishedArticlesForSite(siteCode)
    expect(contexts).toStrictEqual(['publicRead'])
  })
})
