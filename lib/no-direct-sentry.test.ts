import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

// Server problems reach Sentry only through reportServerError
// (lib/report-error.ts), which keeps each report short and bounded. No other
// product file calls a Sentry capture function itself, apart from the files
// listed below with the reason.

const ROOT = process.cwd()
const FOLDERS = ['app', 'lib', 'components']

const SHARED_HELPER = 'lib/report-error.ts'
const ALLOWED: Record<string, string> = {
  'app/error.tsx': 'browser error page; browser reports pass the browser filter in sentry.client.config.ts',
  'app/global-error.tsx': 'browser error page; browser reports pass the browser filter in sentry.client.config.ts',
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return entry === 'node_modules' ? [] : sourceFiles(path)
    return /\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : []
  })
}

const FILES = FOLDERS.flatMap((folder) => sourceFiles(join(ROOT, folder))).map((file) => relative(ROOT, file))

function parse(file: string, source = readFileSync(join(ROOT, file), 'utf8')): ts.SourceFile {
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
}

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

const CAPTURE = /^capture[A-Z]\w*$/

// Calls to a Sentry capture function: Sentry.captureX(...) or captureX(...).
function captureCalls(file: ts.SourceFile): string[] {
  const found: string[] = []
  walk(file, (node) => {
    if (!ts.isCallExpression(node)) return
    const callee = node.expression
    const name = ts.isPropertyAccessExpression(callee) ? callee.name.text : ts.isIdentifier(callee) ? callee.text : ''
    if (CAPTURE.test(name)) found.push(name)
  })
  return found
}

function callsTo(file: ts.SourceFile, name: string): ts.CallExpression[] {
  const found: ts.CallExpression[] = []
  walk(file, (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name) found.push(node)
  })
  return found
}

function literal(node: ts.Node | undefined): string | null {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null
}

// The label each report is sent with, as the shared helpers build it.
function reportLabels(file: ts.SourceFile): string[] {
  const labels: string[] = []
  for (const call of callsTo(file, 'reportServerError')) {
    const label = literal(call.arguments[0])
    if (label !== null) labels.push(label)
  }
  for (const call of callsTo(file, 'checkRead')) {
    const label = literal(call.arguments[1])
    if (label !== null) labels.push(label)
  }
  for (const call of callsTo(file, 'checkEmailSend')) {
    const label = literal(call.arguments[1])
    if (label !== null) labels.push(`email: ${label}`)
  }
  for (const call of callsTo(file, 'verifyHumanCheck')) {
    const label = literal(call.arguments[3])
    if (label !== null) labels.push(`person check: ${label}`)
  }
  return labels
}

const ROUTE_LABELS = [
  'job expiry run failed',
  'pending subscriber cleanup failed',
  'saved jobs cleanup failed',
  'job import run failed',
  'job import stale run cleanup failed',
  'job import due check failed',
  'job import dispatch failed',
  'job click failed',
  'job listings load failed',
  'employer checkout failed',
  'payment notice failed',
  'job manage link failed',
  'job withdraw failed',
  'saved jobs load failed',
  'saved job save failed',
  'saved job remove failed',
  'saved jobs import failed',
  'search job lookup failed',
  'search job lookup timed out',
  'subscribe person check refused',
  'admin sign-in failed',
  'admin record action failed',
  'admin article publish failed',
  'admin article search failed',
  'admin category list failed',
  'admin AI content generate failed',
  'admin AI content publish failed',
  'admin course factory delete failed',
  'admin course save request unreadable',
  'admin course save failed',
  'admin course update request unreadable',
  'admin course delete failed',
  'admin job update failed',
  'admin candidate email failed',
  'admin firm email failed',
  'admin provider edit request unreadable',
  'admin provider preview request unreadable',
  'admin provider preview adapter missing',
  'admin provider preview failed',
  'admin provider run start failed',
  'admin provider create request unreadable',
  'admin AI question generate failed',
  'admin question set publish failed',
  'admin reply email failed',
]

describe('problem reports go through the shared helper', () => {
  it('finds capture calls in any form', () => {
    expect(captureCalls(parse('a.ts', "import * as Sentry from '@sentry/nextjs'\nSentry.captureException(e)"))).toStrictEqual(['captureException'])
    expect(captureCalls(parse('a.ts', "import { captureMessage } from '@sentry/nextjs'\ncaptureMessage('x')"))).toStrictEqual(['captureMessage'])
    expect(captureCalls(parse('a.ts', '// Sentry.captureException(e)\nreportServerError("x", e)'))).toStrictEqual([])
  })

  it('looks at the app, lib and components folders', () => {
    expect(FILES).toContain(SHARED_HELPER)
    expect(FILES).toContain('app/api/search/route.ts')
    expect(FILES.some((file) => file.startsWith('components/'))).toBe(true)
  })

  it('no product file calls a Sentry capture function itself', () => {
    const callers = FILES.filter((file) => file !== SHARED_HELPER && !(file in ALLOWED) && captureCalls(parse(file)).length > 0)
    expect(callers).toStrictEqual([])
  })

  it('the shared helper is the one server file that captures', () => {
    expect(captureCalls(parse(SHARED_HELPER))).toStrictEqual(['captureException'])
  })

  it('the list only holds files that still capture, each with a reason', () => {
    for (const [file, reason] of Object.entries(ALLOWED)) {
      expect(FILES).toContain(file)
      expect(captureCalls(parse(file)).length).toBeGreaterThan(0)
      expect(readFileSync(join(ROOT, file), 'utf8').startsWith("'use client'")).toBe(true)
      expect(reason.length).toBeGreaterThan(10)
    }
  })

  it('gives each route report its own label across the codebase', () => {
    const all = FILES.flatMap((file) => reportLabels(parse(file)))
    for (const label of ROUTE_LABELS) expect(all.filter((found) => found === label)).toStrictEqual([label])
  })
})
