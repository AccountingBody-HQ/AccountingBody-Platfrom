import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import { getAdminPath } from './middleware-logic'
import { DB_LIMITS_MS } from './supabase-server'

// Each admin page and API, scheduled route and the provider import route gets
// its database clients from the factory with one context for all of its
// work: admin screens and tools use `admin`, scheduled routes `cron`, and the
// provider import `ingest`. Every client is created inside a function, so no
// client is shared between requests.

// The folder comes from the app's own default, so its name is not repeated here.
vi.stubEnv('ADMIN_PATH', undefined)
const ADMIN = getAdminPath()
vi.unstubAllEnvs()

const ADMIN_APIS = [
  'actions',
  'articles/[articleId]',
  'articles/lookup',
  'articles/publish',
  'articles/search',
  'categories',
  'content-factory/publish',
  'course-factory/delete-course',
  'course-factory/fetch-article',
  'course-factory/load-course',
  'course-factory/save',
  'courses/[courseId]',
  'jobs/[id]',
  'jobs/explain-relevance-sample',
  'jobs/reevaluate-relevance',
  'notify-candidate',
  'notify-firm',
  'providers/[slug]/edit',
  'providers/[slug]/preview',
  'providers/[slug]',
  'providers/create',
  'providers',
  'questions/[setId]',
  'questions/publish',
  'studio/article-content',
  'studio/daily-articles',
  'studio/post-social',
  'studio/references',
  'studio/session',
].map((path) => `app/api/${ADMIN}/${path}/route.ts`)

const ADMIN_PAGES = [
  'articles/',
  'candidates/',
  'courses/',
  'employers/',
  'jobs-firms/',
  'jobs/',
  '',
  'providers/[slug]/',
  'questions/',
  'submissions/',
  'subscribers/',
].map((path) => `app/${ADMIN}/${path}page.tsx`)

const FILES: [string, keyof typeof DB_LIMITS_MS][] = [
  ...ADMIN_APIS.map((path): [string, 'admin'] => [path, 'admin']),
  ...ADMIN_PAGES.map((path): [string, 'admin'] => [path, 'admin']),
  ['app/api/cron/expire-jobs/route.ts', 'cron'],
  ['app/api/cron/prune-pending-subscribers/route.ts', 'cron'],
  ['lib/ingestion/run-provider-import.ts', 'ingest'],
]

// Number of places each file creates a client.
const CLIENTS: Record<string, number> = {
  [`app/api/${ADMIN}/studio/references/route.ts`]: 3,
  [`app/api/${ADMIN}/studio/session/route.ts`]: 2,
  [`app/${ADMIN}/articles/page.tsx`]: 2,
  [`app/${ADMIN}/courses/page.tsx`]: 2,
  [`app/${ADMIN}/questions/page.tsx`]: 2,
  [`app/${ADMIN}/submissions/page.tsx`]: 2,
  [`app/${ADMIN}/subscribers/page.tsx`]: 2,
}

type Creation = { context: string; insideFunction: boolean }

function creations(path: string, source = readFileSync(join(process.cwd(), path), 'utf8')): Creation[] {
  const kind = path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind)
  const found: Creation[] = []
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'getServerSupabase') {
      const [first] = node.arguments
      let insideFunction = false
      for (let parent = node.parent; parent; parent = parent.parent) {
        if (ts.isFunctionLike(parent)) insideFunction = true
      }
      found.push({ context: first && ts.isStringLiteral(first) ? first.text : '<not a literal>', insideFunction })
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

describe('admin, scheduled and import code uses one context per file', () => {
  it('covers every moved file once', () => {
    expect(FILES).toHaveLength(43)
    expect(new Set(FILES.map(([path]) => path)).size).toBe(43)
  })

  it.each(FILES)('%s uses only the %s context', (path, context) => {
    const found = creations(path)
    expect(found.map((item) => item.context)).toEqual(Array(CLIENTS[path] ?? 1).fill(context))
  })

  it.each(FILES.map(([path]) => path))('%s creates each client inside a function', (path) => {
    expect(creations(path).every((item) => item.insideFunction)).toBe(true)
  })

  it('tells a client made per call from one made once for the module', () => {
    expect(creations('x.ts', "const supabase = getServerSupabase('admin')")).toEqual([
      { context: 'admin', insideFunction: false },
    ])
    expect(creations('x.ts', "function get() { return getServerSupabase('cron') }")).toEqual([
      { context: 'cron', insideFunction: true },
    ])
    expect(creations('x.ts', 'const c = DB; getServerSupabase(c)')).toEqual([
      { context: '<not a literal>', insideFunction: false },
    ])
  })
})
