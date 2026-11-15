import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { makeProvider } from '@/lib/test-helpers/provider-fixture'
import type { JobProvider } from '@/lib/providers'

// A provider that cannot run now is moved aside by its own interval, so it
// does not stay due and block the providers behind it:
// - the daily-limit skip in the import runner;
// - a run closed by the stale-run reaper in the scheduled orchestrator.

const NOW = new Date('2026-01-15T10:00:00.000Z').getTime()
const MIN = 60 * 1000
const RAW = 'raw database detail text'

const db = vi.hoisted(() => ({
  calls: [] as unknown[][],
  contexts: [] as string[],
  results: {} as Record<string, { data?: unknown; error?: unknown }>,
}))

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: (context: string) => {
    db.contexts.push(context)
    return {
      from: (table: string) => {
        const ops: unknown[][] = []
        const builder: Record<string, unknown> = {}
        for (const name of ['select', 'update', 'eq', 'lt', 'single']) {
          builder[name] = (...args: unknown[]) => {
            ops.push([name, ...args])
            return builder
          }
        }
        builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
          db.calls.push([table, ...ops])
          const kind = ops.some((o) => o[0] === 'update') ? 'update' : 'select'
          const result = db.results[`${table}:${kind}`] ?? { data: null, error: null }
          return Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(resolve, reject)
        }
        return builder
      },
    }
  },
}))

vi.mock('@/lib/providers', () => ({
  findProvider: vi.fn(),
  deferProvider: vi.fn(),
  reapStaleRuns: vi.fn(),
  getProvidersDueForFetch: vi.fn(),
  updateProviderHealth: vi.fn(),
  createProviderRun: vi.fn(),
  completeProviderRun: vi.fn(),
  failProviderRun: vi.fn(),
  updateProviderDataQuality: vi.fn(),
  logProviderError: vi.fn(),
  incrementProviderJobsToday: vi.fn(),
  updateProviderKeywordCursor: vi.fn(),
}))
vi.mock('@/lib/adapters', () => ({
  getAdapter: () => {
    throw new Error('no adapter in this test')
  },
}))
vi.mock('@/lib/report-error', () => ({ reportServerError: vi.fn() }))
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
// The real runner, watched, so the orchestrator can be given set answers.
vi.mock('@/lib/ingestion/run-provider-import', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/ingestion/run-provider-import')>()
  return { ...original, runProviderImport: vi.fn(original.runProviderImport) }
})

import * as providers from '@/lib/providers'
import { runProviderImport } from '@/lib/ingestion/run-provider-import'
import { reportServerError } from '@/lib/report-error'
import { GET } from '@/app/api/ingest/orchestrator/route'

// The real provider functions, for the database-level checks.
let real: typeof import('@/lib/providers')
beforeAll(async () => {
  real = await vi.importActual<typeof import('@/lib/providers')>('@/lib/providers')
})

const SKIP = { status: 200, body: { ok: true, skipped: true, reason: 'Daily rate limit reached' } }
const SECRET = 'stuck-provider-test-value'
const tick = () =>
  GET(new NextRequest('http://localhost/api/ingest/orchestrator', { headers: { authorization: `Bearer ${SECRET}` } }))

const limited = (overrides: Partial<JobProvider> = {}) =>
  makeProvider({ id: 'p-limited', slug: 'limited', rate_limit_daily: 5, requests_today: 5, fetch_interval_minutes: 60, ...overrides })

let errorLog: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  db.calls = []
  db.contexts = []
  db.results = {}
  vi.stubEnv('CRON_SECRET', SECRET)
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.mocked(providers.deferProvider).mockResolvedValue(undefined)
  vi.mocked(providers.updateProviderHealth).mockResolvedValue(undefined)
  vi.mocked(providers.reapStaleRuns).mockResolvedValue({ count: 0, providerIds: [] })
  vi.mocked(providers.createProviderRun).mockResolvedValue(null)
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

// ── The daily-limit skip ────────────────────────────────────────────────────

describe('daily-limit skip moves the provider aside', () => {
  it('defers once by the provider id to now + its interval', async () => {
    vi.mocked(providers.findProvider).mockResolvedValue(limited())
    await runProviderImport('limited', 'cron')
    expect(vi.mocked(providers.deferProvider).mock.calls).toStrictEqual([['p-limited', new Date(NOW + 60 * MIN)]])
  })

  it('uses 1440 minutes when the interval is null', async () => {
    vi.mocked(providers.findProvider).mockResolvedValue(limited({ fetch_interval_minutes: null as unknown as number }))
    await runProviderImport('limited', 'cron')
    expect(vi.mocked(providers.deferProvider).mock.calls).toStrictEqual([['p-limited', new Date(NOW + 1440 * MIN)]])
  })

  it('keeps the skip answer byte for byte and starts no run', async () => {
    vi.mocked(providers.findProvider).mockResolvedValue(limited())
    const result = await runProviderImport('limited', 'manual')
    expect(JSON.stringify(result)).toBe(JSON.stringify(SKIP))
    expect(providers.createProviderRun).not.toHaveBeenCalled()
    expect(providers.updateProviderHealth).not.toHaveBeenCalled()
    expect(errorLog).not.toHaveBeenCalled()
  })

  it.each([
    ['a returned database problem', () => Promise.reject(Object.assign(new Error('deferProvider: provider update failed'), { code: 'PGRST301', detail: RAW })), 'PGRST301'],
    ['a raw throw with database text', () => { throw Object.assign(new Error(RAW), { code: '42501' }) }, '42501'],
    ['a throw with no code', () => { throw new Error(RAW) }, 'no-code'],
  ])('a deferral failure (%s) keeps the skip answer, logs one fixed line and sends no report', async (_name, fail, code) => {
    vi.mocked(providers.findProvider).mockResolvedValue(limited())
    vi.mocked(providers.deferProvider).mockImplementation(fail as never)
    const result = await runProviderImport('limited', 'cron')
    expect(JSON.stringify(result)).toBe(JSON.stringify(SKIP))
    expect(errorLog.mock.calls).toStrictEqual([['[ingest] daily limit deferral failed:', code]])
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(RAW)
    expect(reportServerError).not.toHaveBeenCalled()
    expect(providers.createProviderRun).not.toHaveBeenCalled()
  })

  it('does not defer a provider below its limit or with no limit', async () => {
    vi.mocked(providers.findProvider).mockResolvedValue(limited({ requests_today: 4 }))
    await runProviderImport('limited', 'cron')
    vi.mocked(providers.findProvider).mockResolvedValue(limited({ rate_limit_daily: null }))
    await runProviderImport('limited', 'cron')
    expect(providers.deferProvider).not.toHaveBeenCalled()
  })
})

// ── deferProvider ───────────────────────────────────────────────────────────

describe('deferProvider', () => {
  it('with a time: one update of next_fetch_at by id, in the ingest context', async () => {
    await expect(real.deferProvider('p1', new Date(NOW + 30 * MIN))).resolves.toBeUndefined()
    expect(db.calls).toStrictEqual([
      ['job_providers', ['update', { next_fetch_at: new Date(NOW + 30 * MIN).toISOString() }], ['eq', 'id', 'p1']],
    ])
    expect(db.contexts).toStrictEqual(['ingest'])
  })

  it.each([
    [90, 90],
    [null, 1440],
  ])('without a time: reads the interval by id (%s) and moves by %s minutes', async (interval, minutes) => {
    db.results['job_providers:select'] = { data: { fetch_interval_minutes: interval } }
    await real.deferProvider('p1')
    expect(db.calls).toStrictEqual([
      ['job_providers', ['select', 'fetch_interval_minutes'], ['eq', 'id', 'p1'], ['single']],
      ['job_providers', ['update', { next_fetch_at: new Date(NOW + minutes * MIN).toISOString() }], ['eq', 'id', 'p1']],
    ])
  })

  it('throws fixed text with the short code only when the update is refused', async () => {
    db.results['job_providers:update'] = { error: { code: '42501', message: RAW, details: RAW } }
    const err = await real.deferProvider('p1', new Date(NOW)).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toBe('deferProvider: provider update failed')
    expect((err as { code?: string }).code).toBe('42501')
    expect(JSON.stringify(err)).not.toContain(RAW)
    expect(errorLog).not.toHaveBeenCalled()
    expect(reportServerError).not.toHaveBeenCalled()
  })

  it('throws fixed text and writes nothing when the interval read is refused', async () => {
    db.results['job_providers:select'] = { error: { code: 'PGRST301', message: RAW } }
    const err = await real.deferProvider('p1').catch((e: unknown) => e)
    expect((err as Error).message).toBe('deferProvider: interval read failed')
    expect((err as { code?: string }).code).toBe('PGRST301')
    expect(String(err)).not.toContain(RAW)
    expect(db.calls.filter((c) => (c as unknown[][]).some((o) => Array.isArray(o) && o[0] === 'update'))).toStrictEqual([])
  })
})

// ── The reaper ──────────────────────────────────────────────────────────────

describe('reapStaleRuns', () => {
  it('returns the count and the reaped rows\' provider ids', async () => {
    db.results['provider_runs:update'] = {
      data: [{ id: 'r1', provider_id: 'pA' }, { id: 'r2', provider_id: 'pA' }, { id: 'r3', provider_id: 'pB' }],
    }
    expect(await real.reapStaleRuns(10)).toStrictEqual({ count: 3, providerIds: ['pA', 'pA', 'pB'] })
    const [call] = db.calls as unknown[][][]
    expect(call[0]).toBe('provider_runs')
    expect(call).toContainEqual(['select', 'id, provider_id'])
    expect(call).toContainEqual(['eq', 'status', 'running'])
    expect(call).toContainEqual(['lt', 'started_at', new Date(NOW - 10 * MIN).toISOString()])
  })

  it('returns 0 and no ids on a database problem', async () => {
    db.results['provider_runs:update'] = { error: { code: '42501', message: RAW } }
    expect(await real.reapStaleRuns(10)).toStrictEqual({ count: 0, providerIds: [] })
  })
})

// ── The orchestrator ────────────────────────────────────────────────────────

describe('the orchestrator handles timed-out providers', () => {
  const due = (...slugs: string[]) =>
    vi.mocked(providers.getProvidersDueForFetch).mockResolvedValue(slugs.map((slug, i) => makeProvider({ id: `id-${slug}`, slug, priority: i })))
  const FAILURE = { errorCode: 'TIMEOUT_REAPED', errorMessage: 'Import timed out' }

  beforeEach(() => {
    vi.mocked(runProviderImport).mockResolvedValue({ status: 200, body: { ok: true } })
  })

  it('counts a failure and defers once per distinct reaped provider, before the due check', async () => {
    vi.mocked(providers.reapStaleRuns).mockResolvedValue({ count: 3, providerIds: ['pA', 'pA', 'pB'] })
    due('next')
    const body = await (await tick()).json()
    expect(vi.mocked(providers.updateProviderHealth).mock.calls).toStrictEqual([['pA', 'failure', FAILURE], ['pB', 'failure', FAILURE]])
    expect(vi.mocked(providers.deferProvider).mock.calls).toStrictEqual([['pA'], ['pB']])
    expect(body.reaped).toBe(3)
    expect(typeof body.reaped).toBe('number')
    expect(vi.mocked(runProviderImport).mock.calls).toStrictEqual([['next', 'cron']])
    const dueOrder = vi.mocked(providers.getProvidersDueForFetch).mock.invocationCallOrder[0]
    for (const order of [
      ...vi.mocked(providers.updateProviderHealth).mock.invocationCallOrder,
      ...vi.mocked(providers.deferProvider).mock.invocationCallOrder,
    ]) expect(order).toBeLessThan(dueOrder)
    expect(errorLog).not.toHaveBeenCalled()
  })

  it('does nothing extra when nothing was reaped', async () => {
    due('next')
    const body = await (await tick()).json()
    expect(body.reaped).toBe(0)
    expect(providers.updateProviderHealth).not.toHaveBeenCalled()
    expect(providers.deferProvider).not.toHaveBeenCalled()
  })

  it('a reaper failure gives reaped 0 and the import still runs', async () => {
    vi.mocked(providers.reapStaleRuns).mockRejectedValue(new Error('reaper stopped'))
    due('next')
    const res = await tick()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.reaped).toBe(0)
    expect(providers.updateProviderHealth).not.toHaveBeenCalled()
    expect(providers.deferProvider).not.toHaveBeenCalled()
    expect(vi.mocked(runProviderImport).mock.calls).toStrictEqual([['next', 'cron']])
  })

  it.each([
    ['health update', 'updateProviderHealth' as const, '[orchestrator] timed-out provider health update failed:'],
    ['deferral', 'deferProvider' as const, '[orchestrator] timed-out provider deferral failed:'],
  ])('a %s failure for one provider does not stop the other provider or the import', async (_name, fn, line) => {
    vi.mocked(providers.reapStaleRuns).mockResolvedValue({ count: 2, providerIds: ['pA', 'pB'] })
    vi.mocked(providers[fn]).mockImplementation((async (id: string) => {
      if (id === 'pA') throw Object.assign(new Error(RAW), { code: '57014' })
    }) as never)
    due('next')
    const res = await tick()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.reaped).toBe(2)
    expect(vi.mocked(providers.updateProviderHealth).mock.calls.map((c) => c[0])).toStrictEqual(['pA', 'pB'])
    expect(vi.mocked(providers.deferProvider).mock.calls.map((c) => c[0])).toStrictEqual(['pA', 'pB'])
    expect(vi.mocked(runProviderImport).mock.calls).toStrictEqual([['next', 'cron']])
    expect(errorLog.mock.calls).toStrictEqual([[line, '57014']])
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(RAW)
    expect(reportServerError).not.toHaveBeenCalled()
  })

  it('both steps failing for every provider still runs the import', async () => {
    vi.mocked(providers.reapStaleRuns).mockResolvedValue({ count: 2, providerIds: ['pA', 'pB'] })
    vi.mocked(providers.updateProviderHealth).mockRejectedValue(new Error(RAW))
    vi.mocked(providers.deferProvider).mockRejectedValue(new Error(RAW))
    due('next')
    const body = await (await tick()).json()
    expect(body).toMatchObject({ ok: true, dispatched: ['next'], reaped: 2 })
    expect(errorLog.mock.calls).toStrictEqual([
      ['[orchestrator] timed-out provider health update failed:', 'no-code'],
      ['[orchestrator] timed-out provider deferral failed:', 'no-code'],
      ['[orchestrator] timed-out provider health update failed:', 'no-code'],
      ['[orchestrator] timed-out provider deferral failed:', 'no-code'],
    ])
  })
})

// ── Starvation ──────────────────────────────────────────────────────────────

describe('a stuck provider no longer starves the ones behind it', () => {
  // A small table and the due rule of getProvidersDueForFetch: active,
  // next_fetch_at empty or not after now, lowest priority number first.
  let table: JobProvider[]
  const dueNow = async () =>
    table
      .filter((p) => p.status === 'active' && (p.next_fetch_at === null || new Date(p.next_fetch_at).getTime() <= Date.now()))
      .sort((a, b) => a.priority - b.priority)

  beforeEach(() => {
    table = [
      limited({ id: 'pA', slug: 'first', priority: 1, next_fetch_at: null }),
      makeProvider({ id: 'pB', slug: 'second', priority: 2, next_fetch_at: null }),
    ]
    vi.mocked(providers.getProvidersDueForFetch).mockImplementation(dueNow)
    vi.mocked(providers.findProvider).mockImplementation(async (slug: string) => table.find((p) => p.slug === slug) ?? null)
    vi.mocked(providers.deferProvider).mockImplementation(async (id: string, until?: Date) => {
      const row = table.find((p) => p.id === id)!
      const at = until ?? new Date(Date.now() + (row.fetch_interval_minutes ?? 1440) * MIN)
      row.next_fetch_at = at.toISOString()
    })
  })

  it('the daily-limit skip lets the second provider run on the next tick', async () => {
    const first = await (await tick()).json()
    expect(first.dispatched).toStrictEqual(['first'])
    vi.setSystemTime(NOW + 15 * MIN)
    const second = await (await tick()).json()
    expect(second.dispatched).toStrictEqual(['second'])
  })

  it('a timed-out run lets the second provider run in the same tick', async () => {
    table[0] = { ...table[0], rate_limit_daily: null, requests_today: 0 }
    vi.mocked(providers.reapStaleRuns).mockResolvedValue({ count: 1, providerIds: ['pA'] })
    const body = await (await tick()).json()
    expect(body.dispatched).toStrictEqual(['second'])
    expect(body.reaped).toBe(1)
  })
})
