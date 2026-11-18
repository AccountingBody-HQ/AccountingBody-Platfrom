import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// Colour-contrast guards (A11-F2, FINDINGS FN, owner decision D233: one brand gold #C9982A).
// WCAG 2.2 AA: 4.5:1 for normal text. The admin area is found by its layout and skipped without naming it.
const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const config = read('tailwind.config.ts')

function shade(family: string, step: string): string {
  const block = config.match(new RegExp(family + ':\\s*\\{([\\s\\S]*?)\\}'))
  if (!block) throw new Error('no ' + family + ' block')
  const m = block[1].match(new RegExp('\\b' + step + ":\\s*'(#[0-9a-fA-F]{6})'"))
  if (!m) throw new Error('no ' + family + '-' + step)
  return m[1]
}
function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const f = (x: number) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}
function ratio(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx|css|js|mjs)$/.test(name) && !name.includes('.test.')) out.push(relative(root, full))
  }
  return out
}
const appDir = join(root, 'app')
const adminDirs = readdirSync(appDir).filter((name) => {
  try {
    return readFileSync(join(appDir, name, 'layout.tsx'), 'utf8').includes('requireAdmin')
  } catch {
    return false
  }
})
const isAdmin = (f: string) =>
  adminDirs.some((d) => f.startsWith(`app/${d}/`) || f.startsWith(`app/${d}-`) || f.startsWith(`components/${d}/`) || f.startsWith(`app/api/${d}/`))
const WHITE = '#ffffff'
const SURFACE = '#F8F7F4'

describe('colour contrast (A11-F2)', () => {
  it('uses one brand gold, #C9982A (D233)', () => {
    expect(shade('gold', '500')).toBe('#C9982A')
    expect(config).toContain("accent:  '#C9982A'")
    const files = [...walk(join(root, 'app')), ...walk(join(root, 'components')), ...walk(join(root, 'lib'))]
    expect(files.filter((f) => /#D4A017/i.test(read(f)))).toEqual([])
  })

  it('text shades reach 4.5:1 on white and on the page surface', () => {
    for (const [fam, step] of [['slate', '400'], ['slate', '500'], ['slate', '600'], ['gold', '600'], ['teal', '600']]) {
      const hex = shade(fam, step)
      expect(ratio(hex, WHITE), `${fam}-${step} on white`).toBeGreaterThanOrEqual(4.5)
      expect(ratio(hex, SURFACE), `${fam}-${step} on surface`).toBeGreaterThanOrEqual(4.5)
    }
    expect(ratio(shade('slate', '400'), shade('slate', '100'))).toBeGreaterThanOrEqual(4.5)
  })

  it('the stylesheet uses the readable gold for text', () => {
    const css = read('app/globals.css')
    expect(css).not.toMatch(/\n\s+color: var\(--color-gold-500\);/)
  })

  it('public pages use no faint white or light grey text classes', () => {
    const files = [...walk(join(root, 'app')), ...walk(join(root, 'components'))]
      .filter((f) => f.endsWith('.tsx') && !isAdmin(f) && !f.startsWith('app/api/'))
    const bad = files.filter((f) => /(?<![\w-])text-white\/(?:25|30|35|40|45|50|55)(?![\w/-])|(?<![\w-])text-gray-400(?![\w/-])/.test(read(f)))
    expect(bad).toEqual([])
  })
})

// RV-60 review additions: the stylesheet and the Tailwind palette agree, and the gold buttons,
// pressed states, the skip-link ring and the navy job-alert icon stay readable.
const publicTsx = () =>
  [...walk(join(root, 'app')), ...walk(join(root, 'components'))].filter(
    (f) => f.endsWith('.tsx') && !isAdmin(f) && !f.startsWith('app/api/'),
  )
const GOLD_BG = /(?<![\w:-])(?:bg-gold-(?:500|600)|bg-accent|bg-\[#C9982A\])(?![\w/-])/i
const WHITE_TEXT = /(?<![\w-])(?:hover:)?text-white(?![\w/-])/

describe('colour contrast (RV-60)', () => {
  it('stylesheet colour variables equal the Tailwind palette for the changed tokens', () => {
    const css = read('app/globals.css')
    for (const [fam, step] of [['gold', '500'], ['gold', '600'], ['slate', '400'], ['slate', '500'], ['slate', '600'], ['teal', '600']]) {
      const m = css.match(new RegExp('--color-' + fam + '-' + step + ':\\s*(#[0-9a-fA-F]{6});'))
      expect(m?.[1].toLowerCase(), `--color-${fam}-${step}`).toBe(shade(fam, step).toLowerCase())
    }
  })

  it('text on solid gold stays dark, also on hover (white on gold is 2.6:1 to 3.8:1)', () => {
    const bad: string[] = []
    for (const f of publicTsx()) {
      for (const frag of read(f).split(/['"`]|\$\{|\}/)) {
        if (GOLD_BG.test(frag) && WHITE_TEXT.test(frag)) bad.push(f)
      }
    }
    expect(bad).toEqual([])
  })

  it('pressed gold buttons keep the brand gold (navy on gold-600 is 3.25:1)', () => {
    expect(publicTsx().filter((f) => /active:bg-gold-600(?![\w/-])/.test(read(f)))).toEqual([])
  })

  it('the skip link focus ring is navy, not gold (gold on white is 2.6:1)', () => {
    const layout = read('app/layout.tsx')
    const start = layout.indexOf('href="#main-content"')
    const end = layout.indexOf('Skip to main content')
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const tag = layout.slice(start, end)
    expect(tag).toContain('focus:ring-navy-950')
    expect(tag).not.toMatch(/ring-gold-/)
  })

  it('the job-alert icon on the navy banner uses the brand gold', () => {
    const src = read('app/jobs/listings/JobListingsClient.tsx')
    const start = src.indexOf('<div className="bg-navy-950 rounded-2xl px-5 py-4 mb-6">')
    expect(start).toBeGreaterThan(-1)
    const head = src.slice(start, start + 600)
    expect(head).not.toMatch(/text-gold-600/)
    expect(head).toMatch(/bg-gold-500\/20 [^"]*text-gold-500/)
  })
})
