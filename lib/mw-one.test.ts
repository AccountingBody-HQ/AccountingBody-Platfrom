import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// MW-1 guards (board #7, A4-02; D283, D300): the nightly duplicate-mark
// writes run a few at a time (all clears resolved first, then marks, at
// most DUPLICATE_WRITE_CONCURRENCY in flight) with the same stop rules, so
// a big night finishes inside the 120 s budget; the route logs one
// counts-only summary line. Synthetic rows only; no network.

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  queries: [] as { table: string; calls: [string, unknown[]][] }[],
  reports: [] as unknown[][],
}))

vi.mock('@/lib/report-error', () => ({
  reportServerError: (...args: unknown[]) => {
    state.reports.push(args)
  },
}))

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))

vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>) => fn,
  unstable_noStore: () => {},
  revalidateTag: () => {},
  revalidatePath: () => {},
}))

// A tiny PostgREST stand-in for the route test: keyset reads of state.rows,
// every write succeeds.
vi.mock('@/lib/supabase-server', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/supabase-server')>()
  type Q = { table: string; calls: [string, unknown[]][] }
  function evaluate(query: Q): unknown {
    const names = query.calls.map(([name]) => name)
    if (names.includes('update') || names.includes('upsert')) return { data: null, error: null }
    if (names.includes('delete')) return { data: null, error: null, count: 0 }
    let rows = [...state.rows].sort((a, b) => ((a.id as string) < (b.id as string) ? -1 : 1))
    for (const [name, args] of query.calls) {
      if (name === 'gt') rows = rows.filter((row) => (row[args[0] as string] as string) > (args[1] as string))
      if (name === 'limit') rows = rows.slice(0, args[0] as number)
    }
    return { data: rows, error: null }
  }
  const chainFor = (table: string): unknown => {
    const query: Q = { table, calls: [] }
    state.queries.push(query)
    const chain: unknown = new Proxy(function () {}, {
      get: (_target, prop) =>
        prop === 'then'
          ? (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve().then(() => evaluate(query)).then(resolve, reject)
          : (...args: unknown[]) => {
              query.calls.push([String(prop), args])
              return chain
            },
    })
    return chain
  }
  return { ...original, getServerSupabase: () => ({ from: (table: string) => chainFor(table) }) }
})

import { planDuplicateMarks, writeBatches } from '@/lib/job-duplicates'
import * as similar from '@/lib/similar-jobs'
import { computeSimilarLists, runSimilarJobsRefresh, type DuplicateMarksStore, type LiveJobRow, type SimilarListRow } from '@/lib/similar-jobs'

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const md5 = (text: string) => createHash('md5').update(text).digest('hex')
const sha256 = (path: string) => createHash('sha256').update(readFileSync(join(ROOT, path))).digest('hex')
const ROUTE_PATH = '@/app/api/cron/similar-jobs/route'
const loadCron = () => import(/* @vite-ignore */ ROUTE_PATH) as Promise<typeof import('@/app/api/cron/similar-jobs/route')>
// The pool size, read without a static import so this file type-checks
// before the constant exists (red-first).
const concurrency = () => (similar as unknown as Record<string, unknown>).DUPLICATE_WRITE_CONCURRENCY

const SWITCHES = ['JOB_DUPLICATE_MARKING', 'JOB_DUPLICATES_HIDDEN', 'CRON_SECRET'] as const
const originalEnv = Object.fromEntries(SWITCHES.map((name) => [name, process.env[name]]))
const setEnv = (name: (typeof SWITCHES)[number], value: string | undefined) => {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}
const CRON_VALUE = 'mw-one-cron-test-value'

beforeEach(() => {
  state.rows = []
  state.queries.length = 0
  state.reports.length = 0
})

afterEach(() => {
  for (const name of SWITCHES) setEnv(name, originalEnv[name])
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ── Synthetic rows ──────────────────────────────────────────────────────────

type Row = LiveJobRow & { company_name: string; provider_id: string; source: string; ai_duplicate_of: string | null; expires_at: string | null }
const BASE = Date.parse('2026-11-01T00:00:00.000Z')
const at = (minutes: number) => new Date(BASE + minutes * 60_000).toISOString()
const pad = (n: number) => String(n).padStart(4, '0')

// `groups` adverts of 1 + `copies[g % copies.length]` rows each (the first
// created is the primary; copies unmarked, so all need a mark) and `stale`
// single rows that carry a mark to a missing row (each needs a clear).
function makeRows(groups: number, copies: number[], stale = 0): Row[] {
  const rows: Row[] = []
  let minute = 0
  for (let g = 0; g < groups; g++) {
    const n = 1 + copies[g % copies.length]
    for (let k = 0; k < n; k++) {
      rows.push({
        id: k === 0 ? `p-${pad(g)}` : `q-${pad(g)}-${pad(k)}`,
        title: `Role ${g} Manager`, company_name: `Company ${g}`, provider_id: 'prov-1', source: 'adzuna',
        location_country: g % 2 ? 'Ireland' : 'United Kingdom', platform: g % 3 ? ['ab'] : ['ab', 'et'],
        published_at: at(minute), created_at: at(minute), ai_duplicate_of: null, expires_at: null,
      })
      minute++
    }
  }
  for (let s = 0; s < stale; s++) {
    rows.push({
      id: `s-${pad(s)}`, title: `Single ${s} Analyst`, company_name: `Solo ${s}`, provider_id: 'prov-1', source: 'adzuna',
      location_country: 'United Kingdom', platform: ['ab'], published_at: at(minute), created_at: at(minute), ai_duplicate_of: 'gone', expires_at: null,
    })
    minute++
  }
  return rows.sort((a, b) => (a.id < b.id ? -1 : 1))
}

// The same rows with the plan applied (what the sequential code leaves).
function withFinalMarks(rows: Row[]): Row[] {
  const plan = planDuplicateMarks(rows)
  return rows.map((row) => ({ ...row, ai_duplicate_of: plan.finalMark(row.id) }))
}

// The writes the sequential code made, in order.
function sequentialWrites(rows: Row[]): { kind: string; primary?: string; ids: string[] }[] {
  const plan = planDuplicateMarks(rows)
  return [
    ...writeBatches(plan.toClear).map((ids) => ({ kind: 'clear', ids })),
    ...plan.toMark.flatMap(([primary, ids]) => writeBatches(ids).map((batch) => ({ kind: 'mark', primary, ids: batch }))),
  ]
}

function listStore(rows: Row[], options: { readDelayMs?: number } = {}) {
  const upserts: SimilarListRow[] = []
  let deletes = 0
  const store = {
    readLivePage: async (after: string | null, limit: number) => {
      if (options.readDelayMs) await new Promise((resolve) => setTimeout(resolve, options.readDelayMs))
      return rows.filter((row) => after === null || row.id > after).slice(0, limit)
    },
    upsertLists: async (lists: SimilarListRow[]) => {
      upserts.push(...lists)
    },
    deleteStale: async () => {
      deletes++
      return 0
    },
  }
  return { store, upserts, deletes: () => deletes }
}

// Mark writes that resolve or reject only when the test says so.
type Gate = { kind: 'clear' | 'mark'; primary?: string; ids: string[]; settled: boolean; resolve: () => void; reject: (error: unknown) => void }
function gatedMarks() {
  const started: Gate[] = []
  const events: string[] = []
  let inFlight = 0
  let maxInFlight = 0
  const open = (kind: 'clear' | 'mark', ids: string[], primary?: string) =>
    new Promise<void>((resolve, reject) => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      events.push(`start:${kind}`)
      const gate: Gate = {
        kind, primary, ids, settled: false,
        resolve: () => {
          if (gate.settled) return
          gate.settled = true
          inFlight--
          events.push(`end:${kind}`)
          resolve()
        },
        reject: (error) => {
          if (gate.settled) return
          gate.settled = true
          inFlight--
          events.push(`end:${kind}`)
          reject(error)
        },
      }
      started.push(gate)
    })
  const marks: DuplicateMarksStore = {
    markCopies: (primary, ids) => open('mark', ids, primary),
    clearMarks: (ids) => open('clear', ids),
  }
  return { marks, started, events, inFlight: () => inFlight, maxInFlight: () => maxInFlight }
}

// Lets every pending promise step run (real timers only).
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function track<T>(promise: Promise<T>) {
  const box: { done: boolean; value?: T } = { done: false }
  promise.then((value) => {
    box.done = true
    box.value = value
  })
  return box
}

async function releaseAll(gated: ReturnType<typeof gatedMarks>, box: { done: boolean }) {
  for (let guard = 0; guard < 10_000 && !box.done; guard++) {
    gated.started.filter((gate) => !gate.settled).forEach((gate) => gate.resolve())
    await flush()
  }
}

type MarksOf = { groups: number; toMark: number; toClear: number; writes: number; applied: boolean; failed: boolean; timedOut: boolean; ms: number }
const marksOf = (result: unknown) => (result as { marks: MarksOf }).marks

// Lists from a run that writes nothing, on the given rows (the reference).
async function referenceLists(rows: Row[]) {
  const fake = listStore(rows)
  await runSimilarJobsRefresh(fake.store, () => 0, { marks: { write: false, store: gatedMarks().marks }, hideCopies: true })
  return fake.upserts
}

// ── G1 bounded parallelism ──────────────────────────────────────────────────

describe('G1 at most DUPLICATE_WRITE_CONCURRENCY (6) writes in flight', () => {
  it('the constant is 6', () => {
    expect(concurrency()).toBe(6)
  })

  it('20 mark batches waiting: exactly 6 start at once, a 7th only when one resolves; never more than 6', async () => {
    const rows = makeRows(20, [1])
    const gated = gatedMarks()
    const box = track(runSimilarJobsRefresh(listStore(rows).store, () => 0, { marks: { write: true, store: gated.marks } }))
    await flush()
    expect(gated.started).toHaveLength(6)
    expect(gated.inFlight()).toBe(6)
    gated.started[0].resolve()
    await flush()
    expect(gated.started).toHaveLength(7)
    expect(gated.inFlight()).toBe(6)
    await releaseAll(gated, box)
    expect(box.done).toBe(true)
    expect(gated.maxInFlight()).toBe(6)
    expect(marksOf(box.value)).toMatchObject({ writes: 20, applied: true, failed: false, timedOut: false })
  })
})

// ── G2 clears first ─────────────────────────────────────────────────────────

describe('G2 every clear resolves before the first mark starts', () => {
  it('3 clear batches (the last one slow): no mark starts until all three resolved', async () => {
    const rows = makeRows(10, [1], 250)
    const gated = gatedMarks()
    const box = track(runSimilarJobsRefresh(listStore(rows).store, () => 0, { marks: { write: true, store: gated.marks } }))
    await flush()
    expect(gated.started.map((gate) => gate.kind)).toStrictEqual(['clear', 'clear', 'clear'])
    gated.started[0].resolve()
    gated.started[1].resolve()
    await flush()
    await flush()
    expect(gated.started.filter((gate) => gate.kind === 'mark')).toHaveLength(0)
    gated.started[2].resolve()
    await flush()
    expect(gated.started.filter((gate) => gate.kind === 'mark')).toHaveLength(6)
    await releaseAll(gated, box)
    const lastClearEnd = gated.events.lastIndexOf('end:clear')
    const firstMarkStart = gated.events.indexOf('start:mark')
    expect(firstMarkStart).toBeGreaterThan(lastClearEnd)
    expect(marksOf(box.value)).toMatchObject({ toClear: 250, writes: 13, applied: true })
  })
})

// ── G3 failure ──────────────────────────────────────────────────────────────

describe('G3 the first failed write stops new starts; in-flight writes are awaited', () => {
  it('a rejected write: failed, nothing starts after it, the run waits for the 5 in flight, lists from the marks as read', async () => {
    const rows = makeRows(20, [1])
    const gated = gatedMarks()
    const fake = listStore(rows)
    const box = track(runSimilarJobsRefresh(fake.store, () => 0, { marks: { write: true, store: gated.marks }, hideCopies: true }))
    await flush()
    expect(gated.started).toHaveLength(6)
    gated.started[1].reject(Object.assign(new Error('seed'), { code: '57014' }))
    await flush()
    await flush()
    expect(gated.started).toHaveLength(6)
    expect(box.done).toBe(false)
    expect(fake.upserts).toHaveLength(0)
    gated.started.filter((gate) => !gate.settled).forEach((gate) => gate.resolve())
    await flush()
    await flush()
    expect(box.done).toBe(true)
    expect(gated.started).toHaveLength(6)
    expect(marksOf(box.value)).toMatchObject({ writes: 6, applied: false, failed: true, timedOut: false })
    expect((box.value as { markError?: { code?: string } }).markError?.code).toBe('57014')
    expect(fake.upserts).toStrictEqual(await referenceLists(rows))
    expect(fake.deletes()).toBe(1)
  })
})

// ── G4 budget ───────────────────────────────────────────────────────────────

describe('G4 past the budget nothing new starts; in-flight writes are awaited', () => {
  it('the clock passes 120 s while 6 are in flight: timedOut, no further start, marks as read, applied false', async () => {
    const rows = makeRows(20, [1])
    const gated = gatedMarks()
    const fake = listStore(rows)
    const T0 = Date.parse('2026-11-23T03:04:00.000Z')
    let now = T0
    const box = track(runSimilarJobsRefresh(fake.store, () => now, { marks: { write: true, store: gated.marks }, hideCopies: true }))
    await flush()
    expect(gated.started).toHaveLength(6)
    now = T0 + 120_001
    gated.started[0].resolve()
    await flush()
    expect(gated.started).toHaveLength(6)
    expect(box.done).toBe(false)
    gated.started.forEach((gate) => gate.resolve())
    await flush()
    await flush()
    expect(box.done).toBe(true)
    expect(gated.started).toHaveLength(6)
    expect(marksOf(box.value)).toStrictEqual({ groups: 20, toMark: 20, toClear: 0, writes: 6, applied: false, failed: false, timedOut: true, ms: 120_001 })
    expect(fake.upserts).toStrictEqual(await referenceLists(rows))
  })
})

// ── G5 same result ──────────────────────────────────────────────────────────

describe('G5 the same writes and the same lists as the sequential code', () => {
  it('groups of 1-130 copies plus 150 clears (> 6 batches): every write the old code made, started in the same order; lists as with the marks in place', async () => {
    const rows = makeRows(9, [130, 2, 1], 150)
    const writes: { kind: string; primary?: string; ids: string[] }[] = []
    const marks: DuplicateMarksStore = {
      markCopies: async (primary, ids) => {
        writes.push({ kind: 'mark', primary, ids })
      },
      clearMarks: async (ids) => {
        writes.push({ kind: 'clear', ids })
      },
    }
    const expected = sequentialWrites(rows)
    expect(expected.length).toBeGreaterThan(6)
    expect(new Set(expected.filter((write) => write.kind === 'mark').map((write) => write.primary)).size).toBeGreaterThanOrEqual(3)
    const fake = listStore(rows)
    const result = await runSimilarJobsRefresh(fake.store, () => 0, { marks: { write: true, store: marks }, hideCopies: true })
    expect(writes).toStrictEqual(expected)
    expect(marksOf(result)).toMatchObject({ writes: expected.length, applied: true, failed: false, timedOut: false })
    expect(fake.upserts).toStrictEqual(await referenceLists(withFinalMarks(rows)))
    const plain = listStore(rows)
    await runSimilarJobsRefresh(plain.store, () => 0, { marks: { write: true, store: marks }, hideCopies: false })
    expect(plain.upserts).toStrictEqual(computeSimilarLists(rows))
  })
})

// ── G6 time ─────────────────────────────────────────────────────────────────

describe('G6 a 1,200-statement night fits the budget', () => {
  // Reads: 3 pages x 4 s = 12 s. Each write 100 ms.
  // One at a time: 12 s + 1,200 x 0.1 s = 132 s > 120 s -> stops after 1,081 writes.
  // 6 at a time:   12 s + 200 x 0.1 s  = 32 s  < 120 s -> applied; marking ms = 20,000.
  const night = () => makeRows(1_200, [1])
  const slowWrites = (): DuplicateMarksStore => ({
    markCopies: () => new Promise((resolve) => setTimeout(resolve, 100)),
    clearMarks: () => new Promise((resolve) => setTimeout(resolve, 100)),
  })

  it('with the pool: applied, 1,200 writes, ms = 20,000', async () => {
    vi.useFakeTimers({ now: Date.parse('2026-11-23T03:04:00.000Z') })
    const rows = night()
    expect(sequentialWrites(rows)).toHaveLength(1_200)
    const running = runSimilarJobsRefresh(listStore(rows, { readDelayMs: 4_000 }).store, () => Date.now(), { marks: { write: true, store: slowWrites() } })
    await vi.runAllTimersAsync()
    const result = await running
    expect(marksOf(result)).toStrictEqual({ groups: 1_200, toMark: 1_200, toClear: 0, writes: 1_200, applied: true, failed: false, timedOut: false, ms: 20_000 })
  })

  it('one at a time (the old loop, same budget rule) would not: it stops after 1,081 writes', async () => {
    vi.useFakeTimers({ now: Date.parse('2026-11-23T03:04:00.000Z') })
    const startedAt = Date.now()
    const store = slowWrites()
    const steps = sequentialWrites(night()).map((write) => () => store.markCopies(write.primary ?? '', write.ids))
    const oneAtATime = async () => {
      await new Promise((resolve) => setTimeout(resolve, 12_000))
      let writes = 0
      for (const step of steps) {
        if (Date.now() - startedAt > similar.DUPLICATE_MARK_BUDGET_MS) return { writes, timedOut: true }
        writes++
        await step()
      }
      return { writes, timedOut: false }
    }
    const running = oneAtATime()
    await vi.runAllTimersAsync()
    expect(await running).toStrictEqual({ writes: 1_081, timedOut: true })
  })
})

// ── G7 the log line ─────────────────────────────────────────────────────────

const LOG_LINE = /^cron\/similar-jobs: marks groups=\d+ toMark=\d+ toClear=\d+ writes=\d+ applied=(true|false) failed=(true|false) timedOut=(true|false) ms=\d+$/

describe('G7 one counts-only summary line', () => {
  const request = () => new NextRequest('https://example.test/api/cron/similar-jobs', { headers: { authorization: `Bearer ${CRON_VALUE}` } })

  it.each([['on'], [undefined]])('JOB_DUPLICATE_MARKING %j: exactly one line, the eight fields in order, equal to the answer, no id', async (value) => {
    setEnv('CRON_SECRET', CRON_VALUE)
    setEnv('JOB_DUPLICATE_MARKING', value)
    const rows = makeRows(5, [2], 3)
    state.rows = rows as unknown as Record<string, unknown>[]
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { GET } = await loadCron()
    const response = await GET(request())
    const body = await response.json()
    expect(response.status).toBe(200)
    const lines = log.mock.calls.filter((call) => String(call[0]).startsWith('cron/similar-jobs:'))
    expect(lines).toHaveLength(1)
    expect(lines[0]).toHaveLength(1)
    const line = String(lines[0][0])
    expect(line).toMatch(LOG_LINE)
    const m = body.marks as MarksOf
    expect(line).toBe(`cron/similar-jobs: marks groups=${m.groups} toMark=${m.toMark} toClear=${m.toClear} writes=${m.writes} applied=${m.applied} failed=${m.failed} timedOut=${m.timedOut} ms=${m.ms}`)
    for (const row of rows) expect(line).not.toContain(row.id)
    expect(m).toMatchObject(value === 'on' ? { groups: 5, toMark: 10, toClear: 3, writes: 6, applied: true } : { writes: 0, applied: false, ms: 0 })
  })

  it('static: the route has one console.log, the summary, after the failure report and before the answer', () => {
    const route = read('app/api/cron/similar-jobs/route.ts')
    expect(route.match(/console\.log\(/g)).toHaveLength(1)
    const lines = route.split('\n').filter((line) => line.includes('console.log('))
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('cron/similar-jobs: marks groups=${result.marks.groups} toMark=${result.marks.toMark} toClear=${result.marks.toClear} writes=${result.marks.writes} applied=${result.marks.applied} failed=${result.marks.failed} timedOut=${result.marks.timedOut} ms=${result.marks.ms}')
    expect(route.indexOf('console.log(')).toBeGreaterThan(route.indexOf("reportServerError('similar jobs marking failed'"))
    expect(route.indexOf('console.log(')).toBeLessThan(route.indexOf('return NextResponse.json({ ok: true'))
  })
})

// ── G8 scope and identity ───────────────────────────────────────────────────

const SCOPE = ['lib/similar-jobs.ts', 'app/api/cron/similar-jobs/route.ts', 'lib/mw-one.test.ts', 'lib/jd-one.test.ts']

describe('G8 nothing else changes', () => {
  it('no MW-1 commit touches a file out of scope (checked where the history is available)', () => {
    const commits = execFileSync('git', ['log', '--format=%H', '--grep=^MW-1:', 'HEAD'], { encoding: 'utf8' }).split('\n').filter(Boolean)
    const touched = commits.flatMap((sha) => execFileSync('git', ['diff-tree', '-r', '--name-only', '--no-commit-id', sha], { encoding: 'utf8' }).split('\n').filter(Boolean))
    for (const file of touched) expect(SCOPE).toContain(file)
  })

  it('the rule module, the ingest characterisation file and the route outside the one log line are byte-identical', () => {
    expect(sha256('lib/job-duplicates.ts')).toBe('149dd3b0f06cd681464d38bc75c0ca3b0e77b0d244f9e534fb23143416175928')
    expect(sha256('app/api/ingest/[slug]/route.test.ts')).toBe('99c20fa8a9d3934f6cd3cc9daa43e9030bdcb04e0e196dec89274262c22eb627')
    const route = read('app/api/cron/similar-jobs/route.ts')
    const withoutLog = route.split('\n').filter((line) => !line.includes('console.log(')).join('\n')
    expect(md5(withoutLog)).toBe('40cdcf14223d69982c4e492e67eea14e')
    const stores = route.slice(route.indexOf('  const store: SimilarJobsStore = {'), route.indexOf('  return { store, marks }'))
    expect(md5(stores)).toBe('96767440d3e174f14451f98dbafa3266')
  })

  it('the columns, the budget and the batch size are unchanged', () => {
    expect(similar.LIVE_JOB_COLUMNS).toBe('id,title,location_country,platform,published_at,created_at,company_name,provider_id,source,ai_duplicate_of,expires_at')
    expect(similar.DUPLICATE_MARK_BUDGET_MS).toBe(120_000)
    expect(writeBatches(Array.from({ length: 101 }, (_, i) => String(i))).map((batch) => batch.length)).toStrictEqual([100, 1])
  })

  it('the run module still reads no settings and adds no dependency', () => {
    const source = read('lib/similar-jobs.ts')
    expect(source).not.toContain('process.env')
    const imports = source.match(/^import .* from '([^']+)'$/gm) ?? []
    expect(imports.map((line) => line.replace(/^.* from '([^']+)'$/, '$1'))).toStrictEqual(['@/lib/jobs', '@/lib/job-duplicates'])
  })
})
