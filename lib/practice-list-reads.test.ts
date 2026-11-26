import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getQuestionSets, getPublicQuestionSets, getPublicQuestionSetDifficultyCounts, escapeLikeText } from './db'
import { resetCacheGuard } from './cache-guard'

// PQB-1 S1 (PQ-D3 #18, #20, #21; D351): the /practice-questions list reads.
// A page that starts after the last row is "no rows plus the exact total",
// never a failure; every other error is still thrown. The letter filter is a
// starts-with match with the user's text escaped; search stays "contains".
// The level filter's counts are three cached head counts.

type Result = { data: unknown; error: unknown; count: number | null; status: number }

// Each awaited query takes the next scripted answer (the last one repeats);
// every chain call is recorded per query.
const fake = vi.hoisted(() => ({
  results: [] as Result[],
  queries: [] as Array<Array<[string, ...unknown[]]>>,
  contexts: [] as string[],
  cacheCalls: [] as Array<{ keyParts: string[]; options: { revalidate?: number; tags?: string[] }; args: unknown[] }>,
  store: new Map<string, unknown>(),
}))

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: (context: string) => {
    fake.contexts.push(context)
    return {
      from: (table: string) => {
        const calls: Array<[string, ...unknown[]]> = [['from', table]]
        fake.queries.push(calls)
        const builder: Record<string, unknown> = {}
        for (const m of ['select', 'eq', 'in', 'order', 'contains', 'limit', 'ilike', 'range']) {
          builder[m] = (...args: unknown[]) => {
            calls.push([m, ...args])
            return builder
          }
        }
        builder.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
          const next = fake.results.length > 1 ? fake.results.shift()! : fake.results[0]
          return Promise.resolve(next).then(res, rej)
        }
        return builder
      },
    }
  },
}))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
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

const ROWS = [{ id: 'r1', title: 'Quality costs — Practice Questions', slug: 'quality-costs' }]
// What supabase-js returns for PostgREST's 416 (node_modules/@supabase/postgrest-js
// dist/index.cjs: a non-ok answer keeps status, parses the body as the error,
// count stays null).
const RANGE_PAST_END: Result = {
  data: null,
  error: { code: 'PGRST103', message: 'Requested range not satisfiable', details: 'An offset of 1176 was requested, but there are only 181 rows.', hint: null },
  count: null,
  status: 416,
}
const DB_PROBLEM: Result = { data: null, error: { code: 'XX000', message: 'seed detail' }, count: null, status: 500 }

const SELECT_LIST: [string, ...unknown[]] = ['select', 'id, title, slug, excerpt, difficulty, topic, exam_body, question_type, published_at', { count: 'exact' }]
const SELECT_HEAD: [string, ...unknown[]] = ['select', 'id', { count: 'exact', head: true }]
const PUBLISHED: [string, ...unknown[]] = ['eq', 'status', 'published']
const ON_AB: [string, ...unknown[]] = ['contains', 'show_on_sites', ['ab']]

const use = (...results: Result[]) => { fake.results = results }
const thrownBy = async (run: () => Promise<unknown>) =>
  run().then(() => null, (error: unknown) => error as Error & { code?: string })

beforeEach(() => {
  resetCacheGuard()
  fake.results = [{ data: ROWS, error: null, count: 181, status: 200 }]
  fake.queries = []
  fake.contexts = []
  fake.cacheCalls = []
  fake.store.clear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  resetCacheGuard()
})

describe('getQuestionSets: a page past the end', () => {
  it('a 416 / PGRST103 answer becomes no rows plus the exact total from a head count of the same filters', async () => {
    use(RANGE_PAST_END, { data: null, error: null, count: 181, status: 200 })
    expect(await getQuestionSets({ page: 99, difficulty: 'advanced', startsWith: 'Q' })).toStrictEqual({ sets: [], total: 181 })
    expect(fake.queries).toHaveLength(2)
    expect(fake.queries[0]).toContainEqual(['range', 1176, 1187])
    expect(fake.queries[1]).toStrictEqual([
      ['from', 'question_sets'], SELECT_HEAD, PUBLISHED, ON_AB, ['eq', 'difficulty', 'advanced'], ['ilike', 'title', 'Q%'],
    ])
    expect(fake.contexts).toStrictEqual(['publicRead'])
  })

  it.each([
    ['status 416 alone', { ...RANGE_PAST_END, error: { code: '', message: 'x' } }],
    ['code PGRST103 alone', { ...RANGE_PAST_END, status: 400 }],
  ] as Array<[string, Result]>)('%s is enough', async (_name, first) => {
    use(first, { data: null, error: null, count: 37, status: 200 })
    expect(await getQuestionSets({ page: 17 })).toStrictEqual({ sets: [], total: 37 })
  })

  it('the same answer on page 1 is not a page past the end: it is thrown', async () => {
    use(RANGE_PAST_END)
    const thrown = await thrownBy(() => getQuestionSets({ page: 1 }))
    expect(thrown?.message).toBe('getQuestionSets: question_sets query failed (status 416)')
    expect(fake.queries).toHaveLength(1)
  })

  it('a failed total read is thrown with a fixed message and the short code', async () => {
    use(RANGE_PAST_END, { data: null, error: { code: '57014', message: 'seed detail' }, count: null, status: 500 })
    const thrown = await thrownBy(() => getQuestionSets({ page: 99 }))
    expect(thrown?.message).toBe('getQuestionSets: question_sets count failed (status 500)')
    expect(thrown?.code).toBe('57014')
    expect(thrown?.message).not.toContain('seed')
  })

  it('a total read with no count is thrown, never shown as 0', async () => {
    use(RANGE_PAST_END, { data: null, error: null, count: null, status: 200 })
    const thrown = await thrownBy(() => getQuestionSets({ page: 99 }))
    expect(thrown?.message).toBe('getQuestionSets: question_sets count returned no count (status 200)')
  })

  it.each([
    ['a server error', DB_PROBLEM],
    ['a time-out', { ...DB_PROBLEM, error: { code: '57014', message: 'x' } }],
    ['a network failure', { ...DB_PROBLEM, error: { code: '', message: 'fetch failed' }, status: 0 }],
  ] as Array<[string, Result]>)('%s on a later page is still thrown, with no second read', async (_name, result) => {
    use(result)
    const thrown = await thrownBy(() => getQuestionSets({ page: 99 }))
    expect(thrown?.message).toBe(`getQuestionSets: question_sets query failed (status ${result.status})`)
    expect(fake.queries).toHaveLength(1)
  })

  it('through the public reader (cached path, page 17) the page past the end is a success with its total', async () => {
    use(RANGE_PAST_END, { data: null, error: null, count: 181, status: 200 })
    expect(await getPublicQuestionSets({ page: 17, perPage: 12, sortBy: 'alpha' })).toStrictEqual({ sets: [], total: 181 })
    expect(fake.cacheCalls.map((c) => c.args)).toStrictEqual([['', 17, 'alpha']])
  })
})

describe('getQuestionSets: the letter filter starts with the letter; search still contains', () => {
  it('startsWith asks for titles beginning with the text', async () => {
    await getQuestionSets({ startsWith: 'Q' })
    expect(fake.queries[0]).toStrictEqual([
      ['from', 'question_sets'], SELECT_LIST, PUBLISHED, ON_AB, ['ilike', 'title', 'Q%'], ['order', 'title', { ascending: true }], ['range', 0, 11],
    ])
  })

  it('search is unchanged: contains, no escaping', async () => {
    await getQuestionSets({ search: 'cost' })
    expect(fake.queries[0]).toContainEqual(['ilike', 'title', '%cost%'])
    expect(fake.queries[0].filter((c) => c[0] === 'ilike')).toHaveLength(1)
  })

  it.each([
    ['%', '\\%%'],
    ['_', '\\_%'],
    ['\\', '\\\\%'],
    ['a%b_c', 'a\\%b\\_c%'],
  ])('the text %s is matched literally (pattern %s)', async (text, pattern) => {
    await getQuestionSets({ startsWith: text })
    expect(fake.queries[0]).toContainEqual(['ilike', 'title', pattern])
  })

  it('escapeLikeText escapes only \\ % _', () => {
    expect(escapeLikeText('Q')).toBe('Q')
    expect(escapeLikeText('50%_off\\')).toBe('50\\%\\_off\\\\')
    expect(escapeLikeText('a*b(c),d')).toBe('a*b(c),d')
  })

  it('a letter is read fresh, never through the list cache', async () => {
    await getPublicQuestionSets({ startsWith: 'Q', page: 1, perPage: 12, sortBy: 'alpha' })
    expect(fake.cacheCalls).toStrictEqual([])
    expect(fake.queries[0]).toContainEqual(['ilike', 'title', 'Q%'])
  })
})

describe('getPublicQuestionSetDifficultyCounts', () => {
  it('three head counts of live AB sets, one per level, cached for an hour under the list tags', async () => {
    use({ data: null, error: null, count: 0, status: 200 }, { data: null, error: null, count: 9, status: 200 }, { data: null, error: null, count: 172, status: 200 })
    expect(await getPublicQuestionSetDifficultyCounts()).toStrictEqual({ beginner: 0, intermediate: 9, advanced: 172 })
    expect(fake.queries).toStrictEqual(['beginner', 'intermediate', 'advanced'].map((d) => [
      ['from', 'question_sets'], SELECT_HEAD, PUBLISHED, ON_AB, ['eq', 'difficulty', d],
    ]))
    expect(fake.cacheCalls).toStrictEqual([{
      keyParts: ['public-question-set-difficulty-counts'],
      options: { revalidate: 3600, tags: ['question-sets', 'question-sets-list'] },
      args: [],
    }])
    expect(fake.contexts).toStrictEqual(['publicRead'])
  })

  it('a failed count is thrown and nothing is stored', async () => {
    use(DB_PROBLEM)
    const thrown = await thrownBy(() => getPublicQuestionSetDifficultyCounts())
    expect(thrown?.message).toBe('question set difficulty count failed (status 500)')
    expect(fake.store.size).toBe(0)
  })

  it('a missing count is thrown, never read as 0', async () => {
    use({ data: null, error: null, count: null, status: 200 })
    const thrown = await thrownBy(() => getPublicQuestionSetDifficultyCounts())
    expect(thrown?.message).toBe('question set difficulty count returned no count (status 200)')
    expect(fake.store.size).toBe(0)
  })
})
