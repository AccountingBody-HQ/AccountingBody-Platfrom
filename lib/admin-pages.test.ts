import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import { getAdminPath } from './middleware-logic'

const DATA_ENTRY_POINTS = ['generateMetadata', 'generateStaticParams']

function parse(source: string): ts.SourceFile {
  return ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

function isClientFile(file: ts.SourceFile): boolean {
  for (const statement of file.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break
    if (statement.expression.text === 'use client') return true
  }
  return false
}

function hasModifier(node: ts.HasModifiers, kind: ts.SyntaxKind): boolean {
  return ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) ?? false
}

function findDefaultExport(file: ts.SourceFile): ts.FunctionDeclaration | undefined {
  return file.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) &&
      hasModifier(statement, ts.SyntaxKind.ExportKeyword) &&
      hasModifier(statement, ts.SyntaxKind.DefaultKeyword),
  )
}

function findExportedFunctions(file: ts.SourceFile, names: string[]): ts.FunctionDeclaration[] {
  return file.statements.filter(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) &&
      hasModifier(statement, ts.SyntaxKind.ExportKeyword) &&
      names.includes(statement.name?.text ?? ''),
  )
}

function checksSessionFirst(fn: ts.FunctionDeclaration | undefined): boolean {
  const first = fn?.body?.statements[0]
  if (!first || !ts.isExpressionStatement(first)) return false
  const expression = first.expression
  return (
    ts.isAwaitExpression(expression) &&
    ts.isCallExpression(expression.expression) &&
    expression.expression.expression.getText() === 'requireAdmin' &&
    expression.expression.arguments.length === 0
  )
}

// The folder comes from the app's own default, so its name is not repeated here.
vi.stubEnv('ADMIN_PATH', undefined)
const adminRoot = join(process.cwd(), 'app', getAdminPath())
vi.unstubAllEnvs()

const pages = readdirSync(adminRoot, { recursive: true, encoding: 'utf8' })
  .filter((path) => path === 'page.tsx' || path.endsWith('/page.tsx'))
  .map((path) => join(adminRoot, path))
  .sort()
  .map((path) => ({ name: relative(adminRoot, path), file: parse(readFileSync(path, 'utf8')) }))

const serverPages = pages.filter((page) => !isClientFile(page.file))
const clientPages = pages.filter((page) => isClientFile(page.file))

describe('every server admin page checks the session first', () => {
  it('finds the admin pages', () => {
    expect(serverPages.length).toBeGreaterThan(0)
    expect(clientPages.length).toBeGreaterThan(0)
  })

  it.each(serverPages.map((page) => [page.name, page.file] as const))('%s', (_name, file) => {
    expect(checksSessionFirst(findDefaultExport(file))).toBe(true)
    for (const fn of findExportedFunctions(file, DATA_ENTRY_POINTS)) {
      expect(checksSessionFirst(fn)).toBe(true)
    }
  })

  it('the admin layout checks the session first on the server', () => {
    const layout = parse(readFileSync(join(adminRoot, 'layout.tsx'), 'utf8'))
    expect(isClientFile(layout)).toBe(false)
    expect(checksSessionFirst(findDefaultExport(layout))).toBe(true)
  })

  it('does not count a page that starts with anything else', () => {
    const queriesFirst = parse(
      'export default async function Page() { const rows = await load(); await requireAdmin(); return rows }',
    )
    expect(checksSessionFirst(findDefaultExport(queriesFirst))).toBe(false)
  })

  it('recognises the client directive below a comment', () => {
    expect(isClientFile(parse("// note\n\n'use client'\nexport default function Page() {}"))).toBe(true)
  })
})
