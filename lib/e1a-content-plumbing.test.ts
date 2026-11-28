import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_ADMIN_PATH, TEST_ADMIN_SECRET, TEST_SESSION_SECRET, signTestSession } from './admin-session-fixtures'
import { ADMIN_SESSION_COOKIE, getAdminPath } from './middleware-logic'
import {
  NOTE_CHECK_FAILED,
  NOTE_DELETE_CHECK_FAILED,
  NOTE_HAS_SET,
  NOTE_SLUG_HAS_SET,
  NOTE_SLUG_LOCKED,
  isNoteAddressLocked,
} from './note-guards'

// E1a (D373, D374): content plumbing.
// 1. One shared article-cache refresh after every article write that worked.
// 2. A published study note keeps its address; a note with a practice set
//    keeps its address and cannot be deleted.
// 3. Course writes refresh the course pages.
// 4. New content starts on both sites.
// 6. Model clients are made per request.
// The routes run with real supabase-js clients from the factory; only the
// network is fake: a small in-memory table store that applies eq filters and
// answers count-only requests.

const state = vi.hoisted(() => ({ tags: [] as string[], cacheFails: null as Error | null, reports: [] as unknown[][] }))

vi.mock('@sentry/nextjs', () => ({ captureException: () => {}, captureMessage: () => {} }))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>) => (...args: unknown[]) => fn(...args),
  unstable_noStore: () => {},
  revalidateTag: (tag: string) => {
    if (state.cacheFails) throw state.cacheFails
    state.tags.push(tag)
  },
  revalidatePath: () => {},
}))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}))

import { refreshArticleCaches } from './article-cache'
import { refreshCourseCaches } from './course-cache'
import * as reportError from './report-error'

// The folder comes from the app's own default, so its name is not repeated here.
vi.stubEnv('ADMIN_PATH', undefined)
const ADMIN = getAdminPath()
vi.unstubAllEnvs()

type Handler = (req: NextRequest, context: { params: unknown }) => Promise<Response>
const api = (path: string): Promise<Record<string, Handler>> =>
  import(/* @vite-ignore */ join(process.cwd(), `app/api/${ADMIN}/${path}`))
const source = (path: string) => readFileSync(join(process.cwd(), path.replace('<admin>', ADMIN)), 'utf8')

const DB_URL = 'https://example.supabase.co'
const SITE = 'https://accountingbody.com'
const NOTE_ID = '6f1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
const NEW_ID = '0f8fad5b-d9cb-469f-a165-70867728950e'

type Row = Record<string, unknown>
type Call = { method: string; table: string; query: string; body: unknown }

const db = {
  tables: {} as Record<string, Row[]>,
  fail: (() => false) as (call: Call) => boolean,
  calls: [] as Call[],
}

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

const fakeFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.origin !== DB_URL) throw new Error(`unexpected request to ${url.href}`)
  const method = (init?.method ?? 'GET').toUpperCase()
  const table = url.pathname.replace('/rest/v1/', '')
  const body: unknown = init?.body ? JSON.parse(String(init.body)) : undefined
  const call: Call = { method, table, query: decodeURIComponent(url.search), body }
  db.calls.push(call)
  if (db.fail(call)) return json({ code: 'XX000', message: 'database detail', details: null, hint: null }, 500)
  if (table.startsWith('rpc/')) return json(null, 200)

  const headers = new Headers(init?.headers)
  const single = (headers.get('accept') ?? '').includes('vnd.pgrst.object')
  const rows = (db.tables[table] ??= [])
  const matches = (row: Row) =>
    Array.from(url.searchParams).every(([key, value]) => {
      if (value.startsWith('eq.')) return String(row[key]) === value.slice(3)
      if (value === 'is.null') return (row[key] ?? null) === null
      if (value.startsWith('in.(')) return value.slice(4, -1).split(',').includes(String(row[key]))
      return true
    })

  let found = rows.filter(matches)
  if (method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-range': `*/${found.length}` } })
  if (method === 'POST') {
    found = (Array.isArray(body) ? body : [body]).map((row) => ({ id: NEW_ID, ...(row as Row) }))
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

const writes = () => db.calls.filter((c) => c.method !== 'GET' && c.method !== 'HEAD').map((c) => `${c.method} ${c.table}`)
const failOn = (method: string, table: string) => (call: Call) => call.method === method && call.table === table

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
  Object.assign(state, { tags: [], cacheFails: null, reports: [] })
  Object.assign(db, { tables: {}, fail: () => false, calls: [] })
  session = await signTestSession()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ── 1. The shared refresh helpers ───────────────────────────────────────────

describe('refreshArticleCaches', () => {
  it('always refreshes the broad article tag, which covers lists and counts', () => {
    refreshArticleCaches()
    expect(state.tags).toEqual(['articles'])
  })

  it('also refreshes every known note once, and the sets when asked', () => {
    refreshArticleCaches({ slugs: ['old', 'new', 'new', null, undefined, ''], practiceSets: true })
    expect(state.tags).toEqual(['articles', 'article:old', 'article:new', 'question-sets'])
  })

  it('never throws; a failure is reported under its fixed label', () => {
    const spy = vi.spyOn(reportError, 'reportServerError').mockImplementation(() => {})
    state.cacheFails = new Error('no cache')
    expect(() => refreshArticleCaches({ slugs: ['a'] })).not.toThrow()
    expect(spy).toHaveBeenCalledWith('admin article cache refresh failed', state.cacheFails, { area: 'admin' })
  })

  it('uses the tags the public article reads are stored under', () => {
    expect(source('lib/db.ts')).toContain("tags: ['articles', `article:${slug}`]")
    expect(source('lib/db.ts')).toContain("tags: ['articles', `articles-category:${categorySlug}`]")
    expect(source('lib/db.ts')).toContain("tags: ['counts', 'articles']")
    expect(source('lib/articles-list.ts')).toContain("tags: ['articles', `articles-list:${siteCode}`]")
    expect(source('lib/featured-articles.ts')).toContain("tags: ['articles', `featured-articles:${siteCode}`]")
    expect(source('lib/db.ts')).toContain("tags: ['question-sets', 'question-sets-list']")
  })
})

describe('refreshCourseCaches', () => {
  it('refreshes the broad course tag', () => {
    refreshCourseCaches()
    expect(state.tags).toEqual(['courses'])
  })

  it('never throws; a failure is reported under its fixed label', () => {
    const spy = vi.spyOn(reportError, 'reportServerError').mockImplementation(() => {})
    state.cacheFails = new Error('no cache')
    expect(() => refreshCourseCaches()).not.toThrow()
    expect(spy).toHaveBeenCalledWith('admin course cache refresh failed', state.cacheFails, { area: 'admin' })
  })

  it('uses the tag every public course read is stored under', () => {
    const courses = source('lib/coursesNew.ts')
    expect(courses).toContain("tags: ['courses'],")
    expect(courses).toContain("tags: ['courses', `course:${slug}`],")
    expect(courses).toContain("tags: ['courses', `course:${courseSlug}`],")
  })
})

// ── 2. Study note edits and deletes ─────────────────────────────────────────

describe('the study note messages', () => {
  it('are fixed', () => {
    expect(NOTE_SLUG_LOCKED).toBe('The web address of a published study note cannot be changed.')
    expect(NOTE_SLUG_HAS_SET).toBe('This study note has a practice set, so its web address cannot be changed. Nothing was saved.')
    expect(NOTE_HAS_SET).toBe('This study note has a practice set. Delete the set or link it to another note first. Nothing was deleted.')
    expect(NOTE_CHECK_FAILED).toBe('Could not check this study note. Nothing was saved.')
    expect(NOTE_DELETE_CHECK_FAILED).toBe('Could not check this study note. Nothing was deleted.')
  })

  it.each([
    ['published', undefined, false, true],
    ['published', 'draft', true, true],
    ['draft', 'published', true, true],
    ['draft', undefined, false, false],
    ['draft', 'draft', true, false],
    [null, undefined, false, false],
  ])('address locked: was %s, new %s (given %s) → %s', (was, next, given, locked) => {
    expect(isNoteAddressLocked(was, next, given)).toBe(locked)
  })
})

const note = (over: Row = {}): Row => ({ id: NOTE_ID, slug: 'leases', title: 'Leases', status: 'published', published_at: '2025-01-01T00:00:00Z', ...over })

async function patch(fields: Row) {
  const res = await (await api('articles/[articleId]/route.ts')).PATCH(request('PATCH', `articles/${NOTE_ID}`, { fields }), {
    params: Promise.resolve({ articleId: NOTE_ID }),
  })
  return { status: res.status, body: (await res.json()) as Row }
}

async function remove() {
  const res = await (await api('articles/[articleId]/route.ts')).DELETE(request('DELETE', `articles/${NOTE_ID}`), {
    params: Promise.resolve({ articleId: NOTE_ID }),
  })
  return { status: res.status, body: (await res.json()) as Row }
}

describe('study note PATCH', () => {
  it('saves an edit of a published note that keeps its address, and refreshes its caches', async () => {
    db.tables.articles = [note()]
    expect(await patch({ title: 'Leases (IFRS 16)', slug: 'leases' })).toEqual({ status: 200, body: { success: true } })
    expect(db.tables.articles[0].title).toBe('Leases (IFRS 16)')
    expect(state.tags).toEqual(['articles', 'article:leases'])
  })

  it('refuses a new address for a published note and writes nothing', async () => {
    db.tables.articles = [note()]
    expect(await patch({ slug: 'leases-2' })).toEqual({ status: 400, body: { error: NOTE_SLUG_LOCKED } })
    expect(writes()).toEqual([])
    expect(db.tables.articles[0].slug).toBe('leases')
    expect(state.tags).toEqual([])
  })

  it('refuses a new address in the same save that publishes a draft', async () => {
    db.tables.articles = [note({ status: 'draft' })]
    expect(await patch({ slug: 'leases-2', status: 'published' })).toEqual({ status: 400, body: { error: NOTE_SLUG_LOCKED } })
    expect(writes()).toEqual([])
  })

  it('lets a draft change its address when no practice set links to it, and refreshes both addresses', async () => {
    db.tables.articles = [note({ status: 'draft' })]
    db.tables.question_sets = [{ id: 's1', slug: 'other-quiz', article_slug: 'other-note', status: 'published' }]
    expect(await patch({ slug: 'leases-2' })).toEqual({ status: 200, body: { success: true } })
    expect(db.tables.articles[0].slug).toBe('leases-2')
    expect(state.tags).toEqual(['articles', 'article:leases', 'article:leases-2'])
  })

  it('refuses a new address for a draft that a practice set links to (any status)', async () => {
    db.tables.articles = [note({ status: 'draft' })]
    db.tables.question_sets = [{ id: 's1', slug: 'leases-quiz', article_slug: 'leases', status: 'draft' }]
    expect(await patch({ slug: 'leases-2' })).toEqual({ status: 400, body: { error: NOTE_SLUG_HAS_SET } })
    expect(writes()).toEqual([])
  })

  it('stops an address change when the set check fails', async () => {
    db.tables.articles = [note({ status: 'draft' })]
    db.fail = (call) => call.method === 'HEAD' && call.table === 'question_sets'
    expect(await patch({ slug: 'leases-2' })).toEqual({ status: 500, body: { error: NOTE_CHECK_FAILED } })
    expect(writes()).toEqual([])
  })

  it('stops an address change when the note cannot be read', async () => {
    db.tables.articles = [note({ status: 'draft' })]
    db.fail = failOn('GET', 'articles')
    expect(await patch({ slug: 'leases-2' })).toEqual({ status: 500, body: { error: NOTE_CHECK_FAILED } })
    expect(writes()).toEqual([])
  })

  it('still saves other fields when the read fails, and refreshes the broad tag', async () => {
    db.tables.articles = [note()]
    db.fail = failOn('GET', 'articles')
    expect(await patch({ title: 'New title' })).toEqual({ status: 200, body: { success: true } })
    expect(state.tags).toEqual(['articles'])
  })

  it('answers 404 for a note that does not exist', async () => {
    expect(await patch({ title: 'x' })).toEqual({ status: 404, body: { error: 'Article not found' } })
    expect(writes()).toEqual([])
  })

  it.each([[{ status: 'draft' }], [{ show_on_sites: ['ab'] }]])('a change of status or sites also refreshes the practice sets (%j)', async (fields) => {
    db.tables.articles = [note()]
    expect(await patch(fields)).toEqual({ status: 200, body: { success: true } })
    expect(state.tags).toEqual(['articles', 'article:leases', 'question-sets'])
  })

  it('refreshes nothing when the update fails', async () => {
    db.tables.articles = [note()]
    db.fail = failOn('PATCH', 'articles')
    const result = await patch({ title: 'x' })
    expect(result.status).toBe(500)
    expect(state.tags).toEqual([])
  })
})

describe('study note DELETE', () => {
  it('refuses a note that a practice set links to (any status), and deletes and keeps nothing', async () => {
    db.tables.articles = [note()]
    db.tables.question_sets = [{ id: 's1', slug: 'leases-quiz', article_slug: 'leases', status: 'draft' }]
    expect(await remove()).toEqual({ status: 409, body: { error: NOTE_HAS_SET } })
    expect(writes()).toEqual([])
    expect(db.tables.articles).toHaveLength(1)
    expect(state.tags).toEqual([])
  })

  it('deletes a note without a set (copy kept first) and refreshes the note and course caches', async () => {
    db.tables.articles = [note()]
    db.tables.question_sets = [{ id: 's1', slug: 'other-quiz', article_slug: 'other-note', status: 'published' }]
    const result = await remove()
    expect(result.status).toBe(200)
    expect(result.body.success).toBe(true)
    expect(db.tables.articles).toEqual([])
    expect(writes()).toContain('DELETE articles')
    expect(state.tags).toEqual(['articles', 'article:leases', 'courses'])
  })

  it.each([
    ['the note read', failOn('GET', 'articles')],
    ['the set count', (call: Call) => call.method === 'HEAD' && call.table === 'question_sets'],
  ])('deletes nothing when %s fails', async (_name, fail) => {
    db.tables.articles = [note()]
    db.fail = fail
    expect(await remove()).toEqual({ status: 500, body: { error: NOTE_DELETE_CHECK_FAILED } })
    expect(writes()).toEqual([])
    expect(db.tables.articles).toHaveLength(1)
  })

  it('answers 404 for a note that does not exist', async () => {
    expect(await remove()).toEqual({ status: 404, body: { error: 'Article not found' } })
    expect(writes()).toEqual([])
  })
})

// ── 1. Publish routes ───────────────────────────────────────────────────────

describe('article publish', () => {
  it('starts a note on both sites when the screen sends no sites, and refreshes the article caches', async () => {
    const res = await (await api('articles/publish/route.ts')).POST(
      request('POST', 'articles/publish', { article: { title: 'Title', content: '<p>Body</p>', slug: 'title' } }),
      { params: {} },
    )
    expect(res.status).toBe(200)
    expect(db.tables.articles[0].show_on_sites).toEqual(['ab', 'et'])
    expect(state.tags).toEqual(['articles', 'article:title'])
  })

  it('keeps the sites the screen sends', async () => {
    await (await api('articles/publish/route.ts')).POST(
      request('POST', 'articles/publish', { article: { title: 'Title', content: '<p>Body</p>', slug: 'title' }, showOnSites: ['accountingbody'] }),
      { params: {} },
    )
    expect(db.tables.articles[0].show_on_sites).toEqual(['ab'])
  })

  it('both publish routes use the shared refresh and nothing else', () => {
    for (const path of ['app/api/<admin>/articles/publish/route.ts', 'app/api/<admin>/content-factory/publish/route.ts']) {
      const text = source(path)
      expect(text).toContain("import { refreshArticleCaches } from '@/lib/article-cache'")
      expect(text).not.toContain('revalidateTag')
    }
    expect(source('app/api/<admin>/content-factory/publish/route.ts')).toContain('refreshArticleCaches({ slugs: [slug] })')
  })
})

// ── 3. Course writes ────────────────────────────────────────────────────────

describe('course writes refresh the course pages', () => {
  it('a course delete that worked refreshes them; one that failed does not', async () => {
    db.tables.courses = [{ id: NEW_ID, slug: 'ifrs-basics', title: 'IFRS basics' }]
    const call = async () =>
      (await api('course-factory/delete-course/route.ts')).DELETE(request('DELETE', 'course-factory/delete-course', { slug: 'ifrs-basics' }), {
        params: {},
      })
    db.fail = failOn('DELETE', 'courses')
    expect((await call()).status).toBe(500)
    expect(state.tags).toEqual([])
    db.fail = () => false
    expect((await call()).status).toBe(200)
    expect(state.tags).toEqual(['courses'])
  })

  it('course save refreshes only after a save that worked', () => {
    const text = source('app/api/<admin>/course-factory/save/route.ts')
    expect(text).toContain("import { refreshCourseCaches } from '@/lib/course-cache'")
    expect(text).toContain('    if (saved.ok) refreshCourseCaches()\n    return saved\n')
  })

  it('every successful course edit or delete refreshes them first', () => {
    const text = source('app/api/<admin>/courses/[courseId]/route.ts')
    const writes = text.slice(text.indexOf('export async function PATCH('))
    const successes = writes.match(/\n {4}return NextResponse\.json\(\{ success: true/g) ?? []
    const refreshed = writes.match(/\n {4}refreshCourseCaches\(\)\n {4}return NextResponse\.json\(\{ success: true/g) ?? []
    expect(successes).toHaveLength(13)
    expect(refreshed).toHaveLength(13)
    expect(text.slice(0, text.indexOf('export async function PATCH('))).not.toContain('refreshCourseCaches()\n')
  })
})

// ── 4. Both sites by default ────────────────────────────────────────────────

describe('new content starts on both sites', () => {
  const pages = [
    'app/<admin>/questions/import/page.tsx',
    'app/<admin>/articles/import/page.tsx',
    'app/<admin>/content-factory/page.tsx',
    'app/<admin>/questions/generate/page.tsx',
  ]

  it.each(pages)('%s has no single-site default or ETICPA switch', (path) => {
    const text = source(path)
    expect(text).not.toContain("(['accountingbody'])")
    expect(text).not.toContain(": ['accountingbody']\n")
    expect(text).not.toContain("['ethiotax']")
    expect(text).not.toContain("setCanonical('ethiotax')")
    expect(text).toContain("useState<string[]>(['accountingbody', 'ethiotax'])")
  })

  it('the question publish route defaults to both sites', () => {
    expect(source('app/api/<admin>/questions/publish/route.ts')).toContain("      showOnSites = ['accountingbody', 'ethiotax'],\n")
  })
})

// ── 6. Model clients ────────────────────────────────────────────────────────

describe('model clients', () => {
  it.each(['app/api/<admin>/questions/generate/route.ts', 'app/api/<admin>/content-factory/generate/route.ts'])(
    '%s makes its client inside the request',
    (path) => {
      const text = source(path)
      expect(text).not.toMatch(/^const \w+ = new Anthropic\(/m)
      expect(text.match(/new Anthropic\(/g)).toHaveLength(1)
      const post = text.slice(text.indexOf('export async function POST('))
      expect(post).toContain('const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })')
    },
  )
})

// ── 5. The 71 AB-only practice sets go on both sites (D373 E) ──────────────

describe('migrations/0032 (record file, run once by the E1a database step)', () => {
  const FILE = 'migrations/0032_question_sets_on_both_sites.sql'
  const data = () => readFileSync(join(process.cwd(), FILE))

  it('is byte for byte the reviewed file', () => {
    expect(createHash('sha256').update(data()).digest('hex').slice(0, 16)).toBe('faf2e465791f5413')
    expect(data().toString('utf8').split('\n').length - 1).toBe(99)
    expect(data().length).toBe(4917)
  })

  it('Part B changes only show_on_sites, only from {ab} to {ab,et}, and stops itself on any other count', () => {
    const text = data().toString('utf8')
    const partB = text.slice(text.indexOf('\nBEGIN;'), text.indexOf('\nCOMMIT;') + 8)
    expect(partB.match(/\bUPDATE\b/g)).toHaveLength(1)
    expect(partB).toContain("SET show_on_sites = '{ab,et}'")
    expect(partB).not.toMatch(/^\s*(DELETE|INSERT|DROP|ALTER|GRANT|REVOKE|TRUNCATE)\b/m)
    expect(partB.match(/\bDROP\b/g)).toEqual(['DROP']) // only the temporary table's ON COMMIT DROP
    expect(partB).not.toContain('updated_at')
    expect(partB).toContain("RAISE EXCEPTION 'e1a_stop: % published sets on ab only, expected 71', n_before;")
    expect(partB).toContain("RAISE EXCEPTION 'e1a_stop: % rows changed, expected 71', n_changed;")
    expect(text.match(/^BEGIN;$/gm)).toHaveLength(1)
    expect(text.match(/^COMMIT;$/gm)).toHaveLength(1)
  })

  it('the README lists 0032 once, directly after 0031, as not applied when committed', () => {
    const rows = readFileSync(join(process.cwd(), 'migrations/README.md'), 'utf8').split('\n')
    const at = rows.findIndex((line) => line.startsWith('| `0032_question_sets_on_both_sites.sql` |'))
    expect(rows.filter((line) => line.startsWith('| `0032_'))).toHaveLength(1)
    expect(rows[at - 1].startsWith('| `0031_revoke_browser_privileges_content_tables.sql` |')).toBe(true)
    expect(rows[at]).toContain('**Not applied when committed; run once by the E1a database step after the E1a release, after a fresh backup (D373 E).')
  })
})
