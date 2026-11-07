import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHECKS } from '@/lib/ops-status'

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
  requests: [] as { table: string; method: string; params: [string, string][] }[],
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function matches(row: Row, key: string, value: string): boolean {
  const cell = row[key]
  if (value.startsWith('eq.')) return String(cell) === value.slice(3)
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
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  state.reports.length = 0
  db.tables = healthyTables()
  db.failing = new Set()
  db.failCode = 'XX000'
  db.requests = []
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
      checks: { 'job-import': 'ok', 'job-expiry': 'ok', 'subscriber-cleanup': 'ok', 'saved-jobs-cleanup': 'ok' },
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
      checks: { 'job-import': 'ok', 'job-expiry': 'late', 'subscriber-cleanup': 'ok', 'saved-jobs-cleanup': 'ok' },
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
    for (const table of ['provider_runs', 'jobs', 'email_subscribers', 'saved_jobs']) db.failing.add(table)
    const result = await call()
    expect(result.status).toBe(503)
    expect(Object.values(result.body.checks)).toStrictEqual(['unknown', 'unknown', 'unknown', 'unknown'])
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
      () => { vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '') },
    ]
    for (const scenario of scenarios) {
      db.tables = healthyTables()
      db.failing = new Set()
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
      scenario()
      const { text, body } = await call()
      expectAllowedShape(text, body)
    }
  })

  it('makes one small read per check with only the columns it needs', async () => {
    await call()
    const byTable = Object.fromEntries(db.requests.map((request) => [request.table, request]))
    expect(db.requests).toHaveLength(4)
    expect(db.requests.every((request) => request.method === 'GET')).toBe(true)
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
