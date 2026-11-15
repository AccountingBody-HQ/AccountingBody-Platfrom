import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getQuestionSets } from './db'
import { resetCacheGuard } from './cache-guard'

// The practice questions list page reads its page of question sets with this
// reader. A failed read must be thrown, so the page fails for that request
// instead of showing a list page that says there are no question sets.

type Result = { data: unknown; error: unknown; count: number | null; status: number }
type Call = [method: string, ...args: unknown[]]

// The database client factory is replaced by a recorder in the style of
// lib/question-reads.test.ts: every chain method returns the builder and
// awaiting it gives the scripted answer. It records the context asked for,
// the table and each chain call.
const fake = vi.hoisted(() => ({
  result: { data: [], error: null, count: 0, status: 200 } as { data: unknown; error: unknown; count: number | null; status: number },
  contexts: [] as string[],
  tables: [] as string[],
  calls: [] as Array<[method: string, ...args: unknown[]]>,
}))

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: (context: string) => {
    fake.contexts.push(context)
    return {
      from: (table: string) => {
        fake.tables.push(table)
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
    }
  },
}))
// Same reasons as lib/db.test.ts and lib/question-reads.test.ts: no real
// React cache() or Next incremental cache outside a Next server.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}))

function use(result: Result) {
  fake.result = result
  return fake
}

const thrownBy = async (run: () => Promise<unknown>) =>
  run().then(() => null, (error: unknown) => error as Error & { code?: string })

const message = (status: number) => `getQuestionSets: question_sets query failed (status ${status})`

const SEED = /seed detail|seed-person|seed hint|seed-search|seed-difficulty|seed-category|seed-sort/
const DB_PROBLEM = { code: 'XX000', message: 'seed detail seed-person@example.com', details: 'seed detail of the row', hint: 'seed hint' }

// Distinctive caller inputs: none of them may appear in a thrown message.
const INPUTS = {
  difficulty: 'seed-difficulty-4e7a',
  search: 'seed-search-91c2',
  category: 'seed-category-b305',
  page: 7919,
  perPage: 6133,
  sortBy: 'seed-sort-d8f1',
}

const SELECT: Call = ['select', 'id, title, slug, excerpt, difficulty, topic, exam_body, question_type, published_at', { count: 'exact' }]
const PUBLISHED: Call = ['eq', 'status', 'published']
const ON_AB: Call = ['contains', 'show_on_sites', ['ab']]
const BY_TITLE: Call = ['order', 'title', { ascending: true }]
const BY_NEWEST: Call = ['order', 'published_at', { ascending: false }]

const SET_ROWS = [
  { id: 's2', title: 'Zebra set', slug: 'zebra-set', excerpt: 'Z', difficulty: 'advanced', topic: 'Tax', exam_body: ['ACCA'], question_type: 'mcq', published_at: '2026-01-03T00:00:00Z' },
  { id: 's1', title: 'Alpha set', slug: 'alpha-set', excerpt: 'A', difficulty: 'beginner', topic: 'Audit', exam_body: ['CIMA'], question_type: 'scenario', published_at: '2026-01-01T00:00:00Z' },
  { id: 's3', title: 'Middle set', slug: 'middle-set', excerpt: 'M', difficulty: 'intermediate', topic: 'Law', exam_body: [], question_type: 'mcq', published_at: '2026-01-02T00:00:00Z' },
]

beforeEach(() => {
  fake.result = { data: [], error: null, count: 0, status: 200 }
  fake.contexts.length = 0
  fake.tables.length = 0
  fake.calls.length = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  resetCacheGuard()
})

describe('getQuestionSets: a failed read is thrown, not shown as an empty list', () => {
  it('a database error rejects with exactly the fixed message and carries the short code', async () => {
    use({ data: null, error: DB_PROBLEM, count: null, status: 500 })
    const thrown = await thrownBy(() => getQuestionSets({}))
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe(message(500))
    expect(thrown?.message).toBe('getQuestionSets: question_sets query failed (status 500)')
    expect(thrown?.code).toBe('XX000')
  })

  it.each([
    ['a 503 from the gateway', { data: null, error: { code: '', message: 'Service Unavailable' }, count: null, status: 503 }],
    ['a network failure or aborted request (status 0)', { data: null, error: { code: '', message: 'TypeError: fetch failed' }, count: null, status: 0 }],
    ['a statement time-out', { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' }, count: null, status: 500 }],
  ] as Array<[string, Result]>)('%s rejects with the fixed message and its status', async (_name, result) => {
    use(result)
    const thrown = await thrownBy(() => getQuestionSets({}))
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe(message(result.status))
  })

  it('an error that arrives together with rows and a count is still thrown', async () => {
    use({ data: SET_ROWS, error: DB_PROBLEM, count: 3, status: 500 })
    const thrown = await thrownBy(() => getQuestionSets({}))
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe(message(500))
  })

  it('an error that arrives with a count but no rows is still thrown', async () => {
    use({ data: null, error: DB_PROBLEM, count: 181, status: 500 })
    const thrown = await thrownBy(() => getQuestionSets({}))
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe(message(500))
  })

  it('a failed read never resolves to the empty list', async () => {
    use({ data: null, error: DB_PROBLEM, count: null, status: 500 })
    await expect(getQuestionSets({})).rejects.toThrow(message(500))
  })

  it('a safe short code such as a time-out code is kept', async () => {
    use({ data: null, error: { ...DB_PROBLEM, code: '57014' }, count: null, status: 500 })
    const thrown = await thrownBy(() => getQuestionSets({}))
    expect(thrown?.message).toBe(message(500))
    expect(thrown?.code).toBe('57014')
  })

  it.each([
    ['is not safe-shaped', 'seed person@example.com'],
    ['is not a string', 57014],
    ['is empty', ''],
  ] as Array<[string, unknown]>)('a code that %s is left off and the message is unchanged', async (_name, code) => {
    use({ data: null, error: { ...DB_PROBLEM, code }, count: null, status: 500 })
    const thrown = await thrownBy(() => getQuestionSets({}))
    expect(thrown?.message).toBe(message(500))
    expect(thrown?.code).toBeUndefined()
    expect(thrown && 'code' in thrown).toBe(false)
  })

  it('a missing code is left off too', async () => {
    use({ data: null, error: { message: 'seed detail' }, count: null, status: 500 })
    const thrown = await thrownBy(() => getQuestionSets({}))
    expect(thrown?.message).toBe(message(500))
    expect(thrown && 'code' in thrown).toBe(false)
  })

  it('the thrown error carries none of the database text and none of the caller inputs', async () => {
    use({ data: null, error: DB_PROBLEM, count: null, status: 500 })
    const thrown = await thrownBy(() => getQuestionSets(INPUTS))
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe(message(500))
    expect(thrown?.message).not.toMatch(SEED)
    expect(thrown?.message).not.toContain(DB_PROBLEM.message)
    expect(thrown?.message).not.toContain(DB_PROBLEM.details)
    expect(thrown?.message).not.toContain(DB_PROBLEM.hint)
    expect(thrown?.message).not.toContain(INPUTS.search)
    expect(thrown?.message).not.toContain(INPUTS.difficulty)
    expect(thrown?.message).not.toContain(INPUTS.category)
    expect(thrown?.message).not.toContain(INPUTS.sortBy)
    expect(thrown?.message).not.toContain(String(INPUTS.page))
    expect(thrown?.message).not.toContain(String(INPUTS.perPage))
    expect(JSON.stringify([thrown?.message, thrown?.stack, thrown?.code, thrown?.cause ?? null])).not.toMatch(SEED)
    expect(Object.keys(thrown ?? {}).sort()).toStrictEqual(['code'])
  })

  it('the message is the same whatever the caller asked for', async () => {
    use({ data: null, error: DB_PROBLEM, count: null, status: 500 })
    const plain = await thrownBy(() => getQuestionSets({}))
    const filtered = await thrownBy(() => getQuestionSets(INPUTS))
    expect(filtered?.message).toBe(plain?.message)
  })
})

describe('getQuestionSets: answers that are not failures', () => {
  it('a normal result is returned unchanged, in the order given, with its total', async () => {
    use({ data: SET_ROWS, error: null, count: 181, status: 200 })
    const copy = JSON.parse(JSON.stringify(SET_ROWS))
    const result = await getQuestionSets({})
    expect(result.sets).toBe(SET_ROWS)
    expect(result).toStrictEqual({ sets: copy, total: 181 })
    expect(result.sets.map((row) => row.id)).toStrictEqual(['s2', 's1', 's3'])
  })

  it('rows with no count give total 0', async () => {
    use({ data: SET_ROWS, error: null, count: null, status: 200 })
    const result = await getQuestionSets({})
    expect(result.sets).toBe(SET_ROWS)
    expect(result.total).toBe(0)
  })

  it('no data and no error stays an empty list with total 0', async () => {
    use({ data: null, error: null, count: null, status: 204 })
    expect(await getQuestionSets({})).toStrictEqual({ sets: [], total: 0 })
  })

  it('no data and no error stays total 0 even if a count arrives', async () => {
    use({ data: null, error: null, count: 181, status: 200 })
    expect(await getQuestionSets({})).toStrictEqual({ sets: [], total: 0 })
  })

  it('a genuine empty result resolves to an empty list with total 0', async () => {
    use({ data: [], error: null, count: 0, status: 200 })
    expect(await getQuestionSets({})).toStrictEqual({ sets: [], total: 0 })
  })

  it('an empty page keeps the count it was given (a page past the end)', async () => {
    use({ data: [], error: null, count: 181, status: 200 })
    expect(await getQuestionSets({ page: 99 })).toStrictEqual({ sets: [], total: 181 })
  })

  it('an empty page with no count gives total 0', async () => {
    use({ data: [], error: null, count: null, status: 200 })
    expect(await getQuestionSets({})).toStrictEqual({ sets: [], total: 0 })
  })
})

describe('getQuestionSets: the query and its context', () => {
  it('the defaults read published AB sets by title, first 12 rows', async () => {
    await getQuestionSets({})
    expect(fake.tables).toStrictEqual(['question_sets'])
    expect(fake.calls).toStrictEqual([SELECT, PUBLISHED, ON_AB, BY_TITLE, ['range', 0, 11]])
  })

  it('a later page with its own page size asks for that range', async () => {
    await getQuestionSets({ page: 3, perPage: 24 })
    expect(fake.calls).toStrictEqual([SELECT, PUBLISHED, ON_AB, BY_TITLE, ['range', 48, 71]])
  })

  it('a later page with the default page size asks for that range', async () => {
    await getQuestionSets({ page: 2 })
    expect(fake.calls).toStrictEqual([SELECT, PUBLISHED, ON_AB, BY_TITLE, ['range', 12, 23]])
  })

  it('a difficulty adds its filter only', async () => {
    await getQuestionSets({ difficulty: 'advanced' })
    expect(fake.calls).toStrictEqual([SELECT, PUBLISHED, ON_AB, ['eq', 'difficulty', 'advanced'], BY_TITLE, ['range', 0, 11]])
  })

  it('a search adds its title filter only', async () => {
    await getQuestionSets({ search: 'ledger' })
    expect(fake.calls).toStrictEqual([SELECT, PUBLISHED, ON_AB, ['ilike', 'title', '%ledger%'], BY_TITLE, ['range', 0, 11]])
  })

  it('difficulty and search together add both filters, in that order', async () => {
    await getQuestionSets({ difficulty: 'beginner', search: 'ledger' })
    expect(fake.calls).toStrictEqual([
      SELECT, PUBLISHED, ON_AB, ['eq', 'difficulty', 'beginner'], ['ilike', 'title', '%ledger%'], BY_TITLE, ['range', 0, 11],
    ])
  })

  it('an empty difficulty or search adds no filter', async () => {
    await getQuestionSets({ difficulty: '', search: '' })
    expect(fake.calls).toStrictEqual([SELECT, PUBLISHED, ON_AB, BY_TITLE, ['range', 0, 11]])
  })

  it('a category adds no filter', async () => {
    await getQuestionSets({ category: INPUTS.category })
    expect(fake.calls).toStrictEqual([SELECT, PUBLISHED, ON_AB, BY_TITLE, ['range', 0, 11]])
  })

  it('newest sorts by publish date, newest first', async () => {
    await getQuestionSets({ sortBy: 'newest' })
    expect(fake.calls).toStrictEqual([SELECT, PUBLISHED, ON_AB, BY_NEWEST, ['range', 0, 11]])
  })

  it.each(['alpha', 'something-else'])('sort value %s sorts by title', async (sortBy) => {
    await getQuestionSets({ sortBy })
    expect(fake.calls).toStrictEqual([SELECT, PUBLISHED, ON_AB, BY_TITLE, ['range', 0, 11]])
  })

  it('the whole chain is applied before a failure is thrown', async () => {
    use({ data: null, error: DB_PROBLEM, count: null, status: 500 })
    const thrown = await thrownBy(() => getQuestionSets({ difficulty: 'advanced', search: 'ledger', page: 2, sortBy: 'newest' }))
    expect(thrown?.message).toBe(message(500))
    expect(fake.tables).toStrictEqual(['question_sets'])
    expect(fake.calls).toStrictEqual([
      SELECT, PUBLISHED, ON_AB, ['eq', 'difficulty', 'advanced'], ['ilike', 'title', '%ledger%'], BY_NEWEST, ['range', 12, 23],
    ])
  })

  it('asks for the public read context, on a healthy read and on a failed one', async () => {
    await getQuestionSets({})
    expect(fake.contexts).toStrictEqual(['publicRead'])
    use({ data: null, error: DB_PROBLEM, count: null, status: 500 })
    await thrownBy(() => getQuestionSets({}))
    expect(fake.contexts).toStrictEqual(['publicRead', 'publicRead'])
  })
})
