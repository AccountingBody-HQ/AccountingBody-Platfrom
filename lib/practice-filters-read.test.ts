import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type FakeDb, type Row } from '@/lib/test-helpers/fake-query'

// PQB-2 S1 (D351): one cached "practice filters" read for /practice-questions.
// GET + exact total in pages (the mock pool's readPaged), never head counts:
// the live AB sets (id, article_slug, difficulty), then the published articles
// of those slugs in chunks of 100. Levels are counted per set; a set belongs to
// a subject when its article is a published article of that category (the
// mock-pool rule). Any failed, short or changing read is thrown, never stored.

const state = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  contexts: [] as string[],
  store: new Map<string, unknown>(),
  cacheCalls: [] as Array<{ keyParts: string[]; options: unknown; args: unknown[] }>,
}))

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: (context: string) => {
    state.contexts.push(context)
    return state.db.client
  },
}))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>, keyParts: string[], options: unknown) =>
    async (...args: unknown[]) => {
      state.cacheCalls.push({ keyParts, options, args })
      const key = JSON.stringify([keyParts, args])
      if (state.store.has(key)) return state.store.get(key)
      const value = await fn(...args)
      state.store.set(key, value)
      return value
    },
  revalidateTag: () => undefined,
}))

import { getPublicPracticeFilters } from './db'
import { BACKOFF_MS, resetCacheGuard } from './cache-guard'

const SUBJECT_CATEGORIES = [
  'financial-accounting', 'financial-management', 'management-accounting', 'financial-market',
  'business-management', 'audit-assurance', 'taxation', 'economics',
]
const emptySubjects = () => Object.fromEntries(SUBJECT_CATEGORIES.map((c) => [c, [] as string[]]))

const set = (id: string, article_slug: string | null, difficulty: string | null, extra: Row = {}): Row => ({
  id, article_slug, difficulty, status: 'published', show_on_sites: ['ab'], title: `T ${id}`, ...extra,
})
const article = (slug: string, category: string, status = 'published'): Row => ({ slug, category, status })

// Wrap every answer of the fake client (a missing total, no rows array...).
function alterAnswers(change: (table: string, answer: { data: unknown; error: unknown; count: number | null }) => typeof answer) {
  const inner = state.db.client
  state.db.client = {
    from(table: string) {
      const builder = inner.from(table) as Record<string, unknown> & { then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => unknown }
      const then = builder.then
      builder.then = (res, rej) => then.call(builder, (answer: unknown) => res(change(table, answer as { data: unknown; error: unknown; count: number | null })), rej)
      return builder
    },
  }
}

const thrownBy = async (run: () => Promise<unknown>) =>
  run().then(() => null, (error: unknown) => error as Error & { code?: string })

beforeEach(() => {
  resetCacheGuard()
  state.contexts = []
  state.store.clear()
  state.cacheCalls = []
})
afterEach(() => {
  vi.useRealTimers()
  resetCacheGuard()
})

describe('getPublicPracticeFilters: what it returns', () => {
  it('levels per set, subjects by the mock-pool rule, ids sorted, every level and subject present', async () => {
    state.db = fakeDb({
      question_sets: [
        set('s09', 'fa-1', 'advanced'),
        set('s01', 'fa-1', 'intermediate'),
        set('s05', 'fa-2', 'advanced'),
        set('s02', 'aa-1', 'advanced'),
        set('s03', 'fa-draft', 'advanced'), // the article is not published → no subject
        set('s04', 'other-1', 'advanced'), // a category outside MOCK_EXAM_SUBJECTS → no subject
        set('s06', null, 'intermediate'), // no article → no subject, still counted
        set('s07', 'gone', 'advanced'), // no such article → no subject
        set('s08', 'fa-1', 'expert'), // an unknown level → no level, still in its subject
        set('s10', 'fa-1', 'advanced', { status: 'draft' }), // not live → not counted at all
        set('s11', 'fa-1', 'advanced', { show_on_sites: ['et'] }), // not on AB → not counted at all
      ],
      articles: [
        article('fa-1', 'financial-accounting'),
        article('fa-2', 'financial-accounting'),
        article('aa-1', 'audit-assurance'),
        article('fa-draft', 'financial-accounting', 'draft'),
        article('other-1', 'not-a-subject'),
      ],
    })
    expect(await getPublicPracticeFilters()).toStrictEqual({
      difficultyCounts: { beginner: 0, intermediate: 2, advanced: 6 },
      subjectSetIds: { ...emptySubjects(), 'financial-accounting': ['s01', 's05', 's08', 's09'], 'audit-assurance': ['s02'] },
    })
  })

  it('reads with GET and an exact total, never a head count: sets first, then the published articles of their slugs', async () => {
    state.db = fakeDb({ question_sets: [set('s1', 'a', 'advanced'), set('s2', null, 'advanced')], articles: [article('a', 'taxation')] })
    await getPublicPracticeFilters()
    expect(state.db.calls).toStrictEqual([
      { table: 'question_sets', columns: 'id,article_slug,difficulty', exactCount: true, filters: ['status=eq.published', 'show_on_sites=cs.ab'], range: [0, 999] },
      { table: 'articles', columns: 'slug,category', exactCount: true, filters: ['status=eq.published', 'slug=in.(1)'], range: [0, 999] },
    ])
    expect(state.contexts).toStrictEqual(['publicRead'])
  })

  it('zero levels and zero subjects are present as 0 and []', async () => {
    state.db = fakeDb({ question_sets: [set('s1', null, 'advanced')], articles: [] })
    expect(await getPublicPracticeFilters()).toStrictEqual({
      difficultyCounts: { beginner: 0, intermediate: 0, advanced: 1 },
      subjectSetIds: emptySubjects(),
    })
  })

  it('no live sets: all zero, all empty, and no article read', async () => {
    state.db = fakeDb({ question_sets: [], articles: [article('a', 'taxation')] })
    expect(await getPublicPracticeFilters()).toStrictEqual({
      difficultyCounts: { beginner: 0, intermediate: 0, advanced: 0 },
      subjectSetIds: emptySubjects(),
    })
    expect(state.db.calls.map((c) => c.table)).toStrictEqual(['question_sets'])
  })
})

describe('getPublicPracticeFilters: paging and chunking', () => {
  const many = (n: number, slugs: number) =>
    Array.from({ length: n }, (_, i) => set(`s${String(i).padStart(3, '0')}`, `a${String(i % slugs).padStart(3, '0')}`, i < 9 ? 'intermediate' : 'advanced'))
  const articlesFor = (slugs: number) =>
    Array.from({ length: slugs }, (_, i) => article(`a${String(i).padStart(3, '0')}`, i % 2 ? 'management-accounting' : 'financial-accounting'))

  it('a row cap of 50 still reads all 181 sets: the next page starts after the rows received', async () => {
    state.db = fakeDb({ question_sets: many(181, 20), articles: articlesFor(20) })
    state.db.maxRows = 50
    const out = await getPublicPracticeFilters()
    expect(state.db.calls.filter((c) => c.table === 'question_sets').map((c) => c.range)).toStrictEqual([[0, 999], [50, 1049], [100, 1099], [150, 1149]])
    expect(out.difficultyCounts).toStrictEqual({ beginner: 0, intermediate: 9, advanced: 172 })
    expect(out.subjectSetIds['financial-accounting'].length + out.subjectSetIds['management-accounting'].length).toBe(181)
  })

  it('150 article slugs are read in two chunks of 100 and 50', async () => {
    state.db = fakeDb({ question_sets: many(181, 150), articles: articlesFor(150) })
    const out = await getPublicPracticeFilters()
    expect(state.db.calls.filter((c) => c.table === 'articles').map((c) => c.filters[1])).toStrictEqual(['slug=in.(100)', 'slug=in.(50)'])
    expect(out.subjectSetIds['financial-accounting']).toHaveLength(91)
    expect(out.subjectSetIds['management-accounting']).toHaveLength(90)
    expect([...out.subjectSetIds['financial-accounting']].sort()).toStrictEqual(out.subjectSetIds['financial-accounting'])
  })

  it('is cached for an hour under the list tags, one key, no arguments', async () => {
    state.db = fakeDb({ question_sets: [set('s1', null, 'advanced')], articles: [] })
    await getPublicPracticeFilters()
    expect(state.cacheCalls).toStrictEqual([{
      keyParts: ['public-practice-filters'],
      options: { revalidate: 3600, tags: ['question-sets', 'question-sets-list'] },
      args: [],
    }])
    expect(state.store.size).toBe(1)
  })
})

describe('getPublicPracticeFilters: every failure is thrown and never stored', () => {
  const base = () => fakeDb({ question_sets: [set('s1', 'a', 'advanced'), set('s2', 'b', 'advanced')], articles: [article('a', 'taxation'), article('b', 'economics')] })

  it.each([
    ['the sets read fails', 'question_sets', 'XX000'],
    ['the articles read fails', 'articles', 'XX000'],
  ])('%s', async (_name, table, code) => {
    state.db = base()
    state.db.failWhen = (call) => call.table === table
    const thrown = await thrownBy(() => getPublicPracticeFilters())
    expect(thrown?.name).toBe('MockPoolReadError')
    expect(thrown?.code).toBe(code)
    expect(thrown?.message).toBe(`mock exam pool: practice-filters ${table} read failed`)
    expect(thrown?.message).not.toContain('seed')
    expect(state.store.size).toBe(0)
  })

  it.each([
    ['a missing total', 'NO_TOTAL', (a: { data: unknown; error: unknown; count: number | null }) => ({ ...a, count: null })],
    ['no rows array', 'NO_DATA', (a: { data: unknown; error: unknown; count: number | null }) => ({ ...a, data: null })],
  ])('%s → %s', async (_name, code, change) => {
    for (const table of ['question_sets', 'articles']) {
      resetCacheGuard()
      state.db = base()
      alterAnswers((t, a) => (t === table ? change(a) : a))
      const thrown = await thrownBy(() => getPublicPracticeFilters())
      expect(thrown?.code).toBe(code)
      expect(state.store.size).toBe(0)
    }
  })

  it('an empty page before the total is in → EMPTY_PAGE', async () => {
    state.db = base()
    state.db.dropRows = () => 99
    const thrown = await thrownBy(() => getPublicPracticeFilters())
    expect(thrown?.code).toBe('EMPTY_PAGE')
    expect(state.store.size).toBe(0)
  })

  it('a total that changes between pages → TOTAL_CHANGED', async () => {
    state.db = base()
    state.db.maxRows = 1
    state.db.dropRows = (call) => {
      if (call.table === 'question_sets' && call.range?.[0] === 0) state.db.tables.question_sets.push(set('s3', null, 'advanced'))
      return 0
    }
    const thrown = await thrownBy(() => getPublicPracticeFilters())
    expect(thrown?.code).toBe('TOTAL_CHANGED')
    expect(state.store.size).toBe(0)
  })

  it('after a failure the key rests for the back-off time (no new read), then reads again', async () => {
    vi.useFakeTimers()
    state.db = base()
    state.db.failWhen = () => true
    await thrownBy(() => getPublicPracticeFilters())
    const reads = state.db.calls.length
    await thrownBy(() => getPublicPracticeFilters())
    expect(state.db.calls.length).toBe(reads)
    state.db.failWhen = null
    vi.advanceTimersByTime(BACKOFF_MS + 1)
    expect((await getPublicPracticeFilters()).difficultyCounts.advanced).toBe(2)
  })
})
