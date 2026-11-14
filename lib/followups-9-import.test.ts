import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { makeProvider } from '@/lib/test-helpers/provider-fixture'

// Follow-ups part 9: an import passes its request count (pages fetched) to
// the counters, even when no job is new; a counter problem never fails the
// run.

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
}))
vi.mock('@/lib/adapters', () => ({ getAdapter: vi.fn() }))
vi.mock('@/lib/ingestion/normalise', () => ({
  normalise: vi.fn((raw: Record<string, unknown>) => ({ ...raw, raw_source_data: raw })),
}))
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
      insert: () => ({ select: async () => ({ error: null, data: [] }) }),
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
    }),
  })),
}))

import { runProviderImport } from '@/lib/ingestion/run-provider-import'
import * as providers from '@/lib/providers'
import { getAdapter } from '@/lib/adapters'

function adapterReturns(result: Record<string, unknown>) {
  vi.mocked(getAdapter).mockReturnValue({ fetch: vi.fn().mockResolvedValue({ totalAvailable: null, ...result }) } as never)
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.mocked(providers.findProvider).mockResolvedValue(
    makeProvider({ slug: 'example', field_mapping: { title: 't', company_name: 'c', application_url: 'u' } }),
  )
  vi.mocked(providers.createProviderRun).mockResolvedValue({ id: 'run-1' } as never)
})

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('an import counts its requests', () => {
  it('passes the pages fetched (12) even when no job is new', async () => {
    adapterReturns({ jobs: [], pagesFetched: 12 })
    const result = await runProviderImport('example', 'cron')
    expect(result.status).toBe(200)
    expect(vi.mocked(providers.incrementProviderJobsToday).mock.calls).toStrictEqual([['provider-1', 0, 12]])
  })

  it('makes no counter call when no request count and no new job', async () => {
    adapterReturns({ jobs: [] })
    const result = await runProviderImport('example', 'cron')
    expect(result.status).toBe(200)
    expect(providers.incrementProviderJobsToday).not.toHaveBeenCalled()
  })

  it('a counter that throws never fails the run, and logs a short code only', async () => {
    adapterReturns({ jobs: [], pagesFetched: 3 })
    vi.mocked(providers.incrementProviderJobsToday).mockRejectedValueOnce(Object.assign(new Error('fake-db-message-6614'), { code: '57014' }))
    const result = await runProviderImport('example', 'cron')
    expect(result.status).toBe(200)
    expect((result.body as { ok: boolean }).ok).toBe(true)
    expect(vi.mocked(console.error).mock.calls).toContainEqual(['[ingest] jobs_today counter failed:', '57014'])
    expect(providers.updateProviderHealth).toHaveBeenCalledWith('provider-1', 'success', expect.any(Object))
  })
})
