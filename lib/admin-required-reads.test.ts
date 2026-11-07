import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_ADMIN_PATH, TEST_ADMIN_SECRET, TEST_SESSION_SECRET, signTestSession } from './admin-session-fixtures'
import { ADMIN_SESSION_COOKIE, getAdminPath } from './middleware-logic'

// Admin tools that delete, replace or number content first read what is
// there. These tests run the routes with real supabase-js clients from the
// factory; only the network is fake. Each read can answer with rows, with
// nothing, with a database error, or not at all (time is fake, so the 20 s
// limit can be followed to its end). The request log shows every database
// request the route made, in order.

const revalidated = vi.hoisted(() => [] as string[])
const jar = vi.hoisted(() => ({ token: undefined as string | undefined }))

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
  cookies: async () => ({
    get: (name: string) => (name === 'admin_token' && jar.token ? { name, value: jar.token } : undefined),
  }),
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
const ID = '0f8fad5b-d9cb-469f-a165-70867728950e'
const CHAPTER = '1b4e28ba-2fa1-11d2-883f-0016d3cca427'
const LESSON = '6fa459ea-ee8a-3ca4-894e-db77e160355e'
const ARTICLE = '886313e1-3b8a-5372-9b90-0c9aee199e5d'
const LIMIT_MS = 20_000

type Row = Record<string, unknown>
type Call = { method: string; table: string; body: unknown }
type Failure = 'error' | 'never'

const network = {
  rows: {} as Record<string, Row[]>,
  counts: {} as Record<string, number>,
  // Picks how a request fails; `seen` counts earlier requests with the same method and table.
  fail: (() => undefined) as (call: Call, seen: number) => Failure | undefined,
  calls: [] as Call[],
}

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...extra } })
}

const fakeFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.origin !== DB_URL) throw new Error(`unexpected request to ${url.href}`)
  const method = (init?.method ?? 'GET').toUpperCase()
  const table = url.pathname.replace('/rest/v1/', '')
  const call: Call = { method, table, body: init?.body ? JSON.parse(String(init.body)) : undefined }
  const seen = network.calls.filter((c) => c.method === method && c.table === table).length
  network.calls.push(call)

  const failure = network.fail(call, seen)
  if (failure === 'never') {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
    })
  }
  if (failure === 'error') {
    if (method === 'HEAD') return new Response(null, { status: 503 })
    return json({ code: '57014', message: 'canceling statement due to statement timeout', details: null, hint: null }, 500)
  }

  const headers = new Headers(init?.headers)
  const prefer = headers.get('prefer') ?? ''
  const rows = network.rows[table] ?? []
  const total = network.counts[table] ?? rows.length
  const counted: Record<string, string> = prefer.includes('count=') ? { 'content-range': `0-0/${total}` } : {}
  if (method === 'HEAD') return new Response(null, { status: 200, headers: counted })

  let answer = rows
  if (method !== 'GET') {
    if (!prefer.includes('return=representation')) {
      return new Response(null, { status: method === 'POST' ? 201 : 204, headers: counted })
    }
    const written = call.body ?? {}
    answer = (Array.isArray(written) ? written : [written]).map((row) => ({ id: ID, ...(row as Row) }))
  }
  if ((headers.get('accept') ?? '').includes('vnd.pgrst.object')) {
    if (answer.length !== 1) {
      return json({ code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'no rows' }, 406)
    }
    return json(answer[0], method === 'POST' ? 201 : 200, counted)
  }
  return json(answer, method === 'POST' ? 201 : 200, counted)
}

// Captured before any test fakes the timers.
const realSetTimeout = globalThis.setTimeout

type Answer = { status: number; body: unknown; requests: string[]; elapsed: number }

// Runs a route to its answer. Real work (request parsing, session signatures)
// gets real time; fake time then jumps straight to the next pending timer, so
// `elapsed` is the time spent waiting on the database limit.
async function answer(call: () => Promise<Response>): Promise<Answer> {
  const start = Date.now()
  let value: Response | undefined
  let failure: unknown
  let done = false
  call().then(
    (result) => {
      value = result
      done = true
    },
    (error: unknown) => {
      failure = error
      done = true
    },
  )
  let idle = 0
  while (!done) {
    await new Promise((resolve) => realSetTimeout(resolve, 1))
    if (done) break
    if (vi.getTimerCount() === 0) {
      if ((idle += 1) > 2000) throw new Error('route is not waiting on anything')
      continue
    }
    idle = 0
    if (Date.now() - start > 600_000) throw new Error('route did not answer')
    await vi.advanceTimersToNextTimerAsync()
  }
  if (!value) throw failure
  const text = await value.text()
  return {
    status: value.status,
    body: text ? JSON.parse(text) : text,
    requests: network.calls.map((c) => `${c.method} ${c.table}`),
    elapsed: Date.now() - start,
  }
}

let session = ''

const request = (method: string, path: string, body?: unknown) =>
  new NextRequest(`${SITE}/api/${TEST_ADMIN_PATH}/${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json', cookie: `${ADMIN_SESSION_COOKIE}=${session}` },
  })

const isWrite = (line: string) => !line.startsWith('GET ') && !line.startsWith('HEAD ')
const failOn = (method: string, table: string, how: Failure, nth = 0) => (call: Call, seen: number) =>
  call.method === method && call.table === table && seen === nth ? how : undefined

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(new Date('2026-06-01T09:00:00Z'))
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('ADMIN_PATH', TEST_ADMIN_PATH)
  vi.stubEnv('ADMIN_SECRET', TEST_ADMIN_SECRET)
  vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SESSION_SECRET)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
  revalidated.length = 0
  Object.assign(network, { rows: {}, counts: {}, fail: () => undefined, calls: [] })
  session = await signTestSession()
  jar.token = session
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ── Course save ─────────────────────────────────────────────────────────────

const COURSE_READ_FAILED = { error: 'Could not read the current course. Nothing was changed.' }
const saveCourse = async () =>
  (await api('course-factory/save/route.ts')).POST(
    request('POST', 'course-factory/save', {
      title: 'Course',
      slug: 'course',
      chapters: [{ chapterTitle: 'One', lessonRefs: [{ title: 'Lesson', articleIds: [ARTICLE] }] }],
    }),
    { params: {} },
  )
const savedChapter = { id: CHAPTER, course_id: ID, chapter_title: 'Old chapter', chapter_order: 1 }
const savedLesson = { id: LESSON, chapter_id: CHAPTER, course_id: ID, title: 'Old lesson', slug: 'course-ch1-l1', lesson_order: 1 }
const savedLink = { lesson_id: LESSON, article_id: ARTICLE, article_order: 1 }
const existingCourse = () => {
  network.rows = {
    courses: [{ id: ID }],
    course_chapters: [savedChapter],
    course_lessons: [savedLesson],
    course_lesson_articles: [savedLink],
  }
}

describe('course save', () => {
  it('creates a new course as before', async () => {
    const result = await answer(saveCourse)
    expect(result).toEqual({
      status: 200,
      body: { success: true, id: ID },
      requests: [
        'GET courses',
        'POST courses',
        'DELETE course_chapters',
        'POST course_chapters',
        'POST course_lessons',
        'POST course_lesson_articles',
      ],
      elapsed: 0,
    })
  })

  it('reads the whole current course before it saves the new version', async () => {
    existingCourse()
    const result = await answer(saveCourse)
    expect(result).toEqual({
      status: 200,
      body: { success: true, id: ID },
      requests: [
        'GET courses',
        'GET course_chapters',
        'GET course_lessons',
        'GET course_lesson_articles',
        'POST courses',
        'DELETE course_chapters',
        'POST course_chapters',
        'POST course_lessons',
        'POST course_lesson_articles',
      ],
      elapsed: 0,
    })
  })

  it('leaves the course unchanged when it cannot read whether the course exists', async () => {
    existingCourse()
    network.fail = failOn('GET', 'courses', 'error')
    expect(await answer(saveCourse)).toEqual({ status: 500, body: COURSE_READ_FAILED, requests: ['GET courses'], elapsed: 0 })
  })

  it('leaves the course unchanged when the existence check gets no answer', async () => {
    existingCourse()
    network.fail = failOn('GET', 'courses', 'never')
    expect(await answer(saveCourse)).toEqual({
      status: 500,
      body: COURSE_READ_FAILED,
      requests: ['GET courses'],
      elapsed: LIMIT_MS,
    })
  })

  it.each([
    ['chapters', 'course_chapters', 2],
    ['lessons', 'course_lessons', 3],
    ['lesson articles', 'course_lesson_articles', 4],
  ] as const)('leaves the course unchanged when it cannot read the current %s', async (_name, table, reads) => {
    for (const how of ['error', 'never'] as const) {
      existingCourse()
      network.calls = []
      network.fail = failOn('GET', table, how)
      const result = await answer(saveCourse)
      expect(result.status).toBe(500)
      expect(result.body).toEqual(COURSE_READ_FAILED)
      expect(result.requests).toHaveLength(reads)
      expect(result.requests.filter(isWrite)).toEqual([])
      expect(result.elapsed).toBe(how === 'never' ? LIMIT_MS : 0)
    }
  })

  it('treats a course with no chapters yet as a course to update', async () => {
    network.rows = { courses: [{ id: ID }] }
    const result = await answer(saveCourse)
    expect(result.status).toBe(200)
    expect(result.requests).toEqual([
      'GET courses',
      'GET course_chapters',
      'POST courses',
      'DELETE course_chapters',
      'POST course_chapters',
      'POST course_lessons',
      'POST course_lesson_articles',
    ])
  })

  it('puts the whole current course back when the new version cannot be written', async () => {
    existingCourse()
    network.fail = failOn('POST', 'course_chapters', 'error')
    const result = await answer(saveCourse)
    expect(result.status).toBe(500)
    expect(result.body).toEqual({ error: 'Course update failed — your original content has been restored. Please try again.' })
    expect(result.requests.slice(-4)).toEqual([
      'DELETE course_chapters',
      'POST course_chapters',
      'POST course_lessons',
      'POST course_lesson_articles',
    ])
    expect(network.calls.slice(-3).map((c) => c.body)).toEqual([[savedChapter], [savedLesson], [savedLink]])
  })

  it('still says plainly when the course could not be put back', async () => {
    existingCourse()
    // The new chapter and the restored chapters both fail to insert.
    network.fail = (call) => (call.method === 'POST' && call.table === 'course_chapters' ? 'error' : undefined)
    const result = await answer(saveCourse)
    expect(result.status).toBe(500)
    expect(result.body).toEqual({
      error: 'Course update failed and automatic restore was unsuccessful. Please check your course content and contact support.',
      restoreFailed: true,
    })
  })
})

// ── Provider delete ─────────────────────────────────────────────────────────

const deleteProvider = async () =>
  (await api('providers/[slug]/edit/route.ts')).DELETE(request('DELETE', 'providers/example/edit'), {
    params: { slug: 'example' },
  })
const JOBS_CHECK_FAILED = { ok: false, error: "Could not check this provider's jobs. Nothing was deleted." }

describe('provider delete', () => {
  beforeEach(() => {
    network.rows = { job_providers: [{ id: ID, slug: 'example', name: 'Example Jobs' }] }
  })

  it('deletes a provider with no active jobs as before', async () => {
    network.counts = { jobs: 0 }
    expect(await answer(deleteProvider)).toEqual({
      status: 200,
      body: { ok: true },
      requests: ['GET job_providers', 'HEAD jobs', 'DELETE job_providers'],
      elapsed: 0,
    })
  })

  it('keeps a provider that still has active jobs, as before', async () => {
    network.counts = { jobs: 3 }
    expect(await answer(deleteProvider)).toEqual({
      status: 409,
      body: { ok: false, error: 'Cannot delete provider with active jobs — pause it and wait for jobs to expire' },
      requests: ['GET job_providers', 'HEAD jobs'],
      elapsed: 0,
    })
  })

  it('keeps the provider when it cannot count its active jobs', async () => {
    network.fail = failOn('HEAD', 'jobs', 'error')
    expect(await answer(deleteProvider)).toEqual({
      status: 500,
      body: JOBS_CHECK_FAILED,
      requests: ['GET job_providers', 'HEAD jobs'],
      elapsed: 0,
    })
  })

  it('keeps the provider when the job count gets no answer', async () => {
    network.fail = failOn('HEAD', 'jobs', 'never')
    expect(await answer(deleteProvider)).toEqual({
      status: 500,
      body: JOBS_CHECK_FAILED,
      requests: ['GET job_providers', 'HEAD jobs'],
      elapsed: LIMIT_MS,
    })
  })

  it('answers "not found" as before when the provider cannot be read', async () => {
    network.fail = failOn('GET', 'job_providers', 'error')
    expect(await answer(deleteProvider)).toEqual({
      status: 404,
      body: { ok: false, error: 'Provider not found' },
      requests: ['GET job_providers'],
      elapsed: 0,
    })
  })
})

// ── Publishing ──────────────────────────────────────────────────────────────

const NO_CONTENT_ID = { error: 'Could not assign a content ID. Nothing was published.' }

const publishArticle = async () =>
  (await api('articles/publish/route.ts')).POST(
    request('POST', 'articles/publish', { article: { title: 'Title', content: 'Body', slug: 'title' } }),
    { params: {} },
  )
const publishGenerated = async () =>
  (await api('content-factory/publish/route.ts')).POST(
    request('POST', 'content-factory/publish', {
      content: '# Heading\n\nSome text.',
      topic: 'Topic',
      qualification: 'ACCA',
      contentType: 'Article',
      canonicalOwner: 'accountingbody',
      showOnSites: ['accountingbody'],
    }),
    { params: {} },
  )
const publishQuestions = async (articleSlug?: string) =>
  (await api('questions/publish/route.ts')).POST(
    request('POST', 'questions/publish', {
      bundle: { title: 'Set', questions: [{ questionText: 'Q', options: ['a', 'b', 'c', 'd'], correctIndex: 0 }] },
      ...(articleSlug ? { articleSlug } : {}),
    }),
    { params: {} },
  )

const articleAnswer = (contentId: string) => ({
  success: true,
  documentId: ID,
  contentId,
  title: 'Title',
  slug: 'title',
})
const generatedAnswer = (contentId: string) => ({
  success: true,
  documentId: ID,
  contentId,
  title: 'Heading',
  slug: 'heading',
  showOnSites: ['accountingbody'],
  canonicalOwner: 'accountingbody',
})
const questionsAnswer = (contentId: string) => ({
  success: true,
  documentId: ID,
  contentId,
  title: 'Set',
  slug: 'set',
  questionCount: 1,
})

describe.each([
  {
    name: 'article publish',
    publish: () => publishArticle(),
    table: 'articles',
    last: 'AB-ART-00041',
    first: articleAnswer('AB-ART-00001'),
    next: articleAnswer('AB-ART-00042'),
    writes: ['POST articles'],
  },
  {
    name: 'generated article publish',
    publish: () => publishGenerated(),
    table: 'articles',
    last: 'AB-ART-00041',
    first: generatedAnswer('AB-ART-00001'),
    next: generatedAnswer('AB-ART-00042'),
    writes: ['POST articles'],
  },
  {
    name: 'question set publish',
    publish: () => publishQuestions(),
    table: 'question_sets',
    last: 'AB-QZ-00041',
    first: questionsAnswer('AB-QZ-00001'),
    next: questionsAnswer('AB-QZ-00042'),
    writes: ['POST question_sets', 'POST questions'],
  },
])('$name', ({ publish, table, last, first, next, writes }) => {
  it('gives the first content ID when there is no content yet, as before', async () => {
    expect(await answer(publish)).toEqual({ status: 200, body: first, requests: [`GET ${table}`, ...writes], elapsed: 0 })
  })

  it('gives the next content ID in sequence, as before', async () => {
    network.rows = { [table]: [{ content_id: last }] }
    expect(await answer(publish)).toEqual({ status: 200, body: next, requests: [`GET ${table}`, ...writes], elapsed: 0 })
  })

  it('publishes nothing when it cannot read the last content ID', async () => {
    network.rows = { [table]: [{ content_id: last }] }
    network.fail = failOn('GET', table, 'error')
    expect(await answer(publish)).toEqual({ status: 500, body: NO_CONTENT_ID, requests: [`GET ${table}`], elapsed: 0 })
    expect(revalidated).toEqual([])
  })

  it('publishes nothing when the content ID lookup gets no answer', async () => {
    network.rows = { [table]: [{ content_id: last }] }
    network.fail = failOn('GET', table, 'never')
    expect(await answer(publish)).toEqual({
      status: 500,
      body: NO_CONTENT_ID,
      requests: [`GET ${table}`],
      elapsed: LIMIT_MS,
    })
  })
})

describe('question set publish with a linked article', () => {
  const NO_ARTICLE = { error: 'Could not read the linked article. Nothing was published.' }

  it('links the set to the article it names, as before', async () => {
    network.rows = { articles: [{ slug: 'linked-article' }] }
    const result = await answer(() => publishQuestions('AB-ART-00007'))
    expect(result).toEqual({
      status: 200,
      body: questionsAnswer('AB-QZ-00001'),
      requests: ['GET question_sets', 'GET articles', 'POST question_sets', 'POST questions', 'PATCH articles'],
      elapsed: 0,
    })
    expect((network.calls[2].body as Row).article_slug).toBe('linked-article')
  })

  it('publishes the set without a link when no article has that ID, as before', async () => {
    const result = await answer(() => publishQuestions('AB-ART-00007'))
    expect(result).toEqual({
      status: 200,
      body: questionsAnswer('AB-QZ-00001'),
      requests: ['GET question_sets', 'GET articles', 'POST question_sets', 'POST questions'],
      elapsed: 0,
    })
    expect((network.calls[2].body as Row).article_slug).toBeNull()
  })

  it.each(['error', 'never'] as const)('publishes nothing when it cannot read the linked article (%s)', async (how) => {
    network.rows = { articles: [{ slug: 'linked-article' }] }
    network.fail = failOn('GET', 'articles', how)
    expect(await answer(() => publishQuestions('AB-ART-00007'))).toEqual({
      status: 500,
      body: NO_ARTICLE,
      requests: ['GET question_sets', 'GET articles'],
      elapsed: how === 'never' ? LIMIT_MS : 0,
    })
  })

  it('publishes nothing when the article ID matches more than one article', async () => {
    network.rows = { articles: [{ slug: 'first' }, { slug: 'second' }] }
    expect(await answer(() => publishQuestions('AB-ART-00007'))).toEqual({
      status: 500,
      body: NO_ARTICLE,
      requests: ['GET question_sets', 'GET articles'],
      elapsed: 0,
    })
  })
})

// ── Studio session save ─────────────────────────────────────────────────────

const SESSION_CHECK_FAILED = { error: 'Could not check this session. Nothing was saved.' }
const saveSession = async () =>
  (await api('studio/session/route.ts')).PATCH(request('PATCH', 'studio/session', { pq_tasks: [{ id: 'task' }] }), {
    params: {},
  })

describe('studio session save', () => {
  it("updates today's session when it exists, as before", async () => {
    network.rows = { studio_sessions: [{ id: ID }] }
    const result = await answer(saveSession)
    expect(result).toEqual({
      status: 200,
      body: { session: { id: ID, updated_at: '2026-06-01T09:00:00.000Z', pq_tasks: [{ id: 'task' }] } },
      requests: ['GET studio_sessions', 'PATCH studio_sessions'],
      elapsed: 0,
    })
  })

  it("creates today's session when there is none yet, as before", async () => {
    const result = await answer(saveSession)
    expect(result.status).toBe(200)
    expect(result.requests).toEqual(['GET studio_sessions', 'POST studio_sessions'])
    expect((network.calls[1].body as Row).session_date).toBe('2026-06-01')
    expect((network.calls[1].body as Row).pq_tasks).toEqual([{ id: 'task' }])
  })

  it.each(['error', 'never'] as const)('saves nothing when the session cannot be checked (%s)', async (how) => {
    network.rows = { studio_sessions: [{ id: ID }] }
    network.fail = failOn('GET', 'studio_sessions', how)
    expect(await answer(saveSession)).toEqual({
      status: 500,
      body: SESSION_CHECK_FAILED,
      requests: ['GET studio_sessions'],
      elapsed: how === 'never' ? LIMIT_MS : 0,
    })
  })

  it('saves nothing when more than one session matches today', async () => {
    network.rows = { studio_sessions: [{ id: ID }, { id: CHAPTER }] }
    expect(await answer(saveSession)).toEqual({
      status: 500,
      body: SESSION_CHECK_FAILED,
      requests: ['GET studio_sessions'],
      elapsed: 0,
    })
  })
})

// ── Next position for new items ─────────────────────────────────────────────

const NO_POSITION = { error: 'Could not work out the next position. Nothing was added.' }
const COURSE_CHECK_FAILED = { error: 'Could not check this course. Nothing was changed.' }
const OTHER_CHAPTER = '2c5e39cb-3fb2-12e3-994f-1127e4ddb538'
const OTHER_LESSON = '7ab56afb-ff9b-4db5-9a5f-ec88f271466f'

const addQuestion = (body: Row = { question_text: 'Question?' }) => async () =>
  (await api('questions/[setId]/route.ts')).POST(request('POST', `questions/${ID}`, body), { params: { setId: ID } })
const addReference = async () =>
  (await api('studio/references/route.ts')).POST(
    request('POST', 'studio/references', { label: 'BBC', url: 'https://bbc.com' }),
    { params: {} },
  )
const courseAction = (body: Row) => async () =>
  (await api('courses/[courseId]/route.ts')).PATCH(request('PATCH', `courses/${ID}`, body), { params: { courseId: ID } })

const chapterRow = { id: CHAPTER, chapter_order: 2 }
const lessonRow = { id: LESSON }

type Rows = Record<string, Row[]>
type NextPositionCase = {
  name: string
  call: () => Promise<Response>
  rows: Rows
  reads: string[]
  table: string
  last: Row
  field: string
}
type CourseCheckCase = { name: string; body: Row; table: string; rows: Rows; notFound: { error: string }; writes: string[] }
type ListCheckCase = {
  name: string
  body: Row
  before: string[]
  rows: Rows
  table: string
  owned: Row[]
  forbidden: { error: string }
}

describe.each<NextPositionCase>([
  {
    name: 'question add',
    call: addQuestion(),
    rows: { question_sets: [{ id: ID }] },
    reads: ['GET question_sets'],
    table: 'questions',
    last: { question_order: 4 },
    field: 'question_order',
  },
  {
    name: 'chapter add',
    call: courseAction({ action: 'add_chapter' }),
    rows: {},
    reads: [],
    table: 'course_chapters',
    last: { chapter_order: 3 },
    field: 'chapter_order',
  },
  {
    name: 'lesson add',
    call: courseAction({ action: 'add_lesson', chapterId: CHAPTER, title: 'Lesson' }),
    rows: { course_chapters: [chapterRow] },
    reads: ['GET course_chapters'],
    table: 'course_lessons',
    last: { lesson_order: 5 },
    field: 'lesson_order',
  },
  {
    name: 'article link add',
    call: courseAction({ action: 'add_article', lessonId: LESSON, articleId: ARTICLE }),
    rows: { course_lessons: [lessonRow] },
    reads: ['GET course_lessons'],
    table: 'course_lesson_articles',
    last: { article_order: 2 },
    field: 'article_order',
  },
])('$name', ({ call, rows, reads, table, last, field }) => {
  it('starts at 1 when there is nothing yet, as before', async () => {
    network.rows = rows
    const result = await answer(call)
    expect(result.status).toBe(200)
    expect(result.requests).toEqual([...reads, `GET ${table}`, `POST ${table}`])
    expect((network.calls.at(-1)?.body as Row)[field]).toBe(1)
  })

  it('continues numbering from the last item, as before', async () => {
    network.rows = { ...rows, [table]: [last] }
    const result = await answer(call)
    expect(result.status).toBe(200)
    expect(result.requests).toEqual([...reads, `GET ${table}`, `POST ${table}`])
    expect((network.calls.at(-1)?.body as Row)[field]).toBe(Number(Object.values(last)[0]) + 1)
  })

  it.each(['error', 'never'] as const)('adds nothing when the next position cannot be worked out (%s)', async (how) => {
    network.rows = { ...rows, [table]: [last] }
    network.fail = failOn('GET', table, how)
    const result = await answer(call)
    expect(result).toEqual({
      status: 500,
      body: NO_POSITION,
      requests: [...reads, `GET ${table}`],
      elapsed: how === 'never' ? LIMIT_MS : 0,
    })
    expect(result.requests.filter(isWrite)).toEqual([])
  })
})

describe('question add', () => {
  it('keeps the missing question text answer when the position is known', async () => {
    network.rows = { question_sets: [{ id: ID }] }
    expect(await answer(addQuestion({}))).toEqual({
      status: 400,
      body: { error: 'question_text is required' },
      requests: ['GET question_sets', 'GET questions'],
      elapsed: 0,
    })
  })

  it('stops at the position check before looking at the question text', async () => {
    network.rows = { question_sets: [{ id: ID }] }
    network.fail = failOn('GET', 'questions', 'error')
    expect(await answer(addQuestion({}))).toEqual({
      status: 500,
      body: NO_POSITION,
      requests: ['GET question_sets', 'GET questions'],
      elapsed: 0,
    })
  })
})

describe('reference add', () => {
  it('places the new reference at the current count, as before', async () => {
    network.counts = { studio_references: 3 }
    const result = await answer(addReference)
    expect(result.status).toBe(200)
    expect(result.requests).toEqual(['HEAD studio_references', 'POST studio_references'])
    expect((network.calls[1].body as Row).display_order).toBe(3)
  })

  it('places the first reference at 0, as before', async () => {
    network.counts = { studio_references: 0 }
    const result = await answer(addReference)
    expect(result.status).toBe(200)
    expect((network.calls[1].body as Row).display_order).toBe(0)
  })

  it('places a reference after the nine starting sources at 9, as before', async () => {
    network.counts = { studio_references: 9 }
    await answer(addReference)
    expect((network.calls[1].body as Row).display_order).toBe(9)
  })

  it.each(['error', 'never'] as const)('adds nothing when the references cannot be counted (%s)', async (how) => {
    network.counts = { studio_references: 3 }
    network.fail = failOn('HEAD', 'studio_references', how)
    expect(await answer(addReference)).toEqual({
      status: 500,
      body: NO_POSITION,
      requests: ['HEAD studio_references'],
      elapsed: how === 'never' ? LIMIT_MS : 0,
    })
  })
})

// ── Course checks before a change ───────────────────────────────────────────

describe.each<CourseCheckCase>([
  {
    name: 'chapter delete',
    body: { action: 'delete_chapter', chapterId: CHAPTER },
    table: 'course_chapters',
    rows: { course_chapters: [chapterRow] },
    notFound: { error: 'Chapter not found' },
    writes: ['DELETE course_chapters'],
  },
  {
    name: 'lesson add',
    body: { action: 'add_lesson', chapterId: CHAPTER, title: 'Lesson' },
    table: 'course_chapters',
    rows: { course_chapters: [chapterRow] },
    notFound: { error: 'Chapter not found' },
    writes: ['GET course_lessons', 'POST course_lessons'],
  },
  {
    name: 'lesson delete',
    body: { action: 'delete_lesson', lessonId: LESSON },
    table: 'course_lessons',
    rows: { course_lessons: [lessonRow] },
    notFound: { error: 'Lesson not found' },
    writes: ['DELETE course_lessons'],
  },
  {
    name: 'lesson reorder',
    body: { action: 'reorder_lessons', chapterId: CHAPTER, orderedIds: [LESSON, OTHER_LESSON] },
    table: 'course_chapters',
    rows: { course_chapters: [chapterRow], course_lessons: [{ id: LESSON }, { id: OTHER_LESSON }] },
    notFound: { error: 'Chapter not found' },
    writes: ['GET course_lessons', 'PATCH course_lessons', 'PATCH course_lessons'],
  },
  {
    name: 'article link add',
    body: { action: 'add_article', lessonId: LESSON, articleId: ARTICLE },
    table: 'course_lessons',
    rows: { course_lessons: [lessonRow] },
    notFound: { error: 'Lesson not found' },
    writes: ['GET course_lesson_articles', 'POST course_lesson_articles'],
  },
  {
    name: 'article link remove',
    body: { action: 'remove_article', lessonId: LESSON, articleId: ARTICLE },
    table: 'course_lessons',
    rows: { course_lessons: [lessonRow] },
    notFound: { error: 'Lesson not found' },
    writes: ['DELETE course_lesson_articles'],
  },
  {
    name: 'article reorder',
    body: { action: 'reorder_articles', lessonId: LESSON, orderedIds: [ARTICLE] },
    table: 'course_lessons',
    rows: { course_lessons: [lessonRow] },
    notFound: { error: 'Lesson not found' },
    writes: ['PATCH course_lesson_articles'],
  },
])('$name', ({ body, table, rows, notFound, writes }) => {
  it('goes ahead when the item belongs to the course, as before', async () => {
    network.rows = rows
    const result = await answer(courseAction(body))
    expect(result.status).toBe(200)
    expect(result.requests).toEqual([`GET ${table}`, ...writes])
  })

  it('keeps the not found answer for an item that is not in the course', async () => {
    expect(await answer(courseAction(body))).toEqual({
      status: 404,
      body: notFound,
      requests: [`GET ${table}`],
      elapsed: 0,
    })
  })

  it.each(['error', 'never'] as const)('changes nothing when the course cannot be checked (%s)', async (how) => {
    network.rows = rows
    network.fail = failOn('GET', table, how)
    expect(await answer(courseAction(body))).toEqual({
      status: 500,
      body: COURSE_CHECK_FAILED,
      requests: [`GET ${table}`],
      elapsed: how === 'never' ? LIMIT_MS : 0,
    })
  })
})

describe.each<ListCheckCase>([
  {
    name: 'chapter reorder',
    body: { action: 'reorder_chapters', orderedIds: [CHAPTER, OTHER_CHAPTER] },
    before: [],
    rows: {},
    table: 'course_chapters',
    owned: [{ id: CHAPTER }, { id: OTHER_CHAPTER }],
    forbidden: { error: 'One or more chapters do not belong to this course' },
  },
  {
    name: 'lesson reorder',
    body: { action: 'reorder_lessons', chapterId: CHAPTER, orderedIds: [LESSON, OTHER_LESSON] },
    before: ['GET course_chapters'],
    rows: { course_chapters: [chapterRow] },
    table: 'course_lessons',
    owned: [{ id: LESSON }, { id: OTHER_LESSON }],
    forbidden: { error: 'One or more lessons do not belong to this chapter' },
  },
])('$name list check', ({ body, before, rows, table, owned, forbidden }) => {
  it('saves the new order when every item belongs, as before', async () => {
    network.rows = { ...rows, [table]: owned }
    const result = await answer(courseAction(body))
    expect(result).toEqual({
      status: 200,
      body: { success: true },
      requests: [...before, `GET ${table}`, `PATCH ${table}`, `PATCH ${table}`],
      elapsed: 0,
    })
    expect(network.calls.slice(-2).map((c) => c.body)).toEqual(
      table === 'course_chapters' ? [{ chapter_order: 1 }, { chapter_order: 2 }] : [{ lesson_order: 1 }, { lesson_order: 2 }],
    )
  })

  it.each([
    ['one item belongs elsewhere', 1],
    ['no item belongs', 0],
  ])('keeps the forbidden answer when %s', async (_name, kept) => {
    network.rows = { ...rows, [table]: owned.slice(0, kept) }
    expect(await answer(courseAction(body))).toEqual({
      status: 403,
      body: forbidden,
      requests: [...before, `GET ${table}`],
      elapsed: 0,
    })
  })

  it.each(['error', 'never'] as const)('changes nothing when the items cannot be checked (%s)', async (how) => {
    network.rows = { ...rows, [table]: owned }
    network.fail = failOn('GET', table, how)
    expect(await answer(courseAction(body))).toEqual({
      status: 500,
      body: COURSE_CHECK_FAILED,
      requests: [...before, `GET ${table}`],
      elapsed: how === 'never' ? LIMIT_MS : 0,
    })
  })
})

describe('admin tools answer a signed-out request before reading', () => {
  it.each([
    ['studio session save', saveSession],
    ['question add', addQuestion()],
    ['reference add', addReference],
    ['course change', courseAction({ action: 'add_chapter' })],
  ])('%s', async (_name, call) => {
    session = 'not-a-session'
    jar.token = undefined
    expect(await answer(call)).toEqual({ status: 401, body: { error: 'Signed out' }, requests: [], elapsed: 0 })
  })
})
