import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildCourse, fetchQuestions, type BuildStats } from './ab-press-builder'
import { getAdminPath } from './middleware-logic'

// AB Press reads live practice sets only (owner decision D341). The first part
// reads the text of every AB Press file: each query on question_sets carries
// the filter. The second part runs the shared builder on a fake network.

vi.mock('@/lib/coursesNew', () => ({
  getCourseBySlug: async () => ({
    id: 'course',
    title: 'Course',
    slug: 'course',
    chapters: [
      {
        id: 'chapter',
        title: 'Chapter',
        chapterOrder: 1,
        lessons: [
          {
            id: 'lesson',
            title: 'Lesson',
            slug: 'lesson',
            articles: ['live', 'draft', 'unset', 'gone'].map((name) => ({ id: `a-${name}`, title: name, slug: name })),
          },
        ],
      },
    ],
  }),
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

type Row = Record<string, string | number | null>

const set = (name: string, status: string | null): Row => ({ id: `s-${name}`, slug: name, status })
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

const TABLES: Record<string, Row[]> = {
  articles: ['live', 'draft', 'unset', 'gone'].map((name) => ({
    id: `a-${name}`,
    content: '',
    mcq_url: `/practice-questions/${name}`,
  })),
  question_sets: [set('live', 'published'), set('draft', 'draft'), set('unset', null)],
  questions: ['live', 'draft', 'unset'].map(question),
}

// Answers a GET as the database would, with its eq and in filters.
async function fakeDatabase(input: RequestInfo | URL): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : String(input))
  let rows = TABLES[url.pathname.split('/').pop() ?? ''] ?? []
  url.searchParams.forEach((value, column) => {
    if (value.startsWith('eq.')) rows = rows.filter((row) => String(row[column]) === value.slice(3) && row[column] !== null)
    if (value.startsWith('in.(')) {
      const wanted = value.slice(4, -1).split(',')
      rows = rows.filter((row) => wanted.includes(String(row[column])))
    }
  })
  return new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } })
}

describe('the shared builder', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://db.invalid')
    vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn(fakeDatabase))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

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
})
