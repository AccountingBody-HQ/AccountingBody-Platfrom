import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { decideRequest, getAdminPath } from '@/lib/middleware-logic'
import { dynamic, GET } from './route'

const COMMIT = '0123456789abcdef0123456789abcdef01234567'
const DEPLOYMENT = 'dpl_Abc123XyZ'
const READ_NAMES = ['VERCEL_DEPLOYMENT_ID', 'VERCEL_ENV', 'VERCEL_GIT_COMMIT_SHA']

function setValues(values: Record<string, string | undefined>) {
  for (const name of READ_NAMES) vi.stubEnv(name, values[name])
}

async function answer() {
  const res = GET()
  return { res, body: await res.json() }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('/api/version GET', () => {
  it('shows the commit, environment and deployment the platform provides', async () => {
    setValues({ VERCEL_GIT_COMMIT_SHA: COMMIT, VERCEL_ENV: 'production', VERCEL_DEPLOYMENT_ID: DEPLOYMENT })

    const { res, body } = await answer()

    expect(res.status).toBe(200)
    expect(body).toEqual({
      commit: COMMIT,
      commitShort: '0123456',
      environment: 'production',
      deployment: DEPLOYMENT,
    })
  })

  it.each(['preview', 'development'])('shows the %s environment', async (environment) => {
    setValues({ VERCEL_ENV: environment })

    const { body } = await answer()

    expect(body.environment).toBe(environment)
  })

  it('answers 200 with nulls when nothing is set, as locally and in CI', async () => {
    setValues({})

    const { res, body } = await answer()

    expect(res.status).toBe(200)
    expect(body).toEqual({ commit: null, commitShort: null, environment: null, deployment: null })
  })

  it('answers null for empty values', async () => {
    setValues({ VERCEL_GIT_COMMIT_SHA: '', VERCEL_ENV: '', VERCEL_DEPLOYMENT_ID: '' })

    const { body } = await answer()

    expect(body).toEqual({ commit: null, commitShort: null, environment: null, deployment: null })
  })

  it('shows only values with the expected shape', async () => {
    setValues({
      VERCEL_GIT_COMMIT_SHA: 'not-a-commit',
      VERCEL_ENV: 'something-else',
      VERCEL_DEPLOYMENT_ID: 'plain text value',
    })

    const { body } = await answer()

    expect(body).toEqual({ commit: null, commitShort: null, environment: null, deployment: null })
  })

  it('is never cached', async () => {
    setValues({ VERCEL_GIT_COMMIT_SHA: COMMIT })

    const { res } = await answer()

    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(dynamic).toBe('force-dynamic')
  })

  it('answers with exactly the four listed fields', async () => {
    setValues({ VERCEL_GIT_COMMIT_SHA: COMMIT, VERCEL_ENV: 'preview', VERCEL_DEPLOYMENT_ID: DEPLOYMENT })

    const { res, body } = await answer()

    expect(Object.keys(body).sort()).toEqual(['commit', 'commitShort', 'deployment', 'environment'])
    expect(res.headers.get('content-type')).toContain('application/json')
  })
})

describe('/api/version route file', () => {
  const source = readFileSync(join(process.cwd(), 'app', 'api', 'version', 'route.ts'), 'utf8')
  const file = ts.createSourceFile('route.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

  function isProcessEnv(node: ts.Node): boolean {
    return ts.isPropertyAccessExpression(node) && node.getText() === 'process.env'
  }

  const namesRead: string[] = []
  const otherEnvUses: string[] = []
  const imports: string[] = []
  const exportedNames: string[] = []
  const visit = (node: ts.Node) => {
    if (isProcessEnv(node)) {
      const parent = node.parent
      if (ts.isPropertyAccessExpression(parent) && parent.expression === node) namesRead.push(parent.name.text)
      else otherEnvUses.push(parent.getText())
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text)
    if (
      (ts.isFunctionDeclaration(node) || ts.isVariableStatement(node)) &&
      ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      if (ts.isFunctionDeclaration(node)) exportedNames.push(node.name?.text ?? '')
      else node.declarationList.declarations.forEach((item) => exportedNames.push(item.name.getText()))
    }
    ts.forEachChild(node, visit)
  }
  visit(file)

  it('reads only the three platform values, each by name', () => {
    expect(Array.from(new Set(namesRead)).sort()).toEqual(READ_NAMES)
    expect(otherEnvUses).toEqual([])
  })

  it('imports only the response helper', () => {
    expect(imports).toEqual(['next/server'])
  })

  it('exports only GET and the dynamic setting', () => {
    expect(exportedNames.sort()).toEqual(['GET', 'dynamic'])
  })

  it('does not read the request', () => {
    const handler = file.statements.find(
      (statement): statement is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(statement) && statement.name?.text === 'GET',
    )
    expect(handler?.parameters.length).toBe(0)
  })
})

describe('middleware lets /api/version through as a public address', () => {
  // The admin folder comes from the app's own default, so its name is not repeated here.
  vi.stubEnv('ADMIN_PATH', undefined)
  const adminPath = getAdminPath()
  vi.unstubAllEnvs()

  const base = {
    pathname: '/api/version',
    adminPath,
    adminToken: undefined,
    adminSessionSecret: undefined,
    adminSecret: undefined,
  }

  it('continues for accountingbody.com without a session', async () => {
    const decision = await decideRequest({ ...base, headers: new Headers({ host: 'accountingbody.com' }) })
    expect(decision).toEqual({ action: 'continue', platform: 'accountingbody' })
  })

  it('continues for ethiotax.com without a session', async () => {
    const decision = await decideRequest({
      ...base,
      headers: new Headers({ host: 'accountingbody.com', 'x-forwarded-host': 'ethiotax.com' }),
    })
    expect(decision).toEqual({ action: 'continue', platform: 'ethiotax' })
  })

  it('continues with a trailing slash', async () => {
    const decision = await decideRequest({ ...base, pathname: '/api/version/', headers: new Headers() })
    expect(decision).toEqual({ action: 'continue', platform: 'accountingbody' })
  })
})
