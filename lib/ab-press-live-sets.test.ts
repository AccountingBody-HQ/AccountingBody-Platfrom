import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ARTICLES_READ_FAILED, buildCourse, READ_FAILED, type BuildStats } from './ab-press-builder'
import { TEST_ADMIN_SECRET, TEST_SESSION_SECRET, signTestSession } from './admin-session-fixtures'
import { ADMIN_SESSION_COOKIE, getAdminPath } from './middleware-logic'
import { DB_LIMITS_MS } from './supabase-server'

// AB Press reads live practice sets only (owner decision D341), and a read that
// fails is never taken for "none" (D342, D343). The first part reads the text
// of every AB Press file. The second part runs the shared builder and the
// routes on a fake network; only the PDF and Word makers are replaced.

type Failure = 'error' | 'empty' | 'missing' | 'no total' | 'early end' | 'moving' | 'hangs'

const state = vi.hoisted(() => ({
  // How a table's reads fail: an error answer; no data and no error; one row
  // missing; no total; fewer rows than the total; a total that changes between
  // two pages; or no answer at all.
  failing: {} as Record<string, Failure>,
  pdfs: 0,
  // What the PDF maker and the Word maker were given.
  made: [] as string[],
  written: [] as string[],
  // Course slug to the article names of each lesson.
  lessons: {} as Record<string, string[][]>,
  // The same, for a course of several chapters.
  chapters: {} as Record<string, string[][][]>,
  // The most rows one answer carries, as a database setting may limit it.
  cap: Infinity,
  // Every request: the table and the number of values in its lists.
  requests: [] as { table: string; method: string; values: number }[],
}))

vi.mock('@/lib/coursesNew', () => ({
  getCourseBySlug: async (slug: string) => ({
    id: slug,
    title: 'Course',
    slug,
    chapters: (state.chapters[slug] ?? [state.lessons[slug] ?? [['live', 'draft', 'unset', 'gone']]]).map((lessons, index) => ({
      id: 'chapter',
      title: 'Chapter',
      chapterOrder: index + 1,
      lessons: lessons.map((names) => ({
        id: 'lesson',
        title: 'Lesson',
        slug: 'lesson',
        articles: names.map((name) => ({ id: `a-${name}`, title: name, slug: name })),
      })),
    })),
  }),
}))

vi.mock('@react-pdf/renderer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@react-pdf/renderer')>()),
  renderToBuffer: async (element: { props: unknown }) => {
    state.pdfs += 1
    state.made.push(JSON.stringify(element.props))
    return Buffer.from('/Type /Page ')
  },
}))

vi.mock('docx', () => {
  class Part {
    constructor(public options: unknown) {}
  }
  return {
    Document: Part,
    Paragraph: Part,
    TextRun: Part,
    PageBreak: Part,
    AlignmentType: { CENTER: 'center' },
    HeadingLevel: { TITLE: 'title', HEADING_1: 'h1', HEADING_2: 'h2', HEADING_3: 'h3', HEADING_4: 'h4' },
    convertInchesToTwip: (inches: number) => inches,
    Packer: {
      toBuffer: async (made: unknown) => {
        state.made.push(JSON.stringify(made))
        return Buffer.from('word')
      },
    },
  }
})

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
    expect(found).toEqual({ 'lib/ab-press-builder.ts': [true] })
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

// One entry per database from() in the text, with its table ('?' when it is not
// a fixed name).
function tablesUsed(source: string): string[] {
  const file = ts.createSourceFile('x.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const tables: string[] = []
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'from' &&
      !['Array', 'Buffer', 'Uint8Array'].includes(node.expression.expression.getText())
    ) {
      const table = node.arguments[0]
      tables.push(table && ts.isStringLiteralLike(table) ? table.text : '?')
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return tables
}

// One entry per from('articles'), from('question_sets') or from('questions') in
// the text: is it the query of a readAll() call, or does its own await take the
// result's error and a following if on that error throw? Any other shape counts
// as unchecked.
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
      ['articles', 'question_sets', 'questions'].includes(table.text)
    ) {
      let link: ts.Node = node
      while (ts.isPropertyAccessExpression(link.parent) && link.parent.expression === link && ts.isCallExpression(link.parent.parent)) {
        link = link.parent.parent
      }
      const helper = ts.isArrowFunction(link.parent) && link.parent.body === link ? link.parent.parent : undefined
      const byHelper = !!helper && ts.isCallExpression(helper) && helper.expression.getText() === 'readAll'
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
        byHelper ||
          (name !== '' &&
          following.some(
            (next) =>
              ts.isIfStatement(next) &&
              has(next.expression, (inner) => ts.isIdentifier(inner) && inner.text === name) &&
              has(next.thenStatement, ts.isThrowStatement),
          )),
      )
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return reads
}

describe('AB Press reads of articles, question_sets and questions', () => {
  it('are in the shared builder only, and every one is checked', () => {
    const found: Record<string, boolean[]> = {}
    for (const path of FILES) {
      const reads = readsChecked(readFileSync(join(ROOT, path), 'utf8'))
      if (reads.length > 0) found[label(path)] = reads
    }
    expect(found).toEqual({ 'lib/ab-press-builder.ts': [true, true, true, true] })
  })

  it('no table is used anywhere else in AB Press, and none by another name', () => {
    const found: Record<string, string[]> = {}
    for (const path of FILES) {
      const tables = tablesUsed(readFileSync(join(ROOT, path), 'utf8'))
      if (tables.length > 0) found[label(path)] = tables
    }
    expect(found).toEqual({
      'lib/ab-press-builder.ts': ['articles', 'question_sets', 'questions', 'questions'],
      'app/api/@admin/ab-press/generate/route.ts': ['book_publications'],
      'app/api/@admin/ab-press/generate-pq/route.ts': ['book_publications'],
      'app/api/@admin/ab-press/preview/route.ts': ['book_publications'],
    })
    expect(tablesUsed('Array.from(x); db.from(name); Buffer.from("y"); db.from("jobs")')).toEqual(['?', 'jobs'])
  })

  it('the routes that read have a time limit', () => {
    for (const [name, seconds] of [['preview', 60], ['export-word', 300], ['generate', 300], ['generate-pq', 300], ['generate-chapter', 60], ['generate-answers', 60]]) {
      const path = FILES.find((file) => file.includes(`/ab-press/${name}/route.ts`))
      expect(readFileSync(join(ROOT, path ?? ''), 'utf8')).toContain(`\nexport const maxDuration = ${seconds}\n`)
    }
  })

  it('the check recognises a query of the read helper, and only there', () => {
    expect(readsChecked(`readAll('x', m, v, (c) => db.from('articles').select('id').in('id', c).order('id'))`)).toEqual([true])
    expect(readsChecked(`readSome('x', m, v, (c) => db.from('articles').select('id').in('id', c).order('id'))`)).toEqual([false])
    expect(readsChecked(`readAll('x', m, v, (c) => { db.from('articles').select('id') })`)).toEqual([false])
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

const article = (name: string, link: string | null = `/practice-questions/${name}`, content = ''): Row => ({
  id: `a-${name}`,
  content,
  mcq_url: link,
  status: 'published',
})

// A set's full questions, stored in another order than their own.
const questionsOf = (name: string, count: number): Row[] =>
  Array.from({ length: count }, (_, index) => index)
    .map((index) => ({
      ...question(name),
      question_text: `Q ${name} ${index + 1}`,
      option_c: index % 2 ? 'C' : null,
      correct_index: index % 2 ? 2 : 1,
      explanation: index % 2 ? 'OVERVIEW: Why. KEY TAKEAWAY: This.' : null,
      question_order: index + 1,
    }))
    .reverse()

// A course of two chapters, for books made from good reads.
const GOOD = [[['good-1', 'good-2'], ['good-3']], [['good-4', 'good-5']]]

// A course of 250 articles and 3,000 questions, in two chapters.
const bigNames = Array.from({ length: 250 }, (_, index) => `big-${index}`)
const BIG = [[bigNames.slice(0, 125)], [bigNames.slice(125)]]

// Options with a blank in the middle, at the end, and nothing else.
const OPTIONS: [string | null, string | null, string | null, string | null][] = [
  ['a', null, 'c', 'd'],
  ['a', 'b', '', '  '],
  ['', 'b', null, 'd'],
  [null, null, null, null],
]

const TABLES: Record<string, Row[]> = {
  articles: [
    ...['live', 'draft', 'unset', 'gone', 'other', 'foreign'].map((name) => article(name)),
    article('twin', 'https://example.com/practice-questions/live/'),
    article('plain', null),
    article('good-1', '/practice-questions/set-1', '<h2>Head</h2><p>One <strong>bold</strong></p>'),
    article('good-2', '/practice-questions/set-2/', '<p>Two</p><h2>Related Articles</h2><ul><li><a href="/x">x</a></li></ul>'),
    article('good-3', null, ''),
    article('good-4', '/practice-questions/set-1', '<ul><li>Four</li></ul>'),
    article('good-5', '/practice-questions/set-3', '<p>Five</p>'),
    ...['ties', 'options', ...bigNames].map((name) => article(name)),
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
    set('set-1', 'published'),
    set('set-2', 'published'),
    set('set-3', 'draft'),
    ...['ties', 'options', ...bigNames].map((name) => set(name, 'published')),
  ],
  questions: [
    ...['live', 'draft', 'unset', 'other', 'other', 'foreign', 'foreign', 'foreign', 'stray', 'stray', 'stray', 'stray'].map(question),
    ...questionsOf('set-1', 3),
    ...questionsOf('set-2', 4),
    ...questionsOf('set-3', 2),
    ...questionsOf('ties', 9).map((row) => ({ ...row, question_order: 1 })),
    ...OPTIONS.map(([a, b, c, d], index) => ({
      ...question('options'),
      option_a: a,
      option_b: b,
      option_c: c,
      option_d: d,
      question_order: index,
    })),
    ...bigNames.flatMap((name) => questionsOf(name, 12)),
  ].map((row, index) => ({ ...row, id: `q-${String(index).padStart(5, '0')}` })),
}

// Rows in the order a request asks for. Rows that are equal under it come in
// either order, as a database is free to send them.
let turn = 0
function sorted(rows: Row[], order: string | null): Row[] {
  turn += 1
  const keys = (order ?? '').split(',').filter(Boolean).map((key) => key.split('.')[0])
  const compare = (a: Row, b: Row) => {
    for (const key of keys) {
      const [x, y] = [a[key], b[key]]
      if (x !== y) return x === null ? 1 : y === null ? -1 : x < y ? -1 : 1
    }
    return 0
  }
  return (turn % 2 ? [...rows] : [...rows].reverse()).sort(compare)
}

// Answers a GET as the database would: its eq and in filters, columns, order,
// limit and offset, the number of rows when it is asked for, and a most number
// of rows in one answer. A HEAD gets the number of rows; a write is noted.
async function fakeDatabase(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : String(input))
  const method = input instanceof Request ? input.method : (init?.method ?? 'GET')
  const table = url.pathname.split('/').pop() ?? ''
  const lists = Array.from(url.searchParams.values()).filter((value) => value.startsWith('in.('))
  state.requests.push({ table, method, values: Math.max(0, ...lists.map((value) => value.split(',').length)) })
  if (method === 'POST') {
    state.written.push(table)
    return new Response(null, { status: 201 })
  }
  const failing = state.failing[table]
  if (failing === 'hangs') return new Promise<Response>(() => undefined)
  if (failing === 'empty') return new Response('', { status: 404 })
  if (failing === 'error') {
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
  if (failing === 'missing') rows = rows.slice(1)
  const prefer = (input instanceof Request ? input.headers : new Headers(init?.headers)).get('prefer') ?? ''
  const from = Number(url.searchParams.get('offset') ?? 0)
  let total: number | string = prefer.includes('count=exact') && failing !== 'no total' ? rows.length : '*'
  if (method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-range': `*/${total}` } })
  if (typeof total === 'number' && failing === 'early end') total += 1
  if (typeof total === 'number' && failing === 'moving') total += from
  const limit = Math.min(Number(url.searchParams.get('limit') ?? Infinity), state.cap)
  const page = sorted(rows, url.searchParams.get('order')).slice(from, from + limit)
  const columns = (url.searchParams.get('select') ?? '*').split(',')
  const sent = columns[0] === '*' ? page : page.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]])))
  return new Response(JSON.stringify(sent), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'content-range': `${sent.length ? `${from}-${from + sent.length - 1}` : '*'}/${total}`,
    },
  })
}

beforeEach(() => {
  state.failing = {}
  state.lessons = {}
  state.chapters = { good: GOOD, big: BIG, ties: [[['ties']]], options: [[['options']]] }
  state.cap = Infinity
  state.requests = []
  state.made = []
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

  it('leaves out only the blank options at the end, so every option keeps its letter', async () => {
    const course = await buildCourse('options', { mcqFailed: [], mcqNotFound: [] })
    expect(course.chapters[0].lessons[0].linkedArticles[0].quizQuestions.map((q) => q.options)).toEqual([
      ['a', '', 'c', 'd'],
      ['a', 'b'],
      ['', 'b', '', 'd'],
      [],
    ])
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

describe('the check report of a book', () => {
  // The files in the ZIP are stored, not compressed, so its text can be read.
  const report = async (name: string, body: object) =>
    Buffer.from(await (await callRoute(name, { body })).arrayBuffer()).toString('latin1').split('\n')

  it.each<[string, object]>([
    ['generate', { slug: 'course', bookType: 'combined' }],
    ['generate-pq', { slug: 'course' }],
  ])('%s names the sets that are missing or not live', async (name, body) => {
    const lines = await report(name, body)
    expect(lines.filter((line) => line.includes('practice set(s)'))).toEqual([
      '[WARN] 3 linked practice set(s) not found or not live: draft, unset, gone',
    ])
    expect(lines).toContain('[PASS] No practice fetch errors')
    state.lessons = { course: [['live']] }
    expect(await report(name, body)).toContain('[PASS] All linked practice sets found')
  })
})

// Every request that makes a book or a part of one from the database.
const MAKERS: [string, object][] = [
  ['generate', { slug: 'course', bookType: 'combined' }],
  ['generate', { slug: 'course', bookType: 'study' }],
  ['generate-pq', { slug: 'course' }],
  ['export-word', { slug: 'course', bookType: 'combined' }],
  ['generate-chapter', { slug: 'course', bookType: 'combined', chapterIndex: 0 }],
  ['generate-answers', { slug: 'course' }],
  ['generate-answers', { slug: 'course', chapterIndex: 0 }],
]

const sha = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16)

// The content audit in a ZIP made by generate or generate-pq.
const audit = (zip: string) => /CONTENT FIDELITY AUDIT[\s\S]*?FIDELITY VERDICT:[^\n]*?\.(?=PK|$)/.exec(zip)?.[0] ?? ''

// What a maker gave its PDF or Word maker, its audit, and its answer.
async function make(name: string, body: object): Promise<{ status: number; given: string; audit: string }> {
  state.made = []
  const response = await callRoute(name, { body: { ...body, edition: 'E', subtitle: 'S' } })
  const answer = Buffer.from(await response.arrayBuffer()).toString('utf8')
  const given = state.made.join('\n').split(`Copyright ${new Date().getFullYear()}`).join('Copyright YEAR')
  return { status: response.status, given, audit: audit(answer) }
}

describe('a book made from good reads', () => {
  // Taken from the code before the shared read helper (owner decision D343).
  const NO_AUDIT = sha('')
  const BEFORE: [number, string, string][] = [
    [200, '85969b0f240519ae', 'dd11bf9a8e2cb57c'],
    [200, 'ea8a2a61c991d52e', 'da231046bd914b8c'],
    [200, '7894864cb4c05d2a', '6a4b821b6b90d892'],
    [200, '501782b17ac4d18f', NO_AUDIT],
    [200, '0b9926fa727f34f5', NO_AUDIT],
    [200, '6b75db3be1366ee6', NO_AUDIT],
    [200, '9fe42e3c86d4f5ec', NO_AUDIT],
  ]

  it.each(MAKERS.map(([name, body], index) => [index, name, { ...body, slug: 'good' }] as const))('%i %s %o is as before', async (index, name, body) => {
    const { status, given, audit: text } = await make(name, body)
    expect([status, sha(given), sha(text)]).toEqual(BEFORE[index])
  })
})

describe('a limit on the rows of one answer', () => {
  const ofCourse = (slug: string) => MAKERS.map(([name, body]) => [name, { ...body, slug }] as const)
  const previewOf = async (slug: string) => (await callRoute('preview', { query: `?slug=${slug}` })).text()

  it.each(ofCourse('good'))('%s %o is the same with any limit', async (name, body) => {
    const free = await make(name, body)
    expect(free.status).toBe(200)
    for (const cap of [1, 2, 500, 1000]) {
      state.cap = cap
      expect(await make(name, body), String(cap)).toEqual(free)
    }
  })

  it.each(ofCourse('big'))('%s %o: no question is lost, and no request has more than 100 values', async (name, body) => {
    const free = await make(name, body)
    const printed = 'chapterIndex' in body ? bigNames.slice(0, 125) : bigNames
    expect(free.status).toBe(200)
    if (!('bookType' in body && body.bookType === 'study')) {
      for (const set of printed) expect(free.given).toContain(`"Q ${set} 12"`)
    }
    for (const cap of [500, 1000]) {
      state.cap = cap
      expect((await make(name, body)).given === free.given, String(cap)).toBe(true)
    }
    expect(Math.max(...state.requests.map((request) => request.values))).toBe(100)
  })

  it('the preview is the same with any limit', async () => {
    for (const [slug, caps, count] of [['good', [1, 2, 500, 1000], 10], ['big', [500, 1000], 3000]] as const) {
      state.cap = Infinity
      const free = await previewOf(slug)
      expect(JSON.parse(free).stats).toMatchObject({ questionCount: count, questionCountError: false })
      for (const cap of caps) {
        state.cap = cap
        expect(await previewOf(slug), `${slug} ${cap}`).toBe(free)
      }
    }
    expect(Math.max(...state.requests.map((request) => request.values))).toBe(100)
  })

  it('questions with the same number come in one order, in the chapter and in its answers', async () => {
    const orders: string[][] = []
    for (const cap of [Infinity, 1, 2, 3]) {
      state.cap = cap
      for (const name of ['generate-chapter', 'generate-answers']) {
        const { given } = await make(name, { slug: 'ties', bookType: 'combined', chapterIndex: 0 })
        orders.push(Array.from(given.matchAll(/Q ties \d/g), (match) => match[0]))
      }
    }
    expect(orders[0]).toHaveLength(9)
    expect(new Set(orders[0]).size).toBe(9)
    for (const order of orders) expect(order).toEqual(orders[0])
  })
})

describe('a failed read', () => {
  it('has its exact message', () => {
    expect(READ_FAILED).toBe('Could not read the practice questions, so nothing was made. Please try again in a minute.')
    expect(ARTICLES_READ_FAILED).toBe('Could not read the articles, so nothing was made. Please try again in a minute.')
  })

  it.each(MAKERS)('%s %o makes a file when every read works', async (name, body) => {
    const response = await callRoute(name, { body })
    expect(response.status).toBe(200)
    if (name !== 'export-word') expect(state.pdfs).toBeGreaterThan(0)
  })

  // How the reads of a table can fail, and the short code each failure carries.
  const CODES: Record<Exclude<Failure, 'hangs'>, string> = {
    error: 'XX000',
    empty: 'NO_DATA',
    missing: 'ROWS_MISSING',
    'no total': 'NO_TOTAL',
    'early end': 'EMPTY_PAGE',
    moving: 'TOTAL_CHANGED',
  }
  const READS: [string, string, string][] = [
    ['articles', 'articles', ARTICLES_READ_FAILED],
    ['question_sets', 'sets', READ_FAILED],
    ['questions', 'questions', READ_FAILED],
  ]

  for (const [table, what, message] of READS) {
    for (const how of Object.keys(CODES) as (keyof typeof CODES)[]) {
      // Only the articles are asked for by name, one by one.
      if (how === 'missing' && table !== 'articles') continue

      it.each(MAKERS)(`${table} (${how}): %s %o answers 500 and makes nothing`, async (name, body) => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        state.failing = { [table]: how }
        state.cap = 1
        const response = await callRoute(name, { body: { ...body, slug: 'good' } })
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({ error: message })
        expect(state.made).toEqual([])
        expect(state.pdfs).toBe(0)
        expect(state.written).toEqual([])
        expect(log).toHaveBeenCalledTimes(1)
        expect(log.mock.calls[0][0]).toBe(`ab-press/${name}: failed:`)
        expect(log.mock.calls[0][1]).toMatchObject({ message, what, code: CODES[how] })
      })

      // The preview counts the questions without reading them.
      if (table === 'questions' && !['error', 'empty', 'no total'].includes(how)) continue
      it(`${table} (${how}): the preview answers, with the count unknown`, async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        state.failing = { [table]: how }
        state.cap = 1
        const response = await callRoute('preview', { query: '?slug=good' })
        expect(response.status).toBe(200)
        const body = await response.json()
        expect(body.stats).toMatchObject({ questionCountError: true, questionCount: 0, articleCount: 5 })
        expect(JSON.stringify(body)).not.toContain('private detail')
        expect(log).toHaveBeenCalledTimes(table === 'articles' ? 2 : 1)
      })
    }
  }

  it.each(READS)('%s: a request that never ends is stopped at the admin limit', async (table, what, message) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await callRoute('generate', { body: { slug: 'good', bookType: 'combined' } })
    state.failing = { [table]: 'hangs' }
    state.requests = []
    state.written = []
    state.made = []
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      let ended = false
      const asked = callRoute('generate', { body: { slug: 'good', bookType: 'combined' } }).finally(() => {
        ended = true
      })
      while (!state.requests.some((request) => request.table === table)) await new Promise((resolve) => setImmediate(resolve))
      await vi.advanceTimersByTimeAsync(DB_LIMITS_MS.admin - 1)
      expect(ended).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      const response = await asked
      expect([response.status, await response.json()]).toEqual([500, { error: message }])
    } finally {
      vi.useRealTimers()
    }
    expect([state.made, state.written]).toEqual([[], []])
    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0][1]).toMatchObject({ message, what })
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
