import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// updateProviderHealth checks the errors of its two reads, and reports read
// and save problems (fixed label, ingest area) next to its short-code log
// lines. A failed read keeps today's safe outcome: the success branch keeps
// the default interval and still saves; the failure branch never pauses the
// provider and still saves. It never throws.

const FAKE_MESSAGE = 'fake-db-message-8841'

const db = vi.hoisted(() => ({
  read: { data: null as unknown, error: null as unknown },
  write: { error: null as unknown },
  updates: [] as Record<string, unknown>[],
}))

vi.mock('@/lib/supabase-server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase-server')>()),
  getServerSupabase: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => db.read }) }),
      update: (payload: Record<string, unknown>) => {
        db.updates.push(payload)
        return { eq: async () => db.write }
      },
    }),
  }),
}))
vi.mock('@/lib/report-error', () => ({ reportServerError: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: () => {}, captureMessage: () => {} }))

import * as providers from '@/lib/providers'
import { reportServerError } from '@/lib/report-error'

const READ_LABEL = 'job import health read failed'
const SAVE_LABEL = 'job import health save failed'

function dbProblem(code: string | undefined) {
  return { message: FAKE_MESSAGE, code }
}

let errors: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  db.read = { data: null, error: null }
  db.write = { error: null }
  db.updates = []
  vi.mocked(reportServerError).mockReset()
  errors = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  errors.mockRestore()
})

const reports = () => vi.mocked(reportServerError).mock.calls

describe('a failed save is logged and reported', () => {
  it.each(['success', 'failure'] as const)('%s branch: logs the short code, reports once, does not throw', async (outcome) => {
    db.read = { data: { consecutive_failures: 0, status: 'active', fetch_interval_minutes: 60 }, error: null }
    const problem = dbProblem('57014')
    db.write = { error: problem }
    await expect(providers.updateProviderHealth('p1', outcome)).resolves.toBeUndefined()
    expect(errors.mock.calls).toStrictEqual([['[updateProviderHealth] save failed:', '57014']])
    expect(reports()).toStrictEqual([[SAVE_LABEL, problem, { area: 'ingest' }]])
  })
})

describe('a failed read is logged and reported, and the outcome stays safe', () => {
  it('success branch: keeps the default 1440-minute interval and still saves', async () => {
    const problem = dbProblem('57014')
    db.read = { data: { fetch_interval_minutes: 5 }, error: problem }
    const before = Date.now()
    await expect(providers.updateProviderHealth('p1', 'success', { jobsFetched: 3, jobsInserted: 2 })).resolves.toBeUndefined()
    const after = Date.now()
    expect(errors.mock.calls).toStrictEqual([['[updateProviderHealth] read failed:', '57014']])
    expect(reports()).toStrictEqual([[READ_LABEL, problem, { area: 'ingest' }]])
    expect(db.updates).toHaveLength(1)
    expect(db.updates[0]).toMatchObject({ health_status: 'healthy', consecutive_failures: 0, jobs_last_run: 2 })
    const next = Date.parse(db.updates[0].next_fetch_at as string)
    expect(next).toBeGreaterThanOrEqual(before + 1440 * 60_000)
    expect(next).toBeLessThanOrEqual(after + 1440 * 60_000)
  })

  it('failure branch: never pauses, still saves the failure, does not throw', async () => {
    const problem = dbProblem(undefined)
    // Even if a row came back alongside the error, it is not trusted.
    db.read = { data: { consecutive_failures: 4, status: 'active' }, error: problem }
    await expect(providers.updateProviderHealth('p1', 'failure', { errorCode: 'E', errorMessage: 'm' })).resolves.toBeUndefined()
    expect(errors.mock.calls).toStrictEqual([['[updateProviderHealth] read failed:', 'no-code']])
    expect(reports()).toStrictEqual([[READ_LABEL, problem, { area: 'ingest' }]])
    expect(db.updates).toHaveLength(1)
    expect(db.updates[0]).not.toHaveProperty('status')
    expect(db.updates[0]).toMatchObject({ consecutive_failures: 1, health_status: 'degraded', last_error_code: 'E', last_error_message: 'm' })
  })

  it('log lines carry the short code only, never the database message', async () => {
    db.read = { data: null, error: dbProblem('XX001') }
    db.write = { error: dbProblem('XX002') }
    await providers.updateProviderHealth('p1', 'failure')
    expect(errors.mock.calls).toStrictEqual([
      ['[updateProviderHealth] read failed:', 'XX001'],
      ['[updateProviderHealth] save failed:', 'XX002'],
    ])
    expect(reports().map((c) => c[0])).toStrictEqual([READ_LABEL, SAVE_LABEL])
  })
})

describe('no report when reads and saves work', () => {
  it.each(['success', 'failure'] as const)('%s branch', async (outcome) => {
    db.read = { data: { consecutive_failures: 0, status: 'active', fetch_interval_minutes: 60 }, error: null }
    await providers.updateProviderHealth('p1', outcome)
    expect(reportServerError).not.toHaveBeenCalled()
    expect(errors).not.toHaveBeenCalled()
    expect(db.updates).toHaveLength(1)
  })
})
