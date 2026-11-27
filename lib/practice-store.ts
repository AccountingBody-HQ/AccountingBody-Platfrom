// lib/practice-store.ts — practice and mock-exam progress kept on the
// visitor's device only (D347). Nothing here is sent to the site.
//
// Every function takes a Storage-like object (window.localStorage in the
// browser, a fake in tests) and never throws: a read that fails its shape
// check returns null and removes that key; a write that fails returns false.
// The keys are listed on the cookie page (app/cookie-policy/page.tsx).

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  key(index: number): string | null
  readonly length: number
}

/** An unfinished mock exam: `ab_mock_v1:<level>:<module>`. */
export const MOCK_ATTEMPT_PREFIX = 'ab_mock_v1:'
/** The last mock-exam results, newest first. */
export const MOCK_HISTORY_KEY = 'ab_mock_hist_v1'
/** The last score of each practice set. */
export const PRACTICE_SETS_KEY = 'ab_pq_v1'

export const MAX_QUESTIONS = 50
export const MAX_HISTORY = 10
export const MAX_SETS = 200
/** The longest an attempt may still run: 50 questions × 90 s, plus 60 s. */
export const MAX_ATTEMPT_MS = (MAX_QUESTIONS * 90 + 60) * 1000

export interface StoredQuestion {
  questionText: string
  options: string[]
  correctIndex: number
  topic: string
  explanation?: string
  difficulty?: string
}

export interface MockAttempt {
  v: 1
  endAt: number
  questions: StoredQuestion[]
  answers: Record<number, number>
  flags: number[]
  current: number
}

export interface TopicScore { topic: string; correct: number; total: number }

export interface HistoryItem {
  exam: string
  score: number
  total: number
  pct: number
  at: number
  topics: TopicScore[]
}

export interface SetScore { score: number; total: number; pct: number; at: number }

/** This browser's localStorage, or null on the server or when the browser blocks it. */
export function deviceStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export const mockExamId = (level: string, module: string) => `${level}:${module}`
export const mockAttemptKey = (level: string, module: string) => `${MOCK_ATTEMPT_PREFIX}${mockExamId(level, module)}`

// ── safe storage calls ──
function safeGet(storage: StorageLike, key: string): string | null {
  try { return storage.getItem(key) } catch { return null }
}
function safeSet(storage: StorageLike, key: string, value: string): boolean {
  try { storage.setItem(key, value); return true } catch { return false }
}
function safeRemove(storage: StorageLike, key: string): boolean {
  try { storage.removeItem(key); return true } catch { return false }
}
function safeKeys(storage: StorageLike): string[] | null {
  try {
    const keys: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i)
      if (typeof k === 'string') keys.push(k)
    }
    return keys
  } catch { return null }
}
function readJson(storage: StorageLike, key: string): unknown {
  const raw = safeGet(storage, key)
  if (raw === null) return undefined
  try { return JSON.parse(raw) } catch { return null }
}

// ── shape checks ──
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x)
const isTime = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0
const isOptStr = (x: unknown) => x === undefined || typeof x === 'string'
const isPct = (x: unknown) => isInt(x) && x >= 0 && x <= 100
const isScore = (score: unknown, total: unknown, maxTotal: number) =>
  isInt(total) && total >= 1 && total <= maxTotal && isInt(score) && score >= 0 && score <= total

function isQuestion(x: unknown): x is StoredQuestion {
  if (!isObj(x)) return false
  const o = x.options
  return typeof x.questionText === 'string'
    && Array.isArray(o) && o.length >= 2 && o.length <= 6 && o.every(s => typeof s === 'string')
    && isInt(x.correctIndex) && x.correctIndex >= 0 && x.correctIndex < o.length
    && typeof x.topic === 'string'
    && isOptStr(x.explanation) && isOptStr(x.difficulty)
}

/** The attempt if `x` has the right shape and is still running at `now`, else null. */
export function checkAttempt(x: unknown, now: number): MockAttempt | null {
  if (!isObj(x) || x.v !== 1) return null
  if (!isTime(x.endAt) || !(now < x.endAt) || x.endAt > now + MAX_ATTEMPT_MS) return null
  const qs = x.questions
  if (!Array.isArray(qs) || qs.length < 1 || qs.length > MAX_QUESTIONS || !qs.every(isQuestion)) return null
  if (!isInt(x.current) || x.current < 0 || x.current >= qs.length) return null
  if (!isObj(x.answers)) return null
  const answers: Record<number, number> = {}
  for (const [k, v] of Object.entries(x.answers)) {
    if (!/^(0|[1-9]\d*)$/.test(k)) return null
    const i = Number(k)
    if (i >= qs.length || !isInt(v) || v < 0 || v >= (qs[i] as StoredQuestion).options.length) return null
    answers[i] = v
  }
  const f = x.flags
  if (!Array.isArray(f) || !f.every(n => isInt(n) && n >= 0 && n < qs.length)) return null
  for (let i = 1; i < f.length; i++) if (!((f[i] as number) > (f[i - 1] as number))) return null
  return { v: 1, endAt: x.endAt, questions: qs as StoredQuestion[], answers, flags: [...f] as number[], current: x.current }
}

function checkTopics(x: unknown): x is TopicScore[] {
  return Array.isArray(x) && x.length <= MAX_QUESTIONS && x.every(t =>
    isObj(t) && typeof t.topic === 'string' && isScore(t.correct, t.total, MAX_QUESTIONS))
}

function checkHistoryItem(x: unknown): x is HistoryItem {
  return isObj(x) && typeof x.exam === 'string' && x.exam.length > 0
    && isScore(x.score, x.total, MAX_QUESTIONS) && isPct(x.pct) && isTime(x.at) && checkTopics(x.topics)
}

function checkSetScore(x: unknown): x is SetScore {
  return isObj(x) && isScore(x.score, x.total, 1000) && isPct(x.pct) && isTime(x.at)
}

// ── (a) unfinished attempt ──
/** The saved attempt for this key, or null. A broken or expired one is removed. */
export function readAttempt(storage: StorageLike, key: string, now: number): MockAttempt | null {
  const x = readJson(storage, key)
  if (x === undefined) return null
  const a = checkAttempt(x, now)
  if (!a) safeRemove(storage, key)
  return a
}

/** Saves the attempt; false when it has the wrong shape or storage refuses it. */
export function saveAttempt(storage: StorageLike, key: string, attempt: MockAttempt, now: number): boolean {
  if (!checkAttempt(attempt, now)) return false
  return safeSet(storage, key, JSON.stringify(attempt))
}

export function removeAttempt(storage: StorageLike, key: string): boolean {
  return safeRemove(storage, key)
}

/** Removes every expired or broken `ab_mock_v1:*` key; other keys stay. Returns how many went. */
export function clearExpiredAttempts(storage: StorageLike, now: number): number {
  const keys = safeKeys(storage)
  if (!keys) return 0
  let n = 0
  for (const k of keys) {
    if (!k.startsWith(MOCK_ATTEMPT_PREFIX)) continue
    const x = readJson(storage, k)
    if (x === undefined) continue
    if (!checkAttempt(x, now) && safeRemove(storage, k)) n++
  }
  return n
}

// ── (b) mock-exam history ──
export function readHistory(storage: StorageLike): HistoryItem[] | null {
  const x = readJson(storage, MOCK_HISTORY_KEY)
  if (x === undefined) return null
  if (isObj(x) && x.v === 1 && Array.isArray(x.items) && x.items.length <= MAX_HISTORY && x.items.every(checkHistoryItem)) {
    return x.items as HistoryItem[]
  }
  safeRemove(storage, MOCK_HISTORY_KEY)
  return null
}

/** Adds the item first; keeps the newest 10. */
export function addHistory(storage: StorageLike, item: HistoryItem): boolean {
  if (!checkHistoryItem(item)) return false
  const items = [item, ...(readHistory(storage) ?? [])].slice(0, MAX_HISTORY)
  return safeSet(storage, MOCK_HISTORY_KEY, JSON.stringify({ v: 1, items }))
}

/** The newest result of this exam (`<level>:<module>`), or null. */
export function lastResult(storage: StorageLike, exam: string): HistoryItem | null {
  return (readHistory(storage) ?? []).find(i => i.exam === exam) ?? null
}

// ── (c) practice sets ──
export function readSets(storage: StorageLike): Record<string, SetScore> | null {
  const x = readJson(storage, PRACTICE_SETS_KEY)
  if (x === undefined) return null
  if (isObj(x) && x.v === 1 && isObj(x.sets)) {
    const entries = Object.entries(x.sets)
    if (entries.length <= MAX_SETS && entries.every(([k, s]) => k.length > 0 && checkSetScore(s))) {
      return x.sets as Record<string, SetScore>
    }
  }
  safeRemove(storage, PRACTICE_SETS_KEY)
  return null
}

export function lastSetScore(storage: StorageLike, setSlug: string): SetScore | null {
  const sets = readSets(storage)
  return sets && Object.prototype.hasOwnProperty.call(sets, setSlug) ? sets[setSlug] : null
}

/** Saves this set's score; keeps at most 200 sets, dropping the oldest first. */
export function saveSetScore(storage: StorageLike, setSlug: string, s: { score: number; total: number; pct: number }, now: number): boolean {
  const item: SetScore = { score: s.score, total: s.total, pct: s.pct, at: now }
  if (!setSlug || !checkSetScore(item)) return false
  const sets: Record<string, SetScore> = { ...(readSets(storage) ?? {}) }
  delete sets[setSlug]
  const kept = Object.entries(sets).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_SETS - 1)
  const next: Record<string, SetScore> = Object.fromEntries(kept)
  next[setSlug] = item
  return safeSet(storage, PRACTICE_SETS_KEY, JSON.stringify({ v: 1, sets: next }))
}

// ── (d) helpers ──
/** Correct/total per topic, in the order each topic first appears. */
export function topicScores(questions: { topic: string; correctIndex: number }[], answers: Record<number, number>): TopicScore[] {
  const out: TopicScore[] = []
  const at = new Map<string, TopicScore>()
  questions.forEach((q, i) => {
    let t = at.get(q.topic)
    if (!t) { t = { topic: q.topic, correct: 0, total: 0 }; at.set(q.topic, t); out.push(t) }
    t.total++
    if (answers[i] === q.correctIndex) t.correct++
  })
  return out
}

/** "27 November 2026", in English, in the visitor's own time zone. */
export function formatLastResultDate(at: number, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', ...(timeZone ? { timeZone } : {}) }).format(new Date(at))
}

/**
 * The cookie page's "Forget" button: removes every `ab_mock_v1:*` key,
 * `ab_mock_hist_v1` and `ab_pq_v1`, and nothing else. False when storage
 * could not be read or changed.
 */
export function clearPracticeData(storage: StorageLike): boolean {
  const keys = safeKeys(storage)
  if (!keys) return false
  let ok = true
  for (const k of keys) {
    if (k.startsWith(MOCK_ATTEMPT_PREFIX) || k === MOCK_HISTORY_KEY || k === PRACTICE_SETS_KEY) {
      if (!safeRemove(storage, k)) ok = false
    }
  }
  return ok
}
