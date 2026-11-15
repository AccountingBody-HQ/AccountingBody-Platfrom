import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeTables, type FakeTables, type Row } from '@/lib/test-helpers/fake-rest-tables'
import type { NormalisedJob } from './normalise'

// "Seen again" (owner decision D140) with a real supabase-js client from the
// factory; only the network is fake.

const reports = vi.hoisted(() => [] as unknown[][])
vi.mock('@/lib/report-error', () => ({
  reportServerError: (...args: unknown[]) => { reports.push(args) },
}))
// lib/jobs.ts (imported for slugify) wraps reads with React and Next caches.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>) => (...args: unknown[]) => fn(...args),
}))

import { computeDedupHash, deduplicate, REFRESH_PART_SIZE } from './deduplicate'

const DB_URL = 'https://example.supabase.co'
const NOW = Date.parse('2026-11-14T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000
const iso = (ms: number) => new Date(ms).toISOString()
const NEW_EXPIRY = iso(NOW + 30 * DAY)
const REVIVE_KEYS = ['application_url', 'closed_at', 'expires_at', 'published_at', 'source_job_id', 'source_url', 'status']

let db: FakeTables
const logs: unknown[][] = []

function job(n: number, extra: Partial<NormalisedJob> = {}): NormalisedJob {
  return {
    title: `Accountant ${n}`,
    company_name: `Firm ${n}`,
    location_text: 'London',
    slug: `new-slug-${n}`,
    platform: ['ab'],
    expires_at: NEW_EXPIRY,
    published_at: '2026-11-13T09:00:00.000Z',
    source_job_id: `new-src-${n}`,
    source_url: `https://jobs.example/new/${n}`,
    application_url: `https://jobs.example/apply/${n}`,
    ...extra,
  } as unknown as NormalisedJob
}

async function existing(n: number, row: Row): Promise<Row> {
  const j = job(n)
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    dedup_hash: await computeDedupHash(j.title, j.company_name, j.location_text),
    source: 'adzuna',
    status: 'active',
    expires_at: iso(NOW + 5 * DAY),
    closed_at: null,
    slug: `old-slug-${n}`,
    title: `Accountant ${n}`,
    platform: ['ab'],
    source_job_id: `old-src-${n}`,
    source_url: `https://jobs.example/old/${n}`,
    application_url: `https://jobs.example/old-apply/${n}`,
    published_at: '2026-09-01T00:00:00.000Z',
    ...row,
  }
}

const patches = () => db.requests.filter((r) => r.method === 'PATCH')
const rowOf = (n: number) => db.tables.jobs.find((r) => r.slug === `old-slug-${n}`)!

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  db = fakeTables(DB_URL, { jobs: [] })
  vi.stubGlobal('fetch', vi.fn(db.fetch))
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  for (const level of ['error', 'warn', 'log', 'info'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => { logs.push(args) })
  }
  logs.length = 0
  reports.length = 0
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('duplicate read', () => {
  it('leaves rejected rows out, so a job matching only a rejected row is inserted', async () => {
    db.tables.jobs.push(await existing(1, { status: 'rejected' }))
    const result = await deduplicate([job(1)])
    expect(result.toInsert.map((j) => j.slug)).toStrictEqual(['new-slug-1'])
    expect(result).toMatchObject({ duplicateCount: 0, refreshed: 0, revived: 0 })
    const read = db.requests[0]
    expect(read.method).toBe('GET')
    expect(read.params).toContainEqual(['status', 'neq.rejected'])
    expect(patches()).toHaveLength(0)
  })

  it.each([['fail', '22P02'], ['throw', 'no-code']] as const)(
    'on a read problem (%s) treats every job as new, logs, reports and does not throw',
    async (problem, code) => {
      db.tables.jobs.push(await existing(1, {}))
      db.problem = () => problem
      const result = await deduplicate([job(1), job(1), job(2)])
      expect(result.toInsert.map((j) => j.slug)).toStrictEqual(['new-slug-1', 'new-slug-2'])
      expect(result).toMatchObject({ duplicateCount: 1, duplicateHashes: [], refreshed: 0, revived: 0 })
      expect(logs).toContainEqual(['[dedup] read failed:', code])
      expect(reports).toHaveLength(1)
      expect(reports[0][0]).toBe('job import duplicate read failed')
      expect(reports[0][2]).toStrictEqual({ area: 'ingest' })
      expect(db.requests).toHaveLength(1)
      for (const line of logs) expect(JSON.stringify(line)).not.toContain('seed problem text')
    },
  )
})

describe('refresh (live match)', () => {
  it('extends expires_at to the new value when that is later', async () => {
    db.tables.jobs.push(await existing(1, { expires_at: iso(NOW + 5 * DAY) }))
    const result = await deduplicate([job(1)])
    expect(result).toMatchObject({ toInsert: [], duplicateCount: 1, refreshed: 1, revived: 0 })
    expect(rowOf(1).expires_at).toBe(NEW_EXPIRY)
    expect(patches()).toHaveLength(1)
    expect(patches()[0].body).toStrictEqual({ expires_at: NEW_EXPIRY })
    expect(patches()[0].params).toEqual(expect.arrayContaining([
      ['expires_at', `lt.${NEW_EXPIRY}`], ['status', 'eq.active'], ['source', 'neq.employer'],
    ]))
  })

  it('never shortens: a later or empty expires_at is left alone', async () => {
    const later = iso(NOW + 90 * DAY)
    db.tables.jobs.push(await existing(1, { expires_at: later }), await existing(2, { expires_at: null }))
    const result = await deduplicate([job(1), job(2)])
    expect(result).toMatchObject({ toInsert: [], duplicateCount: 2, refreshed: 0, revived: 0 })
    expect(rowOf(1).expires_at).toBe(later)
    expect(rowOf(2).expires_at).toBeNull()
    expect(patches()).toHaveLength(0)
  })

  it('keeps every other field of a refreshed row', async () => {
    const before = await existing(1, {})
    db.tables.jobs.push({ ...before })
    await deduplicate([job(1)])
    expect(rowOf(1)).toStrictEqual({ ...before, expires_at: NEW_EXPIRY })
  })

  it(`updates in parts of at most ${REFRESH_PART_SIZE} ids`, async () => {
    const n = REFRESH_PART_SIZE + 50
    for (let i = 1; i <= n; i++) db.tables.jobs.push(await existing(i, {}))
    const result = await deduplicate(Array.from({ length: n }, (_, i) => job(i + 1)))
    expect(result.refreshed).toBe(n)
    const sizes = patches().map((p) => (p.params.find(([k]) => k === 'id')![1].match(/,/g) ?? []).length + 1)
    expect(sizes).toStrictEqual([REFRESH_PART_SIZE, 50])
  })

  it('a failed refresh is logged and reported and never fails the run', async () => {
    db.tables.jobs.push(await existing(1, {}))
    db.problem = (r) => (r.method === 'PATCH' ? 'fail' : undefined)
    const result = await deduplicate([job(1)])
    expect(result).toMatchObject({ toInsert: [], duplicateCount: 1, refreshed: 0 })
    expect(logs).toContainEqual(['[dedup] refresh failed:', '22P02'])
    expect(reports.map((r) => r[0])).toStrictEqual(['job import refresh failed'])
  })
})

describe('revive (expired or overdue match)', () => {
  it.each([
    ['expired', { status: 'expired', closed_at: '2026-10-01T06:00:00.000Z', expires_at: iso(NOW - 40 * DAY) }],
    ['active but overdue', { status: 'active', closed_at: null, expires_at: iso(NOW - 1000) }],
  ])('revives an %s row with exactly the D140 fields', async (_name, state) => {
    const before = await existing(1, state)
    db.tables.jobs.push({ ...before })
    const result = await deduplicate([job(1)])
    expect(result).toMatchObject({ toInsert: [], duplicateCount: 1, refreshed: 0, revived: 1 })
    expect(patches()).toHaveLength(1)
    expect(Object.keys(patches()[0].body as object).sort()).toStrictEqual(REVIVE_KEYS)
    expect(patches()[0].params).toEqual(expect.arrayContaining([['id', `eq.${before.id}`], ['source', 'neq.employer']]))
    expect(rowOf(1)).toStrictEqual({
      ...before,
      status: 'active',
      closed_at: null,
      expires_at: NEW_EXPIRY,
      source_job_id: 'new-src-1',
      source_url: 'https://jobs.example/new/1',
      application_url: 'https://jobs.example/apply/1',
      published_at: '2026-11-13T09:00:00.000Z',
    })
    // never slug, id, title or platform
    expect(rowOf(1)).toMatchObject({ id: before.id, slug: 'old-slug-1', title: 'Accountant 1', platform: ['ab'] })
  })

  it('dates a revived row now when the repost has no posting date', async () => {
    db.tables.jobs.push(await existing(1, { status: 'expired' }))
    await deduplicate([job(1, { published_at: '' })])
    expect(rowOf(1).published_at).toBe(iso(NOW))
  })

  it('a failing row is logged, reported and skipped; the others are still revived', async () => {
    db.tables.jobs.push(await existing(1, { status: 'expired' }), await existing(2, { status: 'expired' }))
    const failId = (db.tables.jobs[0].id as string)
    db.problem = (r) => (r.method === 'PATCH' && r.params.some(([k, v]) => k === 'id' && v === `eq.${failId}`) ? 'fail' : undefined)
    const result = await deduplicate([job(1), job(2)])
    expect(result).toMatchObject({ toInsert: [], duplicateCount: 2, revived: 1 })
    expect(rowOf(1).status).toBe('expired')
    expect(rowOf(2).status).toBe('active')
    expect(logs).toContainEqual(['[dedup] revive failed:', '22P02'])
    expect(reports.map((r) => r[0])).toStrictEqual(['job import revive failed'])
  })
})

describe('left alone', () => {
  it.each([
    ['employer, live', { source: 'employer' }],
    ['employer, expired', { source: 'employer', status: 'expired', expires_at: iso(NOW - DAY) }],
    ['closed', { status: 'closed', expires_at: iso(NOW - DAY) }],
    ['pending approval', { status: 'pending_approval' }],
  ])('a %s match is counted as a duplicate and not changed', async (_name, state) => {
    const before = await existing(1, state)
    db.tables.jobs.push({ ...before })
    const result = await deduplicate([job(1)])
    expect(result).toMatchObject({ toInsert: [], duplicateCount: 1, refreshed: 0, revived: 0 })
    expect(patches()).toHaveLength(0)
    expect(rowOf(1)).toStrictEqual(before)
  })
})

describe('counts', () => {
  it('duplicateCount = refreshed + revived + other matches + within-batch duplicates', async () => {
    db.tables.jobs.push(
      await existing(1, {}),
      await existing(2, { status: 'expired' }),
      await existing(3, { source: 'employer' }),
    )
    const result = await deduplicate([job(1), job(2), job(3), job(4), job(4)])
    expect(result.toInsert.map((j) => j.slug)).toStrictEqual(['new-slug-4'])
    expect(result).toMatchObject({ duplicateCount: 4, refreshed: 1, revived: 1 })
    expect(result.duplicateHashes).toHaveLength(3)
  })

  it('an empty list makes no request', async () => {
    expect(await deduplicate([])).toStrictEqual({ toInsert: [], duplicateCount: 0, duplicateHashes: [], refreshed: 0, revived: 0 })
    expect(db.requests).toHaveLength(0)
  })
})
