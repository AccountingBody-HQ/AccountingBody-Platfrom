import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { errorCode } from './newsletter-signup'

// PRIV-1 (S4): log lines in the newsletter routes and their shared code print
// a fixed label and an error code only — never an e-mail address, a token or
// a whole error object.

const FILES = [
  'app/api/subscribe/route.ts',
  'app/api/contact/route.ts',
  'app/api/confirm-subscription/route.ts',
  'app/api/unsubscribe/route.ts',
  'lib/newsletter-signup.ts',
  'lib/newsletter-unsubscribe.ts',
]

// An argument may be a string literal, errorCode(...), `x.code || 'no-code'`,
// or a ternary of those.
function isSafeArgument(node: ts.Expression): boolean {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return true
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'errorCode') return true
  if (ts.isConditionalExpression(node)) return isSafeArgument(node.whenTrue) && isSafeArgument(node.whenFalse)
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
    return ts.isPropertyAccessExpression(node.left) && node.left.name.text === 'code' && isSafeArgument(node.right)
  }
  return false
}

function logCalls(file: string): { text: string; safe: boolean }[] {
  const source = ts.createSourceFile(file, readFileSync(join(process.cwd(), file), 'utf8'), ts.ScriptTarget.Latest, true)
  const found: { text: string; safe: boolean }[] = []
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText() === 'console'
    ) {
      found.push({ text: node.getText(), safe: node.arguments.every(isSafeArgument) })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

describe('newsletter log lines', () => {
  it.each(FILES)('%s logs a fixed label and an error code only', (file) => {
    const unsafe = logCalls(file).filter((call) => !call.safe).map((call) => call.text)
    expect(unsafe).toEqual([])
  })

  it('the three routes that logged whole objects now log codes', () => {
    expect(readFileSync(join(process.cwd(), 'app/api/subscribe/route.ts'), 'utf8')).toContain('console.error("Subscribe error:", errorCode(error))')
    expect(readFileSync(join(process.cwd(), 'app/api/contact/route.ts'), 'utf8')).toContain("console.error('Contact route error:', errorCode(error))")
    expect(readFileSync(join(process.cwd(), 'app/api/confirm-subscription/route.ts'), 'utf8')).toContain(
      'console.error("Admin notification error:", errorCode(emailError))',
    )
  })

  it('errorCode gives only a short code, never the message', () => {
    expect(errorCode({ code: '23505', message: 'Key (email)=(ada@example.com) already exists' })).toBe('23505')
    expect(errorCode(new Error('ada@example.com failed'))).toBe('no-code')
    expect(errorCode({ code: 'ada@example.com' })).toBe('no-code')
    expect(errorCode(null)).toBe('no-code')
    expect(errorCode('ada@example.com')).toBe('no-code')
  })
})
