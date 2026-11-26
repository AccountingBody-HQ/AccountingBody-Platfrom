import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { fakeDb, type FakeDb, type Row } from '@/lib/test-helpers/fake-query'

// The mock-exam pool: read in pages with an exact total (never a silently
// short pool), kept per subject with unstable_cache + guardCachedRead (a
// failed read is never stored), picked with the same balanced round-robin as
// before, and served as before for the same random numbers.

const state = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  // A small stand-in for unstable_cache: one stored value per key and
  // arguments, written only when the read resolves (as the real one does).
  store: new Map<string, unknown>(),
  stored: 0,
}))

vi.mock('@/lib/supabase-server', () => ({ getServerSupabase: () => state.db.client }))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>, keyParts: string[]) =>
    async (...args: unknown[]) => {
      const key = JSON.stringify([keyParts, args])
      if (state.store.has(key)) return state.store.get(key)
      const value = await fn(...args)
      state.store.set(key, value)
      state.stored++
      return value
    },
}))
vi.mock('@/lib/report-error', () => ({ reportServerError: () => {} }))

import {
  getAbMockPool, getAbMockPoolSize, getEticpaMockPool, poolSize, roundRobinOrder, type MockPool,
} from './mock-exam-pool'
import { BACKOFF_MS, resetCacheGuard } from './cache-guard'
import { GET as abGet } from '@/app/api/mock-exam/route'

const pad = (n: number, w = 4) => String(n).padStart(w, '0')

function question(setId: string, n: number): Row {
  return {
    id: `q-${setId}-${pad(n)}`, set_id: setId, question_order: n,
    question_text: `Question ${setId} ${n}`, option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D',
    correct_index: n % 4, explanation: `Why ${n}`, difficulty: 'hard',
  }
}

function seed(sets: number, perSet: number | ((s: number) => number)): FakeDb {
  const articles: Row[] = []
  const questionSets: Row[] = []
  const questions: Row[] = []
  for (let s = 0; s < sets; s++) {
    const setId = `set-${pad(s, 3)}`
    articles.push({ slug: `art-${s}`, category: 'financial-accounting', status: 'published' })
    questionSets.push({
      id: setId, title: `Topic ${s} — Practice Questions`, article_slug: `art-${s}`, status: 'published',
      show_on_sites: ['ab', 'et'], eticpa_level: 'level-1', eticpa_module: 'cost-accounting',
    })
    const n = typeof perSet === 'number' ? perSet : perSet(s)
    for (let i = 0; i < n; i++) questions.push(question(setId, i))
  }
  return fakeDb({ articles, question_sets: questionSets, questions })
}

// A seeded generator, so two runs draw the same random numbers.
function seededRandom(seed: number) {
  let x = seed
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648
    return x / 2147483648
  }
}

beforeEach(() => {
  resetCacheGuard()
  state.store.clear()
  state.stored = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('paged pool read', () => {
  it('reads a 2,500-question pool over 3 pages and keeps every id', async () => {
    state.db = seed(25, 100)
    const pool = await getAbMockPool('financial-accounting')
    expect(poolSize(pool)).toBe(2500)
    const ids = new Set(pool.sets.flatMap(s => s.qids))
    expect(ids.size).toBe(2500)
    const pages = state.db.calls.filter(c => c.table === 'questions').map(c => c.range)
    expect(pages).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
    // The index reads ids only, with an exact total.
    const q = state.db.calls.find(c => c.table === 'questions')
    expect(q?.columns).toBe('id,set_id')
    expect(q?.exactCount).toBe(true)
  })

  it('keeps reading after a row cap and still gets every id', async () => {
    state.db = seed(25, 100)
    state.db.maxRows = 400
    const pool = await getAbMockPool('financial-accounting')
    expect(poolSize(pool)).toBe(2500)
  })

  it('reads more than 100 sets in chunks of 100', async () => {
    state.db = seed(130, 2)
    const pool = await getAbMockPool('financial-accounting')
    expect(pool.sets).toHaveLength(130)
    expect(poolSize(pool)).toBe(260)
    expect(state.db.calls.filter(c => c.table === 'questions')).toHaveLength(2)
  })

  it.each([
    ['an empty page before the total', (db: FakeDb) => { db.dropRows = c => (c.table === 'questions' && c.range?.[0] === 1000 ? 1000 : 0) }],
    ['a failed page', (db: FakeDb) => { db.failWhen = c => c.table === 'questions' && c.range?.[0] === 2000 }],
    ['a failed set read', (db: FakeDb) => { db.failWhen = c => c.table === 'question_sets' }],
  ])('throws on %s, and nothing is cached', async (_label, breakIt) => {
    state.db = seed(25, 100)
    breakIt(state.db)
    await expect(getAbMockPool('financial-accounting')).rejects.toMatchObject({ name: 'MockPoolReadError' })
    expect(state.stored).toBe(0)
    // After the pause, the next call reads again and succeeds.
    state.db.dropRows = null
    state.db.failWhen = null
    const later = Date.now() + BACKOFF_MS + 1
    vi.spyOn(Date, 'now').mockReturnValue(later)
    expect(poolSize(await getAbMockPool('financial-accounting'))).toBe(2500)
    expect(state.stored).toBe(1)
  })

  it('a failed read gives a null pool size, never 0', async () => {
    state.db = seed(3, 3)
    state.db.failWhen = c => c.table === 'articles'
    expect(await getAbMockPoolSize('financial-accounting')).toBeNull()
  })

  it('keeps one cache entry per subject and module', async () => {
    state.db = seed(3, 3)
    await getAbMockPool('financial-accounting')
    await getAbMockPool('economics')
    await getEticpaMockPool('level-1', 'cost-accounting')
    await getAbMockPool('financial-accounting')
    expect(state.stored).toBe(3)
    expect(Array.from(state.store.keys()).every(k => k.includes('mock-exam-pool'))).toBe(true)
  })

  it('the ETICPA pool takes the module sets only', async () => {
    state.db = seed(4, 5)
    const pool = await getEticpaMockPool('level-1', 'cost-accounting')
    expect(poolSize(pool)).toBe(20)
    expect(poolSize(await getEticpaMockPool('level-2', 'cost-accounting'))).toBe(0)
  })
})

describe('round-robin pick', () => {
  const poolWith = (sets: number, perSet: number): MockPool => ({
    sets: Array.from({ length: sets }, (_, s) => ({
      id: `s${s}`, title: `T${s}`, qids: Array.from({ length: perSet }, (_, i) => `s${s}-${i}`),
    })),
  })

  it('50 from 75 sets: no set gets 2 before every set has 1', () => {
    const first50 = roundRobinOrder(poolWith(75, 30)).slice(0, 50)
    expect(new Set(first50.map(p => p.setId)).size).toBe(50)
  })

  it('50 from 20 sets: every set gets 2 or 3', () => {
    const first50 = roundRobinOrder(poolWith(20, 30)).slice(0, 50)
    const per = new Map<string, number>()
    for (const p of first50) per.set(p.setId, (per.get(p.setId) ?? 0) + 1)
    expect(per.size).toBe(20)
    expect(Math.max(...Array.from(per.values())) - Math.min(...Array.from(per.values()))).toBeLessThanOrEqual(1)
  })

  it('a small set runs out and the others carry on', () => {
    const order = roundRobinOrder({ sets: [{ id: 'a', title: '', qids: ['a1'] }, { id: 'b', title: '', qids: ['b1', 'b2', 'b3'] }] })
    expect(order.map(o => o.setId)).toEqual(['a', 'b', 'b', 'b'])
  })
})

// Before this change, the route read every question of the subject and
// picked from them like this (copied from app/api/mock-exam/route.ts at
// 6d58b1af, guard rule aside: the seed data is clean).
function servedBefore(db: FakeDb, count: number) {
  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
  const sets = db.tables.question_sets
  const titles = new Map(sets.map(s => [s.id, String(s.title)]))
  const questions = [...db.tables.questions].sort((x, y) => Number(x.question_order) - Number(y.question_order))
  const groupMap = new Map<unknown, Row[]>()
  for (const q of questions) {
    const title = titles.get(q.set_id) ?? ''
    const pq = {
      questionText: q.question_text, options: [q.option_a, q.option_b, q.option_c, q.option_d], correctIndex: q.correct_index,
      explanation: q.explanation, difficulty: q.difficulty, sourceTitle: title, topic: title.replace(/ [—-] Practice Questions$/, ''),
    }
    const g = groupMap.get(q.set_id) ?? []
    g.push(pq)
    groupMap.set(q.set_id, g)
  }
  const groups = Array.from(groupMap.values()).map(g => shuffle(g))
  const poolTotal = groups.reduce((sum, g) => sum + g.length, 0)
  const selected: Row[] = []
  const target = Math.min(count, poolTotal)
  let idx = 0
  while (selected.length < target) {
    let added = false
    for (const group of groups) {
      if (selected.length >= target) break
      if (group[idx]) { selected.push(group[idx]); added = true }
    }
    if (!added) break
    idx++
  }
  return { questions: shuffle(selected), poolTotal, topicCount: groups.length, served: selected.length }
}

describe('the answer is the same as before for the same random numbers', () => {
  it.each([[75, 23], [12, 9], [3, 40]])('%i sets of %i questions', async (sets, perSet) => {
    state.db = seed(sets, perSet)
    vi.spyOn(Math, 'random').mockImplementation(seededRandom(42))
    const before = servedBefore(state.db, 50)
    vi.spyOn(Math, 'random').mockImplementation(seededRandom(42))
    const res = await abGet(new NextRequest('https://accountingbody.com/api/mock-exam?category=financial-accounting&count=50'))
    expect(await res.json()).toEqual(JSON.parse(JSON.stringify(before)))
  })

  it('reads only the served rows in full', async () => {
    state.db = seed(75, 23)
    await abGet(new NextRequest('https://accountingbody.com/api/mock-exam?category=financial-accounting&count=50'))
    const full = state.db.calls.filter(c => c.table === 'questions' && c.columns.includes('question_text'))
    expect(full).toHaveLength(1)
    expect(full[0].filters).toEqual(['id=in.(50)'])
  })

  it('tops up from the pool when a picked row is not servable, never past 50', async () => {
    state.db = seed(60, 2)
    for (const q of state.db.tables.questions.slice(0, 30)) q.option_c = ' '
    const body = await (await abGet(new NextRequest('https://accountingbody.com/api/mock-exam?category=financial-accounting&count=50'))).json()
    expect(body.served).toBe(50)
    expect(body.questions).toHaveLength(50)
    expect(body.questions.every((q: { options: string[] }) => q.options.every(o => o.trim() !== ''))).toBe(true)
  })
})
