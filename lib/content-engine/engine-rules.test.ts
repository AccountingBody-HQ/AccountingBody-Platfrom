// Rules for the engine's own source files: standalone (imports only from the
// engine folder and node:crypto), no logging, no environment reads.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '..', '..')
const FOLDER = 'lib/content-engine'

function engineSourceFiles(): string[] {
  const listed = execFileSync('git', ['ls-files', '--', FOLDER], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
  return listed.filter(file => file.endsWith('.ts') && !file.endsWith('.test.ts'))
}

function importSpecifiers(source: string): string[] {
  const specifiers: string[] = []
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(source)) !== null) specifiers.push(match[1])
  }
  return specifiers
}

describe('content engine source rules', () => {
  const files = engineSourceFiles()

  it('finds the engine source files through git', () => {
    expect(files.length).toBeGreaterThanOrEqual(10)
  })

  it('imports only from inside the engine folder or node:crypto', () => {
    for (const file of files) {
      const source = readFileSync(path.join(ROOT, file), 'utf8')
      for (const specifier of importSpecifiers(source)) {
        if (specifier === 'node:crypto') continue
        expect(specifier.startsWith('./') || specifier.startsWith('../'), `${file} imports ${specifier}`).toBe(true)
        const target = path.normalize(path.join(path.dirname(file), specifier))
        expect(target.startsWith(FOLDER + path.sep) || target === FOLDER, `${file} imports ${specifier}`).toBe(true)
      }
    }
  })

  it('never logs and never reads the environment', () => {
    for (const file of files) {
      const source = readFileSync(path.join(ROOT, file), 'utf8')
      expect(source, file).not.toMatch(/\bconsole\s*\./)
      expect(source, file).not.toMatch(/\bprocess\s*\.\s*env\b/)
    }
  })

  it('has no clock, randomness or network calls', () => {
    for (const file of files) {
      const source = readFileSync(path.join(ROOT, file), 'utf8')
      expect(source, file).not.toMatch(/\bDate\.now\b|\bnew Date\(|Math\.random|\bfetch\(|XMLHttpRequest|WebSocket/)
    }
  })
})
