import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_SESSION_COOKIE, getAdminPath } from './middleware-logic'
import { SERVER_PROBLEM_TEXT } from './message-rules'
import { TEST_ADMIN_SECRET, TEST_SESSION_SECRET, signTestSession } from './admin-session-fixtures'

// Admin job updates log a short code; firm emails are confirmed before
// success; admin answers use fixed texts; the hiring brief and article read
// keep a short code only. Real supabase-js clients come from the factory and
// only the network is fake.

const state = vi.hoisted(() => ({
  reports: [] as unknown[][],
  sentry: [] as unknown[][],
  logs: [] as unknown[][],
  emails: [] as unknown[],
  emailMode: 'sent' as 'sent' | 'refused' | 'throws',
  jobFails: null as unknown,
  jobEmailFails: null as unknown,
}))

vi.mock('@/lib/report-error', () => ({
  reportServerError: (...args: unknown[]) => {
    state.reports.push(args)
  },
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => state.sentry.push(args),
  captureMessage: (...args: unknown[]) => state.sentry.push(args),
}))

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (message: unknown) => {
        state.emails.push(message)
        if (state.emailMode === 'throws') throw Object.assign(new Error('seed send detail seed-person@example.com'), { code: 'E_TEST1' })
        if (state.emailMode === 'refused') return { data: null, error: { name: 'validation_error', statusCode: 422, message: 'seed provider detail' }, headers: {} }
        return { data: { id: 'email' }, error: null, headers: {} }
      },
    }
  },
}))

const JOB = { id: 'job-1', title: 'Seed Title', status: 'pending', is_featured: false, manage_token: 'seed-token', contact_email: 'seed-person@example.com' }

vi.mock('@/lib/jobs', () => ({
  getJobById: async (id: string) => (id === JOB.id ? { ...JOB } : null),
  approveJob: async () => {
    if (state.jobFails) throw state.jobFails
    return { ...JOB, status: 'active' }
  },
  rejectJob: async () => {
    if (state.jobFails) throw state.jobFails
    return { ...JOB, status: 'rejected' }
  },
  expireJob: async () => undefined,
}))

vi.mock('@/lib/jobEmails', () => ({
  sendJobApprovalEmail: async () => {
    if (state.jobEmailFails) throw state.jobEmailFails
  },
  sendJobRejectionEmail: async () => {
    if (state.jobEmailFails) throw state.jobEmailFails
  },
}))

// Run now starts the import in the same process; this stands in for it.
vi.mock('@/lib/ingestion/run-provider-import', () => ({
  runProviderImport: async (slug: string, trigger: string) => {
    net.dispatches.push(`run ${slug} ${trigger}`)
    if (net.ingestFails) throw net.ingestFails
    return { status: 200, body: { ok: true, inserted: 2 } }
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

import { POST as employerBrief } from '@/app/api/recruitment/employer-brief/route'
import { getArticleBySlug } from '@/lib/db'

// The folder comes from the app's own default, so its name is not repeated here.
vi.stubEnv('ADMIN_PATH', undefined)
const folder = getAdminPath()
vi.unstubAllEnvs()

type Handler = (req: NextRequest, context?: unknown) => Promise<Response>
const adminFile = (suffix: string) => join(process.cwd(), 'app', 'api', `${folder}${suffix}`, 'route.ts')
const loadAdmin = (suffix: string): Promise<Record<string, Handler>> => import(/* @vite-ignore */ adminFile(suffix))

const DB_URL = 'https://example.supabase.co'
const SITE = 'https://accountingbody.com'
const CRON_TEST_VALUE = 'cron-test-value'
const JSON_HEADERS = { 'content-type': 'application/json' }
const SEED = /seed|example\.com/i

type Row = Record<string, unknown>
const net = {
  tables: {} as Record<string, Row[]>,
  failing: false,
  dispatches: [] as string[],
  ingestFails: null as unknown,
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

const DB_PROBLEM = { message: 'seed database detail seed-person@example.com', code: 'XX000', details: 'seed', hint: null }

const fakeFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.origin === SITE && url.pathname.startsWith('/api/ingest/')) {
    net.dispatches.push(`${init?.method} ${url.pathname}${url.search} ${new Headers(init?.headers).get('authorization')}`)
    if (net.ingestFails) throw net.ingestFails
    return json({ ok: true, inserted: 2 })
  }
  if (url.origin !== DB_URL) throw new Error('unexpected request')
  if (net.failing) return json(DB_PROBLEM, 500)
  const table = url.pathname.replace('/rest/v1/', '')
  const method = (init?.method ?? 'GET').toUpperCase()
  const single = (new Headers(init?.headers).get('accept') ?? '').includes('vnd.pgrst.object')
  const rows = net.tables[table] ?? []
  const id = url.searchParams.get('id')?.replace(/^eq\./, '')
  const found = id === undefined ? rows : rows.filter((row) => row.id === id)
  if (method === 'PATCH') return new Response(null, { status: 204 })
  if (single) return found.length === 1 ? json(found[0]) : json({ message: 'no single row', code: 'PGRST116', details: null, hint: null }, 406)
  return json(found)
}

function request(path: string, init: { method?: string; body?: unknown } = {}) {
  const text = init.body === undefined ? undefined : JSON.stringify(init.body)
  return new NextRequest(SITE + path, {
    method: init.method ?? 'GET',
    body: text,
    headers: text ? { 'content-type': 'application/json' } : {},
  })
}

let session = ''
function admin(path: string, init: { method?: string; body?: unknown } = {}) {
  const req = request(path, init)
  req.cookies.set(ADMIN_SESSION_COOKIE, session)
  return req
}

function unreadable(req: NextRequest, problem: unknown) {
  Object.defineProperty(req, 'json', { value: async () => { throw problem } })
  return req
}

async function answerOf(response: Response) {
  const text = await response.text()
  return { status: response.status, headers: { 'content-type': response.headers.get('content-type') ?? '' }, body: text ? JSON.parse(text) : text }
}

// Every log argument is a short string and none holds the admin folder or a seeded value.
function expectPlainLogs() {
  for (const line of state.logs) for (const part of line) expect(typeof part).toBe('string')
  const text = JSON.stringify(state.logs).toLowerCase()
  expect(text).not.toContain(folder.toLowerCase())
  expect(text).not.toMatch(SEED)
}

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  vi.stubEnv('CRON_SECRET', CRON_TEST_VALUE)
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE)
  vi.stubEnv('ADMIN_SECRET', TEST_ADMIN_SECRET)
  vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SESSION_SECRET)
  for (const level of ['error', 'warn', 'log', 'info'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      state.logs.push(args)
    })
  }
  state.reports.length = 0
  state.sentry.length = 0
  state.logs.length = 0
  state.emails.length = 0
  state.emailMode = 'sent'
  state.jobFails = null
  state.jobEmailFails = null
  net.tables = {}
  net.failing = false
  net.dispatches = []
  net.ingestFails = null
  session = await signTestSession()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ── Admin job updates ───────────────────────────────────────────────────────

describe('admin job updates log a short code', () => {
  const patch = async (body: unknown) => {
    const { PATCH } = await loadAdmin('/jobs/[id]')
    return answerOf(await PATCH(admin('/api/admin-tool', { method: 'PATCH', body }), { params: Promise.resolve({ id: JOB.id }) }))
  }

  it('an approval email problem logs a fixed line and its code, and the approval stands', async () => {
    state.jobEmailFails = Object.assign(new Error('seed detail seed-person@example.com'), { code: 'E_TEST1' })
    const result = await patch({ action: 'approve' })
    expect(result.status).toBe(200)
    expect(result.body.job.status).toBe('active')
    expect(state.logs).toStrictEqual([['admin job approval email failed (non-fatal)', 'E_TEST1']])
    expect(state.reports).toStrictEqual([])
    expectPlainLogs()
  })

  it('a rejection email problem logs a fixed line and no-code when there is none', async () => {
    state.jobEmailFails = new Error('seed detail seed-person@example.com')
    const result = await patch({ action: 'reject', reason: 'Seed reason' })
    expect(result.status).toBe(200)
    expect(state.logs).toStrictEqual([['admin job rejection email failed (non-fatal)', 'no-code']])
    expectPlainLogs()
  })

  it('an update problem logs a fixed line and its code and reports once', async () => {
    const problem = Object.assign(new Error('update problem'), { code: 'XX000' })
    state.jobFails = problem
    const result = await patch({ action: 'approve' })
    expect(result).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: { error: 'Job update failed' } })
    expect(state.logs).toStrictEqual([['admin job update failed', 'XX000']])
    expect(state.reports).toStrictEqual([['admin job update failed', problem, { area: 'admin' }]])
    expectPlainLogs()
  })

  it('a code that does not look like a code is not logged', async () => {
    state.jobFails = { code: { nested: 'seed-person@example.com' } }
    await patch({ action: 'approve' })
    state.jobEmailFails = { code: 'seed person@example.com' }
    state.jobFails = null
    await patch({ action: 'approve' })
    expect(state.logs).toStrictEqual([['admin job update failed', 'no-code'], ['admin job approval email failed (non-fatal)', 'no-code']])
    expectPlainLogs()
  })

  it('the route source names no admin folder in its log lines', () => {
    const source = readFileSync(adminFile('/jobs/[id]'), 'utf8')
    const lines = source.split('\n').filter((line) => line.includes('console.'))
    expect(lines).toHaveLength(4)
    for (const line of lines) expect(line.toLowerCase()).not.toContain(folder.toLowerCase())
  })
})

// ── Firm emails ─────────────────────────────────────────────────────────────

describe('firm emails are confirmed before success', () => {
  const notify = async (status: string, id = 'firm-1') => {
    const { POST } = await loadAdmin('/notify-firm')
    return answerOf(await POST(admin('/api/admin-tool', { method: 'POST', body: { id, status } })))
  }
  const seedFirm = () => {
    net.tables.firms_applications = [{ id: 'firm-1', contact_name: 'Seed Person', contact_email: 'seed-person@example.com', firm_name: 'Seed Firm', platform: 'ab' }]
  }

  it.each(['approved', 'rejected'])('a sent %s email answers success', async (status) => {
    seedFirm()
    expect(await notify(status)).toStrictEqual({ status: 200, headers: JSON_HEADERS, body: { success: true } })
    expect(state.emails).toHaveLength(1)
    expect(state.logs).toStrictEqual([])
    expect(state.reports).toStrictEqual([])
  })

  it.each([
    ['approved', 'admin firm approval'],
    ['rejected', 'admin firm decision'],
  ])('a refused %s email answers a fixed failure and reports once', async (status, label) => {
    seedFirm()
    state.emailMode = 'refused'
    expect(await notify(status)).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: { error: 'Failed to send email' } })
    expect(state.emails).toHaveLength(1)
    expect(state.logs).toStrictEqual([[`email: send failed (${label}) validation_error 422`]])
    expect(state.reports).toHaveLength(1)
    expect(state.reports[0][0]).toBe(`email: ${label}`)
    expect(JSON.stringify(state.reports)).not.toMatch(SEED)
  })

  it('a send that throws answers the same fixed failure', async () => {
    seedFirm()
    state.emailMode = 'throws'
    const result = await notify('approved')
    expect(result).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: { error: 'Failed to send email' } })
    expect(state.reports.map((report) => report[0])).toStrictEqual(['admin firm email failed'])
    expect(JSON.stringify(result)).not.toMatch(SEED)
  })

  it('other answers are unchanged', async () => {
    expect(await notify('pending')).toStrictEqual({ status: 200, headers: JSON_HEADERS, body: { success: true, skipped: true } })
    expect(await notify('approved', 'firm-missing')).toStrictEqual({ status: 404, headers: JSON_HEADERS, body: { error: 'Application not found' } })
    const { POST } = await loadAdmin('/notify-firm')
    expect(await answerOf(await POST(admin('/api/admin-tool', { method: 'POST', body: {} })))).toStrictEqual({
      status: 400,
      headers: JSON_HEADERS,
      body: { error: 'id and status are required' },
    })
    expect(state.emails).toStrictEqual([])
  })

  it('a signed-out request is refused first and nothing is sent', async () => {
    const { POST } = await loadAdmin('/notify-firm')
    const result = await answerOf(await POST(request('/api/admin-tool', { method: 'POST', body: { id: 'firm-1', status: 'approved' } })))
    expect(result.status).toBe(401)
    expect(state.emails).toStrictEqual([])
    expect(state.reports).toStrictEqual([])
  })
})

// ── Candidate token save ────────────────────────────────────────────────────

describe('candidate emails', () => {
  it('a token save problem answers its fixed text and logs the code only', async () => {
    net.failing = true
    const { POST } = await loadAdmin('/notify-candidate')
    const result = await answerOf(
      await POST(admin('/api/admin-tool', { method: 'POST', body: { id: 'row-1', status: 'active', email: 'seed-person@example.com', name: 'Seed Person', platform: 'ab' } })),
    )
    expect(result).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: { error: 'Failed to save candidate token — email not sent' } })
    expect(state.logs).toStrictEqual([['notify-candidate: token update failed:', 'XX000']])
    expect(state.emails).toStrictEqual([])
    expectPlainLogs()
  })
})

// ── Run now ─────────────────────────────────────────────────────────────────

describe('the admin run-now answer', () => {
  const run = async () => {
    const { POST } = await loadAdmin('/providers/[slug]/trigger')
    return answerOf(await POST(admin('/api/admin-tool', { method: 'POST' }), { params: Promise.resolve({ slug: 'example' }) }))
  }

  it('starts the import directly and passes its answer on', async () => {
    expect(await run()).toStrictEqual({ status: 200, headers: JSON_HEADERS, body: { ok: true, inserted: 2 } })
    expect(net.dispatches).toStrictEqual(['run example manual'])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('answers a fixed text when it is not set up', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const result = await run()
    expect(result).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: { ok: false, error: 'Not configured' } })
    expect(JSON.stringify(result)).not.toMatch(/CRON|SECRET/)
    expect(net.dispatches).toStrictEqual([])
  })

  it('answers a fixed text when the start fails, logs the code only and reports once', async () => {
    const problem = Object.assign(new Error('seed detail seed-person@example.com'), { code: 'E_TEST1' })
    net.ingestFails = problem
    const result = await run()
    expect(result).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: { ok: false, error: 'Run failed' } })
    expect(state.logs).toStrictEqual([['admin provider run start failed', 'E_TEST1']])
    expect(state.reports).toStrictEqual([['admin provider run start failed', problem, { area: 'admin' }]])
    expectPlainLogs()
  })
})

// ── Hiring brief ────────────────────────────────────────────────────────────

describe('hiring brief problems', () => {
  it('logs the short name and code only and keeps the plain answer', async () => {
    const problem = Object.assign(new TypeError('seed detail seed-person@example.com'), { code: 'E_TEST1' })
    const result = await answerOf(await employerBrief(unreadable(request('/api/recruitment/employer-brief', { method: 'POST', body: {} }), problem)))
    await employerBrief(unreadable(request('/api/recruitment/employer-brief', { method: 'POST', body: {} }), { name: 'seed person@example.com' }))
    expect(result).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: { error: SERVER_PROBLEM_TEXT } })
    expect(state.logs).toStrictEqual([['employer-brief error:', 'TypeError', 'E_TEST1'], ['employer-brief error:', '-', '-']])
    expect(state.reports.map((report) => report[0])).toStrictEqual(['hiring brief submit failed', 'hiring brief submit failed'])
    expectPlainLogs()
  })
})

// ── Article read ────────────────────────────────────────────────────────────

describe('article read problems', () => {
  it('throw a fixed message with the status and short code only', async () => {
    net.failing = true
    const thrown = await getArticleBySlug('seed-slug-x7q2').catch((error: unknown) => error)
    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).message).toBe('getArticleBySlug: articles query failed (status 500)')
    expect((thrown as Error & { code?: string }).code).toBe('XX000')
    expect(state.logs).toHaveLength(1)
    expect(state.logs[0][0]).toBe('getArticleBySlug error:')
    expect(String(state.logs[0][1])).not.toMatch(SEED)
  })
})

// ── Static checks ───────────────────────────────────────────────────────────

describe('admin answers use fixed texts', () => {
  it.each(['/notify-firm', '/notify-candidate', '/providers/[slug]/trigger'])('%s answers no raw problem text', (suffix) => {
    const source = readFileSync(adminFile(suffix), 'utf8')
    expect(source).not.toMatch(/\.message\b/)
    expect(source).not.toMatch(/\bdetail\s*:/)
  })

  it('the run-now answer names no setting', () => {
    const source = readFileSync(adminFile('/providers/[slug]/trigger'), 'utf8')
    expect(source.match(/CRON_SECRET/g)).toStrictEqual(['CRON_SECRET'])
    expect(source).toContain("runProviderImport(slug, 'manual')")
  })

  it('each admin handler still checks the session first', () => {
    for (const suffix of ['/jobs/[id]', '/notify-firm', '/notify-candidate', '/providers/[slug]/trigger']) {
      const source = readFileSync(adminFile(suffix), 'utf8')
      const handlers = source.split(/export async function (?:GET|POST|PATCH|DELETE)\(/).slice(1)
      expect(handlers.length).toBeGreaterThan(0)
      for (const handler of handlers) {
        const body = handler.slice(handler.indexOf('{', handler.indexOf(')')) + 1).trim()
        expect(body.startsWith('if (!(await isAuthenticated(req))) {')).toBe(true)
      }
    }
  })
})
