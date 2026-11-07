import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import { getAdminPath } from './middleware-logic'

// Server code creates supabase-js clients only through lib/supabase-server.ts.
// The files below still create their own and move to the factory in later
// steps. This list may only shrink: a file that stops creating its own
// client must be removed from it, and no new file may be added.

const MODULE = '@supabase/supabase-js'
const FACTORY = 'lib/supabase-server.ts'

// The folder comes from the app's own default, so its name is not repeated here.
vi.stubEnv('ADMIN_PATH', undefined)
const ADMIN = getAdminPath()
vi.unstubAllEnvs()

const LEGACY = [
  // Kept on purpose: AB Press (locked) and a route due for removal.
  'lib/ab-press-builder.ts',
  `app/api/${ADMIN}/ab-press/preview/route.ts`,
  'app/api/careerjet/route.ts',

  // Public write APIs.
  'app/api/confirm-subscription/route.ts',
  'app/api/contact/route.ts',
  'app/api/firms-application/route.ts',
  'app/api/help-request/route.ts',
  'app/api/jobs/employer/checkout/route.ts',
  'app/api/jobs/employer/webhook/route.ts',
  'app/api/recruitment/confirm-brief/route.ts',
  'app/api/recruitment/employer-brief/route.ts',
  'app/api/recruitment/fetch-brief/route.ts',
  'app/api/recruitment/get-profile/route.ts',
  'app/api/recruitment/job-seeker-apply/route.ts',
  'app/api/recruitment/update-candidate/route.ts',
  'app/api/recruitment/update-employer/route.ts',
  'app/api/recruitment/verify-email/route.ts',
  'app/api/subscribe/route.ts',

  // Scheduled routes and provider ingestion.
  'app/api/cron/expire-jobs/route.ts',
  'app/api/cron/prune-pending-subscribers/route.ts',
  'app/api/ingest/[slug]/route.ts',

  // Admin APIs.
  `app/api/${ADMIN}/actions/route.ts`,
  `app/api/${ADMIN}/articles/[articleId]/route.ts`,
  `app/api/${ADMIN}/articles/lookup/route.ts`,
  `app/api/${ADMIN}/articles/publish/route.ts`,
  `app/api/${ADMIN}/articles/search/route.ts`,
  `app/api/${ADMIN}/categories/route.ts`,
  `app/api/${ADMIN}/content-factory/publish/route.ts`,
  `app/api/${ADMIN}/course-factory/delete-course/route.ts`,
  `app/api/${ADMIN}/course-factory/fetch-article/route.ts`,
  `app/api/${ADMIN}/course-factory/load-course/route.ts`,
  `app/api/${ADMIN}/course-factory/save/route.ts`,
  `app/api/${ADMIN}/courses/[courseId]/route.ts`,
  `app/api/${ADMIN}/jobs/[id]/route.ts`,
  `app/api/${ADMIN}/jobs/explain-relevance-sample/route.ts`,
  `app/api/${ADMIN}/jobs/reevaluate-relevance/route.ts`,
  `app/api/${ADMIN}/notify-candidate/route.ts`,
  `app/api/${ADMIN}/notify-firm/route.ts`,
  `app/api/${ADMIN}/providers/[slug]/edit/route.ts`,
  `app/api/${ADMIN}/providers/[slug]/preview/route.ts`,
  `app/api/${ADMIN}/providers/[slug]/route.ts`,
  `app/api/${ADMIN}/providers/create/route.ts`,
  `app/api/${ADMIN}/providers/route.ts`,
  `app/api/${ADMIN}/questions/[setId]/route.ts`,
  `app/api/${ADMIN}/questions/publish/route.ts`,
  `app/api/${ADMIN}/studio/article-content/route.ts`,
  `app/api/${ADMIN}/studio/daily-articles/route.ts`,
  `app/api/${ADMIN}/studio/post-social/route.ts`,
  `app/api/${ADMIN}/studio/references/route.ts`,
  `app/api/${ADMIN}/studio/session/route.ts`,

  // Admin pages.
  `app/${ADMIN}/articles/page.tsx`,
  `app/${ADMIN}/candidates/page.tsx`,
  `app/${ADMIN}/courses/page.tsx`,
  `app/${ADMIN}/employers/page.tsx`,
  `app/${ADMIN}/jobs-firms/page.tsx`,
  `app/${ADMIN}/jobs/page.tsx`,
  `app/${ADMIN}/page.tsx`,
  `app/${ADMIN}/providers/[slug]/page.tsx`,
  `app/${ADMIN}/questions/page.tsx`,
  `app/${ADMIN}/submissions/page.tsx`,
  `app/${ADMIN}/subscribers/page.tsx`,
]

const ROOT = process.cwd()
const SKIP_DIRS = new Set(['node_modules', 'reports'])
const SOURCE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/
const TEST = /\.test\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/

function sourceFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...sourceFiles(path))
    else if (SOURCE.test(entry.name) && !TEST.test(entry.name)) found.push(relative(ROOT, path).split(sep).join('/'))
  }
  return found
}

function isModule(node: ts.Node): boolean {
  return ts.isStringLiteral(node) && node.text === MODULE
}

// True when the file takes createClient (by value) from supabase-js in any
// form: a named import (also renamed), a namespace or default import, a
// require() or a dynamic import().
function takesCreateClient(path: string, source: string): boolean {
  const kind = path.endsWith('x') ? ts.ScriptKind.TSX : path.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind)
  let found = false
  const visit = (node: ts.Node) => {
    if (found) return
    if (ts.isImportDeclaration(node) && isModule(node.moduleSpecifier)) {
      const clause = node.importClause
      if (clause && !clause.isTypeOnly) {
        const named = clause.namedBindings
        if (clause.name) found = true
        else if (named && ts.isNamespaceImport(named)) found = true
        else if (named && ts.isNamedImports(named)) {
          found = named.elements.some(
            (item) => !item.isTypeOnly && (item.propertyName ?? item.name).text === 'createClient',
          )
        }
      }
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && isModule(node.moduleSpecifier)) {
      found = !node.isTypeOnly
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
      node.arguments.length > 0 &&
      isModule(node.arguments[0])
    ) {
      found = true
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

const users = sourceFiles(ROOT)
  .filter((path) => takesCreateClient(path, readFileSync(join(ROOT, path), 'utf8')))
  .sort()

describe('server database clients come from one place', () => {
  it('scans the application source', () => {
    expect(users).toContain(FACTORY)
    expect(users.length).toBeGreaterThan(LEGACY.length)
  })

  it('no file other than the factory and the listed files creates its own client', () => {
    const allowed = new Set([FACTORY, ...LEGACY])
    expect(users.filter((path) => !allowed.has(path))).toEqual([])
  })

  it('every listed file still creates its own client, so the list can only shrink', () => {
    const missing = LEGACY.filter((path) => !existsSync(join(ROOT, path)) || !users.includes(path))
    expect(missing).toEqual([])
  })

  it('lists each file once', () => {
    expect(new Set(LEGACY).size).toBe(LEGACY.length)
  })

  it('recognises every way of taking createClient, and ignores type-only imports', () => {
    const yes = [
      `import { createClient } from '${MODULE}'`,
      `import { createClient as make } from '${MODULE}'`,
      `import * as supabase from '${MODULE}'`,
      `import supabase from '${MODULE}'`,
      `export { createClient } from '${MODULE}'`,
      `const { createClient } = require('${MODULE}')`,
      `const m = await import('${MODULE}')`,
    ]
    const no = [
      `import type { SupabaseClient } from '${MODULE}'`,
      `import { type SupabaseClient } from '${MODULE}'`,
      `import { createClient } from '@sanity/client'`,
      `// import { createClient } from '${MODULE}'`,
    ]
    for (const source of yes) expect(takesCreateClient('x.ts', source), source).toBe(true)
    for (const source of no) expect(takesCreateClient('x.ts', source), source).toBe(false)
  })
})
