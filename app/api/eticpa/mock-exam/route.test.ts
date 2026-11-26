import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type FakeDb, type Row } from '@/lib/test-helpers/fake-query'
import { SERVER_PROBLEM_TEXT } from '@/lib/message-rules'

// The ETICPA mock-exam API: the same rules as the AB one — at most 50
// questions, only whole questions, and a 500 with the shared text when a read
// fails. The database is the fake query builder.

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
    difficulty: 'easy',
    ...extra,
  }
}

function seed(sets: number, perSet: number, extraQuestions: Row[] = []): FakeDb {
  const questionSets: Row[] = []
  const questions: Row[] = []
  for (let s = 0; s < sets; s++) {
    const setId = `et-${String(s).padStart(3, '0')}`
    questionSets.push({
      id: setId, title: `Module topic ${s} - Practice Questions`, status: 'published', show_on_sites: ['ab', 'et'],
      eticpa_level: 'level-2', eticpa_module: 'financial-accounting',
    })
    for (let n = 0; n < perSet; n++) questions.push(question(setId, n))
  }
  questions.push(...extraQuestions)
  return fakeDb({ question_sets: questionSets, questions })
}

const get = (query: string) => GET(new NextRequest(`https://accountingbody.com/api/eticpa/mock-exam?${query}`))
const MODULE = 'level=level-2&module=financial-accounting'

beforeEach(() => {
  resetCacheGuard()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('count is clamped to 1..50', () => {
  it('count=100000 serves at most 50', async () => {
    state.db = seed(8, 20)
    const body = await (await get(`${MODULE}&count=100000`)).json()
    expect(body.served).toBe(50)
    expect(body.questions).toHaveLength(50)
    expect(body.poolTotal).toBe(160)
  })

  it.each(['abc', '0', '-5', ''])('count=%s serves the default 50', async (count) => {
    state.db = seed(8, 20)
    const body = await (await get(`${MODULE}&count=${count}`)).json()
    expect(body.served).toBe(50)
  })
})

describe('only whole questions are served', () => {
  it('never serves a blank option or an answer outside 0..3', async () => {
    state.db = seed(2, 3, [
      question('et-000', 900, { question_text: 'bad blank a', option_a: '' }),
      question('et-000', 901, { question_text: 'bad index 4', correct_index: 4 }),
      question('et-001', 902, { question_text: 'bad null c', option_c: null }),
    ])
    const body = await (await get(`${MODULE}&count=50`)).json()
    expect(body.served).toBe(6)
    for (const q of body.questions) {
      expect(q.questionText.startsWith('bad')).toBe(false)
      expect(q.options).toHaveLength(4)
      expect(q.correctIndex >= 0 && q.correctIndex < 4).toBe(true)
    }
  })

  it('keeps the answer shape and the module defaults', async () => {
    state.db = seed(3, 4)
    const body = await (await get(MODULE)).json()
    expect(Object.keys(body).sort()).toEqual(['poolTotal', 'questions', 'served', 'topicCount'])
    expect(body.topicCount).toBe(3)
    expect(body.questions[0].topic).toMatch(/^Module topic \d$/)
    const empty = await (await get('')).json()
    expect(empty).toEqual({ questions: [], poolTotal: 0 })
  })
})

describe('a failed read is a 500 with the shared text', () => {
  it.each(['question_sets', 'questions'])('%s read fails', async (table) => {
    state.db = seed(3, 20)
    state.db.failWhen = (call) => call.table === table
    const res = await get(`${MODULE}&count=50`)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: SERVER_PROBLEM_TEXT })
  })
})
