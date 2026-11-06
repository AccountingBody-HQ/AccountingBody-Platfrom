import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import { getAdminPath } from './middleware-logic'

const HTTP_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
const SHARED_CHECK = 'isAuthenticated'
const SHARED_MODULE = '@/lib/admin-auth'

function parse(source: string): ts.SourceFile {
  return ts.createSourceFile('route.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

function isExported(node: ts.HasModifiers): boolean {
  return ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false
}

function importsSharedCheck(file: ts.SourceFile): boolean {
  return file.statements.some((statement) => {
    if (!ts.isImportDeclaration(statement)) return false
    if (!ts.isStringLiteral(statement.moduleSpecifier)) return false
    if (statement.moduleSpecifier.text !== SHARED_MODULE) return false
    const named = statement.importClause?.namedBindings
    return !!named && ts.isNamedImports(named) && named.elements.some((item) => item.name.text === SHARED_CHECK)
  })
}

function definesOwnCheck(file: ts.SourceFile): boolean {
  let found = false
  const visit = (node: ts.Node) => {
    if ((ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) && node.name?.getText() === SHARED_CHECK) {
      found = true
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

function exportedHandlers(file: ts.SourceFile): ts.FunctionDeclaration[] {
  return file.statements.filter(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && isExported(statement) && HTTP_METHODS.includes(statement.name?.text ?? ''),
  )
}

function exportsHandlerAsVariable(file: ts.SourceFile): boolean {
  return file.statements.some(
    (statement) =>
      ts.isVariableStatement(statement) &&
      isExported(statement) &&
      statement.declarationList.declarations.some((item) => HTTP_METHODS.includes(item.name.getText())),
  )
}

// if (!(await isAuthenticated(<the handler's request>))) ...
function checksSessionFirst(handler: ts.FunctionDeclaration): boolean {
  const first = handler.body?.statements[0]
  if (!first || !ts.isIfStatement(first)) return false
  const request = handler.parameters[0]?.name.getText()
  return first.expression.getText() === `!(await ${SHARED_CHECK}(${request}))`
}

// The folder comes from the app's own default, so its name is not repeated here.
vi.stubEnv('ADMIN_PATH', undefined)
const apiRoot = join(process.cwd(), 'app', 'api', getAdminPath())
vi.unstubAllEnvs()

const routes = readdirSync(apiRoot, { recursive: true, encoding: 'utf8' })
  .filter((path) => /(^|\/)route\.tsx?$/.test(path))
  .sort()
  .map((path) => {
    const source = readFileSync(join(apiRoot, path), 'utf8')
    return { name: path, source, file: parse(source) }
  })

describe('every admin API route uses the shared session check', () => {
  it('finds the admin API routes', () => {
    expect(routes.length).toBeGreaterThanOrEqual(44)
  })

  it.each(routes.map((route) => [route.name, route] as const))('%s', (_name, route) => {
    expect(importsSharedCheck(route.file)).toBe(true)
    expect(definesOwnCheck(route.file)).toBe(false)
    expect(exportsHandlerAsVariable(route.file)).toBe(false)
    expect(route.source).not.toContain('admin_token')
    expect(route.source).not.toContain('ADMIN_SECRET')

    const handlers = exportedHandlers(route.file)
    expect(handlers.length).toBeGreaterThan(0)
    for (const handler of handlers) {
      expect(checksSessionFirst(handler)).toBe(true)
    }
  })

  it('does not count a handler that starts with anything else', () => {
    const file = parse(
      'export async function GET(req) { const rows = await load(); if (!(await isAuthenticated(req))) return no(); return rows }',
    )
    expect(checksSessionFirst(exportedHandlers(file)[0])).toBe(false)
  })

  it('does not count a route without the import', () => {
    expect(importsSharedCheck(parse("import { isAuthenticated } from './local'"))).toBe(false)
    expect(importsSharedCheck(parse("import { other } from '@/lib/admin-auth'"))).toBe(false)
  })

  it('does not count a route with its own check', () => {
    expect(definesOwnCheck(parse('async function isAuthenticated(req) { return true }'))).toBe(true)
  })
})
