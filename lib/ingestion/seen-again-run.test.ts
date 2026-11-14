import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeProvider } from '@/lib/test-helpers/provider-fixture'

// The import run's use of the "seen again" counts (owner decision D140):
// jobs_deduplicated = refreshed + revived + other duplicates, one log line
// per run, and safe defaults when the counts are missing.

const dedup = vi.hoisted(() => ({ answer: {} as Record<string, unknown> }))

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
vi.mock('@/lib/ingestion/normalise', () => ({
  normalise: vi.fn((raw: Record<string, unknown>) => ({ ...raw, raw_source_data: raw })),
}))
vi.mock('@/lib/ingestion/validate', () => ({
  validate: vi.fn((jobs: unknown[]) => ({ valid: jobs, rejected: [] })),
}))
vi.mock('@/lib/ingestion/deduplicate', () => ({
  deduplicate: vi.fn(async () => dedup.answer),
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
      insert: () => ({ select: async () => ({ error: null, data: [] }) }),
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
    }),
  })),
}))

import { runProviderImport, safeCount } from './run-provider-import'
import * as providers from '@/lib/providers'
import { getAdapter } from '@/lib/adapters'

const logs: unknown[][] = []
const seenAgainLines = () => logs.filter((line) => String(line[0]).includes('seen again'))

beforeEach(() => {
  for (const level of ['error', 'warn', 'log', 'info'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => { logs.push(args) })
  }
  logs.length = 0
  vi.mocked(providers.findProvider).mockResolvedValue(
    makeProvider({ slug: 'example', field_mapping: { title: 't', company_name: 'c', application_url: 'u' } }),
  )
  vi.mocked(providers.createProviderRun).mockResolvedValue({ id: 'run-1' } as never)
  vi.mocked(getAdapter).mockReturnValue({
    fetch: vi.fn().mockResolvedValue({ jobs: [{ title: 'Role', slug: 'role' }], pagesFetched: 1, totalAvailable: 1 }),
  } as never)
})

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('seen-again counts in the import run', () => {
  it('records refreshed + revived + other duplicates as jobs_deduplicated and logs one line', async () => {
    dedup.answer = { toInsert: [], duplicateCount: 5, duplicateHashes: [], refreshed: 2, revived: 1 }
    const result = await runProviderImport('example', 'cron')
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ ok: true, inserted: 0, deduplicated: 5 })
    expect(vi.mocked(providers.completeProviderRun).mock.calls[0][1]).toMatchObject({ jobsDeduplicated: 5, jobsInserted: 0 })
    expect(seenAgainLines()).toStrictEqual([['[ingest/example] seen again: refreshed 2, revived 1']])
  })

  it.each([
    ['missing', {}],
    ['not numbers', { refreshed: '3', revived: null }],
    ['negative or fractional', { refreshed: -1, revived: 1.5 }],
  ])('treats %s counts as 0', async (_name, counts) => {
    dedup.answer = { toInsert: [], duplicateCount: 1, ...counts }
    const result = await runProviderImport('example', 'cron')
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ ok: true, deduplicated: 1 })
    expect(seenAgainLines()).toStrictEqual([['[ingest/example] seen again: refreshed 0, revived 0']])
  })

  it('safeCount keeps only whole numbers of 0 or more', () => {
    expect([0, 7, -1, 2.5, NaN, Infinity, '4', null, undefined].map(safeCount)).toStrictEqual([0, 7, 0, 0, 0, 0, 0, 0, 0])
  })
})
