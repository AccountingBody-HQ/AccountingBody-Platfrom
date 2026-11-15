import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeProvider } from '@/lib/test-helpers/provider-fixture'

// A new job whose random slug clashes with an existing slug is retried with
// the same base and a fresh suffix (3 attempts in all), instead of being
// dropped as a duplicate. dedup_hash duplicates keep today's behaviour.

type DbError = { message: string; code?: string } | null

const db = vi.hoisted(() => ({
  batch: null as { message: string; code?: string } | null,
  singles: [] as ({ message: string; code?: string } | null)[],
  singleSlugs: [] as string[],
}))

vi.mock('@/lib/providers', () => ({
  findProvider: vi.fn(),
  createProviderRun: vi.fn(),
  completeProviderRun: vi.fn().mockResolvedValue(undefined),
  failProviderRun: vi.fn().mockResolvedValue(undefined),
  updateProviderHealth: vi.fn().mockResolvedValue(undefined),
  updateProviderDataQuality: vi.fn().mockResolvedValue(undefined),
  logProviderError: vi.fn().mockResolvedValue(undefined),
  incrementProviderJobsToday: vi.fn().mockResolvedValue(undefined),
  updateProviderKeywordCursor: vi.fn().mockResolvedValue(undefined),
  deferProvider: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/adapters', () => ({ getAdapter: vi.fn() }))
vi.mock('@/lib/ingestion/normalise', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./normalise')>()
  return {
    reslug: actual.reslug,
    normalise: vi.fn((raw: Record<string, unknown>) => ({ ...raw, raw_source_data: raw })),
  }
})
vi.mock('@/lib/ingestion/validate', () => ({
  validate: vi.fn((jobs: unknown[]) => ({ valid: jobs, rejected: [] })),
}))
vi.mock('@/lib/ingestion/deduplicate', () => ({
  deduplicate: vi.fn(async (jobs: unknown[]) => ({ toInsert: jobs, duplicateCount: 0 })),
}))
vi.mock('@/lib/ingestion/quality', () => ({
  computeQualityMetrics: vi.fn(() => ({ status: 'ok', relevanceRate: 1, avgDescriptionLength: 10, fieldCoverage: {} })),
}))
vi.mock('@/lib/provider-alerts', () => ({
  deriveAlertState: vi.fn(() => 'ok'),
  maybeSendProviderAlert: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/report-error', () => ({ reportServerError: vi.fn() }))
vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(() => ({
    from: () => ({
      insert: (row: unknown) => {
        if (Array.isArray(row)) {
          return { select: async () => ({ error: db.batch, data: db.batch ? null : row.map((_, i) => ({ id: `id-${i}` })) }) }
        }
        db.singleSlugs.push((row as { slug: string }).slug)
        const error = db.singles.length > 0 ? db.singles.shift() ?? null : null
        return Promise.resolve({ error })
      },
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
    }),
  })),
}))

import { runProviderImport } from './run-provider-import'
import * as providers from '@/lib/providers'
import { getAdapter } from '@/lib/adapters'

const SLUG = 'senior-accountant-acme-ltd-ab12'
const BASE = 'senior-accountant-acme-ltd'
const SLUG_CLASH: DbError = { code: '23505', message: 'duplicate key value violates unique constraint "jobs_slug_key"' }
const DEDUP_CLASH: DbError = { code: '23505', message: 'duplicate key value violates unique constraint "idx_jobs_dedup"' }
const TOKEN_CLASH: DbError = { code: '23505', message: 'duplicate key value violates unique constraint "jobs_manage_token_key"' }

const logs: unknown[][] = []
const warns = () => logs.filter((line) => String(line[0]).includes('Batch insert failed'))

function runRecord() {
  return vi.mocked(providers.completeProviderRun).mock.calls[0][1] as { jobsInserted: number; jobsDeduplicated: number }
}

beforeEach(() => {
  for (const level of ['error', 'warn', 'log', 'info'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => { logs.push(args) })
  }
  logs.length = 0
  db.batch = null
  db.singles = []
  db.singleSlugs = []
  vi.mocked(providers.findProvider).mockResolvedValue(
    makeProvider({ slug: 'example', field_mapping: { title: 't', company_name: 'c', application_url: 'u' } }),
  )
  vi.mocked(providers.createProviderRun).mockResolvedValue({ id: 'run-1' } as never)
  vi.mocked(getAdapter).mockReturnValue({
    fetch: vi.fn().mockResolvedValue({ jobs: [{ title: 'Role', slug: SLUG }], pagesFetched: 1, totalAvailable: 1 }),
  } as never)
})

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

function expectRetriedSlug(slug: string, previous: string) {
  expect(slug).not.toBe(previous)
  expect(slug.slice(0, slug.lastIndexOf('-'))).toBe(BASE)
}

describe('slug clash on a new import', () => {
  it('a clash once is retried with a different slug, same base, and is inserted', async () => {
    db.batch = SLUG_CLASH
    db.singles = [SLUG_CLASH, null]
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789)

    const result = await runProviderImport('example', 'cron')

    expect(db.singleSlugs).toHaveLength(2)
    expect(db.singleSlugs[0]).toBe(SLUG)
    expectRetriedSlug(db.singleSlugs[1], SLUG)
    expect(db.singleSlugs[1].length).toBe(SLUG.length)
    expect(result.body).toMatchObject({ ok: true, inserted: 1, deduplicated: 0 })
    expect((result.body as Record<string, unknown>).insertErrors).toBeUndefined()
    expect(runRecord()).toMatchObject({ jobsInserted: 1, jobsDeduplicated: 0 })
    expect(providers.logProviderError).not.toHaveBeenCalled()
    expect(warns()).toStrictEqual([])
  })

  it('a clash twice then success is inserted on the third attempt', async () => {
    db.batch = SLUG_CLASH
    db.singles = [SLUG_CLASH, SLUG_CLASH, null]
    const randoms = [0.111111111, 0.222222222]
    vi.spyOn(Math, 'random').mockImplementation(() => randoms.shift() ?? 0.333333333)

    const result = await runProviderImport('example', 'cron')

    expect(db.singleSlugs).toHaveLength(3)
    expectRetriedSlug(db.singleSlugs[1], db.singleSlugs[0])
    expectRetriedSlug(db.singleSlugs[2], db.singleSlugs[1])
    expect(result.body).toMatchObject({ ok: true, inserted: 1, deduplicated: 0 })
    expect(runRecord()).toMatchObject({ jobsInserted: 1, jobsDeduplicated: 0 })
  })

  it('a clash three times is an insert error with code SLUG_CONFLICT, never a duplicate', async () => {
    db.batch = SLUG_CLASH
    db.singles = [SLUG_CLASH, SLUG_CLASH, SLUG_CLASH, null]

    const result = await runProviderImport('example', 'cron')

    expect(db.singleSlugs).toHaveLength(3)
    expect(result.body).toMatchObject({ ok: true, inserted: 0, deduplicated: 0, insertErrors: [`${SLUG}: 23505`] })
    expect(runRecord()).toMatchObject({ jobsInserted: 0, jobsDeduplicated: 0 })
    expect(providers.logProviderError).toHaveBeenCalledTimes(1)
    expect(vi.mocked(providers.logProviderError).mock.calls[0].slice(2, 4)).toStrictEqual(['INSERT_FAILED', 'SLUG_CONFLICT'])
  })

  it('a dedup_hash clash on a retry counts as a duplicate as today', async () => {
    db.batch = SLUG_CLASH
    db.singles = [SLUG_CLASH, DEDUP_CLASH]

    const result = await runProviderImport('example', 'cron')

    expect(db.singleSlugs).toHaveLength(2)
    expect(result.body).toMatchObject({ ok: true, inserted: 0, deduplicated: 1 })
    expect(providers.logProviderError).not.toHaveBeenCalled()
  })

  it('a batch-level slug clash falls back to single inserts with no warning line', async () => {
    db.batch = SLUG_CLASH
    await runProviderImport('example', 'cron')
    expect(warns()).toStrictEqual([])
  })
})

describe('other unique violations keep today\'s behaviour', () => {
  it.each([
    ['dedup_hash (idx_jobs_dedup)', DEDUP_CLASH],
    ['plain "duplicate key value"', { code: '23505', message: 'duplicate key value' }],
    ['manage_token (jobs_manage_token_key)', TOKEN_CLASH],
  ])('%s is counted as a duplicate, not retried, no warning', async (_name, clash) => {
    db.batch = clash
    db.singles = [clash]

    const result = await runProviderImport('example', 'cron')

    expect(db.singleSlugs).toStrictEqual([SLUG])
    expect(result.body).toMatchObject({ ok: true, inserted: 0, deduplicated: 1 })
    expect(runRecord()).toMatchObject({ jobsInserted: 0, jobsDeduplicated: 1 })
    expect(providers.logProviderError).not.toHaveBeenCalled()
    expect(warns()).toStrictEqual([])
  })

  it('a slug-named message without code 23505 is not treated as a slug clash', async () => {
    const odd = { code: 'XX000', message: 'something about jobs_slug_key' }
    db.batch = odd
    db.singles = [odd]

    const result = await runProviderImport('example', 'cron')

    expect(db.singleSlugs).toStrictEqual([SLUG])
    expect(result.body).toMatchObject({ inserted: 0, deduplicated: 0, insertErrors: [`${SLUG}: XX000`] })
    expect(vi.mocked(providers.logProviderError).mock.calls[0][3]).toBe('XX000')
    expect(warns()).toHaveLength(1)
  })
})

describe('slug helpers', () => {
  it('generateSlug output format is unchanged: <base ≤80>-<Math.random base-36 chars 2..6>', async () => {
    const { normalise } = await vi.importActual<typeof import('./normalise')>('./normalise')
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789)
    const job = normalise(
      { title: 'Senior Accountant', company: 'Acme Ltd', url: 'https://example.com/j/1', description: 'x' } as never,
      makeProvider({ field_mapping: { title: 'title', company_name: 'company', application_url: 'url', description: 'description' } }),
    )
    const suffix = (0.123456789).toString(36).slice(2, 6)
    expect(job.slug).toBe(`senior-accountant-acme-ltd-${suffix}`)
  })

  it('reslug keeps the base, including a base cut so it ends in "-" and an empty suffix', async () => {
    const { reslug } = await vi.importActual<typeof import('./normalise')>('./normalise')
    vi.spyOn(Math, 'random').mockReturnValue(0.987654321)
    const suffix = (0.987654321).toString(36).slice(2, 6)
    expect(reslug(SLUG)).toBe(`${BASE}-${suffix}`)
    expect(reslug('cut-at-dash--ab12')).toBe(`cut-at-dash--${suffix}`)
    expect(reslug('base-')).toBe(`base-${suffix}`)
  })
})
