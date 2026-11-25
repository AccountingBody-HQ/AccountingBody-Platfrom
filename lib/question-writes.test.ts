import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_ADMIN_PATH, TEST_ADMIN_SECRET, TEST_SESSION_SECRET, signTestSession } from './admin-session-fixtures'
import { ADMIN_SESSION_COOKIE, getAdminPath } from './middleware-logic'
import {
  ALREADY_HAS_SET_PLAIN,
  BAD_ADDRESS,
  CASES_SAVE_FAILED,
  EMPTY_ADDRESS,
  LAST_QUESTION,
  LEFT_DRAFT,
  LINK_FAILED,
  NOT_FOUND,
  NOT_READY_EMPTY,
  PUBLISH_FAILED,
  RESTORED_AS_DRAFT,
  RESTORE_ARTICLE_TAKEN,
  RESTORE_CHECK_FAILED,
  SET_CHECK_FAILED,
  SET_READ_FAILED,
  SLUG_LOCKED,
  SLUG_READ_FAILED,
  UNLINK_FAILED,
  alreadyHasSetMessage,
  notLinkedOtherSetMessage,
  notReadyProblemsMessage,
  publishProblemsMessage,
  slugTakenEditMessage,
  slugTakenMessage,
} from './question-publish-checks'
import { DELETE_FAILED, RESTORE_FAILED, restoreMessage } from './recycle-bin'

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
  refuse: (() => null) as (call: Call) => { code: string; message: string } | null,
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
  const refused = db.refuse(call)
  if (refused) return json({ details: 'Key (x)=(database detail) already exists.', hint: null, ...refused }, 409)
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
  Object.assign(db, { tables: {}, fail: () => false, refuse: () => null, rpc: {}, calls: [] })
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

  it('is not ready when a scenario question misses its case, and the publish route refuses the same bundle', async () => {
    const rawJson = JSON.stringify({ title: 'Leases quiz', questions: [question({ correctIndex: 'C' }), question({ correctIndex: 'C', type: 'scenario', caseId: 'case-1' })] })
    const res = await (await api('questions/import/route.ts')).POST(request('POST', 'questions/import', { rawJson }), { params: {} })
    const result = (await res.json()) as Row
    expect(result).toMatchObject({ ready: false, warnings: [], validationErrors: ['Q2: refers to a missing case'] })
    expect(await publish({ bundle: result.bundle })).toEqual({
      status: 400,
      body: { error: 'Nothing was published. Please fix these questions first: Q2 refers to a missing case.' },
    })
    expect(db.calls).toEqual([])
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

  // The article's link points to a set that names another article, or none.
  const pointing = (mcq_url: unknown, sets: Row[] = [], over: Row = {}) => {
    db.tables.articles = [
      { ...article, mcq_url, ...over },
      { slug: 'bystander', status: 'published', mcq_url: HERE },
    ]
    db.tables.question_sets = sets
  }
  const basics = (over: Row = {}) => ({ id: 'other', title: 'Leases basics', slug: 'leases-basics', article_slug: 'another-article', status: 'published', ...over })
  const bystanderKept = () =>
    expect(db.tables.articles[1]).toEqual({ slug: 'bystander', status: 'published', mcq_url: HERE })

  it.each([
    ['published', {}, 'AB-ART-00007'],
    ['draft', { status: 'draft' }, 'leases'],
    ['archived', { status: 'archived' }, 'leases'],
    ['not tied to an article', { article_slug: null }, 'leases'],
    ['tied to an article that does not exist', { article_slug: 'gone' }, 'leases'],
  ])('refuses an article that points to another set (%s), names that set, and keeps the link', async (_name, over, articleSlug) => {
    pointing('/practice-questions/leases-basics', [basics(over)])
    expect(await publish({ bundle: bundle(), articleSlug })).toEqual({
      status: 409,
      body: { error: alreadyHasSetMessage('Leases basics') },
    })
    expect(writes()).toEqual([])
    expect(revalidated).toEqual([])
    expect(db.tables.articles[0].mcq_url).toBe('/practice-questions/leases-basics')
    bystanderKept()
  })

  it.each([
    '/practice-questions/leases-basics/',
    ' /practice-questions/leases-basics?from=article#top ',
    'https://accountingbody.com/practice-questions/leases-basics',
  ])('reads the link %j as that set too', async (link) => {
    pointing(link, [basics()])
    expect((await publish({ bundle: bundle(), articleSlug: 'leases' })).status).toBe(409)
    expect(writes()).toEqual([])
  })

  it('refuses an article that already points to the address of the new set', async () => {
    pointing('/practice-questions/leases-quiz', [basics({ slug: 'leases-quiz' })])
    expect(await publish({ bundle: bundle(), articleSlug: 'leases' })).toEqual({
      status: 409,
      body: { error: alreadyHasSetMessage('Leases basics') },
    })
  })

  it.each([[null], [''], ['/practice-questions/gone'], ['/practice-questions/leases-quiz'], ['/practice-questions/'], ['/quiz/leases-basics']])(
    'replaces a link that points to no set (%j)',
    async (link) => {
      pointing(link, [basics()])
      expect((await publish({ bundle: bundle(), articleSlug: 'leases' })).body).not.toHaveProperty('linkWarning')
      expect(db.tables.articles[0].mcq_url).toBe('/practice-questions/leases-quiz')
      bystanderKept()
    },
  )

  it('never replaces a link that was made meanwhile', async () => {
    for (const before of [null, '/practice-questions/gone']) {
      pointing(before, [basics()])
      db.fail = (call) => {
        if (call.method === 'PATCH' && call.table === 'question_sets') db.tables.articles[0].mcq_url = '/practice-questions/leases-basics'
        return false
      }
      expect(await publish({ bundle: bundle(), articleSlug: 'leases' })).toMatchObject({ status: 200, body: { linkWarning: LINK_FAILED } })
      expect(db.tables.articles[0].mcq_url).toBe('/practice-questions/leases-basics')
      bystanderKept()
    }
  })

  it('writes nothing when the set the article points to cannot be read', async () => {
    pointing('/practice-questions/leases-basics', [basics()])
    db.fail = failOn('GET', 'question_sets', 'slug=eq.leases-basics')
    expect(await publish({ bundle: bundle(), articleSlug: 'leases' })).toEqual({ status: 500, body: { error: SET_READ_FAILED } })
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
    ['Leases quiz', 'leases-quiz'],
    ['IAS 12 - part 2', 'ias-12-part-2'],
  ])('gives %j the same address as before', async (title, slug) => {
    expect(await publish({ bundle: bundle({ title }) })).toMatchObject({ status: 200, body: { slug } })
  })

  it.each([
    ['የሂሳብ IAS 12', 'ias-12'],
    ['IAS 12 የሂሳብ', 'ias-12'],
    ['-- Leases quiz --', 'leases-quiz'],
    [`${'a'.repeat(199)} b`, 'a'.repeat(199)],
  ])('gives %j an address without a hyphen at the start or end', async (title, slug) => {
    expect(await publish({ bundle: bundle({ title }) })).toMatchObject({ status: 200, body: { slug } })
    expect(db.tables.question_sets).toMatchObject([{ slug }])
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

  it('publishes a scenario set only when its cases are there, and makes no database request otherwise', async () => {
    const error = 'Nothing was published. Please fix these questions first: Q1 refers to a missing case.'
    for (const cases of [undefined, [], [{ caseId: 'case-2', exhibitHtml: '<p>Facts</p>' }], [{ caseId: 'case-1', exhibitHtml: ' ' }]]) {
      expect(await publish({ bundle: { ...scenario, cases } })).toEqual({ status: 400, body: { error } })
    }
    expect(db.calls).toEqual([])
    expect((await publish({ bundle: scenario })).status).toBe(200)
    expect(db.tables.question_cases).toMatchObject([{ set_id: SET_ID, case_id: 'case-1', exhibit_html: '<p>Facts</p>' }])
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
      'the case exhibits cannot be saved',
      'POST',
      'question_cases',
      ['POST question_sets', 'POST questions', 'POST question_cases'],
      CASES_SAVE_FAILED,
    ],
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

  it.each(['generate', 'import'])('the %s page shows the link warning in its success view', (name) => {
    const source = readFileSync(join(process.cwd(), `app/${ADMIN}/questions/${name}/page.tsx`), 'utf8')
    expect(source).toContain('setPublishWarnings([data.linkWarning].filter(Boolean))')
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

// A complete question, as it is stored.
const storedQuestion = (over: Row = {}): Row => ({
  id: QUESTION,
  set_id: SET_ID,
  question_order: 1,
  type: 'multiple-choice',
  question_text: 'Which one?',
  option_a: 'One',
  option_b: 'Two',
  option_c: 'Three',
  option_d: 'Four',
  correct_index: 2,
  explanation: 'Because.',
  writing_model_answer: null,
  case_id: null,
  ...over,
})
// A complete question, as the set editor adds it.
const newQuestion = (over: Row = {}): Row => ({
  question_text: 'Another?',
  option_a: 'One',
  option_b: 'Two',
  option_c: 'Three',
  option_d: 'Four',
  correct_index: 0,
  explanation: 'Because.',
  ...over,
})

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
    call: () => setRoute('POST', newQuestion()),
    write: 'POST',
    table: 'questions',
    tags: [ID_TAG],
  },
]

describe('set editor: refreshes the public caches', () => {
  beforeEach(() => {
    db.tables.question_sets = [{ id: SET_ID, title: 'Leases quiz', slug: 'leases-quiz', article_slug: 'leases' }]
    db.tables.questions = [storedQuestion()]
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
const anotherSet = (): Row => ({ id: OTHER_SET, title: 'Leases basics', slug: 'another-set', article_slug: 'another-article', status: 'draft' })
const articleLink = () => db.tables.articles[0].mcq_url
const articleTag = () => revalidated.filter((tag) => tag === 'article:leases').length
const withSet = (set: Row, mcqUrl: unknown, article: Row = {}) => {
  db.tables.question_sets = [{ id: SET_ID, title: 'Leases quiz', slug: 'leases-quiz', article_slug: 'leases', status: 'published', ...set }]
  db.tables.articles = [
    { slug: 'leases', status: 'published', mcq_url: mcqUrl, ...article },
    { slug: 'bystander', status: 'published', mcq_url: HERE },
  ]
  db.tables.questions = [storedQuestion()]
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

  const goesLive = async (link: string, note: Row) => {
    withSet({ status: 'draft' }, link)
    db.tables.question_sets.push(anotherSet())
    expect(await patch({ status: 'published' })).toEqual({ status: 200, body: { success: true, ...note } })
    expect(articleLink()).toBe(link)
    expect(db.tables.question_sets).toMatchObject([{ status: 'published' }, anotherSet()])
    expect(writes()).toEqual(['PATCH question_sets'])
  }

  it.each([HERE, `${HERE}/`, `https://accountingbody.com${HERE}?from=article`])('leaves a link to it alone, and says nothing (%j)', async (link) => {
    await goesLive(link, {})
  })

  it.each([OTHER, ` ${OTHER}/ `, `https://accountingbody.com${OTHER}`])('leaves a link to another set alone, and names that set (%j)', async (link) => {
    await goesLive(link, { linkNote: notLinkedOtherSetMessage('Leases basics') })
  })

  it.each(['/practice-questions/gone', '/quiz/leases', 'https://example.com/'])('leaves a link that is no set alone, and says the article does not point to it (%j)', async (link) => {
    await goesLive(link, { linkWarning: LINK_FAILED })
  })

  it('says the article does not point to it when the other set cannot be read', async () => {
    withSet({ status: 'draft' }, OTHER)
    db.tables.question_sets.push(anotherSet())
    db.fail = failOn('GET', 'question_sets', 'slug=eq.another-set')
    expect(await patch({ status: 'published' })).toEqual({ status: 200, body: { success: true, linkWarning: LINK_FAILED } })
    expect(articleLink()).toBe(OTHER)
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

// ── The set editor makes the same structural checks ─────────────────────────

const OTHER_QUESTION = '2c5e39cb-3fb2-12e3-994f-1127e4ddb538'
const OTHER_SET = '5d0f3a0e-6f0b-4b52-9f3c-3f1f7a6f2a11'
const refusedWithoutWrite = () => {
  expect(writes()).toEqual([])
  expect(revalidated).toEqual([])
}

describe('set editor: a question that is edited', () => {
  const edit = (fields: Row, questionId = QUESTION) => send('PATCH', { action: 'update_question', questionId, fields })

  it.each<[string, Row, Row, string]>([
    ['loses its text', {}, { question_text: '  ' }, 'needs question text'],
    ['loses an option', {}, { option_c: '' }, 'has an empty answer option'],
    ['gets a null option', {}, { option_c: null }, 'has an empty answer option'],
    ['gets a placeholder', {}, { option_d: 'Option D' }, 'has a placeholder answer option'],
    ['gets two equal options', {}, { option_b: 'one ' }, 'has two answer options that are the same'],
    ['loses its answer', {}, { correct_index: null }, 'needs one correct answer (A, B, C or D)'],
    ['gets an answer past D', {}, { correct_index: 4 }, 'needs one correct answer (A, B, C or D)'],
    ['loses its explanation', {}, { explanation: '' }, 'needs an explanation'],
    ['never had an answer, and gets another text', { correct_index: null }, { question_text: 'New?' }, 'needs one correct answer (A, B, C or D)'],
    ['is a writing question and loses its model answer', { type: 'writing', writing_model_answer: 'Text.' }, { writing_model_answer: '' }, 'needs a model answer'],
    ['has two faults', {}, { option_c: '', explanation: '' }, 'has an empty answer option; needs an explanation'],
  ])('is not saved when it %s', async (_name, stored, fields, reason) => {
    withSet({}, HERE)
    db.tables.questions = [storedQuestion(stored)]
    expect(await edit(fields)).toEqual({ status: 400, body: { error: `Nothing was saved. Please fix this question first: ${reason}.` } })
    expect(db.tables.questions).toEqual([storedQuestion(stored)])
    refusedWithoutWrite()
  })

  it.each<[string, Row, Row]>([
    ['one part changes', {}, { option_c: 'Other' }],
    ['the edit completes it', { explanation: null, correct_index: null }, { explanation: 'Because.', correct_index: 3 }],
    ['it is a writing question', { type: 'writing', writing_model_answer: 'Text.', option_a: '', option_b: '', option_c: '', option_d: '', correct_index: null, explanation: null }, { question_text: 'Discuss.' }],
    ['its case is missing, which an edit cannot repair', { type: 'scenario', case_id: 'case-1' }, { question_text: 'New?' }],
  ])('is saved when %s', async (_name, stored, fields) => {
    withSet({}, HERE)
    db.tables.questions = [storedQuestion(stored), storedQuestion({ id: OTHER_QUESTION })]
    expect(await edit(fields)).toEqual({ status: 200, body: { success: true } })
    expect(db.tables.questions).toEqual([{ ...storedQuestion(stored), ...fields }, storedQuestion({ id: OTHER_QUESTION })])
    expect(writes()).toEqual(['PATCH questions'])
  })

  it.each<[string, Row[]]>([
    ['no question', []],
    ['the question of another set', [storedQuestion({ set_id: OTHER_SET })]],
  ])('answers "not found" for %s', async (_name, questions) => {
    withSet({}, HERE)
    db.tables.questions = questions
    expect(await edit({ question_text: 'New?' })).toEqual({ status: 404, body: { error: 'Question not found' } })
    refusedWithoutWrite()
  })

  it('answers "not found" when the question went away meanwhile', async () => {
    withSet({}, HERE)
    db.fail = (call) => {
      if (call.method === 'PATCH' && call.table === 'questions') db.tables.questions = []
      return false
    }
    expect((await edit({ question_text: 'New?' })).status).toBe(404)
    expect(revalidated).toEqual([])
  })

  it('is not saved when it cannot be read', async () => {
    withSet({}, HERE)
    db.fail = failOn('GET', 'questions')
    expect(await edit({ question_text: 'New?' })).toEqual({ status: 500, body: { error: SET_CHECK_FAILED } })
    refusedWithoutWrite()
  })

  it('does not change its type or its set', async () => {
    withSet({}, HERE)
    await edit({ type: 'writing', set_id: OTHER_SET, question_text: 'New?' })
    expect(db.tables.questions).toEqual([storedQuestion({ question_text: 'New?' })])
  })
})

describe('set editor: a question that is added', () => {
  it.each<[string, Row, string]>([
    ['blank text', { question_text: '  ' }, 'needs question text'],
    ['no options', { option_a: undefined, option_b: undefined, option_c: undefined, option_d: undefined }, 'has an empty answer option'],
    ['a placeholder', { option_a: '—' }, 'has a placeholder answer option'],
    ['equal options', { option_a: 'Two' }, 'has two answer options that are the same'],
    ['no answer', { correct_index: undefined }, 'needs one correct answer (A, B, C or D)'],
    ['a null answer', { correct_index: null }, 'needs one correct answer (A, B, C or D)'],
    ['no explanation', { explanation: undefined }, 'needs an explanation'],
    ['writing without a model answer', { type: 'writing', writing_model_answer: ' ' }, 'needs a model answer'],
  ])('is refused with %s', async (_name, over, reason) => {
    withSet({}, HERE)
    expect(await send('POST', newQuestion(over))).toEqual({
      status: 400,
      body: { error: `Nothing was saved. Please fix this question first: ${reason}.` },
    })
    expect(db.tables.questions).toHaveLength(1)
    refusedWithoutWrite()
  })

  it.each<[string, Row]>([
    ['a multiple-choice question', {}],
    ['a scenario question', { type: 'scenario' }],
    ['a writing question', { type: 'writing', writing_model_answer: 'Text.', option_a: '', option_b: '', option_c: '', option_d: '' }],
  ])('adds %s', async (_name, over) => {
    withSet({}, HERE)
    expect((await send('POST', newQuestion(over))).status).toBe(200)
    expect(db.tables.questions).toHaveLength(2)
    expect(db.tables.questions[1]).toMatchObject({ set_id: SET_ID, question_order: 2, question_text: 'Another?' })
  })

  it('keeps the answer for a question without text', async () => {
    withSet({}, HERE)
    expect(await send('POST', newQuestion({ question_text: '' }))).toEqual({ status: 400, body: { error: 'question_text is required' } })
  })
})

describe('set editor: a draft that is published', () => {
  const draft = (questions: Row[], cases: Row[] = []) => {
    withSet({ status: 'draft' }, null)
    db.tables.questions = questions
    db.tables.question_cases = cases
  }
  const stillDraft = () => {
    expect(db.tables.question_sets).toMatchObject([{ status: 'draft', title: 'Leases quiz' }])
    expect(articleLink()).toBeNull()
    refusedWithoutWrite()
  }
  const go = () => patch({ title: 'New title', status: 'published' })

  it('is refused without questions, also when another set has some', async () => {
    draft([storedQuestion({ set_id: OTHER_SET })])
    expect(await go()).toEqual({ status: 400, body: { error: NOT_READY_EMPTY } })
    stillDraft()
  })

  it('is refused with the exact list', async () => {
    draft([storedQuestion(), storedQuestion({ option_b: '', explanation: null }), storedQuestion({ correct_index: null })])
    expect(await go()).toEqual({
      status: 400,
      body: {
        error:
          'Nothing was saved. This set cannot go live yet. Please fix these questions first: Q2 has an empty answer option; Q2 needs an explanation; Q3 needs one correct answer (A, B, C or D).',
      },
    })
    stillDraft()
  })

  it('reads the questions in the order the page shows them', async () => {
    draft([storedQuestion()])
    await go()
    expect(db.calls.find((c) => c.method === 'GET' && c.table === 'questions')?.query).toContain('order=question_order.asc')
  })

  it.each<[string, Row[]]>([
    ['no case', []],
    ['another case', [{ set_id: SET_ID, case_id: 'case-2', exhibit_html: '<p>Facts</p>' }]],
    ['an empty case', [{ set_id: SET_ID, case_id: 'case-1', exhibit_html: '' }]],
    ['the case of another set', [{ set_id: OTHER_SET, case_id: 'case-1', exhibit_html: '<p>Facts</p>' }]],
  ])('is refused when a scenario question finds %s', async (_name, cases) => {
    draft([storedQuestion({ type: 'scenario', case_id: 'case-1' })], cases)
    expect(await go()).toEqual({
      status: 400,
      body: { error: notReadyProblemsMessage([{ n: 1, reason: 'missing-case' }]) },
    })
    stillDraft()
  })

  it.each<[string, Row[]]>([
    ['a scenario question with its case', [storedQuestion({ type: 'scenario', case_id: 'case-1' })]],
    ['a scenario question without one', [storedQuestion({ type: 'scenario' })]],
    ['a writing question', [storedQuestion({ type: 'writing', writing_model_answer: 'Text.', option_a: '', correct_index: null, explanation: null })]],
  ])('goes live with %s', async (_name, questions) => {
    draft(questions, [{ set_id: SET_ID, case_id: 'case-1', exhibit_html: '<p>Facts</p>' }])
    expect(await go()).toEqual({ status: 200, body: { success: true } })
    expect(db.tables.question_sets).toMatchObject([{ status: 'published', title: 'New title' }])
    expect(articleLink()).toBe(HERE)
  })

  it.each(['questions', 'question_cases'])('is refused when its %s cannot be read', async (table) => {
    draft([storedQuestion()])
    db.fail = failOn('GET', table)
    expect(await go()).toEqual({ status: 500, body: { error: SET_CHECK_FAILED } })
    stillDraft()
  })

  it.each<[string, Row, Row]>([
    ['a live set that is saved again', { status: 'published' }, { title: 'New title', status: 'published' }],
    ['a live set that becomes a draft', { status: 'published' }, { status: 'draft' }],
    ['a draft that stays one', { status: 'draft' }, { status: 'draft' }],
  ])('asks nothing of %s', async (_name, set, fields) => {
    withSet(set, HERE)
    db.tables.questions = []
    expect((await patch(fields)).status).toBe(200)
    expect(lines().filter((line) => line.startsWith('GET question') && line !== 'GET question_sets')).toEqual([])
  })
})

describe('set editor: a question that is deleted', () => {
  const remove = (questionId = QUESTION) => send('DELETE', { action: 'delete_question', questionId })

  it('is kept when it is the last one of a live set', async () => {
    withSet({}, HERE)
    db.tables.questions = [storedQuestion(), storedQuestion({ id: OTHER_QUESTION, set_id: OTHER_SET })]
    expect(await remove()).toEqual({ status: 400, body: { error: LAST_QUESTION } })
    expect(db.tables.questions).toHaveLength(2)
    expect(db.tables.admin_recycle_bin ?? []).toEqual([])
    refusedWithoutWrite()
  })

  it.each<[string, Row, Row[]]>([
    ['not the last one of a live set', {}, [storedQuestion(), storedQuestion({ id: OTHER_QUESTION })]],
    ['the last one of a draft', { status: 'draft' }, [storedQuestion()]],
  ])('goes when it is %s', async (_name, set, questions) => {
    withSet(set, null)
    db.tables.questions = questions
    expect(await remove()).toEqual({ status: 200, body: { success: true, binId: SET_ID } })
    expect(db.tables.questions.map((q) => q.id)).not.toContain(QUESTION)
    expect(writes()[0]).toBe('POST admin_recycle_bin')
    expect(writes().at(-1)).toBe('DELETE questions')
  })

  it.each<[string, Row[]]>([
    ['no question', []],
    ['the question of another set', [storedQuestion({ set_id: OTHER_SET })]],
    ['a question that is not the only one', [storedQuestion({ id: OTHER_QUESTION })]],
  ])('answers "not found" for %s', async (_name, questions) => {
    withSet({}, HERE)
    db.tables.questions = questions
    expect(await remove()).toEqual({ status: 404, body: { error: 'Question not found' } })
    expect(db.tables.questions).toEqual(questions)
    refusedWithoutWrite()
  })

  it.each(['question_sets', 'questions'])('is kept when the %s cannot be read', async (table) => {
    withSet({}, HERE)
    db.fail = failOn('GET', table)
    expect(await remove()).toEqual({ status: 500, body: { error: DELETE_FAILED } })
    expect(db.tables.questions).toHaveLength(1)
    refusedWithoutWrite()
  })
})

describe('set editor: the page shows the answer as it is given', () => {
  const page = () => readFileSync(join(process.cwd(), `app/${ADMIN}/questions/[setId]/page.tsx`), 'utf8')

  it('for a saved question, an added question, a saved set and a deleted question', () => {
    const source = page()
    for (const fallback of ['Save failed', 'Failed to add question', 'Delete failed']) {
      expect(source).toContain(`throw new Error(data.error || '${fallback}')`)
    }
    expect(source.split('style={C.danger}>{error}</div>')).toHaveLength(4)
  })

  it('opens the row when a delete is refused, because the message is inside it', () => {
    const source = page()
    const start = source.indexOf('async function handleDelete()')
    expect(source.slice(start, source.indexOf('finally', start))).toContain('setExpanded(true)')
  })

  it('never sends an answer that nobody chose', () => {
    expect(page()).toContain('fields.correct_index = draft.correct_index ?? null')
  })
})

// ── The database's own rules ────────────────────────────────────────────────

const unique = (name: string) => ({ code: '23505', message: `duplicate key value violates unique constraint "${name}"` })
const check = (name: string) => ({ code: '23514', message: `new row for relation "questions" violates check constraint "${name}"` })
type Refusal = { code: string; message: string }
// The first `times` matching writes are refused by the database.
const refuseOn = (method: string, table: string, refusal: Refusal, times = Infinity) => {
  let left = times
  db.refuse = (call) => (call.method === method && call.table === table && left-- > 0 ? refusal : null)
}
const NEEDS_ANSWER = 'Nothing was saved. Please fix this question first: needs one correct answer (A, B, C or D).'
const plain = (body: Row) => expect(JSON.stringify(body)).not.toMatch(/constraint|duplicate key|database detail|_key|_range/)

describe('a write the database refuses: publish', () => {
  it.each<[string, string, number, string]>([
    ['the web address', 'question_sets_slug_key', 409, slugTakenMessage('leases-quiz')],
    ['the article', 'question_sets_article_slug_key', 409, ALREADY_HAS_SET_PLAIN],
  ])('answers a plain sentence when %s is taken meanwhile, and writes nothing', async (_name, rule, status, error) => {
    db.tables.articles = [{ slug: 'leases', status: 'published', mcq_url: null }]
    refuseOn('POST', 'question_sets', unique(rule))
    const result = await publish({ bundle: bundle(), articleSlug: 'leases' })
    expect(result).toEqual({ status, body: { error } })
    plain(result.body)
    expect(writes()).toEqual(['POST question_sets'])
    expect(db.tables.question_sets ?? []).toEqual([])
    expect(db.tables.articles[0].mcq_url).toBeNull()
    expect(revalidated).toEqual([])
  })

  const last = { id: 'other', slug: 'other', content_id: 'AB-QZ-00041' }

  it('takes the next content ID, once, when the number is taken meanwhile', async () => {
    db.tables.question_sets = [last]
    refuseOn('POST', 'question_sets', unique('question_sets_content_id_key'), 1)
    expect(await publish({ bundle: bundle() })).toMatchObject({ status: 200, body: { contentId: 'AB-QZ-00043' } })
    const tried = db.calls.filter((c) => c.method === 'POST' && c.table === 'question_sets').map((c) => c.body as Row)
    expect(tried.map((row) => row.content_id)).toEqual(['AB-QZ-00042', 'AB-QZ-00043'])
    expect({ ...tried[1], content_id: null }).toEqual({ ...tried[0], content_id: null })
    expect(db.tables.question_sets).toMatchObject([last, { content_id: 'AB-QZ-00043', status: 'published' }])
  })

  it('answers the existing sentence when the next number is taken too', async () => {
    db.tables.question_sets = [last]
    refuseOn('POST', 'question_sets', unique('question_sets_content_id_key'))
    const result = await publish({ bundle: bundle() })
    expect(result).toEqual({ status: 500, body: { error: 'Could not assign a content ID. Nothing was published.' } })
    expect(writes()).toEqual(['POST question_sets', 'POST question_sets'])
    expect(db.tables.question_sets).toEqual([last])
    expect(revalidated).toEqual([])
  })

  it('answers the address sentence when the second try finds the address taken', async () => {
    let tries = 0
    db.refuse = (call) =>
      call.method === 'POST' && call.table === 'question_sets'
        ? unique(tries++ === 0 ? 'question_sets_content_id_key' : 'question_sets_slug_key')
        : null
    expect(await publish({ bundle: bundle() })).toEqual({ status: 409, body: { error: slugTakenMessage('leases-quiz') } })
    expect(writes()).toEqual(['POST question_sets', 'POST question_sets'])
  })

  it('removes the draft when a stored answer is outside A to D', async () => {
    refuseOn('POST', 'questions', check('questions_correct_index_range'))
    const result = await publish({ bundle: bundle() })
    expect(result).toEqual({ status: 400, body: { error: NEEDS_ANSWER } })
    plain(result.body)
    expect(writes()).toEqual(['POST question_sets', 'POST questions', 'DELETE question_sets'])
    expect(db.tables.question_sets).toEqual([])
  })

  it('says so when that draft cannot be removed', async () => {
    refuseOn('POST', 'questions', check('questions_correct_index_range'))
    db.fail = failOn('DELETE', 'question_sets')
    expect(await publish({ bundle: bundle() })).toEqual({ status: 500, body: { error: LEFT_DRAFT } })
  })

  it.each<[string, Refusal]>([
    ['another rule', unique('question_sets_pkey')],
    ['another code', { code: '23503', message: 'violates foreign key constraint "question_sets_slug_key"' }],
    ['no rule named', { code: '23505', message: 'duplicate key' }],
  ])('keeps its answer for any other refusal (%s)', async (_name, refusal) => {
    refuseOn('POST', 'question_sets', refusal)
    expect(await publish({ bundle: bundle() })).toEqual({ status: 500, body: { error: refusal.message } })
    expect(writes()).toEqual(['POST question_sets'])
  })
})

describe('a write the database refuses: set editor', () => {
  it('answers a plain sentence when the new address is taken meanwhile', async () => {
    withSet({ status: 'draft', published_at: null }, HERE)
    refuseOn('PATCH', 'question_sets', unique('question_sets_slug_key'))
    const result = await patch({ slug: 'new-address' })
    expect(result).toEqual({ status: 409, body: { error: slugTakenEditMessage('new-address') } })
    plain(result.body)
    expect(articleLink()).toBe(HERE)
    expect(revalidated).toEqual([])
  })

  it('answers a plain sentence for a stored answer outside A to D, edited or added', async () => {
    withSet({}, HERE)
    db.tables.questions = [storedQuestion({ type: 'writing', writing_model_answer: 'Text.' })]
    refuseOn('PATCH', 'questions', check('questions_correct_index_range'))
    expect(await send('PATCH', { action: 'update_question', questionId: QUESTION, fields: { correct_index: 9 } })).toEqual({
      status: 400,
      body: { error: NEEDS_ANSWER },
    })
    refuseOn('POST', 'questions', check('questions_correct_index_range'))
    expect(await send('POST', newQuestion())).toEqual({ status: 400, body: { error: NEEDS_ANSWER } })
    expect(revalidated).toEqual([])
  })

  it('keeps its answer for any other refusal', async () => {
    withSet({}, HERE)
    const refusal = unique('another_rule')
    for (const [method, table, body] of [
      ['PATCH', 'question_sets', { action: 'update_set', fields: { title: 'New title' } }],
      ['PATCH', 'questions', { action: 'update_question', questionId: QUESTION, fields: { question_text: 'New?' } }],
      ['POST', 'questions', newQuestion()],
    ] as [string, string, Row][]) {
      refuseOn(method, table, refusal)
      expect(await send(method, body)).toEqual({ status: 500, body: { error: refusal.message } })
    }
  })
})

describe('article link: the web address of a set', () => {
  it.each([
    ['a published set', { status: 'published' }, { slug: 'new-address' }],
    ['a published set that becomes a draft', { status: 'published' }, { slug: 'new-address', status: 'draft' }],
    ['a draft that becomes published', { status: 'draft' }, { slug: 'new-address', status: 'published' }],
    ['a draft that was published before', { status: 'draft', published_at: '2026-01-01T00:00:00Z' }, { slug: 'new-address' }],
    ['a draft that was published before and stays one', { status: 'draft', published_at: '2026-01-01T00:00:00Z' }, { slug: 'new-address', status: 'draft' }],
    ['a set of another status that was published before', { status: 'archived', published_at: '2026-01-01T00:00:00Z' }, { slug: '' }],
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

  it('may be sent unchanged for a draft that was published before', async () => {
    withSet({ status: 'draft', published_at: '2026-01-01T00:00:00Z' }, null)
    expect((await patch({ title: 'New title', slug: 'leases-quiz' })).body).toEqual({ success: true })
    expect(db.tables.question_sets).toMatchObject([{ title: 'New title', published_at: '2026-01-01T00:00:00Z' }])
  })

  it('is locked for a new set that is published and then made a draft', async () => {
    db.tables.articles = []
    await publish({ bundle: bundle() })
    expect((await patch({ status: 'draft' })).body).toEqual({ success: true })
    expect(await patch({ slug: 'new-address' })).toEqual({ status: 400, body: { error: SLUG_LOCKED } })
    expect(db.tables.question_sets).toMatchObject([{ status: 'draft', slug: 'leases-quiz' }])
  })

  it.each<[string, Row, string]>([
    ['its creation date', { created_at: '2025-05-05T00:00:00Z' }, '2025-05-05T00:00:00Z'],
    ['the date of the change', {}, expect.stringMatching(/^\d{4}-\d\d-\d\dT/)],
  ])('is locked for a live set without a published date that becomes a draft, which gets %s', async (_name, set, date) => {
    withSet({ ...set, published_at: null }, HERE)
    expect((await patch({ status: 'draft' })).body).toEqual({ success: true })
    expect(db.tables.question_sets).toMatchObject([{ status: 'draft', published_at: date }])
    expect(await patch({ slug: 'new-address' })).toEqual({ status: 400, body: { error: SLUG_LOCKED } })
  })

  it('a live set that stays live gets no date, and a draft that stays one neither', async () => {
    for (const status of ['published', 'draft']) {
      withSet({ status, published_at: null, created_at: '2025-05-05T00:00:00Z' }, HERE)
      await patch({ title: 'New title', status })
      expect(db.tables.question_sets).toMatchObject([{ title: 'New title', published_at: null }])
    }
  })

  it('changes for a draft that was never published, and the article follows', async () => {
    withSet({ status: 'draft', published_at: null }, HERE)
    expect(await patch({ slug: 'new-address' })).toEqual({ status: 200, body: { success: true } })
    expect(db.tables.question_sets).toMatchObject([{ slug: 'new-address' }])
    expect(articleLink()).toBe('/practice-questions/new-address')
    expect(articleTag()).toBe(1)
  })

  it.each<[string, unknown]>([
    ['empty', ''],
    ['only spaces', '   '],
    ['null', null],
    ['a number', 7],
    ['a list', ['new-address']],
    ['capitals', 'New-address'],
    ['a space', 'new address'],
    ['a slash', 'new/address'],
    ['a dot', 'new.address'],
    ['an underscore', 'new_address'],
    ['two hyphens', 'new--address'],
    ['a hyphen first', '-new'],
    ['a hyphen last', 'new-'],
    ['only a hyphen', '-'],
    ['another alphabet', 'የሂሳብ'],
    ['an accent', 'café'],
    ['a line end', 'new\n'],
    ['201 characters', 'a'.repeat(201)],
  ])('is refused for a draft when it is odd: %s', async (_name, slug) => {
    withSet({ status: 'draft', published_at: null }, HERE)
    expect(await patch({ title: 'New title', slug })).toEqual({ status: 400, body: { error: BAD_ADDRESS } })
    expect(db.tables.question_sets).toMatchObject([{ title: 'Leases quiz', slug: 'leases-quiz' }])
    expect(articleLink()).toBe(HERE)
    refusedWithoutWrite()
  })

  it.each(['7', 'a', 'ias-12', 'new-address-2', 'a'.repeat(200)])('may be %s', async (slug) => {
    withSet({ status: 'draft', published_at: null }, HERE)
    expect(await patch({ slug })).toEqual({ status: 200, body: { success: true } })
    expect(db.tables.question_sets).toMatchObject([{ slug }])
    expect(articleLink()).toBe(`/practice-questions/${slug}`)
  })

  it('is not checked when it does not change, so an older odd one stays', async () => {
    withSet({ status: 'draft', published_at: null, slug: '-ias-12' }, null)
    expect(await patch({ title: 'New title', slug: '-ias-12' })).toEqual({ status: 200, body: { success: true } })
    expect(db.tables.question_sets).toMatchObject([{ title: 'New title', slug: '-ias-12' }])
  })

  it.each(['published', 'draft', 'archived'])('is refused for a draft when another set uses it (%s)', async (status) => {
    withSet({ status: 'draft', published_at: null }, HERE)
    db.tables.question_sets.push({ ...anotherSet(), status })
    expect(await patch({ slug: 'another-set' })).toEqual({
      status: 409,
      body: { error: 'Nothing was saved. Another practice set already uses the web address /practice-questions/another-set.' },
    })
    expect(db.tables.question_sets).toMatchObject([{ slug: 'leases-quiz' }, { slug: 'another-set' }])
    expect(articleLink()).toBe(HERE)
    refusedWithoutWrite()
  })

  it('is not saved when it cannot be checked', async () => {
    withSet({ status: 'draft', published_at: null }, HERE)
    db.fail = failOn('GET', 'question_sets', 'slug=eq.new-address')
    expect(await patch({ slug: 'new-address' })).toEqual({ status: 500, body: { error: SET_CHECK_FAILED } })
    refusedWithoutWrite()
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

  it('leaves an article that points to a different set alone, and names that set', async () => {
    withSet({}, OTHER)
    db.tables.question_sets.push(anotherSet())
    expect((await restore()).body).toEqual({ success: true, counts, linkNote: notLinkedOtherSetMessage('Leases basics') })
    expect(articleLink()).toBe(OTHER)
    expect(writes()).toEqual(['POST rpc/admin_recycle_restore'])
  })

  it('leaves an article that already points to it alone, and says nothing', async () => {
    withSet({}, `${HERE}/`)
    expect((await restore()).body).toEqual({ success: true, counts })
    expect(writes()).toEqual(['POST rpc/admin_recycle_restore'])
  })

  it.each([{ status: 'draft' }, { article_slug: null }])('is not linked when there is nothing to link (%j)', async (set) => {
    withSet(set, null)
    expect((await restore()).body).toEqual({ success: true, counts })
    expect(articleLink()).toBeNull()
    expect(writes()).toEqual(['POST rpc/admin_recycle_restore'])
  })

  it.each<[string, (call: Call) => boolean, Row]>([
    ['the item', failOn('GET', 'admin_recycle_bin'), { restoreNote: RESTORE_CHECK_FAILED }],
    ['the set', failOn('GET', 'question_sets'), { restoreNote: RESTORE_CHECK_FAILED }],
    ['the article', failOn('GET', 'articles'), {}],
    ['the link', failOn('PATCH', 'articles'), {}],
  ])('is back, and says so, when %s cannot be read or saved', async (_name, fail, notes) => {
    withSet({}, null)
    db.fail = fail
    expect(await restore()).toEqual({ status: 200, body: { success: true, counts, linkWarning: LINK_FAILED, ...notes } })
    expect(articleLink()).toBeNull()
    expect(revalidated.slice(0, 2)).toEqual(BROAD)
  })

  // Incomplete: what came back would not pass the check that a draft must pass.
  const INCOMPLETE: [string, Row[], Row[]][] = [
    ['no questions', [], []],
    ['the questions of another set only', [storedQuestion({ set_id: OTHER_SET })], []],
    ['a question without an explanation', [storedQuestion(), storedQuestion({ explanation: null })], []],
    ['a question without an answer', [storedQuestion({ correct_index: null })], []],
    ['a scenario question without its case', [storedQuestion({ type: 'scenario', case_id: 'case-1' })], [{ set_id: OTHER_SET, case_id: 'case-1', exhibit_html: '<p>Facts</p>' }]],
  ]
  const PUBLISHED_AT = '2026-01-01T00:00:00Z'

  it.each(INCOMPLETE)('comes back as a draft with %s', async (_name, questions, cases) => {
    withSet({ published_at: PUBLISHED_AT }, null)
    Object.assign(db.tables, { questions, question_cases: cases })
    expect(await restore()).toEqual({ status: 200, body: { success: true, counts, restoreNote: RESTORED_AS_DRAFT } })
    expect(db.tables.question_sets).toMatchObject([{ status: 'draft', published_at: PUBLISHED_AT, slug: 'leases-quiz', title: 'Leases quiz' }])
    expect(articleLink()).toBeNull()
    expect(writes()).toEqual(['POST rpc/admin_recycle_restore', 'PATCH question_sets', 'PATCH articles'])
    expect(db.calls.find((c) => c.method === 'PATCH' && c.table === 'question_sets')?.query).toMatch(/id=eq\.[^&]+&status=eq\.published/)
    expect(revalidated).toEqual([...BROAD, 'question-set:leases-quiz', ID_TAG, 'article:leases'])
    expect(db.calls.every((c) => c.tagsBefore === 0)).toBe(true)
    // Its web address stays locked, and it cannot go live as it is.
    expect(await patch({ slug: 'new-address' })).toEqual({ status: 400, body: { error: SLUG_LOCKED } })
    expect((await patch({ status: 'published' })).status).toBe(400)
  })

  it.each<[string, Row, unknown]>([
    ['its creation date', { created_at: '2025-05-05T00:00:00Z' }, '2025-05-05T00:00:00Z'],
    ['the date of the change', {}, expect.stringMatching(/^\d{4}-\d\d-\d\dT/)],
  ])('a draft that had no published date gets %s', async (_name, set, date) => {
    withSet({ ...set, published_at: null }, null)
    db.tables.questions = []
    await restore()
    expect(db.tables.question_sets).toMatchObject([{ status: 'draft', published_at: date }])
  })

  it('a set that comes back as a draft is no longer linked, and another link is kept', async () => {
    for (const [link, after] of [[HERE, null], [OTHER, OTHER]]) {
      withSet({}, link)
      db.tables.questions = []
      expect((await restore()).body).toEqual({ success: true, counts, restoreNote: RESTORED_AS_DRAFT })
      expect(articleLink()).toBe(after)
    }
  })

  it('says so when that link cannot be removed', async () => {
    withSet({}, HERE)
    db.tables.questions = []
    db.fail = failOn('PATCH', 'articles')
    expect((await restore()).body).toEqual({ success: true, counts, restoreNote: RESTORED_AS_DRAFT, unlinkWarning: UNLINK_FAILED })
  })

  it('asks nothing of the articles when a set without one comes back as a draft', async () => {
    withSet({ article_slug: null }, HERE)
    db.tables.questions = []
    expect((await restore()).body).toEqual({ success: true, counts, restoreNote: RESTORED_AS_DRAFT })
    expect(lines().filter((line) => line.endsWith(' articles'))).toEqual([])
  })

  it.each<[string, (call: Call) => boolean]>([
    ['the questions cannot be read', failOn('GET', 'questions')],
    ['the cases cannot be read', failOn('GET', 'question_cases')],
    ['an incomplete set cannot be made a draft', failOn('PATCH', 'question_sets')],
    [
      'the set changed meanwhile',
      (call) => {
        if (call.method === 'PATCH' && call.table === 'question_sets') db.tables.question_sets = []
        return false
      },
    ],
  ])('never claims a check it could not make: %s', async (_name, fail) => {
    withSet({}, null)
    db.tables.questions = []
    db.fail = fail
    const result = await restore()
    expect(result).toEqual({ status: 200, body: { success: true, counts, restoreNote: RESTORE_CHECK_FAILED } })
    expect(JSON.stringify(result.body)).not.toContain('database detail')
  })

  it('a draft comes back as it was, complete or not', async () => {
    withSet({ status: 'draft' }, null)
    const before = { ...db.tables.question_sets[0] }
    db.tables.questions = []
    expect((await restore()).body).toEqual({ success: true, counts })
    expect(db.tables.question_sets).toEqual([before])
  })

  describe('a single question', () => {
    const one = { questions: 1 }
    beforeEach(() => {
      db.rpc = one
      db.tables.admin_recycle_bin = [{ id: BIN_ID, kind: 'question', source_id: QUESTION }]
    })

    it.each(['published', 'draft'])('comes back into a complete set (%s), and nothing else changes', async (status) => {
      withSet({ status }, null)
      const before = { ...db.tables.question_sets[0] }
      expect(await restore()).toEqual({ status: 200, body: { success: true, counts: one } })
      expect(db.tables.question_sets).toEqual([before])
      expect(articleLink()).toBeNull()
      expect(writes()).toEqual(['POST rpc/admin_recycle_restore'])
      expect(revalidated).toEqual([...BROAD, 'question-set:leases-quiz', ID_TAG, 'article:leases'])
    })

    it('that is not complete makes a live set a draft, without its link', async () => {
      withSet({ published_at: PUBLISHED_AT }, HERE)
      db.tables.questions = [storedQuestion({ explanation: '' }), storedQuestion({ id: OTHER_QUESTION })]
      expect(await restore()).toEqual({ status: 200, body: { success: true, counts: one, restoreNote: RESTORED_AS_DRAFT } })
      expect(db.tables.question_sets).toMatchObject([{ status: 'draft', published_at: PUBLISHED_AT }])
      expect(articleLink()).toBeNull()
    })

    it('that is not complete leaves a draft as it is', async () => {
      withSet({ status: 'draft' }, null)
      db.tables.questions = [storedQuestion({ explanation: '' })]
      expect((await restore()).body).toEqual({ success: true, counts: one })
      expect(writes()).toEqual(['POST rpc/admin_recycle_restore'])
    })

    it('looks at its own set only', async () => {
      withSet({ status: 'published' }, HERE)
      db.tables.question_sets.push({ id: OTHER_SET, title: 'Other', slug: 'other', status: 'published', article_slug: null })
      db.tables.questions = [storedQuestion({ set_id: OTHER_SET, explanation: '' })]
      expect((await restore()).body).toEqual({ success: true, counts: one, restoreNote: RESTORED_AS_DRAFT })
      expect(db.tables.question_sets).toMatchObject([{ status: 'published' }, { id: OTHER_SET, status: 'draft' }])
      expect(articleLink()).toBe(HERE)
    })

    it.each<[string, (call: Call) => boolean]>([
      ['the item', failOn('GET', 'admin_recycle_bin')],
      ['the question', failOn('GET', 'questions', 'select=set_id')],
      ['the set', failOn('GET', 'question_sets')],
    ])('is back, and says so, when %s cannot be read', async (_name, fail) => {
      withSet({}, HERE)
      db.fail = fail
      expect(await restore()).toEqual({ status: 200, body: { success: true, counts: one, restoreNote: RESTORE_CHECK_FAILED } })
      expect(articleLink()).toBe(HERE)
      expect(revalidated.slice(0, 2)).toEqual(BROAD)
    })
  })
})

describe('recycle bin restore: the article has another set by now', () => {
  const restore = async () => {
    const res = await (await api('recycle-bin/route.ts')).POST(request('POST', 'recycle-bin', { action: 'restore', id: QUESTION }), { params: {} })
    return { status: res.status, body: (await res.json()) as Row }
  }
  const refusedWith = (code: string) => {
    db.refuse = (call) => (call.table.startsWith('rpc/') ? { code, message: 'duplicate key value violates unique constraint "any_rule"' } : null)
  }
  const SAVED: Row = { id: SET_ID, slug: 'leases-quiz', article_slug: 'leases' }
  const binItem = (kind: string, payload: unknown) => {
    db.tables.admin_recycle_bin = [{ id: QUESTION, kind, source_id: SET_ID, payload }]
  }
  const GENERAL = restoreMessage('23505')

  beforeEach(() => {
    refusedWith('23505')
    binItem('question_set', { question_sets: [SAVED], questions: [], question_cases: [] })
    db.tables.question_sets = [{ ...anotherSet(), article_slug: 'leases' }]
  })
  afterEach(() => {
    expect(writes()).toEqual(['POST rpc/admin_recycle_restore'])
    expect(revalidated).toEqual([])
  })

  it('is refused, and the admin is told why', async () => {
    expect(await restore()).toEqual({ status: 409, body: { error: RESTORE_ARTICLE_TAKEN } })
  })

  it('is told also when the address is taken too', async () => {
    db.tables.question_sets.push({ ...anotherSet(), id: 'third', article_slug: 'bystander', slug: 'leases-quiz' })
    expect(await restore()).toEqual({ status: 409, body: { error: RESTORE_ARTICLE_TAKEN } })
  })

  it.each<[string, () => void]>([
    ['no set names the article', () => { db.tables.question_sets = [anotherSet()] }],
    ['only the set itself names it', () => { db.tables.question_sets = [SAVED] }],
    ['the saved set has no article (null)', () => binItem('question_set', { question_sets: [{ ...SAVED, article_slug: null }] })],
    ['the saved set has no article (empty)', () => binItem('question_set', { question_sets: [{ ...SAVED, article_slug: '' }] })],
    ['the copy holds no set', () => binItem('question_set', {})],
    ['there is no copy', () => binItem('question_set', null)],
    ['the item is something else', () => binItem('article', { question_sets: [SAVED] })],
    ['the item is gone', () => { db.tables.admin_recycle_bin = [] }],
    ['the item cannot be read', () => { db.fail = failOn('GET', 'admin_recycle_bin') }],
    ['the sets cannot be read', () => { db.fail = failOn('GET', 'question_sets') }],
  ])('gives the general sentence when %s', async (_name, arrange) => {
    arrange()
    expect(await restore()).toEqual({ status: 409, body: { error: GENERAL } })
  })

  it.each([['23503', 409], ['P0001', 409], ['P0002', 404]])('reads nothing for another refusal (%s)', async (code, status) => {
    refusedWith(code)
    expect(await restore()).toEqual({ status, body: { error: restoreMessage(code) } })
    expect(lines()).toEqual(['POST rpc/admin_recycle_restore'])
  })

  it('reads nothing when the restore fails', async () => {
    db.fail = (call) => call.table.startsWith('rpc/')
    expect(await restore()).toEqual({ status: 500, body: { error: RESTORE_FAILED } })
    expect(lines()).toEqual(['POST rpc/admin_recycle_restore'])
  })
})

describe('article link: the warnings are shown', () => {
  const source = (path: string) => readFileSync(join(process.cwd(), `app/${ADMIN}/${path}`), 'utf8')

  it('on the set editor page, for a save and for a delete', () => {
    const page = source('questions/[setId]/page.tsx')
    expect(page).toContain("data.unlinkWarning ?? data.linkWarning ?? data.linkNote ?? ''")
    expect(page).toContain('setDeleteSetError(warning)')
    expect(page).toContain('setDeleteSetError(data.unlinkWarning)')
    expect(page).toContain('style={C.danger}>{deleteSetError}</div>')
  })

  it('on the recycle bin page', () => {
    const page = source('recycle-bin/page.tsx')
    expect(page).toContain("setRestoreError([data.restoreNote, data.unlinkWarning, data.linkWarning, data.linkNote].filter(Boolean).join(' '))")
    expect(page).toContain('style={C.danger}>{restoreError}</p>')
  })
})
