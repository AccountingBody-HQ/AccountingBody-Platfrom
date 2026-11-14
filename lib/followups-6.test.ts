import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// createJob throws fixed text with the database's short code only, and the
// duplicate listing answer still works; the reaper failure and a provider
// health save failure log a short code only; a provider is paused on its
// fifth failure only when it is active.

const FAKE_MESSAGE = 'fake-db-message-7731'
const FAKE_DETAILS = 'fake-db-details-7732'
const FAKE_HINT = 'fake-db-hint-7733'
const FAKE_ROW = 'fake-row-value-7734'

const db = vi.hoisted(() => ({
  read: { data: null as unknown, error: null as unknown },
  write: { error: null as unknown },
  insert: { data: null as unknown, error: null as unknown },
  selects: [] as string[],
  updates: [] as Record<string, unknown>[],
}))

vi.mock('@/lib/supabase-server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase-server')>()),
  getServerSupabase: () => ({
    from: () => ({
      select: (columns: string) => {
        db.selects.push(columns)
        return { eq: () => ({ single: async () => db.read }) }
      },
      update: (payload: Record<string, unknown>) => {
        db.updates.push(payload)
        return { eq: async () => db.write }
      },
      insert: () => ({ select: () => ({ single: async () => db.insert }) }),
    }),
  }),
}))

vi.mock('@/lib/providers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/providers')>()),
  reapStaleRuns: vi.fn(),
  getProvidersDueForFetch: vi.fn(),
}))
vi.mock('@/lib/ingestion/run-provider-import', () => ({ runProviderImport: vi.fn() }))
vi.mock('@/lib/report-error', () => ({ reportServerError: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: () => {}, captureMessage: () => {} }))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>) => (...args: unknown[]) => fn(...args),
  unstable_noStore: () => {},
  revalidateTag: () => {},
  revalidatePath: () => {},
}))

import * as providers from '@/lib/providers'
import { createJob, type JobInsert } from '@/lib/jobs'
import { POST as checkout } from '@/app/api/jobs/employer/checkout/route'
import { GET as orchestrator } from '@/app/api/ingest/orchestrator/route'

const dbProblem = (code: unknown) => ({ code, message: FAKE_MESSAGE, details: FAKE_DETAILS, hint: FAKE_HINT, row: FAKE_ROW })

// Every string a thrown value or a log line could carry.
function textOf(value: unknown): string {
  if (value instanceof Error) {
    return [value.message, value.stack ?? '', JSON.stringify(value), JSON.stringify(Object.getOwnPropertyDescriptors(value)), String(value.cause ?? '')].join(' ')
  }
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function expectNoFakeText(value: unknown) {
  const text = textOf(value)
  for (const fake of [FAKE_MESSAGE, FAKE_DETAILS, FAKE_HINT, FAKE_ROW]) expect(text).not.toContain(fake)
}

const jobPost = {
  title: 'Management Accountant',
  company_name: 'Example Ltd',
  description: 'Prepare monthly management accounts.',
  location_text: FAKE_ROW,
  employer_email: 'hiring@example.com',
  employer_name: 'Example Person',
  employer_company: 'Example Ltd',
}

let errors: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  db.read = { data: null, error: null }
  db.write = { error: null }
  db.insert = { data: null, error: null }
  db.selects = []
  db.updates = []
  errors = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

// ── F1 ──────────────────────────────────────────────────────────────────────

describe('createJob insert failure', () => {
  it('throws a real Error with fixed text and the short code only', async () => {
    db.insert = { data: null, error: dbProblem('23505') }
    const thrown = await createJob(jobPost as JobInsert).then(() => null, (e: unknown) => e)
    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).message).toBe('createJob: insert failed')
    expect((thrown as Error & { code?: string }).code).toBe('23505')
    expect(Object.keys(thrown as object)).toStrictEqual(['code'])
    expectNoFakeText(thrown)
  })

  it('leaves out a code that is not a short code', async () => {
    db.insert = { data: null, error: dbProblem(`${FAKE_MESSAGE} at ${FAKE_ROW}`) }
    const thrown = await createJob(jobPost as JobInsert).then(() => null, (e: unknown) => e)
    expect((thrown as Error).message).toBe('createJob: insert failed')
    expect((thrown as Error & { code?: string }).code).toBeUndefined()
    expectNoFakeText(thrown)
  })

  it('still throws its fixed text when the insert returns no row', async () => {
    await expect(createJob(jobPost as JobInsert)).rejects.toThrow(new Error('createJob: insert returned no row'))
  })

  it('a duplicate listing (23505) still gets the 409 answer from the checkout route', async () => {
    vi.stubEnv('LEMONSQUEEZY_API_KEY', 'test-key')
    vi.stubEnv('LEMONSQUEEZY_STORE_ID', '1')
    vi.stubEnv('LEMONSQUEEZY_VARIANT_ID_GBP', '2')
    vi.stubEnv('LEMONSQUEEZY_VARIANT_ID_USD', '3')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    db.insert = { data: null, error: dbProblem('23505') }
    const res = await checkout(new NextRequest('http://localhost/api/jobs/employer/checkout', { method: 'POST', body: JSON.stringify(jobPost) }))
    expect(res.status).toBe(409)
    expect(await res.json()).toStrictEqual({ error: 'A listing for this role and company already exists.' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('any other insert problem still gets the fixed 500 answer from the checkout route', async () => {
    vi.stubEnv('LEMONSQUEEZY_API_KEY', 'test-key')
    vi.stubEnv('LEMONSQUEEZY_STORE_ID', '1')
    vi.stubEnv('LEMONSQUEEZY_VARIANT_ID_GBP', '2')
    vi.stubEnv('LEMONSQUEEZY_VARIANT_ID_USD', '3')
    vi.stubGlobal('fetch', vi.fn())
    db.insert = { data: null, error: dbProblem('42501') }
    const res = await checkout(new NextRequest('http://localhost/api/jobs/employer/checkout', { method: 'POST', body: JSON.stringify(jobPost) }))
    expect(res.status).toBe(500)
    expect(await res.json()).toStrictEqual({ error: 'Could not start checkout. Please try again.' })
  })
})

// ── F2 ──────────────────────────────────────────────────────────────────────

describe('orchestrator reaper failure log line', () => {
  const run = async (problem: unknown) => {
    vi.stubEnv('CRON_SECRET', 'followups-6-value')
    vi.mocked(providers.reapStaleRuns).mockRejectedValue(problem)
    vi.mocked(providers.getProvidersDueForFetch).mockResolvedValue([])
    const res = await orchestrator(new NextRequest('http://localhost/api/ingest/orchestrator', { headers: { authorization: 'Bearer followups-6-value' } }))
    expect(res.status).toBe(200)
    return errors.mock.calls.filter((c) => c[0] === '[orchestrator] reaper failed:')
  }

  it('logs the short code only', async () => {
    const lines = await run(dbProblem('XX001'))
    expect(lines).toStrictEqual([['[orchestrator] reaper failed:', 'XX001']])
    for (const call of errors.mock.calls) for (const arg of call) expectNoFakeText(arg)
  })

  it('logs no-code when there is no short code', async () => {
    const lines = await run(new Error(FAKE_MESSAGE))
    expect(lines).toStrictEqual([['[orchestrator] reaper failed:', 'no-code']])
    for (const call of errors.mock.calls) for (const arg of call) expectNoFakeText(arg)
  })
})

// ── F3 ──────────────────────────────────────────────────────────────────────

describe('updateProviderHealth pauses only an active provider', () => {
  it('pauses an active provider on its fifth failure, as before', async () => {
    db.read = { data: { consecutive_failures: 4, status: 'active' }, error: null }
    await providers.updateProviderHealth('p1', 'failure', { errorCode: 'E', errorMessage: 'm' })
    expect(db.updates).toHaveLength(1)
    expect(db.updates[0]).toMatchObject({ status: 'paused', consecutive_failures: 5, health_status: 'down' })
  })

  it.each(['inactive', 'paused', 'disabled'])('leaves a %s provider status as it is on its fifth failure', async (status) => {
    db.read = { data: { consecutive_failures: 4, status }, error: null }
    await providers.updateProviderHealth('p1', 'failure', { errorCode: 'E', errorMessage: 'm' })
    expect(db.updates).toHaveLength(1)
    expect(db.updates[0]).not.toHaveProperty('status')
    expect(db.updates[0]).toMatchObject({ consecutive_failures: 5, health_status: 'down', last_error_code: 'E', last_error_message: 'm' })
  })

  it('does not pause an active provider before its fifth failure', async () => {
    db.read = { data: { consecutive_failures: 3, status: 'active' }, error: null }
    await providers.updateProviderHealth('p1', 'failure')
    expect(db.updates[0]).not.toHaveProperty('status')
    expect(db.updates[0]).toMatchObject({ consecutive_failures: 4, health_status: 'down' })
  })
})

// ── F4 ──────────────────────────────────────────────────────────────────────

describe('updateProviderHealth checks its own save', () => {
  it.each(['success', 'failure'] as const)('on a failed %s save it logs the short code and does not throw', async (outcome) => {
    db.read = { data: { consecutive_failures: 0, status: 'active', fetch_interval_minutes: 60 }, error: null }
    db.write = { error: dbProblem('57014') }
    await expect(providers.updateProviderHealth('p1', outcome)).resolves.toBeUndefined()
    expect(errors.mock.calls).toStrictEqual([['[updateProviderHealth] save failed:', '57014']])
  })

  it('logs no-code when the save problem has no short code', async () => {
    db.read = { data: { consecutive_failures: 0, status: 'active' }, error: null }
    db.write = { error: dbProblem(undefined) }
    await expect(providers.updateProviderHealth('p1', 'failure')).resolves.toBeUndefined()
    expect(errors.mock.calls).toStrictEqual([['[updateProviderHealth] save failed:', 'no-code']])
  })

  it.each(['success', 'failure'] as const)('logs nothing when the %s save works', async (outcome) => {
    db.read = { data: { consecutive_failures: 0, status: 'active', fetch_interval_minutes: 60 }, error: null }
    await providers.updateProviderHealth('p1', outcome)
    expect(errors).not.toHaveBeenCalled()
  })
})
