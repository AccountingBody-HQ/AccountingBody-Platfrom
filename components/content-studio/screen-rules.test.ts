// Rules for the Content Studio screen's source: every visible text comes from
// WORDING, content is never rendered as HTML, and nothing is kept on the device.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { LEVEL_OPTIONS, WORDING } from '@/lib/content-studio/wording'
import ContentStudio from './ContentStudio'

// As components/AdminSignedOutNotice.test.ts does: the test build uses the classic JSX form.
vi.stubGlobal('React', React)

const FOLDER = path.join(process.cwd(), 'components', 'content-studio')
const FILES = readdirSync(FOLDER).filter(f => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))

/** Constants that hold class names and styles only. */
const STYLE_CONSTANTS = ['C', 'FOCUS', 'BUTTON', 'FIELD', 'CARD', 'HEADING', 'HELP']
/** Attributes whose values are class names or styles. */
const STYLE_ATTRIBUTES = ['className', 'style']

const WORDING_TEXTS = new Set<string>([
  ...(Object.values(WORDING) as unknown[]).filter((v): v is string => typeof v === 'string'),
  ...LEVEL_OPTIONS.map(o => o.label),
])

function source(file: string): ts.SourceFile {
  return ts.createSourceFile(file, readFileSync(path.join(FOLDER, file), 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
}

function insideStyle(node: ts.Node): boolean {
  // The 'use client' directive at the top of the file.
  if (ts.isExpressionStatement(node.parent) && node.parent.parent === node.getSourceFile()) return true
  for (let at: ts.Node | undefined = node.parent; at; at = at.parent) {
    if (ts.isImportDeclaration(at)) return true
    if (ts.isVariableDeclaration(at) && ts.isIdentifier(at.name) && STYLE_CONSTANTS.includes(at.name.text)) return true
    if (ts.isJsxAttribute(at)) return STYLE_ATTRIBUTES.includes(at.name.getText())
  }
  return false
}

/**
 * The scanner: every string or template piece longer than 3 characters with a
 * space, and every JSX text with a letter, outside imports, style constants
 * and className/style attributes, must be a WORDING text.
 */
function strayTexts(file: ts.SourceFile): string[] {
  const found: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const text = node.text.trim()
      if (/[A-Za-z]/.test(text)) found.push(text)
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      const text = node.text
      if (text.length > 3 && /\s/.test(text) && !insideStyle(node) && !WORDING_TEXTS.has(text)) found.push(text)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

describe('the Content Studio screen source', () => {
  it('finds the screen files', () => {
    expect(FILES.sort()).toEqual(['ContentStudio.tsx', 'view.ts'])
  })

  it('holds no visible text of its own', () => {
    for (const file of FILES) expect([file, strayTexts(source(file))]).toEqual([file, []])
  })

  it('the scanner catches a stray text', () => {
    const bad = ts.createSourceFile('x.tsx', "const a = 'Hello there'; const b = <p>Typed here</p>; const c = <p className=\"text-xs mb-2\">{WORDING.ready}</p>", ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    expect(strayTexts(bad)).toEqual(['Hello there', 'Typed here'])
  })

  it('never renders HTML and never keeps anything on the device', () => {
    for (const file of FILES) {
      const text = readFileSync(path.join(FOLDER, file), 'utf8')
      expect(text, file).not.toContain('dangerouslySetInnerHTML')
      expect(text, file).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/)
    }
  })

  it('calls the server only through adminFetch', () => {
    const text = readFileSync(path.join(FOLDER, 'ContentStudio.tsx'), 'utf8')
    expect(text).toContain("from '@/lib/admin-fetch'")
    expect(text).not.toMatch(/(^|[^a-zA-Z])fetch\(/)
  })

  it('renders the first view with the approved texts', () => {
    const html = renderToStaticMarkup(createElement(ContentStudio, { apiBase: '/api/test/content-studio', publishUrl: '/api/test/publish' }))
    for (const text of [WORDING.pageTitle, WORDING.pageIntro, WORDING.tabPlan, WORDING.tabMake, WORDING.planTitle]) {
      expect(html).toContain(text)
    }
  })
})
