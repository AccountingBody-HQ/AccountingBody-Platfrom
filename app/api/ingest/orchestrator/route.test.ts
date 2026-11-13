import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import {
  IMPORTS_PER_TICK,
  pickProvidersForTick,
  summariseImport,
  importLogLine,
  countImports,
  closingLogLine,
} from '@/lib/ingestion/orchestrator-plan'
import type { ProviderImportResult } from '@/lib/ingestion/run-provider-import'

vi.mock('@/lib/providers', () => ({
  getProvidersDueForFetch: vi.fn(),
  reapStaleRuns: vi.fn().mockResolvedValue(0),
}))
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))
vi.mock('@/lib/ingestion/run-provider-import', () => ({
  runProviderImport: vi.fn(),
}))
vi.mock('@/lib/report-error', () => ({ reportServerError: vi.fn() }))

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const fulfilled = (status: number, body: unknown): PromiseSettledResult<ProviderImportResult> =>
  ({ status: 'fulfilled', value: { status, body } })
const rejected: PromiseSettledResult<ProviderImportResult> = { status: 'rejected', reason: new Error('detail text') }

describe('pickProvidersForTick', () => {
  it('runs three imports per tick', () => {
    expect(IMPORTS_PER_TICK).toBe(3)
  })

  it('keeps the given order and takes at most the limit', () => {
    expect(pickProvidersForTick(['a', 'b', 'c', 'd', 'e'], 3)).toStrictEqual(['a', 'b', 'c'])
    expect(pickProvidersForTick(['c', 'a', 'b'], 3)).toStrictEqual(['c', 'a', 'b'])
    expect(pickProvidersForTick(['a', 'b'], 3)).toStrictEqual(['a', 'b'])
  })

  it('returns an empty list for an empty input or a zero limit', () => {
    expect(pickProvidersForTick([], 3)).toStrictEqual([])
    expect(pickProvidersForTick(['a'], 0)).toStrictEqual([])
    expect(pickProvidersForTick(['a'], -1)).toStrictEqual([])
  })

  it('does not change the list it is given', () => {
    const due = ['a', 'b', 'c', 'd']
    pickProvidersForTick(due, 2)
    expect(due).toStrictEqual(['a', 'b', 'c', 'd'])
  })
})

describe('import outcome words and log lines', () => {
  it('names a 2xx answer ok', () => {
    const s = summariseImport('alpha', fulfilled(200, { ok: true, inserted: 3 }))
    expect(s).toStrictEqual({ slug: 'alpha', status: 200, ok: true, error: undefined, outcome: 'ok' })
    expect(importLogLine(s)).toBe('[orchestrator] import alpha ok 200')
  })

  it('names a 2xx skipped answer skipped, never ok', () => {
    const s = summariseImport('beta', fulfilled(200, { ok: true, skipped: true, reason: 'Provider inactive' }))
    expect(s.outcome).toBe('skipped')
    expect(importLogLine(s)).toBe('[orchestrator] import beta skipped 200')
  })

  it('names any other answer failed, with its status number only', () => {
    const s = summariseImport('gamma', fulfilled(500, { ok: false, error: 'detail text' }))
    expect(s).toStrictEqual({ slug: 'gamma', status: 500, ok: false, error: 'detail text', outcome: 'failed' })
    expect(importLogLine(s)).toBe('[orchestrator] import gamma failed 500')
  })

  it('names a thrown import failed with the word threw and fixed text', () => {
    const s = summariseImport('delta', rejected)
    expect(s).toStrictEqual({ slug: 'delta', ok: false, error: 'Import threw', outcome: 'failed' })
    expect(importLogLine(s)).toBe('[orchestrator] import delta failed threw')
    expect(importLogLine(s)).not.toContain('detail text')
  })

  it('counts each outcome and the providers still due', () => {
    const results = [
      summariseImport('a', fulfilled(200, { ok: true })),
      summariseImport('b', fulfilled(200, { ok: true, skipped: true })),
      summariseImport('c', fulfilled(404, { ok: false, error: 'Provider not found' })),
      summariseImport('d', rejected),
    ]
    const counts = countImports(results, 6)
    expect(counts).toStrictEqual({ started: 4, ok: 1, skipped: 1, failed: 2, stillDue: 2 })
    expect(closingLogLine(counts)).toBe('[orchestrator] imports: 4 started, 1 ok, 2 failed, 2 still due')
  })
})

const SECRET = 'orchestrator-test-value'
const cronRequest = (authorization: string | null = `Bearer ${SECRET}`) =>
  new NextRequest('http://localhost/api/ingest/orchestrator', authorization === null ? {} : { headers: { authorization } })

async function setUp(slugs: string[], answers: Record<string, ProviderImportResult | 'throw'>) {
  const { GET } = await import('./route')
  const providers = await import('@/lib/providers')
  const runner = await import('@/lib/ingestion/run-provider-import')
  const reporting = await import('@/lib/report-error')
  vi.stubEnv('CRON_SECRET', SECRET)
  vi.mocked(providers.getProvidersDueForFetch).mockResolvedValue(slugs.map((slug, i) => ({ slug, priority: i })) as never)
  vi.mocked(runner.runProviderImport).mockImplementation(async (slug: string) => {
    const answer = answers[slug]
    if (answer === 'throw') throw new Error('detail text')
    return answer ?? { status: 200, body: { ok: true } }
  })
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  return { GET, runner, reporting, fetchMock, log, error }
}

describe('orchestrator GET runs imports directly', () => {
  it('runs the first three due providers with trigger cron and makes no request', async () => {
    const t = await setUp(['p1', 'p2', 'p3', 'p4', 'p5'], {})
    const res = await t.GET(cronRequest())
    expect(res.status).toBe(200)
    expect(vi.mocked(t.runner.runProviderImport).mock.calls).toStrictEqual([['p1', 'cron'], ['p2', 'cron'], ['p3', 'cron']])
    expect(t.fetchMock).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body).toStrictEqual({
      ok: true,
      dispatched: ['p1', 'p2', 'p3'],
      count: 3,
      reaped: 0,
      summary: ['p1', 'p2', 'p3'].map(slug => ({ slug, result: { slug, status: 200, ok: true } })),
      counts: { started: 3, ok: 3, skipped: 0, failed: 0, stillDue: 2 },
    })
  })

  it('logs one line per provider and one closing line', async () => {
    const t = await setUp(['p1', 'p2', 'p3', 'p4'], {
      p1: { status: 200, body: { ok: true } },
      p2: { status: 200, body: { ok: true, skipped: true, reason: 'Provider inactive' } },
      p3: 'throw',
    })
    await t.GET(cronRequest())
    expect(t.log.mock.calls).toStrictEqual([
      ['[orchestrator] import p1 ok 200'],
      ['[orchestrator] import p2 skipped 200'],
      ['[orchestrator] imports: 3 started, 1 ok, 1 failed, 1 still due'],
    ])
    expect(t.error.mock.calls).toStrictEqual([['[orchestrator] import p3 failed threw']])
    expect(t.reporting.reportServerError).not.toHaveBeenCalled()
  })

  it('logs and reports once with fixed text when every import fails', async () => {
    const t = await setUp(['p1', 'p2'], {
      p1: { status: 500, body: { ok: false, error: 'detail text' } },
      p2: { status: 503, body: { ok: false, error: 'Provider could not be read' } },
    })
    const res = await t.GET(cronRequest())
    expect(res.status).toBe(200)
    expect(t.error.mock.calls).toStrictEqual([
      ['[orchestrator] import p1 failed 500'],
      ['[orchestrator] import p2 failed 503'],
      ['[orchestrator] every import failed'],
    ])
    expect(t.reporting.reportServerError).toHaveBeenCalledTimes(1)
    expect(t.reporting.reportServerError).toHaveBeenCalledWith(
      'job import dispatch failed', new Error('every dispatched import failed'), { area: 'ingest' },
    )
    expect(JSON.stringify([t.log.mock.calls, t.error.mock.calls])).not.toContain('detail text')
  })

  it('makes no report when every import is skipped', async () => {
    const skipped = { status: 200, body: { ok: true, skipped: true, reason: 'Provider inactive' } }
    const t = await setUp(['p1', 'p2'], { p1: skipped, p2: skipped })
    const body = await (await t.GET(cronRequest())).json()
    expect(body.counts).toStrictEqual({ started: 2, ok: 0, skipped: 2, failed: 0, stillDue: 0 })
    expect(t.reporting.reportServerError).not.toHaveBeenCalled()
  })

  it('answers 503 and runs nothing when CRON_SECRET is unset', async () => {
    const t = await setUp(['p1'], {})
    vi.stubEnv('CRON_SECRET', '')
    const res = await t.GET(cronRequest())
    expect(res.status).toBe(503)
    expect(await res.json()).toStrictEqual({ error: 'Not configured' })
    expect(t.runner.runProviderImport).not.toHaveBeenCalled()
  })

  it.each([[null], ['Bearer other-value'], [SECRET]])('answers 401 and runs nothing without the right authorization (%j)', async (authorization) => {
    const t = await setUp(['p1'], {})
    const res = await t.GET(cronRequest(authorization))
    expect(res.status).toBe(401)
    expect(t.runner.runProviderImport).not.toHaveBeenCalled()
  })

  it('allows the time three imports need', async () => {
    const route = await import('./route')
    expect(route.maxDuration).toBe(300)
  })
})

describe('source guards', () => {
  const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

  it('the orchestrator makes no request and builds no import address', () => {
    const text = source('app/api/ingest/orchestrator/route.ts')
    expect(text).not.toMatch(/\bfetch\(/)
    expect(text).not.toContain('/api/ingest/')
    expect(text).not.toContain('NEXT_PUBLIC_SITE_URL')
    expect(text).toContain("from '@/lib/ingestion/run-provider-import'")
    expect(text).toContain("runProviderImport(p.slug, 'cron')")
  })

  it('the runner writes a fixed log line at each exit before the run record exists', () => {
    const text = source('lib/ingestion/run-provider-import.ts')
    const readLine = text.indexOf('console.error(`[ingest/${slug}] provider could not be read`)')
    const readAnswer = text.indexOf("error: 'Provider could not be read'")
    const runLine = text.indexOf('console.error(`[ingest/${slug}] run record could not be created`)')
    const runAnswer = text.indexOf("error: 'Failed to create run record'")
    expect(readLine).toBeGreaterThan(-1)
    expect(readAnswer).toBeGreaterThan(readLine)
    // Each log line sits in the same branch, just before that branch's answer.
    expect(text.slice(readLine, readAnswer).split('\n')).toHaveLength(3)
    expect(runLine).toBeGreaterThan(readAnswer)
    expect(runAnswer).toBeGreaterThan(runLine)
    expect(text.slice(runLine, runAnswer).split('\n')).toHaveLength(2)
  })

  it('the import route checks CRON_SECRET before it calls the runner', () => {
    const text = source('app/api/ingest/[slug]/route.ts')
    const unset = text.indexOf('if (!secret)')
    const auth = text.indexOf('if (auth !== `Bearer ${secret}`)')
    const call = text.indexOf('await runProviderImport(')
    expect(unset).toBeGreaterThan(-1)
    expect(auth).toBeGreaterThan(unset)
    expect(call).toBeGreaterThan(auth)
    expect(text).toContain("from '@/lib/ingestion/run-provider-import'")
    expect(text).toContain('export const maxDuration = 300')
  })
})

describe('orchestrator GET — fails loudly on a database error', () => {
  it('returns a real 500, not a 200 with an empty dispatched list, when getProvidersDueForFetch throws', async () => {
    const { GET } = await import('./route')
    const providers = await import('@/lib/providers')

    vi.stubEnv('CRON_SECRET', 'test-secret')
    vi.mocked(providers.getProvidersDueForFetch).mockRejectedValue(
      new Error('getProvidersDueForFetch: due-providers query failed: connection refused')
    )

    const req = new NextRequest('http://localhost/api/ingest/orchestrator', {
      headers: { authorization: 'Bearer test-secret' },
    })

    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.ok).toBe(false)
  })
})
