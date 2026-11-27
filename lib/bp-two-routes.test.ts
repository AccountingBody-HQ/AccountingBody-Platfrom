import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_ADMIN_PATH, TEST_ADMIN_SECRET, TEST_SESSION_SECRET, signTestSession } from './admin-session-fixtures'
import { ADMIN_SESSION_COOKIE, getAdminPath } from './middleware-logic'

// BP-2 (A7-11): the admin Personal data tool. The route runs with a real
// supabase-js client from the factory; only the network is fake. The fake
// applies the ilike / eq / in filters itself, so exact matching and
// "deletes only the found ids" are proven on the requests really sent.

vi.mock('@sentry/nextjs', () => ({ captureException: () => {}, captureMessage: () => {} }))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}))

// The folder comes from the app's own default, so its name is not repeated here.
vi.stubEnv('ADMIN_PATH', undefined)
const ADMIN = getAdminPath()
vi.unstubAllEnvs()

const ROUTE = `app/api/${ADMIN}/personal-data/route.ts`
type Handler = (req: NextRequest) => Promise<Response>
const route = (): Promise<Record<string, Handler | undefined>> => import(/* @vite-ignore */ join(process.cwd(), ROUTE))

const DB_URL = 'https://example.supabase.co'
const SITE = 'https://accountingbody.com'
const EMAIL = 'person@example.com'

type Row = Record<string, unknown>
type Call = { method: string; table: string; params: URLSearchParams; body: unknown }

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const network = {
  rows: {} as Record<string, Row[]>,
  fail: (() => false) as (call: Call) => boolean,
  calls: [] as Call[],
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// PostgREST like pattern → RegExp (\ escapes; % and * any run; _ one char).
function likeToRegExp(pattern: string): RegExp {
  let out = ''
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '\\' && i + 1 < pattern.length) { out += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); continue }
    if (c === '%' || c === '*') out += '.*'
    else if (c === '_') out += '.'
    else out += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${out}$`, 'is')
}

function matches(row: Row, params: URLSearchParams): boolean {
  for (const [key, raw] of Array.from(params.entries())) {
    if (['select', 'order', 'offset', 'limit'].includes(key)) continue
    const value = row[key]
    if (raw.startsWith('ilike.')) {
      if (typeof value !== 'string' || !likeToRegExp(raw.slice(6)).test(value)) return false
    } else if (raw.startsWith('eq.')) {
      if (String(value) !== raw.slice(3)) return false
    } else if (raw.startsWith('in.(')) {
      const list = raw.slice(4, -1).split(',').map((v) => v.replace(/^"|"$/g, ''))
      if (!list.includes(String(value))) return false
    } else {
      throw new Error(`unexpected filter ${key}`)
    }
  }
  return true
}

const fakeFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.origin !== DB_URL) throw new Error('unexpected request to another host')
  const method = (init?.method ?? 'GET').toUpperCase()
  const table = url.pathname.replace('/rest/v1/', '')
  const call: Call = { method, table, params: url.searchParams, body: init?.body ? JSON.parse(String(init.body)) : undefined }
  network.calls.push(call)
  if (network.fail(call)) return json({ code: 'XX000', message: `database detail about ${EMAIL}`, details: EMAIL, hint: null }, 500)
  const all = network.rows[table] ?? []
  if (method === 'GET') {
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const limit = Number(url.searchParams.get('limit') ?? 1000)
    const hit = all.filter((row) => matches(row, url.searchParams))
    const sorted = hit.sort((a, b) => String(a.id).localeCompare(String(b.id)))
    return json(sorted.slice(offset, offset + limit), 200)
  }
  if (method === 'DELETE') {
    const gone = all.filter((row) => matches(row, url.searchParams))
    network.rows[table] = all.filter((row) => !gone.includes(row))
    return json(gone.map((row) => ({ id: row.id })), 200)
  }
  throw new Error(`unexpected ${method} ${table}`)
}

let session = ''
const post = (body: unknown, signedIn = true) =>
  new NextRequest(`${SITE}/api/${TEST_ADMIN_PATH}/personal-data`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...(signedIn ? { cookie: `${ADMIN_SESSION_COOKIE}=${session}` } : {}) },
  })
const call = async (body: unknown, signedIn = true) => (await route()).POST!(post(body, signedIn))

let logged: unknown[][] = []

function seed() {
  network.rows = {
    help_requests: [
      { id: id(1), email: 'Person@Example.com', name: 'Pat Person', status: 'new', created_at: '2026-11-01T00:00:00Z' },
      { id: id(2), email: 'other@example.com', name: 'Someone Else' },
      { id: id(3), email: 'xperson@example.com', name: 'Near Miss' },
    ],
    contact_submissions: [{ id: id(4), email: EMAIL, name: 'Pat Person' }, { id: id(5), email: 'person@example.com.au' }],
    email_subscribers: [
      { id: id(6), email: EMAIL, platform: 'ab', confirmation_token: 'secret-confirm' },
      { id: id(7), email: EMAIL, platform: 'et', confirmation_token: null },
    ],
    firms_applications: [{ id: id(8), contact_email: 'PERSON@EXAMPLE.COM', contact_name: 'Pat' }],
    job_seeker_registrations: [{ id: id(9), email: EMAIL, full_name: 'Pat Person', update_token: 'secret-update' }],
    employer_briefs: [],
    job_applications: [],
    jobs: [
      { id: id(10), source: 'employer', employer_email: EMAIL, application_email: null, title: 'Tax Senior' },
      { id: id(11), source: 'employer', employer_email: 'boss@example.com', application_email: EMAIL, title: 'Audit Lead' },
      { id: id(12), source: 'adzuna-za', employer_email: EMAIL, application_email: null, title: 'Placeholder' },
    ],
    admin_recycle_bin: [
      { id: id(20), kind: 'form_entry', label: 'help_requests entry 1', deleted_at: '2026-11-20T00:00:00Z', payload: { help_requests: [{ id: id(30), email: 'person@EXAMPLE.com', name: 'Pat' }] } },
      { id: id(21), kind: 'form_entry', label: 'help_requests entry 2', deleted_at: '2026-11-20T00:00:00Z', payload: { help_requests: [{ id: id(31), email: 'other@example.com', message: `mail ${EMAIL} soon` }] } },
      { id: id(22), kind: 'course', label: 'A course', deleted_at: '2026-11-21T00:00:00Z', payload: { courses: [{ id: id(32), title: 'Course' }] } },
    ],
  }
}

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('ADMIN_PATH', TEST_ADMIN_PATH)
  vi.stubEnv('ADMIN_SECRET', TEST_ADMIN_SECRET)
  vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SESSION_SECRET)
  logged = []
  for (const level of ['error', 'warn', 'log', 'info', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => { logged.push(args) })
  }
  network.fail = () => false
  network.calls = []
  seed()
  session = await signTestSession()
})

afterEach(() => {
  // No log line ever holds the address, in any letter case.
  const text = JSON.stringify(logged, (_k, v) => (v instanceof Error ? `${v.name}: ${v.message}` : v)).toLowerCase()
  expect(text).not.toContain(EMAIL)
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const writes = () => network.calls.filter((c) => c.method !== 'GET' && c.method !== 'HEAD')
const remainingIds = (table: string) => (network.rows[table] ?? []).map((row) => row.id)

describe('Personal data route: access', () => {
  it('needs an admin session and reads nothing without one', async () => {
    const res = await call({ action: 'find', email: EMAIL }, false)
    expect(res.status).toBe(401)
    expect(network.calls).toHaveLength(0)
  })

  it('has POST only: no GET handler (an address would land in the web address)', async () => {
    const mod = await route()
    expect(typeof mod.POST).toBe('function')
    for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) expect(mod[method]).toBeUndefined()
    const source = readFileSync(join(process.cwd(), ROUTE), 'utf8')
    expect(source).toContain("export const dynamic = 'force-dynamic'")
    expect(source).toContain("export const fetchCache = 'force-no-store'")
    expect(source).toContain("export const runtime = 'nodejs'")
    expect(source).toContain("getServerSupabase('admin')")
  })

  it.each([
    [{ action: 'find', email: 'not an address' }, 'Enter one full e-mail address.'],
    [{ action: 'find', email: 'person*@example.com' }, 'Enter one full e-mail address.'],
    [{ action: 'remove', email: EMAIL }, 'Unknown action'],
  ])('refuses %j before any read', async (body, error) => {
    const res = await call(body)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe(error)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(network.calls).toHaveLength(0)
  })
})

describe('Personal data route: find', () => {
  it('finds exact, case-insensitive matches only, in every source and the recycle bin', async () => {
    const res = await call({ action: 'find', email: '  PERSON@example.com ' })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const data = await res.json()
    const counts = Object.fromEntries(data.sources.map((s: { table: string; count: number }) => [s.table, s.count]))
    expect(counts).toEqual({
      help_requests: 1, contact_submissions: 1, email_subscribers: 2, firms_applications: 1,
      job_seeker_registrations: 1, employer_briefs: 0, job_applications: 0, jobs: 2,
    })
    const jobs = data.sources.find((s: { table: string }) => s.table === 'jobs')
    expect(jobs.rows.map((r: Row) => r.id).sort()).toEqual([id(10), id(11)])
    expect(jobs.action).toBe('keep')
    // Bin copies: the one whose saved row has the address; never the payload.
    expect(data.recycle_bin).toEqual([{ id: id(20), kind: 'form_entry', label: 'help_requests entry 1', deleted_at: '2026-11-20T00:00:00Z' }])
    // Working keys never leave the server.
    const all = JSON.stringify(data)
    expect(all).not.toContain('secret-confirm')
    expect(all).not.toContain('secret-update')
    expect(data.outside_our_database).toHaveLength(6)
    expect(writes()).toHaveLength(0)
  })

  it('sends ilike with % _ and \\ escaped, so they never act as wildcards', async () => {
    network.rows.help_requests = [
      { id: id(1), email: 'a_b%c@example.com' },
      { id: id(2), email: 'axbZZc@example.com' },
      { id: id(3), email: 'aXb%c@example.com' },
    ]
    const data = await (await call({ action: 'find', email: 'a_b%c@example.com' })).json()
    expect(data.sources.find((s: { table: string }) => s.table === 'help_requests').rows.map((r: Row) => r.id)).toEqual([id(1)])
    const sent = network.calls.find((c) => c.table === 'help_requests')!
    expect(sent.params.get('email')).toBe('ilike.a\\_b\\%c@example.com')
  })

  it('reads in pages until a short page', async () => {
    network.rows.contact_submissions = Array.from({ length: 1001 }, (_, i) => ({ id: id(1000 + i), email: EMAIL }))
    const data = await (await call({ action: 'find', email: EMAIL })).json()
    expect(data.sources.find((s: { table: string }) => s.table === 'contact_submissions').count).toBe(1001)
    expect(network.calls.filter((c) => c.table === 'contact_submissions').map((c) => c.params.get('offset'))).toEqual(['0', '1000'])
  })

  it('a failed read fails the whole find and shows nothing', async () => {
    network.fail = (c) => c.table === 'firms_applications'
    const res = await call({ action: 'find', email: EMAIL })
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data).toEqual({ error: 'Could not read Firm and freelancer applications. Nothing was shown.' })
  })

  it('a failed recycle bin read fails the find too', async () => {
    network.fail = (c) => c.table === 'admin_recycle_bin'
    const res = await call({ action: 'find', email: EMAIL })
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Could not read the recycle bin. Nothing was shown.')
  })
})

describe('Personal data route: export', () => {
  it('is one JSON download with no-store, the rows, the bin copies and the outside list', async () => {
    const res = await call({ action: 'export', email: EMAIL })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="personal-data-export.json"')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('content-type')).toContain('application/json')
    const doc = JSON.parse(await res.text())
    expect(Object.keys(doc)).toEqual(['generated_at', 'email', 'sources', 'recycle_bin', 'outside_our_database'])
    expect(doc.email).toBe(EMAIL)
    expect(doc.sources.help_requests.map((r: Row) => r.id)).toEqual([id(1)])
    expect(doc.sources.email_subscribers).toHaveLength(2)
    expect(doc.sources.jobs).toHaveLength(2)
    expect(doc.recycle_bin).toEqual([{
      id: id(20), kind: 'form_entry', label: 'help_requests entry 1', deleted_at: '2026-11-20T00:00:00Z',
      rows: [{ table: 'help_requests', row: { id: id(30), email: 'person@EXAMPLE.com', name: 'Pat' } }],
    }])
    expect(doc.outside_our_database).toHaveLength(6)
    expect(JSON.stringify(doc)).not.toContain('secret-')
    expect(writes()).toHaveLength(0)
  })
})

describe('Personal data route: erase', () => {
  it.each([undefined, '', 'other@example.com', 'person@example.co'])('without the exact confirm (%j) it reads and writes nothing', async (confirm) => {
    const res = await call({ action: 'erase', email: EMAIL, confirm })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Type the same e-mail address again to confirm. Nothing was erased.')
    expect(network.calls).toHaveLength(0)
  })

  it('deletes exactly the found rows and bin copies, keeps jobs, and makes no bin copy', async () => {
    const res = await call({ action: 'erase', email: EMAIL, confirm: ' Person@Example.COM ' })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.deleted).toEqual({
      help_requests: 1, contact_submissions: 1, email_subscribers: 2, firms_applications: 1,
      job_seeker_registrations: 1, employer_briefs: 0, job_applications: 0, admin_recycle_bin: 1,
    })
    expect(data.not_done).toEqual([])
    expect(data.kept).toEqual([expect.objectContaining({ table: 'jobs', count: 2 })])

    // Every write is a DELETE by id, listing only ids the find returned.
    const found = new Set([id(1), id(4), id(6), id(7), id(8), id(9), id(20)])
    for (const w of writes()) {
      expect(w.method).toBe('DELETE')
      const filters = Array.from(w.params.keys()).filter((k) => k !== 'select')
      expect(filters).toEqual(['id'])
      const ids = w.params.get('id')!.slice(4, -1).split(',').map((v) => v.replace(/^"|"$/g, ''))
      for (const one of ids) expect(found.has(one)).toBe(true)
    }
    expect(writes().map((w) => w.table)).toEqual([
      'help_requests', 'contact_submissions', 'email_subscribers', 'firms_applications', 'job_seeker_registrations', 'admin_recycle_bin',
    ])

    // Everything else is still there.
    expect(remainingIds('help_requests')).toEqual([id(2), id(3)])
    expect(remainingIds('contact_submissions')).toEqual([id(5)])
    expect(remainingIds('admin_recycle_bin')).toEqual([id(21), id(22)])
    expect(remainingIds('jobs')).toEqual([id(10), id(11), id(12)])
    // Jobs are never deleted or changed, and nothing is copied into the bin.
    expect(writes().filter((w) => w.table === 'jobs')).toHaveLength(0)
    expect(network.calls.filter((c) => c.method === 'POST' || c.method === 'PATCH')).toHaveLength(0)
  })

  it('a failed delete gives an honest partial answer and never claims success', async () => {
    network.fail = (c) => c.method === 'DELETE' && c.table === 'email_subscribers'
    const res = await call({ action: 'erase', email: EMAIL, confirm: EMAIL })
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.success).toBeUndefined()
    expect(data.error).toBe('Erase stopped at E-mail list sign-ups (every site). The tables listed as done were erased; the others were not. Run the erase again to finish.')
    expect(data.done).toEqual(['help_requests', 'contact_submissions'])
    expect(data.not_done).toEqual(['email_subscribers', 'firms_applications', 'job_seeker_registrations', 'admin_recycle_bin'])
    expect(data.deleted).toEqual({ help_requests: 1, contact_submissions: 1, email_subscribers: 0 })
    // Nothing after the failure was touched.
    expect(writes().map((w) => w.table)).toEqual(['help_requests', 'contact_submissions', 'email_subscribers'])
    expect(remainingIds('admin_recycle_bin')).toEqual([id(20), id(21), id(22)])
  })

  it('a failed read during erase deletes nothing', async () => {
    network.fail = (c) => c.method === 'GET' && c.table === 'admin_recycle_bin'
    const res = await call({ action: 'erase', email: EMAIL, confirm: EMAIL })
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Could not read the recycle bin. Nothing was erased.')
    expect(writes()).toHaveLength(0)
  })
})

describe('Personal data screen', () => {
  const page = readFileSync(join(process.cwd(), `app/${ADMIN}/personal-data/page.tsx`), 'utf8')
  const shell = readFileSync(join(process.cwd(), `app/${ADMIN}/AdminShell.tsx`), 'utf8')

  it('calls its route through adminFetch with POST only, never with the address in the web address', () => {
    expect(page.startsWith("'use client'")).toBe(true)
    expect(page).toContain("import { adminFetch } from '@/lib/admin-fetch'")
    expect(page).toContain(`const API = '/api/${ADMIN}/personal-data'`)
    expect(page).toContain('adminFetch(API, {')
    expect(page).toContain("method:  'POST',")
    expect(page).not.toMatch(/[^n]fetch\(/)
    expect(page).not.toMatch(/\?email|searchParams|router\.(push|replace)/)
  })

  it('asks for the address to be typed again and names what is deleted, kept and outside', () => {
    for (const words of [
      'Type the e-mail address again to confirm',
      'This deletes:',
      'This keeps:',
      'Copies in the recycle bin:',
      'Download export (JSON)',
      'Erase…',
      'Also check outside our database',
      'info@accountingbody.com',
      'Resend',
      'Lemon Squeezy',
      'WhatsApp',
    ]) expect([words, page.includes(words)]).toEqual([words, true])
  })

  it('the admin menu has one Personal data entry and its page title', () => {
    expect(shell.split('\n').filter((line) => line.includes(`href: '/${ADMIN}/personal-data'`))).toHaveLength(1)
    expect(shell).toContain("label: 'Personal data',   sub: 'Find, export or erase one person'")
    expect(shell).toContain(`'/${ADMIN}/personal-data':      'Personal data'`)
  })
})
