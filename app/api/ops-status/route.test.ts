import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHECKS, OPS_STATUS_HOLD_MS, createAnswerHold, opsStatusHold } from '@/lib/ops-status'

// The status route reads with a real supabase-js client from the factory;
// only the network is fake. The reporting helper is replaced by a recorder.

const state = vi.hoisted(() => ({ reports: [] as unknown[][] }))

vi.mock('@/lib/report-error', () => ({
  reportServerError: (...args: unknown[]) => {
    state.reports.push(args)
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: () => {}, captureMessage: () => {} }))

import { GET } from './route'

const DB_URL = 'https://example.supabase.co'
const NOW = Date.parse('2026-11-07T12:00:00.000Z')
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const at = (ago: number) => new Date(NOW - ago).toISOString()

type Row = Record<string, unknown>
const db = {
  tables: {} as Record<string, Row[]>,
  failing: new Set<string>(),
  failCode: 'XX000',
  // What the database size function answers (bytes).
  size: 120 * 1024 * 1024 as unknown,
  requests: [] as { table: string; method: string; params: [string, string][] }[],
}
const SIZE_READ = 'rpc/ops_database_size'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function matches(row: Row, key: string, value: string): boolean {
  const cell = row[key]
  if (value.startsWith('eq.')) return String(cell) === value.slice(3)
  if (value.startsWith('neq.')) return String(cell) !== value.slice(4)
  if (value.startsWith('in.(')) return value.slice(4, -1).split(',').includes(String(cell))
  if (value === 'not.is.null') return cell !== null && cell !== undefined
  if (value.startsWith('gte.')) return typeof cell === 'string' && Date.parse(cell) >= Date.parse(value.slice(4))
  if (value.startsWith('lt.')) return typeof cell === 'string' && Date.parse(cell) < Date.parse(value.slice(3))
  throw new Error(`unexpected filter ${key}=${value}`)
}

const fakeFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.origin !== DB_URL) throw new Error(`unexpected request to ${url.href}`)
  const table = url.pathname.replace('/rest/v1/', '')
  const method = (init?.method ?? 'GET').toUpperCase()
  db.requests.push({ table, method, params: Array.from(url.searchParams.entries()) })
  if (method !== 'GET') throw new Error(`unexpected ${method} to ${table}`)
  if (db.failing.has(table)) return json({ message: 'database detail 7f3a', code: db.failCode, details: null, hint: null }, 500)
  if (table === SIZE_READ) return json(db.size)

  let rows = [...(db.tables[table] ?? [])]
  let limit = Infinity
  let columns: string[] = []
  for (const [key, value] of Array.from(url.searchParams.entries())) {
    if (key === 'select') columns = value.split(',')
    else if (key === 'limit') limit = Number(value)
    else if (key === 'order') {
      const [column, direction] = value.split('.')
      rows.sort((a, b) => String(a[column]).localeCompare(String(b[column])) * (direction === 'desc' ? -1 : 1))
    } else rows = rows.filter((row) => matches(row, key, value))
  }
  return json(rows.slice(0, limit).map((row) => Object.fromEntries(columns.map((column) => [column, row[column]]))))
}

// Rows that make every check ok.
function healthyTables(): Record<string, Row[]> {
  return {
    provider_runs: [
      { status: 'completed', started_at: at(2 * HOUR), trigger: 'cron', error_message: 'x' },
      { status: 'failed', started_at: at(HOUR), trigger: 'cron', error_message: 'x' },
    ],
    jobs: [{ status: 'active', expires_at: at(-DAY) }],
    email_subscribers: [{ status: 'pending', last_confirmation_sent_at: at(DAY) }],
    saved_jobs: [{ last_seen_at: at(DAY) }],
    job_applications: [],
  }
}

const ALLOWED_TOP = ['checks', 'status']
const ALLOWED_STATUS = ['ok', 'attention']
const ALLOWED_WORDS = ['ok', 'late', 'failing', 'unknown']
const NAMES = CHECKS.map((check) => check.name)

async function call() {
  const response = await GET()
  const text = await response.text()
  return { response, status: response.status, text, body: JSON.parse(text) as { status: string; checks: Record<string, string> } }
}

function expectAllowedShape(text: string, body: { status: string; checks: Record<string, string> }) {
  expect(Object.keys(body).sort()).toStrictEqual(ALLOWED_TOP)
  expect(ALLOWED_STATUS).toContain(body.status)
  expect(typeof body.checks).toBe('object')
  for (const [key, value] of Object.entries(body.checks)) {
    expect(NAMES).toContain(key)
    expect(ALLOWED_WORDS).toContain(value)
  }
  // Nothing but the allowed words, names and JSON punctuation.
  const tokens = text.match(/"[^"]*"/g) ?? []
  for (const token of tokens) expect([...ALLOWED_TOP, ...ALLOWED_STATUS, ...ALLOWED_WORDS, ...NAMES]).toContain(token.slice(1, -1))
  expect(text.replace(/"[^"]*"/g, '')).toMatch(/^[{}:,]*$/)
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('JOB_RETENTION', undefined)
  vi.stubEnv('JOB_RETENTION_DAYS', undefined)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  state.reports.length = 0
  db.tables = healthyTables()
  db.failing = new Set()
  db.failCode = 'XX000'
  db.size = 120 * 1024 * 1024
  db.requests = []
  opsStatusHold.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ops status', () => {
  it('answers 200 ok when every job has done its work recently', async () => {
    const result = await call()
    expect(result.status).toBe(200)
    expect(result.body).toStrictEqual({
      status: 'ok',
      checks: { 'job-import': 'ok', 'job-expiry': 'ok', 'subscriber-cleanup': 'ok', 'saved-jobs-cleanup': 'ok', 'job-retention': 'ok', 'database-size': 'ok' },
    })
    expect(state.reports).toStrictEqual([])
  })

  it('is never stored by a cache', async () => {
    const { response } = await call()
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('answers attention when the import has not run recently', async () => {
    db.tables.provider_runs = [{ status: 'completed', started_at: at(27 * HOUR), trigger: 'cron' }]
    const result = await call()
    expect(result.status).toBe(503)
    expect(result.body.status).toBe('attention')
    expect(result.body.checks['job-import']).toBe('late')
  })

  it('answers attention when every recent import run failed', async () => {
    db.tables.provider_runs = [{ status: 'failed', started_at: at(HOUR), trigger: 'cron' }]
    const result = await call()
    expect(result.status).toBe(503)
    expect(result.body.checks['job-import']).toBe('failing')
  })

  it('counts scheduled import runs only', async () => {
    db.tables.provider_runs = [{ status: 'completed', started_at: at(HOUR), trigger: 'manual' }]
    const result = await call()
    expect(result.body.checks['job-import']).toBe('late')
  })

  it('answers attention when a clean-up has rows past their time', async () => {
    db.tables.saved_jobs = [{ last_seen_at: at(8 * DAY + 3 * HOUR) }]
    db.tables.email_subscribers = [{ status: 'pending', last_confirmation_sent_at: at(9 * DAY) }]
    const result = await call()
    expect(result.status).toBe(503)
    expect(result.body.checks['saved-jobs-cleanup']).toBe('late')
    expect(result.body.checks['subscriber-cleanup']).toBe('late')
  })

  it('leaves confirmed subscribers out of the subscriber check', async () => {
    db.tables.email_subscribers = [{ status: 'subscribed', last_confirmation_sent_at: at(30 * DAY) }]
    expect((await call()).body.checks['subscriber-cleanup']).toBe('ok')
  })

  it('shows a job without turning the status red when it is not alerting', async () => {
    db.tables.jobs = [{ status: 'active', expires_at: at(3 * DAY) }]
    const result = await call()
    expect(result.status).toBe(200)
    expect(result.body).toStrictEqual({
      status: 'ok',
      checks: { 'job-import': 'ok', 'job-expiry': 'late', 'subscriber-cleanup': 'ok', 'saved-jobs-cleanup': 'ok', 'job-retention': 'ok', 'database-size': 'ok' },
    })
  })

  it('makes no problem report when a job is late or failing', async () => {
    db.tables.provider_runs = [{ status: 'failed', started_at: at(HOUR), trigger: 'cron' }]
    db.tables.jobs = [{ status: 'active', expires_at: at(3 * DAY) }]
    db.tables.saved_jobs = [{ last_seen_at: at(30 * DAY) }]
    await call()
    expect(state.reports).toStrictEqual([])
  })

  it.each([
    ['provider_runs', 'job-import', 503],
    ['email_subscribers', 'subscriber-cleanup', 503],
    ['saved_jobs', 'saved-jobs-cleanup', 503],
    ['jobs', 'job-expiry', 200],
    [SIZE_READ, 'database-size', 503],
  ] as const)('answers unknown when %s cannot be read', async (table, name, status) => {
    db.failing.add(table)
    const result = await call()
    expect(result.body.checks[name]).toBe('unknown')
    expect(result.status).toBe(status)
    expect(state.reports.map((args) => args[0])).toStrictEqual(['ops status read'])
    expect(result.text).not.toContain('7f3a')
  })

  it('answers unknown for a read error whatever its code', async () => {
    db.failCode = 'PGRST116'
    db.failing.add('provider_runs')
    const result = await call()
    expect(result.body.checks['job-import']).toBe('unknown')
    expect(result.status).toBe(503)
  })

  it('answers 503 when nothing can be read', async () => {
    for (const table of ['provider_runs', 'jobs', 'email_subscribers', 'saved_jobs', SIZE_READ]) db.failing.add(table)
    const result = await call()
    expect(result.status).toBe(503)
    // job-retention is off here, so it reads nothing and stays ok.
    expect(Object.values(result.body.checks)).toStrictEqual(['unknown', 'unknown', 'unknown', 'unknown', 'ok', 'unknown'])
  })

  it('answers failing and 503 when the database is above the size limit', async () => {
    db.size = 300 * 1024 * 1024 + 1
    const result = await call()
    expect(result.status).toBe(503)
    expect(result.body.status).toBe('attention')
    expect(result.body.checks['database-size']).toBe('failing')
    db.size = 300 * 1024 * 1024
    opsStatusHold.clear()
    expect((await call()).status).toBe(200)
  })

  it('answers unknown, never the number, for a size answer it cannot use', async () => {
    db.size = '12a'
    const result = await call()
    expect(result.body.checks['database-size']).toBe('unknown')
    expect(result.status).toBe(503)
  })

  it('reads the size once, as a GET, and never shows a number', async () => {
    db.size = 499 * 1024 * 1024
    const { text } = await call()
    expect(db.requests.filter((request) => request.table === SIZE_READ)).toStrictEqual([{ table: SIZE_READ, method: 'GET', params: [] }])
    expect(text).not.toMatch(/[0-9]/)
  })

  it('answers a neutral 503 and reports once when the check cannot run', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    const result = await call()
    expect(result.status).toBe(503)
    expect(result.body).toStrictEqual({ status: 'attention', checks: {} })
    expect(result.response.headers.get('cache-control')).toBe('no-store')
    expect(state.reports).toHaveLength(1)
    expect(state.reports[0][0]).toBe('ops status check failed')
    expect(state.reports[0][2]).toStrictEqual({ area: 'public' })
  })

  it('keeps the answer to the allowed words in every state', async () => {
    const scenarios: (() => void)[] = [
      () => {},
      () => { db.tables = {} },
      () => { db.tables.provider_runs = [{ status: 'failed', started_at: at(HOUR), trigger: 'cron' }] },
      () => { db.tables.jobs = [{ status: 'active', expires_at: at(9 * DAY) }] },
      () => { db.tables.saved_jobs = [{ last_seen_at: at(30 * DAY) }] },
      () => { for (const table of ['provider_runs', 'jobs', 'email_subscribers', 'saved_jobs']) db.failing.add(table) },
      () => { db.failing.add(SIZE_READ) },
      () => { db.size = 400 * 1024 * 1024 + 7 },
      () => { vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '') },
    ]
    for (const scenario of scenarios) {
      db.tables = healthyTables()
      db.failing = new Set()
      db.size = 120 * 1024 * 1024
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
      opsStatusHold.clear()
      scenario()
      const { text, body } = await call()
      expectAllowedShape(text, body)
    }
  })

  it('makes one small read per check with only the columns it needs', async () => {
    await call()
    const byTable = Object.fromEntries(db.requests.map((request) => [request.table, request]))
    expect(db.requests).toHaveLength(5)
    expect(db.requests.every((request) => request.method === 'GET')).toBe(true)
    expect(byTable[SIZE_READ].params).toStrictEqual([])
    expect(byTable.provider_runs.params).toStrictEqual([
      ['select', 'status,started_at'],
      ['trigger', 'eq.cron'],
      ['status', 'in.(completed,failed)'],
      ['started_at', `gte.${at(26 * HOUR)}`],
      ['order', 'status.asc'],
      ['limit', '1'],
    ])
    expect(byTable.jobs.params).toStrictEqual([
      ['select', 'expires_at'],
      ['status', 'eq.active'],
      ['expires_at', 'not.is.null'],
      ['expires_at', `lt.${at(26 * HOUR)}`],
      ['limit', '1'],
    ])
    expect(byTable.email_subscribers.params).toStrictEqual([
      ['select', 'last_confirmation_sent_at'],
      ['status', 'eq.pending'],
      ['last_confirmation_sent_at', `lt.${at(7 * DAY + 26 * HOUR)}`],
      ['limit', '1'],
    ])
    expect(byTable.saved_jobs.params).toStrictEqual([
      ['select', 'last_seen_at'],
      ['last_seen_at', `lt.${at(7 * DAY + 26 * HOUR)}`],
      ['limit', '1'],
    ])
  })

  it('is read on every request and answers GET only', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/ops-status/route.ts'), 'utf8')
    expect(source).toContain("export const dynamic = 'force-dynamic'")
    expect(source).toContain("export const fetchCache = 'force-no-store'")
    const duration = Number(source.match(/export const maxDuration = (\d+)/)?.[1])
    expect(duration).toBeGreaterThan(0)
    expect(duration).toBeLessThanOrEqual(10)
    expect(source.match(/export (async )?function (\w+)/g)).toStrictEqual(['export async function GET'])
    expect(source).toContain("getServerSupabase('publicRead')")
  })
})

describe('job retention check', () => {
  // 30 days (the default) plus the 26-hour grace.
  const OVERDUE = 30 * DAY + 26 * HOUR
  const SECOND = 1000
  const expired = (id: string, closedAgo: number, row: Row = {}): Row => ({
    id, source: 'adzuna', status: 'expired', closed_at: at(closedAgo), ...row,
  })
  const retentionReads = () =>
    db.requests.filter((r) => r.table === 'job_applications' || (r.table === 'jobs' && r.params[0][1] === 'id'))
  const withOverdue = () => {
    db.tables.jobs.push(expired('r1', OVERDUE + DAY), expired('r2', OVERDUE + 2 * DAY))
  }

  it.each([
    ['unset', undefined],
    ['off', 'off'],
    ['dry-run', 'dry-run'],
    ['ON', 'ON'],
    ['" on"', ' on'],
    ['yes', 'yes'],
    ['empty', ''],
  ] as const)('answers ok with no read when JOB_RETENTION is %s, even with overdue jobs', async (_label, value) => {
    vi.stubEnv('JOB_RETENTION', value)
    withOverdue()
    const result = await call()
    expect(result.status).toBe(200)
    expect(result.body.checks['job-retention']).toBe('ok')
    expect(db.requests).toHaveLength(5)
    expect(retentionReads()).toStrictEqual([])
  })

  it('when on with nothing overdue, answers ok with exactly one extra read', async () => {
    vi.stubEnv('JOB_RETENTION', 'on')
    const result = await call()
    expect(result.status).toBe(200)
    expect(result.body.checks['job-retention']).toBe('ok')
    expect(db.requests).toHaveLength(6)
    expect(retentionReads().map((r) => r.params)).toStrictEqual([[
      ['select', 'id'],
      ['source', 'neq.employer'],
      ['status', 'eq.expired'],
      ['closed_at', 'not.is.null'],
      ['closed_at', `lt.${at(OVERDUE)}`],
      ['limit', '100'],
    ]])
  })

  it('when on, answers late and 503 for an overdue job with no application', async () => {
    vi.stubEnv('JOB_RETENTION', 'on')
    withOverdue()
    db.tables.job_applications = [{ id: 'a1', job_id: 'r1' }]
    const result = await call()
    expect(result.status).toBe(503)
    expect(result.body.status).toBe('attention')
    expect(result.body.checks['job-retention']).toBe('late')
    expect(db.requests).toHaveLength(7)
    const guard = retentionReads()[1]
    expect(guard.table).toBe('job_applications')
    expect(guard.params).toStrictEqual([['select', 'job_id'], ['job_id', 'in.(r1,r2)'], ['limit', '1000']])
    expect(state.reports).toStrictEqual([])
  })

  it('when on, answers ok when every overdue job has an application', async () => {
    vi.stubEnv('JOB_RETENTION', 'on')
    withOverdue()
    db.tables.job_applications = [{ id: 'a1', job_id: 'r1' }, { id: 'a2', job_id: 'r2' }, { id: 'a3', job_id: 'r2' }]
    const result = await call()
    expect(result.status).toBe(200)
    expect(result.body.checks['job-retention']).toBe('ok')
    expect(db.requests).toHaveLength(7)
  })

  it('when on, leaves out employer jobs and jobs that are not expired', async () => {
    vi.stubEnv('JOB_RETENTION', 'on')
    db.tables.jobs.push(
      expired('e1', OVERDUE + DAY, { source: 'employer' }),
      expired('a1', OVERDUE + DAY, { status: 'active' }),
      expired('n1', OVERDUE + DAY, { closed_at: null }),
    )
    const result = await call()
    expect(result.body.checks['job-retention']).toBe('ok')
    expect(db.requests).toHaveLength(6)
  })

  it('when on, does not count a job just inside the grace and counts one just past it', async () => {
    vi.stubEnv('JOB_RETENTION', 'on')
    db.tables.jobs.push(expired('in1', OVERDUE), expired('in2', 30 * DAY + HOUR))
    expect((await call()).body.checks['job-retention']).toBe('ok')
    opsStatusHold.clear()
    db.tables.jobs.push(expired('out', OVERDUE + SECOND))
    const result = await call()
    expect(result.body.checks['job-retention']).toBe('late')
    expect(result.status).toBe(503)
  })

  it('when on, uses JOB_RETENTION_DAYS with the same rules as the cron', async () => {
    vi.stubEnv('JOB_RETENTION', 'on')
    vi.stubEnv('JOB_RETENTION_DAYS', '60')
    db.tables.jobs.push(expired('r1', OVERDUE + DAY))
    expect((await call()).body.checks['job-retention']).toBe('ok')
    expect(retentionReads()[0].params).toContainEqual(['closed_at', `lt.${at(60 * DAY + 26 * HOUR)}`])
  })

  it.each([
    // A failed read 1 means no read 2: 5 check reads + read 1. A failed read 2 follows read 1.
    ['jobs', 6],
    ['job_applications', 7],
  ] as const)('when on, answers unknown and 503 when %s cannot be read', async (table, reads) => {
    vi.stubEnv('JOB_RETENTION', 'on')
    withOverdue()
    db.failing.add(table)
    const result = await call()
    expect(result.body.checks['job-retention']).toBe('unknown')
    expect(result.status).toBe(503)
    expect(result.text).not.toContain('7f3a')
    expect(db.requests).toHaveLength(reads)
    expect(state.reports.every((args) => args[0] === 'ops status read')).toBe(true)
  })

  it('keeps the answer to the allowed words when on', async () => {
    vi.stubEnv('JOB_RETENTION', 'on')
    withOverdue()
    const { text, body } = await call()
    expectAllowedShape(text, body)
    expect(text).not.toContain('r1')
  })
})

describe('ops status within a minute', () => {
  const later = (ms: number) => vi.setSystemTime(NOW + ms)

  it('reuses one answer for a minute', () => {
    expect(OPS_STATUS_HOLD_MS).toBe(60_000)
  })

  it('answers from a recent check within a minute', async () => {
    const first = await call()
    later(OPS_STATUS_HOLD_MS - 1)
    const second = await call()
    expect(db.requests).toHaveLength(5)
    expect(second.status).toBe(first.status)
    expect(second.text).toBe(first.text)
    expect(second.response.headers.get('cache-control')).toBe('no-store')
  })

  it('shares one check between calls that arrive together', async () => {
    const results = await Promise.all([call(), call(), call(), call(), call()])
    expect(db.requests).toHaveLength(5)
    expect(new Set(results.map((result) => result.text)).size).toBe(1)
  })

  it('checks again after a minute', async () => {
    await call()
    later(OPS_STATUS_HOLD_MS)
    db.tables.saved_jobs = [{ last_seen_at: at(30 * DAY) }]
    const result = await call()
    expect(db.requests).toHaveLength(10)
    expect(result.status).toBe(503)
    expect(result.body.checks['saved-jobs-cleanup']).toBe('late')
  })

  it('holds an attention answer too', async () => {
    db.failing.add('provider_runs')
    const first = await call()
    expect(first.status).toBe(503)
    db.failing = new Set()
    later(30_000)
    const second = await call()
    expect(second.status).toBe(503)
    expect(second.body.checks['job-import']).toBe('unknown')
    expect(db.requests).toHaveLength(5)
    expect(state.reports.map((args) => args[0])).toStrictEqual(['ops status read'])
  })

  it('answers from the new check, never an older one, when a read fails', async () => {
    expect((await call()).status).toBe(200)
    later(OPS_STATUS_HOLD_MS)
    for (const table of ['provider_runs', 'jobs', 'email_subscribers', 'saved_jobs']) db.failing.add(table)
    const failed = await call()
    expect(failed.status).toBe(503)
    expect(Object.values(failed.body.checks)).toStrictEqual(['unknown', 'unknown', 'unknown', 'unknown', 'ok', 'ok'])
    later(OPS_STATUS_HOLD_MS + 1)
    expect((await call()).status).toBe(503)
  })

  it('checks again on the next call when the check could not run', async () => {
    expect((await call()).status).toBe(200)
    later(OPS_STATUS_HOLD_MS)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    const neutral = await call()
    expect(neutral.status).toBe(503)
    expect(neutral.body).toStrictEqual({ status: 'attention', checks: {} })
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
    later(OPS_STATUS_HOLD_MS + 1)
    const next = await call()
    expect(next.status).toBe(200)
    expect(db.requests).toHaveLength(10)
  })

  it('gives every caller the neutral answer when a shared check cannot run', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    const results = await Promise.all([call(), call(), call()])
    expect(results.map((result) => result.status)).toStrictEqual([503, 503, 503])
    expect(results.every((result) => result.text === '{"status":"attention","checks":{}}')).toBe(true)
    expect(state.reports.every((args) => args[0] === 'ops status check failed')).toBe(true)
  })

  it('answers HEAD with the same check as GET', async () => {
    const { autoImplementMethods } = await import('next/dist/server/route-modules/app-route/helpers/auto-implement-methods')
    const methods = autoImplementMethods({ GET } as Parameters<typeof autoImplementMethods>[0])
    expect(methods.HEAD).toBe(GET)
    await call()
    later(10_000)
    const head = await (methods.HEAD as typeof GET)()
    expect(head.status).toBe(200)
    expect(db.requests).toHaveLength(5)
  })
})

describe('answer hold', () => {
  it('runs one computation per hold, from when it started', async () => {
    let now = 1_000
    let runs = 0
    const hold = createAnswerHold<number>(100, () => now)
    const compute = async () => ++runs
    expect(await hold.get(compute)).toBe(1)
    now = 1_099
    expect(await hold.get(compute)).toBe(1)
    now = 1_100
    expect(await hold.get(compute)).toBe(2)
  })

  it('shares a running computation', async () => {
    let finish: (value: string) => void = () => {}
    let runs = 0
    const hold = createAnswerHold<string>(100, () => 0)
    const compute = () => {
      runs += 1
      return new Promise<string>((resolve) => { finish = resolve })
    }
    const first = hold.get(compute)
    const second = hold.get(compute)
    finish('answer')
    expect(await Promise.all([first, second])).toStrictEqual(['answer', 'answer'])
    expect(runs).toBe(1)
  })

  it('keeps nothing from a computation that throws', async () => {
    let now = 0
    const hold = createAnswerHold<string>(100, () => now)
    expect(await hold.get(async () => 'ok')).toBe('ok')
    now = 100
    await expect(hold.get(async () => { throw new Error('could not check') })).rejects.toThrow('could not check')
    now = 101
    expect(await hold.get(async () => 'checked again')).toBe('checked again')
  })

  it('keeps nothing from a computation that throws at once', async () => {
    const hold = createAnswerHold<string>(100, () => 0)
    await expect(hold.get(() => { throw new Error('could not start') })).rejects.toThrow('could not start')
    expect(await hold.get(async () => 'checked again')).toBe('checked again')
  })

  it('checks again when the clock goes back', async () => {
    let now = 500
    let runs = 0
    const hold = createAnswerHold<number>(100, () => now)
    await hold.get(async () => ++runs)
    now = 400
    expect(await hold.get(async () => ++runs)).toBe(2)
  })
})
