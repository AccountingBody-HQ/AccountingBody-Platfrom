import * as Sentry from '@sentry/nextjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EXPIRY_GROUP_SIZE,
  EXPIRY_PAGE_SIZE,
  JOB_EMAILS_PER_RUN_CAP,
  JOB_EXPIRY_DEFAULT_MAX,
  RESET_END_MS,
  START_BUDGET_MS,
  WORK_END_MS,
  inGroups,
  isInWarningWindow,
  jobExpiryMaxPerRun,
  mayEmailEmployer,
  problemCode,
} from './job-expiry'
import { expireJob } from './jobs'
import { clearReportWindows } from './report-error'
import { filterServerEvent, filterServerSpan, filterServerTransaction } from './sentry-privacy'

// The daily job expiry run with real supabase-js clients from the factory;
// only the network and the email provider are fake. Every database request is
// recorded. The reporting helper is wrapped so each call is counted and still
// reaches the real Sentry SDK, whose transport only records what would be sent.

const state = vi.hoisted(() => ({
  reports: [] as unknown[][],
  contexts: [] as string[],
  emails: [] as { to: unknown; subject: unknown; html: unknown }[],
  mail: [] as ('ok' | 'refused' | 'throw' | 'hang')[],
}))

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
vi.mock('@/lib/supabase-server', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/supabase-server')>()
  return {
    ...real,
    getServerSupabase: (context: Parameters<typeof real.getServerSupabase>[0]) => {
      state.contexts.push(context)
      return real.getServerSupabase(context)
    },
  }
})
vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (message: { to: unknown; subject: unknown; html: unknown }) => {
        state.emails.push({ to: message.to, subject: message.subject, html: message.html })
        const next = state.mail.shift() ?? 'ok'
        if (next === 'throw') throw new TypeError('fetch failed seed-person@example.com')
        if (next === 'hang') return new Promise(() => {})
        if (next === 'refused') {
          return { data: null, error: { name: 'rate_limit_exceeded', statusCode: 429, message: 'seed-person@example.com refused' } }
        }
        return { data: { id: 'email-id' }, error: null }
      },
    }
  },
}))
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

import { GET as expireJobs } from '@/app/api/cron/expire-jobs/route'

const realSetTimeout = globalThis.setTimeout
const DB_URL = 'https://example.supabase.co'
const SITE = 'https://accountingbody.com'
const NOW = Date.parse('2026-11-07T06:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000
const CRON_TEST_VALUE = 'cron-test-value'
const RUN_LABEL = 'job expiry run failed'
const EMAIL_LABEL = 'email: job expiry email'
const SEED_EMAIL = 'seed-person@example.com'
const SEED_TITLE = 'Seed Title Qx7'
const SEED_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const PROBLEM = {
  message: `could not update ${SEED_ID} for ${SEED_EMAIL} (${SEED_TITLE})`,
  code: 'XX000',
  details: `seed-detail ${SEED_EMAIL}`,
  hint: null,
}

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

type Row = Record<string, unknown> & { id: string; expires_at: string | null; status: string }
type Trouble = 'fail' | 'throw' | 'hang'
type Recorded = {
  method: string
  table: string
  params: [string, string][]
  prefer: string
  ids: string[]
  body: unknown
}

const net = {
  jobs: [] as Row[],
  requests: [] as Recorded[],
  // Picks a problem for a request: `nth` counts requests of the same method
  // and table, from 1.
  trouble: undefined as undefined | ((request: Recorded, nth: number) => Trouble | undefined),
  // Runs before each answer (used to move the clock).
  before: undefined as undefined | ((request: Recorded) => void),
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

const time = (row: Row) => Date.parse(String(row.expires_at))
const byKey = (a: Row, b: Row) => time(a) - time(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
const unquote = (value: string) => value.replace(/^"(.*)"$/, '$1')
const KEYSET = /^\(expires_at\.gt\.("[^"]+"),and\(expires_at\.eq\.("[^"]+"),id\.gt\.("[^"]+")\)\)$/

function readJobs(url: URL): Row[] {
  const params = url.searchParams
  expect(params.get('status')).toBe('eq.active')
  let rows = net.jobs.filter((row) => row.status === 'active')
  for (const filter of params.getAll('expires_at')) {
    if (filter === 'not.is.null') rows = rows.filter((row) => row.expires_at !== null)
    else if (filter.startsWith('lte.')) rows = rows.filter((row) => time(row) <= Date.parse(filter.slice(4)))
    else if (filter.startsWith('gt.')) rows = rows.filter((row) => time(row) > Date.parse(filter.slice(3)))
    else throw new Error('unexpected expiry filter')
  }
  const impressions = params.get('impression_count')
  if (impressions !== null) {
    expect(impressions).toBe('gt.0')
    rows = rows.filter((row) => Number(row.impression_count) > 0)
  }
  const or = params.get('or')
  if (or !== null) {
    const match = KEYSET.exec(or)
    if (!match) throw new Error('unexpected or filter')
    const [after, same, id] = [Date.parse(unquote(match[1])), Date.parse(unquote(match[2])), unquote(match[3])]
    rows = rows.filter((row) => time(row) > after || (time(row) === same && row.id > id))
  }
  const order = params.get('order')
  if (order === 'expires_at.asc,id.asc') rows = [...rows].sort(byKey)
  else if (order === 'expires_at.asc') rows = [...rows].sort((a, b) => time(a) - time(b))
  else throw new Error('unexpected order')
  const limit = params.get('limit')
  if (limit !== null) rows = rows.slice(0, Number(limit))
  const select = params.get('select') ?? '*'
  if (select === '*') return rows.map((row) => ({ ...row }))
  const columns = select.split(',').map((column) => column.trim())
  return rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]])) as Row)
}

function writeJobs(url: URL, body: Record<string, unknown>, ids: string[]): Row[] {
  const status = url.searchParams.get('status')
  const eqId = url.searchParams.get('id')?.startsWith('eq.') ? [url.searchParams.get('id')!.slice(3)] : []
  const wanted = new Set([...ids, ...eqId])
  const changed = net.jobs.filter((row) => wanted.has(row.id) && (status === null || `eq.${row.status}` === status))
  for (const row of changed) Object.assign(row, body)
  return changed
}

const counts = new Map<string, number>()

const fakeFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.origin !== DB_URL) throw new Error('unexpected request')
  const method = (init?.method ?? 'GET').toUpperCase()
  const headers = new Headers(init?.headers)
  const params: [string, string][] = []
  url.searchParams.forEach((value, key) => params.push([key, value]))
  const inList = url.searchParams.get('id') ?? ''
  const ids = inList.startsWith('in.(') ? inList.slice(4, -1).split(',').map(unquote) : []
  const table = url.pathname.replace('/rest/v1/', '')
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
  const request: Recorded = { method, table, params, prefer: headers.get('prefer') ?? '', ids, body }
  net.requests.push(request)
  const key = `${method} ${table}`
  counts.set(key, (counts.get(key) ?? 0) + 1)
  net.before?.(request)
  const trouble = net.trouble?.(request, counts.get(key)!)
  if (trouble === 'throw') throw new TypeError(`fetch failed ${SEED_EMAIL}`)
  if (trouble === 'fail') return json(PROBLEM, 500)
  if (trouble === 'hang') {
    return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal
      if (signal) signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    })
  }
  if (table === 'jobs' && method === 'GET') return json(readJobs(url))
  if (table === 'jobs' && method === 'PATCH') {
    const changed = writeJobs(url, body, ids)
    if (!request.prefer.includes('return=representation')) return new Response(null, { status: 204 })
    return json(changed.map((row) => ({ id: row.id })))
  }
  if (table === 'job_providers' && method === 'PATCH') return new Response(null, { status: 204 })
  throw new Error('unexpected request')
}

// ── Rows ────────────────────────────────────────────────────────────────────

const jobId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

// `count` overdue imported jobs; every `tie` of them share one end time, and
// ids run against the time order so ties are settled by id.
function overdue(count: number, tie = 7, extra: Partial<Row> = {}): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id: jobId(count - i),
    expires_at: new Date(NOW - 10 * DAY + Math.floor(i / tie) * 60_000).toISOString(),
    status: 'active',
    source: 'adzuna',
    employer_email: 'noreply+adzuna-uk@accountingbody.com',
    employer_name: 'Adzuna UK',
    title: 'Management Accountant',
    company_name: 'Example Ltd',
    platform: ['ab'],
    manage_token: null,
    impression_count: 0,
    closed_at: null,
    ...extra,
  }))
}

const employerJob = (n: number, extra: Partial<Row> = {}): Row => ({
  ...overdue(1)[0],
  id: jobId(100_000 + n),
  expires_at: new Date(NOW - DAY + n * 1000).toISOString(),
  source: 'employer',
  employer_email: `hiring${n}@example.com`,
  employer_name: 'Ada Lovelace',
  manage_token: `manage-token-${n}`,
  ...extra,
})

// ── Running it ──────────────────────────────────────────────────────────────

const cron = () => new NextRequest(`${SITE}/api/cron/expire-jobs`, { headers: { authorization: `Bearer ${CRON_TEST_VALUE}` } })

async function answerOf(response: Response) {
  return { status: response.status, body: (await response.json()) as Record<string, unknown> }
}
const run = async () => answerOf(await expireJobs(cron()))

// Runs with fake timers, moving them on whenever the run is waiting, and
// answers how long the run took on the fake clock.
async function timed() {
  vi.useRealTimers()
  vi.useFakeTimers({ now: NOW, toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  const start = Date.now()
  let done = false
  let response: Response | undefined
  void expireJobs(cron()).then((value) => {
    response = value
    done = true
  })
  for (let idle = 0; !done; ) {
    await new Promise((resolve) => realSetTimeout(resolve, 1))
    if (done) break
    if (vi.getTimerCount() === 0) {
      if ((idle += 1) > 2000) throw new Error('run is not waiting on anything')
      continue
    }
    idle = 0
    if (Date.now() - start > 600_000) throw new Error('run did not answer')
    await vi.advanceTimersToNextTimerAsync()
  }
  return { ...(await answerOf(response!)), elapsed: Date.now() - start }
}

const shape = () => net.requests.map((request) => `${request.method} ${request.table}`)
const jobReads = () => net.requests.filter((request) => request.method === 'GET' && request.table === 'jobs')
const jobWrites = () => net.requests.filter((request) => request.method === 'PATCH' && request.table === 'jobs')
const param = (request: Recorded, key: string) => request.params.filter(([name]) => name === key).map(([, value]) => value)
const closedIds = () => jobWrites().flatMap((request) => request.ids)
const resets = () => net.requests.filter((request) => request.method === 'PATCH' && request.table === 'job_providers')
const logs: unknown[][] = []
const logText = () => JSON.stringify(logs)
const runReports = () => state.reports.filter((report) => report[0] === RUN_LABEL)
const emailReports = () => state.reports.filter((report) => report[0] === EMAIL_LABEL)

beforeEach(async () => {
  await Sentry.flush(2000)
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  vi.stubEnv('CRON_SECRET', CRON_TEST_VALUE)
  vi.stubEnv('JOB_EXPIRY_MAX_PER_RUN', undefined)
  vi.stubEnv('ADMIN_PATH', 'test-admin-area')
  for (const level of ['error', 'warn', 'log', 'info'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logs.push([level, ...args])
    })
  }
  logs.length = 0
  sent.length = 0
  state.reports.length = 0
  state.contexts.length = 0
  state.emails.length = 0
  state.mail.length = 0
  clearReportWindows()
  counts.clear()
  net.jobs = []
  net.requests = []
  net.trouble = undefined
  net.before = undefined
})

afterEach(() => {
  // Whatever the case: no row counts, no headers-only requests, no request
  // to any other table, never a job deleted, and no request repeated after a
  // problem.
  for (const request of net.requests) {
    expect(['jobs', 'job_providers']).toContain(request.table)
    expect(['GET', 'PATCH']).toContain(request.method)
    expect(request.prefer).not.toMatch(/count=/)
  }
  // No log line carries a job id or an address.
  const text = logText()
  for (const row of net.jobs) {
    expect(text).not.toContain(row.id)
    expect(text).not.toContain(String(row.employer_email))
  }
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ── Rules ───────────────────────────────────────────────────────────────────

describe('job expiry rules', () => {
  it('reads the owner setting for the most listings closed per run', () => {
    const cases: [string | undefined, number][] = [
      [undefined, 1_000],
      ['', 1_000],
      ['0', 1_000],
      ['-5', 1_000],
      ['abc', 1_000],
      ['1.5', 1_000],
      ['20000', 1_000],
      ['10001', 1_000],
      [' 2500', 1_000],
      ['0100', 1_000],
      ['1e3', 1_000],
      ['2500', 2_500],
      ['1', 1],
      ['10000', 10_000],
    ]
    for (const [value, expected] of cases) expect([value, jobExpiryMaxPerRun(value)]).toStrictEqual([value, expected])
    expect(JOB_EXPIRY_DEFAULT_MAX).toBe(1_000)
  })

  it('uses pages of 500, groups of 100, 40 emails and fixed time limits', () => {
    expect([EXPIRY_PAGE_SIZE, EXPIRY_GROUP_SIZE, JOB_EMAILS_PER_RUN_CAP]).toStrictEqual([500, 100, 40])
    expect([START_BUDGET_MS, WORK_END_MS, RESET_END_MS]).toStrictEqual([35_000, 45_000, 55_000])
    // The last request ends by the reset's limit, inside the route's 60 s.
    expect(RESET_END_MS).toBeLessThan(60_000)
  })

  it('splits ids into groups of at most 100 in order', () => {
    const ids = Array.from({ length: 250 }, (_, i) => i)
    expect(inGroups(ids, 100).map((group) => group.length)).toStrictEqual([100, 100, 50])
    expect(inGroups(ids, 100).flat()).toStrictEqual(ids)
    expect(inGroups([], 100)).toStrictEqual([])
  })

  it('emails only employers who posted on the site', () => {
    const employer = (employer_email: unknown) => mayEmailEmployer({ source: 'employer', employer_email } as never)
    expect(employer('hiring@example.com')).toBe(true)
    expect(employer('ada.lovelace+jobs@example.co.uk')).toBe(true)
    expect(employer('replyto@example.com')).toBe(true)
    for (const address of [
      'noreply@example.com',
      'no-reply@example.com',
      'NoReply@example.com',
      'x.noreply@example.com',
      'jobs_no-reply@example.com',
      'noreply+abc@example.com',
      'noreply+adzuna-uk@accountingbody.com',
      'noreply+jobicy@ACCOUNTINGBODY.COM',
      'not an email',
      'hiring@example',
      'hiring@@example.com',
      '@example.com',
      'hiring@example.com ',
      '',
      null,
      undefined,
      `${'a'.repeat(250)}@example.com`,
    ]) {
      expect([address, employer(address)]).toStrictEqual([address, false])
    }
    for (const source of ['adzuna', 'jobicy', 'remotive', 'careerjet', 'manual', 'scrape', '', undefined]) {
      expect([source, mayEmailEmployer({ source, employer_email: 'hiring@example.com' } as never)]).toStrictEqual([source, false])
    }
  })

  it('keeps the warning to one day per job', () => {
    // A listing ending at a fixed time is in the band on one daily run only.
    const ends = new Date(NOW + 20 * DAY + 3 * 60 * 60 * 1000).toISOString()
    let inBand = 0
    for (let day = 0; day < 30; day += 1) {
      vi.setSystemTime(NOW + day * DAY)
      if (isInWarningWindow(ends)) inBand += 1
    }
    expect(inBand).toBe(1)
    expect(isInWarningWindow(null)).toBe(false)
  })

  it('writes log codes, never messages', () => {
    expect(problemCode({ code: 'XX000', message: SEED_EMAIL })).toBe('XX000')
    expect(problemCode({ code: '', name: 'AbortError', message: SEED_EMAIL })).toBe('AbortError')
    expect(problemCode({ code: SEED_EMAIL, name: `${SEED_TITLE}!` })).toBe('Error')
    expect(problemCode(SEED_EMAIL)).toBe('Error')
    expect(problemCode(null)).toBe('Error')
  })
})

// ── Paging and closing ──────────────────────────────────────────────────────

describe('job expiry paging', () => {
  it.each([
    [0, 1_000, 0, false],
    [1, 1_000, 1, false],
    [499, 1_000, 499, false],
    [500, 1_000, 500, false],
    [501, 1_000, 501, false],
    [1_000, 1_000, 1_000, true],
    [2_600, 1_000, 1_000, true],
    [2_600, 10_000, 2_600, false],
  ])('reads past the first page of overdue jobs: %i due, limit %i', async (due, max, closed, more) => {
    vi.stubEnv('JOB_EXPIRY_MAX_PER_RUN', String(max))
    net.jobs = overdue(due)
    const expected = [...net.jobs].sort(byKey).slice(0, closed).map((row) => row.id)
    expect(await run()).toStrictEqual({ status: 200, body: { expired: closed, warned: 0, more } })
    // Each job is closed once, oldest first, with no gaps.
    expect(closedIds()).toStrictEqual(expected)
    expect(net.jobs.filter((row) => row.status === 'expired').length).toBe(closed)
    for (const read of jobReads()) expect(Number(param(read, 'limit')[0])).toBeLessThanOrEqual(500)
    expect(resets()).toHaveLength(1)
  })

  it('includes jobs with the same end time across pages', async () => {
    vi.stubEnv('JOB_EXPIRY_MAX_PER_RUN', '10000')
    // 1,200 jobs sharing three end times: every page ends inside a tie.
    net.jobs = overdue(1_200, 400)
    expect(await run()).toStrictEqual({ status: 200, body: { expired: 1_200, warned: 0, more: false } })
    expect(new Set(closedIds()).size).toBe(1_200)
    expect(closedIds()).toStrictEqual([...net.jobs].sort(byKey).map((row) => row.id))
  })

  it('pages after the last row it read, by end time and id', async () => {
    vi.stubEnv('JOB_EXPIRY_MAX_PER_RUN', '10000')
    net.jobs = overdue(600, 600)
    await run()
    const [first, second] = jobReads()
    const last = [...net.jobs].sort(byKey)[499]
    expect(param(first, 'or')).toStrictEqual([])
    expect(param(second, 'or')).toStrictEqual([
      `(expires_at.gt."${last.expires_at}",and(expires_at.eq."${last.expires_at}",id.gt."${last.id}"))`,
    ])
    expect(param(second, 'offset')).toStrictEqual([])
  })

  it('asks for the oldest active jobs past their end, with only the columns it uses', async () => {
    net.jobs = overdue(3)
    await run()
    const read = jobReads()[0]
    expect(param(read, 'select')).toStrictEqual([
      'id,expires_at,source,employer_email,employer_name,title,company_name,platform,manage_token,impression_count',
    ])
    expect(param(read, 'status')).toStrictEqual(['eq.active'])
    expect(param(read, 'expires_at')).toStrictEqual(['not.is.null', `lte.${new Date(NOW).toISOString()}`])
    expect(param(read, 'order')).toStrictEqual(['expires_at.asc,id.asc'])
    expect(param(read, 'limit')).toStrictEqual(['500'])
  })

  it('closes overdue jobs in small groups', async () => {
    vi.stubEnv('JOB_EXPIRY_MAX_PER_RUN', '10000')
    net.jobs = overdue(1_234)
    await run()
    const writes = jobWrites()
    expect(writes.map((write) => write.ids.length)).toStrictEqual([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 34])
    for (const write of writes) {
      expect(param(write, 'status')).toStrictEqual(['eq.active'])
      expect(param(write, 'select')).toStrictEqual(['id'])
      expect(write.body).toStrictEqual({ status: 'expired', closed_at: new Date(NOW).toISOString() })
    }
  })

  it('writes the same fields as closing a single job', async () => {
    net.jobs = overdue(2)
    await run()
    const group = jobWrites()[0].body
    net.requests = []
    net.jobs = overdue(1)
    await expireJob(net.jobs[0].id)
    expect(jobWrites()[0].body).toStrictEqual(group)
    expect(JSON.stringify(jobWrites()[0].body)).toBe(JSON.stringify(group))
  })

  it('leaves jobs closed already as they are and counts only the ones it closed', async () => {
    net.jobs = overdue(5)
    // Another close lands between the read and the update.
    net.before = (request) => {
      if (request.method === 'PATCH' && request.table === 'jobs') Object.assign(net.jobs[0], { status: 'closed', closed_at: 'earlier' })
    }
    expect(await run()).toStrictEqual({ status: 200, body: { expired: 4, warned: 0, more: false } })
    expect(net.jobs[0]).toMatchObject({ status: 'closed', closed_at: 'earlier' })
    // A second run finds nothing to do.
    net.before = undefined
    net.requests = []
    expect(await run()).toStrictEqual({ status: 200, body: { expired: 0, warned: 0, more: false } })
    expect(jobWrites()).toStrictEqual([])
  })

  it('uses the scheduled-work time limit for every database request', async () => {
    net.jobs = [...overdue(3), employerJob(1)]
    await run()
    expect(new Set(state.contexts)).toStrictEqual(new Set(['cron']))
  })

  it('never deletes a job and changes only its status and closing time', async () => {
    net.jobs = overdue(3)
    const before = JSON.parse(JSON.stringify(net.jobs)) as Row[]
    await run()
    expect(net.jobs).toHaveLength(3)
    net.jobs.forEach((row, i) => expect(row).toStrictEqual({ ...before[i], status: 'expired', closed_at: new Date(NOW).toISOString() }))
  })
})

// ── Limits ──────────────────────────────────────────────────────────────────

describe('job expiry limits', () => {
  it('closes at most 1,000 jobs per run by default', async () => {
    net.jobs = overdue(2_600)
    expect((await run()).body).toStrictEqual({ expired: 1_000, warned: 0, more: true })
    expect(jobReads().filter((read) => param(read, 'impression_count').length === 0)).toHaveLength(2)
  })

  it('closes up to the owner setting when it is a whole number up to 10,000', async () => {
    net.jobs = overdue(2_600)
    vi.stubEnv('JOB_EXPIRY_MAX_PER_RUN', '2500')
    expect((await run()).body).toStrictEqual({ expired: 2_500, warned: 0, more: true })
    net.jobs = overdue(2_600)
    vi.stubEnv('JOB_EXPIRY_MAX_PER_RUN', '20000')
    expect((await run()).body).toStrictEqual({ expired: 1_000, warned: 0, more: true })
  })

  it('reads only as many rows as the limit leaves', async () => {
    net.jobs = overdue(2_600)
    vi.stubEnv('JOB_EXPIRY_MAX_PER_RUN', '650')
    expect((await run()).body).toStrictEqual({ expired: 650, warned: 0, more: true })
    const expiryReads = jobReads().filter((read) => param(read, 'impression_count').length === 0)
    expect(expiryReads.map((read) => param(read, 'limit')[0])).toStrictEqual(['500', '150'])
  })

  it('stops starting new work when its time is up and still resets the counters', async () => {
    net.jobs = overdue(450)
    // Each job request takes 12 s on the run's clock.
    net.before = (request) => {
      if (request.table === 'jobs') vi.setSystemTime(Date.now() + 12_000)
    }
    expect(await run()).toStrictEqual({ status: 200, body: { expired: 200, warned: 0, more: true } })
    // Read at 0 s, groups at 12 s and 24 s; at 36 s nothing new starts.
    expect(shape()).toStrictEqual(['GET jobs', 'PATCH jobs', 'PATCH jobs', 'PATCH job_providers'])
  })

  it('counts its time from the start of the run', async () => {
    net.jobs = overdue(450)
    net.before = (request) => {
      if (request.table === 'jobs') vi.setSystemTime(Date.now() + 8_000)
    }
    // 0, 8, 16, 24, 32 s start; 40 s does not.
    expect((await run()).body).toStrictEqual({ expired: 400, warned: 0, more: true })
    expect(shape().filter((entry) => entry === 'PATCH jobs')).toHaveLength(4)
  })

  it('ends inside its route limit when the database does not answer', async () => {
    net.trouble = () => 'hang'
    const result = await timed()
    expect(result).toStrictEqual({ status: 500, body: { error: 'Cron run failed', expired: 0, warned: 0 }, elapsed: 55_000 })
    expect(shape()).toStrictEqual(['GET jobs', 'GET jobs', 'PATCH job_providers'])
    expect(runReports()).toHaveLength(1)
  })

  it('ends inside its route limit when an update does not answer', async () => {
    net.jobs = overdue(300)
    net.trouble = (request) => (request.method === 'PATCH' ? 'hang' : undefined)
    const result = await timed()
    // The update ends at 25 s, the warning read answers, the reset ends at
    // its own 25 s limit (50 s), before the 55 s end.
    expect(result).toStrictEqual({ status: 500, body: { error: 'Cron run failed', expired: 0, warned: 0 }, elapsed: 50_000 })
    expect(shape()).toStrictEqual(['GET jobs', 'PATCH jobs', 'GET jobs', 'PATCH job_providers'])
  })

  it('ends a late update at the run limit rather than its own', async () => {
    net.jobs = overdue(450)
    // Each job request takes 11 s; the group started at 33 s gets no answer.
    net.before = (request) => {
      if (request.table === 'jobs' && Date.now() - NOW < 33_000) vi.setSystemTime(Date.now() + 11_000)
    }
    net.trouble = (request, nth) => (request.method === 'PATCH' && request.table === 'jobs' && nth === 3 ? 'hang' : undefined)
    const result = await timed()
    expect(result).toStrictEqual({ status: 500, body: { error: 'Cron run failed', expired: 200, warned: 0 }, elapsed: WORK_END_MS })
    expect(shape()).toStrictEqual(['GET jobs', 'PATCH jobs', 'PATCH jobs', 'PATCH jobs', 'PATCH job_providers'])
  })

  it('stops waiting for an email at the run limit', async () => {
    net.jobs = [employerJob(1), employerJob(2)]
    state.mail = ['hang']
    const result = await timed()
    expect(result).toStrictEqual({ status: 200, body: { expired: 2, warned: 0, more: false }, elapsed: WORK_END_MS })
    // The second email is not started once the start budget is used.
    expect(state.emails).toHaveLength(1)
    expect(emailReports()).toHaveLength(1)
  })
})

// ── Emails ──────────────────────────────────────────────────────────────────

describe('job expiry emails', () => {
  it('emails employers who posted on the site when their listing closes', async () => {
    net.jobs = [employerJob(1)]
    expect((await run()).body).toStrictEqual({ expired: 1, warned: 0, more: false })
    expect(state.emails).toHaveLength(1)
    expect(state.emails[0].to).toBe('hiring1@example.com')
    expect(state.emails[0].subject).toBe('Your job listing has expired — Accounting Body')
  })

  it('sends no email for imported jobs but still closes them', async () => {
    net.jobs = [
      ...overdue(3),
      employerJob(1, { source: 'jobicy', employer_email: 'hiring@example.com' }),
      employerJob(2, { employer_email: 'noreply+remotive@accountingbody.com' }),
    ]
    expect((await run()).body).toStrictEqual({ expired: 5, warned: 0, more: false })
    expect(state.emails).toStrictEqual([])
  })

  it('sends no email to no-reply or malformed addresses but still closes them', async () => {
    net.jobs = ['noreply@example.com', 'no-reply@example.com', 'x.noreply@example.com', 'noreply+abc@example.com', 'not-an-address'].map(
      (address, i) => employerJob(i + 1, { employer_email: address }),
    )
    expect((await run()).body).toStrictEqual({ expired: 5, warned: 0, more: false })
    expect(state.emails).toStrictEqual([])
  })

  it('keeps within its daily email limit', async () => {
    net.jobs = Array.from({ length: 45 }, (_, i) => employerJob(i + 1))
    expect((await run()).body).toStrictEqual({ expired: 45, warned: 0, more: false })
    expect(state.emails).toHaveLength(40)
    expect(net.jobs.every((row) => row.status === 'expired')).toBe(true)
    expect(logs.filter((line) => line[1] === 'cron/expire-jobs: email cap reached')).toStrictEqual([['warn', 'cron/expire-jobs: email cap reached', 40]])
  })

  it('counts a refused send toward the limit, carries on and never sends it again', async () => {
    net.jobs = [employerJob(1), employerJob(2), employerJob(3)]
    state.mail = ['refused', 'throw']
    expect(await run()).toStrictEqual({ status: 200, body: { expired: 3, warned: 0, more: false } })
    expect(state.emails.map((email) => email.to)).toStrictEqual(['hiring1@example.com', 'hiring2@example.com', 'hiring3@example.com'])
    expect(emailReports()).toHaveLength(2)
    expect(emailReports().map((report) => report[1])).toStrictEqual([
      { name: 'rate_limit_exceeded', code: '429', message: 'send failed' },
      { name: 'TypeError', code: undefined, message: 'send failed' },
    ])
    expect(logs.filter((line) => String(line[1]).startsWith('email: send failed'))).toStrictEqual([
      ['error', 'email: send failed (job expiry email) rate_limit_exceeded 429'],
      ['error', 'email: send failed (job expiry email) TypeError'],
    ])
  })

  it('sends one email problem report per run', async () => {
    net.jobs = Array.from({ length: 6 }, (_, i) => employerJob(i + 1))
    state.mail = ['refused', 'refused', 'throw', 'refused', 'refused', 'refused']
    expect((await run()).status).toBe(200)
    await Sentry.flush(2000)
    const events = sent.filter((body) => body.includes('"type":"event"'))
    expect(events).toHaveLength(1)
    expect(events[0]).toContain(EMAIL_LABEL)
  })

  describe('expiry warnings', () => {
    const dueSoon = (n: number, extra: Partial<Row> = {}) =>
      employerJob(n, { expires_at: new Date(NOW + 6.5 * DAY).toISOString(), impression_count: 3, ...extra })

    it('warns an employer once, 6 to 7 days before the end, with the manage link', async () => {
      net.jobs = [dueSoon(1)]
      expect((await run()).body).toStrictEqual({ expired: 0, warned: 1, more: false })
      expect(state.emails).toHaveLength(1)
      expect(state.emails[0].subject).toBe('Your job listing expires in 7 days — Accounting Body')
      expect(String(state.emails[0].html)).toContain('manage-token-1')
      // The next day's run sends nothing more.
      vi.setSystemTime(NOW + DAY)
      expect((await run()).body).toStrictEqual({ expired: 0, warned: 0, more: false })
      expect(state.emails).toHaveLength(1)
    })

    it('reads only the warning band, after the jobs past their end', async () => {
      net.jobs = [dueSoon(1)]
      await run()
      const read = jobReads()[1]
      expect(param(read, 'expires_at')).toStrictEqual([
        'not.is.null',
        `lte.${new Date(NOW + 7 * DAY).toISOString()}`,
        `gt.${new Date(NOW + 6 * DAY).toISOString()}`,
      ])
      expect(param(read, 'impression_count')).toStrictEqual(['gt.0'])
      expect(param(read, 'order')).toStrictEqual(['expires_at.asc,id.asc'])
      expect(param(read, 'limit')).toStrictEqual(['500'])
    })

    it('warns no imported job, no listing without impressions and none outside the band', async () => {
      net.jobs = [
        dueSoon(1, { source: 'adzuna', employer_email: 'noreply+adzuna@accountingbody.com' }),
        dueSoon(2, { impression_count: 0 }),
        dueSoon(3, { expires_at: new Date(NOW + 5.5 * DAY).toISOString() }),
        dueSoon(4, { expires_at: new Date(NOW + 7.5 * DAY).toISOString() }),
      ]
      expect((await run()).body).toStrictEqual({ expired: 0, warned: 0, more: false })
      expect(state.emails).toStrictEqual([])
    })

    it('counts only warnings the provider accepted', async () => {
      net.jobs = [dueSoon(1), dueSoon(2)]
      state.mail = ['refused']
      expect((await run()).body).toStrictEqual({ expired: 0, warned: 1, more: false })
    })

    it('shares the 40-email limit with the expiry notices', async () => {
      net.jobs = [...Array.from({ length: 40 }, (_, i) => employerJob(i + 1)), dueSoon(99)]
      expect((await run()).body).toStrictEqual({ expired: 40, warned: 0, more: false })
      expect(state.emails).toHaveLength(40)
    })
  })
})

// ── Problems ────────────────────────────────────────────────────────────────

describe('job expiry problems', () => {
  const FAILED = (expired: number, warned = 0) => ({ status: 500, body: { error: 'Cron run failed', expired, warned } })

  it('answers a failed run after the rest of the run when the first read fails', async () => {
    net.jobs = [...overdue(3)]
    net.trouble = (request, nth) => (request.method === 'GET' && nth === 1 ? 'fail' : undefined)
    expect(await run()).toStrictEqual(FAILED(0))
    expect(shape()).toStrictEqual(['GET jobs', 'GET jobs', 'PATCH job_providers'])
    expect(runReports()).toHaveLength(1)
    expect(runReports()[0][2]).toStrictEqual({ area: 'cron' })
    expect(state.reports).toHaveLength(1)
    // The database's own text is not passed on, only its short code.
    const reported = runReports()[0][1] as Error & { code?: string }
    expect(reported).toBeInstanceOf(Error)
    expect([reported.message, reported.code]).toStrictEqual(['job expiry database request failed', 'XX000'])
  })

  it('keeps what it closed when a later page cannot be read', async () => {
    net.jobs = overdue(700)
    net.trouble = (request, nth) => (request.method === 'GET' && nth === 2 ? 'fail' : undefined)
    expect(await run()).toStrictEqual(FAILED(500))
    expect(shape()).toStrictEqual(['GET jobs', ...Array(5).fill('PATCH jobs'), 'GET jobs', 'GET jobs', 'PATCH job_providers'])
    expect(state.reports).toHaveLength(1)
  })

  it('stops closing at once when an update fails, without trying it again', async () => {
    net.jobs = overdue(450)
    net.trouble = (request, nth) => (request.method === 'PATCH' && request.table === 'jobs' && nth === 3 ? 'fail' : undefined)
    expect(await run()).toStrictEqual(FAILED(200))
    expect(shape()).toStrictEqual(['GET jobs', 'PATCH jobs', 'PATCH jobs', 'PATCH jobs', 'GET jobs', 'PATCH job_providers'])
    expect(net.jobs.filter((row) => row.status === 'expired')).toHaveLength(200)
    expect(state.reports).toHaveLength(1)
    expect(logs.filter((line) => line[1] === 'cron/expire-jobs: failed to expire jobs')).toStrictEqual([
      ['error', 'cron/expire-jobs: failed to expire jobs', 'XX000', 200],
    ])
  })

  it('stops closing at once when the network fails during an update', async () => {
    net.jobs = overdue(250)
    net.trouble = (request, nth) => (request.method === 'PATCH' && request.table === 'jobs' && nth === 2 ? 'throw' : undefined)
    expect(await run()).toStrictEqual(FAILED(100))
    expect(jobWrites()).toHaveLength(2)
    expect(state.reports).toHaveLength(1)
  })

  it('still sends the warnings and resets the counters after an update fails', async () => {
    net.jobs = [employerJob(1), employerJob(2, { expires_at: new Date(NOW + 6.5 * DAY).toISOString(), impression_count: 2 })]
    net.trouble = (request) => (request.method === 'PATCH' && request.table === 'jobs' ? 'fail' : undefined)
    expect(await run()).toStrictEqual(FAILED(0, 1))
    expect(resets()).toHaveLength(1)
  })

  it('keeps a failed counter reset to a log line', async () => {
    net.trouble = (request) => (request.table === 'job_providers' ? 'fail' : undefined)
    expect(await run()).toStrictEqual({ status: 200, body: { expired: 0, warned: 0, more: false } })
    expect(logs.filter((line) => String(line[1]).includes('jobs_today'))).toStrictEqual([
      ['error', 'cron/expire-jobs: failed to reset jobs_today counters:', 'XX000'],
    ])
    expect(state.reports).toStrictEqual([])
  })

  it('keeps addresses, ids, titles and database text out of logs and reports', async () => {
    net.jobs = [...overdue(250, 7, { title: SEED_TITLE, employer_email: `noreply+${SEED_EMAIL}` }), employerJob(1, { employer_email: SEED_EMAIL, title: SEED_TITLE })]
    net.trouble = (request, nth) => (request.method === 'PATCH' && request.table === 'jobs' && nth === 3 ? 'fail' : request.table === 'job_providers' ? 'throw' : undefined)
    // One job is closed elsewhere between the read and the update.
    net.before = (request) => {
      if (request.method === 'PATCH' && request.table === 'jobs') Object.assign(net.jobs[0], { status: 'closed' })
    }
    state.mail = ['refused']
    await run()
    const ids = net.jobs.map((row) => row.id)
    for (const seed of [SEED_EMAIL, SEED_TITLE, SEED_ID, 'seed-detail', 'could not update', ...ids]) {
      expect(logText()).not.toContain(seed)
    }
    for (const line of logs) for (const arg of line) expect(['string', 'number']).toContain(typeof arg)
    for (const report of state.reports) {
      expect(typeof report[0]).toBe('string')
      if (report[2] !== undefined) expect(report[2]).toStrictEqual({ area: 'cron' })
    }
  })

  it('sends a failed run report with only its label, area and code (real SDK)', async () => {
    net.jobs = overdue(3, 7, { title: SEED_TITLE })
    net.trouble = (request) => (request.method === 'PATCH' && request.table === 'jobs' ? 'fail' : undefined)
    state.mail = ['refused']
    net.jobs.push(employerJob(1, { employer_email: SEED_EMAIL, title: SEED_TITLE, expires_at: new Date(NOW + 6.5 * DAY).toISOString(), impression_count: 1 }))
    await run()
    await Sentry.flush(2000)
    const events = sent.filter((body) => body.includes('"type":"event"'))
    expect(events).toHaveLength(2)
    const text = events.join('\n')
    expect(text).toContain(RUN_LABEL)
    expect(text).toContain(EMAIL_LABEL)
    expect(text).toContain('"area":"cron"')
    for (const seed of [SEED_EMAIL, SEED_TITLE, SEED_ID, 'seed-detail', 'example.com', ...net.jobs.map((row) => row.id)]) {
      expect(text).not.toContain(seed)
    }
  })
})

// ── Setup ───────────────────────────────────────────────────────────────────

describe('job expiry setup', () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

  it('lists its owner setting in the example settings', () => {
    expect(read('.env.example')).toMatch(/^JOB_EXPIRY_MAX_PER_RUN=$/m)
  })

  it('keeps its daily schedule and route limit', () => {
    expect(read('vercel.json')).toContain('{ "path": "/api/cron/expire-jobs", "schedule": "0 6 * * *" }')
    expect(read('app/api/cron/expire-jobs/route.ts')).toContain('export const maxDuration = 60')
  })

  it('sends every job expiry email through the send check with one fixed label', () => {
    const source = read('lib/job-expiry.ts')
    expect(source.match(/checkEmailSend\(/g)).toHaveLength(1)
    expect(source).toContain("checkEmailSend(result, 'job expiry email')")
    expect(read('app/api/cron/expire-jobs/route.ts')).not.toMatch(/console\.\w+\([^)]*job\.id/)
  })
})
