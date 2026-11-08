import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAdminPath } from './middleware-logic'
import { LINK_RETRY_HEADING, MANAGE_LINK_RETRY_TEXT, manageLinkStatus } from './message-rules'

// When a database read cannot be done, the provider import, the listing
// manage link, the daily expiry run and the admin category list answer a
// temporary problem and report it once; a row that does not exist and an
// empty result keep their usual answers. Real supabase-js clients come from
// the factory and only the network is fake; the reporting helper is replaced
// by a recorder.

const state = vi.hoisted(() => ({
  reports: [] as unknown[][],
  order: [] as string[],
  emails: [] as unknown[],
  due: [] as unknown[],
}))

vi.mock('@/lib/report-error', () => ({
  reportServerError: (...args: unknown[]) => {
    state.reports.push(args)
    state.order.push(`report ${String(args[0])}`)
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: () => {}, captureMessage: () => {} }))
vi.mock('@/lib/admin-auth', () => ({
  isAuthenticated: async () => true,
  signedOutResponse: () => new Response('signed out', { status: 401 }),
}))
vi.mock('@/lib/providers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/providers')>()),
  reapStaleRuns: async () => 0,
  getProvidersDueForFetch: async () => state.due,
}))
vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (message: unknown) => {
        state.emails.push(message)
        return { data: { id: 'email' }, error: null }
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
import { POST as ingest } from '@/app/api/ingest/[slug]/route'
import { GET as orchestrator } from '@/app/api/ingest/orchestrator/route'
import { GET as manageGet, POST as managePost } from '@/app/api/jobs/manage/route'

// The folder comes from the app's own default, so its name is not repeated here.
vi.stubEnv('ADMIN_PATH', undefined)
const folder = getAdminPath()
vi.unstubAllEnvs()
const loadCategories = async () =>
  (await import(/* @vite-ignore */ join(process.cwd(), 'app', 'api', folder, 'categories', 'route.ts'))) as {
    GET: (req: NextRequest) => Promise<Response>
  }

const DB_URL = 'https://example.supabase.co'
const SITE = 'https://accountingbody.com'
const NOW = Date.parse('2026-11-07T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000
const CRON_TEST_VALUE = 'cron-test-value'
const JOB_ID = '0f8fad5b-d9cb-469f-a165-70867728950e'
const TOKEN = 'manage-token-1'

type Row = Record<string, unknown>
const net = {
  rows: {} as Record<string, Row[]>,
  failing: new Set<string>(),
  // Answers for the expiry reads, in order; 'fail' is a database error.
  expiryReads: [] as (Row[] | 'fail')[],
  requests: [] as string[],
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

const PROBLEM = { message: 'database detail', code: 'XX000', details: null, hint: null }

const fakeFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.origin === SITE && url.pathname.startsWith('/api/ingest/')) {
    const slug = url.pathname.split('/').pop() ?? ''
    return ingest(new NextRequest(url, { method: 'POST', headers: new Headers(init?.headers) }), { params: { slug } })
  }
  if (url.origin !== DB_URL) throw new Error(`unexpected request to ${url.href}`)
  const method = (init?.method ?? 'GET').toUpperCase()
  const table = url.pathname.replace('/rest/v1/', '')
  net.requests.push(`${method} ${table}`)
  if (net.failing.has(`${method} ${table}`)) return json(PROBLEM, 500)
  if (method === 'GET' && table === 'jobs' && url.searchParams.has('expires_at')) {
    const next = net.expiryReads.shift() ?? []
    return next === 'fail' ? json(PROBLEM, 500) : json(next)
  }
  const single = (new Headers(init?.headers).get('accept') ?? '').includes('vnd.pgrst.object')
  const eq: [string, string][] = []
  url.searchParams.forEach((value, key) => {
    if (value.startsWith('eq.')) eq.push([key, value.slice(3)])
  })
  const found = (net.rows[table] ?? []).filter((row) => eq.every(([key, value]) => String(row[key]) === value))
  if (method === 'GET') {
    if (!single) return json(found)
    if (found.length === 1) return json(found[0])
    return json({ message: 'no single row', code: 'PGRST116', details: null, hint: null }, 406)
  }
  if (method === 'PATCH') {
    const prefer = new Headers(init?.headers).get('prefer') ?? ''
    for (const row of found) Object.assign(row, typeof init?.body === 'string' ? JSON.parse(init.body) : {})
    if (!prefer.includes('return=representation')) return new Response(null, { status: 204 })
    return single ? (found.length === 1 ? json(found[0]) : json({ message: 'no single row', code: 'PGRST116', details: null, hint: null }, 406)) : json(found)
  }
  if (method === 'POST') return new Response(null, { status: 201 })
  throw new Error(`unexpected ${method} to ${table}`)
}

function recorded(...args: unknown[]) {
  state.order.push(`console ${String(args[0])}`)
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  vi.stubEnv('CRON_SECRET', CRON_TEST_VALUE)
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE)
  for (const level of ['error', 'warn', 'log', 'info'] as const) vi.spyOn(console, level).mockImplementation(recorded)
  state.reports.length = 0
  state.order.length = 0
  state.emails.length = 0
  state.due = []
  net.rows = {}
  net.failing = new Set()
  net.expiryReads = []
  net.requests = []
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function answerOf(response: Response) {
  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    if (key !== 'date') headers[key] = value
  })
  return { status: response.status, headers, body: await response.json() }
}

const JSON_HEADERS = { 'content-type': 'application/json' }
const cron = (path: string, method = 'GET') => new NextRequest(SITE + path, { method, headers: { authorization: `Bearer ${CRON_TEST_VALUE}` } })
const labels = () => state.reports.map((args) => args[0])

const provider = {
  id: 'provider-1',
  slug: 'example',
  name: 'Example jobs',
  status: 'paused',
  rate_limit_daily: null,
  requests_today: 0,
  field_mapping: {},
}

describe('provider import', () => {
  const run = () => ingest(cron('/api/ingest/example', 'POST'), { params: { slug: 'example' } })

  it('keeps the not-found answer for a provider that does not exist', async () => {
    expect(await answerOf(await run())).toStrictEqual({ status: 404, headers: JSON_HEADERS, body: { ok: false, error: 'Provider not found' } })
    expect(state.reports).toStrictEqual([])
  })

  it('keeps the skipped answer for an inactive provider', async () => {
    net.rows.job_providers = [{ ...provider }]
    expect(await answerOf(await run())).toStrictEqual({ status: 200, headers: JSON_HEADERS, body: { ok: true, skipped: true, reason: 'Provider inactive' } })
    expect(state.reports).toStrictEqual([])
  })

  it('answers a temporary problem when the provider cannot be read, and reports it once', async () => {
    net.failing.add('GET job_providers')
    expect(await answerOf(await run())).toStrictEqual({ status: 503, headers: JSON_HEADERS, body: { ok: false, error: 'Provider could not be read' } })
    expect(state.reports).toHaveLength(1)
    expect(state.reports[0][0]).toBe('job import provider read failed')
    expect(state.reports[0][1]).toMatchObject({ code: 'XX000' })
    expect(state.reports[0][2]).toStrictEqual({ area: 'ingest' })
    // No run is started and the provider's health is left as it was.
    expect(net.requests).toStrictEqual(['GET job_providers'])
  })

  it('the scheduler counts that answer as a failed dispatch, not as an inactive provider', async () => {
    state.due = [{ id: 'provider-1', slug: 'example', name: 'Example jobs' }]
    net.failing.add('GET job_providers')
    const answer = await answerOf(await orchestrator(cron('/api/ingest/orchestrator')))
    expect(answer.status).toBe(200)
    expect(answer.body.summary).toStrictEqual([
      { slug: 'example', result: { slug: 'example', status: 503, ok: false, error: 'Provider could not be read' } },
    ])
    expect(labels()).toStrictEqual(['job import provider read failed', 'job import dispatch failed'])
  })

  it('the scheduler still counts a missing provider as a failed dispatch', async () => {
    state.due = [{ id: 'provider-1', slug: 'example', name: 'Example jobs' }]
    const answer = await answerOf(await orchestrator(cron('/api/ingest/orchestrator')))
    expect(answer.body.summary).toStrictEqual([
      { slug: 'example', result: { slug: 'example', status: 404, ok: false, error: 'Provider not found' } },
    ])
    expect(labels()).toStrictEqual(['job import dispatch failed'])
  })
})

describe('listing manage link', () => {
  const job = { id: JOB_ID, title: 'Management Accountant', company_name: 'Example Ltd', status: 'active', manage_token: TOKEN, employer_email: 'hiring@example.com' }
  const get = (token: string) => manageGet(new NextRequest(`${SITE}/api/jobs/manage?token=${token}`))
  const close = (token: string) =>
    managePost(new NextRequest(`${SITE}/api/jobs/manage`, { method: 'POST', body: JSON.stringify({ token, action: 'close' }), headers: { 'content-type': 'application/json' } }))

  it('keeps the not-found answer for an unknown link', async () => {
    expect(await answerOf(await get('unknown'))).toStrictEqual({ status: 404, headers: JSON_HEADERS, body: { error: 'Listing not found' } })
    expect(await answerOf(await close('unknown'))).toStrictEqual({ status: 404, headers: JSON_HEADERS, body: { error: 'Listing not found' } })
    expect(state.reports).toStrictEqual([])
  })

  it('shows the listing for a known link', async () => {
    net.rows.jobs = [{ ...job }]
    const answer = await answerOf(await get(TOKEN))
    expect(answer.status).toBe(200)
    expect(answer.body.job.id).toBe(JOB_ID)
    expect(state.reports).toStrictEqual([])
  })

  it('answers a temporary problem when the listing cannot be read, and reports it once', async () => {
    net.failing.add('GET jobs')
    expect(await answerOf(await get(TOKEN))).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: { error: 'Internal server error' } })
    expect(labels()).toStrictEqual(['job manage link failed'])
    expect(state.reports[0][1]).toMatchObject({ code: 'XX000' })
    expect(state.reports[0][2]).toStrictEqual({ area: 'public' })
    expect(state.order).toStrictEqual(['console jobs/manage GET error:', 'report job manage link failed'])
  })

  it('answers a temporary problem when a withdrawal cannot read the listing, and reports it once', async () => {
    net.failing.add('GET jobs')
    expect(await answerOf(await close(TOKEN))).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: { error: 'Internal server error' } })
    expect(labels()).toStrictEqual(['job withdraw failed'])
    expect(state.emails).toStrictEqual([])
  })
})

describe('listing manage screen', () => {
  const source = readFileSync(join(process.cwd(), 'app/jobs/manage-listing/ManageListingClient.tsx'), 'utf8')

  it('asks the visitor to try again for a temporary problem and keeps "invalid" for an unknown link', () => {
    expect(manageLinkStatus(500, false)).toBe('retry')
    expect(manageLinkStatus(null, false)).toBe('retry')
    expect(manageLinkStatus(404, false)).toBe('invalid')
    expect(manageLinkStatus(400, false)).toBe('invalid')
    expect(manageLinkStatus(200, true)).toBe('ok')
  })

  it('chooses its state with the shared rule from the answer status', () => {
    expect(source).toContain("from '@/lib/message-rules'")
    expect(source).toContain('httpStatus: r.status')
    expect(source).toContain('r.json().catch(() => null)')
    expect(source).toContain('manageLinkStatus(httpStatus, Boolean(data))')
    expect(source).toContain("if (linkStatus === 'retry') setLinkRetry(true); else setInvalid(true)")
    expect(source).toContain(".catch(() => { setLinkRetry(true); setLoading(false) })")
    expect(source).not.toMatch(/\.then\(r => r\.json\(\)\)/)
  })

  it('shows the try-again panel with the shared texts and keeps the invalid-link panel', () => {
    expect(source).toContain('if (linkRetry) return (')
    expect(source).toContain('{LINK_RETRY_HEADING}</h2>')
    expect(source).toContain('{MANAGE_LINK_RETRY_TEXT}</p>')
    expect(source).toContain('>Invalid Link</h2>')
    expect(source.indexOf('if (linkRetry) return (')).toBeLessThan(source.indexOf('if (invalid || !job) return ('))
    expect(LINK_RETRY_HEADING).toBe('Please Try Again')
    expect(MANAGE_LINK_RETRY_TEXT.length).toBeGreaterThan(20)
  })
})

describe('daily expiry run', () => {
  const run = () => expireJobs(cron('/api/cron/expire-jobs'))
  const pastDue = { id: JOB_ID, title: 'Management Accountant', company_name: 'Example Ltd', status: 'active', employer_email: 'hiring@example.com', employer_name: 'Ada Lovelace', manage_token: TOKEN, impression_count: 0, expires_at: new Date(NOW - DAY).toISOString(), platform: ['ab'] }
  const dueSoon = { ...pastDue, id: 'b1a4c7a2-58f4-4c3e-9a51-2c1f8f6f3d10', impression_count: 3, expires_at: new Date(NOW + 6.5 * DAY).toISOString() }
  const RUN_REQUESTS = ['GET jobs', 'GET jobs', 'PATCH job_providers']

  it('keeps an empty run answer when nothing is due', async () => {
    expect(await answerOf(await run())).toStrictEqual({ status: 200, headers: JSON_HEADERS, body: { expired: 0, warned: 0 } })
    expect(net.requests).toStrictEqual(RUN_REQUESTS)
    expect(state.reports).toStrictEqual([])
  })

  it('answers a failed run when the jobs cannot be read, after the rest of the run, and reports it once', async () => {
    net.expiryReads = ['fail', 'fail']
    expect(await answerOf(await run())).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: { error: 'Cron run failed', expired: 0, warned: 0 } })
    expect(net.requests).toStrictEqual(RUN_REQUESTS)
    expect(labels()).toStrictEqual(['job expiry run failed'])
    expect(state.reports[0][1]).toMatchObject({ code: 'XX000' })
    expect(state.reports[0][2]).toStrictEqual({ area: 'cron' })
    expect(state.order).toStrictEqual([
      'console getExpiringJobs error:',
      'console getExpiringJobs error:',
      'console cron/expire-jobs: fatal error',
      'report job expiry run failed',
    ])
  })

  it('still sends the expiry warnings when the first read fails', async () => {
    net.expiryReads = ['fail', [dueSoon]]
    expect(await answerOf(await run())).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: { error: 'Cron run failed', expired: 0, warned: 1 } })
    expect(state.emails).toHaveLength(1)
    expect(labels()).toStrictEqual(['job expiry run failed'])
  })

  it('still expires due jobs when the second read fails', async () => {
    net.rows.jobs = [{ ...pastDue }]
    net.expiryReads = [[pastDue], 'fail']
    expect(await answerOf(await run())).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: { error: 'Cron run failed', expired: 1, warned: 0 } })
    expect(net.requests).toStrictEqual(['GET jobs', 'PATCH jobs', 'GET jobs', 'PATCH job_providers'])
    expect(state.emails).toHaveLength(1)
    expect(labels()).toStrictEqual(['job expiry run failed'])
  })

  it('keeps the answer for a run that works', async () => {
    net.rows.jobs = [{ ...pastDue }]
    net.expiryReads = [[pastDue], [dueSoon]]
    expect(await answerOf(await run())).toStrictEqual({ status: 200, headers: JSON_HEADERS, body: { expired: 1, warned: 1 } })
    expect(state.reports).toStrictEqual([])
  })
})

describe('admin category list', () => {
  const list = async () => (await loadCategories()).GET(new NextRequest(`${SITE}/api/admin-tool/categories?platform=ab`))

  it('keeps the empty list when there are no categories', async () => {
    expect(await answerOf(await list())).toStrictEqual({ status: 200, headers: JSON_HEADERS, body: { categories: [] } })
    expect(state.reports).toStrictEqual([])
  })

  it('lists the categories it reads', async () => {
    net.rows.articles = [
      { category: 'tax', category_title: 'Tax', status: 'published', platform: 'ab' },
      { category: 'audit', category_title: 'Audit', status: 'published', platform: 'ab' },
    ]
    expect((await answerOf(await list())).body).toStrictEqual({ categories: [{ slug: 'audit', title: 'Audit' }, { slug: 'tax', title: 'Tax' }] })
    expect(state.reports).toStrictEqual([])
  })

  it('answers a temporary problem when the categories cannot be read, and reports it once', async () => {
    net.failing.add('GET articles')
    expect(await answerOf(await list())).toStrictEqual({ status: 500, headers: JSON_HEADERS, body: { error: 'Could not load categories.' } })
    expect(state.reports).toStrictEqual([['admin category list read failed', new Error('admin category list read failed'), { area: 'admin' }]])
  })
})
