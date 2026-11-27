import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// PRIV-2 S4 / PRIV-5 (D353, D356): the daily personal-data clean-up, in
// count-only mode unless RETENTION_DELETE is exactly "on". Real supabase-js
// clients run against the shared in-memory tables, so the filters tested are
// the ones the database receives.

vi.mock('@sentry/nextjs', () => ({ captureException: () => {}, captureMessage: () => {} }))
vi.mock('./data-retention', async (importOriginal) => {
  const real = await importOriginal<typeof import('./data-retention')>()
  return { ...real, runDataRetention: vi.fn(real.runDataRetention) }
})

import { GET as prunePending } from '@/app/api/cron/prune-pending-subscribers/route'
import { GET as opsStatus } from '@/app/api/ops-status/route'
import { CHECKS, DAILY_GRACE_MS, opsStatusHold } from './ops-status'
import { fakeTables, type FakeTables, type Row } from './test-helpers/fake-rest-tables'
import { getServerSupabase } from './supabase-server'
import {
  BATCH_SIZE,
  MAX_BATCHES,
  PART_SIZE,
  RETENTION_RULES,
  TIME_BUDGET_MS,
  dataRetentionMode,
  dateOrFilter,
  daysBefore,
  monthsBefore,
  ruleCutoff,
  runDataRetention,
  type RetentionRuleId,
} from './data-retention'

const DB_URL = 'https://example.supabase.co'
const NOW = new Date('2026-11-27T06:30:00.000Z')
const DAY = 24 * 60 * 60 * 1000
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString()
const iso = (s: string) => new Date(s).toISOString()
const rule = (id: RetentionRuleId) => RETENTION_RULES.find((r) => r.id === id)!
const ids = (rows: Row[]) => rows.map((r) => r.id).sort()

let db: FakeTables
let infoLogs: string[] = []
let errorLogs: string[] = []

// Rows on both sides of every rule's cut-off. "due" rows are past their
// keeping period at NOW; "keep" rows are not.
function seed(): Record<string, Row[]> {
  return {
    contact_submissions: [
      { id: 'c-due', created_at: iso('2024-11-26T06:29:59Z') },
      { id: 'c-keep', created_at: iso('2024-11-27T06:30:00Z') },
    ],
    help_requests: [
      { id: 'h-due', created_at: iso('2023-01-01T00:00:00Z') },
      { id: 'h-keep', created_at: ago(DAY) },
    ],
    email_subscribers: [
      { id: 's-due', status: 'unsubscribed', unsubscribed_at: ago(31 * DAY), updated_at: ago(DAY) },
      { id: 's-due-fallback', status: 'unsubscribed', unsubscribed_at: null, updated_at: ago(31 * DAY) },
      { id: 's-keep-recent', status: 'unsubscribed', unsubscribed_at: ago(29 * DAY), updated_at: ago(60 * DAY) },
      { id: 's-keep-fallback', status: 'unsubscribed', unsubscribed_at: null, updated_at: ago(29 * DAY) },
      { id: 's-keep-subscribed', status: 'subscribed', unsubscribed_at: ago(400 * DAY), updated_at: ago(400 * DAY) },
    ],
    firms_applications: [
      { id: 'f-due', status: 'rejected', reviewed_at: iso('2026-05-26T00:00:00Z'), updated_at: ago(DAY) },
      { id: 'f-due-fallback', status: 'rejected', reviewed_at: null, updated_at: iso('2026-05-01T00:00:00Z') },
      { id: 'f-keep-recent', status: 'rejected', reviewed_at: iso('2026-05-28T00:00:00Z'), updated_at: ago(400 * DAY) },
      { id: 'f-keep-approved', status: 'approved', reviewed_at: iso('2020-01-01T00:00:00Z'), updated_at: iso('2020-01-01T00:00:00Z') },
      { id: 'f-keep-pending', status: 'pending', reviewed_at: null, updated_at: iso('2020-01-01T00:00:00Z') },
    ],
    job_seeker_registrations: [
      { id: 'j-due', created_at: iso('2024-01-01T00:00:00Z'), verified_at: iso('2024-01-02T00:00:00Z'), reviewed_at: null },
      { id: 'j-keep-reviewed', created_at: iso('2024-01-01T00:00:00Z'), verified_at: null, reviewed_at: ago(DAY) },
      { id: 'j-keep-new', created_at: ago(DAY), verified_at: null, reviewed_at: null },
    ],
    admin_recycle_bin: [
      { id: 'b-due', expires_at: ago(1000) },
      { id: 'b-keep', expires_at: ago(-DAY) },
    ],
  }
}

const DUE_NOW: Record<RetentionRuleId, number> = { R1: 1, R2: 1, R3: 2, R4: 2, R5: 1, R6: 1 }

function setup(tables: Record<string, Row[]> = seed()) {
  db = fakeTables(DB_URL, tables)
  vi.stubGlobal('fetch', vi.fn(db.fetch))
}

const supabase = () => getServerSupabase('cron')
const run = (mode: 'count' | 'on', extra: { clock?: () => number; startedAt?: number } = {}) =>
  runDataRetention({ supabase: supabase(), now: NOW, mode, ...extra })
const deletes = () => db.requests.filter((r) => r.method === 'DELETE')
const cronRequest = () => new NextRequest('https://accountingbody.com/api/cron/prune-pending-subscribers', { headers: { authorization: 'Bearer cron-test-value' } })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('CRON_SECRET', 'cron-test-value')
  vi.stubEnv('RETENTION_DELETE', undefined)
  vi.stubEnv('JOB_RETENTION', undefined)
  infoLogs = []
  errorLogs = []
  const text = (args: unknown[]) => args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => { infoLogs.push(text(args)) })
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { errorLogs.push(text(args)) })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  opsStatusHold.clear()
  setup()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('cut-offs (calendar months and days, UTC)', () => {
  it.each([
    ['2028-03-31T10:00:00Z', 24, '2026-03-31T10:00:00.000Z'],
    ['2028-02-29T10:00:00Z', 24, '2026-02-28T10:00:00.000Z'],
    ['2026-08-31T00:00:00Z', 6, '2026-02-28T00:00:00.000Z'],
    ['2028-08-31T23:59:59Z', 6, '2028-02-29T23:59:59.000Z'],
    ['2026-01-15T06:30:00Z', 6, '2025-07-15T06:30:00.000Z'],
    ['2026-11-27T06:30:00Z', 24, '2024-11-27T06:30:00.000Z'],
    ['2026-12-31T12:00:00Z', 6, '2026-06-30T12:00:00.000Z'],
  ])('%s minus %i months is %s', (from, months, want) => {
    expect(monthsBefore(new Date(from), months).toISOString()).toBe(want)
  })

  it('days are whole 24-hour days', () => {
    expect(daysBefore(NOW, 30).toISOString()).toBe('2026-10-28T06:30:00.000Z')
  })

  it('each rule uses its approved period', () => {
    expect(RETENTION_RULES.map((r) => [r.id, r.table, ruleCutoff(r, NOW)])).toStrictEqual([
      ['R1', 'contact_submissions', '2024-11-27T06:30:00.000Z'],
      ['R2', 'help_requests', '2024-11-27T06:30:00.000Z'],
      ['R3', 'email_subscribers', '2026-10-28T06:30:00.000Z'],
      ['R4', 'firms_applications', '2026-05-27T06:30:00.000Z'],
      ['R5', 'job_seeker_registrations', '2024-11-27T06:30:00.000Z'],
      ['R6', 'admin_recycle_bin', '2026-11-27T06:30:00.000Z'],
    ])
    expect(RETENTION_RULES.filter((r) => !r.deletes).map((r) => r.id)).toStrictEqual(['R5'])
  })

  it('the date filters are the approved ones', () => {
    const c = '2026-01-01T00:00:00.000Z'
    // PRIV-2b: R1 and R2 use the latest of created_at, updated_at, resolved_at.
    for (const id of ['R1', 'R2'] as const) {
      expect(dateOrFilter(rule(id), c)).toBe(`and(created_at.lt."${c}",or(updated_at.is.null,updated_at.lt."${c}"),or(resolved_at.is.null,resolved_at.lt."${c}"))`)
    }
    expect(dateOrFilter(rule('R6'), c)).toBeNull()
    expect(dateOrFilter(rule('R3'), c)).toBe(`unsubscribed_at.lt."${c}",and(unsubscribed_at.is.null,updated_at.lt."${c}")`)
    expect(dateOrFilter(rule('R4'), c)).toBe(`reviewed_at.lt."${c}",and(reviewed_at.is.null,updated_at.lt."${c}")`)
    expect(dateOrFilter(rule('R5'), c)).toBe(`and(created_at.lt."${c}",or(verified_at.is.null,verified_at.lt."${c}"),or(reviewed_at.is.null,reviewed_at.lt."${c}"))`)
  })
})

describe('the switch', () => {
  it.each([
    ['on', 'on'],
    ['ON', 'count'],
    [' on', 'count'],
    ['on ', 'count'],
    ['true', 'count'],
    ['off', 'count'],
    ['', 'count'],
    [undefined, 'count'],
  ] as const)('%j → %s', (value, mode) => {
    expect(dataRetentionMode(value)).toBe(mode)
  })

  it('the limits are the approved ones', () => {
    expect([BATCH_SIZE, PART_SIZE, MAX_BATCHES, TIME_BUDGET_MS]).toStrictEqual([500, 100, 10, 40_000])
  })
})

describe('count mode', () => {
  it('counts the due rows of every rule and never deletes', async () => {
    const before = JSON.stringify(db.tables)
    const result = await run('count')
    expect(result.mode).toBe('count')
    for (const id of Object.keys(DUE_NOW) as RetentionRuleId[]) expect(result.rules[id]).toStrictEqual({ due: DUE_NOW[id], deleted: 0 })
    expect(db.requests.map((r) => r.method)).toStrictEqual(['HEAD', 'HEAD', 'HEAD', 'HEAD', 'HEAD', 'HEAD'])
    expect(deletes()).toStrictEqual([])
    expect(JSON.stringify(db.tables)).toBe(before)
  })

  it('selects only id, with an exact count and no rows', async () => {
    await run('count')
    for (const r of db.requests) expect(r.params.find(([k]) => k === 'select')?.[1]).toBe('id')
  })

  it('logs one line per rule with counts only', async () => {
    await run('count')
    expect(infoLogs).toStrictEqual([
      'data retention|R1|count|due:1|deleted:0',
      'data retention|R2|count|due:1|deleted:0',
      'data retention|R3|count|due:2|deleted:0',
      'data retention|R4|count|due:2|deleted:0',
      'data retention|R5|count|due:1|deleted:0',
      'data retention|R6|count|due:1|deleted:0',
    ])
    expect(errorLogs).toStrictEqual([])
  })

  it('a failed count ends only that rule, with its code', async () => {
    db.problem = (r) => (r.table === 'help_requests' ? 'fail' : undefined)
    const result = await run('count')
    expect(result.rules.R2).toStrictEqual({ due: null, deleted: 0, error: '22P02' })
    expect(result.rules.R3).toStrictEqual({ due: 2, deleted: 0 })
    expect(errorLogs).toStrictEqual(['data retention|R2|count|due:-|deleted:0|error:22P02'])
  })
})

describe('on mode', () => {
  it('deletes exactly the due rows (never R5) and keeps the rest', async () => {
    const result = await run('on')
    expect(result.rules).toStrictEqual({
      R1: { due: 1, deleted: 1 },
      R2: { due: 1, deleted: 1 },
      R3: { due: 2, deleted: 2 },
      R4: { due: 2, deleted: 2 },
      R5: { due: 1, deleted: 0 },
      R6: { due: 1, deleted: 1 },
    })
    expect(ids(db.tables.contact_submissions)).toStrictEqual(['c-keep'])
    expect(ids(db.tables.help_requests)).toStrictEqual(['h-keep'])
    expect(ids(db.tables.email_subscribers)).toStrictEqual(['s-keep-fallback', 's-keep-recent', 's-keep-subscribed'])
    expect(ids(db.tables.firms_applications)).toStrictEqual(['f-keep-approved', 'f-keep-pending', 'f-keep-recent'])
    expect(ids(db.tables.job_seeker_registrations)).toStrictEqual(['j-due', 'j-keep-new', 'j-keep-reviewed'])
    expect(ids(db.tables.admin_recycle_bin)).toStrictEqual(['b-keep'])
    expect(deletes().map((r) => r.table)).not.toContain('job_seeker_registrations')
  })

  it('every delete repeats the whole filter', async () => {
    await run('on')
    const r3 = deletes().find((r) => r.table === 'email_subscribers')!
    expect(r3.params).toEqual(expect.arrayContaining([['status', 'eq.unsubscribed'], ['or', `(${dateOrFilter(rule('R3'), ruleCutoff(rule('R3'), NOW))})`]]))
    expect(r3.params.find(([k]) => k === 'id')?.[1]).toBe('in.(s-due,s-due-fallback)')
    const r1 = deletes().find((r) => r.table === 'contact_submissions')!
    expect(r1.params).toContainEqual(['or', `(${dateOrFilter(rule('R1'), ruleCutoff(rule('R1'), NOW))})`])
  })

  it('a row that changed between the read and the delete is kept', async () => {
    const inner = db.fetch
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'DELETE' && String(input).includes('/email_subscribers')) {
        const row = db.tables.email_subscribers.find((r) => r.id === 's-due')!
        row.status = 'subscribed'
      }
      return inner(input, init)
    }))
    const result = await run('on')
    expect(result.rules.R3).toStrictEqual({ due: 2, deleted: 1 })
    expect(ids(db.tables.email_subscribers)).toContain('s-due')
  })

  it('never copies a deleted row to the recycle bin', async () => {
    await run('on')
    expect(db.requests.filter((r) => r.table === 'admin_recycle_bin' && r.method === 'POST')).toStrictEqual([])
  })

  it('R6 uses the bin\'s own clean-up (purgeExpired): one DELETE by expires_at only', async () => {
    await run('on')
    const bin = deletes().filter((r) => r.table === 'admin_recycle_bin')
    expect(bin).toHaveLength(1)
    expect(bin[0].params).toStrictEqual([['expires_at', `lt.${NOW.toISOString()}`]])
  })

  it('deletes in batches of 500, 100 ids per delete, at most 10 batches per rule', async () => {
    const many = Array.from({ length: 5_100 }, (_, i) => ({ id: `c${String(i).padStart(5, '0')}`, created_at: iso('2020-01-01T00:00:00Z') }))
    setup({ ...seed(), contact_submissions: many })
    const result = await run('on')
    expect(result.rules.R1).toStrictEqual({ due: 5_100, deleted: 5_000 })
    expect(db.tables.contact_submissions).toHaveLength(100)
    const reads = db.requests.filter((r) => r.table === 'contact_submissions' && r.method === 'GET')
    expect(reads).toHaveLength(MAX_BATCHES)
    for (const r of reads) expect(r.params).toContainEqual(['limit', '500'])
    expect(deletes().filter((r) => r.table === 'contact_submissions')).toHaveLength(50)
  })

  it('starts no rule or batch once the 40 s budget has passed', async () => {
    const result = await run('on', { clock: () => 0, startedAt: -TIME_BUDGET_MS })
    for (const id of Object.keys(DUE_NOW) as RetentionRuleId[]) expect(result.rules[id]).toStrictEqual({ due: null, deleted: 0, error: 'time_budget' })
    expect(db.requests).toStrictEqual([])
  })

  it('a batch that would start after the budget is not started', async () => {
    const many = Array.from({ length: 1_200 }, (_, i) => ({ id: `c${String(i).padStart(5, '0')}`, created_at: iso('2020-01-01T00:00:00Z') }))
    setup({ ...seed(), contact_submissions: many })
    let reads = 0
    const inner = db.fetch
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'GET' && String(input).includes('/contact_submissions')) reads++
      return inner(input, init)
    }))
    // The clock passes the budget once the first batch has been read.
    const result = await run('on', { clock: () => (reads >= 1 ? TIME_BUDGET_MS : 0), startedAt: 0 })
    expect(result.rules.R1).toStrictEqual({ due: 1_200, deleted: 500, error: 'time_budget' })
    expect(reads).toBe(1)
    expect(result.rules.R2.error).toBe('time_budget')
  })

  it('the first delete error ends that rule only; nothing is retried', async () => {
    db.problem = (r) => (r.method === 'DELETE' && r.table === 'contact_submissions' ? 'fail' : undefined)
    const result = await run('on')
    expect(result.rules.R1).toStrictEqual({ due: 1, deleted: 0, error: '22P02' })
    expect(deletes().filter((r) => r.table === 'contact_submissions')).toHaveLength(1)
    expect(result.rules.R2).toStrictEqual({ due: 1, deleted: 1 })
  })

  it('log lines never hold a row, an id or an address', async () => {
    setup({ ...seed(), email_subscribers: [{ id: 's-x', email: 'ada@example.com', status: 'unsubscribed', unsubscribed_at: ago(40 * DAY), updated_at: ago(40 * DAY) }] })
    db.problem = (r) => (r.table === 'help_requests' ? 'fail' : undefined)
    await run('on')
    for (const line of [...infoLogs, ...errorLogs]) {
      expect(line).toMatch(/^data retention\|R[1-6]\|on\|due:(\d+|-)\|deleted:\d+(\|error:[A-Za-z0-9_]+)?$/)
      expect(line).not.toContain('ada')
      expect(line).not.toContain('s-x')
    }
  })
})

describe('the daily cron (step 2 of /api/cron/prune-pending-subscribers)', () => {
  const pendingOld = { id: 'p-old', email: 'p@example.com', status: 'pending', last_confirmation_sent_at: ago(8 * DAY) }

  it('answers { pruned, retention } in count mode and deletes no personal data', async () => {
    setup({ ...seed(), email_subscribers: [...seed().email_subscribers, pendingOld] })
    const res = await prunePending(cronRequest())
    expect(res.status).toBe(200)
    expect(await res.json()).toStrictEqual({
      pruned: 1,
      retention: { mode: 'count', rules: Object.fromEntries((Object.keys(DUE_NOW) as RetentionRuleId[]).map((id) => [id, { due: DUE_NOW[id], deleted: 0 }])) },
    })
    expect(deletes().map((r) => r.table)).toStrictEqual(['email_subscribers'])
    expect(deletes()[0].params).toContainEqual(['status', 'eq.pending'])
  })

  it('deletes only when RETENTION_DELETE is exactly "on"', async () => {
    vi.stubEnv('RETENTION_DELETE', 'on')
    const res = await prunePending(cronRequest())
    const body = await res.json()
    expect(body.retention.mode).toBe('on')
    expect(body.retention.rules.R1).toStrictEqual({ due: 1, deleted: 1 })
    expect(body.retention.rules.R5).toStrictEqual({ due: 1, deleted: 0 })
  })

  it('still prunes pending rows and answers 200 when the clean-up throws', async () => {
    setup({ ...seed(), email_subscribers: [pendingOld] })
    vi.mocked(runDataRetention).mockRejectedValueOnce(Object.assign(new Error('boom ada@example.com'), { code: 'XX000' }))
    const res = await prunePending(cronRequest())
    expect(res.status).toBe(200)
    expect(await res.json()).toStrictEqual({ pruned: 1, retention: { mode: 'count', error: 'failed' } })
    expect(db.tables.email_subscribers).toStrictEqual([])
    expect(errorLogs).toStrictEqual(['cron/prune-pending-subscribers: data retention failed XX000'])
  })

  it('the time budget counts from the start of the route', async () => {
    await prunePending(cronRequest())
    const call = vi.mocked(runDataRetention).mock.calls.at(-1)![0]
    expect(call.startedAt).toBe(NOW.getTime())
    expect(call.now.toISOString()).toBe(NOW.toISOString())
  })

  it('the route keeps maxDuration 60 and says it runs the clean-up', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/cron/prune-pending-subscribers/route.ts'), 'utf8')
    expect(source).toContain('export const maxDuration = 60')
    expect(source).toContain('Step 2 runs the personal-data')
  })
})

describe('the /api/ops-status data-retention check', () => {
  const overdue = (r: RetentionRuleId) => new Date(Date.parse(ruleCutoff(rule(r), NOW)) - DAILY_GRACE_MS - 1000).toISOString()
  const ruleTables = RETENTION_RULES.map((r) => r.table)
  const call = async () => (await (await opsStatus()).json()) as { checks: Record<string, string> }

  it('is the seventh check and alerting', () => {
    expect(CHECKS).toHaveLength(7)
    expect(CHECKS[6]).toStrictEqual({ name: 'data-retention', alerting: true })
  })

  it.each([undefined, '', 'ON', ' on', 'true', 'off'])('RETENTION_DELETE %j → ok with no read, even with overdue rows', async (value) => {
    vi.stubEnv('RETENTION_DELETE', value)
    setup({ contact_submissions: [{ id: 'c', created_at: overdue('R1') }] })
    const body = await call()
    expect(Object.keys(body.checks)).toHaveLength(7)
    expect(body.checks['data-retention']).toBe('ok')
    expect(db.requests.filter((r) => ruleTables.includes(r.table) && r.table !== 'email_subscribers')).toStrictEqual([])
  })

  it('on with a row overdue beyond the grace → late', async () => {
    vi.stubEnv('RETENTION_DELETE', 'on')
    setup({ firms_applications: [{ id: 'f', status: 'rejected', reviewed_at: null, updated_at: overdue('R4') }] })
    expect((await call()).checks['data-retention']).toBe('late')
  })

  it('on with rows due but inside the grace, or not deletable (R5) → ok, one limit(1) read per deleting rule', async () => {
    vi.stubEnv('RETENTION_DELETE', 'on')
    setup({
      contact_submissions: [{ id: 'c', created_at: new Date(Date.parse(ruleCutoff(rule('R1'), NOW)) - 1000).toISOString() }],
      job_seeker_registrations: [{ id: 'j', created_at: iso('2000-01-01T00:00:00Z'), verified_at: null, reviewed_at: null }],
    })
    expect((await call()).checks['data-retention']).toBe('ok')
    const reads = db.requests.filter((r) => ['contact_submissions', 'help_requests', 'firms_applications', 'admin_recycle_bin', 'job_seeker_registrations'].includes(r.table))
    expect(reads.map((r) => r.table).sort()).toStrictEqual(['admin_recycle_bin', 'contact_submissions', 'firms_applications', 'help_requests'])
    for (const r of reads) expect(r.params).toContainEqual(['limit', '1'])
  })

  it('on with a failed read and nothing overdue → unknown', async () => {
    vi.stubEnv('RETENTION_DELETE', 'on')
    setup({})
    db.problem = (r) => (r.table === 'admin_recycle_bin' ? 'fail' : undefined)
    expect((await call()).checks['data-retention']).toBe('unknown')
  })
})

// PRIV-2b: "24 months after our last contact" — for contact messages and
// enquiries the last contact is the latest of created_at, updated_at and
// resolved_at; an empty date is "no later contact", never "never due".
describe('R1 and R2: last contact', () => {
  const THREE_YEARS_OLD = iso('2023-11-01T00:00:00Z')
  const ONE_MONTH_AGO = ago(30 * DAY)
  const THIRTY_MONTHS_OLD = iso('2024-05-27T06:30:00Z')
  const cases: [string, Row, boolean][] = [
    ['updated_at 1 month ago → not due', { updated_at: ONE_MONTH_AGO, resolved_at: null }, false],
    ['resolved_at 1 month ago → not due', { updated_at: null, resolved_at: ONE_MONTH_AGO }, false],
    ['updated_at and resolved_at both empty → due', { updated_at: null, resolved_at: null }, true],
    ['all three dates older than 24 months → due', { updated_at: THIRTY_MONTHS_OLD, resolved_at: THIRTY_MONTHS_OLD }, true],
  ]
  const tables: [RetentionRuleId, string][] = [
    ['R1', 'contact_submissions'],
    ['R2', 'help_requests'],
  ]
  const call = async () => (await (await opsStatus()).json()) as { checks: Record<string, string> }

  describe.each(tables)('%s %s', (id, table) => {
    const row = (dates: Row) => ({ [table]: [{ id: 'x', created_at: THREE_YEARS_OLD, ...dates }] })

    it.each(cases)('the count: a 3-year-old row with %s', async (_name, dates, due) => {
      setup(row(dates))
      expect((await run('count')).rules[id]).toStrictEqual({ due: due ? 1 : 0, deleted: 0 })
      expect(db.tables[table]).toHaveLength(1)
    })

    it.each(cases)('the delete: a 3-year-old row with %s', async (_name, dates, due) => {
      setup(row(dates))
      expect((await run('on')).rules[id]).toStrictEqual({ due: due ? 1 : 0, deleted: due ? 1 : 0 })
      expect(db.tables[table]).toHaveLength(due ? 0 : 1)
    })

    it.each(cases)('the ops-status alarm: a 3-year-old row with %s', async (_name, dates, due) => {
      vi.stubEnv('RETENTION_DELETE', 'on')
      setup(row(dates))
      expect((await call()).checks['data-retention']).toBe(due ? 'late' : 'ok')
    })
  })

  it('the count, the delete and the alarm send the same last-contact filter', async () => {
    const filter = (cutoff: string) => ['or', `(${dateOrFilter(rule('R1'), cutoff)})`]
    setup({ contact_submissions: [{ id: 'x', created_at: THREE_YEARS_OLD, updated_at: null, resolved_at: null }] })
    await run('on')
    const work = db.requests.filter((r) => r.table === 'contact_submissions')
    expect(work.map((r) => r.method)).toStrictEqual(['HEAD', 'GET', 'DELETE'])
    for (const r of work) expect(r.params).toContainEqual(filter(ruleCutoff(rule('R1'), NOW)))

    vi.stubEnv('RETENTION_DELETE', 'on')
    setup({})
    await call()
    const alarm = db.requests.filter((r) => r.table === 'contact_submissions')
    expect(alarm).toHaveLength(1)
    expect(alarm[0].params).toContainEqual(filter(new Date(Date.parse(ruleCutoff(rule('R1'), NOW)) - DAILY_GRACE_MS).toISOString()))
  })

  it('one shared function builds the filter for all three', () => {
    const lib = readFileSync(join(process.cwd(), 'lib/data-retention.ts'), 'utf8')
    const route = readFileSync(join(process.cwd(), 'app/api/ops-status/route.ts'), 'utf8')
    expect(lib.match(/applyRuleFilter\(supabase\.from\(rule\.table\)/g)).toHaveLength(3)
    expect(route).toContain("applyRuleFilter(supabase.from(rule.table).select('id'), rule, dataRetentionOverdueBefore(rule, now))")
  })
})
