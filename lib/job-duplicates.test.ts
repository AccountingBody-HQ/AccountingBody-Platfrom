import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// JD-1 G1 (D283): which live imported jobs are extra copies of one advert,
// and which row of each group is the primary. Pure rules on fixtures only.

// Loaded per test, so each guard fails on its own while the module is missing.
const MODULE_PATH = '@/lib/job-duplicates'
type DuplicatesModule = typeof import('@/lib/job-duplicates')
const load = () => import(/* @vite-ignore */ MODULE_PATH) as Promise<DuplicatesModule>

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

type Row = {
  id: string
  title: string
  company_name: string | null
  provider_id: string | null
  source: string | null
  platform: string[] | null
  created_at: string
  ai_duplicate_of: string | null
}

const BASE = Date.parse('2026-11-01T00:00:00.000Z')
const at = (minutes: number) => new Date(BASE + minutes * 60_000).toISOString()

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

// The plan as plain data, for comparisons.
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

describe('G1 the duplicate key', () => {
  it('same title, company, provider and platform set: one key (platform order and repeats do not matter)', async () => {
    const { duplicateKey } = await load()
    const a = duplicateKey(row('a', 0, { platform: ['ab', 'et'] }))
    expect(a).not.toBeNull()
    expect(duplicateKey(row('b', 1, { platform: ['et', 'ab'] }))).toBe(a)
    expect(duplicateKey(row('c', 2, { platform: ['et', 'ab', 'ab'] }))).toBe(a)
  })

  it('a different provider, company, title or platform set: a different key', async () => {
    const { duplicateKey } = await load()
    const base = duplicateKey(row('a', 0))
    for (const other of [
      row('b', 0, { provider_id: 'prov-2' }),
      row('c', 0, { company_name: 'Other Recruitment' }),
      row('d', 0, { title: 'Tax Senior' }),
      row('e', 0, { platform: ['ab', 'et'] }),
    ]) {
      expect(duplicateKey(other)).not.toBeNull()
      expect(duplicateKey(other)).not.toBe(base)
    }
  })

  it('reuses slugify: case and punctuation variants share a key', async () => {
    const { duplicateKey } = await load()
    expect(duplicateKey(row('a', 0, { title: 'Senior Tax Accountant!', company_name: 'ACME  Recruitment Ltd.' }))).toBe(
      duplicateKey(row('b', 0, { title: '  senior tax-accountant', company_name: 'acme recruitment ltd' })),
    )
  })

  it("slugify's 80-character cut: two titles that differ only after 80 slug characters share a key (1 fixture)", async () => {
    const { duplicateKey } = await load()
    const long = 'Senior Financial Reporting and Consolidation Accountant for a Global Group Head Office'
    expect(long.length).toBeGreaterThan(80)
    expect(duplicateKey(row('a', 0, { title: `${long} North` }))).toBe(duplicateKey(row('b', 0, { title: `${long} South` })))
  })

  it('no key for employer rows, rows without a provider, source, company or platform', async () => {
    const { duplicateKey } = await load()
    expect(duplicateKey(row('a', 0, { source: 'employer' }))).toBeNull()
    expect(duplicateKey(row('b', 0, { provider_id: null }))).toBeNull()
    expect(duplicateKey(row('c', 0, { source: null }))).toBeNull()
    expect(duplicateKey(row('d', 0, { company_name: null }))).toBeNull()
    expect(duplicateKey(row('e', 0, { platform: [] }))).toBeNull()
    expect(duplicateKey(row('f', 0, { platform: null }))).toBeNull()
  })

  it('the module imports slugify rules from lib/jobs only and reads no settings, Next or database', () => {
    const source = read('lib/job-duplicates.ts')
    const imports = source.match(/^import .* from '([^']+)'$/gm) ?? []
    expect(imports.map((line) => line.replace(/^.* from '([^']+)'$/, '$1'))).toStrictEqual(['@/lib/jobs'])
    expect(source).toMatch(/^import \{[^}]*\bvisibleAdvertKey\b[^}]*\} from '@\/lib\/jobs'$/m)
    for (const banned of ['next/', '@supabase/', 'process.env', 'toLowerCase', '[^a-z0-9]', 'slice(0, 80)', 'function slugify']) {
      expect(source).not.toContain(banned)
    }
    const jobs = read('lib/jobs.ts')
    expect(jobs).toMatch(/export function visibleAdvertKey\(title: string, companyName: string\): string \{\n {2}return `\$\{slugify\(title\)\}\|\$\{slugify\(companyName\)\}`\n\}/)
  })
})

describe('G1 the plan', () => {
  it('a new group of three: the earliest created is the primary, the others are marked to it', async () => {
    const plan = await planOf([row('c', 3), row('a', 1), row('b', 2)])
    expect(plan.groups).toBe(1)
    expect(plan.toMark).toStrictEqual([['a', ['b', 'c']]])
    expect(plan.toClear).toStrictEqual([])
    expect(plan.unchanged).toBe(1)
    expect(plan.final).toStrictEqual({ a: null, b: 'a', c: 'a' })
  })

  it('equal created_at: the lowest id is the primary', async () => {
    const plan = await planOf([row('m', 5), row('k', 5), row('z', 5)])
    expect(plan.toMark).toStrictEqual([['k', ['m', 'z']]])
  })

  it('different providers, companies, titles or platform sets are never grouped', async () => {
    const plan = await planOf([
      row('a', 1),
      row('b', 2, { provider_id: 'prov-2' }),
      row('c', 3, { company_name: 'Other' }),
      row('d', 4, { title: 'Tax Senior' }),
      row('e', 5, { platform: ['ab', 'et'] }),
    ])
    expect(plan.groups).toBe(0)
    expect(plan.toMark).toStrictEqual([])
    expect(plan.toClear).toStrictEqual([])
    expect(plan.unchanged).toBe(5)
  })

  it('employer rows and rows without a provider are never marked and never a primary; a stale mark on them is cleared', async () => {
    const plan = await planOf([
      row('emp', 0, { source: 'employer' }),
      row('nop', 0, { provider_id: null }),
      row('x', 1),
      row('y', 2),
      row('emp2', 0, { source: 'employer', ai_duplicate_of: 'x' }),
    ])
    expect(plan.toMark).toStrictEqual([['x', ['y']]])
    expect(plan.toClear).toStrictEqual(['emp2'])
    expect(plan.final).toMatchObject({ emp: null, nop: null, emp2: null, x: null, y: 'x' })
  })

  it('a singleton: cleared only when it was marked', async () => {
    expect((await planOf([row('a', 1, { ai_duplicate_of: 'gone' })])).toClear).toStrictEqual(['a'])
    const unmarked = await planOf([row('a', 1)])
    expect(unmarked.toClear).toStrictEqual([])
    expect(unmarked.unchanged).toBe(1)
  })

  it('sticky: the current primary stays while it is live and unmarked, even when an older copy appears', async () => {
    const plan = await planOf([row('old', 0), row('p', 5), row('c1', 6, { ai_duplicate_of: 'p' }), row('c2', 7, { ai_duplicate_of: 'p' })])
    expect(plan.toMark).toStrictEqual([['p', ['old']]])
    expect(plan.toClear).toStrictEqual([])
    expect(plan.final).toStrictEqual({ old: 'p', p: null, c1: 'p', c2: 'p' })
  })

  it('the primary is no longer live: the earliest live row becomes primary and the others move to it', async () => {
    const plan = await planOf([row('b', 2, { ai_duplicate_of: 'gone' }), row('c', 3, { ai_duplicate_of: 'gone' }), row('d', 4, { ai_duplicate_of: 'gone' })])
    expect(plan.toClear).toStrictEqual(['b'])
    expect(plan.toMark).toStrictEqual([['b', ['c', 'd']]])
    expect(plan.final).toStrictEqual({ b: null, c: 'b', d: 'b' })
  })

  it('a row pointing at a primary outside its group is re-pointed', async () => {
    const plan = await planOf([row('a', 1), row('b', 2, { ai_duplicate_of: 'z' }), row('z', 0, { title: 'Audit Senior' })])
    expect(plan.toMark).toStrictEqual([['a', ['b']]])
    expect(plan.final).toMatchObject({ a: null, b: 'a', z: null })
  })

  it('a current target that is itself marked, or two different targets: earliest created wins (no chains)', async () => {
    const chained = await planOf([row('a', 1), row('b', 2, { ai_duplicate_of: 'c' }), row('c', 3, { ai_duplicate_of: 'a' })])
    expect(chained.final).toStrictEqual({ a: null, b: 'a', c: 'a' })
    const split = await planOf([row('a', 1, { ai_duplicate_of: 'b' }), row('b', 2), row('c', 3, { ai_duplicate_of: 'a' })])
    expect(split.final).toStrictEqual({ a: null, b: 'a', c: 'a' })
    expect(split.toClear).toStrictEqual(['a'])
    expect(split.toMark).toStrictEqual([['a', ['b']]])
  })

  it('no chains and no self-reference, whatever the current marks', async () => {
    const rows = [
      row('a', 1, { ai_duplicate_of: 'a' }),
      row('b', 2, { ai_duplicate_of: 'c' }),
      row('c', 3, { ai_duplicate_of: 'b' }),
      row('d', 4, { title: 'Payroll Clerk', ai_duplicate_of: 'd' }),
      row('e', 5, { title: 'Payroll Clerk', ai_duplicate_of: 'a' }),
    ]
    const plan = await planOf(rows)
    for (const [id, target] of Object.entries(plan.final)) {
      expect(target).not.toBe(id)
      if (target !== null) expect(plan.final[target]).toBeNull()
    }
    for (const [primary, ids] of plan.toMark) expect(ids).not.toContain(primary)
  })

  it('touches only the rows given (marked rows that are not live are not in the input and are left alone)', async () => {
    const rows = [row('a', 1), row('b', 2, { ai_duplicate_of: 'expired-primary' }), row('c', 3)]
    const plan = await planOf(rows)
    const touched = [...plan.toClear, ...plan.toMark.flatMap(([primary, ids]) => [primary, ...ids])]
    expect(touched.every((id) => ['a', 'b', 'c'].includes(id))).toBe(true)
  })

  it('already correct marks: nothing to write', async () => {
    const plan = await planOf([row('a', 1), row('b', 2, { ai_duplicate_of: 'a' }), row('c', 3, { ai_duplicate_of: 'a' })])
    expect(plan.toMark).toStrictEqual([])
    expect(plan.toClear).toStrictEqual([])
    expect(plan.unchanged).toBe(3)
  })

  it('deterministic: the same plan whatever the input order', async () => {
    const rows = [
      row('a3', 3), row('a1', 1), row('a2', 2),
      row('b2', 2, { company_name: 'B Co', ai_duplicate_of: 'zz' }), row('b1', 1, { company_name: 'B Co' }),
      row('s', 9, { title: 'Solo', ai_duplicate_of: 'a1' }),
    ]
    const forward = await planOf(rows)
    const backward = await planOf([...rows].reverse())
    const shuffled = await planOf([rows[4], rows[0], rows[5], rows[2], rows[1], rows[3]])
    expect(backward).toStrictEqual(forward)
    expect(shuffled).toStrictEqual(forward)
    expect(forward.toMark).toStrictEqual([['a1', ['a2', 'a3']], ['b1', ['b2']]])
    expect(forward.toClear).toStrictEqual(['s'])
  })

  it('splits ids into write batches of at most 100', async () => {
    const { writeBatches, DUPLICATE_WRITE_BATCH } = await load()
    expect(DUPLICATE_WRITE_BATCH).toBe(100)
    const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`)
    expect(writeBatches(ids).map((batch) => batch.length)).toStrictEqual([100, 100, 50])
    expect(writeBatches(ids).flat()).toStrictEqual(ids)
    expect(writeBatches([])).toStrictEqual([])
  })

  it('plans 20,000 synthetic live rows with 1,500 groups well under 2 s', async () => {
    const { planDuplicateMarks } = await load()
    const rows: Row[] = []
    for (let i = 0; i < 20_000; i++) {
      const group = i % 4 === 0 && i < 12_000 ? (i / 4) % 1_500 : null
      rows.push(row(`job-${String(i).padStart(6, '0')}`, i, group === null
        ? { title: `Unique Role ${i}`, provider_id: `prov-${i % 7}` }
        : { title: `Grouped Role ${group}`, provider_id: 'prov-1' }))
    }
    const heapBefore = process.memoryUsage().heapUsed
    const started = performance.now()
    const plan = planDuplicateMarks(rows)
    const ms = Math.round(performance.now() - started)
    const heapMb = Math.round((process.memoryUsage().heapUsed - heapBefore) / 1_048_576)
    console.info(`jd-one K1 timing|rows:${rows.length}|groups:${plan.groups}|to_mark:${plan.toMark.reduce((n, [, ids]) => n + ids.length, 0)}|ms:${ms}|heap_delta_mb:${heapMb}`)
    expect(plan.groups).toBe(1_500)
    expect(plan.toMark.reduce((n, [, ids]) => n + ids.length, 0)).toBe(3_000 - 1_500)
    expect(ms).toBeLessThan(2_000)
  })
})
