import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getQuestionsBySetId, getCasesBySetId } from './db'
import { resetCacheGuard } from './cache-guard'

// The practice question page reads a set's questions and its case exhibits
// with these two readers. A failed read must be thrown, so the page fails for
// that request instead of showing a quiz with no questions or no exhibits.

type Result = { data: unknown; error: unknown; status: number }
type Call = [method: string, ...args: unknown[]]

// The database client factory is replaced by a recorder in the style of
// lib/eticpa-module-read.test.ts: every chain method returns the builder and
// awaiting it gives the scripted answer. It records the context asked for,
// the table and each chain call.
const fake = vi.hoisted(() => ({
  result: { data: [], error: null, status: 200 } as { data: unknown; error: unknown; status: number },
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
        for (const m of ['select', 'eq', 'in', 'order', 'contains', 'limit']) {
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
// Same reasons as lib/db.test.ts and lib/eticpa-module-read.test.ts: no real
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

const SET_ID = 'seed-set-7c1d0b9e'
const SEED = /seed detail|seed-person|seed hint|seed-set/
const DB_PROBLEM = { code: 'XX000', message: 'seed detail seed-person@example.com', details: 'seed detail of the row', hint: 'seed hint' }

const QUESTION_ROWS = [
  { id: 'q2', set_id: SET_ID, question_order: 1, question_text: 'Second by id, first by order', options: ['A', 'B'], correct_answer: 'A' },
  { id: 'q1', set_id: SET_ID, question_order: 2, question_text: 'First by id, second by order', options: ['C', 'D'], correct_answer: 'D' },
  { id: 'q3', set_id: SET_ID, question_order: 3, question_text: 'Third', options: ['E', 'F'], correct_answer: 'E' },
]
const CASE_ROWS = [
  { id: 'c2', set_id: SET_ID, case_id: 'case-b', title: 'Exhibit B', exhibit_html: '<p>B</p>', created_at: '2026-01-01T00:00:00Z' },
  { id: 'c1', set_id: SET_ID, case_id: 'case-a', title: 'Exhibit A', exhibit_html: '<p>A</p>', created_at: '2026-01-02T00:00:00Z' },
]

type Reader = {
  name: string
  read: (setId: string) => Promise<unknown[]>
  table: string
  message: (status: number) => string
  order: Call
  rows: unknown[]
}

const READERS: Reader[] = [
  {
    name: 'getQuestionsBySetId',
    read: getQuestionsBySetId,
    table: 'questions',
    message: (status) => `getQuestionsBySetId: questions query failed (status ${status})`,
    order: ['order', 'question_order', { ascending: true }],
    rows: QUESTION_ROWS,
  },
  {
    name: 'getCasesBySetId',
    read: getCasesBySetId,
    table: 'question_cases',
    message: (status) => `getCasesBySetId: question_cases query failed (status ${status})`,
    order: ['order', 'created_at', { ascending: true }],
    rows: CASE_ROWS,
  },
]

beforeEach(() => {
  fake.result = { data: [], error: null, status: 200 }
  fake.contexts.length = 0
  fake.tables.length = 0
  fake.calls.length = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  resetCacheGuard()
})

describe.each(READERS)('$name: a failed read is thrown, not shown as an empty quiz', ({ read, message }) => {
  it('a database error rejects with exactly the fixed message and carries the short code', async () => {
    use({ data: null, error: DB_PROBLEM, status: 500 })
    const thrown = await thrownBy(() => read(SET_ID))
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe(message(500))
    expect(thrown?.code).toBe('XX000')
  })

  it.each([
    ['a 503 from the gateway', { data: null, error: { code: '', message: 'Service Unavailable' }, status: 503 }],
    ['a network failure or aborted request (status 0)', { data: null, error: { code: '', message: 'TypeError: fetch failed' }, status: 0 }],
    ['a statement time-out', { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' }, status: 500 }],
  ] as Array<[string, Result]>)('%s rejects with the fixed message and its status', async (_name, result) => {
    use(result)
    const thrown = await thrownBy(() => read(SET_ID))
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe(message(result.status))
  })

  it('an error that arrives together with rows is still thrown', async () => {
    use({ data: [{ id: 'x' }], error: DB_PROBLEM, status: 500 })
    const thrown = await thrownBy(() => read(SET_ID))
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe(message(500))
  })

  it('a safe short code such as a time-out code is kept', async () => {
    use({ data: null, error: { ...DB_PROBLEM, code: '57014' }, status: 500 })
    const thrown = await thrownBy(() => read(SET_ID))
    expect(thrown?.message).toBe(message(500))
    expect(thrown?.code).toBe('57014')
  })

  it.each([
    ['is not safe-shaped', 'seed person@example.com'],
    ['is not a string', 57014],
    ['is empty', ''],
  ] as Array<[string, unknown]>)('a code that %s is left off and the message is unchanged', async (_name, code) => {
    use({ data: null, error: { ...DB_PROBLEM, code }, status: 500 })
    const thrown = await thrownBy(() => read(SET_ID))
    expect(thrown?.message).toBe(message(500))
    expect(thrown?.code).toBeUndefined()
    expect(thrown && 'code' in thrown).toBe(false)
  })

  it('a missing code is left off too', async () => {
    use({ data: null, error: { message: 'seed detail' }, status: 500 })
    const thrown = await thrownBy(() => read(SET_ID))
    expect(thrown?.message).toBe(message(500))
    expect(thrown && 'code' in thrown).toBe(false)
  })

  it('the thrown error carries none of the database text and not the set id', async () => {
    use({ data: null, error: DB_PROBLEM, status: 500 })
    const thrown = await thrownBy(() => read(SET_ID))
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).not.toMatch(SEED)
    expect(thrown?.message).not.toContain(SET_ID)
    expect(thrown?.message).not.toContain(DB_PROBLEM.message)
    expect(thrown?.message).not.toContain(DB_PROBLEM.details)
    expect(thrown?.message).not.toContain(DB_PROBLEM.hint)
    expect(JSON.stringify([thrown?.message, thrown?.stack, thrown?.code, thrown?.cause ?? null])).not.toMatch(SEED)
    expect(Object.keys(thrown ?? {}).sort()).toStrictEqual(['code'])
  })
})

describe.each(READERS)('$name: answers that are not failures', ({ read, rows }) => {
  it('a normal result is returned unchanged and in the order given', async () => {
    use({ data: rows, error: null, status: 200 })
    const copy = JSON.parse(JSON.stringify(rows))
    const result = await read(SET_ID)
    expect(result).toBe(rows)
    expect(result).toStrictEqual(copy)
    expect(result.map((row) => (row as { id: string }).id)).toStrictEqual(copy.map((row: { id: string }) => row.id))
  })

  it('no data and no error stays an empty list', async () => {
    use({ data: null, error: null, status: 204 })
    expect(await read(SET_ID)).toStrictEqual([])
  })

  it('a genuine empty result resolves to an empty list', async () => {
    use({ data: [], error: null, status: 200 })
    expect(await read(SET_ID)).toStrictEqual([])
  })
})

describe.each(READERS)('$name: the query and its context', ({ read, table, order, message }) => {
  it.each([SET_ID, 'another-set-id'])('set %s is read from the right table, by set id, in order', async (setId) => {
    use({ data: [], error: null, status: 200 })
    await read(setId)
    expect(fake.tables).toStrictEqual([table])
    expect(fake.calls).toStrictEqual([['select', '*'], ['eq', 'set_id', setId], order])
  })

  it('the whole chain is applied before a failure is thrown', async () => {
    use({ data: null, error: DB_PROBLEM, status: 500 })
    const thrown = await thrownBy(() => read(SET_ID))
    expect(thrown?.message).toBe(message(500))
    expect(fake.tables).toStrictEqual([table])
    expect(fake.calls).toStrictEqual([['select', '*'], ['eq', 'set_id', SET_ID], order])
  })

  it('asks for the public read context, on a healthy read and on a failed one', async () => {
    use({ data: [], error: null, status: 200 })
    await read(SET_ID)
    expect(fake.contexts).toStrictEqual(['publicRead'])
    use({ data: null, error: DB_PROBLEM, status: 500 })
    await thrownBy(() => read(SET_ID))
    expect(fake.contexts).toStrictEqual(['publicRead', 'publicRead'])
  })
})
