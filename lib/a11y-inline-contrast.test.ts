import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// Inline-style colour contrast guards (A11-F3; owner decision D233: #C9982A stays the brand gold,
// #88671c is the gold for text on light backgrounds). WCAG 2.2 AA: 4.5:1 normal text, 3:1 large text.
// The admin area is found by its layout and skipped without naming it.
const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')

function lum(hex: string): number {
  const h = hex.length === 4 ? '#' + [...hex.slice(1)].map((c) => c + c).join('') : hex
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
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
    else if (name.endsWith('.tsx') && !name.includes('.test.')) out.push(relative(root, full))
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
  adminDirs.some((d) => f.startsWith(`app/${d}/`) || f.startsWith(`app/${d}-`) || f.startsWith(`components/${d}/`))
const publicTsx = [...walk(join(root, 'app')), ...walk(join(root, 'components'))].filter(
  (f) => !isAdmin(f) && !f.startsWith('app/api/') && !f.startsWith('components/book/'),
)

const GOLD = '#C9982A'
const NAMED: Record<string, string> = { white: '#ffffff' }
const hexOf = (v: string): string | null => {
  const m = v.match(/^['"](#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}|white)['"]$/)
  if (!m) return null
  return NAMED[m[1]] ?? m[1]
}
/** Every inline style object with no nested braces, with the class list of the same tag. */
function styleObjects(src: string): { style: string; cls: string; line: number }[] {
  const out: { style: string; cls: string; line: number }[] = []
  const re = /style=\{\{([^{}]*)\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const tagStart = src.lastIndexOf('<', m.index)
    const head = src.slice(tagStart, m.index)
    const cls = (head.match(/className=(?:"([^"]*)"|\{`([^`]*)`\})/) || []).slice(1).join(' ')
    out.push({ style: m[1], cls, line: src.slice(0, m.index).split('\n').length })
  }
  return out
}
const prop = (style: string, name: string) => {
  const m = style.match(new RegExp('(?:^|[,\\s])' + name + '\\s*:\\s*([^,]+)'))
  return m ? m[1].trim() : null
}

describe('inline colour contrast (A11-F3)', () => {
  it('the colour pairs this batch relies on reach WCAG AA', () => {
    const pairs: [string, string, number][] = [
      ['#0C1A3D', GOLD, 4.5], // navy text on the brand gold
      ['#0f2d1e', GOLD, 4.5], // dark EthioTax green text on the brand gold
      ['#e8b030', '#1A4731', 4.5], // light gold (gold-400) text on EthioTax green
      ['#88671c', '#ffffff', 4.5], // text gold (gold-600) on white
      ['#88671c', '#F8F7F4', 4.5], // and on the page surface
      ['#88671c', '#f0f7f4', 4.5], // and on the pale EthioTax green
      ['#ffffff', '#0b7b71', 4.5], // white on teal-600
      ['#0b7b71', '#ffffff', 4.5], // teal-600 text on white
      ['#be123c', '#ffffff', 4.5], // rose-700 text
      ['#15803d', '#ffffff', 4.5], // green-700 text
      ['#b91c1c', '#fef2f2', 4.5], // red-700 text on red-50
      ['#b45309', '#ffffff', 4.5], // amber-700 text
      ['#475569', '#e2e8f0', 4.5], // grey text on the light step chip
      ['#475569', '#F8F7F4', 4.5], // grey text on the page surface
      ['#0369a1', '#f0f9ff', 4.5], // CIMA badge text on sky-50
    ]
    for (const [fg, bg, min] of pairs) expect(ratio(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(min)
  })

  it('R7: the Ethiopian professionals buttons use dark text on the gold', () => {
    const src = read('app/jobs/ethiopian-professionals/page.tsx')
    const gold = styleObjects(src).filter((s) => /background(?:Color)?\s*:\s*'#C9982A'/i.test(s.style))
    expect(gold.length).toBeGreaterThanOrEqual(2)
    for (const s of gold) expect(s.cls, `line ${s.line}`).not.toMatch(/(?<![\w:-])text-white(?![\w/-])/)
  })

  it('no white text on an inline gold background in public pages', () => {
    const bad: string[] = []
    for (const f of publicTsx) {
      for (const s of styleObjects(read(f))) {
        const bg = prop(s.style, 'background(?:Color)?')
        if (!bg || hexOf(bg)?.toUpperCase() !== GOLD) continue
        const c = prop(s.style, 'color')
        const whiteStyle = c !== null && /^['"](#fff|#ffffff|white)['"]$/i.test(c)
        const whiteClass = c === null && /(?<![\w:-])text-white(?![\w/-])/.test(s.cls)
        if (whiteStyle || whiteClass) bad.push(`${f}:${s.line}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('every inline style with a literal background and text colour reaches 4.5:1 (3:1 when 24px or larger)', () => {
    const bad: string[] = []
    for (const f of publicTsx) {
      for (const s of styleObjects(read(f))) {
        const bgv = prop(s.style, 'background(?:Color)?')
        const cv = prop(s.style, 'color')
        const bg = bgv && hexOf(bgv)
        const fg = cv && hexOf(cv)
        if (!bg || !fg) continue
        const size = s.style.match(/fontSize\s*:\s*['"]?([\d.]+)(px|rem)?/)
        const px = size ? parseFloat(size[1]) * (size[2] === 'rem' ? 16 : 1) : 0
        const r = ratio(fg, bg)
        if (r < (px >= 24 ? 3 : 4.5)) bad.push(`${f}:${s.line} ${fg} on ${bg} ${r.toFixed(2)}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('breadcrumb links on dark heroes carry a base text colour (the global link colour is navy)', () => {
    const bad = publicTsx.filter((f) => /className="hover:text-white(?:\/\d+)? transition-colors"/.test(read(f)))
    expect(bad).toEqual([])
  })

  it('faint inline text colours are retired from public pages', () => {
    const faint = /(?<![\w-])color\s*:\s*['"]#(?:94a3b8|cbd5e1|b8860b|f43f5e|2dd4bf|14b8a6|14b4a3|0d8f82)['"]/i
    expect(publicTsx.filter((f) => faint.test(read(f)))).toEqual([])
    // White text below 50% opacity is under 4.5:1 on navy and on EthioTax green.
    const faintWhite = /(?<![\w-])color\s*:\s*'rgba\(255, ?255, ?255, ?0?\.[0-4]\d?\)'/
    expect(publicTsx.filter((f) => faintWhite.test(read(f)))).toEqual([])
  })

  it('text classes that fail on light backgrounds are not used on public pages', () => {
    const cls = /(?<![\w:-])text-(?:green-600|amber-500|teal-500|slate-200)(?![\w/-])/
    expect(publicTsx.filter((f) => cls.test(read(f)))).toEqual([])
  })

  it('muted text on the gold recruitment band stays readable (navy or dark green at 0.9)', () => {
    const src = read('components/JobsRecruitmentSection.tsx')
    expect(src).not.toMatch(/color:[^,}]*rgba\((?:12,26,61|15,45,30),0\.(?:[1-7]\d?|8[0-4]?)\)/)
    expect(src).not.toMatch(/color: brand, background: 'transparent'/)
  })

  it('gold text on the light job and firm sign-up pages uses the text gold #88671c', () => {
    const files = [
      'app/firms-freelancers/join/page.tsx',
      'app/freelancing-pathways/FreelancingPathwaysClient.tsx',
      'app/jobs/find-work/FindWorkClient.tsx',
      'app/jobs/hire-talent/HireTalentClient.tsx',
    ]
    for (const f of files) expect(read(f), f).toContain("'#88671c'")
    const goldText = (f: string) => (read(f).match(/(?<![\w-])color\s*:\s*'#C9982A'/gi) || []).length
    // The gold text left in these files sits on navy (6.51:1).
    expect(files.map(goldText)).toEqual(PINNED_GOLD_ON_NAVY)
  })
})

const PINNED_GOLD_ON_NAVY = [0, 0, 0, 0]
