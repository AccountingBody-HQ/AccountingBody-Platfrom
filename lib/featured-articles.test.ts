import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getServerSupabase } from './supabase-server'
import { reportServerError } from './report-error'
import { getFeaturedArticlesForSite } from './featured-articles'

vi.mock('./supabase-server', () => ({ getServerSupabase: vi.fn() }))
vi.mock('./report-error', () => ({ reportServerError: vi.fn() }))

type Result = { data: unknown; error: unknown; status: number }
type Call = [method: string, ...args: unknown[]]

// A fake client in the style of lib/articles-list.test.ts: every chain method
// returns the builder and awaiting it gives the scripted answer.
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

const LABEL = 'home featured articles read failed'
const SEED = /seed detail|seed-person/
const DB_PROBLEM = { code: 'XX000', message: 'seed detail seed-person@example.com', details: 'seed detail', hint: null }
const ROWS = [
  { id: 'a1', title: 'Accruals', slug: 'accruals', excerpt: 'Seed excerpt', category: 'financial-accounting', published_at: '2026-01-02T00:00:00Z' },
  { id: 'a2', title: 'Budgets', slug: 'budgets', exam_body: ['ACCA'], read_time: 5 },
]

beforeEach(() => {
  vi.mocked(getServerSupabase).mockReset()
  vi.mocked(reportServerError).mockReset()
})

describe('getFeaturedArticlesForSite: answers that are not failures', () => {
  it('a normal result is returned unchanged and nothing is reported', async () => {
    use({ data: ROWS, error: null, status: 200 })
    const articles = await getFeaturedArticlesForSite('ab')
    expect(articles).toBe(ROWS)
    expect(reportServerError).not.toHaveBeenCalled()
  })

  it('a genuine empty result is an empty list and is not reported', async () => {
    use({ data: [], error: null, status: 200 })
    expect(await getFeaturedArticlesForSite('et')).toStrictEqual([])
    expect(reportServerError).not.toHaveBeenCalled()
  })

  it('no data and no error stays an empty list and is not reported', async () => {
    use({ data: null, error: null, status: 204 })
    expect(await getFeaturedArticlesForSite('ab')).toStrictEqual([])
    expect(reportServerError).not.toHaveBeenCalled()
  })
})

describe('getFeaturedArticlesForSite: a failed read is reported, never thrown', () => {
  it('a database error reports once with the fixed label and answers an empty list', async () => {
    use({ data: null, error: DB_PROBLEM, status: 500 })
    expect(await getFeaturedArticlesForSite('ab')).toStrictEqual([])
    expect(reportServerError).toHaveBeenCalledTimes(1)
    expect(reportServerError).toHaveBeenCalledWith(LABEL, DB_PROBLEM, { area: 'public' })
  })

  it('an error that arrives together with rows is still reported and no rows are shown', async () => {
    use({ data: ROWS, error: DB_PROBLEM, status: 500 })
    expect(await getFeaturedArticlesForSite('et')).toStrictEqual([])
    expect(reportServerError).toHaveBeenCalledTimes(1)
  })

  it('a thrown error reports once with the fixed label and answers an empty list', async () => {
    const boom = new Error('seed detail seed-person@example.com')
    vi.mocked(getServerSupabase).mockImplementation(() => { throw boom })
    expect(await getFeaturedArticlesForSite('ab')).toStrictEqual([])
    expect(reportServerError).toHaveBeenCalledTimes(1)
    expect(reportServerError).toHaveBeenCalledWith(LABEL, boom, { area: 'public' })
  })

  it.each([
    ['a database error', () => use({ data: null, error: DB_PROBLEM, status: 500 })],
    ['a thrown error', () => vi.mocked(getServerSupabase).mockImplementation(() => { throw new Error('seed detail') })],
  ] as Array<[string, () => void]>)('%s: the label never carries the raw message', async (_name, arrange) => {
    arrange()
    await getFeaturedArticlesForSite('ab')
    const [label, , extra] = vi.mocked(reportServerError).mock.calls[0]
    expect(label).toBe(LABEL)
    expect(label).not.toMatch(SEED)
    expect(JSON.stringify(extra)).not.toMatch(SEED)
  })
})

describe('getFeaturedArticlesForSite: the query it builds', () => {
  it.each(['ab', 'et'] as const)('%s: one public read of the four newest published articles for that site', async (siteCode) => {
    const { contexts, tables, calls } = use({ data: ROWS, error: null, status: 200 })
    await getFeaturedArticlesForSite(siteCode)
    expect(contexts).toStrictEqual(['publicRead'])
    expect(tables).toStrictEqual(['articles'])
    expect(calls).toStrictEqual([
      ['select', 'id, title, slug, excerpt, category, category_title, exam_body, read_time, published_at'],
      ['eq', 'status', 'published'],
      ['contains', 'show_on_sites', [siteCode]],
      ['order', 'published_at', { ascending: false }],
      ['limit', 4],
    ])
  })
})
