import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import * as pdfLib from 'pdf-lib'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FrontmatterTemplate } from '@/components/book/FrontmatterTemplate'
import { ARTICLES_READ_FAILED, buildCourse, courseKey, EMPTY_COURSE, noAnswerLine, READ_FAILED, unpublishedLine, type BuildStats } from './ab-press-builder'
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
  // The pages the PDF maker was given, as they would be drawn.
  drawn: [] as unknown[],
  written: [] as string[],
  // Course slug to the article names of each lesson.
  lessons: {} as Record<string, string[][]>,
  // The same, for a course of several chapters.
  chapters: {} as Record<string, string[][][]>,
  // The most rows one answer carries, as a database setting may limit it.
  cap: Infinity,
  // Every request: the table and the number of values in its lists.
  requests: [] as { table: string; method: string; values: number }[],
  // What the PDF maker throws, and what the course read throws.
  pdfFails: null as Error | null,
  courseFails: null as Error | null,
  // Every problem report: its label, its problem and what goes with it.
  reports: [] as unknown[][],
}))

vi.mock('@/lib/report-error', () => ({
  reportServerError: (...args: unknown[]) => {
    state.reports.push(args)
  },
}))

vi.mock('@/lib/coursesNew', () => ({
  getCourseBySlug: async (slug: string) => {
    if (state.courseFails) throw state.courseFails
    return {
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
    }
  },
}))

vi.mock('@react-pdf/renderer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@react-pdf/renderer')>()),
  renderToBuffer: async (element: { type: (props: unknown) => unknown; props: unknown }) => {
    if (state.pdfFails) throw state.pdfFails
    state.pdfs += 1
    state.made.push(JSON.stringify(element.props))
    state.drawn.push(element)
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

// Stored answers, and the letter a book prints for each.
const ANSWERS: [number | null, string][] = [[0, 'A'], [1, 'B'], [2, 'C'], [3, 'D'], [null, '–'], [7, '–'], [4, '–'], [-1, '–']]

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
    ...['ties', 'options', 'letters', ...bigNames].map((name) => article(name)),
    { ...article('hidden', '/practice-questions/live'), status: 'draft' },
    { ...article('unmarked', null), status: null },
    { ...article('blank'), status: 'draft' },
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
    ...['ties', 'options', 'letters', 'blank', ...bigNames].map((name) => set(name, 'published')),
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
    ...ANSWERS.map(([correct_index], index) => ({ ...question('letters'), correct_index, question_order: index })),
    { ...question('blank'), question_text: ` ${String.fromCharCode(0x200b)}${String.fromCharCode(0xfeff)}`, correct_index: null },
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
  if (method === 'POST' && state.failing[table] !== 'error') {
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
  state.drawn = []
  state.pdfs = 0
  state.written = []
  state.pdfFails = null
  state.courseFails = null
  state.reports = []
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

const noStats = (): BuildStats => ({ mcqFailed: [], mcqNotFound: [], unpublished: [] })

describe('the shared builder', () => {
  it('a book takes the questions of a live set; any other set is as a missing one', async () => {
    const stats = noStats()
    const course = await buildCourse('course', stats)
    const articles = course.chapters[0].lessons[0].linkedArticles
    expect(articles.map((article) => [article.slug, article.quizQuestions.length])).toEqual([
      ['live', 1],
      ['draft', 0],
      ['unset', 0],
      ['gone', 0],
    ])
    expect(articles[0].quizQuestions[0].questionText).toBe('Q live')
    expect(stats).toEqual({ mcqFailed: [], mcqNotFound: ['draft', 'unset', 'gone'], unpublished: [] })
  })

  it('leaves out only the blank options at the end, so every option keeps its letter', async () => {
    const course = await buildCourse('options', noStats())
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
    const course = await buildCourse(slug, noStats())
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
    ['a set printed more than once', [['live', 'twin'], ['live', 'other']], 5],
    ['all of them', [['live', 'draft', 'unset', 'gone', 'other'], ['live', 'twin', 'plain', 'foreign']], 8],
  ])('is the number of questions in the book: %s', async (_name, lessons, expected) => {
    state.lessons = { counted: lessons }
    const body = await (await callRoute('preview', { query: '?slug=counted' })).json()
    expect(body.stats).toMatchObject({ questionCount: expected, questionCountError: false })
    expect(await bookCount('counted')).toBe(expected)
  })

  it('is 0 for a course without articles, which makes no book', async () => {
    state.lessons = { counted: [[]] }
    const body = await (await callRoute('preview', { query: '?slug=counted' })).json()
    expect(body.stats).toMatchObject({ questionCount: 0, questionCountError: false })
    await expect(bookCount('counted')).rejects.toThrow(EMPTY_COURSE)
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

// Each route's report from its final catch.
const LABELS: Record<string, string> = {
  generate: 'admin book make failed',
  'generate-pq': 'admin practice kit make failed',
  'generate-chapter': 'admin book chapter failed',
  'generate-answers': 'admin book answers failed',
  'generate-cover': 'admin book cover failed',
  'generate-frontmatter': 'admin book front pages failed',
  'export-word': 'admin book word export failed',
  preview: 'admin book preview failed',
}
const FRONT: [string, object] = ['generate-frontmatter', { slug: 'course', bookType: 'combined', chapterPageStarts: [], totalPages: 4 }]
const COVER: [string, object] = ['generate-cover', { slug: 'course', bookType: 'combined', pageCount: 30 }]

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
    const lines = text.split('\n')
    const NEW = ['[PASS] Every printed question has a stored answer', '[PASS] Every printed article is published']
    expect(lines.filter((line) => NEW.includes(line))).toEqual(text ? NEW : [])
    const former = lines.filter((line) => !NEW.includes(line)).join('\n')
    expect([status, sha(given), sha(former)]).toEqual(BEFORE[index])
  })

  // The pages themselves, taken from the code before owner decision D344: every
  // element with its style, its other settings and its text.
  const page = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(page)
    if (!node || typeof node !== 'object' || !('props' in node)) return node
    const { type, props } = node as Element
    const { children, ...rest } = props
    return [typeof type === 'string' ? type : 'part', rest, page(children)]
  }
  const pages = () =>
    JSON.stringify(state.drawn.map((made) => {
      const { type, props } = made as { type: (props: unknown) => unknown; props: unknown }
      return page(type(props))
    })).split(`Copyright ",${new Date().getFullYear()},`).join('Copyright ",YEAR,')
  const DRAWN: string[] = [
    '6e405fd1e399911e',
    'd2afa80d637c1052',
    '0dcab6f488b0e47e',
    sha('[]'), // The Word file is not drawn; what it is given is checked above.
    'bb21ee32e275d272',
    '7358b11cec5be134',
    '24c735d705a00407',
    '7f23ddd59695b424',
  ]

  it.each([...MAKERS, FRONT].map(([name, body], index) => [index, name, { ...body, slug: 'good' }] as const))('%i %s %o is drawn as before', async (index, name, body) => {
    await make(name, body)
    expect(sha(pages())).toBe(DRAWN[index])
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
        expect(state.reports).toEqual([[LABELS[name], log.mock.calls[0][1], { area: 'admin' }]])
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
        expect(body.health.unavailable).toBe(table === 'articles')
        if (table === 'articles') expect(body.health.verdict).toBe('issues')
        expect(body.historyError).toBe(false)
        expect(JSON.stringify(body)).not.toContain('private detail')
        const labels = ['admin book preview count failed', ...(table === 'articles' ? ['admin book preview content failed'] : [])]
        expect(log).toHaveBeenCalledTimes(labels.length)
        expect(state.reports).toEqual(labels.map((text, index) => [text, log.mock.calls[index][1], { area: 'admin' }]))
        // A count has no body, so no code comes back with its error.
        const code = table !== 'questions' ? CODES[how] : how === 'error' ? undefined : 'NO_TOTAL'
        expect((state.reports[0][1] as { code?: string }).code).toBe(code)
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

  it.each(['error', 'empty'] as const)('book_publications (%s): the preview answers, with the history unknown', async (how) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    state.failing = { book_publications: how }
    const response = await callRoute('preview', { query: '?slug=good' })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({ historyError: true, history: [], health: { unavailable: false } })
    expect(JSON.stringify(body)).not.toContain('private detail')
    expect(log).toHaveBeenCalledTimes(1)
    expect(state.reports).toEqual([['admin book preview history failed', log.mock.calls[0][1], { area: 'admin' }]])
  })

  it('the preview says nothing about it when the reads work', async () => {
    const body = await (await callRoute('preview', { query: '?slug=course' })).json()
    expect(body.stats.questionCountError).toBe(false)
    expect(body).toMatchObject({ historyError: false, history: [], health: { unavailable: false, verdict: 'issues', emptyArticles: 4 } })
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

describe('a course without articles', () => {
  it('has its exact message', () => {
    expect(EMPTY_COURSE).toBe('No articles were found for this course, so nothing was made. Please check the course and try again in a minute.')
  })

  it.each([...MAKERS, FRONT])(
    '%s %o answers 422 and makes nothing',
    async (name, body) => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      for (const chapters of [[], [[]], [[[]], [[], []]]]) {
        state.chapters = { course: chapters }
        const response = await callRoute(name, { body })
        expect(response.status).toBe(422)
        expect(await response.json()).toEqual({ error: EMPTY_COURSE })
      }
      expect([state.made, state.written, state.requests, state.reports]).toEqual([[], [], [], []])
      expect(log).not.toHaveBeenCalled()
    },
  )

  it('a chapter without articles in a course that has some is made as before', async () => {
    state.chapters = { course: [[[]], [['live']]] }
    const response = await callRoute('generate-chapter', { body: { slug: 'course', bookType: 'combined', chapterIndex: 0 } })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ chapterCount: 2, questionCount: 0 })
  })
})

describe('a problem is logged and reported once', () => {
  it.each([...MAKERS, FRONT, COVER].filter(([name]) => name !== 'export-word'))('%s %o: the PDF maker fails', async (name, body) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    state.pdfFails = new Error('no pdf')
    const response = await callRoute(name, { body })
    expect([response.status, await response.json()]).toEqual([500, { error: 'no pdf' }])
    expect(log.mock.calls).toEqual([[`ab-press/${name}: failed:`, state.pdfFails]])
    expect(state.reports).toEqual([[LABELS[name], state.pdfFails, { area: 'admin' }]])
    expect(state.written).toEqual([])
  })

  it.each<[string, { body?: object; query?: string }]>([
    ...[...MAKERS, FRONT].map(([name, body]): [string, { body: object }] => [name, { body }]),
    ['preview', { query: '?slug=course' }],
  ])('%s %o: the course read fails', async (name, request) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    state.courseFails = new Error('fixed text')
    const response = await callRoute(name, request)
    expect([response.status, await response.json()]).toEqual([500, { error: 'fixed text' }])
    expect(log.mock.calls).toEqual([[`ab-press/${name}: failed:`, state.courseFails]])
    expect(state.reports).toEqual([[LABELS[name], state.courseFails, { area: 'admin' }]])
  })

  it.each<[string, object, string]>([
    ['generate', { slug: 'good', bookType: 'combined' }, 'admin book history save failed'],
    ['generate-pq', { slug: 'good' }, 'admin practice kit history save failed'],
  ])('%s %o: a failed history save still gives the book', async (name, body, text) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const response = await callRoute(name, { body })
    expect([response.status, state.written, state.reports]).toEqual([200, ['book_publications'], []])
    state.failing = { book_publications: 'error' }
    const unsaved = await callRoute(name, { body })
    expect([unsaved.status, unsaved.headers.get('content-type'), state.written.length]).toEqual([200, 'application/zip', 1])
    expect(log).toHaveBeenCalledTimes(1)
    expect(state.reports).toEqual([[text, expect.objectContaining({ code: 'XX000' }), { area: 'admin' }]])
  })
})

describe('a chapter and its answers', () => {
  it('say how many chapters the course has now and how many questions they print', async () => {
    for (const [chapterIndex, questionCount] of [[0, 7], [1, 3]]) {
      for (const name of ['generate-chapter', 'generate-answers']) {
        const response = await callRoute(name, { body: { slug: 'good', bookType: 'combined', chapterIndex } })
        expect(await response.json()).toMatchObject({ chapterCount: 2, questionCount, pageCount: 1 })
      }
    }
    state.chapters = { course: [[['plain']], [['live']]] }
    const none = await callRoute('generate-answers', { body: { slug: 'course', chapterIndex: 0 } })
    expect(await none.json()).toEqual({ pdf: null, pageCount: 0, chapterCount: 2, courseKey: expect.stringMatching(KEY), questionCount: 0 })
  })
})

const KEY = /^[0-9a-f]{12}$/

// A course of chapters, each with its number and the article names of its lessons.
type Plan = [id: string, order: number, lessons: string[][]][]
const planned = (plan: Plan) => ({
  chapters: plan.map(([id, chapterOrder, lessons]) => ({
    id,
    chapterOrder,
    lessons: lessons.map((names) => ({ articles: names.map((name) => ({ id: name })) })),
  })),
})
const PLAN: Plan = [['c1', 1, [['a', 'b'], ['c']]], ['c2', 2, [['d']]], ['c3', 3, [['e'], ['f']]]]

// The same course after a change that keeps the number of chapters.
const CHANGED: [string, Plan][] = [
  ['two chapters were swapped', [PLAN[1], PLAN[0], PLAN[2]]],
  ['a chapter got another number', [PLAN[0], ['c2', 5, [['d']]], PLAN[2]]],
  ['a chapter was replaced by another with the same articles', [PLAN[0], ['c9', 2, [['d']]], PLAN[2]]],
  ['an article moved to another chapter', [['c1', 1, [['a', 'b'], []]], ['c2', 2, [['c', 'd']]], PLAN[2]]],
  ['two articles were swapped', [['c1', 1, [['b', 'a'], ['c']]], PLAN[1], PLAN[2]]],
  ['an article was added', [PLAN[0], ['c2', 2, [['d', 'g']]], PLAN[2]]],
  ['an article was taken away', [PLAN[0], PLAN[1], ['c3', 3, [['e'], []]]]],
]

describe('the key of a course', () => {
  it('is the same for the same course, twelve hex characters long', () => {
    expect(courseKey(planned(PLAN))).toMatch(KEY)
    expect(courseKey(planned(JSON.parse(JSON.stringify(PLAN))))).toBe(courseKey(planned(PLAN)))
  })

  it.each(CHANGED)('is another one when %s', (_name, plan) => {
    expect(plan).toHaveLength(PLAN.length)
    expect(courseKey(planned(plan))).toMatch(KEY)
    expect(courseKey(planned(plan))).not.toBe(courseKey(planned(PLAN)))
  })

  // The key each part of a book made chapter by chapter gives, the preview first.
  const keys = async () => {
    const asked: [string, { query?: string; body?: object }][] = [
      ['preview', { query: '?slug=course' }],
      ['generate-chapter', { body: { slug: 'course', bookType: 'combined', chapterIndex: 0 } }],
      ['generate-chapter', { body: { slug: 'course', bookType: 'study', chapterIndex: 1 } }],
      ['generate-answers', { body: { slug: 'course', chapterIndex: 0 } }],
      ['generate-answers', { body: { slug: 'course', chapterIndex: 1 } }],
      ['generate-answers', { body: { slug: 'course' } }],
      ['generate-frontmatter', { body: FRONT[1] }],
    ]
    const given: unknown[] = []
    for (const [name, request] of asked) given.push((await (await callRoute(name, request)).json()).courseKey)
    return given
  }

  it('is given by the preview and by every part, each from its own read', async () => {
    // Chapter 1 has no questions, so its answers come without a PDF.
    state.chapters = { course: [[['plain']], [['live', 'other']]] }
    const before = await keys()
    expect(before[0]).toMatch(KEY)
    expect(new Set(before).size).toBe(1)
    const seen = new Set(before)
    for (const changed of [
      [[['live', 'other']], [['plain']]],
      [[['plain', 'live']], [['other']]],
      [[['plain']], [['other', 'live']]],
      [[['plain']], [['live', 'other', 'foreign']]],
    ]) {
      state.chapters = { course: changed }
      const after = await keys()
      expect(after[0]).toMatch(KEY)
      expect(new Set(after).size).toBe(1)
      expect(seen.has(after[0])).toBe(false)
      seen.add(after[0])
    }
  })
})

describe('the page numbers and the check report of a book made chapter by chapter', () => {
  it('a chapter names its sets that are missing or not live, each time they are linked', async () => {
    const missing = async (slug: string, chapterIndex: number) =>
      (await (await callRoute('generate-chapter', { body: { slug, bookType: 'combined', chapterIndex } })).json()).missingSets
    expect(await missing('course', 0)).toEqual(['draft', 'unset', 'gone'])
    expect(await missing('good', 0)).toEqual([])
    expect(await missing('good', 1)).toEqual(['set-3'])
    state.chapters = { course: [[['gone', 'live'], ['gone', 'plain']]] }
    expect(await missing('course', 0)).toEqual(['gone', 'gone'])
  })

  it('the front pages get the answers page only when it is given as a number', async () => {
    for (const [given, passed] of [[18, 18], [undefined, undefined], ['18', undefined], [null, undefined]]) {
      state.made = []
      await callRoute(FRONT[0], { body: { ...FRONT[1], totalPages: 25, answersPageStart: given } })
      expect(JSON.parse(state.made[0])).toMatchObject({ totalPages: 25 })
      expect(JSON.parse(state.made[0]).answersPageStart).toBe(passed)
    }
  })

  it('the contents page prints that page; without it, its former rule', () => {
    const contents = (bookType: 'combined' | 'study', answersPageStart?: number) =>
      Screen.text(
        FrontmatterTemplate({
          course: { chapters: [{ chapterTitle: 'One' }] },
          bookType,
          edition: 'E',
          subtitle: 'S',
          chapterPageStarts: [4],
          totalPages: 25,
          answersPageStart,
        }),
      )
    expect(contents('combined', 18)).toMatch(/Chapter 1: One4Answers and Explanations18$/)
    expect(contents('combined')).toMatch(/Chapter 1: One4Answers and Explanations24$/)
    expect(contents('study', 18)).toMatch(/Chapter 1: One4$/)
  })
})

describe('the contents page of a book without answers', () => {
  const ROW = 'Answers and Explanations'
  const draw = (made: unknown) => {
    const { type, props } = made as { type: (props: unknown) => unknown; props: unknown }
    return type(props) as Element
  }
  // The contents page and the answers page of one drawn book.
  const pagesWith = (made: unknown, part: string) =>
    ((draw(made).props.children as unknown[]).flat(9) as Element[])
      .filter((node) => node && Screen.text(node).includes(part))
      .map((node) => Screen.text(node))

  it('the front pages are told only by false', async () => {
    for (const [given, passed] of [[false, false], [undefined, undefined], [true, undefined], ['false', undefined], [null, undefined], [0, undefined]]) {
      state.made = []
      await callRoute(FRONT[0], { body: { ...FRONT[1], hasAnswers: given } })
      expect(JSON.parse(state.made[0]).hasAnswers).toBe(passed)
    }
  })

  it('the front pages have no answers row then, and the same row as before in every other case', () => {
    const contents = (bookType: 'combined' | 'study' | 'practice', hasAnswers?: boolean) =>
      Screen.text(
        FrontmatterTemplate({
          course: { chapters: [{ chapterTitle: 'One' }] },
          bookType,
          edition: 'E',
          subtitle: 'S',
          chapterPageStarts: [4],
          totalPages: 25,
          answersPageStart: 18,
          hasAnswers,
        }),
      )
    for (const bookType of ['combined', 'practice'] as const) {
      expect(contents(bookType, false)).toMatch(/ContentsChapter 1: One4$/)
      for (const value of [undefined, true]) expect(contents(bookType, value)).toMatch(/ContentsChapter 1: One4Answers and Explanations18$/)
    }
    for (const value of [undefined, true, false]) expect(contents('study', value)).toMatch(/ContentsChapter 1: One4$/)
  })

  it.each<[string, object, number]>([
    ['generate', { bookType: 'combined' }, 0],
    ['generate', { bookType: 'practice' }, 0],
    ['generate-pq', {}, 0],
    ['generate-pq', {}, 1],
  ])('%s %o, drawing %i: the row is there with a printed question, and only then', async (name, body, at) => {
    const contents = async () => {
      state.drawn = []
      await make(name, { slug: 'course', ...body })
      const found = pagesWith(state.drawn[at], 'Contents')
      expect(found).toHaveLength(1)
      return found[0]
    }
    state.chapters = { course: [[['plain']], [['live']]] }
    expect(await contents()).toContain(ROW)
    for (const chapters of [[[['plain']]], [[['draft', 'gone']], [['unset']]]]) {
      state.chapters = { course: chapters }
      expect(await contents()).not.toContain(ROW)
      // The page of the answers itself stays, so no book changes its length.
      expect(pagesWith(state.drawn[at], ROW)).toHaveLength(1)
    }
  })

  it('in the kit, a question without text is not printed, so it does not make a row', async () => {
    state.chapters = { course: [[['blank']]] }
    await make('generate-pq', { slug: 'course' })
    for (const at of [0, 1]) expect(pagesWith(state.drawn[at], 'Contents')[0]).not.toContain(ROW)
    state.chapters = { course: [[['blank', 'live']]] }
    state.drawn = []
    await make('generate-pq', { slug: 'course' })
    for (const at of [0, 1]) expect(pagesWith(state.drawn[at], 'Contents')[0]).toContain(ROW)
  })
})

describe('a question with no stored answer', () => {
  const letters = (text: string) => Array.from(text.matchAll(/Q\d+: ?([A-E–])/g), (match) => match[1])
  const drawn = () => {
    const element = state.drawn[state.drawn.length - 1] as Element & { type: (props: unknown) => unknown }
    return Screen.text(element.type(element.props))
  }

  it.each<[string, object, (given: string) => string]>([
    ['generate', { slug: 'letters', bookType: 'combined' }, () => { state.drawn.pop(); return drawn() }],
    ['generate-pq', { slug: 'letters' }, () => { state.drawn.pop(); return drawn() }],
    ['generate-answers', { slug: 'letters' }, drawn],
    ['export-word', { slug: 'letters', bookType: 'combined' }, (given) => given],
  ])('%s prints a dash for it, and the letter of every other answer', async (name, body, read) => {
    state.lessons = { letters: [['letters']] }
    const { given } = await make(name, body)
    expect(letters(read(given))).toEqual(ANSWERS.map(([, letter]) => letter))
  })
})

describe('the new lines of the check reports', () => {
  const NO_ANSWER = '[WARN] 4 question(s) with no stored answer (printed as –) in set(s): letters'
  const ANSWERED = '[PASS] Every printed question has a stored answer'
  const PUBLISHED = '[PASS] Every printed article is published'
  const linesOf = async (name: string, body: object) => {
    const lines = (await make(name, { slug: 'course', ...body })).audit.split('\n')
    return {
      added: lines.filter((line) => /stored answer|unpublished article|article is published/.test(line)),
      verdict: lines[lines.length - 1].split(' - ')[0],
      after: lines[lines.indexOf('[PASS] No practice fetch errors') + 1],
    }
  }

  it('are exact', () => {
    expect(noAnswerLine([])).toBe(ANSWERED)
    expect(noAnswerLine(['a', 'b', 'a'])).toBe('[WARN] 3 question(s) with no stored answer (printed as –) in set(s): a, b')
    expect(unpublishedLine([])).toBe(PUBLISHED)
    expect(unpublishedLine(['a', 'b', 'a'])).toBe('[WARN] 2 unpublished article(s) printed: a, b')
  })

  it.each<[string, object, string]>([
    ['generate', { bookType: 'combined' }, NO_ANSWER],
    ['generate', { bookType: 'study' }, ANSWERED],
    ['generate-pq', {}, NO_ANSWER],
  ])('%s %o: questions without an answer', async (name, body, line) => {
    state.lessons = { course: [['letters']] }
    const { added, after } = await linesOf(name, body)
    expect(added).toEqual([line, PUBLISHED])
    expect(after).toBe(line)
  })

  it('a question printed twice counts twice', async () => {
    state.lessons = { course: [['letters'], ['letters']] }
    expect((await linesOf('generate', { bookType: 'combined' })).added[0]).toBe(
      '[WARN] 8 question(s) with no stored answer (printed as –) in set(s): letters',
    )
  })

  it.each<[string, object, string[]]>([
    ['generate', { bookType: 'combined' }, ['[WARN] 1 question(s) with no stored answer (printed as –) in set(s): blank', '[WARN] 3 unpublished article(s) printed: hidden, unmarked, blank']],
    ['generate', { bookType: 'study' }, [ANSWERED, '[WARN] 3 unpublished article(s) printed: hidden, unmarked, blank']],
    ['generate-pq', {}, [ANSWERED, '[WARN] 1 unpublished article(s) printed: hidden']],
  ])('%s %o: unpublished articles, and a question without text', async (name, body, expected) => {
    state.lessons = { course: [['live', 'hidden', 'unmarked'], ['hidden', 'blank']] }
    expect((await linesOf(name, body)).added).toEqual(expected)
  })

  it('they inform only: the verdict stays', async () => {
    state.lessons = { course: [['letters', 'hidden']] }
    expect((await linesOf('generate-pq', {})).verdict).toBe('FIDELITY VERDICT: COMPLETE')
  })

  it('a chapter says the same about its questions and articles', async () => {
    state.chapters = { course: [[['letters', 'hidden'], ['unmarked']], [['live']]] }
    const chapter = async (bookType: string, chapterIndex: number) => {
      const body = await (await callRoute('generate-chapter', { body: { slug: 'course', bookType, chapterIndex } })).json()
      return [body.noAnswerSets, body.unpublished]
    }
    expect(await chapter('combined', 0)).toEqual([['letters', 'letters', 'letters', 'letters'], ['hidden', 'unmarked']])
    expect(await chapter('study', 0)).toEqual([[], ['hidden', 'unmarked']])
    expect(await chapter('combined', 1)).toEqual([[], []])
  })
})

// ── The screen ──────────────────────────────────────────────────────────────
// The page's own code, run with a stand-in for React (state and one effect) and
// for adminFetch; pdf-lib and the rest are real.

type Element = { type: unknown; props: Record<string, unknown> }
type Answer = { status?: number; body?: unknown; file?: string; wait?: Promise<void> }

class Screen {
  calls: { name: string; body: Record<string, unknown> | null }[] = []
  files: Blob[] = []
  answers: Record<string, (body: Record<string, unknown>) => Answer> = {}
  private values: unknown[] = []
  private cursor = 0
  private effects: (() => void)[] = []
  private component: () => Element

  constructor() {
    const source = readFileSync(join(ROOT, 'app', ADMIN, 'ab-press', 'page.tsx'), 'utf8')
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    })
    const element = (type: unknown, props: Record<string, unknown>): Element => ({ type, props })
    const modules: Record<string, unknown> = {
      react: {
        useState: (first: unknown) => {
          const at = this.cursor++
          if (!(at in this.values)) this.values[at] = first
          return [this.values[at], (next: unknown) => { this.values[at] = next }]
        },
        useEffect: (effect: () => void) => { this.effects.push(effect) },
      },
      'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'fragment' },
      'pdf-lib': pdfLib,
      '@/lib/admin-fetch': { adminFetch: (url: string, init?: RequestInit) => this.fetch(url, init) },
    }
    const made: { exports: { default?: () => Element } } = { exports: {} }
    new Function('require', 'module', 'exports', outputText)((name: string) => modules[name], made, made.exports)
    if (!made.exports.default) throw new Error('no page')
    this.component = made.exports.default
  }

  private async fetch(url: string, init?: RequestInit) {
    const name = /\/([a-z-]+)(\?.*)?$/.exec(url)?.[1] ?? ''
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null
    this.calls.push({ name, body })
    const answer = this.answers[name]?.(body ?? {}) ?? { status: 404, body: { error: 'no answer' } }
    if (answer.wait) await answer.wait
    const status = answer.status ?? 200
    return { ok: status < 400, status, json: async () => answer.body, blob: async () => new Blob([answer.file ?? '']) }
  }

  elements(): Element[] {
    this.cursor = 0
    this.effects = []
    const found: Element[] = []
    const walk = (node: unknown) => {
      if (Array.isArray(node)) node.forEach(walk)
      else if (node && typeof node === 'object' && 'props' in node) {
        found.push(node as Element)
        walk((node as Element).props.children)
      }
    }
    walk(this.component())
    return found
  }

  static text(node: unknown): string {
    if (Array.isArray(node)) return node.map(Screen.text).join('')
    if (node && typeof node === 'object' && 'props' in node) return Screen.text((node as Element).props.children)
    return typeof node === 'string' || typeof node === 'number' ? String(node) : ''
  }

  get shown(): string {
    const [top] = this.elements()
    return Screen.text(top)
  }

  one(test: (element: Element) => boolean): Element {
    const found = this.elements().filter(test)
    if (found.length !== 1) throw new Error(`${found.length} elements found`)
    return found[0]
  }

  button = (text: string) => this.one((e) => e.type === 'button' && Screen.text(e).startsWith(text))
  select = (at: number) => this.elements().filter((e) => e.type === 'select')[at]
  radio = (value: string) => this.one((e) => e.type === 'input' && e.props.type === 'radio' && e.props.value === value)
  titleField = () => this.one((e) => e.type === 'input' && e.props.placeholder === 'e.g. Financial Accounting')
  // The texts the screen keeps in its state, shown or not.
  kept = (part: string) => this.values.filter((value) => typeof value === 'string' && value.includes(part))
  made = () => this.kept('blob:')
  links = () => this.elements().filter((e) => e.type === 'a').map((e) => String(e.props.download))
  press = (text: string) => (this.button(text).props.onClick as () => unknown)()
  change = (element: Element, value: string) => (element.props.onChange as (event: object) => void)({ target: { value } })

  async settle() {
    for (let i = 0; i < 400; i++) await new Promise((resolve) => setImmediate(resolve))
  }

  // Opens the screen, chooses the first course and loads its preview.
  async open({ load = true } = {}) {
    this.elements()
    const [effect] = this.effects
    effect()
    await this.settle()
    if (!load) return
    this.change(this.select(0), 'first')
    this.press('Load Course Preview')
    await this.settle()
  }

  // Presses a button that makes a book and waits for the result.
  async generate() {
    this.press('Generate Book')
    for (let i = 0; i < 50 && this.shown.includes('please wait'); i++) await this.settle()
  }

  async zip(): Promise<Record<string, Buffer>> {
    const bytes = Buffer.from(await this.files[this.files.length - 1].arrayBuffer())
    const found: Record<string, Buffer> = {}
    for (let at = 0; bytes.readUInt32LE(at) === 0x04034b50; ) {
      const size = bytes.readUInt32LE(at + 18)
      const name = at + 30
      const data = name + bytes.readUInt16LE(at + 26)
      found[bytes.toString('utf8', name, data)] = bytes.subarray(data, data + size)
      at = data + size
    }
    return found
  }
}

async function pdfOf(pages: number, width = 432): Promise<string> {
  const made = await pdfLib.PDFDocument.create()
  for (let i = 0; i < pages; i++) made.addPage([width, 648])
  return Buffer.from(await made.save()).toString('base64')
}

// A screen for a course of three chapters, made chapter by chapter.
const CHAPTER_PAGES = [5, 2, 7]
const ANSWER_PAGES = [3, 0, 4]
const QUESTIONS = [6, 0, 9]

async function screen(): Promise<Screen> {
  const made = new Screen()
  vi.spyOn(URL, 'createObjectURL').mockImplementation((file) => {
    made.files.push(file as Blob)
    return `blob:${made.files.length}`
  })
  const pdfs = new Map<number, string>()
  for (const pages of [...CHAPTER_PAGES, 1, 3]) pdfs.set(pages, await pdfOf(pages))
  // The pages of the answers are narrower, so they can be told apart.
  const answerPdfs = await Promise.all(ANSWER_PAGES.map((pages) => (pages ? pdfOf(pages, 400) : null)))
  made.answers = {
    'load-course': () => ({ body: { courses: ['first', 'second'].map((slug) => ({ _id: slug, slug, title: `Title ${slug}` })) } }),
    preview: () => ({
      body: {
        course: { title: 'Course', slug: 'first', chapters: CHAPTER_PAGES.map((_, i) => ({ _key: i, chapterTitle: `C${i}`, lessons: [] })) },
        courseKey: courseKey(planned(PLAN)),
        stats: { chapterCount: 3, lessonCount: 3, articleCount: 60, questionCount: 15, questionCountError: false },
        health: { verdict: 'ready', emptyArticles: 0, articlesWithWebElements: 0, totalWebElementsRemoved: 0, mcqLinked: 2, emptyList: [], webWarningDetails: [] },
        history: [],
      },
    }),
    'generate-chapter': ({ chapterIndex: at }) => ({
      body: { pdf: pdfs.get(CHAPTER_PAGES[at as number]), pageCount: CHAPTER_PAGES[at as number], chapterCount: 3, courseKey: courseKey(planned(PLAN)), questionCount: QUESTIONS[at as number], missingSets: [], noAnswerSets: [], unpublished: [] },
    }),
    'generate-answers': ({ chapterIndex: at }) => ({
      body: {
        pdf: answerPdfs[at as number],
        pageCount: ANSWER_PAGES[at as number],
        chapterCount: 3,
        courseKey: courseKey(planned(PLAN)),
        questionCount: QUESTIONS[at as number],
      },
    }),
    'generate-frontmatter': () => ({ body: { pdf: pdfs.get(3), courseKey: courseKey(planned(PLAN)) } }),
    'generate-cover': () => ({ body: { pdf: pdfs.get(1) ?? '' } }),
    generate: () => ({ file: 'zip' }),
    'generate-pq': () => ({ file: 'zip' }),
    'export-word': () => ({ file: 'word' }),
  }
  return made
}

// Changes one field of one answer of a route (of its only answer, when the route
// is not asked by chapter).
function spoil(made: Screen, name: string, at: number | undefined, change: object) {
  const before = made.answers[name]
  made.answers[name] = (body) => {
    const answer = before(body)
    return body.chapterIndex === at ? { ...answer, body: { ...(answer.body as object), ...change } } : answer
  }
}

describe('the messages of the screen', () => {
  const HEALTH_FAILED = 'Content check unavailable (the articles could not be read).'
  const HISTORY_FAILED = 'Publication history unavailable (it could not be read).'
  const COURSES_FAILED = 'Could not load the course list. Please reload the page.'
  const READY = 'Content ready for publication'
  const NO_BOOKS = 'No books generated yet for this course.'

  const historyPanel = (page: Screen) => page.one((e) => e.type === 'button' && Screen.text(e).startsWith('Publication History'))
  const opened = async (change: { health?: object; historyError?: boolean; history?: object[] }, { panel = true } = {}) => {
    const page = await screen()
    const { preview } = page.answers
    page.answers.preview = (body) => {
      const answer = preview(body).body as { health: object }
      return { body: { ...answer, ...change, health: { ...answer.health, ...change.health } } }
    }
    await page.open()
    if (panel) (historyPanel(page).props.onClick as () => void)()
    return page
  }
  const figures = (page: Screen) =>
    ['Empty Articles', 'Web Cleaned', 'Elements Removed', 'Practice Links'].map((name) => {
      const box = page.one((e) => e.type === 'div' && Screen.text(e).endsWith(name) && Screen.text(e).length < name.length + 4)
      return Screen.text(box).slice(0, -name.length)
    })

  it('a good preview shows its figures, its verdict and its history', async () => {
    const page = await opened({})
    expect(figures(page)).toEqual(['0', '0', '0', '2'])
    expect(page.shown).toContain(READY)
    expect(page.shown).toContain(NO_BOOKS)
    for (const message of [HEALTH_FAILED, HISTORY_FAILED, COURSES_FAILED]) expect(page.shown).not.toContain(message)
  })

  it('a failed content check shows dashes and its message, not a verdict', async () => {
    const page = await opened({ health: { unavailable: true, verdict: 'issues' } })
    expect(figures(page)).toEqual(['—', '—', '—', '—'])
    expect(page.shown).toContain(HEALTH_FAILED)
    expect(page.shown).not.toContain(READY)
    expect(page.shown).not.toContain('need attention')
    expect(page.one((e) => e.type === 'p' && Screen.text(e) === HEALTH_FAILED).props.className).toBe('text-red-400 text-xs mb-3')
  })

  it('a failed history read shows its message, not an empty history', async () => {
    const page = await opened({ historyError: true })
    expect(page.shown).toContain(HISTORY_FAILED)
    expect(page.shown).not.toContain(NO_BOOKS)
  })

  it('a failed history read shows its message in the heading, without opening the panel', async () => {
    const page = await opened({ historyError: true }, { panel: false })
    expect(Screen.text(historyPanel(page))).toBe(`Publication History${HISTORY_FAILED}▼`)
    const message = page.one((e) => e.type === 'span' && Screen.text(e) === HISTORY_FAILED)
    expect(message.props.className).toBe('text-slate-400 text-xs')
    // Open, the panel has the message; it is not said twice.
    ;(historyPanel(page).props.onClick as () => void)()
    expect(Screen.text(historyPanel(page))).toBe('Publication History▲')
    expect(page.shown.split(HISTORY_FAILED)).toHaveLength(2)
  })

  it('a good history read shows its count there as before, or nothing', async () => {
    expect(Screen.text(historyPanel(await opened({}, { panel: false })))).toBe('Publication History▼')
    const book = { id: 1, bookType: 'study', edition: 'E', subtitle: 'S', generatedAt: '2026-11-25T12:00:00' }
    const page = await opened({ historyError: false, history: [book, book] }, { panel: false })
    expect(Screen.text(historyPanel(page))).toBe('Publication History2 publications — last: 25 Nov 2026, 12:00▼')
    expect(page.shown).not.toContain(HISTORY_FAILED)
  })

  it.each<[string, Answer, boolean]>([
    ['a list', { body: { courses: [] } }, false],
    ['an error', { status: 500, body: { error: 'private detail' } }, true],
    ['an error with a list', { status: 500, body: { courses: [] } }, true],
    ['no list', { body: {} }, true],
    ['something else', { body: { courses: 'x' } }, true],
    ['nothing', { body: null }, true],
  ])('the course list answers with %s', async (_name, answer, failed) => {
    const page = await screen()
    page.answers['load-course'] = () => answer
    await page.open({ load: false })
    const messages = page.elements().filter((e) => e.type === 'p' && e.props.className === 'text-red-400 text-xs mt-2')
    expect(messages.map(Screen.text)).toEqual(failed ? [COURSES_FAILED] : [])
    expect(page.shown).not.toContain('private detail')
  })
})

describe('what the screen has made', () => {
  const CHANGES: [string, (page: Screen) => unknown][] = [
    ['the course', (page) => page.change(page.select(0), 'second')],
    ['the book type', (page) => page.change(page.radio('practice'), 'practice')],
    ['the title', (page) => page.change(page.titleField(), 'Another title')],
    ['the edition', (page) => page.change(page.select(1), '2027/28 Edition')],
    ['the preview', (page) => page.press('Load Course Preview')],
  ]

  it.each(CHANGES)('goes away, with its name, when %s changes', async (_name, change) => {
    const page = await screen()
    await page.open()
    await page.generate()
    page.press('Export as Word')
    await page.settle()
    expect(page.links()).toEqual(['first-study.zip', 'first-study.docx'])
    expect(page.made()).toEqual(['blob:1', 'blob:2'])
    change(page)
    expect(page.made()).toEqual([])
    expect(page.links()).toEqual([])
    await page.settle()
  })

  it.each(CHANGES)('the errors go away too when %s changes', async (_name, change) => {
    const page = await screen()
    page.answers['generate-chapter'] = () => ({ status: 500, body: { error: 'book problem' } })
    page.answers['export-word'] = () => ({ status: 500, body: { error: 'word problem' } })
    await page.open()
    await page.generate()
    page.press('Export as Word')
    await page.settle()
    expect(page.shown).toContain('book problem')
    expect(page.shown).toContain('word problem')
    change(page)
    expect(page.kept('problem')).toEqual([])
    await page.settle()
  })

  const locks = (page: Screen) => ({
    course: page.select(0).props.disabled,
    bookType: page.radio('study').props.disabled,
    title: page.titleField().props.disabled,
    edition: page.select(1).props.disabled,
  })
  const FREE = { course: false, bookType: false, title: false, edition: false }

  it('cannot change under a request: the fields are locked while one runs', async () => {
    const page = await screen()
    await page.open()
    expect(locks(page)).toEqual(FREE)

    for (const [route, button, expected] of [
      ['preview', 'Load Course Preview', { ...FREE, course: true }],
      ['export-word', 'Export as Word', { course: true, bookType: true, title: true, edition: true }],
      ['generate-chapter', 'Generate Book', { course: true, bookType: true, title: true, edition: true }],
    ] as const) {
      let release = () => {}
      const wait = new Promise<void>((resolve) => { release = resolve })
      const before = page.answers[route]
      page.answers[route] = (body) => ({ ...before(body), wait })
      page.press(button)
      await page.settle()
      expect(locks(page), route).toEqual(expected)
      release()
      for (let i = 0; i < 20; i++) await page.settle()
      expect(locks(page), route).toEqual(FREE)
      page.answers[route] = before
    }
  })
})

describe('the screen of a book made chapter by chapter', () => {
  const COURSE_CHANGED = 'The course has changed since the preview was loaded, so nothing was made. Please load the preview again.'
  const ANSWERS_DIFFER = 'The questions and answers of chapter 3 do not match, so nothing was made. Please try again in a minute.'

  it('makes the ZIP when everything matches', async () => {
    const page = await screen()
    await page.open()
    page.change(page.radio('combined'), 'combined')
    await page.generate()
    expect(page.links()).toEqual(['first-combined.zip'])
    expect(Object.keys(await page.zip())).toEqual(['interior.pdf', 'cover.pdf', 'metadata.txt', 'preflight-report.txt'])
    expect(page.calls.filter((call) => call.name === 'generate-answers').map((call) => call.body?.questionNumberOffset)).toEqual([0, 6, 6])
  })

  it.each<[string, number[]]>([
    ['combined', [3, 0, 4]],
    ['study', []],
  ])('%s: the contents page and the cover get the true page numbers', async (bookType, answers) => {
    const page = await screen()
    await page.open()
    page.change(page.radio(bookType), bookType)
    await page.generate()
    const sent = (name: string) => page.calls.filter((call) => call.name === name).map((call) => call.body)
    const firstAnswer = 4 + 5 + 2 + 7
    const total = firstAnswer - 1 + answers.reduce((sum, pages) => sum + pages, 0)
    expect(sent('generate-frontmatter')).toEqual([
      expect.objectContaining({ chapterPageStarts: [4, 9, 11], answersPageStart: firstAnswer, totalPages: firstAnswer + answers.filter(Boolean).length }),
    ])
    expect(sent('generate-cover')).toEqual([expect.objectContaining({ pageCount: total })])
    const { 'interior.pdf': interior } = await page.zip()
    const book = await pdfLib.PDFDocument.load(new Uint8Array(interior))
    expect(book.getPageCount()).toBe(total)
    const widths = book.getPages().map((made) => made.getWidth())
    expect(widths.indexOf(400)).toBe(answers.length ? firstAnswer - 1 : -1)
  })

  it('the ZIP has a check report, with the same lines as the other books', async () => {
    const page = await screen()
    await page.open()
    await page.generate()
    const report = async () => (await page.zip())['preflight-report.txt'].toString('utf8').split('\n')
    expect(await report()).toEqual([
      'AB Press check report (book made chapter by chapter)',
      '',
      '[PASS] All linked practice sets found',
      noAnswerLine([]),
      unpublishedLine([]),
    ])
    spoil(page, 'generate-chapter', 0, { missingSets: ['x', 'y'], noAnswerSets: ['s', 's'], unpublished: ['u', 'v'] })
    spoil(page, 'generate-chapter', 2, { missingSets: ['x'], noAnswerSets: ['t'], unpublished: ['u'] })
    page.change(page.radio('combined'), 'combined')
    await page.generate()
    expect(await report()).toEqual([
      'AB Press check report (book made chapter by chapter)',
      '',
      '[WARN] 3 linked practice set(s) not found or not live: x, y, x',
      noAnswerLine(['s', 's', 't']),
      unpublishedLine(['u', 'v', 'u']),
    ])
  })

  it.each<[string, string, number, object, string, string]>([
    ['a chapter was added', 'generate-chapter', 0, { chapterCount: 4 }, COURSE_CHANGED, 'generate-chapter'],
    ['a chapter was taken away', 'generate-chapter', 1, { chapterCount: 2 }, COURSE_CHANGED, 'generate-chapter'],
    ['the number of chapters is not told', 'generate-chapter', 2, { chapterCount: undefined }, COURSE_CHANGED, 'generate-chapter'],
    ['a chapter was added before the answers', 'generate-answers', 1, { chapterCount: 4 }, COURSE_CHANGED, 'generate-answers'],
    ['a question was added before the answers', 'generate-answers', 2, { questionCount: 10 }, ANSWERS_DIFFER, 'generate-answers'],
    ['the answers have no questions', 'generate-answers', 2, { questionCount: 0, pdf: null }, ANSWERS_DIFFER, 'generate-answers'],
  ])('%s: it stops with its message and makes nothing', async (_name, route, at, change, message, last) => {
    const page = await screen()
    spoil(page, route, at, change)
    await page.open()
    page.change(page.radio('combined'), 'combined')
    await page.generate()
    expect(page.shown).toContain(message)
    expect(page.links()).toEqual([])
    expect(page.files).toEqual([])
    expect(page.calls[page.calls.length - 1].name).toBe(last)
  })

  it('tells the front pages that there are no answers only when a book with questions has none', async () => {
    const page = await screen()
    const sent = async (bookType: string) => {
      page.change(page.radio(bookType), bookType)
      await page.generate()
      expect(page.links()).toEqual([`first-${bookType}.zip`])
      return page.calls.filter((call) => call.name === 'generate-frontmatter').pop()?.body ?? {}
    }
    await page.open()
    expect(await sent('combined')).not.toHaveProperty('hasAnswers')
    expect(await sent('study')).not.toHaveProperty('hasAnswers')
    for (const at of [0, 1, 2]) {
      spoil(page, 'generate-chapter', at, { questionCount: 0 })
      spoil(page, 'generate-answers', at, { questionCount: 0, pdf: null, pageCount: 0 })
    }
    expect(await sent('study')).not.toHaveProperty('hasAnswers')
    expect(await sent('combined')).toMatchObject({ hasAnswers: false })
    const { 'interior.pdf': interior } = await page.zip()
    expect((await pdfLib.PDFDocument.load(new Uint8Array(interior))).getPageCount()).toBe(3 + 5 + 2 + 7)
  })

  // Every part, as [route, chapter].
  const PARTS: [string, number | undefined][] = [
    ['generate-chapter', 0],
    ['generate-chapter', 2],
    ['generate-answers', 0],
    ['generate-answers', 1],
    ['generate-frontmatter', undefined],
  ]
  const KEYS: [string, () => string | undefined][] = [
    ...CHANGED.map(([name, plan]): [string, () => string] => [name, () => courseKey(planned(plan))]),
    ['the key is not told', () => undefined],
    ['the key is empty', () => ''],
  ]

  it.each(KEYS.flatMap(([name, key]) => PARTS.map(([route, at]) => [name, route, at, key] as const)))(
    '%s, seen by %s %s: it stops with its message and makes nothing',
    async (_name, route, at, key) => {
      const page = await screen()
      spoil(page, route, at, { courseKey: key() })
      await page.open()
      page.change(page.radio('combined'), 'combined')
      await page.generate()
      expect(page.shown).toContain(COURSE_CHANGED)
      expect(page.links()).toEqual([])
      expect(page.files).toEqual([])
      expect(page.calls[page.calls.length - 1].name).toBe(route)
      expect(page.calls[page.calls.length - 1].body?.chapterIndex).toBe(at)
    },
  )

  it.each([undefined, ''])('a preview without a key (%s) does not count as the same course', async (key) => {
    const page = await screen()
    spoil(page, 'preview', undefined, { courseKey: key })
    for (const [route, at] of PARTS) spoil(page, route, at, { courseKey: key })
    await page.open()
    await page.generate()
    expect(page.shown).toContain(COURSE_CHANGED)
    expect(page.files).toEqual([])
    expect(page.calls[page.calls.length - 1]).toMatchObject({ name: 'generate-chapter', body: { chapterIndex: 0 } })
  })

  it('the messages are exact', () => {
    const source = readFileSync(join(ROOT, 'app', ADMIN, 'ab-press', 'page.tsx'), 'utf8')
    expect(source).toContain(`const COURSE_CHANGED = '${COURSE_CHANGED}'\n`)
    expect(source).toContain(`const ANSWERS_DIFFER = (n: number) => \`${ANSWERS_DIFFER.replace('3', '${n}')}\`\n`)
  })
})
