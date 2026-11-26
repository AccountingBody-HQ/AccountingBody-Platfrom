// lib/mock-exam-pool.ts — the question pool behind both mock-exam APIs.
//
// The pool is an index: for each published question set of a subject (AB) or
// module (ETICPA), its id, title and question ids. It is read in pages with
// an exact total, so a database row cap can never shorten it silently, and
// kept with unstable_cache + guardCachedRead for an hour, one entry per
// subject or module (a failed read throws and is never stored). Each attempt
// then picks its questions from the index with the same balanced
// round-robin as before and reads only those rows.
//
// The pool counts every question row of its sets; the served-question rule
// (lib/mock-exam-question.ts) is applied to the rows actually read, so a row
// that fails it is skipped and replaced by the next one picked.
import { unstable_cache } from 'next/cache'
import { getServerSupabase } from '@/lib/supabase-server'
import { guardCachedRead } from '@/lib/cache-guard'
import { toServableQuestion, type PoolQuestion, type QuestionRow } from '@/lib/mock-exam-question'

const PAGE_ROWS = 1000 // one request never asks for more rows than this
const IN_CHUNK = 100 // values per .in() list
const QUESTION_COLUMNS = 'id, set_id, question_text, option_a, option_b, option_c, option_d, correct_index, explanation, difficulty'

export interface PoolSet {
  id: string
  title: string
  qids: string[]
}

export interface MockPool {
  sets: PoolSet[]
}

// A failed database read. `code` is the database's short code (or one of
// ours) for the log; nothing of it reaches the visitor.
export class MockPoolReadError extends Error {
  readonly code: string
  constructor(what: string, code: unknown) {
    super(`mock exam pool: ${what} read failed`)
    this.name = 'MockPoolReadError'
    this.code = typeof code === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(code) ? code : 'no-code'
  }
}

export function isMockPoolReadError(e: unknown): e is MockPoolReadError {
  return e instanceof Error && e.name === 'MockPoolReadError'
}

interface PagedQuery {
  range(from: number, to: number): PromiseLike<{ data: unknown; error: { code?: unknown } | null; count: number | null }>
}

// Every row of one query, in pages. The query asks for the exact total and
// is ordered on a unique column, so pages neither overlap nor skip. The next
// page starts after the rows RECEIVED (a database setting may send fewer
// than asked for) until the total is in. Anything else than all rows is
// thrown, never returned. Also used by the practice-filters read (lib/db.ts).
export async function readPaged<T>(what: string, query: () => PagedQuery): Promise<T[]> {
  const rows: T[] = []
  let received = 0
  let total = 0
  do {
    const { data, error, count } = await query().range(received, received + PAGE_ROWS - 1)
    if (error) throw new MockPoolReadError(what, error.code)
    if (!Array.isArray(data)) throw new MockPoolReadError(what, 'NO_DATA')
    if (count === null || !Number.isInteger(count)) throw new MockPoolReadError(what, 'NO_TOTAL')
    if (received > 0 && count !== total) throw new MockPoolReadError(what, 'TOTAL_CHANGED')
    if (data.length === 0 && received < count) throw new MockPoolReadError(what, 'EMPTY_PAGE')
    rows.push(...(data as T[]))
    received += data.length
    total = count
  } while (received < total)
  return rows
}

// The same, for a list of values, in chunks of IN_CHUNK values.
export async function readPagedIn<T>(what: string, values: string[], query: (chunk: string[]) => PagedQuery): Promise<T[]> {
  const rows: T[] = []
  for (let start = 0; start < values.length; start += IN_CHUNK) {
    const chunk = values.slice(start, start + IN_CHUNK)
    rows.push(...(await readPaged<T>(what, () => query(chunk))))
  }
  return rows
}

// The question ids of these sets, grouped by set in the sets' order. Sets
// without questions are left out (as before: a topic needs a question).
async function poolOf(sets: { id: string; title: string | null }[]): Promise<MockPool> {
  if (sets.length === 0) return { sets: [] }
  const supabase = getServerSupabase('publicRead')
  const rows = await readPagedIn<{ id: string; set_id: string }>('questions', sets.map(s => s.id), chunk =>
    supabase.from('questions').select('id, set_id', { count: 'exact' }).in('set_id', chunk).order('id', { ascending: true }))
  const bySet = new Map<string, string[]>()
  for (const row of rows) {
    const list = bySet.get(row.set_id) ?? []
    list.push(row.id)
    bySet.set(row.set_id, list)
  }
  return {
    sets: sets
      .filter(s => (bySet.get(s.id)?.length ?? 0) > 0)
      .map(s => ({ id: s.id, title: s.title ?? '', qids: bySet.get(s.id) as string[] })),
  }
}

// AB: the published AB sets whose article is a published article of the
// subject (the same rule as before).
async function readAbPool(category: string): Promise<MockPool> {
  const supabase = getServerSupabase('publicRead')
  const articles = await readPaged<{ slug: string }>('articles', () =>
    supabase.from('articles').select('slug', { count: 'exact' })
      .eq('category', category).eq('status', 'published').order('slug', { ascending: true }))
  const slugs = new Set(articles.map(a => a.slug))
  const sets = await readPaged<{ id: string; title: string | null; article_slug: string | null }>('question_sets', () =>
    supabase.from('question_sets').select('id, title, article_slug', { count: 'exact' })
      .eq('status', 'published').contains('show_on_sites', ['ab']).not('article_slug', 'is', null)
      .order('id', { ascending: true }))
  return poolOf(sets.filter(s => s.article_slug && slugs.has(s.article_slug)))
}

// ETICPA: the published ET sets of the level and module.
async function readEticpaPool(level: string, moduleSlug: string): Promise<MockPool> {
  const supabase = getServerSupabase('publicRead')
  const sets = await readPaged<{ id: string; title: string | null }>('question_sets', () =>
    supabase.from('question_sets').select('id, title', { count: 'exact' })
      .eq('status', 'published').contains('show_on_sites', ['et'])
      .eq('eticpa_level', level).eq('eticpa_module', moduleSlug)
      .order('id', { ascending: true }))
  return poolOf(sets)
}

const AB_POOL_KEY = ['mock-exam-pool', 'ab']
const ETICPA_POOL_KEY = ['mock-exam-pool', 'eticpa']

const guardedAbPool = guardCachedRead(AB_POOL_KEY, (category: string) =>
  unstable_cache(readAbPool, AB_POOL_KEY, { revalidate: 3600, tags: ['question-sets', 'mock-exam-pool'] })(category))

const guardedEticpaPool = guardCachedRead(ETICPA_POOL_KEY, (level: string, moduleSlug: string) =>
  unstable_cache(readEticpaPool, ETICPA_POOL_KEY, { revalidate: 3600, tags: ['question-sets', 'mock-exam-pool'] })(level, moduleSlug))

/** The AB pool of one subject; throws on any failed read. */
export function getAbMockPool(category: string): Promise<MockPool> {
  return guardedAbPool(category)
}

/** The ETICPA pool of one module; throws on any failed read. */
export function getEticpaMockPool(level: string, moduleSlug: string): Promise<MockPool> {
  return guardedEticpaPool(level, moduleSlug)
}

export function poolSize(pool: MockPool): number {
  return pool.sets.reduce((sum, s) => sum + s.qids.length, 0)
}

/** Questions in an AB subject's pool, or null when the read failed. */
export async function getAbMockPoolSize(category: string): Promise<number | null> {
  try {
    return poolSize(await getAbMockPool(category))
  } catch {
    return null
  }
}

/** Questions in an ETICPA module's pool, or null when the read failed. */
export async function getEticpaMockPoolSize(level: string, moduleSlug: string): Promise<number | null> {
  try {
    return poolSize(await getEticpaMockPool(level, moduleSlug))
  } catch {
    return null
  }
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Every question of the pool in pick order: each set's ids are shuffled,
 * then the first of every set, then the second of every set, and so on. No
 * set gets a second question before every set has one.
 */
export function roundRobinOrder(pool: MockPool): { id: string; setId: string }[] {
  const groups = pool.sets.map(s => ({ setId: s.id, ids: shuffle(s.qids) }))
  const order: { id: string; setId: string }[] = []
  for (let idx = 0; ; idx++) {
    let added = false
    for (const g of groups) {
      if (g.ids[idx] !== undefined) { order.push({ id: g.ids[idx], setId: g.setId }); added = true }
    }
    if (!added) break
  }
  return order
}

export type MockExamAnswer =
  | { questions: []; poolTotal: 0 }
  | { questions: PoolQuestion[]; poolTotal: number; topicCount: number; served: number }

/**
 * Up to `count` questions from the pool: the first ones in round-robin
 * order, read by id. A row that fails the served-question rule (or has gone)
 * is replaced by the next one in the order. Never more than `count`.
 */
export async function serveFromPool(pool: MockPool, count: number): Promise<MockExamAnswer> {
  const poolTotal = poolSize(pool)
  if (poolTotal === 0) return { questions: [], poolTotal: 0 }
  const titles = new Map(pool.sets.map(s => [s.id, s.title]))
  const order = roundRobinOrder(pool)
  const target = Math.min(count, poolTotal)
  const supabase = getServerSupabase('publicRead')
  const selected: PoolQuestion[] = []
  let next = 0
  while (selected.length < target && next < order.length) {
    const batch = order.slice(next, next + (target - selected.length))
    next += batch.length
    const { data, error } = await supabase.from('questions').select(QUESTION_COLUMNS).in('id', batch.map(b => b.id))
    if (error) throw new MockPoolReadError('questions', error.code)
    const rows = new Map(((data ?? []) as unknown as (QuestionRow & { id: string })[]).map(r => [r.id, r]))
    for (const b of batch) {
      const row = rows.get(b.id)
      const q = row ? toServableQuestion(row, titles.get(b.setId) ?? '') : null
      if (q) selected.push(q)
    }
  }
  if (selected.length === 0) return { questions: [], poolTotal: 0 }
  return {
    questions: shuffle(selected),
    poolTotal,
    topicCount: pool.sets.length,
    served: selected.length,
  }
}
