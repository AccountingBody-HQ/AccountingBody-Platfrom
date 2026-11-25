import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_ADMIN_PATH, TEST_ADMIN_SECRET, TEST_SESSION_SECRET, signTestSession } from './admin-session-fixtures'
import { ADMIN_SESSION_COOKIE, getAdminPath } from './middleware-logic'
import {
  CASES_FAILED,
  EMPTY_ADDRESS,
  LEFT_DRAFT,
  LINK_FAILED,
  NOT_FOUND,
  PUBLISH_FAILED,
  SET_CHECK_FAILED,
  SET_READ_FAILED,
  SLUG_LOCKED,
  SLUG_READ_FAILED,
  UNLINK_FAILED,
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
type Call = { method: string; table: string; query: string; body: unknown; tagsBefore: number; publishedBefore: number }

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
  const publishedBefore = (db.tables.question_sets ?? []).filter((row) => row.status === 'published').length
  const call: Call = { method, table, query: decodeURIComponent(url.search), body, tagsBefore: revalidated.length, publishedBefore }
  db.calls.push(call)
  if (db.fail(call)) return json({ code: 'XX000', message: 'database detail', details: null, hint: null }, 500)
  if (table.startsWith('rpc/')) return json(db.rpc, 200)

  const headers = new Headers(init?.headers)
  const single = (headers.get('accept') ?? '').includes('vnd.pgrst.object')
  const rows = (db.tables[table] ??= [])
  const matches = (row: Row) =>
    Array.from(url.searchParams).every(([key, value]) => {
      if (value.startsWith('eq.')) return String(row[key]) === value.slice(3)
      if (value === 'is.null') return (row[key] ?? null) === null
      if (value.startsWith('in.('))return value.slice(4, -1).split(',').includes(String(row[key]))
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

const BROAD = ['question-sets', 'questions']

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

describe('import: an answer that cannot be read', () => {
  const paste = async (answer: unknown) => {
    const rawJson = JSON.stringify({ title: 'Leases quiz', questions: [{ ...question(), correctIndex: undefined, answer }] })
    const res = await (await api('questions/import/route.ts')).POST(request('POST', 'questions/import', { rawJson }), { params: {} })
    return (await res.json()) as { ready: boolean; warnings: string[]; validationErrors: string[]; bundle: Row }
  }

  it('is not ready, says why, and the publish route refuses the same bundle', async () => {
    const result = await paste('E')
    expect(result).toMatchObject({
      ready: false,
      warnings: ['Q1: could not work out the correct answer. Set it in the pasted text and paste again.'],
      validationErrors: ['Q1: correct answer not set'],
      bundle: { questions: [{ correctIndex: null }] },
    })
    expect(await publish({ bundle: result.bundle })).toEqual({
      status: 400,
      body: { error: 'Nothing was published. Please fix these questions first: Q1 needs one correct answer (A, B, C or D).' },
    })
    expect(db.calls).toEqual([])
  })

  it('is ready when the answer can be read', async () => {
    expect(await paste('C')).toMatchObject({ ready: true, warnings: [], validationErrors: [] })
  })

  it('the import page shows the warnings and disables Publish while not ready', () => {
    const source = readFileSync(join(process.cwd(), `app/${ADMIN}/questions/import/page.tsx`), 'utf8')
    expect(source).toContain('result.warnings.map(')
    expect(source).toContain('result.validationErrors.map(')
    expect(source).toContain('disabled={publishing || !result.ready || !metaTitle.trim()}')
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
  it.each([[''], ['   '], ['?!'], ['—'], [' - '], ['የሂሳብ'], ['የሂሳብ ጥያቄ'], ['会计']])('refuses a title that gives no address (%j)', async (title) => {
    expect(await publish({ bundle: bundle({ title }), articleSlug: 'leases' })).toEqual({ status: 400, body: { error: EMPTY_ADDRESS } })
    expect(db.calls).toEqual([])
    expect(revalidated).toEqual([])
  })

  it.each([
    ['7', '7'],
    ['የሂሳብ IAS 12', '-ias-12'],
    ['Leases quiz', 'leases-quiz'],
  ])('gives %j the same address as before', async (title, slug) => {
    expect(await publish({ bundle: bundle({ title }) })).toMatchObject({ status: 200, body: { slug } })
  })

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

describe('publish: an honest result', () => {
  const article = { slug: 'leases', content_id: 'AB-ART-00007', status: 'published', mcq_url: null }
  const scenario = bundle({
    questions: [question({ type: 'scenario', caseId: 'case-1' })],
    cases: [{ caseId: 'case-1', title: 'Case', exhibitHtml: '<p>Facts</p>' }],
  })
  const done = {
    success: true,
    documentId: SET_ID,
    contentId: 'AB-QZ-00001',
    title: 'Leases quiz',
    slug: 'leases-quiz',
    questionCount: 1,
  }

  it('checks, then writes in order, and the article points to the set', async () => {
    db.tables.articles = [{ ...article }]
    expect(await publish({ bundle: scenario, articleSlug: 'AB-ART-00007' })).toEqual({ status: 200, body: done })
    expect(lines().filter((line) => line.startsWith('GET'))).toHaveLength(4)
    expect(lines().slice(4)).toEqual([
      'POST question_sets',
      'POST questions',
      'POST question_cases',
      'PATCH question_sets',
      'PATCH articles',
    ])
    expect(db.tables.articles).toMatchObject([{ slug: 'leases', mcq_url: '/practice-questions/leases-quiz' }])
    expect(db.tables.questions).toMatchObject([{ set_id: SET_ID, question_order: 1, correct_index: 2, option_d: 'Four' }])
  })

  it('warns when no article row changed (found by ID, not published)', async () => {
    db.tables.articles = [{ ...article, status: 'draft' }]
    expect(await publish({ bundle: bundle(), articleSlug: 'AB-ART-00007' })).toEqual({
      status: 200,
      body: { ...done, linkWarning: LINK_FAILED },
    })
    expect(db.tables.articles).toMatchObject([{ mcq_url: null }])
  })

  it('warns when the article update fails, and the set stays published', async () => {
    db.tables.articles = [{ ...article }]
    db.fail = failOn('PATCH', 'articles')
    const result = await publish({ bundle: bundle(), articleSlug: 'leases' })
    expect(result).toEqual({ status: 200, body: { ...done, linkWarning: LINK_FAILED } })
    expect(JSON.stringify(result.body)).not.toContain('database detail')
    expect(writes()).toEqual(['POST question_sets', 'POST questions', 'PATCH question_sets', 'PATCH articles'])
    expect(db.tables.question_sets).toMatchObject([{ status: 'published' }])
  })

  it('warns when the case exhibits cannot be saved, and still links the article', async () => {
    db.tables.articles = [{ ...article }]
    db.fail = failOn('POST', 'question_cases')
    expect(await publish({ bundle: scenario, articleSlug: 'leases' })).toEqual({
      status: 200,
      body: { ...done, casesWarning: CASES_FAILED },
    })
    expect(db.tables.articles).toMatchObject([{ mcq_url: '/practice-questions/leases-quiz' }])
  })

  it('gives both warnings when both fail', async () => {
    db.tables.articles = [{ ...article }]
    db.fail = (call) => failOn('POST', 'question_cases')(call) || failOn('PATCH', 'articles')(call)
    expect(await publish({ bundle: scenario, articleSlug: 'leases' })).toEqual({
      status: 200,
      body: { ...done, linkWarning: LINK_FAILED, casesWarning: CASES_FAILED },
    })
  })

  it('removes the set again when its questions cannot be saved', async () => {
    db.tables.articles = [{ ...article }]
    db.fail = failOn('POST', 'questions')
    expect((await publish({ bundle: bundle(), articleSlug: 'leases' })).status).toBe(500)
    expect(writes()).toEqual(['POST question_sets', 'POST questions', 'DELETE question_sets'])
    expect(db.tables.question_sets).toEqual([])
    expect(db.tables.articles).toMatchObject([{ mcq_url: null }])
    expect(revalidated).toEqual([])
  })

  it('refreshes the public caches for the set and its article, after every write', async () => {
    db.tables.articles = [{ ...article }]
    await publish({ bundle: scenario, articleSlug: 'AB-ART-00007' })
    expect(revalidated).toEqual([...BROAD, 'question-set:leases-quiz', `question-set-id:${SET_ID}`, 'article:leases'])
    expect(db.calls.map((c) => c.tagsBefore)).toEqual(db.calls.map(() => 0))
  })

  it('refreshes the set but not the article when the link could not be saved', async () => {
    db.tables.articles = [{ ...article }]
    db.fail = failOn('PATCH', 'articles')
    await publish({ bundle: bundle(), articleSlug: 'leases' })
    expect(revalidated).toEqual([...BROAD, 'question-set:leases-quiz', `question-set-id:${SET_ID}`])
  })

  it('refreshes nothing when the set cannot be saved', async () => {
    db.fail = failOn('POST', 'question_sets')
    expect((await publish({ bundle: bundle() })).status).toBe(500)
    expect(revalidated).toEqual([])
  })

  it('publishes when the cases are not a list', async () => {
    expect((await publish({ bundle: bundle({ cases: { caseId: 'case-1' } }) })).status).toBe(200)
    expect(writes()).toEqual(['POST question_sets', 'POST questions', 'PATCH question_sets'])
  })

  it('saves a draft first, and publishes it once, after its parts', async () => {
    db.tables.articles = [{ ...article }]
    await publish({ bundle: scenario, articleSlug: 'leases' })
    const inserted = db.calls.find((c) => c.method === 'POST' && c.table === 'question_sets')?.body as Row
    expect(inserted.status).toBe('draft')
    expect(inserted.published_at ?? null).toBeNull()
    const updates = db.calls.filter((c) => c.method === 'PATCH' && c.table === 'question_sets')
    expect(updates).toHaveLength(1)
    expect(updates[0].query).toContain(`id=eq.${SET_ID}`)
    expect(updates[0].body).toEqual({ status: 'published', published_at: expect.stringMatching(/^\d{4}-\d\d-\d\dT/) })
    expect(db.tables.question_sets).toMatchObject([{ status: 'published', article_slug: 'leases' }])
    // Until then no published row exists.
    expect(db.calls.map((c) => `${c.table} ${c.publishedBefore}`).slice(-2)).toEqual(['question_sets 0', 'articles 1'])
  })

  describe.each<[string, string, string, string[], string]>([
    ['the questions cannot be saved', 'POST', 'questions', ['POST question_sets', 'POST questions'], 'database detail'],
    [
      'the set cannot be published',
      'PATCH',
      'question_sets',
      ['POST question_sets', 'POST questions', 'POST question_cases', 'PATCH question_sets'],
      PUBLISH_FAILED,
    ],
  ])('when %s', (_name, method, table, before, error) => {
    it('removes the draft, and nothing was ever published', async () => {
      db.tables.articles = [{ ...article }]
      db.fail = failOn(method, table)
      expect(await publish({ bundle: scenario, articleSlug: 'leases' })).toEqual({ status: 500, body: { error } })
      expect(writes()).toEqual([...before, 'DELETE question_sets'])
      expect(db.calls.at(-1)?.query).toBe(`?id=eq.${SET_ID}`)
      expect(db.calls.every((c) => c.publishedBefore === 0)).toBe(true)
      expect(db.tables.question_sets).toEqual([])
      expect(db.tables.articles).toMatchObject([{ mcq_url: null }])
      expect(revalidated).toEqual([])
    })

    it('says so when the draft cannot be removed, and only a draft is left', async () => {
      db.tables.articles = [{ ...article }]
      db.fail = (call) => failOn(method, table)(call) || failOn('DELETE', 'question_sets')(call)
      expect(await publish({ bundle: scenario, articleSlug: 'leases' })).toEqual({ status: 500, body: { error: LEFT_DRAFT } })
      expect(writes()).toEqual([...before, 'DELETE question_sets'])
      expect(db.calls.every((c) => c.publishedBefore === 0)).toBe(true)
      expect(db.tables.question_sets).toMatchObject([{ status: 'draft' }])
      expect(db.tables.articles).toMatchObject([{ mcq_url: null }])
      expect(revalidated).toEqual([])
      // The web address check still sees the draft that was left.
      db.fail = () => false
      expect(await publish({ bundle: bundle() })).toEqual({ status: 409, body: { error: slugTakenMessage('leases-quiz') } })
    })
  })

  it('treats "no set changed" as a failure to publish', async () => {
    db.fail = (call) => {
      if (call.method === 'PATCH' && call.table === 'question_sets') db.tables.question_sets = []
      return false
    }
    expect(await publish({ bundle: bundle() })).toEqual({ status: 500, body: { error: PUBLISH_FAILED } })
    expect(writes().at(-1)).toBe('DELETE question_sets')
    expect(revalidated).toEqual([])
  })

  it.each(['generate', 'import'])('the %s page shows both warnings in its success view', (name) => {
    const source = readFileSync(join(process.cwd(), `app/${ADMIN}/questions/${name}/page.tsx`), 'utf8')
    expect(source).toContain('setPublishWarnings([data.linkWarning, data.casesWarning].filter(Boolean))')
    expect(source.split('publishWarnings.map(')).toHaveLength(2)
    expect(source.indexOf('publishWarnings.map(')).toBeGreaterThan(source.search(/Published Successfully|Import Successful/))
  })
})

// ── Article lookup (Studio "Add by ID" and the importer) ────────────────────

describe('article lookup', () => {
  const lookup = async (id: string) =>
    (await api('articles/lookup/route.ts')).GET(request('GET', `articles/lookup?id=${id}`), { params: {} })

  it('gives every field Studio and the importer read', async () => {
    const article = {
      content_id: 'AB-ART-00007',
      title: 'Leases',
      slug: 'leases',
      excerpt: 'About leases.',
      category: 'financial-reporting',
      category_title: 'Financial Reporting',
      exam_body: ['cima'],
      difficulty: 'advanced',
    }
    db.tables.articles = [article]
    const res = await lookup('ab-art-00007')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ article })
    const select = new URLSearchParams(db.calls[0].query).get('select') ?? ''
    expect(select.split(',').sort()).toEqual(Object.keys(article).sort())
  })

  it('answers "not found" for an unknown ID, and refuses another kind of ID', async () => {
    expect((await lookup('AB-ART-99999')).status).toBe(404)
    expect((await lookup('AB-QZ-00001')).status).toBe(400)
  })
})

// ── Set editor and recycle bin ──────────────────────────────────────────────

const QUESTION = '7ab56afb-ff9b-4db5-9a5f-ec88f271466f'

type WriteCase = { name: string; call: () => Promise<Response>; write: string; table: string; tags: string[] }

async function setRoute(method: string, body: Row) {
  return (await api('questions/[setId]/route.ts'))[method](request(method, `questions/${SET_ID}`, body), {
    params: Promise.resolve({ setId: SET_ID }),
  })
}

const ID_TAG = `question-set-id:${SET_ID}`
const WRITES: WriteCase[] = [
  {
    name: 'set saved',
    call: () => setRoute('PATCH', { action: 'update_set', fields: { title: 'New title' } }),
    write: 'PATCH',
    table: 'question_sets',
    tags: ['question-set:leases-quiz', ID_TAG, 'article:leases'],
  },
  {
    name: 'set saved with a new address',
    call: () => setRoute('PATCH', { action: 'update_set', fields: { slug: 'leases-test' } }),
    write: 'PATCH',
    table: 'question_sets',
    tags: ['question-set:leases-quiz', 'question-set:leases-test', ID_TAG, 'article:leases'],
  },
  {
    name: 'question saved',
    call: () => setRoute('PATCH', { action: 'update_question', questionId: QUESTION, fields: { question_text: 'New?' } }),
    write: 'PATCH',
    table: 'questions',
    tags: [ID_TAG],
  },
  {
    name: 'set deleted',
    call: () => setRoute('DELETE', { action: 'delete_set' }),
    write: 'DELETE',
    table: 'question_sets',
    tags: ['question-set:leases-quiz', ID_TAG, 'article:leases'],
  },
  {
    name: 'question deleted',
    call: () => setRoute('DELETE', { action: 'delete_question', questionId: QUESTION }),
    write: 'DELETE',
    table: 'questions',
    tags: [ID_TAG],
  },
  {
    name: 'question added',
    call: () => setRoute('POST', { question_text: 'Another?' }),
    write: 'POST',
    table: 'questions',
    tags: [ID_TAG],
  },
]

describe('set editor: refreshes the public caches', () => {
  beforeEach(() => {
    db.tables.question_sets = [{ id: SET_ID, title: 'Leases quiz', slug: 'leases-quiz', article_slug: 'leases' }]
    db.tables.questions = [{ id: QUESTION, set_id: SET_ID, question_order: 1, question_text: 'Which one?' }]
  })

  it.each(WRITES)('$name: after the write', async ({ call, write, table, tags }) => {
    expect((await call()).status).toBe(200)
    expect(db.calls.filter((c) => c.method === write && c.table === table)).toHaveLength(1)
    expect(db.calls.every((c) => c.tagsBefore === 0)).toBe(true)
    expect(revalidated).toEqual([...BROAD, ...tags])
  })

  it.each(WRITES)('$name: not when the write fails', async ({ call, write, table }) => {
    db.fail = failOn(write, table)
    expect((await call()).status).toBe(500)
    expect(revalidated).toEqual([])
  })

  it.each(WRITES)('$name: not for a signed-out request', async ({ call }) => {
    session = 'not-a-session'
    expect((await call()).status).toBe(401)
    expect(db.calls).toEqual([])
    expect(revalidated).toEqual([])
  })

  it('saves the set when its old address cannot be read, and refreshes the broad tags', async () => {
    db.fail = failOn('GET', 'question_sets')
    expect((await WRITES[0].call()).status).toBe(200)
    expect(db.tables.question_sets).toMatchObject([{ title: 'New title' }])
    expect(revalidated).toEqual([...BROAD, ID_TAG])
  })

  it('refreshes nothing for a refused request', async () => {
    expect((await setRoute('PATCH', { action: 'unknown' })).status).toBe(400)
    expect((await setRoute('POST', { question_text: '' })).status).toBe(400)
    expect((await setRoute('DELETE', { action: 'delete_question' })).status).toBe(400)
    expect(revalidated).toEqual([])
  })
})

describe('recycle bin restore: refreshes the public caches', () => {
  const restore = async () =>
    (await api('recycle-bin/route.ts')).POST(request('POST', 'recycle-bin', { action: 'restore', id: SET_ID }), { params: {} })

  it.each([
    ['a question set', { question_sets: 1, questions: 10, question_cases: 2 }],
    ['a question', { questions: 1 }],
  ])('after %s is put back', async (_name, counts) => {
    db.rpc = counts
    const res = await restore()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, counts })
    expect(revalidated).toEqual(BROAD)
  })

  it('not after something else is put back', async () => {
    db.rpc = { courses: 1, course_chapters: 2 }
    expect((await restore()).status).toBe(200)
    expect(revalidated).toEqual([])
  })

  it('not when the restore fails', async () => {
    db.rpc = { question_sets: 1 }
    db.fail = (call) => call.table.startsWith('rpc/')
    expect((await restore()).status).toBe(500)
    expect(revalidated).toEqual([])
    expect(lines()).toEqual(['POST rpc/admin_recycle_restore'])
  })
})

// ── The article's link follows the set ──────────────────────────────────────

const HERE = '/practice-questions/leases-quiz'
const OTHER = '/practice-questions/another-set'
const articleLink = () => db.tables.articles[0].mcq_url
const articleTag = () => revalidated.filter((tag) => tag === 'article:leases').length
const withSet = (set: Row, mcqUrl: unknown, article: Row = {}) => {
  db.tables.question_sets = [{ id: SET_ID, title: 'Leases quiz', slug: 'leases-quiz', article_slug: 'leases', status: 'published', ...set }]
  db.tables.articles = [
    { slug: 'leases', status: 'published', mcq_url: mcqUrl, ...article },
    { slug: 'bystander', status: 'published', mcq_url: HERE },
  ]
}
const send = async (method: string, body: Row) => {
  const res = await setRoute(method, body)
  return { status: res.status, body: (await res.json()) as Row }
}
const patch = (fields: Row) => send('PATCH', { action: 'update_set', fields })

afterEach(() => {
  // Another article is never touched.
  const bystander = (db.tables.articles ?? []).find((row) => row.slug === 'bystander')
  if (bystander) expect(bystander.mcq_url).toBe(HERE)
})

describe('article link: a deleted set', () => {
  const remove = () => send('DELETE', { action: 'delete_set' })

  it.each(['published', 'draft'])('is no longer linked (article %s)', async (status) => {
    withSet({}, HERE, { status })
    expect(await remove()).toEqual({ status: 200, body: { success: true, binId: SET_ID } })
    expect(articleLink()).toBeNull()
    expect(writes().slice(-2)).toEqual(['DELETE question_sets', 'PATCH articles'])
    expect(articleTag()).toBe(1)
    expect(db.calls.every((c) => c.tagsBefore === 0)).toBe(true)
  })

  it.each([[OTHER], [null], ['']])('leaves another link alone (%j)', async (link) => {
    withSet({}, link)
    expect(await remove()).toEqual({ status: 200, body: { success: true, binId: SET_ID } })
    expect(articleLink()).toBe(link)
  })

  it('asks nothing of the articles when the set has none', async () => {
    withSet({ article_slug: null }, HERE)
    expect((await remove()).body).toEqual({ success: true, binId: SET_ID })
    expect(lines().filter((line) => line.endsWith(' articles'))).toEqual([])
    expect(articleLink()).toBe(HERE)
  })

  it('is deleted, and says so, when the link cannot be removed', async () => {
    withSet({}, HERE)
    db.fail = failOn('PATCH', 'articles')
    expect(await remove()).toEqual({ status: 200, body: { success: true, binId: SET_ID, unlinkWarning: UNLINK_FAILED } })
    expect(db.tables.question_sets).toEqual([])
    expect(revalidated).toContain('question-set:leases-quiz')
  })

  it('keeps the link when the set could not be deleted', async () => {
    withSet({}, HERE)
    db.fail = failOn('DELETE', 'question_sets')
    expect((await remove()).status).toBe(500)
    expect(articleLink()).toBe(HERE)
    expect(revalidated).toEqual([])
  })
})

describe('article link: a set changed to draft', () => {
  it('is no longer linked', async () => {
    withSet({}, HERE)
    expect(await patch({ title: 'Leases quiz', status: 'draft' })).toEqual({ status: 200, body: { success: true } })
    expect(articleLink()).toBeNull()
    expect(writes()).toEqual(['PATCH question_sets', 'PATCH articles'])
    expect(articleTag()).toBe(1)
    expect(db.calls.every((c) => c.tagsBefore === 0)).toBe(true)
  })

  it('saving the draft again repairs a link that stayed', async () => {
    withSet({ status: 'draft' }, HERE)
    expect((await patch({ status: 'draft' })).body).toEqual({ success: true })
    expect(articleLink()).toBeNull()
  })

  it.each([[OTHER], [null]])('leaves another link alone (%j)', async (link) => {
    withSet({}, link)
    expect((await patch({ status: 'draft' })).body).toEqual({ success: true })
    expect(articleLink()).toBe(link)
  })

  it('is saved, and says so, when the link cannot be removed', async () => {
    withSet({}, HERE)
    db.fail = failOn('PATCH', 'articles')
    expect(await patch({ status: 'draft' })).toEqual({ status: 200, body: { success: true, unlinkWarning: UNLINK_FAILED } })
    expect(db.tables.question_sets).toMatchObject([{ status: 'draft' }])
  })

  it('keeps the link when the set could not be saved', async () => {
    withSet({}, HERE)
    db.fail = failOn('PATCH', 'question_sets')
    expect((await patch({ status: 'draft' })).status).toBe(500)
    expect(articleLink()).toBe(HERE)
  })
})

describe('article link: a draft changed to published', () => {
  it.each([[null], ['']])('is linked when the article points nowhere (%j)', async (link) => {
    withSet({ status: 'draft', published_at: '2026-01-01T00:00:00Z' }, link)
    expect(await patch({ status: 'published' })).toEqual({ status: 200, body: { success: true } })
    expect(articleLink()).toBe(HERE)
    expect(writes()).toEqual(['PATCH question_sets', 'PATCH articles'])
    expect(articleTag()).toBe(1)
    expect(db.calls.every((c) => c.tagsBefore === 0)).toBe(true)
    expect(db.tables.question_sets).toMatchObject([{ status: 'published', published_at: '2026-01-01T00:00:00Z' }])
  })

  it('gets its first published date when it has none', async () => {
    withSet({ status: 'draft', published_at: null }, null)
    await patch({ status: 'published' })
    expect(db.tables.question_sets).toMatchObject([{ status: 'published', published_at: expect.stringMatching(/^\d{4}-\d\d-\d\dT/) }])
  })

  it.each([[OTHER], [HERE]])('leaves a link that is there alone (%j)', async (link) => {
    withSet({ status: 'draft' }, link)
    expect((await patch({ status: 'published' })).body).toEqual({ success: true })
    expect(articleLink()).toBe(link)
    expect(writes()).toEqual(['PATCH question_sets'])
  })

  it('does not put back a removed link when a published set is saved again', async () => {
    withSet({}, null)
    expect((await patch({ title: 'New title', status: 'published' })).body).toEqual({ success: true })
    expect(articleLink()).toBeNull()
    expect(db.tables.question_sets[0]).not.toHaveProperty('published_at')
  })

  it('does nothing to articles when the set has none', async () => {
    withSet({ status: 'draft', article_slug: null }, null)
    expect((await patch({ status: 'published' })).body).toEqual({ success: true })
    expect(lines().filter((line) => line.endsWith(' articles'))).toEqual([])
  })

  it.each([
    ['the article cannot be read', failOn('GET', 'articles')],
    ['the link cannot be saved', failOn('PATCH', 'articles')],
    [
      'no article changed',
      (call: Call) => {
        if (call.method === 'PATCH' && call.table === 'articles') db.tables.articles[0].mcq_url = OTHER
        return false
      },
    ],
  ])('is saved, and says so, when %s', async (_name, fail) => {
    withSet({ status: 'draft' }, null)
    db.fail = fail
    expect(await patch({ status: 'published' })).toEqual({ status: 200, body: { success: true, linkWarning: LINK_FAILED } })
    expect(db.tables.question_sets).toMatchObject([{ status: 'published' }])
    expect(articleLink()).not.toBe(HERE)
  })

  it('warns when the article is not published', async () => {
    withSet({ status: 'draft' }, null, { status: 'draft' })
    expect((await patch({ status: 'published' })).body).toEqual({ success: true, linkWarning: LINK_FAILED })
    expect(articleLink()).toBeNull()
  })
})

describe('article link: the web address of a set', () => {
  it.each([
    ['a published set', { status: 'published' }, { slug: 'new-address' }],
    ['a published set that becomes a draft', { status: 'published' }, { slug: 'new-address', status: 'draft' }],
    ['a draft that becomes published', { status: 'draft' }, { slug: 'new-address', status: 'published' }],
  ])('cannot change for %s', async (_name, set, fields) => {
    withSet(set, HERE)
    expect(await patch({ title: 'New title', ...fields })).toEqual({ status: 400, body: { error: SLUG_LOCKED } })
    expect(writes()).toEqual([])
    expect(revalidated).toEqual([])
    expect(db.tables.question_sets).toMatchObject([{ title: 'Leases quiz', slug: 'leases-quiz' }])
  })

  it('may be sent unchanged for a published set', async () => {
    withSet({}, HERE)
    expect((await patch({ title: 'New title', slug: 'leases-quiz' })).body).toEqual({ success: true })
    expect(db.tables.question_sets).toMatchObject([{ title: 'New title', slug: 'leases-quiz' }])
    expect(articleLink()).toBe(HERE)
  })

  it('changes for a draft, and the article follows', async () => {
    withSet({ status: 'draft' }, HERE)
    expect(await patch({ slug: 'new-address' })).toEqual({ status: 200, body: { success: true } })
    expect(db.tables.question_sets).toMatchObject([{ slug: 'new-address' }])
    expect(articleLink()).toBe('/practice-questions/new-address')
    expect(articleTag()).toBe(1)
  })

  it('changes for a draft, and leaves a different link alone', async () => {
    withSet({ status: 'draft' }, OTHER)
    expect((await patch({ slug: 'new-address' })).body).toEqual({ success: true })
    expect(articleLink()).toBe(OTHER)
  })

  it('says so when the article cannot follow', async () => {
    withSet({ status: 'draft' }, HERE)
    db.fail = failOn('PATCH', 'articles')
    expect((await patch({ slug: 'new-address' })).body).toEqual({ success: true, unlinkWarning: UNLINK_FAILED })
  })

  it.each([{ slug: 'new-address' }, { status: 'draft' }, { status: 'published' }])('saves nothing when the set cannot be read (%j)', async (fields) => {
    withSet({}, HERE)
    db.fail = failOn('GET', 'question_sets')
    expect(await patch(fields)).toEqual({ status: 500, body: { error: SET_CHECK_FAILED } })
    expect(writes()).toEqual([])
  })

  it('answers "not found" for a set that does not exist', async () => {
    expect(await patch({ title: 'New title' })).toEqual({ status: 404, body: { error: 'Question set not found' } })
    expect(writes()).toEqual([])
    expect(revalidated).toEqual([])
  })
})

describe('article link: a set that comes back from the recycle bin', () => {
  const BIN_ID = QUESTION
  const counts = { question_sets: 1, questions: 10 }
  const restore = async () => {
    const res = await (await api('recycle-bin/route.ts')).POST(request('POST', 'recycle-bin', { action: 'restore', id: BIN_ID }), { params: {} })
    return { status: res.status, body: (await res.json()) as Row }
  }
  beforeEach(() => {
    db.rpc = counts
    db.tables.admin_recycle_bin = [{ id: BIN_ID, kind: 'question_set', source_id: SET_ID }]
  })

  it.each([[null], ['']])('is linked again when the article points nowhere (%j)', async (link) => {
    withSet({}, link)
    expect(await restore()).toEqual({ status: 200, body: { success: true, counts } })
    expect(articleLink()).toBe(HERE)
    expect(revalidated).toEqual([...BROAD, 'question-set:leases-quiz', ID_TAG, 'article:leases'])
    expect(db.calls.every((c) => c.tagsBefore === 0)).toBe(true)
  })

  it('leaves an article that points to a different set alone', async () => {
    withSet({}, OTHER)
    expect((await restore()).body).toEqual({ success: true, counts })
    expect(articleLink()).toBe(OTHER)
    expect(writes()).toEqual(['POST rpc/admin_recycle_restore'])
  })

  it.each([{ status: 'draft' }, { article_slug: null }])('is not linked when there is nothing to link (%j)', async (set) => {
    withSet(set, null)
    expect((await restore()).body).toEqual({ success: true, counts })
    expect(articleLink()).toBeNull()
    expect(writes()).toEqual(['POST rpc/admin_recycle_restore'])
  })

  it.each([
    ['the item', failOn('GET', 'admin_recycle_bin')],
    ['the set', failOn('GET', 'question_sets')],
    ['the article', failOn('GET', 'articles')],
    ['the link', failOn('PATCH', 'articles')],
  ])('is back, and says so, when %s cannot be read or saved', async (_name, fail) => {
    withSet({}, null)
    db.fail = fail
    expect(await restore()).toEqual({ status: 200, body: { success: true, counts, linkWarning: LINK_FAILED } })
    expect(articleLink()).toBeNull()
    expect(revalidated.slice(0, 2)).toEqual(BROAD)
  })

  it('reads nothing more for a single question', async () => {
    db.rpc = { questions: 1 }
    expect((await restore()).body).toEqual({ success: true, counts: { questions: 1 } })
    expect(lines()).toEqual(['POST rpc/admin_recycle_restore'])
  })
})

describe('article link: the warnings are shown', () => {
  const source = (path: string) => readFileSync(join(process.cwd(), `app/${ADMIN}/${path}`), 'utf8')

  it('on the set editor page, for a save and for a delete', () => {
    const page = source('questions/[setId]/page.tsx')
    expect(page).toContain("data.unlinkWarning ?? data.linkWarning ?? ''")
    expect(page).toContain('setDeleteSetError(warning)')
    expect(page).toContain('setDeleteSetError(data.unlinkWarning)')
    expect(page).toContain('style={C.danger}>{deleteSetError}</div>')
  })

  it('on the recycle bin page', () => {
    const page = source('recycle-bin/page.tsx')
    expect(page).toContain('if (data.linkWarning) setRestoreError(data.linkWarning)')
    expect(page).toContain('style={C.danger}>{restoreError}</p>')
  })
})
