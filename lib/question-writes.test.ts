import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_ADMIN_PATH, TEST_ADMIN_SECRET, TEST_SESSION_SECRET, signTestSession } from './admin-session-fixtures'
import { ADMIN_SESSION_COOKIE, getAdminPath } from './middleware-logic'
import {
  NOT_FOUND,
  SET_READ_FAILED,
  SLUG_READ_FAILED,
  alreadyHasSetMessage,
  publishProblemsMessage,
  slugTakenMessage,
} from './question-publish-checks'

// PQ-1 (D337): question publishing checks before it writes, says honestly
// what happened, and refreshes the public question caches after a write that
// succeeded. The routes run with real supabase-js clients from the factory;
// only the network is fake: a small in-memory table store that applies the
// request's eq filters and limit, so each check meets the rows it looks for.

const revalidated = vi.hoisted(() => [] as string[])

vi.mock('@sentry/nextjs', () => ({ captureException: () => {}, captureMessage: () => {} }))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>) => (...args: unknown[]) => fn(...args),
  unstable_noStore: () => {},
  revalidateTag: (tag: string) => {
    revalidated.push(tag)
  },
  revalidatePath: () => {},
}))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}))

// The folder comes from the app's own default, so its name is not repeated here.
vi.stubEnv('ADMIN_PATH', undefined)
const ADMIN = getAdminPath()
vi.unstubAllEnvs()

type Handler = (req: NextRequest, context: { params: unknown }) => Promise<Response>
const api = (path: string): Promise<Record<string, Handler>> =>
  import(/* @vite-ignore */ join(process.cwd(), `app/api/${ADMIN}/${path}`))

const DB_URL = 'https://example.supabase.co'
const SITE = 'https://accountingbody.com'
const SET_ID = '0f8fad5b-d9cb-469f-a165-70867728950e'

type Row = Record<string, unknown>
type Call = { method: string; table: string; query: string; body: unknown; tagsBefore: number }

const db = {
  tables: {} as Record<string, Row[]>,
  fail: (() => false) as (call: Call) => boolean,
  rpc: {} as unknown,
  calls: [] as Call[],
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const fakeFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.origin !== DB_URL) throw new Error(`unexpected request to ${url.href}`)
  const method = (init?.method ?? 'GET').toUpperCase()
  const table = url.pathname.replace('/rest/v1/', '')
  const body: unknown = init?.body ? JSON.parse(String(init.body)) : undefined
  const call: Call = { method, table, query: decodeURIComponent(url.search), body, tagsBefore: revalidated.length }
  db.calls.push(call)
  if (db.fail(call)) return json({ code: 'XX000', message: 'database detail', details: null, hint: null }, 500)
  if (table.startsWith('rpc/')) return json(db.rpc, 200)

  const headers = new Headers(init?.headers)
  const single = (headers.get('accept') ?? '').includes('vnd.pgrst.object')
  const rows = (db.tables[table] ??= [])
  const matches = (row: Row) =>
    Array.from(url.searchParams).every(([key, value]) => {
      if (value.startsWith('eq.')) return String(row[key]) === value.slice(3)
      if (value.startsWith('in.(')) return value.slice(4, -1).split(',').includes(String(row[key]))
      if (value.startsWith('like.')) return String(row[key] ?? '').startsWith(value.slice(5).replace(/[*%]$/, ''))
      return true
    })

  let found = rows.filter(matches)
  if (method === 'POST') {
    found = (Array.isArray(body) ? body : [body]).map((row) => ({ id: SET_ID, ...(row as Row) }))
    rows.push(...found)
  } else if (method === 'PATCH') {
    for (const row of found) Object.assign(row, body)
  } else if (method === 'DELETE') {
    db.tables[table] = rows.filter((row) => !matches(row))
  }
  const limit = url.searchParams.get('limit')
  if (method === 'GET' && limit) found = found.slice(0, Number(limit))
  const wantsRows = method === 'GET' || (headers.get('prefer') ?? '').includes('return=representation')
  if (!wantsRows) return new Response(null, { status: method === 'POST' ? 201 : 204 })
  if (!single) return json(found, method === 'POST' ? 201 : 200)
  if (found.length !== 1) return json({ code: 'PGRST116', details: `The result contains ${found.length} rows`, hint: null, message: 'no single row' }, 406)
  return json(found[0], method === 'POST' ? 201 : 200)
}

let session = ''
const request = (method: string, path: string, body?: unknown) =>
  new NextRequest(`${SITE}/api/${TEST_ADMIN_PATH}/${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json', cookie: `${ADMIN_SESSION_COOKIE}=${session}` },
  })

const lines = () => db.calls.map((c) => `${c.method} ${c.table}`)
const writes = () => lines().filter((line) => !line.startsWith('GET'))
const failOn = (method: string, table: string, part = '') => (call: Call) =>
  call.method === method && call.table === table && call.query.includes(part)

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('ADMIN_PATH', TEST_ADMIN_PATH)
  vi.stubEnv('ADMIN_SECRET', TEST_ADMIN_SECRET)
  vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SESSION_SECRET)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  revalidated.length = 0
  Object.assign(db, { tables: {}, fail: () => false, rpc: {}, calls: [] })
  session = await signTestSession()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ── Publish ─────────────────────────────────────────────────────────────────

const question = (over: Row = {}): Row => ({
  type: 'multiple-choice',
  questionText: 'Which one?',
  options: ['One', 'Two', 'Three', 'Four'],
  correctIndex: 2,
  explanation: 'Because.',
  ...over,
})
const bundle = (over: Row = {}): Row => ({ title: 'Leases quiz', questions: [question()], ...over })

async function publish(body: Row) {
  const res = await (await api('questions/publish/route.ts')).POST(request('POST', 'questions/publish', body), { params: {} })
  return { status: res.status, body: (await res.json()) as Row }
}

describe('publish: structural checks before any read or write', () => {
  it('refuses an incomplete bundle with the exact list, and makes no database request', async () => {
    const result = await publish({
      bundle: bundle({ questions: [question(), question({ options: ['One', 'Two', 'Option C', 'Four'], explanation: '' })] }),
    })
    expect(result).toEqual({
      status: 400,
      body: {
        error: publishProblemsMessage([
          { n: 2, reason: 'placeholder-option' },
          { n: 2, reason: 'explanation' },
        ]),
      },
    })
    expect(db.calls).toEqual([])
    expect(revalidated).toEqual([])
  })

  it('refuses a writing question without a model answer', async () => {
    const result = await publish({ bundle: bundle({ questions: [{ type: 'writing', questionText: 'Discuss.' }] }) })
    expect(result).toEqual({
      status: 400,
      body: { error: 'Nothing was published. Please fix these questions first: Q1 needs a model answer.' },
    })
    expect(db.calls).toEqual([])
  })

  it.each([[undefined], [[]], ['text'], [{ length: 1 }]])('refuses questions that are not a list with entries (%j)', async (questions) => {
    expect(await publish({ bundle: bundle({ questions }) })).toEqual({
      status: 400,
      body: { error: 'bundle with questions is required' },
    })
    expect(db.calls).toEqual([])
  })

  it('answers a signed-out request before anything else', async () => {
    session = 'not-a-session'
    expect((await publish({ bundle: bundle() })).status).toBe(401)
    expect(db.calls).toEqual([])
  })
})

describe('publish: the linked article', () => {
  const article = { slug: 'leases', content_id: 'AB-ART-00007', status: 'published' }

  it.each([
    ['an unknown ID', 'AB-ART-99999'],
    ['an unknown slug', 'no-such-article'],
    ['the slug of an unpublished article', 'draft-article'],
  ])('refuses %s and writes nothing', async (_name, articleSlug) => {
    db.tables.articles = [article, { slug: 'draft-article', content_id: 'AB-ART-00008', status: 'draft' }]
    expect(await publish({ bundle: bundle(), articleSlug })).toEqual({ status: 400, body: { error: NOT_FOUND } })
    expect(writes()).toEqual([])
    expect(revalidated).toEqual([])
  })

  it.each([
    ['the ID', ' ab-art-00007 '],
    ['the slug', ' leases '],
  ])('accepts an article by %s, and stores its slug', async (_name, articleSlug) => {
    db.tables.articles = [{ ...article }]
    expect((await publish({ bundle: bundle(), articleSlug })).status).toBe(200)
    expect(db.tables.question_sets).toMatchObject([{ article_slug: 'leases' }])
  })

  it.each(['published', 'draft', 'archived'])('refuses an article that already has a set (%s), and names that set', async (status) => {
    db.tables.articles = [article]
    db.tables.question_sets = [{ id: 'other', title: 'Leases basics', slug: 'leases-basics', article_slug: 'leases', status }]
    expect(await publish({ bundle: bundle(), articleSlug: 'AB-ART-00007' })).toEqual({
      status: 409,
      body: { error: alreadyHasSetMessage('Leases basics') },
    })
    expect(writes()).toEqual([])
  })

  it('refuses an article that already has several sets', async () => {
    db.tables.articles = [article]
    db.tables.question_sets = ['one', 'two'].map((slug) => ({ id: slug, title: slug, slug, article_slug: 'leases' }))
    expect((await publish({ bundle: bundle(), articleSlug: 'leases' })).status).toBe(409)
    expect(writes()).toEqual([])
  })

  it.each([
    ['the linked article', 'articles', '', 'Could not read the linked article. Nothing was published.'],
    ['the existing set', 'question_sets', 'article_slug=eq.', SET_READ_FAILED],
  ])('writes nothing when %s cannot be read', async (_name, table, part, error) => {
    db.tables.articles = [article]
    db.fail = failOn('GET', table, part)
    expect(await publish({ bundle: bundle(), articleSlug: 'AB-ART-00007' })).toEqual({ status: 500, body: { error } })
    expect(writes()).toEqual([])
  })

  it.each([undefined, null, '', '   '])('publishes without a link when no article is named (%j)', async (articleSlug) => {
    expect((await publish({ bundle: bundle(), articleSlug })).status).toBe(200)
    expect(db.tables.question_sets).toMatchObject([{ article_slug: null }])
    expect(lines().filter((line) => line.endsWith(' articles'))).toEqual([])
  })
})

describe('publish: the web address', () => {
  it.each(['published', 'draft'])('refuses an address another set uses (%s), and adds no suffix', async (status) => {
    db.tables.question_sets = [{ id: 'other', title: 'Leases quiz', slug: 'leases-quiz', status }]
    expect(await publish({ bundle: bundle() })).toEqual({ status: 409, body: { error: slugTakenMessage('leases-quiz') } })
    expect(writes()).toEqual([])
    expect(revalidated).toEqual([])
  })

  it('publishes when only similar addresses are used', async () => {
    db.tables.question_sets = [{ id: 'other', title: 'Leases quiz 2', slug: 'leases-quiz-2' }]
    expect(await publish({ bundle: bundle() })).toMatchObject({ status: 200, body: { slug: 'leases-quiz' } })
  })

  it('writes nothing when the address cannot be checked', async () => {
    db.fail = failOn('GET', 'question_sets', 'slug=eq.')
    expect(await publish({ bundle: bundle() })).toEqual({ status: 500, body: { error: SLUG_READ_FAILED } })
    expect(writes()).toEqual([])
  })
})
