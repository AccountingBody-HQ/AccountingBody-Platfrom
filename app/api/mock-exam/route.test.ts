import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type FakeDb, type Row } from '@/lib/test-helpers/fake-query'
import { SERVER_PROBLEM_TEXT } from '@/lib/message-rules'

// The AB mock-exam API: at most 50 questions per answer, only questions with
// four real options and an answer that points at one of them, and a 500 with
// the shared text when a read fails. The database is the fake query builder.

const state = vi.hoisted(() => ({ db: null as unknown as FakeDb }))

vi.mock('@/lib/supabase-server', () => ({ getServerSupabase: () => state.db.client }))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>) => (...args: unknown[]) => fn(...args),
}))
vi.mock('@/lib/report-error', () => ({ reportServerError: () => {} }))

import { GET } from './route'
import { resetCacheGuard } from '@/lib/cache-guard'

function question(setId: string, n: number, extra: Row = {}): Row {
  return {
    id: `q-${setId}-${String(n).padStart(4, '0')}`,
    set_id: setId,
    question_order: n,
    question_text: `Question ${setId} ${n}`,
    option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D',
    correct_index: n % 4,
    explanation: 'Because.',
    difficulty: 'medium',
    ...extra,
  }
}

// `sets` sets in the subject, `perSet` questions each.
function seed(sets: number, perSet: number, extraQuestions: Row[] = []): FakeDb {
  const articles: Row[] = []
  const questionSets: Row[] = []
  const questions: Row[] = []
  for (let s = 0; s < sets; s++) {
    const setId = `set-${String(s).padStart(3, '0')}`
    articles.push({ slug: `art-${s}`, category: 'financial-accounting', status: 'published' })
    questionSets.push({ id: setId, title: `Topic ${s} — Practice Questions`, article_slug: `art-${s}`, status: 'published', show_on_sites: ['ab'] })
    for (let n = 0; n < perSet; n++) questions.push(question(setId, n))
  }
  questions.push(...extraQuestions)
  return fakeDb({ articles, question_sets: questionSets, questions })
}

const get = (query: string) => GET(new NextRequest(`https://accountingbody.com/api/mock-exam?${query}`))

beforeEach(() => {
  resetCacheGuard()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('count is clamped to 1..50', () => {
  it('count=100000 serves at most 50', async () => {
    state.db = seed(10, 20)
    const res = await get('category=financial-accounting&count=100000')
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.served).toBe(50)
    expect(body.questions).toHaveLength(50)
    expect(body.poolTotal).toBe(200)
  })

  it.each(['abc', '0', '-5', ''])('count=%s serves the default 50', async (count) => {
    state.db = seed(10, 20)
    const body = await (await get(`category=financial-accounting&count=${count}`)).json()
    expect(body.served).toBe(50)
    expect(body.questions).toHaveLength(50)
  })

  it('a small count is kept', async () => {
    state.db = seed(10, 20)
    const body = await (await get('category=financial-accounting&count=7')).json()
    expect(body.served).toBe(7)
  })
})

describe('only whole questions are served', () => {
  const bad: Row[] = [
    question('set-000', 900, { question_text: 'bad blank b', option_b: '   ' }),
    question('set-000', 901, { question_text: 'bad null d', option_d: null }),
    question('set-001', 902, { question_text: 'bad index 4', correct_index: 4 }),
    question('set-001', 903, { question_text: 'bad index -1', correct_index: -1 }),
    question('set-001', 904, { question_text: 'bad index 1.5', correct_index: 1.5 }),
    question('set-001', 905, { question_text: '  ' }),
  ]

  it('never serves a blank option or an answer outside 0..3', async () => {
    state.db = seed(2, 3, bad)
    const body = await (await get('category=financial-accounting&count=50')).json()
    expect(body.served).toBe(6)
    const texts = body.questions.map((q: { questionText: string }) => q.questionText)
    expect(texts.some((t: string) => t.startsWith('bad') || t.trim() === '')).toBe(false)
    for (const q of body.questions) {
      expect(q.options).toHaveLength(4)
      expect(q.options.every((o: unknown) => typeof o === 'string' && o.trim() !== '')).toBe(true)
      expect(Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < 4).toBe(true)
    }
  })

  it('keeps the answer shape: questions, poolTotal, topicCount, served', async () => {
    state.db = seed(3, 4)
    const body = await (await get('category=financial-accounting')).json()
    expect(Object.keys(body).sort()).toEqual(['poolTotal', 'questions', 'served', 'topicCount'])
    expect(Object.keys(body.questions[0]).sort()).toEqual(
      ['correctIndex', 'difficulty', 'explanation', 'options', 'questionText', 'sourceTitle', 'topic'])
    expect(body.topicCount).toBe(3)
    expect(body.questions[0].topic).toMatch(/^Topic \d$/)
  })

  it('an empty subject answers no questions, as today', async () => {
    state.db = seed(0, 0)
    const res = await get('category=economics')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ questions: [], poolTotal: 0 })
  })

  it('no category is a 400, as today', async () => {
    state.db = seed(1, 1)
    expect((await get('count=50')).status).toBe(400)
  })
})

describe('a failed read is a 500 with the shared text', () => {
  it.each(['articles', 'question_sets', 'questions'])('%s read fails', async (table) => {
    state.db = seed(3, 20)
    state.db.failWhen = (call) => call.table === table
    const res = await get('category=financial-accounting&count=50')
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: SERVER_PROBLEM_TEXT })
  })
})
