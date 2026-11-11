import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import { getAdminPath } from './middleware-logic'

// Server code creates supabase-js clients only through lib/supabase-server.ts.
// The three files below create their own on purpose. This list may only
// shrink: a file that stops creating its own client must be removed from it,
// and no new file may be added.

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

  it('only the factory and the three kept files create their own client', () => {
    expect(users).toEqual(
      [FACTORY, 'lib/ab-press-builder.ts', `app/api/${ADMIN}/ab-press/preview/route.ts`, 'app/api/careerjet/route.ts'].sort(),
    )
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
