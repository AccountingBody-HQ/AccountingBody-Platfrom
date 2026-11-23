import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_ADMIN_PATH, TEST_ADMIN_SECRET, TEST_SESSION_SECRET, signTestSession } from './admin-session-fixtures'
import { ADMIN_SESSION_COOKIE, getAdminPath } from './middleware-logic'
import { BIN_FAILED, SNAPSHOT_FAILED } from './recycle-bin'

// BP-1 (D311, D315): every admin delete keeps a recycle bin copy first and
// deletes nothing when it cannot. The routes run with real supabase-js
// clients from the factory; only the network is fake. Each request is
// recorded as "METHOD table" with its body.

vi.mock('@sentry/nextjs', () => ({ captureException: () => {}, captureMessage: () => {} }))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>) => (...args: unknown[]) => fn(...args),
  unstable_noStore: () => {},
  revalidateTag: () => {},
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
const api =(path: string): Promise<Record<string, Handler>> =>
  import(/* @vite-ignore */ join(process.cwd(), `app/api/${ADMIN}/${path}`))

const DB_URL = 'https://example.supabase.co'
const SITE = 'https://accountingbody.com'
const ID = '0f8fad5b-d9cb-469f-a165-70867728950e'
const CHAPTER = '1b4e28ba-2fa1-11d2-883f-0016d3cca427'
const LESSON = '6fa459ea-ee8a-3ca4-894e-db77e160355e'
const ARTICLE = '886313e1-3b8a-5372-9b90-0c9aee199e5d'
const QUESTION = '7ab56afb-ff9b-4db5-9a5f-ec88f271466f'

type Row = Record<string, unknown>
type Call = { method: string; table: string; query: string; body: unknown }

const network = {
  rows: {} as Record<string, Row[]>,
  counts: {} as Record<string, number>,
  fail: (() => false) as (call: Call) => boolean,
  failCode: 'XX000',
  rpc: { status: 200, body: {} as unknown },
  calls: [] as Call[],
}

const json = (body: unknown, status: number, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...extra } })

const fakeFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.origin !== DB_URL) throw new Error(`unexpected request to ${url.href}`)
  const method = (init?.method ?? 'GET').toUpperCase()
  const table = url.pathname.replace('/rest/v1/', '')
  const call: Call = { method, table, query: decodeURIComponent(url.search), body: init?.body ? JSON.parse(String(init.body)) : undefined }
  network.calls.push(call)
  if (network.fail(call)) {
    if (method === 'HEAD') return new Response(null, { status: 503 })
    return json({ code: network.failCode, message: 'database detail', details: null, hint: null }, network.failCode === '23505' ? 409 : 500)
  }
  if (table.startsWith('rpc/')) return json(network.rpc.body, network.rpc.status)
  const headers = new Headers(init?.headers)
  const prefer = headers.get('prefer') ?? ''
  const single = (headers.get('accept') ?? '').includes('vnd.pgrst.object')
  const counted: Record<string, string> = prefer.includes('count=') ? { 'content-range': `0-0/${network.counts[table] ?? 0}` } : {}
  if (method === 'HEAD') return new Response(null, { status: 200, headers: counted })
  let rows = network.rows[table] ?? []
  if (method !== 'GET') {
    if (!prefer.includes('return=representation')) return new Response(null, { status: method === 'POST' ? 201 : 204 })
    const written = call.body ?? {}
    rows = (Array.isArray(written) ? written : [written]).map((row) => ({ id: ID, ...(row as Row) }))
  }
  if (single) {
    if (rows.length !== 1) return json({ code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'no rows' }, 406)
    return json(rows[0], method === 'POST' ? 201 : 200, counted)
  }
  return json(rows, method === 'POST' ? 201 : 200, counted)
}

let session = ''
const request = (method: string, path: string, body?: unknown) =>
  new NextRequest(`${SITE}/api/${TEST_ADMIN_PATH}/${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json', cookie: `${ADMIN_SESSION_COOKIE}=${session}` },
  })

const lines = () => network.calls.map((c) => `${c.method} ${c.table}`)
const binWrites = () => network.calls.filter((c) => c.method === 'POST' && c.table === 'admin_recycle_bin')

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
  Object.assign(network, { rows: {}, counts: {}, fail: () => false, failCode: 'XX000', rpc: { status: 200, body: {} }, calls: [] })
  session = await signTestSession()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ── (a) every user-triggered admin delete ───────────────────────────────────

type DeleteCase = {
  name: string
  call: () => Promise<Response>
  rows: Record<string, Row[]>
  counts?: Record<string, number>
  target: string // the table the delete removes rows from
  snapshotOnly: string // a table read only for the recycle bin copy
  kind: string
  label: string
  errorShape?: 'ok'
}

const CASES: DeleteCase[] = [
  {
    name: 'form entry (actions route)',
    call: async () => (await api('actions/route.ts')).POST(request('POST', 'actions', { action: 'delete', table: 'help_requests', id: ID }), { params: {} }),
    rows: { help_requests: [{ id: ID, name: 'Ada Lovelace', email: 'ada@example.com', message: 'Help' }] },
    target: 'help_requests',
    snapshotOnly: 'help_requests',
    kind: 'form_entry',
    label: 'help_requests entry 0f8fad5b',
  },
  {
    name: 'article',
    call: async () => (await api('articles/[articleId]/route.ts')).DELETE(request('DELETE', `articles/${ARTICLE}`), { params: Promise.resolve({ articleId: ARTICLE }) }),
    rows: { articles: [{ id: ARTICLE, title: 'Deferred tax' }] },
    target: 'articles',
    snapshotOnly: 'course_lesson_articles',
    kind: 'article',
    label: 'Deferred tax',
  },
  {
    name: 'Course Factory course delete',
    call: async () => (await api('course-factory/delete-course/route.ts')).DELETE(request('DELETE', 'course-factory/delete-course', { slug: 'tax' }), { params: {} }),
    rows: { courses: [{ id: ID, title: 'Tax basics', slug: 'tax' }], course_chapters: [{ id: CHAPTER, course_id: ID }] },
    target: 'courses',
    snapshotOnly: 'course_chapters',
    kind: 'course',
    label: 'Tax basics',
  },
  {
    name: 'chapter delete',
    call: async () => (await api('courses/[courseId]/route.ts')).PATCH(request('PATCH', `courses/${ID}`, { action: 'delete_chapter', chapterId: CHAPTER }), { params: Promise.resolve({ courseId: ID }) }),
    rows: { course_chapters: [{ id: CHAPTER, chapter_title: 'Chapter one' }] },
    target: 'course_chapters',
    snapshotOnly: 'course_lessons',
    kind: 'course_chapter',
    label: 'Chapter one',
  },
  {
    name: 'lesson delete',
    call: async () => (await api('courses/[courseId]/route.ts')).PATCH(request('PATCH', `courses/${ID}`, { action: 'delete_lesson', lessonId: LESSON }), { params: Promise.resolve({ courseId: ID }) }),
    rows: { course_lessons: [{ id: LESSON, title: 'Lesson one', slug: 'tax-ch1-l1' }] },
    target: 'course_lessons',
    snapshotOnly: 'course_lesson_articles',
    kind: 'course_lesson',
    label: 'Lesson one',
  },
  {
    name: 'article link remove',
    call: async () =>
      (await api('courses/[courseId]/route.ts')).PATCH(request('PATCH', `courses/${ID}`, { action: 'remove_article', lessonId: LESSON, articleId: ARTICLE }), {
        params: Promise.resolve({ courseId: ID }),
      }),
    rows: { course_lessons: [{ id: LESSON }], course_lesson_articles: [{ id: QUESTION, lesson_id: LESSON, article_id: ARTICLE, article_order: 1 }] },
    target: 'course_lesson_articles',
    snapshotOnly: 'course_lesson_articles',
    kind: 'course_lesson_article',
    label: 'course_lesson_article 7ab56afb',
  },
  {
    name: 'course delete (course editor)',
    call: async () => (await api('courses/[courseId]/route.ts')).DELETE(request('DELETE', `courses/${ID}`), { params: Promise.resolve({ courseId: ID }) }),
    rows: { courses: [{ id: ID, title: 'Tax basics' }] },
    target: 'courses',
    snapshotOnly: 'course_chapters',
    kind: 'course',
    label: 'Tax basics',
  },
  {
    name: 'provider delete',
    call: async () => (await api('providers/[slug]/edit/route.ts')).DELETE(request('DELETE', 'providers/example/edit'), { params: Promise.resolve({ slug: 'example' }) }),
    rows: { job_providers: [{ id: ID, slug: 'example', name: 'Example Jobs' }] },
    counts: { jobs: 0 },
    target: 'job_providers',
    snapshotOnly: 'provider_runs',
    kind: 'job_provider',
    label: 'Example Jobs (run error log not kept)',
    errorShape: 'ok',
  },
  {
    name: 'question set delete',
    call: async () => (await api('questions/[setId]/route.ts')).DELETE(request('DELETE', `questions/${ID}`, { action: 'delete_set' }), { params: Promise.resolve({ setId: ID }) }),
    rows: { question_sets: [{ id: ID, title: 'IAS 12 quiz' }] },
    target: 'question_sets',
    snapshotOnly: 'questions',
    kind: 'question_set',
    label: 'IAS 12 quiz',
  },
  {
    name: 'question delete',
    call: async () =>
      (await api('questions/[setId]/route.ts')).DELETE(request('DELETE', `questions/${ID}`, { action: 'delete_question', questionId: QUESTION }), {
        params: Promise.resolve({ setId: ID }),
      }),
    rows: { questions: [{ id: QUESTION, set_id: ID, question_text: 'What is a temporary difference?' }] },
    target: 'questions',
    snapshotOnly: 'questions',
    kind: 'question',
    label: 'What is a temporary difference?',
  },
  {
    name: 'studio reference delete',
    call: async () => (await api('studio/references/route.ts')).DELETE(request('DELETE', `studio/references?id=${ID}`), { params: {} }),
    rows: { studio_references: [{ id: ID, label: 'BBC Business', url: 'https://www.bbc.com/news/business' }] },
    target: 'studio_references',
    snapshotOnly: 'studio_references',
    kind: 'studio_reference',
    label: 'BBC Business',
  },
]

describe('every admin delete keeps a recycle bin copy first', () => {
  it('covers the 11 user-triggered delete sites', () => {
    expect(CASES).toHaveLength(11)
  })

  it.each(CASES)('$name: copy first, then the delete, and the answer names the copy', async (c) => {
    network.rows = c.rows
    network.counts = c.counts ?? {}
    const res = await c.call()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ binId: ID })
    const order = lines()
    const copied = order.indexOf('POST admin_recycle_bin')
    const deleted = order.lastIndexOf(`DELETE ${c.target}`)
    expect(copied).toBeGreaterThan(-1)
    expect(deleted).toBeGreaterThan(copied)
    expect(binWrites()).toHaveLength(1)
    const bin = binWrites()[0].body as Row
    expect(bin).toMatchObject({ kind: c.kind, reason: 'delete', label: c.label })
    expect(Object.keys(bin.payload as Row)).toContain(c.target)
    expect(bin.row_count).toBeGreaterThan(0)
  })

  it.each(CASES)('$name: deletes nothing when the copy cannot be written', async (c) => {
    network.rows = c.rows
    network.counts = c.counts ?? {}
    network.fail = (call) => call.method === 'POST' && call.table === 'admin_recycle_bin'
    const res = await c.call()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual(c.errorShape === 'ok' ? { ok: false, error: BIN_FAILED } : { error: BIN_FAILED })
    expect(lines().filter((line) => line.startsWith('DELETE'))).toEqual([])
  })

  it.each(CASES)('$name: deletes and copies nothing when a read for the copy fails', async (c) => {
    network.rows = c.rows
    network.counts = c.counts ?? {}
    const seen: Record<string, number> = {}
    // Fail the last read of the table that only the copy needs.
    const reads = await (async () => {
      const probe = [...network.calls]
      network.calls = []
      await c.call()
      const count = network.calls.filter((call) => call.method === 'GET' && call.table === c.snapshotOnly).length
      network.calls = probe
      return count
    })()
    network.fail = (call) => {
      if (call.method !== 'GET' || call.table !== c.snapshotOnly) return false
      seen[call.table] = (seen[call.table] ?? 0) + 1
      return seen[call.table] === reads
    }
    const res = await c.call()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual(c.errorShape === 'ok' ? { ok: false, error: SNAPSHOT_FAILED } : { error: SNAPSHOT_FAILED })
    expect(lines().filter((line) => !line.startsWith('GET') && !line.startsWith('HEAD'))).toEqual([])
  })

  it('answers "not found" and deletes nothing when the item is already gone', async () => {
    const res = await CASES[1].call()
    expect(res.status).toBe(404)
    expect(lines().filter((line) => !line.startsWith('GET'))).toEqual([])
  })

  it('never sends a database message to the browser when the delete itself fails', async () => {
    network.rows = CASES[1].rows
    network.fail = (call) => call.method === 'DELETE' && call.table === 'articles'
    const res = await CASES[1].call()
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('database detail')
  })
})

// ── (d) labels never hold an e-mail address ─────────────────────────────────

describe('recycle bin labels', () => {
  it('a form entry holding a name and e-mail is labelled by table and id only', async () => {
    network.rows = CASES[0].rows
    await CASES[0].call()
    const bin = binWrites()[0].body as Row
    expect(bin.label).toBe('help_requests entry 0f8fad5b')
    expect(String(bin.label)).not.toMatch(/@|Ada|Lovelace/)
    // The copy itself keeps the whole row, so it can be put back.
    expect((bin.payload as Record<string, Row[]>).help_requests[0].email).toBe('ada@example.com')
  })

  it('an e-mail address inside a title is removed from the label', async () => {
    network.rows = { articles: [{ id: ARTICLE, title: 'Ask ada@example.com about tax' }] }
    await CASES[1].call()
    expect(String((binWrites()[0].body as Row).label)).not.toContain('@')
  })
})

// ── (e) the actions route no longer allows job_listings ─────────────────────

describe('actions route allow-list', () => {
  it('refuses job_listings (the table does not exist) before any database request', async () => {
    const res = await (await api('actions/route.ts')).POST(request('POST', 'actions', { action: 'delete', table: 'job_listings', id: ID }), { params: {} })
    expect(res.status).toBe(403)
    expect(network.calls).toEqual([])
  })

  it.each(['help_requests', 'contact_submissions', 'firms_applications', 'email_subscribers', 'job_seeker_registrations', 'employer_briefs'])(
    'still allows delete on %s',
    async (table) => {
      network.rows = { [table]: [{ id: ID }] }
      const res = await (await api('actions/route.ts')).POST(request('POST', 'actions', { action: 'delete', table, id: ID }), { params: {} })
      expect(res.status).toBe(200)
    },
  )
})

// ── (c) the recycle bin route ───────────────────────────────────────────────

const binRoute = () => api('recycle-bin/route.ts')
const binItem = {
  id: ID,
  kind: 'course',
  reason: 'delete',
  label: 'Tax basics',
  row_count: 4,
  deleted_at: '2026-11-23T10:00:00Z',
  expires_at: '2027-02-21T10:00:00Z',
  restored_at: null,
  payload: { courses: [{ id: ID, secret_field: 'never shown' }] },
}
const restore = async (id: unknown) =>
  (await binRoute()).POST(request('POST', 'recycle-bin', { action: 'restore', id }), { params: {} })

describe('recycle bin route', () => {
  it.each(['GET', 'POST'])('%s answers a signed-out request before any database request', async (method) => {
    session = 'not-a-session'
    const res = await (await binRoute())[method](request(method, 'recycle-bin', method === 'POST' ? { action: 'restore', id: ID } : undefined), { params: {} })
    expect(res.status).toBe(401)
    expect(network.calls).toEqual([])
  })

  it('lists the newest 200 items after removing expired copies, and never the saved copy', async () => {
    network.rows = { admin_recycle_bin: [binItem] }
    const res = await (await binRoute()).GET(request('GET', 'recycle-bin'), { params: {} })
    expect(res.status).toBe(200)
    const text = await res.clone().text()
    expect(text).not.toContain('payload')
    expect(text).not.toContain('never shown')
    expect((await res.json()).items).toEqual([
      {
        id: ID,
        kind: 'course',
        reason: 'delete',
        label: 'Tax basics',
        row_count: 4,
        deleted_at: '2026-11-23T10:00:00Z',
        expires_at: '2027-02-21T10:00:00Z',
        restored_at: null,
      },
    ])
    expect(lines()).toEqual(['DELETE admin_recycle_bin', 'GET admin_recycle_bin'])
    const list = network.calls[1].query
    expect(list).not.toContain('payload')
    expect(list).toContain('order=deleted_at.desc')
    expect(list).toContain('limit=200')
  })

  it('answers a plain sentence when the list cannot be read', async () => {
    network.fail = (call) => call.method === 'GET'
    const res = await (await binRoute()).GET(request('GET', 'recycle-bin'), { params: {} })
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('database detail')
  })

  it('restores one item through the restore function and gives the counts', async () => {
    network.rpc = { status: 200, body: { courses: 1, course_chapters: 2 } }
    const res = await restore(ID)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, counts: { courses: 1, course_chapters: 2 } })
    expect(lines()).toEqual(['POST rpc/admin_recycle_restore'])
    expect(network.calls[0].body).toEqual({ p_id: ID })
  })

  it.each([
    ['23505', 409, 'Cannot restore: an item with the same address or id already exists. Rename or delete that item first.'],
    ['P0001', 409, 'Cannot restore: this item has already been restored, or it holds something that cannot be restored here.'],
    ['P0002', 404, 'Cannot restore: this item is no longer in the recycle bin.'],
    ['XX000', 500, 'Restore failed. Nothing was changed.'],
  ])('maps restore error %s to a plain sentence', async (code, status, message) => {
    network.fail = (call) => call.table.startsWith('rpc/')
    network.failCode = code
    const res = await restore(ID)
    expect(res.status).toBe(status)
    expect(await res.json()).toEqual({ error: message })
  })

  it.each([['not-an-id'], [42], [undefined]])('refuses an item id %s before any database request', async (id) => {
    const res = await restore(id)
    expect(res.status).toBe(400)
    expect(network.calls).toEqual([])
  })

  it('refuses an unknown action', async () => {
    const res = await (await binRoute()).POST(request('POST', 'recycle-bin', { action: 'empty', id: ID }), { params: {} })
    expect(res.status).toBe(400)
    expect(network.calls).toEqual([])
  })
})

// ── (b) Course Factory save ─────────────────────────────────────────────────

const KEPT = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const DROPPED = '9c5b94b1-35ad-49bb-b118-8e8fc24abf80'
const keptLesson = {
  id: KEPT,
  chapter_id: CHAPTER,
  course_id: ID,
  title: 'Old title',
  slug: 'tax-ch1-l1',
  lesson_order: 1,
  created_at: '2026-01-01T00:00:00Z',
  estimated_time: '15 min',
  video_url: 'https://video.example/1',
  audio_url: 'https://audio.example/1',
  external_quiz_url: 'https://quiz.example/1',
}
const droppedLesson = { id: DROPPED, chapter_id: CHAPTER, course_id: ID, title: 'Dropped', slug: 'tax-ch1-l2', lesson_order: 2 }
const course = { id: ID, title: 'Tax basics', slug: 'tax', status: 'published', show_on_sites: ['ab', 'et'] }
const liveCourse = () => {
  network.rows = {
    courses: [course],
    course_chapters: [{ id: CHAPTER, course_id: ID, chapter_title: 'One', chapter_order: 1 }],
    course_lessons: [keptLesson, droppedLesson],
    course_lesson_articles: [{ id: QUESTION, lesson_id: KEPT, article_id: ARTICLE, article_order: 1 }],
  }
}

type Ref = { title: string; articleIds: string[]; lessonId?: string }
const save = (body: Record<string, unknown>) => async () =>
  (await api('course-factory/save/route.ts')).POST(request('POST', 'course-factory/save', body), { params: {} })
const update = (chapters: { chapterTitle: string; lessonRefs: Ref[] }[], extra: Record<string, unknown> = {}) =>
  save({ mode: 'update', courseId: ID, title: 'Tax basics', slug: 'tax', showOnSites: ['accountingbody', 'ethiotax'], chapters, ...extra })
const writes = () => lines().filter((line) => !line.startsWith('GET') && !line.startsWith('HEAD'))
const lessonInserts = () => network.calls.filter((c) => c.method === 'POST' && c.table === 'course_lessons').map((c) => c.body as Row)

describe('Course Factory save: create', () => {
  const create = save({ mode: 'create', title: 'Tax basics', slug: 'tax', chapters: [{ chapterTitle: 'One', lessonRefs: [{ title: 'L', articleIds: [ARTICLE] }] }] })

  it('refuses an address that is already used, and writes nothing', async () => {
    liveCourse()
    const res = await create()
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'A course with this web address already exists. Load that course to edit it, or change the title.' })
    expect(lines()).toEqual(['GET courses'])
  })

  it('inserts (never upserts) the course row', async () => {
    const res = await create()
    expect(res.status).toBe(200)
    const insert = network.calls.find((c) => c.method === 'POST' && c.table === 'courses')
    expect(insert?.query).not.toContain('on_conflict')
    expect(writes()).not.toContain('DELETE course_chapters')
  })

  it('answers the same 409 when another save takes the address first', async () => {
    network.fail = (call) => call.method === 'POST' && call.table === 'courses'
    network.failCode = '23505'
    const res = await create()
    expect(res.status).toBe(409)
    expect(JSON.stringify(await res.json())).toContain('already exists')
  })

  it('says honestly when the partial course could not be rolled back', async () => {
    network.fail = (call) => (call.method === 'POST' && call.table === 'course_chapters') || (call.method === 'DELETE' && call.table === 'courses')
    const res = await create()
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).toContain('could not be rolled back')
  })
})

describe('Course Factory save: update', () => {
  it('keeps a loaded lesson: its id, address, time and media fields, wherever it moves', async () => {
    liveCourse()
    const res = await update([
      { chapterTitle: 'Intro', lessonRefs: [{ title: 'Brand new', articleIds: [] }] },
      { chapterTitle: 'Two', lessonRefs: [{ title: 'Renamed lesson', articleIds: [ARTICLE], lessonId: KEPT }] },
    ])()
    expect(res.status).toBe(200)
    const kept = lessonInserts().find((row) => row.id === KEPT)
    expect(kept).toMatchObject({
      id: KEPT,
      slug: 'tax-ch1-l1',
      title: 'Renamed lesson',
      lesson_order: 1,
      estimated_time: '15 min',
      video_url: 'https://video.example/1',
      audio_url: 'https://audio.example/1',
      external_quiz_url: 'https://quiz.example/1',
    })
  })

  it('gives new lessons free, unique addresses (never a kept or existing one)', async () => {
    liveCourse()
    const res = await update([
      {
        chapterTitle: 'One',
        lessonRefs: [
          { title: 'Kept', articleIds: [], lessonId: KEPT },
          { title: 'New A', articleIds: [] },
        ],
      },
      { chapterTitle: 'Two', lessonRefs: [{ title: 'New B', articleIds: [] }] },
    ])()
    expect(res.status).toBe(200)
    const slugs = lessonInserts().map((row) => row.slug)
    // ch1-l2 is still used by a lesson in the database, so the new one gets -2.
    expect(slugs).toEqual(['tax-ch1-l1', 'tax-ch1-l2-2', 'tax-ch2-l1'])
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(lessonInserts()[1]).not.toHaveProperty('id')
  })

  it('refuses a lesson id that is not in this course, before any write', async () => {
    liveCourse()
    const res = await update([{ chapterTitle: 'One', lessonRefs: [{ title: 'X', articleIds: [], lessonId: QUESTION }] }])()
    expect(res.status).toBe(400)
    expect(writes()).toEqual([])
  })

  it('refuses a change of address, before any write', async () => {
    liveCourse()
    const res = await update([{ chapterTitle: 'One', lessonRefs: [{ title: 'X', articleIds: [], lessonId: KEPT }] }], { slug: 'tax-new' })()
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'The course address changed since it was loaded. Reload the course.' })
    expect(writes()).toEqual([])
  })

  it('writes the recycle bin copy before any other write, and the copy is the whole course', async () => {
    liveCourse()
    const res = await update([{ chapterTitle: 'One', lessonRefs: [{ title: 'Kept', articleIds: [], lessonId: KEPT }] }])()
    expect(await res.json()).toMatchObject({ success: true, binId: ID })
    expect(writes()[0]).toBe('POST admin_recycle_bin')
    const bin = binWrites()[0].body as Row
    expect(bin).toMatchObject({ kind: 'course', reason: 'course_save', source_table: 'courses', source_id: ID, row_count: 5 })
    expect(String(bin.label)).toMatch(/^Tax basics \(before save \d{4}-\d\d-\d\d \d\d:\d\d UTC\)$/)
    expect(Object.keys(bin.payload as Row)).toEqual(['courses', 'course_chapters', 'course_lessons', 'course_lesson_articles'])
  })

  it('updates the course row by id, keeps its address and the sites as sent', async () => {
    liveCourse()
    await update([{ chapterTitle: 'One', lessonRefs: [{ title: 'Kept', articleIds: [], lessonId: KEPT }] }])()
    const patch = network.calls.find((c) => c.method === 'PATCH' && c.table === 'courses')
    expect(patch?.query).toContain(`id=eq.${ID}`)
    expect(patch?.body).not.toHaveProperty('slug')
    expect(patch?.body).toMatchObject({ show_on_sites: ['ab', 'et'] })
    expect(network.calls.some((c) => c.method === 'POST' && c.table === 'courses')).toBe(false)
  })

  it('changes nothing when the recycle bin copy cannot be written', async () => {
    liveCourse()
    network.fail = (call) => call.method === 'POST' && call.table === 'admin_recycle_bin'
    const res = await update([{ chapterTitle: 'One', lessonRefs: [{ title: 'Kept', articleIds: [], lessonId: KEPT }] }])()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Could not keep a copy of the current course in the recycle bin. Nothing was changed.' })
    expect(writes()).toEqual(['POST admin_recycle_bin'])
  })

  it('answers 404 when the loaded course no longer exists', async () => {
    const res = await update([{ chapterTitle: 'One', lessonRefs: [{ title: 'New', articleIds: [] }] }])()
    expect(res.status).toBe(404)
    expect(writes()).toEqual([])
  })

  it.each([
    ['no mode', { title: 'T', slug: 'tax', chapters: [] }],
    ['an update without a valid course id', { mode: 'update', courseId: 'nope', title: 'T', slug: 'tax', chapters: [] }],
    ['a lesson id that is not an id', { mode: 'update', courseId: ID, title: 'T', slug: 'tax', chapters: [{ chapterTitle: 'C', lessonRefs: [{ title: 'L', articleIds: [], lessonId: 'x' }] }] }],
    [
      'the same lesson twice',
      {
        mode: 'update',
        courseId: ID,
        title: 'T',
        slug: 'tax',
        chapters: [{ chapterTitle: 'C', lessonRefs: [{ title: 'L', articleIds: [], lessonId: KEPT }, { title: 'L', articleIds: [], lessonId: KEPT }] }],
      },
    ],
    ['a create that names a lesson id', { mode: 'create', title: 'T', slug: 'tax', chapters: [{ chapterTitle: 'C', lessonRefs: [{ title: 'L', articleIds: [], lessonId: KEPT }] }] }],
    ['missing chapters', { mode: 'create', title: 'T', slug: 'tax' }],
  ])('refuses %s with 400 before any database request', async (_name, body) => {
    const res = await save(body)()
    expect(res.status).toBe(400)
    expect(network.calls).toEqual([])
  })

  it('never sends a database message to the browser', async () => {
    liveCourse()
    network.fail = (call) => call.method === 'PATCH' && call.table === 'courses'
    const res = await update([{ chapterTitle: 'One', lessonRefs: [{ title: 'Kept', articleIds: [], lessonId: KEPT }] }])()
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('database detail')
  })
})
