import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// JD-2 (board #7 A4-02, D300): the primary of a group of duplicate adverts is
// the live copy that ends last (expires_at; none = latest). Ties on the end:
// the current sticky primary if it is among them, else the earliest created,
// else the lowest id. So a marked copy never ends after its primary.

const MODULE_PATH = '@/lib/job-duplicates'
type DuplicatesModule = typeof import('@/lib/job-duplicates')
const load = () => import(/* @vite-ignore */ MODULE_PATH) as Promise<DuplicatesModule>

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

type Row = {
  id: string
  title: string
  company_name: string | null
  provider_id: string | null
  source: string | null
  platform: string[] | null
  created_at: string
  ai_duplicate_of: string | null
  expires_at?: string | null
}

const BASE = Date.parse('2026-11-01T00:00:00.000Z')
const at = (minutes: number) => new Date(BASE + minutes * 60_000).toISOString()
const day = (days: number) => new Date(BASE + days * 86_400_000).toISOString()

function row(id: string, created: number, options: Partial<Row> = {}): Row {
  return {
    id,
    title: 'Tax Manager',
    company_name: 'Acme Recruitment',
    provider_id: 'prov-1',
    source: 'adzuna',
    platform: ['ab'],
    created_at: at(created),
    ai_duplicate_of: null,
    ...options,
  }
}

async function planOf(rows: Row[]) {
  const { planDuplicateMarks } = await load()
  const plan = planDuplicateMarks(rows)
  return {
    groups: plan.groups,
    toMark: plan.toMark,
    toClear: plan.toClear,
    unchanged: plan.unchanged,
    final: Object.fromEntries(rows.map((r) => [r.id, plan.finalMark(r.id)])),
  }
}

// The test's own reading of an end date: none or unparseable = no end.
const endOf = (r: Row) => {
  if (typeof r.expires_at !== 'string') return Number.POSITIVE_INFINITY
  const t = Date.parse(r.expires_at)
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t
}

// ── G1 the rule ─────────────────────────────────────────────────────────────

describe('G1 the primary is the copy that ends last', () => {
  it('the oldest copy ends first: the copy ending last is the primary, the others (incl. the oldest) are marked to it', async () => {
    const plan = await planOf([row('a', 1, { expires_at: day(5) }), row('b', 2, { expires_at: day(10) }), row('c', 3, { expires_at: day(7) })])
    expect(plan.groups).toBe(1)
    expect(plan.toMark).toStrictEqual([['b', ['a', 'c']]])
    expect(plan.toClear).toStrictEqual([])
    expect(plan.unchanged).toBe(1)
    expect(plan.final).toStrictEqual({ a: 'b', b: null, c: 'b' })
  })

  it('a copy with no end date (null, absent or unparseable) beats any dated copy', async () => {
    for (const none of [null, undefined, 'not-a-date']) {
      const plan = await planOf([row('a', 1, { expires_at: day(30) }), row('b', 2, { expires_at: none }), row('c', 3, { expires_at: day(400) })])
      expect(plan.toMark).toStrictEqual([['b', ['a', 'c']]])
      expect(plan.final).toStrictEqual({ a: 'b', b: null, c: 'b' })
    }
  })

  it('end dates are compared as times, not as text (an offset spelling does not win by its letters)', async () => {
    // '…10T00:00:00+01:00' is 09T23:00Z: earlier than 09T23:30Z although it sorts later as text
    const plan = await planOf([row('a', 1, { expires_at: '2026-12-10T00:00:00+01:00' }), row('b', 2, { expires_at: '2026-12-09T23:30:00.000Z' })])
    expect(plan.toMark).toStrictEqual([['b', ['a']]])
  })

  it('equal ends: the current sticky primary stays when it is among the tied rows', async () => {
    const plan = await planOf([
      row('a', 1, { expires_at: day(10) }),
      row('p', 5, { expires_at: day(10) }),
      row('c1', 6, { expires_at: day(3), ai_duplicate_of: 'p' }),
    ])
    expect(plan.toMark).toStrictEqual([['p', ['a']]])
    expect(plan.toClear).toStrictEqual([])
    expect(plan.unchanged).toBe(2)
    expect(plan.final).toStrictEqual({ a: 'p', p: null, c1: 'p' })
  })

  it('equal ends without the sticky primary among them: the earliest created of the tied rows; the old primary is marked', async () => {
    const plan = await planOf([
      row('p', 0, { expires_at: day(3) }),
      row('x', 4, { expires_at: day(10) }),
      row('y', 2, { expires_at: day(10), ai_duplicate_of: 'p' }),
      row('z', 5, { expires_at: day(1), ai_duplicate_of: 'p' }),
    ])
    expect(plan.toClear).toStrictEqual(['y'])
    expect(plan.toMark).toStrictEqual([['y', ['p', 'x', 'z']]])
    expect(plan.unchanged).toBe(0)
    expect(plan.final).toStrictEqual({ p: 'y', x: 'y', y: null, z: 'y' })
  })

  it('equal ends and equal created_at: the lowest id', async () => {
    const plan = await planOf([row('m', 5, { expires_at: day(9) }), row('k', 5, { expires_at: day(9) }), row('z', 5, { expires_at: day(9) }), row('a', 5, { expires_at: day(2) })])
    expect(plan.toMark).toStrictEqual([['k', ['a', 'm', 'z']]])
  })

  it('a live copy that ends strictly later replaces the current primary: old primary marked, copies re-pointed', async () => {
    const plan = await planOf([
      row('p', 0, { expires_at: day(10) }),
      row('a', 1, { expires_at: day(10), ai_duplicate_of: 'p' }),
      row('b', 2, { expires_at: day(4), ai_duplicate_of: 'p' }),
      row('n', 9, { expires_at: day(11) }),
    ])
    expect(plan.toClear).toStrictEqual([])
    expect(plan.toMark).toStrictEqual([['n', ['a', 'b', 'p']]])
    expect(plan.unchanged).toBe(1)
    expect(plan.final).toStrictEqual({ p: 'n', a: 'n', b: 'n', n: null })
  })

  it('a marked copy that now ends last becomes the primary: it is cleared, the rest move to it', async () => {
    const plan = await planOf([
      row('p', 0, { expires_at: day(5) }),
      row('c', 3, { expires_at: day(20), ai_duplicate_of: 'p' }),
      row('d', 4, { expires_at: day(6), ai_duplicate_of: 'p' }),
    ])
    expect(plan.toClear).toStrictEqual(['c'])
    expect(plan.toMark).toStrictEqual([['c', ['d', 'p']]])
    expect(plan.unchanged).toBe(0)
    expect(plan.final).toStrictEqual({ p: 'c', c: null, d: 'c' })
  })
})

// ── G2 the invariant on random groups ──────────────────────────────────────

// mulberry32: a small seeded generator, so every run sees the same groups.
function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

function randomRows(seed: number, groupCount: number, withEnds: boolean) {
  const rand = seeded(seed)
  const int = (n: number) => Math.floor(rand() * n)
  const rows: Row[] = []
  const groupOf = new Map<string, number>()
  const keyless = new Set<string>()
  for (let g = 0; g < groupCount; g++) {
    const size = 2 + int(7)
    const ids: string[] = []
    for (let r = 0; r < size; r++) ids.push(`${int(4096).toString(16).padStart(3, '0')}-${g}-${r}`)
    for (const id of ids) {
      let expires: string | null | undefined
      if (withEnds) {
        const pick = rand()
        if (pick < 0.15) expires = null
        else if (pick < 0.2) expires = undefined
        else if (pick < 0.3) expires = day(int(30)).replace('.000Z', '+00:00')
        else expires = day(int(30))
      }
      const markPick = rand()
      const mark = markPick < 0.5 ? null
        : markPick < 0.8 ? ids[int(ids.length)]
        : markPick < 0.85 ? id
        : markPick < 0.95 ? 'gone'
        : `${int(4096).toString(16).padStart(3, '0')}-${int(groupCount)}-0`
      const created = rand() < 0.3 ? int(5) : int(1000)
      const r: Row = row(id, created, { title: `Role ${g}`, ai_duplicate_of: mark })
      if (withEnds) r.expires_at = expires
      else delete r.expires_at
      rows.push(r)
      groupOf.set(id, g)
    }
    if (g % 10 === 0) {
      const emp = row(`emp-${g}`, int(1000), { title: `Role ${g}`, source: 'employer', provider_id: null, ai_duplicate_of: ids[0], ...(withEnds ? { expires_at: null } : {}) })
      const nop = row(`nop-${g}`, int(1000), { title: `Role ${g}`, provider_id: null, ai_duplicate_of: rand() < 0.5 ? ids[1] : null })
      rows.push(emp, nop)
      keyless.add(emp.id).add(nop.id)
    }
  }
  // shuffle, so input order plays no part
  for (let i = rows.length - 1; i > 0; i--) {
    const j = int(i + 1)
    ;[rows[i], rows[j]] = [rows[j], rows[i]]
  }
  return { rows, groupOf, keyless }
}

describe('G2 the invariant on 600 seeded random groups', () => {
  it('a marked row never ends after its primary; no chains, no self-marks; one unmarked row per group; keyless rows never marked; the plan reproduces the final marks', async () => {
    const { planDuplicateMarks } = await load()
    const { rows, groupOf, keyless } = randomRows(20261122, 600, true)
    const byId = new Map(rows.map((r) => [r.id, r]))
    const plan = planDuplicateMarks(rows)
    expect(plan.groups).toBe(600)

    let marked = 0
    const unmarkedPerGroup = new Map<number, number>()
    for (const r of rows) {
      const target = plan.finalMark(r.id)
      if (keyless.has(r.id)) {
        expect(target).toBeNull()
        continue
      }
      const g = groupOf.get(r.id)!
      if (target === null) {
        unmarkedPerGroup.set(g, (unmarkedPerGroup.get(g) ?? 0) + 1)
        continue
      }
      marked++
      expect(target).not.toBe(r.id)
      expect(plan.finalMark(target)).toBeNull()
      expect(groupOf.get(target)).toBe(g)
      expect(keyless.has(target)).toBe(false)
      expect(endOf(byId.get(target)!)).toBeGreaterThanOrEqual(endOf(r))
    }
    expect(marked).toBeGreaterThan(1000)
    expect(unmarkedPerGroup.size).toBe(600)
    for (const count of Array.from(unmarkedPerGroup.values())) expect(count).toBe(1)

    // applying toClear and toMark to the current marks gives every final mark
    const applied = new Map(rows.map((r) => [r.id, r.ai_duplicate_of ?? null]))
    for (const id of plan.toClear) applied.set(id, null)
    for (const [primary, ids] of plan.toMark) for (const id of ids) applied.set(id, primary)
    for (const r of rows) expect(applied.get(r.id)).toBe(plan.finalMark(r.id))
    expect(plan.unchanged + plan.toClear.length + plan.toMark.reduce((n, [, ids]) => n + ids.length, 0)).toBe(rows.length)
  })

  it('the same plan whatever the input order (seeded rows, reversed)', async () => {
    const { planDuplicateMarks } = await load()
    const { rows } = randomRows(7, 200, true)
    const forward = planDuplicateMarks(rows)
    const backward = planDuplicateMarks([...rows].reverse())
    expect(backward.toMark).toStrictEqual(forward.toMark)
    expect(backward.toClear).toStrictEqual(forward.toClear)
    for (const r of rows) expect(backward.finalMark(r.id)).toBe(forward.finalMark(r.id))
  })
})

// ── G3 unchanged when no row carries an end date ───────────────────────────

// Reference: today's rule, copied verbatim from lib/job-duplicates.ts on
// origin/main b1cf6dd (createdTime :67-70, earliestFirst :72-77, primaryOf
// :79-88), with the row type renamed to this file's Row.
function createdTime(row: Row): number {
  const parsed = Date.parse(row.created_at)
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
}

function earliestFirst(a: Row, b: Row): number {
  const ta = createdTime(a)
  const tb = createdTime(b)
  if (ta !== tb) return ta < tb ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function primaryOf(group: Row[]): Row {
  const members = new Map(group.map(row => [row.id, row]))
  const targets = new Set<string>()
  for (const row of group) if (row.ai_duplicate_of) targets.add(row.ai_duplicate_of)
  if (targets.size === 1) {
    const sticky = members.get(Array.from(targets)[0])
    if (sticky && !sticky.ai_duplicate_of) return sticky
  }
  return [...group].sort(earliestFirst)[0]
}

// Final marks under today's rule (grouping by the module's own key).
async function legacyFinal(rows: Row[]): Promise<Record<string, string | null>> {
  const { duplicateKey } = await load()
  const groups = new Map<string, Row[]>()
  const final: Record<string, string | null> = {}
  for (const r of rows) {
    final[r.id] = null
    const key = duplicateKey(r)
    if (key === null) continue
    groups.set(key, [...(groups.get(key) ?? []), r])
  }
  for (const group of Array.from(groups.values())) {
    if (group.length < 2) continue
    const primary = primaryOf(group)
    for (const r of group) if (r.id !== primary.id) final[r.id] = primary.id
  }
  return final
}

const LEGACY: Array<[string, Row[]]> = [
  ['a new group of three', [row('c', 3), row('a', 1), row('b', 2)]],
  ['equal created_at', [row('m', 5), row('k', 5), row('z', 5)]],
  ['sticky with an older copy', [row('old', 0), row('p', 5), row('c1', 6, { ai_duplicate_of: 'p' }), row('c2', 7, { ai_duplicate_of: 'p' })]],
  ['primary no longer live', [row('b', 2, { ai_duplicate_of: 'gone' }), row('c', 3, { ai_duplicate_of: 'gone' }), row('d', 4, { ai_duplicate_of: 'gone' })]],
  ['chained target', [row('a', 1), row('b', 2, { ai_duplicate_of: 'c' }), row('c', 3, { ai_duplicate_of: 'a' })]],
  ['two targets', [row('a', 1, { ai_duplicate_of: 'b' }), row('b', 2), row('c', 3, { ai_duplicate_of: 'a' })]],
  ['self marks and an employer row', [row('a', 1, { ai_duplicate_of: 'a' }), row('b', 2, { ai_duplicate_of: 'b' }), row('e', 0, { source: 'employer', ai_duplicate_of: 'a' })]],
  ['already correct', [row('a', 1), row('b', 2, { ai_duplicate_of: 'a' }), row('c', 3, { ai_duplicate_of: 'a' })]],
]

describe('G3 no end dates: the same plan as today', () => {
  it.each(LEGACY)('%s: same final marks as today\'s rule (no expires_at, and all ends equal)', async (_name, rows) => {
    expect((await planOf(rows)).final).toStrictEqual(await legacyFinal(rows))
    const equalEnds = rows.map((r) => ({ ...r, expires_at: '2099-01-01T00:00:00.000Z' }))
    expect((await planOf(equalEnds)).final).toStrictEqual(await legacyFinal(equalEnds))
  })

  it('600 seeded groups without expires_at: the same final marks as today\'s rule', async () => {
    const { rows } = randomRows(4242, 600, false)
    expect(rows.every((r) => !('expires_at' in r))).toBe(true)
    expect((await planOf(rows)).final).toStrictEqual(await legacyFinal(rows))
  })
})

// ── G4 the input ────────────────────────────────────────────────────────────

describe('G4 the nightly read carries the end date', () => {
  const OLD = 'id,title,location_country,platform,published_at,created_at,company_name,provider_id,source,ai_duplicate_of'

  it('LIVE_JOB_COLUMNS is today\'s string with ,expires_at appended', async () => {
    const { LIVE_JOB_COLUMNS } = await import('@/lib/similar-jobs')
    expect(LIVE_JOB_COLUMNS).toBe(`${OLD},expires_at`)
    expect(LIVE_JOB_COLUMNS.split(',').filter((c) => c === 'expires_at')).toHaveLength(1)
  })

  it('LiveJobRow and DuplicateCandidateRow carry an optional expires_at', () => {
    const block = (source: string, name: string) => {
      const start = source.indexOf(`export interface ${name} {`)
      expect(start).toBeGreaterThan(-1)
      return source.slice(start, source.indexOf('\n}', start))
    }
    expect(block(read('lib/similar-jobs.ts'), 'LiveJobRow')).toContain('\n  expires_at?: string | null')
    expect(block(read('lib/job-duplicates.ts'), 'DuplicateCandidateRow')).toContain('\n  expires_at?: string | null')
  })

  it('the route still selects LIVE_JOB_COLUMNS with the same live filter', () => {
    const route = read('app/api/cron/similar-jobs/route.ts')
    expect(route).toContain('.select(LIVE_JOB_COLUMNS)')
    expect(route.match(/\.select\(/g)).toHaveLength(1)
    expect(route).toContain(".eq('status', 'active')\n        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)")
  })
})

// ── G5 scope ────────────────────────────────────────────────────────────────

describe('G5 nothing else changes', () => {
  it('the ingest characterisation file is unchanged', () => {
    const hash = createHash('sha256').update(readFileSync(join(ROOT, 'app/api/ingest/[slug]/route.test.ts'))).digest('hex')
    expect(hash).toBe('99c20fa8a9d3934f6cd3cc9daa43e9030bdcb04e0e196dec89274262c22eb627')
  })

  it('write order (clears before marks), batch size 100 and the 120 s budget are unchanged', async () => {
    const { DUPLICATE_WRITE_BATCH } = await load()
    const { DUPLICATE_MARK_BUDGET_MS } = await import('@/lib/similar-jobs')
    expect(DUPLICATE_WRITE_BATCH).toBe(100)
    expect(DUPLICATE_MARK_BUDGET_MS).toBe(120_000)
    const source = read('lib/similar-jobs.ts')
    const clears = source.indexOf('...writeBatches(plan.toClear).map(ids => () => marks.store.clearMarks(ids)),')
    const marks = source.indexOf('...plan.toMark.flatMap(([primaryId, ids]) => writeBatches(ids).map(batch => () => marks.store.markCopies(primaryId, batch))),')
    expect(clears).toBeGreaterThan(-1)
    expect(marks).toBeGreaterThan(clears)
  })

  it('the rule module still reads no settings, Next or database and imports from lib/jobs only', () => {
    const source = read('lib/job-duplicates.ts')
    const imports = source.match(/^import .* from '([^']+)'$/gm) ?? []
    expect(imports.map((line) => line.replace(/^.* from '([^']+)'$/, '$1'))).toStrictEqual(['@/lib/jobs'])
    for (const banned of ['next/', '@supabase/', 'process.env', 'Date.now']) expect(source).not.toContain(banned)
  })
})
