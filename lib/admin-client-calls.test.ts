import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import { getAdminPath } from './middleware-logic'

const HELPER = 'adminFetch'
const HELPER_MODULE = '@/lib/admin-fetch'
const NETWORK_GLOBALS = ['XMLHttpRequest', 'EventSource']

function parse(source: string): ts.SourceFile {
  return ts.createSourceFile('client.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

function walk(file: ts.SourceFile, visit: (node: ts.Node) => void): void {
  const step = (node: ts.Node) => {
    visit(node)
    ts.forEachChild(node, step)
  }
  step(file)
}

function usesPlainNetworkCall(file: ts.SourceFile): boolean {
  let found = false
  walk(file, (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      if (ts.isIdentifier(callee) && callee.text === 'fetch') found = true
      if (ts.isPropertyAccessExpression(callee) && ['fetch', 'sendBeacon'].includes(callee.name.text)) found = true
    }
    if (ts.isIdentifier(node) && NETWORK_GLOBALS.includes(node.text)) found = true
  })
  return found
}

function callsHelper(file: ts.SourceFile): boolean {
  let found = false
  walk(file, (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === HELPER) found = true
  })
  return found
}

function importsHelper(file: ts.SourceFile): boolean {
  return file.statements.some((statement) => {
    if (!ts.isImportDeclaration(statement)) return false
    if (!ts.isStringLiteral(statement.moduleSpecifier)) return false
    if (statement.moduleSpecifier.text !== HELPER_MODULE) return false
    const named = statement.importClause?.namedBindings
    return !!named && ts.isNamedImports(named) && named.elements.some((item) => item.name.text === HELPER)
  })
}

// The folder comes from the app's own default, so its name is not repeated here.
vi.stubEnv('ADMIN_PATH', undefined)
const folder = getAdminPath()
vi.unstubAllEnvs()

const roots = [join(process.cwd(), 'app', folder), join(process.cwd(), 'components', folder)]

const clients = roots
  .filter((root) => existsSync(root))
  .flatMap((root) =>
    readdirSync(root, { recursive: true, encoding: 'utf8' })
      .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path))
      .map((path) => ({ name: path, file: parse(readFileSync(join(root, path), 'utf8')) })),
  )

describe('admin screens call admin routes through the shared helper', () => {
  it('finds the admin screens', () => {
    expect(clients.filter((client) => callsHelper(client.file)).length).toBeGreaterThanOrEqual(21)
  })

  it.each(clients.map((client) => [client.name, client.file] as const))('%s', (_name, file) => {
    expect(usesPlainNetworkCall(file)).toBe(false)
    if (callsHelper(file)) expect(importsHelper(file)).toBe(true)
  })

  it.each([
    ['fetch', "await fetch('/api/x')"],
    ['fetch in a chain', "fetch('/api/x').then((r) => r.json())"],
    ['window.fetch', "window.fetch('/api/x')"],
    ['sendBeacon', "navigator.sendBeacon('/api/x')"],
    ['XMLHttpRequest', 'new XMLHttpRequest()'],
  ])('does not count a file that uses %s', (_label, source) => {
    expect(usesPlainNetworkCall(parse(source))).toBe(true)
  })

  it('counts a file that uses the helper', () => {
    const file = parse("import { adminFetch } from '@/lib/admin-fetch'\nawait adminFetch('/api/x')")
    expect(usesPlainNetworkCall(file)).toBe(false)
    expect(callsHelper(file)).toBe(true)
    expect(importsHelper(file)).toBe(true)
  })

  it('does not count a helper from somewhere else', () => {
    expect(importsHelper(parse("import { adminFetch } from './local'"))).toBe(false)
  })
})

describe('admin layout', () => {
  const layout = readFileSync(join(process.cwd(), 'app', folder, 'layout.tsx'), 'utf8')

  it('shows the signed-out notice on every admin screen', () => {
    expect(layout).toContain('<AdminSignedOutNotice')
  })

  it('takes the sign-in address from the admin path', () => {
    expect(layout).toContain("loginHref={'/' + getAdminPath() + '-login'}")
  })
})

describe('admin settings page', () => {
  const settings = readFileSync(join(process.cwd(), 'app', folder, 'settings', 'page.tsx'), 'utf8')

  it('lists the session secret as a required variable', () => {
    expect(settings).toMatch(/\{ name: "ADMIN_SESSION_SECRET", required: true, description: "[^"]+" \}/)
  })

  it('shows only whether a variable is set', () => {
    expect(settings).toContain('const isSet = !!process.env[env.name]')
    expect(settings).not.toMatch(/\{\s*process\.env\[/)
    expect(settings).not.toContain('process.env.ADMIN_SESSION_SECRET')
  })
})
