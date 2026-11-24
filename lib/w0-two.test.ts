import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { describe, expect, it } from 'vitest'

// W0-2: the site fonts are served from this site, so a page asks Google for nothing before a cookie choice.
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const FONT_HOSTS = /fonts\.(?:googleapis|gstatic)\.com/
const HTML_FILES = ['app/layout.tsx', 'app/global-error.tsx']
const DIR = 'app/_fonts'

const css = read(`${DIR}/fonts.css`)
const rules = css
  .split('@font-face')
  .slice(1)
  .map((r) => r.slice(r.indexOf('{') + 1, r.indexOf('}')))
const value = (rule: string, name: string) => rule.match(new RegExp(`\\n\\s*${name}: ([^;]+);`))?.[1] ?? ''
const file = (rule: string) => value(rule, 'src').match(/^url\('\.\/([a-z0-9-]+\.woff2)'\) format\('woff2(?:-variations)?'\)$/)?.[1] ?? ''

describe('no page source names a Google font host', () => {
  it.each([...HTML_FILES, 'app/globals.css', `${DIR}/fonts.css`])('%s', (path) => {
    expect(read(path)).not.toMatch(FONT_HOSTS)
  })
  it('no tracked source file in app, components or lib does (tests excluded)', () => {
    const files = execFileSync('git', ['ls-files', '--', 'app', 'components', 'lib'], { encoding: 'utf8' })
      .split('\n')
      .filter((f) => /\.(?:tsx?|jsx?|mjs|css)$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter((f) => existsSync(join(process.cwd(), f)))
    expect(files.length).toBeGreaterThan(300)
    expect(files.filter((f) => FONT_HOSTS.test(read(f))).map((f) => basename(f))).toEqual([])
  })
})

describe('both files that render <html> import the fonts', () => {
  it.each(HTML_FILES)('%s imports them once, before globals.css, with no @import rule', (path) => {
    const src = read(path)
    expect(src).toMatch(/\nimport '\.\/_fonts\/fonts\.css'\nimport '\.\/globals\.css'\n/)
    expect(src.split('_fonts/fonts.css')).toHaveLength(2)
    expect(src).not.toMatch(/@import\s*(?:url\(|['"])/)
  })
  it('globals.css imports no stylesheet and keeps the three font variables', () => {
    const globals = read('app/globals.css')
    expect(globals).not.toMatch(/@import\s*(?:url\(|['"])/)
    expect(globals).toContain("  --font-display:     'DM Serif Display', Georgia, serif;\n")
    expect(globals).toContain("  --font-sans:        'DM Sans', system-ui, sans-serif;\n")
    expect(globals).toContain("  --font-mono:        'JetBrains Mono', 'Fira Code', monospace;\n")
  })
})

describe('app/_fonts/fonts.css', () => {
  it('has exactly ten faces, in the three families', () => {
    expect(rules).toHaveLength(10)
    expect(rules.map((r) => value(r, 'font-family')).sort()).toEqual([
      ...Array(4).fill("'DM Sans'"),
      ...Array(4).fill("'DM Serif Display'"),
      ...Array(2).fill("'JetBrains Mono'"),
    ])
  })
  it('keeps the weight ranges the pages have always been drawn with', () => {
    const faces = rules.map((r) => [value(r, 'font-family'), value(r, 'font-style'), value(r, 'font-weight')].join(' '))
    expect(Array.from(new Set(faces)).sort()).toEqual([
      "'DM Sans' italic 400 500",
      "'DM Sans' normal 300 700",
      "'DM Serif Display' italic 400",
      "'DM Serif Display' normal 400",
      "'JetBrains Mono' normal 400 500",
    ])
  })
  it('gives every face swap, a Latin or Latin Extended range and a file', () => {
    for (const r of rules) {
      expect(value(r, 'font-display')).toBe('swap')
      expect(value(r, 'unicode-range')).toMatch(file(r).includes('-latin-ext-') ? /^U\+0100-02BA,/ : /^U\+0000-00FF,/)
      expect(file(r)).not.toBe('')
    }
  })
  it('uses every font file in the folder once, and no other', () => {
    const onDisk = readdirSync(join(process.cwd(), DIR)).filter((f) => f.endsWith('.woff2'))
    expect(onDisk).toHaveLength(10)
    expect(rules.map(file).sort()).toEqual(onDisk.sort())
    expect(css.match(/url\(/g)).toHaveLength(10)
    // each file is a real WOFF2 file
    for (const f of onDisk) expect(readFileSync(join(process.cwd(), DIR, f)).subarray(0, 4).toString('latin1')).toBe('wOF2')
  })
})

describe('the font licences travel with the files', () => {
  it.each(['dm-sans', 'dm-serif-display', 'jetbrains-mono'])('%s', (name) => {
    expect(read(`${DIR}/LICENSE-${name}.txt`)).toContain('SIL OPEN FONT LICENSE Version 1.1')
  })
  it('the folder holds nothing else, so it is never a route', () => {
    const others = readdirSync(join(process.cwd(), DIR)).filter((f) => !/\.woff2$|^LICENSE-[a-z-]+\.txt$/.test(f))
    expect(others).toEqual(['fonts.css'])
  })
})
