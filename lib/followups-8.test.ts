import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// updateProviderHealth's failure branch: when its read fails, it saves the
// error only (last_error_at, last_error_message, last_error_code) and leaves
// the failure count, health and status as they are. When the read works,
// the count, health and pause rule are unchanged.

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

describe('failure branch after a failed read', () => {
  it.each([
    ['no row', null],
    ['a row returned alongside the error', { consecutive_failures: 4, status: 'active' }],
  ])('saves exactly the three last_error fields (%s), reports the read, does not throw', async (_name, row) => {
    const problem = { message: 'fake-db-message-9951', code: '57014' }
    db.read = { data: row, error: problem }
    const before = Date.now()
    await expect(providers.updateProviderHealth('p1', 'failure', { errorCode: 'E', errorMessage: 'm' })).resolves.toBeUndefined()
    expect(db.updates).toHaveLength(1)
    expect(Object.keys(db.updates[0]).sort()).toStrictEqual(['last_error_at', 'last_error_code', 'last_error_message'])
    expect(db.updates[0]).toMatchObject({ last_error_code: 'E', last_error_message: 'm' })
    expect(Date.parse(db.updates[0].last_error_at as string)).toBeGreaterThanOrEqual(before)
    expect(vi.mocked(reportServerError).mock.calls).toStrictEqual([['job import health read failed', problem, { area: 'ingest' }]])
    expect(errors.mock.calls).toStrictEqual([['[updateProviderHealth] read failed:', '57014']])
  })

  it('saves null error fields when none are given', async () => {
    db.read = { data: null, error: { code: 'XX001' } }
    await providers.updateProviderHealth('p1', 'failure')
    expect(db.updates[0]).toStrictEqual({ last_error_at: expect.any(String), last_error_message: null, last_error_code: null })
  })
})

describe('failure branch after a successful read (rule unchanged)', () => {
  it('fifth failure of an active provider: count 5, down, paused', async () => {
    db.read = { data: { consecutive_failures: 4, status: 'active' }, error: null }
    await providers.updateProviderHealth('p1', 'failure', { errorCode: 'E', errorMessage: 'm' })
    expect(db.updates[0]).toStrictEqual({
      health_status: 'down',
      consecutive_failures: 5,
      last_error_at: expect.any(String),
      last_error_message: 'm',
      last_error_code: 'E',
      status: 'paused',
    })
    expect(reportServerError).not.toHaveBeenCalled()
  })

  it('third failure: count 3, down, no status', async () => {
    db.read = { data: { consecutive_failures: 2, status: 'active' }, error: null }
    await providers.updateProviderHealth('p1', 'failure')
    expect(db.updates[0]).toStrictEqual({
      health_status: 'down',
      consecutive_failures: 3,
      last_error_at: expect.any(String),
      last_error_message: null,
      last_error_code: null,
    })
  })

  it('first failure with no row: count 1, degraded', async () => {
    db.read = { data: null, error: null }
    await providers.updateProviderHealth('p1', 'failure')
    expect(db.updates[0]).toMatchObject({ health_status: 'degraded', consecutive_failures: 1 })
    expect(db.updates[0]).not.toHaveProperty('status')
  })
})
