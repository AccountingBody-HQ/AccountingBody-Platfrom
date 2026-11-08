import * as Sentry from '@sentry/nextjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BATCH_SIZE,
  DELETE_PART_SIZE,
  IMPORT_LOG_RETENTION_DAYS,
  MAX_BATCHES,
  TIME_BUDGET_MS,
  retentionCutoff,
  retentionMode,
  runRetention,
  type RetentionStore,
  type RowId,
} from './import-log-retention'
import { getAdminPath } from './middleware-logic'
import { clearReportWindows } from './report-error'
import { filterServerEvent, filterServerSpan, filterServerTransaction } from './sentry-privacy'

// The import error log clean-up runs with real supabase-js clients from the
// factory; only the network is fake and every database request is recorded.
// The reporting helper is wrapped so each call is counted and still reaches
// the real Sentry SDK, whose transport only records what would be sent.

const state = vi.hoisted(() => ({ reports: [] as unknown[][] }))

vi.mock('@/lib/report-error', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/report-error')>()
  return {
    ...real,
    reportServerError: (...args: Parameters<typeof real.reportServerError>) => {
      state.reports.push(args)
      real.reportServerError(...args)
    },
  }
})

import { GET as pruneImportLogs } from '@/app/api/cron/prune-import-logs/route'
import { GET as pruneSavedJobs } from '@/app/api/cron/prune-saved-jobs/route'

const DB_URL = 'https://example.supabase.co'
const SITE = 'https://accountingbody.com'
const NOW = Date.parse('2026-11-07T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000
const CUTOFF = '2026-08-09T12:00:00.000Z'
const CRON_TEST_VALUE = 'cron-test-value'
const LABEL = 'import log retention run failed'
const TABLE = 'provider_errors'
const SEED_MESSAGE = 'invalid input value "seed-value-9q"'
const PROBLEM = { message: SEED_MESSAGE, code: '22P02', details: 'seed-detail-4w', hint: null }

const sent: string[] = []

beforeAll(() => {
  Sentry.init({
    dsn: 'https://public@o1.ingest.example.invalid/1',
    tracesSampleRate: 1,
    beforeSend: filterServerEvent,
    beforeSendTransaction: filterServerTransaction,
    beforeSendSpan: filterServerSpan,
    tracePropagationTargets: [],
    transport: (options: Parameters<typeof Sentry.createTransport>[0]) =>
      Sentry.createTransport(options, async (request) => {
        sent.push(typeof request.body === 'string' ? request.body : new TextDecoder().decode(request.body))
        return { statusCode: 200 }
      }),
  })
})

// ── Fake database ───────────────────────────────────────────────────────────

type Answer = number | 'fail' | 'throw'
type Recorded = { method: string; table: string; params: [string, string][]; prefer: string; ids: string[] }

const net = {
  requests: [] as Recorded[],
  // Answers for the batch reads, in order: a number of due rows, or a problem.
  selects: [] as Answer[],
  // Rows found by a batch read once the list above is used up.
  fill: 0,
  // Answers for the deletes, in order: 'ok' (or nothing left) deletes the ids.
  deletes: [] as ('ok' | 'fail' | 'throw')[],
  nextId: 0,
  afterSelect: undefined as undefined | (() => void),
  selected: [] as string[],
}

const rowId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

const fakeFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.origin !== DB_URL) throw new Error('unexpected request')
  const method = (init?.method ?? 'GET').toUpperCase()
  const headers = new Headers(init?.headers)
  const params: [string, string][] = []
  url.searchParams.forEach((value, key) => params.push([key, value]))
  const inList = url.searchParams.get('id') ?? ''
  const ids = inList.startsWith('in.(') ? inList.slice(4, -1).split(',') : []
  const table = url.pathname.replace('/rest/v1/', '')
  net.requests.push({ method, table, params, prefer: headers.get('prefer') ?? '', ids })
  if (table !== TABLE) return json([])
  if (method === 'GET') {
    const answer = net.selects.length > 0 ? net.selects.shift()! : net.fill
    net.afterSelect?.()
    if (answer === 'throw') throw new TypeError('fetch failed seed-network-3x')
    if (answer === 'fail') return json(PROBLEM, 400)
    const rows = Array.from({ length: answer }, () => ({ id: rowId(++net.nextId) }))
    net.selected.push(...rows.map((row) => row.id))
    return json(rows)
  }
  if (method === 'DELETE') {
    const answer = net.deletes.shift() ?? 'ok'
    if (answer === 'throw') throw new TypeError('fetch failed seed-network-3x')
    if (answer === 'fail') return json(PROBLEM, 400)
    return json(ids.map((id) => ({ id })))
  }
  throw new Error('unexpected method')
}

const cron = (authorization?: string) =>
  new NextRequest(`${SITE}/api/cron/prune-import-logs`, { headers: authorization === undefined ? {} : { authorization } })
const run = () => pruneImportLogs(cron(`Bearer ${CRON_TEST_VALUE}`))

async function answerOf(response: Response) {
  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    if (key !== 'date') headers[key] = value
  })
  return { status: response.status, headers, body: await response.json() }
}

const JSON_HEADERS = { 'content-type': 'application/json' }
const shape = () => net.requests.map((request) => `${request.method} ${request.table}`)
const logs: unknown[][] = []

function expectOneReport(code: string | undefined) {
  expect(state.reports).toHaveLength(1)
  const [label, error, extra] = state.reports[0]
  expect(label).toBe(LABEL)
  expect(extra).toStrictEqual({ area: 'cron' })
  expect(error).toBeInstanceOf(Error)
  expect((error as Error).message).toBe('import log retention failed')
  expect((error as { code?: unknown }).code).toBe(code)
}

beforeEach(async () => {
  await Sentry.flush(2000)
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('CRON_SECRET', CRON_TEST_VALUE)
  vi.stubEnv('IMPORT_LOG_RETENTION', 'on')
  for (const level of ['error', 'warn', 'log', 'info'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logs.push(args)
    })
  }
  logs.length = 0
  sent.length = 0
  state.reports.length = 0
  clearReportWindows()
  net.requests = []
  net.selects = []
  net.fill = 0
  net.deletes = []
  net.nextId = 0
  net.afterSelect = undefined
  net.selected = []
})

afterEach(() => {
  // Whatever the case, only the import error log table is used, never with a
  // row count or a headers-only request.
  for (const request of net.requests) {
    expect(request.table).toBe(TABLE)
    expect(['GET', 'DELETE']).toContain(request.method)
    expect(request.prefer).not.toMatch(/count=/)
  }
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ── Pure rules ──────────────────────────────────────────────────────────────

describe('import log clean-up rules', () => {
  it.each([
    [undefined, 'off'],
    ['', 'off'],
    ['off', 'off'],
    ['true', 'off'],
    ['ON', 'off'],
    [' on', 'off'],
    ['on ', 'off'],
    ['dry-run ', 'off'],
    ['DRY-RUN', 'off'],
    ['dry-run', 'dry-run'],
    ['on', 'on'],
  ])('reads the switch value %j as %s', (value, mode) => {
    expect(retentionMode(value)).toBe(mode)
  })

  it('keeps import error logs for 90 days', () => {
    expect(IMPORT_LOG_RETENTION_DAYS).toBe(90)
    expect(retentionCutoff(new Date(NOW))).toBe(CUTOFF)
    expect(retentionCutoff(new Date(NOW))).toBe(new Date(NOW - 90 * DAY).toISOString())
  })

  it('uses small batches and fixed limits', () => {
    expect([BATCH_SIZE, DELETE_PART_SIZE, MAX_BATCHES, TIME_BUDGET_MS]).toStrictEqual([500, 100, 20, 40_000])
  })

  it('stops at the first problem with the count so far', async () => {
    let calls = 0
    const store: RetentionStore = {
      findDue: async () => Array.from({ length: 500 }, (_, i) => i),
      remove: async (ids: RowId[]) => {
        calls += 1
        if (calls === 4) throw 'stop'
        return ids.length
      },
    }
    expect(await runRetention('on', store, () => NOW)).toStrictEqual({ ok: false, deleted: 300, error: 'stop' })
    expect(calls).toBe(4)
  })

  it('reads the clock once for the cutoff and again before each batch', async () => {
    const cutoffs: string[] = []
    const times = [NOW, NOW + 1, NOW + TIME_BUDGET_MS]
    const store: RetentionStore = {
      findDue: async (cutoff) => {
        cutoffs.push(cutoff)
        return Array.from({ length: 500 }, (_, i) => i)
      },
      remove: async (ids) => ids.length,
    }
    expect(await runRetention('on', store, () => times.shift() ?? NOW + 10 * TIME_BUDGET_MS)).toStrictEqual({ ok: true, mode: 'on', deleted: 500, more: true })
    expect(cutoffs).toStrictEqual([CUTOFF])
  })
})

// ── The route ───────────────────────────────────────────────────────────────

describe('import log clean-up switch', () => {
  it.each([[undefined], [''], ['off'], ['true'], ['ON'], [' on']])('does nothing while switched off (%j)', async (value) => {
    vi.stubEnv('IMPORT_LOG_RETENTION', value)
    net.fill = 500
    expect(await answerOf(await run())).toStrictEqual({ status: 200, headers: JSON_HEADERS, body: { mode: 'off' } })
    expect(net.requests).toStrictEqual([])
    expect(state.reports).toStrictEqual([])
  })

  it('only counts in dry-run mode', async () => {
    vi.stubEnv('IMPORT_LOG_RETENTION', 'dry-run')
    net.fill = 500
    expect(await answerOf(await run())).toStrictEqual({ status: 200, headers: JSON_HEADERS, body: { mode: 'dry-run', wouldDeleteAtLeast: 500 } })
    expect(shape()).toStrictEqual(['GET provider_errors'])
    expect(state.reports).toStrictEqual([])
  })

  it('answers the rows found in dry-run mode when fewer than a batch are due', async () => {
    vi.stubEnv('IMPORT_LOG_RETENTION', 'dry-run')
    net.selects = [37]
    expect((await answerOf(await run())).body).toStrictEqual({ mode: 'dry-run', wouldDeleteAtLeast: 37 })
    expect(shape()).toStrictEqual(['GET provider_errors'])
  })

  it('deletes when switched on', async () => {
    net.selects = [3]
    expect(await answerOf(await run())).toStrictEqual({ status: 200, headers: JSON_HEADERS, body: { mode: 'on', deleted: 3, more: false } })
    expect(shape()).toStrictEqual(['GET provider_errors', 'DELETE provider_errors'])
    expect(net.requests[1].ids).toStrictEqual(net.selected)
    expect(net.requests[1].prefer).toContain('return=representation')
    expect(net.requests[1].params).toStrictEqual([
      ['id', `in.(${net.selected.join(',')})`],
      ['select', 'id'],
    ])
  })
})

describe('import log clean-up access', () => {
  it.each([[undefined], ['']])('refuses to run without its configuration (CRON_SECRET %j)', async (value) => {
    vi.stubEnv('CRON_SECRET', value)
    net.fill = 500
    for (const request of [cron(), cron('Bearer '), cron(`Bearer ${CRON_TEST_VALUE}`)]) {
      expect(await answerOf(await pruneImportLogs(request))).toStrictEqual({ status: 503, headers: JSON_HEADERS, body: { error: 'Not configured' } })
    }
    expect(net.requests).toStrictEqual([])
    expect(state.reports).toStrictEqual([])
    expect(logs).toStrictEqual([['cron/prune-import-logs: not configured'], ['cron/prune-import-logs: not configured'], ['cron/prune-import-logs: not configured']])
  })

  it.each([[undefined], ['Bearer wrong-value'], [CRON_TEST_VALUE], [`bearer ${CRON_TEST_VALUE}`]])(
    'answers a refused request like the other clean-ups (authorization %j)',
    async (authorization) => {
      net.fill = 500
      const ours = await answerOf(await pruneImportLogs(cron(authorization)))
      const sibling = await answerOf(
        await pruneSavedJobs(new NextRequest(`${SITE}/api/cron/prune-saved-jobs`, { headers: authorization === undefined ? {} : { authorization } })),
      )
      expect(ours).toStrictEqual(sibling)
      expect(ours).toStrictEqual({ status: 401, headers: JSON_HEADERS, body: { error: 'Unauthorised' } })
      expect(net.requests).toStrictEqual([])
      expect(state.reports).toStrictEqual([])
    },
  )
})

describe('import log clean-up batches', () => {
  it('asks only for rows older than the cutoff, 500 at a time, in no order', async () => {
    net.selects = [0]
    expect((await answerOf(await run())).body).toStrictEqual({ mode: 'on', deleted: 0, more: false })
    expect(net.requests).toHaveLength(1)
    expect(net.requests[0].params).toStrictEqual([
      ['select', 'id'],
      ['created_at', `lt.${CUTOFF}`],
      ['limit', '500'],
    ])
    expect(net.requests[0].params.some(([key]) => key === 'order')).toBe(false)
  })

  it('deletes each batch in parts of at most 100 and stops on a short batch', async () => {
    net.selects = [500, 500, 120]
    expect((await answerOf(await run())).body).toStrictEqual({ mode: 'on', deleted: 1120, more: false })
    const G = 'GET provider_errors'
    const D = 'DELETE provider_errors'
    expect(shape()).toStrictEqual([G, D, D, D, D, D, G, D, D, D, D, D, G, D, D])
    const deletes = net.requests.filter((request) => request.method === 'DELETE')
    expect(deletes.map((request) => request.ids.length)).toStrictEqual([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 20])
    expect(deletes.flatMap((request) => request.ids)).toStrictEqual(net.selected)
    const selects = net.requests.filter((request) => request.method === 'GET')
    for (const request of selects) expect(request.params).toStrictEqual(net.requests[0].params)
  })

  it('reads again after a full batch and stops when nothing is left', async () => {
    net.selects = [500, 0]
    expect((await answerOf(await run())).body).toStrictEqual({ mode: 'on', deleted: 500, more: false })
    expect(shape().filter((line) => line.startsWith('GET'))).toHaveLength(2)
  })

  it('stops after its batch limit', async () => {
    net.fill = 500
    expect((await answerOf(await run())).body).toStrictEqual({ mode: 'on', deleted: 10_000, more: true })
    expect(shape().filter((line) => line.startsWith('GET'))).toHaveLength(20)
    expect(shape().filter((line) => line.startsWith('DELETE'))).toHaveLength(100)
  })

  it('starts no new batch once its time budget is used', async () => {
    net.fill = 500
    net.afterSelect = () => vi.setSystemTime(Date.now() + 15_000)
    expect((await answerOf(await run())).body).toStrictEqual({ mode: 'on', deleted: 1500, more: true })
    expect(shape().filter((line) => line.startsWith('GET'))).toHaveLength(3)
  })

  it('counts the time budget from the start of the run', async () => {
    net.fill = 500
    let step = 0
    net.afterSelect = () => vi.setSystemTime(NOW + [39_999, 40_000][step++])
    expect((await answerOf(await run())).body).toStrictEqual({ mode: 'on', deleted: 1000, more: true })
    expect(shape().filter((line) => line.startsWith('GET'))).toHaveLength(2)
  })

  it('counts only rows the database says it deleted', async () => {
    net.selects = [5]
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const response = await fakeFetch(input, init)
        if ((init?.method ?? 'GET').toUpperCase() !== 'DELETE') return response
        const rows = (await response.json()) as unknown[]
        return json(rows.slice(0, 2))
      }),
    )
    expect((await answerOf(await run())).body).toStrictEqual({ mode: 'on', deleted: 2, more: false })
  })
})

describe('import log clean-up problems', () => {
  const failed = (deleted: number) => ({ status: 500, headers: JSON_HEADERS, body: { error: 'Cron run failed', deleted } })

  it('answers a failed run and reports it once when the first read fails', async () => {
    net.selects = ['fail']
    expect(await answerOf(await run())).toStrictEqual(failed(0))
    expect(shape()).toStrictEqual(['GET provider_errors'])
    expectOneReport('22P02')
    expect(logs).toStrictEqual([['cron/prune-import-logs: fatal error (22P02)']])
  })

  it('stops at once when a delete fails, with the rows deleted so far', async () => {
    net.selects = [500]
    net.deletes = ['ok', 'ok', 'fail']
    expect(await answerOf(await run())).toStrictEqual(failed(200))
    expect(shape()).toStrictEqual(['GET provider_errors', 'DELETE provider_errors', 'DELETE provider_errors', 'DELETE provider_errors'])
    expectOneReport('22P02')
  })

  it('stops at once when a later read fails', async () => {
    net.selects = [500, 'fail', 500]
    expect(await answerOf(await run())).toStrictEqual(failed(500))
    expect(shape().filter((line) => line.startsWith('GET'))).toHaveLength(2)
    expect(shape()).toHaveLength(7)
    expectOneReport('22P02')
  })

  it('stops at once when the network fails during a delete', async () => {
    net.selects = [500, 500]
    net.deletes = ['ok', 'ok', 'ok', 'ok', 'ok', 'throw']
    expect(await answerOf(await run())).toStrictEqual(failed(500))
    expect(shape()).toHaveLength(8)
    expect(shape().at(-1)).toBe('DELETE provider_errors')
    expectOneReport(undefined)
    expect(logs).toStrictEqual([['cron/prune-import-logs: fatal error (no code)']])
  })

  it('answers a failed dry run and reports it once', async () => {
    vi.stubEnv('IMPORT_LOG_RETENTION', 'dry-run')
    net.selects = ['throw']
    expect(await answerOf(await run())).toStrictEqual(failed(0))
    expect(shape()).toStrictEqual(['GET provider_errors'])
    expectOneReport(undefined)
  })

  it('answers a failed run and reports it once when the database client cannot be made', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    expect(await answerOf(await run())).toStrictEqual(failed(0))
    expect(net.requests).toStrictEqual([])
    expectOneReport(undefined)
  })

  it('keeps database text, row ids and dates out of logs and reports', async () => {
    net.selects = [500]
    net.deletes = ['ok', 'fail']
    await run()
    const text = JSON.stringify([logs, state.reports.map(([label, error, extra]) => [label, String(error), (error as { code?: unknown }).code, extra])])
    for (const seed of ['seed-', SEED_MESSAGE, ...net.selected, '2026-08-09', 'provider_errors']) expect(text).not.toContain(seed)
  })

  it('sends one report with only its label, area and code (real SDK)', async () => {
    net.selects = [500]
    net.deletes = ['ok', 'fail']
    expect(await answerOf(await run())).toStrictEqual(failed(100))
    await Sentry.flush(2000)
    const events = sent.filter((envelope) => envelope.includes('{"type":"event"}'))
    expect(events).toHaveLength(1)
    const event = JSON.parse(events[0].split('\n')[2]) as Record<string, unknown>
    expect(event.tags).toStrictEqual({ label: LABEL, area: 'cron' })
    expect(event.fingerprint).toStrictEqual([LABEL])
    expect(event.extra).toStrictEqual({ held_back: 0, error_code: '22P02' })
    expect((event.exception as { values: unknown[] }).values).toStrictEqual([
      { type: 'Error', value: 'import log retention failed', mechanism: { type: 'generic', handled: true } },
    ])
    for (const field of ['request', 'user', 'breadcrumbs', 'server_name']) expect(event).not.toHaveProperty(field)
    for (const seed of ['seed-', SEED_MESSAGE, ...net.selected, '2026-08-09', 'provider_errors']) expect(events[0]).not.toContain(seed)
  })
})

describe('import log clean-up setup', () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

  it('runs nightly at 07:45 UTC after the other scheduled routes', () => {
    expect((JSON.parse(read('vercel.json')) as { crons: unknown[] }).crons).toStrictEqual([
      { path: '/api/cron/expire-jobs', schedule: '0 6 * * *' },
      { path: '/api/ingest/orchestrator', schedule: '*/15 * * * *' },
      { path: '/api/cron/prune-pending-subscribers', schedule: '30 6 * * *' },
      { path: '/api/cron/prune-saved-jobs', schedule: '0 7 * * *' },
      { path: '/api/cron/prune-import-logs', schedule: '45 7 * * *' },
    ])
  })

  it('lists its switch in the example settings', () => {
    expect(read('.env.example')).toMatch(/^IMPORT_LOG_RETENTION=$/m)
  })

  it('touches no other table', () => {
    const source = read('app/api/cron/prune-import-logs/route.ts') + read('lib/import-log-retention.ts')
    expect(source.match(/\.from\(/g)).toHaveLength(2)
    expect(source.match(/\.from\(IMPORT_LOG_TABLE\)/g)).toHaveLength(2)
    expect(source).not.toMatch(/provider_runs|'jobs'|count:|head:|\.order\(|\.rpc\(/)
  })

  it('reports with a fixed label that names no folder or value', () => {
    vi.stubEnv('ADMIN_PATH', undefined)
    const folder = getAdminPath()
    expect(LABEL).not.toMatch(/[/\\]/)
    expect(LABEL.toLowerCase()).not.toContain(folder.toLowerCase())
    expect(read('app/api/cron/prune-import-logs/route.ts')).toContain(`reportServerError('${LABEL}'`)
  })
})
