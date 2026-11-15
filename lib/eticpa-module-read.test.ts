import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { getETICPAModuleArticles } from './db'
import { resetCacheGuard } from './cache-guard'

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))
// Same reasons as lib/db.test.ts and lib/study-category-read.test.ts: no real
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

// A fake client in the style of lib/study-category-read.test.ts: every chain
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
  { id: 'a1', title: 'Business Communication', slug: 'business-communication', excerpt: 'Seed excerpt', category: 'business-skills', category_title: 'Business Skills', exam_body: ['eticpa-atq'], read_time: 4, published_at: '2026-01-02T00:00:00Z', author_name: 'Seed Author' },
  { id: 'a2', title: 'Workplace Ethics', slug: 'workplace-ethics', category: 'business-skills', exam_body: ['eticpa-atq'] },
]

const chainFor = (level: string, module: string): Call[] => [
  ['select', 'id, title, slug, excerpt, category, category_title, exam_body, read_time, published_at, author_name'],
  ['eq', 'status', 'published'],
  ['eq', 'eticpa_level', level],
  ['eq', 'eticpa_module', module],
  ['order', 'title', { ascending: true }],
  ['limit', 5000],
]

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  resetCacheGuard()
})

describe('getETICPAModuleArticles: a failed read is thrown, not shown as an empty module', () => {
  it('a database error rejects with exactly the fixed message and carries the short code', async () => {
    use({ data: null, error: DB_PROBLEM, status: 500 })
    const thrown = await thrownBy(() => getETICPAModuleArticles('level-1', 'business-skills'))
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe('getETICPAModuleArticles: articles query failed (status 500)')
    expect(thrown?.code).toBe('XX000')
    expect(JSON.stringify([thrown?.message, thrown?.stack])).not.toMatch(SEED)
  })

  it.each([
    ['a 503 from the gateway', { data: null, error: { code: '', message: 'Service Unavailable' }, status: 503 }],
    ['a network failure or aborted request (status 0)', { data: null, error: { code: '', message: 'TypeError: fetch failed' }, status: 0 }],
    ['a statement time-out', { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' }, status: 500 }],
  ] as Array<[string, Result]>)('%s rejects with the fixed message and its status', async (_name, result) => {
    use(result)
    const thrown = await thrownBy(() => getETICPAModuleArticles('level-2', 'ethiopian-taxation'))
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe(`getETICPAModuleArticles: articles query failed (status ${result.status})`)
  })

  it('an error that arrives together with rows is still thrown', async () => {
    use({ data: ROWS, error: DB_PROBLEM, status: 500 })
    const thrown = await thrownBy(() => getETICPAModuleArticles('level-1', 'business-skills'))
    expect(thrown?.message).toBe('getETICPAModuleArticles: articles query failed (status 500)')
  })

  it('a code that is not a plain short code is left off and the message is unchanged', async () => {
    use({ data: null, error: { ...DB_PROBLEM, code: 'seed person@example.com' }, status: 500 })
    const thrown = await thrownBy(() => getETICPAModuleArticles('level-1', 'business-skills'))
    expect(thrown?.message).toBe('getETICPAModuleArticles: articles query failed (status 500)')
    expect(thrown?.code).toBeUndefined()
    expect(thrown && 'code' in thrown).toBe(false)
  })

  it('a missing code is left off too', async () => {
    use({ data: null, error: { message: 'seed detail' }, status: 500 })
    const thrown = await thrownBy(() => getETICPAModuleArticles('level-1', 'business-skills'))
    expect(thrown?.message).toBe('getETICPAModuleArticles: articles query failed (status 500)')
    expect(thrown && 'code' in thrown).toBe(false)
  })
})

describe('getETICPAModuleArticles: answers that are not failures', () => {
  it('a genuine empty result resolves to an empty list', async () => {
    use({ data: [], error: null, status: 200 })
    expect(await getETICPAModuleArticles('level-1', 'business-skills')).toStrictEqual([])
  })

  it('no data and no error stays an empty list', async () => {
    use({ data: null, error: null, status: 204 })
    expect(await getETICPAModuleArticles('level-1', 'business-skills')).toStrictEqual([])
  })

  it('a normal result is returned unchanged', async () => {
    use({ data: ROWS, error: null, status: 200 })
    const articles = await getETICPAModuleArticles('level-1', 'business-skills')
    expect(articles).toBe(ROWS)
    expect(articles).toStrictEqual([
      { id: 'a1', title: 'Business Communication', slug: 'business-communication', excerpt: 'Seed excerpt', category: 'business-skills', category_title: 'Business Skills', exam_body: ['eticpa-atq'], read_time: 4, published_at: '2026-01-02T00:00:00Z', author_name: 'Seed Author' },
      { id: 'a2', title: 'Workplace Ethics', slug: 'workplace-ethics', category: 'business-skills', exam_body: ['eticpa-atq'] },
    ])
  })
})

describe('getETICPAModuleArticles: the query still applies every filter', () => {
  it.each([
    ['level-1', 'business-skills'],
    ['level-2', 'ethiopian-taxation'],
  ])('%s / %s reads published articles for exactly that level and module', async (level, module) => {
    const { tables, calls } = use({ data: ROWS, error: null, status: 200 })
    await getETICPAModuleArticles(level, module)
    expect(tables).toStrictEqual(['articles'])
    expect(calls).toStrictEqual(chainFor(level, module))
  })

  it.each([
    ['level-1', 'business-skills'],
    ['level-2', 'ethiopian-taxation'],
  ])('%s / %s: the whole chain is applied before a failure is thrown', async (level, module) => {
    const { tables, calls } = use({ data: null, error: DB_PROBLEM, status: 500 })
    const thrown = await thrownBy(() => getETICPAModuleArticles(level, module))
    expect(thrown?.message).toBe('getETICPAModuleArticles: articles query failed (status 500)')
    expect(tables).toStrictEqual(['articles'])
    expect(calls).toStrictEqual(chainFor(level, module))
  })
})
