import { describe, expect, it } from 'vitest'
import {
  MAX_ATTEMPT_MS, MOCK_HISTORY_KEY, PRACTICE_SETS_KEY, addHistory, checkAttempt, clearExpiredAttempts,
  clearPracticeData, formatLastResultDate, lastResult, lastSetScore, mockAttemptKey, mockExamId, readAttempt,
  readHistory, readSets, removeAttempt, saveAttempt, saveSetScore, topicScores,
  type HistoryItem, type MockAttempt, type StorageLike, type StoredQuestion,
} from './practice-store'

// PQB-3 S1 (D351, D347): the device store. A fake Storage stands in for
// window.localStorage; it can be made to throw on any call.
class FakeStorage implements StorageLike {
  map = new Map<string, string>()
  throwOn = new Set<'get' | 'set' | 'remove' | 'key'>()
  get length() { if (this.throwOn.has('key')) throw new Error('blocked'); return this.map.size }
  key(i: number) { if (this.throwOn.has('key')) throw new Error('blocked'); return Array.from(this.map.keys())[i] ?? null }
  getItem(k: string) { if (this.throwOn.has('get')) throw new Error('blocked'); return this.map.has(k) ? (this.map.get(k) as string) : null }
  setItem(k: string, v: string) { if (this.throwOn.has('set')) throw new Error('QuotaExceededError'); this.map.set(k, String(v)) }
  removeItem(k: string) { if (this.throwOn.has('remove')) throw new Error('blocked'); this.map.delete(k) }
}

const NOW = Date.UTC(2026, 10, 27, 12, 0, 0)
const KEY = mockAttemptKey('ab', 'financial-accounting')
const q = (topic: string, correctIndex = 0, extra: Partial<StoredQuestion> = {}): StoredQuestion =>
  ({ questionText: 'Q', options: ['a', 'b', 'c', 'd'], correctIndex, topic, ...extra })
const attempt = (over: Partial<MockAttempt> = {}): MockAttempt => ({
  v: 1, endAt: NOW + 60_000, questions: [q('A'), q('B', 1), q('A', 2)], answers: { 0: 0, 2: 1 }, flags: [1], current: 2, ...over,
})
const put = (s: FakeStorage, k: string, v: unknown) => s.map.set(k, typeof v === 'string' ? v : JSON.stringify(v))
const hist = (exam: string, at: number, over: Partial<HistoryItem> = {}): HistoryItem =>
  ({ exam, score: 3, total: 5, pct: 60, at, topics: [{ topic: 'A', correct: 3, total: 5 }], ...over })

describe('keys', () => {
  it('names the attempt, history and practice-set keys', () => {
    expect(KEY).toBe('ab_mock_v1:ab:financial-accounting')
    expect(mockAttemptKey('level-1', 'cost-accounting')).toBe('ab_mock_v1:level-1:cost-accounting')
    expect(mockExamId('ab', 'taxation')).toBe('ab:taxation')
    expect(MOCK_HISTORY_KEY).toBe('ab_mock_hist_v1')
    expect(PRACTICE_SETS_KEY).toBe('ab_pq_v1')
    expect(MAX_ATTEMPT_MS).toBe((50 * 90 + 60) * 1000)
  })
})

describe('(a) unfinished attempt', () => {
  it('saves and reads back a good attempt', () => {
    const s = new FakeStorage()
    expect(saveAttempt(s, KEY, attempt(), NOW)).toBe(true)
    expect(readAttempt(s, KEY, NOW)).toEqual(attempt())
  })

  it('no key → null, nothing removed or written', () => {
    const s = new FakeStorage()
    expect(readAttempt(s, KEY, NOW)).toBeNull()
    expect(s.map.size).toBe(0)
  })

  const broken: Array<[string, unknown]> = [
    ['not JSON', '{oops'],
    ['an array', []],
    ['wrong version', { ...attempt(), v: 2 }],
    ['endAt missing', { ...attempt(), endAt: undefined }],
    ['endAt a string', { ...attempt(), endAt: String(NOW + 1000) }],
    ['endAt too far ahead', attempt({ endAt: NOW + MAX_ATTEMPT_MS + 1 })],
    ['no questions', attempt({ questions: [] })],
    ['51 questions', attempt({ questions: Array.from({ length: 51 }, () => q('A')), current: 0, answers: {}, flags: [] })],
    ['question text not a string', attempt({ questions: [{ ...q('A'), questionText: 5 as unknown as string }], current: 0, answers: {}, flags: [] })],
    ['one option', attempt({ questions: [q('A', 0, { options: ['a'] })], current: 0, answers: {}, flags: [] })],
    ['seven options', attempt({ questions: [q('A', 0, { options: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] })], current: 0, answers: {}, flags: [] })],
    ['an option not a string', attempt({ questions: [q('A', 0, { options: ['a', 2 as unknown as string] })], current: 0, answers: {}, flags: [] })],
    ['correctIndex outside the options', attempt({ questions: [q('A', 4)], current: 0, answers: {}, flags: [] })],
    ['correctIndex not whole', attempt({ questions: [q('A', 0.5)], current: 0, answers: {}, flags: [] })],
    ['topic missing', attempt({ questions: [{ ...q('A'), topic: undefined as unknown as string }], current: 0, answers: {}, flags: [] })],
    ['explanation not a string', attempt({ questions: [q('A', 0, { explanation: 1 as unknown as string })], current: 0, answers: {}, flags: [] })],
    ['difficulty not a string', attempt({ questions: [q('A', 0, { difficulty: {} as unknown as string })], current: 0, answers: {}, flags: [] })],
    ['answers not an object', { ...attempt(), answers: [0, 1] }],
    ['answer for a question that does not exist', attempt({ answers: { 3: 0 } })],
    ['answer key not a number', { ...attempt(), answers: { x: 0 } }],
    ['answer outside the options', attempt({ answers: { 0: 4 } })],
    ['answer negative', attempt({ answers: { 0: -1 } })],
    ['flags not an array', { ...attempt(), flags: 1 }],
    ['flag outside the questions', attempt({ flags: [3] })],
    ['flags not sorted', attempt({ flags: [2, 1] })],
    ['flags repeated', attempt({ flags: [1, 1] })],
    ['current outside the questions', attempt({ current: 3 })],
    ['current negative', attempt({ current: -1 })],
  ]
  it.each(broken)('%s → null and the key is removed', (_name, value) => {
    const s = new FakeStorage()
    put(s, KEY, value)
    put(s, 'other', 'x')
    expect(readAttempt(s, KEY, NOW)).toBeNull()
    expect(s.map.has(KEY)).toBe(false)
    expect(s.map.get('other')).toBe('x')
  })

  it('optional explanation and difficulty strings are kept', () => {
    const a = attempt({ questions: [q('A', 0, { explanation: 'e', difficulty: 'hard' })], current: 0, answers: {}, flags: [] })
    const s = new FakeStorage()
    expect(saveAttempt(s, KEY, a, NOW)).toBe(true)
    expect(readAttempt(s, KEY, NOW)).toEqual(a)
  })

  it('an attempt whose time has passed is removed and not returned', () => {
    const s = new FakeStorage()
    put(s, KEY, attempt({ endAt: NOW }))
    expect(readAttempt(s, KEY, NOW)).toBeNull()
    expect(s.map.has(KEY)).toBe(false)
    put(s, KEY, attempt({ endAt: NOW + 1 }))
    expect(readAttempt(s, KEY, NOW)).not.toBeNull()
    expect(readAttempt(s, KEY, NOW + 1)).toBeNull()
    expect(s.map.has(KEY)).toBe(false)
  })

  it('a full exam end time (50 × 90 s) is allowed', () => {
    const s = new FakeStorage()
    expect(saveAttempt(s, KEY, attempt({ endAt: NOW + 50 * 90 * 1000 }), NOW)).toBe(true)
  })

  it('saveAttempt refuses a wrong shape and writes nothing', () => {
    const s = new FakeStorage()
    expect(saveAttempt(s, KEY, attempt({ current: 9 }), NOW)).toBe(false)
    expect(s.map.size).toBe(0)
  })

  it('setItem throwing (storage full) → false, never throws', () => {
    const s = new FakeStorage()
    s.throwOn.add('set')
    expect(saveAttempt(s, KEY, attempt(), NOW)).toBe(false)
  })

  it('getItem throwing → null, never throws', () => {
    const s = new FakeStorage()
    put(s, KEY, attempt())
    s.throwOn.add('get')
    expect(readAttempt(s, KEY, NOW)).toBeNull()
  })

  it('removeAttempt removes the one key; throwing → false', () => {
    const s = new FakeStorage()
    put(s, KEY, attempt())
    put(s, 'other', 'x')
    expect(removeAttempt(s, KEY)).toBe(true)
    expect(Array.from(s.map.keys())).toEqual(['other'])
    s.throwOn.add('remove')
    expect(removeAttempt(s, 'other')).toBe(false)
  })

  it('checkAttempt copies the flags (no shared array)', () => {
    const a = attempt()
    const c = checkAttempt(a, NOW) as MockAttempt
    expect(c.flags).toEqual(a.flags)
    expect(c.flags).not.toBe(a.flags)
  })
})

describe('clearExpiredAttempts', () => {
  it('removes every expired or broken ab_mock_v1:* key and leaves the others alone', () => {
    const s = new FakeStorage()
    const live = mockAttemptKey('ab', 'live')
    const old = mockAttemptKey('ab', 'old')
    const bad = mockAttemptKey('level-1', 'bad')
    put(s, live, attempt())
    put(s, old, attempt({ endAt: NOW - 1 }))
    put(s, bad, '{oops')
    put(s, MOCK_HISTORY_KEY, { v: 1, items: [] })
    put(s, PRACTICE_SETS_KEY, { v: 1, sets: {} })
    put(s, 'ab_cookie_consent', 'accepted')
    put(s, 'course_progress_x', '[]')
    put(s, 'ab_mock_v2:ab:x', 'kept')
    expect(clearExpiredAttempts(s, NOW)).toBe(2)
    expect(Array.from(s.map.keys()).sort()).toEqual([live, MOCK_HISTORY_KEY, PRACTICE_SETS_KEY, 'ab_cookie_consent', 'ab_mock_v2:ab:x', 'course_progress_x'].sort())
  })

  it('blocked storage → 0, never throws', () => {
    const s = new FakeStorage()
    s.throwOn.add('key')
    expect(clearExpiredAttempts(s, NOW)).toBe(0)
  })
})

describe('(b) history', () => {
  it('newest first, at most 10 in total across exams', () => {
    const s = new FakeStorage()
    for (let i = 1; i <= 12; i++) expect(addHistory(s, hist(i % 2 ? 'ab:a' : 'ab:b', NOW + i))).toBe(true)
    const items = readHistory(s) as HistoryItem[]
    expect(items).toHaveLength(10)
    expect(items.map(i => i.at)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3].map(n => NOW + n))
  })

  it('lastResult is the newest item of that exam, or null', () => {
    const s = new FakeStorage()
    expect(lastResult(s, 'ab:a')).toBeNull()
    addHistory(s, hist('ab:a', NOW + 1, { score: 1, pct: 20 }))
    addHistory(s, hist('ab:b', NOW + 2))
    addHistory(s, hist('ab:a', NOW + 3, { score: 4, pct: 80 }))
    expect(lastResult(s, 'ab:a')?.at).toBe(NOW + 3)
    expect(lastResult(s, 'ab:a')?.score).toBe(4)
    expect(lastResult(s, 'ab:b')?.at).toBe(NOW + 2)
    expect(lastResult(s, 'level-1:x')).toBeNull()
  })

  const badItems: Array<[string, unknown]> = [
    ['not JSON', '{'],
    ['wrong version', { v: 2, items: [] }],
    ['items not an array', { v: 1, items: {} }],
    ['11 items', { v: 1, items: Array.from({ length: 11 }, (_, i) => hist('ab:a', NOW + i)) }],
    ['exam empty', { v: 1, items: [hist('', NOW)] }],
    ['score above total', { v: 1, items: [hist('ab:a', NOW, { score: 6 })] }],
    ['total 0', { v: 1, items: [hist('ab:a', NOW, { score: 0, total: 0 })] }],
    ['pct above 100', { v: 1, items: [hist('ab:a', NOW, { pct: 101 })] }],
    ['at missing', { v: 1, items: [{ ...hist('ab:a', NOW), at: undefined }] }],
    ['topics not an array', { v: 1, items: [{ ...hist('ab:a', NOW), topics: {} }] }],
    ['topic correct above total', { v: 1, items: [hist('ab:a', NOW, { topics: [{ topic: 'A', correct: 2, total: 1 }] })] }],
    ['topic name missing', { v: 1, items: [hist('ab:a', NOW, { topics: [{ correct: 1, total: 1 } as unknown as HistoryItem['topics'][0]] })] }],
  ]
  it.each(badItems)('%s → null and the key is removed', (_n, value) => {
    const s = new FakeStorage()
    put(s, MOCK_HISTORY_KEY, value)
    expect(readHistory(s)).toBeNull()
    expect(lastResult(s, 'ab:a')).toBeNull()
    expect(s.map.has(MOCK_HISTORY_KEY)).toBe(false)
  })

  it('a broken history is replaced by the new item; a wrong item is not written', () => {
    const s = new FakeStorage()
    put(s, MOCK_HISTORY_KEY, '{')
    expect(addHistory(s, hist('ab:a', NOW))).toBe(true)
    expect(readHistory(s)).toHaveLength(1)
    expect(addHistory(s, hist('ab:a', NOW, { score: 9 }))).toBe(false)
    expect(readHistory(s)).toHaveLength(1)
  })

  it('setItem throwing → false; getItem throwing → null', () => {
    const s = new FakeStorage()
    s.throwOn.add('set')
    expect(addHistory(s, hist('ab:a', NOW))).toBe(false)
    s.throwOn.clear()
    addHistory(s, hist('ab:a', NOW))
    s.throwOn.add('get')
    expect(readHistory(s)).toBeNull()
    expect(lastResult(s, 'ab:a')).toBeNull()
  })
})

describe('(c) practice sets', () => {
  it('saves and reads the last score of a set; a later score replaces it', () => {
    const s = new FakeStorage()
    expect(lastSetScore(s, 'set-a')).toBeNull()
    expect(saveSetScore(s, 'set-a', { score: 7, total: 10, pct: 70 }, NOW)).toBe(true)
    expect(lastSetScore(s, 'set-a')).toEqual({ score: 7, total: 10, pct: 70, at: NOW })
    expect(saveSetScore(s, 'set-a', { score: 9, total: 10, pct: 90 }, NOW + 1)).toBe(true)
    expect(lastSetScore(s, 'set-a')).toEqual({ score: 9, total: 10, pct: 90, at: NOW + 1 })
    expect(Object.keys(readSets(s) as object)).toEqual(['set-a'])
    // One key holds every set.
    expect(Array.from(s.map.keys())).toEqual([PRACTICE_SETS_KEY])
  })

  it('keeps at most 200 sets, dropping the oldest first', () => {
    const s = new FakeStorage()
    for (let i = 0; i < 200; i++) saveSetScore(s, `set-${i}`, { score: 1, total: 2, pct: 50 }, NOW + i)
    expect(Object.keys(readSets(s) as object)).toHaveLength(200)
    expect(saveSetScore(s, 'set-new', { score: 2, total: 2, pct: 100 }, NOW + 500)).toBe(true)
    const sets = readSets(s) as Record<string, unknown>
    expect(Object.keys(sets)).toHaveLength(200)
    expect(sets['set-0']).toBeUndefined()
    expect(sets['set-1']).toBeDefined()
    expect(sets['set-new']).toBeDefined()
    // Re-saving an existing set does not drop another one.
    expect(saveSetScore(s, 'set-5', { score: 2, total: 2, pct: 100 }, NOW + 600)).toBe(true)
    expect(Object.keys(readSets(s) as object)).toHaveLength(200)
    expect((readSets(s) as Record<string, unknown>)['set-1']).toBeDefined()
  })

  const badSets: Array<[string, unknown]> = [
    ['not JSON', 'x'],
    ['wrong version', { v: 0, sets: {} }],
    ['sets an array', { v: 1, sets: [] }],
    ['score above total', { v: 1, sets: { a: { score: 3, total: 2, pct: 100, at: NOW } } }],
    ['pct not whole', { v: 1, sets: { a: { score: 1, total: 2, pct: 50.5, at: NOW } } }],
    ['at missing', { v: 1, sets: { a: { score: 1, total: 2, pct: 50 } } }],
    ['201 sets', { v: 1, sets: Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`s${i}`, { score: 1, total: 2, pct: 50, at: NOW }])) }],
  ]
  it.each(badSets)('%s → null and the key is removed', (_n, value) => {
    const s = new FakeStorage()
    put(s, PRACTICE_SETS_KEY, value)
    expect(readSets(s)).toBeNull()
    expect(lastSetScore(s, 'a')).toBeNull()
    expect(s.map.has(PRACTICE_SETS_KEY)).toBe(false)
  })

  it('a wrong score or empty slug is not written; storage errors → false / null', () => {
    const s = new FakeStorage()
    expect(saveSetScore(s, '', { score: 1, total: 2, pct: 50 }, NOW)).toBe(false)
    expect(saveSetScore(s, 'a', { score: 1, total: 0, pct: 50 }, NOW)).toBe(false)
    expect(s.map.size).toBe(0)
    s.throwOn.add('set')
    expect(saveSetScore(s, 'a', { score: 1, total: 2, pct: 50 }, NOW)).toBe(false)
    s.throwOn.clear()
    saveSetScore(s, 'a', { score: 1, total: 2, pct: 50 }, NOW)
    s.throwOn.add('get')
    expect(lastSetScore(s, 'a')).toBeNull()
  })
})

describe('(d) helpers', () => {
  it('topicScores: topics in order of first appearance, correct/total each', () => {
    const qs = [q('Tax', 0), q('Audit', 1), q('Tax', 2), q('Law', 0), q('Audit', 1)]
    expect(topicScores(qs, { 0: 0, 1: 0, 2: 2, 4: 1 })).toEqual([
      { topic: 'Tax', correct: 2, total: 2 },
      { topic: 'Audit', correct: 1, total: 2 },
      { topic: 'Law', correct: 0, total: 1 },
    ])
    expect(topicScores([], {})).toEqual([])
  })

  it('formatLastResultDate: d MMMM yyyy in English', () => {
    expect(formatLastResultDate(NOW, 'UTC')).toBe('27 November 2026')
    expect(formatLastResultDate(Date.UTC(2026, 0, 5, 12), 'UTC')).toBe('5 January 2026')
    // The visitor's own time zone decides the day.
    expect(formatLastResultDate(Date.UTC(2026, 10, 27, 23, 30), 'Africa/Addis_Ababa')).toBe('28 November 2026')
    expect(formatLastResultDate(Date.UTC(2026, 10, 27, 12))).toMatch(/^\d{1,2} November 2026$/)
  })
})

describe('clearPracticeData (the cookie page "Forget" button)', () => {
  it('removes every ab_mock_v1:* key, ab_mock_hist_v1 and ab_pq_v1, and nothing else', () => {
    const s = new FakeStorage()
    const keep = ['ab_cookie_consent', 'course_progress_intro', 'sidebar_open_intro', 'ab_job_alerts', 'ab_saved_jobs', 'ab_mock_v2:x', 'ab_pq_v1x', 'xab_mock_v1:a']
    for (const k of keep) put(s, k, 'v')
    put(s, mockAttemptKey('ab', 'a'), attempt())
    put(s, mockAttemptKey('level-2', 'b'), '{broken')
    put(s, MOCK_HISTORY_KEY, { v: 1, items: [] })
    put(s, PRACTICE_SETS_KEY, { v: 1, sets: {} })
    expect(clearPracticeData(s)).toBe(true)
    expect(Array.from(s.map.keys()).sort()).toEqual([...keep].sort())
  })

  it('nothing to remove → true', () => {
    expect(clearPracticeData(new FakeStorage())).toBe(true)
  })

  it('throwing storage → false, never throws', () => {
    const a = new FakeStorage()
    a.throwOn.add('key')
    expect(clearPracticeData(a)).toBe(false)
    const b = new FakeStorage()
    put(b, PRACTICE_SETS_KEY, 'x')
    b.throwOn.add('remove')
    expect(clearPracticeData(b)).toBe(false)
  })
})
