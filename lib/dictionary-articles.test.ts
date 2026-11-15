import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getServerSupabase } from './supabase-server'
import { getDictionaryArticlesByLetter, getDictionaryArticlesByCategory } from './dictionary-articles'

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
      for (const m of ['select', 'eq', 'in', 'or', 'gte', 'lt', 'order', 'contains', 'limit']) {
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
  {
    id: 'a1',
    title: 'Accruals',
    slug: 'accruals',
    excerpt: 'Seed excerpt',
    category: 'financial-accounting',
    category_title: 'Financial Accounting',
    published_at: '2026-01-02T00:00:00Z',
  },
  { id: 'a2', title: 'Budgets', slug: 'budgets' },
]

const COLUMNS = 'id, title, slug, excerpt, category, category_title, published_at'
const DIGITS =
  'title.ilike.0%,title.ilike.1%,title.ilike.2%,title.ilike.3%,title.ilike.4%,' +
  'title.ilike.5%,title.ilike.6%,title.ilike.7%,title.ilike.8%,title.ilike.9%'

// The two readers share every rule except the filter, so the shared rules are
// checked once for each.
const READERS: Array<[name: string, run: () => Promise<unknown>]> = [
  ['getDictionaryArticlesByLetter', () => getDictionaryArticlesByLetter('b')],
  ['getDictionaryArticlesByCategory', () => getDictionaryArticlesByCategory('financial-accounting')],
]

beforeEach(() => {
  vi.mocked(getServerSupabase).mockReset()
})

describe.each(READERS)('%s: a failed read is thrown, not shown as an empty list', (name, run) => {
  it('a database error rejects with exactly the fixed message and carries the short code', async () => {
    use({ data: null, error: DB_PROBLEM, status: 500 })
    const thrown = await thrownBy(run)
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe(`${name}: articles query failed (status 500)`)
    expect(thrown?.code).toBe('XX000')
    expect(JSON.stringify([thrown?.message, thrown?.stack])).not.toMatch(SEED)
  })

  it('a code that is not a plain short code is left off and the message is unchanged', async () => {
    use({ data: null, error: { ...DB_PROBLEM, code: 'seed person@example.com' }, status: 500 })
    const thrown = await thrownBy(run)
    expect(thrown?.message).toBe(`${name}: articles query failed (status 500)`)
    expect(thrown?.code).toBeUndefined()
    expect(thrown && 'code' in thrown).toBe(false)
  })

  it('a missing code is left off too', async () => {
    use({ data: null, error: { message: 'seed detail' }, status: 500 })
    const thrown = await thrownBy(run)
    expect(thrown?.message).toBe(`${name}: articles query failed (status 500)`)
    expect(thrown && 'code' in thrown).toBe(false)
  })

  it.each([
    ['a 503 from the gateway', { data: null, error: { code: '', message: 'Service Unavailable' }, status: 503 }],
    ['a network failure or the time limit (status 0)', { data: null, error: { code: '', message: 'TypeError: fetch failed' }, status: 0 }],
  ] as Array<[string, Result]>)('%s rejects with the fixed message and its status', async (_name, result) => {
    use(result)
    const thrown = await thrownBy(run)
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe(`${name}: articles query failed (status ${result.status})`)
  })

  it('an error that arrives together with rows is still thrown', async () => {
    use({ data: ROWS, error: DB_PROBLEM, status: 500 })
    const thrown = await thrownBy(run)
    expect(thrown?.message).toBe(`${name}: articles query failed (status 500)`)
  })
})

describe('the two fixed messages, written out', () => {
  it('the letter reader names itself', async () => {
    use({ data: null, error: DB_PROBLEM, status: 500 })
    const thrown = await thrownBy(() => getDictionaryArticlesByLetter('#'))
    expect(thrown?.message).toBe('getDictionaryArticlesByLetter: articles query failed (status 500)')
  })

  it('the category reader names itself', async () => {
    use({ data: null, error: DB_PROBLEM, status: 500 })
    const thrown = await thrownBy(() => getDictionaryArticlesByCategory('tax'))
    expect(thrown?.message).toBe('getDictionaryArticlesByCategory: articles query failed (status 500)')
  })
})

describe.each(READERS)('%s: answers that are not failures', (_name, run) => {
  it('a genuine empty result resolves to an empty list (an empty letter or category)', async () => {
    use({ data: [], error: null, status: 200 })
    expect(await run()).toStrictEqual([])
  })

  it('no data and no error stays an empty list', async () => {
    use({ data: null, error: null, status: 204 })
    expect(await run()).toStrictEqual([])
  })

  it('a normal result is returned unchanged', async () => {
    use({ data: ROWS, error: null, status: 200 })
    const articles = await run()
    expect(articles).toBe(ROWS)
    expect(articles).toStrictEqual([
      {
        id: 'a1',
        title: 'Accruals',
        slug: 'accruals',
        excerpt: 'Seed excerpt',
        category: 'financial-accounting',
        category_title: 'Financial Accounting',
        published_at: '2026-01-02T00:00:00Z',
      },
      { id: 'a2', title: 'Budgets', slug: 'budgets' },
    ])
  })

  it('the client is asked for once, with the public read limit', async () => {
    const { contexts } = use({ data: [], error: null, status: 200 })
    await run()
    expect(contexts).toStrictEqual(['publicRead'])
  })
})

describe('getDictionaryArticlesByLetter: the query it builds', () => {
  it("'#' reads the titles that start with a digit: one or() of exactly the ten digit parts", async () => {
    const { tables, calls } = use({ data: ROWS, error: null, status: 200 })
    await getDictionaryArticlesByLetter('#')
    expect(tables).toStrictEqual(['articles'])
    expect(calls).toStrictEqual([
      ['select', COLUMNS],
      ['eq', 'status', 'published'],
      ['contains', 'show_on_sites', ['ab']],
      ['or', DIGITS],
      ['order', 'title', { ascending: true }],
      ['limit', 5000],
    ])
    expect(DIGITS.split(',')).toStrictEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => `title.ilike.${d}%`))
  })

  it.each([
    ['b', 'B', 'C'],
    ['B', 'B', 'C'],
    ['A', 'A', 'B'],
    ['Z', 'Z', '['],
  ])('%s reads from that capital letter up to, not including, the next character', async (letter, from, before) => {
    const { tables, calls } = use({ data: ROWS, error: null, status: 200 })
    await getDictionaryArticlesByLetter(letter)
    expect(tables).toStrictEqual(['articles'])
    expect(calls).toStrictEqual([
      ['select', COLUMNS],
      ['eq', 'status', 'published'],
      ['contains', 'show_on_sites', ['ab']],
      ['gte', 'title', from],
      ['lt', 'title', before],
      ['order', 'title', { ascending: true }],
      ['limit', 5000],
    ])
  })

  it('the whole query is applied before a failure is thrown', async () => {
    const { tables, calls } = use({ data: null, error: DB_PROBLEM, status: 500 })
    await thrownBy(() => getDictionaryArticlesByLetter('b'))
    expect(tables).toStrictEqual(['articles'])
    expect(calls).toHaveLength(7)
  })
})

describe('getDictionaryArticlesByCategory: the query it builds', () => {
  it('one read of the published terms in that category, A to Z, at most 5000', async () => {
    const { tables, calls } = use({ data: ROWS, error: null, status: 200 })
    await getDictionaryArticlesByCategory('financial-accounting')
    expect(tables).toStrictEqual(['articles'])
    expect(calls).toStrictEqual([
      ['select', COLUMNS],
      ['eq', 'status', 'published'],
      ['contains', 'show_on_sites', ['ab']],
      ['eq', 'category', 'financial-accounting'],
      ['order', 'title', { ascending: true }],
      ['limit', 5000],
    ])
  })

  it('the whole query is applied before a failure is thrown', async () => {
    const { tables, calls } = use({ data: null, error: DB_PROBLEM, status: 500 })
    await thrownBy(() => getDictionaryArticlesByCategory('tax'))
    expect(tables).toStrictEqual(['articles'])
    expect(calls).toHaveLength(6)
  })
})
