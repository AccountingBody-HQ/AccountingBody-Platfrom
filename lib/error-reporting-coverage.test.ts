import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import { getAdminPath } from './middleware-logic'

// Every route handler's final catch block (a try/catch directly in an
// exported handler) reports the problem with reportServerError
// (lib/report-error.ts). Files that do not do this yet are listed below with
// the reason. The list can only shrink: a listed file that now reports must be
// taken off it.

// The folder comes from the app's own default, so its name is not repeated here.
vi.stubEnv('ADMIN_PATH', undefined)
const ADMIN = getAdminPath()
vi.unstubAllEnvs()

const STAGE_PUBLIC = 'later stage: public forms and recruitment'
const TOOL_ANSWER = "the catch gives the tool's answer to the admin's own input"
const STAGE_SOCIAL = 'later job: social posting tool'

// Paths under app/api; '@admin' stands for the admin folder.
const NOT_YET_REPORTING: Record<string, string> = {
  'confirm-subscription': STAGE_PUBLIC,
  '@admin/articles/import': TOOL_ANSWER,
  '@admin/providers/[slug]/test': TOOL_ANSWER,
  '@admin/questions/import': TOOL_ANSWER,
  '@admin/studio/post-social': STAGE_SOCIAL,
}

const API = join(process.cwd(), 'app/api')

function toFile(key: string): string {
  return join(API, key.replace(/^@admin/, ADMIN), 'route.ts')
}

function toKey(file: string): string {
  const path = relative(API, file).replace(/\/route\.tsx?$/, '')
  return path === ADMIN || path.startsWith(`${ADMIN}/`) || path.startsWith(`${ADMIN}-`) ? `@admin${path.slice(ADMIN.length)}` : path
}

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return routeFiles(path)
    return entry === 'route.ts' || entry === 'route.tsx' ? [path] : []
  })
}

// Final catch blocks: a try statement directly in an exported handler.
function finalCatches(source: string, name = 'route.ts'): { reports: boolean }[] {
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true)
  const found: { reports: boolean }[] = []
  const calls = (node: ts.Node): boolean =>
    (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'reportServerError') ||
    (ts.forEachChild(node, calls) ?? false)
  for (const statement of file.statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.body) continue
    if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue
    for (const inner of statement.body.statements) {
      if (ts.isTryStatement(inner) && inner.catchClause) found.push({ reports: calls(inner.catchClause.block) })
    }
  }
  return found
}

const needsReport = (file: string) => finalCatches(readFileSync(file, 'utf8'), basename(file)).some((c) => !c.reports)

describe('route handlers report server problems', () => {
  it('finds final catch blocks and whether they report', () => {
    expect(finalCatches('export async function GET() { try { a() } catch (e) { reportServerError("x", e) } }')).toEqual([
      { reports: true },
    ])
    expect(finalCatches('export async function POST() { try { a() } catch { console.error("x") } }')).toEqual([{ reports: false }])
    expect(finalCatches('async function helper() { try { a() } catch {} }')).toEqual([])
    expect(finalCatches('export async function GET() { if (x) { try { a() } catch {} } }')).toEqual([])
  })

  it('sees a handler that has markup in its file', () => {
    const markup = 'const a = (b: string) => <p style={{ color: b }}>Q{b}: x</p>\n'
    const handler = 'export async function POST() { try { a("x") } catch { console.error("x") } }'
    expect(finalCatches(markup + handler, 'route.tsx')).toEqual([{ reports: false }])
    const files = routeFiles(API).filter((file) => file.endsWith('.tsx'))
    expect(files.map(toKey)).toEqual(['@admin/ab-press/generate-answers'])
    expect(finalCatches(readFileSync(files[0], 'utf8'), basename(files[0]))).toEqual([{ reports: true }])
  })

  it('every route with a final catch block reports, or is listed with a reason', () => {
    const missing = routeFiles(API)
      .filter(needsReport)
      .map(toKey)
      .filter((key) => !(key in NOT_YET_REPORTING))
    expect(missing).toEqual([])
  })

  it('the list only holds routes that still need the change', () => {
    const stale = Object.keys(NOT_YET_REPORTING).filter((key) => !existsSync(toFile(key)) || !needsReport(toFile(key)))
    expect(stale).toEqual([])
  })

  it('every listed route has a reason', () => {
    for (const reason of Object.values(NOT_YET_REPORTING)) expect(reason.length).toBeGreaterThan(10)
  })
})
