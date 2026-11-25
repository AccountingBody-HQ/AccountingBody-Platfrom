import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildCourse, fetchQuestions, READ_FAILED, type BuildStats } from './ab-press-builder'
import { TEST_ADMIN_SECRET, TEST_SESSION_SECRET, signTestSession } from './admin-session-fixtures'
import { ADMIN_SESSION_COOKIE, getAdminPath } from './middleware-logic'

// AB Press reads live practice sets only (owner decision D341), and a read of
// the sets or questions that fails is never taken for "none" (D342). The first
// part reads the text of every AB Press file. The second part runs the shared
// builder and the routes on a fake network; only the PDF maker is replaced.

const state = vi.hoisted(() => ({
  // How a table's reads fail: an error answer, or no data and no error.
  failing: {} as Record<string, 'error' | 'empty'>,
  pdfs: 0,
  written: [] as string[],
  // Course slug to the article names of each lesson.
  lessons: {} as Record<string, string[][]>,
}))

vi.mock('@/lib/coursesNew', () => ({
  getCourseBySlug: async (slug: string) => ({
    id: slug,
    title: 'Course',
    slug,
    chapters: [
      {
        id: 'chapter',
        title: 'Chapter',
        chapterOrder: 1,
        lessons: (state.lessons[slug] ?? [['live', 'draft', 'unset', 'gone']]).map((names) => ({
          id: 'lesson',
          title: 'Lesson',
          slug: 'lesson',
          articles: names.map((name) => ({ id: `a-${name}`, title: name, slug: name })),
        })),
      },
    ],
  }),
}))

vi.mock('@react-pdf/renderer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@react-pdf/renderer')>()),
  renderToBuffer: async () => {
    state.pdfs += 1
    return Buffer.from('/Type /Page ')
  },
}))

// The folder comes from the app's own default, so its name is not repeated here.
vi.stubEnv('ADMIN_PATH', undefined)
const ADMIN = getAdminPath()
vi.unstubAllEnvs()

const ROOT = process.cwd()
const SOURCE = /\.(ts|tsx)$/
const TEST = /\.test\.tsx?$/

function filesUnder(dir: string): string[] {
  if (!existsSync(join(ROOT, dir))) return []
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`],
  )
}

const FILES = [
  ...readdirSync(join(ROOT, 'lib'))
    .filter((name) => name.startsWith('ab-press'))
    .map((name) => `lib/${name}`),
  ...filesUnder(`app/api/${ADMIN}/ab-press`),
  ...filesUnder(`app/${ADMIN}/ab-press`),
  ...filesUnder('components/book'),
].filter((path) => SOURCE.test(path) && !TEST.test(path))

const label = (path: string) => path.split(`/${ADMIN}/`).join('/@admin/')

// One entry per from('question_sets') in the text: does its own chain carry
// eq('status', 'published')? Either quote form counts; a comment does not.
function setReads(source: string): boolean[] {
  const file = ts.createSourceFile('x.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const text = (node: ts.Node | undefined) => (node && ts.isStringLiteralLike(node) ? node.text : null)
  const reads: boolean[] = []
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'from' &&
      text(node.arguments[0]) === 'question_sets'
    ) {
      let live = false
      let link: ts.Node = node
      while (ts.isPropertyAccessExpression(link.parent) && link.parent.expression === link) {
        const call: ts.Node = link.parent.parent
        if (!ts.isCallExpression(call) || call.expression !== link.parent) break
        if (
          link.parent.name.text === 'eq' &&
          text(call.arguments[0]) === 'status' &&
          text(call.arguments[1]) === 'published'
        ) {
          live = true
        }
        link = call
      }
      reads.push(live)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return reads
}

describe('AB Press queries on question_sets', () => {
  it('are found in these files, and every one is limited to live sets', () => {
    const found: Record<string, boolean[]> = {}
    for (const path of FILES) {
      const reads = setReads(readFileSync(join(ROOT, path), 'utf8'))
      if (reads.length > 0) found[label(path)] = reads
    }
    expect(found).toEqual({
      'lib/ab-press-builder.ts': [true, true],
      'app/api/@admin/ab-press/generate-answers/route.tsx': [true],
      'app/api/@admin/ab-press/generate-chapter/route.ts': [true],
      'app/api/@admin/ab-press/preview/route.ts': [true],
    })
  })

  it('no other form of the table name is used', () => {
    // A quoted name that is not a from() call the check above can see.
    for (const path of FILES) {
      const source = readFileSync(join(ROOT, path), 'utf8')
      const quoted = source.match(/(["'`])question_sets\b[^"'`]*\1/g) ?? []
      expect(quoted.length, label(path)).toBe(setReads(source).length)
    }
  })

  it('the check recognises a filter on the chain, and nothing else', () => {
    const table = `db.from('question_sets')`
    expect(setReads(`${table}.select('id').in('slug', s).eq('status', 'published')`)).toEqual([true])
    expect(setReads(`db.from("question_sets").select("id").eq("status", "published").maybeSingle()`)).toEqual([true])
    for (const source of [
      `${table}.select('id').eq('slug', s)`,
      `${table}.select('id') // .eq('status', 'published')`,
      `${table}.select('id').eq('status', 'draft')`,
      `${table}.select('id').neq('status', 'published')`,
      `${table}.select('id'); db.from('articles').select('id').eq('status', 'published')`,
      `${table}.select(other.eq('status', 'published'))`,
    ]) {
      expect(setReads(source), source).toEqual([false])
    }
  })
})

// One entry per from('question_sets') or from('questions') in the text: does
// its own await take the result's error, and does a following if on that error
// throw? Any other shape counts as unchecked.
function readsChecked(source: string): boolean[] {
  const file = ts.createSourceFile('x.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const reads: boolean[] = []
  const has = (node: ts.Node, test: (inner: ts.Node) => boolean): boolean =>
    test(node) || (ts.forEachChild(node, (inner) => has(inner, test) || undefined) ?? false)
  const visit = (node: ts.Node) => {
    const table = ts.isCallExpression(node) ? node.arguments[0] : undefined
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'from' &&
      table &&
      ts.isStringLiteralLike(table) &&
      ['question_sets', 'questions'].includes(table.text)
    ) {
      let link: ts.Node = node
      while (ts.isPropertyAccessExpression(link.parent) && link.parent.expression === link && ts.isCallExpression(link.parent.parent)) {
        link = link.parent.parent
      }
      const declaration = ts.isAwaitExpression(link.parent) ? link.parent.parent : undefined
      let name = ''
      if (declaration && ts.isVariableDeclaration(declaration) && ts.isObjectBindingPattern(declaration.name)) {
        for (const element of declaration.name.elements) {
          if ((element.propertyName ?? element.name).getText() === 'error') name = element.name.getText()
        }
      }
      const statement = declaration?.parent.parent
      const block = statement?.parent
      const following =
        block && (ts.isBlock(block) || ts.isSourceFile(block))
          ? block.statements.slice(block.statements.indexOf(statement as ts.Statement) + 1)
          : []
      reads.push(
        name !== '' &&
          following.some(
            (next) =>
              ts.isIfStatement(next) &&
              has(next.expression, (inner) => ts.isIdentifier(inner) && inner.text === name) &&
              has(next.thenStatement, ts.isThrowStatement),
          ),
      )
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return reads
}

describe('AB Press reads of question_sets and questions', () => {
  it('are found in these files, and every one checks its error', () => {
    const found: Record<string, boolean[]> = {}
    for (const path of FILES) {
      const reads = readsChecked(readFileSync(join(ROOT, path), 'utf8'))
      if (reads.length > 0) found[label(path)] = reads
    }
    expect(found).toEqual({
      'lib/ab-press-builder.ts': [true, true, true, true],
      'app/api/@admin/ab-press/generate-answers/route.tsx': [true, true],
      'app/api/@admin/ab-press/generate-chapter/route.ts': [true, true],
      'app/api/@admin/ab-press/preview/route.ts': [true, true],
    })
  })

  it('the check recognises a tested error, and nothing else', () => {
    const read = `await db.from('questions').select('id').in('set_id', s)`
    expect(readsChecked(`const { data, error } = ${read}; if (error) throw error`)).toEqual([true])
    expect(readsChecked(`const { data, error: e } = ${read}; if (e || !data) { log(e); throw new Error('x') }`)).toEqual([true])
    for (const source of [
      `const { data } = ${read}`,
      `const { data, error } = ${read}`,
      `const { data, error } = ${read}; if (error) log(error)`,
      `const { data, error: e } = ${read}; if (error) throw error`,
      `const { data, error } = ${read}; // if (error) throw error`,
      `if (error) throw error; const { data, error } = ${read}`,
      `const result = ${read}; if (result.error) throw result.error`,
    ]) {
      expect(readsChecked(source), source).toEqual([false])
    }
  })
})

type Row = Record<string, string | number | null>

const set = (name: string, status: string | null, articleSlug = name, platform = 'ab'): Row => ({
  id: `s-${name}`,
  slug: name,
  status,
  article_slug: articleSlug,
  platform,
})
const question = (name: string): Row => ({
  set_id: `s-${name}`,
  question_text: `Q ${name}`,
  option_a: 'A',
  option_b: 'B',
  option_c: null,
  option_d: null,
  correct_index: 0,
  explanation: null,
  question_order: 1,
})

const article = (name: string, link: string | null = `/practice-questions/${name}`): Row => ({ id: `a-${name}`, content: '', mcq_url: link })

const TABLES: Record<string, Row[]> = {
  articles: [
    ...['live', 'draft', 'unset', 'gone', 'other', 'foreign'].map((name) => article(name)),
    article('twin', 'https://example.com/practice-questions/live/'),
    article('plain', null),
  ],
  question_sets: [
    set('live', 'published'),
    set('draft', 'draft'),
    set('unset', null),
    // Linked by article 'other', but the set names another article.
    set('other', 'published', 'elsewhere'),
    set('foreign', 'published', 'foreign', 'et'),
    // Names article 'live', but no article links to it.
    set('stray', 'published', 'live'),
  ],
  questions: ['live', 'draft', 'unset', 'other', 'other', 'foreign', 'foreign', 'foreign', 'stray', 'stray', 'stray', 'stray'].map(question),
}

// Answers a GET as the database would, with its eq and in filters. A HEAD gets
// the number of rows; a write is noted.
async function fakeDatabase(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : String(input))
  const method = input instanceof Request ? input.method : (init?.method ?? 'GET')
  const table = url.pathname.split('/').pop() ?? ''
  if (method === 'POST') {
    state.written.push(table)
    return new Response(null, { status: 201 })
  }
  if (state.failing[table] === 'empty') return new Response('', { status: 404 })
  if (state.failing[table] === 'error') {
    const body = method === 'HEAD' ? null : JSON.stringify({ code: 'XX000', message: 'private detail', details: null, hint: null })
    return new Response(body, { status: 500, headers: { 'content-type': 'application/json' } })
  }
  let rows = TABLES[table] ?? []
  url.searchParams.forEach((value, column) => {
    if (value.startsWith('eq.')) rows = rows.filter((row) => String(row[column]) === value.slice(3) && row[column] !== null)
    if (value.startsWith('in.(')) {
      const wanted = value.slice(4, -1).split(',')
      rows = rows.filter((row) => wanted.includes(String(row[column])))
    }
  })
  if (method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-range': `*/${rows.length}` } })
  return new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } })
}

beforeEach(() => {
  state.failing = {}
  state.lessons = {}
  state.pdfs = 0
  state.written = []
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://db.invalid')
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('ADMIN_SECRET', TEST_ADMIN_SECRET)
  vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SESSION_SECRET)
  vi.stubGlobal('fetch', vi.fn(fakeDatabase))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

// Calls a route of the AB Press API as a signed-in admin.
async function callRoute(name: string, request: { query?: string; body?: object }): Promise<Response> {
  const handlers = await import(/* @vite-ignore */ join(ROOT, 'app', 'api', ADMIN, 'ab-press', name, name === 'generate-answers' ? 'route.tsx' : 'route.ts'))
  const req = new NextRequest(`http://localhost/x${request.query ?? ''}`, {
    method: request.body ? 'POST' : 'GET',
    headers: { cookie: `${ADMIN_SESSION_COOKIE}=${await signTestSession()}` },
    ...(request.body ? { body: JSON.stringify(request.body) } : {}),
  })
  return request.body ? handlers.POST(req) : handlers.GET(req)
}

describe('the shared builder', () => {
  it('a book takes the questions of a live set; any other set is as a missing one', async () => {
    const stats: BuildStats = { mcqFailed: [], mcqNotFound: [] }
    const course = await buildCourse('course', stats)
    const articles = course.chapters[0].lessons[0].linkedArticles
    expect(articles.map((article) => [article.slug, article.quizQuestions.length])).toEqual([
      ['live', 1],
      ['draft', 0],
      ['unset', 0],
      ['gone', 0],
    ])
    expect(articles[0].quizQuestions[0].questionText).toBe('Q live')
    expect(stats).toEqual({ mcqFailed: [], mcqNotFound: ['draft', 'unset', 'gone'] })
  })

  it('one article: the same', async () => {
    const stats: BuildStats = { mcqFailed: [], mcqNotFound: [] }
    expect(await fetchQuestions('/practice-questions/live', stats)).toHaveLength(1)
    for (const name of ['draft', 'unset', 'gone']) {
      expect(await fetchQuestions(`/practice-questions/${name}`, stats)).toEqual([])
    }
    expect(stats).toEqual({ mcqFailed: [], mcqNotFound: ['draft', 'unset', 'gone'] })
  })

  it.each(['question_sets', 'questions'])('one article: a failed %s read is a failed fetch, not a missing set', async (table) => {
    state.failing = { [table]: 'error' }
    const stats: BuildStats = { mcqFailed: [], mcqNotFound: [] }
    expect(await fetchQuestions('/practice-questions/live', stats)).toEqual([])
    expect(stats).toEqual({ mcqFailed: ['live'], mcqNotFound: [] })
  })
})

describe('the preview question count', () => {
  const bookCount = async (slug: string) => {
    const course = await buildCourse(slug, { mcqFailed: [], mcqNotFound: [] })
    return course.chapters
      .flatMap((chapter) => chapter.lessons.flatMap((lesson) => lesson.linkedArticles))
      .reduce((sum, linked) => sum + linked.quizQuestions.length, 0)
  }

  it.each<[string, string[][], number]>([
    ['a live set', [['live']], 1],
    ['a draft set, a set with no status and a missing set', [['draft', 'unset', 'gone']], 0],
    ['a set that names another article', [['other']], 2],
    ['a set of another site', [['foreign']], 3],
    ['an article without a link', [['plain']], 0],
    ['no articles', [[]], 0],
    ['a set printed more than once', [['live', 'twin'], ['live', 'other']], 5],
    ['all of them', [['live', 'draft', 'unset', 'gone', 'other'], ['live', 'twin', 'plain', 'foreign']], 8],
  ])('is the number of questions in the book: %s', async (_name, lessons, expected) => {
    state.lessons = { counted: lessons }
    const body = await (await callRoute('preview', { query: '?slug=counted' })).json()
    expect(body.stats).toMatchObject({ questionCount: expected, questionCountError: false })
    expect(await bookCount('counted')).toBe(expected)
  })
})

describe('a failed read of the practice questions', () => {
  const MAKERS: [string, object][] = [
    ['generate', { slug: 'course', bookType: 'combined' }],
    ['generate', { slug: 'course', bookType: 'study' }],
    ['generate-pq', { slug: 'course' }],
    ['export-word', { slug: 'course', bookType: 'combined' }],
    ['generate-chapter', { slug: 'course', bookType: 'combined', chapterIndex: 0 }],
    ['generate-answers', { slug: 'course' }],
    ['generate-answers', { slug: 'course', chapterIndex: 0 }],
  ]

  it('has its exact message', () => {
    expect(READ_FAILED).toBe('Could not read the practice questions, so nothing was made. Please try again in a minute.')
  })

  it.each(MAKERS)('%s %o makes a file when every read works', async (name, body) => {
    const response = await callRoute(name, { body })
    expect(response.status).toBe(200)
    if (name !== 'export-word') expect(state.pdfs).toBeGreaterThan(0)
  })

  for (const table of ['question_sets', 'questions']) {
    for (const how of ['error', 'empty'] as const) {
      it.each(MAKERS)(`${table} (${how}): %s %o answers 500 and makes nothing`, async (name, body) => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        state.failing = { [table]: how }
        const response = await callRoute(name, { body })
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({ error: READ_FAILED })
        expect(state.pdfs).toBe(0)
        expect(state.written).toEqual([])
        expect(log).toHaveBeenCalledTimes(1)
        expect(String(log.mock.calls[0][0])).toContain(`${table} read failed`)
      })

      it(`${table} (${how}): the preview answers, with the count unknown`, async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        state.failing = { [table]: how }
        const response = await callRoute('preview', { query: '?slug=course' })
        expect(response.status).toBe(200)
        const body = await response.json()
        expect(body.stats).toMatchObject({ questionCountError: true, questionCount: 0, articleCount: 4 })
        expect(JSON.stringify(body)).not.toContain('private detail')
        expect(log).toHaveBeenCalledTimes(1)
      })
    }
  }

  it('a failed read of the practice links makes the preview count unknown too', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    for (const how of ['error', 'empty'] as const) {
      state.failing = { articles: how }
      const response = await callRoute('preview', { query: '?slug=course' })
      expect(response.status).toBe(200)
      expect((await response.json()).stats).toMatchObject({ questionCountError: true, questionCount: 0 })
    }
  })

  it('the preview says nothing about it when the reads work', async () => {
    const body = await (await callRoute('preview', { query: '?slug=course' })).json()
    expect(body.stats.questionCountError).toBe(false)
  })

  it('the preview screen shows a dash and the exact message', () => {
    const page = readFileSync(join(ROOT, 'app', ADMIN, 'ab-press', 'page.tsx'), 'utf8')
    expect(page).toContain(
      `const PREVIEW_COUNT_FAILED = 'Question count unavailable (the practice questions could not be read).'\n`,
    )
    expect(page).toContain(`{ val: stats.questionCountError ? '—' : stats.questionCount, label: 'Practice Qs' },`)
    expect(page).toContain(
      `{stats.questionCountError ? <p className="text-red-400 text-xs mt-2">{PREVIEW_COUNT_FAILED}</p> : null}`,
    )
  })
})
