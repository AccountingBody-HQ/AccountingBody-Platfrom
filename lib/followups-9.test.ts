import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// requests_today counts the provider requests (pages fetched) each import
// makes, in the same update as jobs_today. A counter problem is logged with
// its short code and reported, and never fails the run. The daily reset is
// covered in lib/job-expiry.test.ts.

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
const row = (requests_today: number) => ({ jobs_today: 5, total_jobs_ingested: 100, jobs_last_run: 1, requests_today })

beforeEach(() => {
  db.read = { data: row(0), error: null }
  db.write = { error: null }
  db.updates = []
  vi.mocked(reportServerError).mockReset()
  errors = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  errors.mockRestore()
})

describe('incrementProviderJobsToday counts requests', () => {
  it('adds the pages fetched to requests_today in the same update as jobs_today', async () => {
    await providers.incrementProviderJobsToday('p1', 3, 12)
    expect(db.updates).toStrictEqual([{ jobs_today: 8, total_jobs_ingested: 103, jobs_last_run: 3, requests_today: 12 }])
  })

  it('adds to the existing count', async () => {
    db.read = { data: row(7), error: null }
    await providers.incrementProviderJobsToday('p1', 0, 2)
    expect(db.updates[0]).toMatchObject({ jobs_today: 5, requests_today: 9 })
  })

  it.each([
    ['missing', undefined],
    ['not a number', 'x'],
    ['negative', -4],
    ['not finite', Number.NaN],
  ])('adds 0 when the request count is %s', async (_name, value) => {
    db.read = { data: row(4), error: null }
    await providers.incrementProviderJobsToday('p1', 2, value as never)
    expect(db.updates[0]).toMatchObject({ jobs_today: 7, requests_today: 4 })
  })

  it('a save problem is logged with its short code and reported; it does not throw', async () => {
    const problem = { message: 'fake-db-message-6612', code: '57014' }
    db.write = { error: problem }
    await expect(providers.incrementProviderJobsToday('p1', 1, 3)).resolves.toBeUndefined()
    expect(errors.mock.calls).toStrictEqual([['[incrementProviderJobsToday] failed to update counters:', '57014']])
    expect(vi.mocked(reportServerError).mock.calls).toStrictEqual([['job import counter save failed', problem, { area: 'ingest' }]])
  })

  it('a read problem is logged with its short code and reported; nothing is saved', async () => {
    const problem = { message: 'fake-db-message-6613', code: 'XX001' }
    db.read = { data: null, error: problem }
    await expect(providers.incrementProviderJobsToday('p1', 1, 3)).resolves.toBeUndefined()
    expect(errors.mock.calls).toStrictEqual([['[incrementProviderJobsToday] failed to fetch provider:', 'XX001']])
    expect(vi.mocked(reportServerError).mock.calls).toStrictEqual([['job import counter read failed', problem, { area: 'ingest' }]])
    expect(db.updates).toStrictEqual([])
  })
})
