import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { makeProvider } from '@/lib/test-helpers/provider-fixture'

// Pins the answers of the provider import route (status, content type and
// body) so they stay the same whichever file holds the import work.

const db = vi.hoisted(() => ({
  insertResult: { error: null as unknown, data: [{ id: 'job-1' }] as unknown },
  fresh: null as unknown,
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
      insert: () => ({ select: async () => db.insertResult }),
      select: () => ({ eq: () => ({ single: async () => ({ data: db.fresh, error: null }) }) }),
    }),
  })),
}))

import { POST } from './route'
import * as providers from '@/lib/providers'
import { getAdapter } from '@/lib/adapters'
import { reportServerError } from '@/lib/report-error'

const SECRET = 'route-test-value'
const MAPPED = { title: 't', company_name: 'c', application_url: 'u' }

function call(path = '/api/ingest/example', authorization: string | null = `Bearer ${SECRET}`) {
  const headers: Record<string, string> = {}
  if (authorization !== null) headers.authorization = authorization
  const req = new NextRequest(`https://accountingbody.com${path}`, { method: 'POST', headers })
  return POST(req, { params: { slug: 'example' } })
}

async function answer(res: Response) {
  const text = await res.text()
  let body: unknown = text
  try { body = JSON.parse(text) } catch { /* plain text answer */ }
  return { status: res.status, type: res.headers.get('content-type'), body }
}

function withoutDuration(body: unknown) {
  const { durationMs, ...rest } = body as Record<string, unknown>
  expect(typeof durationMs).toBe('number')
  return rest
}

const JSON_TYPE = 'application/json'

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', SECRET)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  db.insertResult = { error: null, data: [{ id: 'job-1' }] }
  db.fresh = null
  vi.mocked(providers.findProvider).mockResolvedValue(makeProvider({ slug: 'example', field_mapping: MAPPED }))
  vi.mocked(providers.createProviderRun).mockResolvedValue({ id: 'run-1' } as never)
  vi.mocked(getAdapter).mockReturnValue({
    fetch: vi.fn().mockResolvedValue({ jobs: [{ title: 'Role', slug: 'role' }], pagesFetched: 1, totalAvailable: 1 }),
  } as never)
})

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('provider import route answers', () => {
  it('answers 503 Not configured when CRON_SECRET is unset', async () => {
    vi.stubEnv('CRON_SECRET', '')
    expect(await answer(await call())).toStrictEqual({ status: 503, type: JSON_TYPE, body: { error: 'Not configured' } })
    expect(console.error).toHaveBeenCalledWith('ingest: not configured')
    expect(providers.findProvider).not.toHaveBeenCalled()
  })

  it.each([[null], ['Bearer other-value'], [SECRET]])('answers 401 without the right authorization (%j)', async (authorization) => {
    expect(await answer(await call('/api/ingest/example', authorization))).toStrictEqual({
      status: 401, type: 'text/plain;charset=UTF-8', body: 'Unauthorized',
    })
    expect(providers.findProvider).not.toHaveBeenCalled()
  })

  it('answers 503 when the provider cannot be read', async () => {
    vi.mocked(providers.findProvider).mockRejectedValue(new Error('read problem'))
    expect(await answer(await call())).toStrictEqual({
      status: 503, type: JSON_TYPE, body: { ok: false, error: 'Provider could not be read' },
    })
    expect(reportServerError).toHaveBeenCalledWith('job import provider read failed', expect.any(Error), { area: 'ingest' })
    expect(providers.createProviderRun).not.toHaveBeenCalled()
  })

  it('answers 404 for an unknown provider', async () => {
    vi.mocked(providers.findProvider).mockResolvedValue(null)
    expect(await answer(await call())).toStrictEqual({ status: 404, type: JSON_TYPE, body: { ok: false, error: 'Provider not found' } })
    expect(providers.createProviderRun).not.toHaveBeenCalled()
  })

  it('answers 200 skipped for a provider that is not active', async () => {
    vi.mocked(providers.findProvider).mockResolvedValue(makeProvider({ slug: 'example', status: 'paused' }))
    expect(await answer(await call())).toStrictEqual({
      status: 200, type: JSON_TYPE, body: { ok: true, skipped: true, reason: 'Provider inactive' },
    })
    expect(providers.createProviderRun).not.toHaveBeenCalled()
  })

  it('answers 200 skipped when the provider has used its daily allowance', async () => {
    vi.mocked(providers.findProvider).mockResolvedValue(makeProvider({ slug: 'example', rate_limit_daily: 5, requests_today: 5 }))
    expect(await answer(await call())).toStrictEqual({
      status: 200, type: JSON_TYPE, body: { ok: true, skipped: true, reason: 'Daily rate limit reached' },
    })
    expect(providers.createProviderRun).not.toHaveBeenCalled()
  })

  it('answers 500 when the run record cannot be created', async () => {
    vi.mocked(providers.createProviderRun).mockResolvedValue(null)
    expect(await answer(await call())).toStrictEqual({
      status: 500, type: JSON_TYPE, body: { ok: false, error: 'Failed to create run record' },
    })
    expect(getAdapter).not.toHaveBeenCalled()
  })

  it('answers 200 with the run totals after a successful run', async () => {
    const result = await answer(await call())
    expect({ status: result.status, type: result.type }).toStrictEqual({ status: 200, type: JSON_TYPE })
    expect(withoutDuration(result.body)).toStrictEqual({
      ok: true, provider: 'example', fetched: 1, inserted: 1, deduplicated: 0, rejected: 0, pagesFetched: 1, totalAvailable: 1,
    })
    expect(providers.completeProviderRun).toHaveBeenCalledTimes(1)
    expect(providers.updateProviderHealth).toHaveBeenCalledWith('provider-1', 'success', expect.any(Object))
    expect(providers.failProviderRun).not.toHaveBeenCalled()
  })

  it('answers 500 with the run error after a failed run and closes the run as failed', async () => {
    vi.mocked(getAdapter).mockReturnValue({ fetch: vi.fn().mockRejectedValue(new Error('provider answer unusable')) } as never)
    const result = await answer(await call())
    expect({ status: result.status, type: result.type }).toStrictEqual({ status: 500, type: JSON_TYPE })
    expect(withoutDuration(result.body)).toStrictEqual({ ok: false, error: 'Import failed (Error)' })
    expect(providers.failProviderRun).toHaveBeenCalledWith('run-1', 'Import failed (Error)', 'INGESTION_ERROR')
    expect(providers.completeProviderRun).not.toHaveBeenCalled()
    expect(reportServerError).toHaveBeenCalledWith('job import run failed', expect.any(Error), { area: 'ingest' })
  })

  it('records a manual run when asked with ?trigger=manual', async () => {
    await call('/api/ingest/example?trigger=manual')
    expect(providers.createProviderRun).toHaveBeenCalledWith('provider-1', 'example', 'manual')
  })

  it.each([['/api/ingest/example'], ['/api/ingest/example?trigger=other']])('records a cron run by default (%s)', async (path) => {
    await call(path)
    expect(providers.createProviderRun).toHaveBeenCalledWith('provider-1', 'example', 'cron')
  })
})
