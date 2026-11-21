import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeTables, type FakeTables, type Row } from '@/lib/test-helpers/fake-rest-tables'
import {
  BATCH_SIZE,
  JOB_RETENTION_DEFAULT_DAYS,
  MAX_BATCHES,
  PART_SIZE,
  TIME_BUDGET_MS,
  jobRetentionCutoff,
  jobRetentionDays,
  jobRetentionMode,
  runJobRetention,
  type JobRetentionStore,
} from './job-retention'

// Clean-up of expired imported jobs (owner decision D140). The route runs
// with real supabase-js clients from the factory; only the network is fake.

const reports = vi.hoisted(() => [] as unknown[][])
vi.mock('@/lib/report-error', () => ({
  reportServerError: (...args: unknown[]) => { reports.push(args) },
}))

import { GET as pruneExpiredJobs } from '@/app/api/cron/prune-expired-jobs/route'

const DB_URL = 'https://example.supabase.co'
const SITE = 'https://accountingbody.com'
const NOW = Date.parse('2026-11-14T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000
const CRON_TEST_VALUE = 'cron-test-value'
const iso = (ms: number) => new Date(ms).toISOString()
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

let db: FakeTables
const logs: unknown[][] = []

const job = (n: number, row: Row = {}): Row => ({
  id: uuid(n), source: 'adzuna', status: 'expired', closed_at: iso(NOW - 40 * DAY), slug: `job-${n}`, ...row,
})

const cron = (authorization?: string) =>
  new NextRequest(`${SITE}/api/cron/prune-expired-jobs`, { headers: authorization === undefined ? {} : { authorization } })
const run = async () => {
  const res = await pruneExpiredJobs(cron(`Bearer ${CRON_TEST_VALUE}`))
  return { status: res.status, body: await res.json() }
}
const ids = () => db.tables.jobs.map((r) => r.id).sort()
const of = (method: string, table: string) => db.requests.filter((r) => r.method === method && r.table === table)

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  db = fakeTables(DB_URL, { jobs: [], job_applications: [] })
  vi.stubGlobal('fetch', vi.fn(db.fetch))
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('CRON_SECRET', CRON_TEST_VALUE)
  vi.stubEnv('JOB_RETENTION', 'on')
  vi.stubEnv('JOB_RETENTION_DAYS', undefined)
  for (const level of ['error', 'warn', 'log', 'info'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => { logs.push(args) })
  }
  logs.length = 0
  reports.length = 0
})

afterEach(() => {
  // Only these two tables are ever used, and job_applications is only read.
  for (const request of db.requests) {
    expect(['jobs', 'job_applications']).toContain(request.table)
    if (request.table === 'job_applications') expect(request.method).toBe('GET')
    expect(['GET', 'DELETE']).toContain(request.method)
  }
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ── Pure rules ──────────────────────────────────────────────────────────────

describe('job retention rules', () => {
  it.each([
    [undefined, 'off'], ['', 'off'], ['off', 'off'], ['true', 'off'], ['ON', 'off'], [' on', 'off'],
    ['on ', 'off'], ['dry-run ', 'off'], ['DRY-RUN', 'off'], ['dry-run', 'dry-run'], ['on', 'on'],
  ])('reads the switch value %j as %s', (value, mode) => {
    expect(jobRetentionMode(value)).toBe(mode)
  })

  it.each([
    [undefined, 30], ['', 30], ['30', 30], ['14', 14], ['365', 365], ['13', 30], ['366', 30], ['0', 30],
    ['45', 45], ['045', 30], ['30.5', 30], ['-30', 30], [' 60', 30], ['60 ', 30], ['1e2', 30], ['abc', 30], ['1000', 30],
  ])('reads the days value %j as %i', (value, days) => {
    expect(jobRetentionDays(value)).toBe(days)
  })

  it('defaults to 30 days and cuts off strictly before that', () => {
    expect(JOB_RETENTION_DEFAULT_DAYS).toBe(30)
    expect(jobRetentionCutoff(new Date(NOW), 30)).toBe(iso(NOW - 30 * DAY))
  })
})

// ── The run, with a fake store ──────────────────────────────────────────────

function store(options: { due: number; guarded?: Set<string> }) {
  const left = Array.from({ length: options.due }, (_, i) => uuid(i + 1))
  const calls = { findDue: [] as (string | null)[], guard: [] as number[], remove: [] as number[] }
  const s: JobRetentionStore = {
    findDue: async (_cutoff, limit, after) => {
      calls.findDue.push(after)
      return left.filter((id) => after === null || id > after).slice(0, limit)
    },
    withApplications: async (part) => {
      calls.guard.push(part.length)
      return new Set(part.filter((id) => options.guarded?.has(id)))
    },
    remove: async (part) => {
      calls.remove.push(part.length)
      for (const id of part) left.splice(left.indexOf(id), 1)
      return part.length
    },
  }
  return { s, calls, left }
}

describe('job retention run limits', () => {
  it('works in batches until a short batch, deleting in parts of at most PART_SIZE', async () => {
    const { s, calls, left } = store({ due: 2 * BATCH_SIZE + 30 })
    const result = await runJobRetention('on', 30, s, () => NOW)
    expect(result).toStrictEqual({ ok: true, mode: 'on', deleted: 2 * BATCH_SIZE + 30, kept: 0, more: false })
    expect(left).toHaveLength(0)
    expect(Math.max(...calls.remove)).toBe(PART_SIZE)
    expect(Math.max(...calls.guard)).toBe(PART_SIZE)
    expect(calls.findDue).toHaveLength(3)
  })

  it(`stops after ${MAX_BATCHES} batches and says more remain`, async () => {
    const { s, calls } = store({ due: (MAX_BATCHES + 2) * BATCH_SIZE })
    const result = await runJobRetention('on', 30, s, () => NOW)
    expect(result).toMatchObject({ ok: true, deleted: MAX_BATCHES * BATCH_SIZE, more: true })
    expect(calls.findDue).toHaveLength(MAX_BATCHES)
  })

  it('starts no new batch once the time budget has passed', async () => {
    const { s, calls } = store({ due: 5 * BATCH_SIZE })
    let t = NOW
    const clock = () => {
      const now = t
      t += TIME_BUDGET_MS / 2
      return now
    }
    const result = await runJobRetention('on', 30, s, clock)
    expect(result).toMatchObject({ ok: true, more: true })
    expect(calls.findDue.length).toBeLessThan(5)
  })

  it('keeps guarded jobs and still moves past a full batch of them', async () => {
    const guarded = new Set(Array.from({ length: BATCH_SIZE }, (_, i) => uuid(i + 1)))
    const { s, calls, left } = store({ due: BATCH_SIZE + 10, guarded })
    const result = await runJobRetention('on', 30, s, () => NOW)
    expect(result).toStrictEqual({ ok: true, mode: 'on', deleted: 10, kept: BATCH_SIZE, more: false })
    expect(left).toStrictEqual(Array.from(guarded))
    expect(calls.findDue).toStrictEqual([null, uuid(BATCH_SIZE)])
  })

  it('dry-run reads one batch and deletes nothing', async () => {
    const { s, calls } = store({ due: BATCH_SIZE + 10, guarded: new Set([uuid(1), uuid(2)]) })
    const result = await runJobRetention('dry-run', 30, s, () => NOW)
    expect(result).toStrictEqual({ ok: true, mode: 'dry-run', wouldDeleteAtLeast: BATCH_SIZE - 2, kept: 2 })
    expect(calls.remove).toHaveLength(0)
    expect(calls.findDue).toHaveLength(1)
  })

  it('the first problem ends the run with the count so far', async () => {
    const { s } = store({ due: 2 * BATCH_SIZE })
    let reads = 0
    const failing: JobRetentionStore = {
      ...s,
      findDue: async (...args) => {
        if (++reads === 2) throw Object.assign(new Error('x'), { code: '57014' })
        return s.findDue(...args)
      },
    }
    const result = await runJobRetention('on', 30, failing, () => NOW)
    expect(result).toMatchObject({ ok: false, deleted: BATCH_SIZE })
  })
})

// ── The route ───────────────────────────────────────────────────────────────

describe('prune-expired-jobs route', () => {
  it('answers 503 when CRON_SECRET is not set, and 401 for a wrong or missing header', async () => {
    db.tables.jobs.push(job(1))
    vi.stubEnv('CRON_SECRET', '')
    expect((await pruneExpiredJobs(cron(`Bearer ${CRON_TEST_VALUE}`))).status).toBe(503)
    vi.stubEnv('CRON_SECRET', CRON_TEST_VALUE)
    expect((await pruneExpiredJobs(cron('Bearer wrong'))).status).toBe(401)
    expect((await pruneExpiredJobs(cron())).status).toBe(401)
    expect(db.requests).toHaveLength(0)
    expect(ids()).toStrictEqual([uuid(1)])
  })

  it.each([undefined, '', 'off', 'ON', 'true', 'yes', ' on'])('does nothing when JOB_RETENTION is %j', async (value) => {
    db.tables.jobs.push(job(1))
    vi.stubEnv('JOB_RETENTION', value)
    expect(await run()).toStrictEqual({ status: 200, body: { mode: 'off' } })
    expect(db.requests).toHaveLength(0)
    expect(ids()).toStrictEqual([uuid(1)])
  })

  function fixture() {
    db.tables.jobs.push(
      job(1), // due
      job(2), // due
      job(3), // has an application
      job(4, { source: 'employer' }),
      job(5, { closed_at: iso(NOW - 20 * DAY) }), // too recent
      job(6, { status: 'active', closed_at: null }),
      job(7, { closed_at: null }),
      job(8, { status: 'closed' }),
      job(9, { status: 'rejected' }),
      job(10, { source: 'employer', closed_at: iso(NOW - 300 * DAY) }),
    )
    db.tables.job_applications.push({ id: uuid(901), job_id: uuid(3) })
  }

  it('dry-run counts only the due jobs and deletes nothing', async () => {
    fixture()
    vi.stubEnv('JOB_RETENTION', 'dry-run')
    expect(await run()).toStrictEqual({ status: 200, body: { mode: 'dry-run', days: 30, wouldDeleteAtLeast: 2, kept: 1 } })
    expect(of('DELETE', 'jobs')).toHaveLength(0)
    expect(ids()).toHaveLength(10)
  })

  it('on deletes only imported expired jobs closed before the cutoff with no application', async () => {
    fixture()
    expect(await run()).toStrictEqual({ status: 200, body: { mode: 'on', days: 30, deleted: 2, kept: 1, more: false } })
    expect(ids()).toStrictEqual([3, 4, 5, 6, 7, 8, 9, 10].map(uuid))
    const cutoff = iso(NOW - 30 * DAY)
    const [read] = of('GET', 'jobs')
    expect(read.params).toEqual(expect.arrayContaining([
      ['source', 'neq.employer'], ['status', 'eq.expired'], ['closed_at', 'not.is.null'], ['closed_at', `lt.${cutoff}`],
    ]))
    const [remove] = of('DELETE', 'jobs')
    expect(remove.params).toEqual(expect.arrayContaining([
      ['id', `in.(${uuid(1)},${uuid(2)})`], ['source', 'neq.employer'], ['status', 'eq.expired'], ['closed_at', `lt.${cutoff}`],
    ]))
  })

  it('never selects employer jobs or jobs with an application', async () => {
    fixture()
    vi.stubEnv('JOB_RETENTION', 'dry-run')
    await run()
    vi.stubEnv('JOB_RETENTION', 'on')
    await run()
    for (const r of of('DELETE', 'jobs')) {
      const list = r.params.find(([k]) => k === 'id')![1]
      for (const kept of [3, 4, 10]) expect(list).not.toContain(uuid(kept))
    }
    expect(ids()).toEqual(expect.arrayContaining([uuid(3), uuid(4), uuid(10)]))
  })

  it('reads every page of applications before deciding', async () => {
    db.tables.jobs.push(job(1), job(2))
    for (let i = 0; i < 1200; i++) db.tables.job_applications.push({ id: uuid(10_000 + i), job_id: uuid(1) })
    db.tables.job_applications.push({ id: uuid(20_000), job_id: uuid(2) })
    expect(await run()).toMatchObject({ status: 200, body: { deleted: 0, kept: 2 } })
    expect(of('GET', 'job_applications').length).toBeGreaterThan(1)
    expect(ids()).toStrictEqual([uuid(1), uuid(2)])
  })

  it.each([['60', 60, 0], ['13', 30, 2], ['14', 14, 3]])('JOB_RETENTION_DAYS %j uses %i days', async (value, days, deleted) => {
    db.tables.jobs.push(job(1), job(2), job(5, { closed_at: iso(NOW - 20 * DAY) }))
    vi.stubEnv('JOB_RETENTION_DAYS', value)
    expect(await run()).toMatchObject({ status: 200, body: { mode: 'on', days, deleted } })
  })

  it.each([
    ['the job read', 'jobs', 'GET'],
    ['the applications read', 'job_applications', 'GET'],
    ['the delete', 'jobs', 'DELETE'],
  ])('a failure in %s answers 500, logs the short code, reports, and deletes nothing more', async (_n, table, method) => {
    fixture()
    db.problem = (r) => (r.table === table && r.method === method ? 'fail' : undefined)
    expect(await run()).toStrictEqual({ status: 500, body: { error: 'Cron run failed', deleted: 0 } })
    expect(logs).toContainEqual(['cron/prune-expired-jobs: fatal error (22P02)'])
    expect(reports).toHaveLength(1)
    expect(reports[0][0]).toBe('job retention run failed')
    expect(reports[0][2]).toStrictEqual({ area: 'cron' })
    expect(ids()).toHaveLength(10)
    expect(JSON.stringify(logs)).not.toContain('seed problem text')
  })
})

// ── Set-up ──────────────────────────────────────────────────────────────────

describe('job retention set-up', () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

  it('vercel.json has exactly the seven crons, this one daily at 07:30 UTC', () => {
    expect((JSON.parse(read('vercel.json')) as { crons: unknown[] }).crons).toStrictEqual([
      { path: '/api/cron/expire-jobs', schedule: '0 6 * * *' },
      { path: '/api/ingest/orchestrator', schedule: '*/15 * * * *' },
      { path: '/api/cron/prune-pending-subscribers', schedule: '30 6 * * *' },
      { path: '/api/cron/prune-saved-jobs', schedule: '0 7 * * *' },
      { path: '/api/cron/prune-expired-jobs', schedule: '30 7 * * *' },
      { path: '/api/cron/prune-import-logs', schedule: '45 7 * * *' },
      { path: '/api/cron/similar-jobs', schedule: '4 3 * * *' },
    ])
  })

  it('lists its settings in the example settings', () => {
    expect(read('.env.example')).toMatch(/^JOB_RETENTION=$/m)
    expect(read('.env.example')).toMatch(/^JOB_RETENTION_DAYS=$/m)
  })

  it('uses the cron database context', () => {
    expect(read('app/api/cron/prune-expired-jobs/route.ts')).toMatch(/getServerSupabase\('cron'\)/)
  })
})
