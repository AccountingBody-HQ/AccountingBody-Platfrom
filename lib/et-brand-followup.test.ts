import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// ET-3b (owner decisions D254/D255/D257/D258): follow-up of the EthioTax brand surfaces.
// F1 the home role-card badge wraps only at the tablet widths where the row widened the page;
// F2 the two /jobs card icons use the EthioTax gold on the green; F3 the practice-set hero breadcrumb
// links take the breadcrumb colour on both sites; F4 the decorative hero glow and F5 the last navy
// surfaces (content table headers, code blocks, the calculators hero and result box, the course phone
// bar) follow the EthioTax look through CSS variables that only the EthioTax <html> defines. Each use
// keeps the Accounting Body value as the variable's fallback, so Accounting Body computes the same colour.

;(globalThis as { React?: typeof React }).React = React
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createElement('a', { href, ...rest }, children as never),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => '/' }))

import JobsHubClient from '@/app/jobs/JobsHubClient'

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const css = read('app/globals.css')

function rgb(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
}
function lum(c: number[]): number {
  const f = (x: number) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}
function ratio(a: number[], b: number[]): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
const over = (fg: number[], alpha: number, bg: number[]) => fg.map((v, i) => v * alpha + bg[i] * (1 - alpha))
const GREEN = rgb('#1A4731')
const NAVY = rgb('#0C1A3D')
const WHITE = rgb('#ffffff')
const GOLD = rgb('#C9982A')
const ET_GOLD = rgb('#e8b030')

function publicTsx(): string[] {
  const files = execFileSync('git', ['ls-files', 'app', 'components'], { encoding: 'utf8' }).split('\n').filter(Boolean)
  const admin = files
    .filter((f) => /^app\/[^/]+\/layout\.tsx$/.test(f) && read(f).includes('requireAdmin'))
    .map((f) => f.split('/')[1])
  expect(admin.length).toBe(1)
  const a = admin[0]
  return files.filter(
    (f) =>
      f.endsWith('.tsx') &&
      !f.includes('.test.') &&
      !f.startsWith(`app/${a}/`) &&
      !f.startsWith(`app/${a}-login/`) &&
      !f.startsWith(`components/${a}/`) &&
      !f.startsWith('app/api/') &&
      !f.startsWith('components/book/'),
  )
}

function etBlock(): string {
  const start = css.indexOf('/* EthioTax brand surfaces (ET-3)')
  const end = css.indexOf('/* End of EthioTax brand surfaces */')
  expect(start, 'ET block start').toBeGreaterThan(-1)
  expect(end, 'ET block end').toBeGreaterThan(start)
  return css.slice(start, end)
}
const outsideEtBlock = () => css.replace(etBlock(), '')

describe('F1: home role cards (Accounting Body)', () => {
  const home = read('app/page.tsx')
  const ROW = '<div className="flex md:max-[786px]:flex-wrap items-start justify-between gap-3 mb-3">'
  it('the badge row wraps only from 768 to 786 px, where it widened the page', () => {
    const i = home.indexOf(ROW)
    expect(i).toBeGreaterThan(-1)
    expect(home.split(ROW).length - 1).toBe(1)
    expect(home.slice(i, i + 400)).toContain('shrink-0 whitespace-nowrap bg-slate-100 text-slate-600')
  })
  it('no unbounded flex-wrap on that row (it would wrap the badge at desktop widths too)', () => {
    expect(home).not.toContain('<div className="flex flex-wrap items-start justify-between gap-3 mb-3">')
  })
})

describe('F2: /jobs card icons on EthioTax', () => {
  const et = renderToStaticMarkup(createElement(JobsHubClient, { isEthioTax: true, jobCount: 10 }))
  const ab = renderToStaticMarkup(createElement(JobsHubClient, { isEthioTax: false, jobCount: 10 }))
  const TILE = '<div class="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-5"><svg class="w-6 h-6" fill="none" stroke="'
  it('the two tile icons use the EthioTax gold on EthioTax and the one gold on Accounting Body', () => {
    expect(et.split(TILE + '#e8b030"').length - 1).toBe(2)
    expect(ab.split(TILE + '#C9982A"').length - 1).toBe(2)
    expect(ab).not.toContain('#e8b030')
  })
  it('the EthioTax gold reaches 3:1 on the white/10 tile over the card over the green; the one gold does not', () => {
    const tile = over(WHITE, 0.1, over(WHITE, 0.06, GREEN))
    expect(ratio(ET_GOLD, tile)).toBeGreaterThanOrEqual(3)
    expect(ratio(GOLD, tile)).toBeLessThan(3)
    expect(ratio(GOLD, over(WHITE, 0.1, over(WHITE, 0.06, NAVY)))).toBeGreaterThanOrEqual(3)
  })
})

describe('F3: practice-set hero breadcrumb links', () => {
  const page = read('app/practice-questions/[slug]/page.tsx')
  it('one class on both sites: the links take the breadcrumb white/70; on hover white and underlined', () => {
    // hover:text-white is needed: the base a:hover rule (gold-600, 2.85:1 on navy) outranks a plain text-inherit.
    expect(page).toContain("const crumbLink = 'text-inherit hover:text-white hover:underline transition-colors'")
    expect(page).not.toMatch(/const crumbLink = isEthioTax/)
    expect(page.split('className={crumbLink}').length - 1).toBe(2)
  })
  it('white/70 passes on navy and green; the base link colour navy-700 fails on navy', () => {
    expect(ratio(over(WHITE, 0.7, NAVY), NAVY)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(over(WHITE, 0.7, GREEN), GREEN)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(rgb('#30407e'), NAVY)).toBeLessThan(4.5)
    expect(ratio(WHITE, NAVY)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(WHITE, GREEN)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(rgb('#88671c'), NAVY)).toBeLessThan(4.5) // the base hover colour the class must override
  })
})

describe('F4: brand-aware hero glow', () => {
  const GLOW = "'radial-gradient(ellipse at center top, var(--hero-glow, #3a4f9a) 0%, transparent 70%)'"
  const GLOW_SEARCH = "'radial-gradient(ellipse at top, var(--hero-glow, #3a4f9a) 0%, transparent 65%)'"
  it('every public glow uses the variable with the navy-600 fallback; no bare #3a4f9a glow is left', () => {
    let uses = 0
    for (const f of publicTsx()) {
      const s = read(f)
      const bare = s.replace(/var\(--hero-glow, #3a4f9a\)/g, '')
      expect(bare, f).not.toMatch(/#3a4f9a/i)
      uses += s.split(GLOW).length - 1 + s.split(GLOW_SEARCH).length - 1
    }
    expect(uses).toBe(22)
  })
  it('privacy policy and disclaimer use the same glow on both sites (no separate gold glow)', () => {
    for (const f of ['app/privacy-policy/page.tsx', 'app/disclaimer/page.tsx']) {
      const s = read(f)
      expect(s, f).toContain(`style={{ background: ${GLOW} }}`)
      expect(s, f).not.toContain("radial-gradient(ellipse at center top, rgba(212,160,23,0.3)")
    }
  })
  it('the EthioTax glow is defined only for the EthioTax <html>', () => {
    expect(etBlock()).toMatch(/html\[data-brand="ethiotax"\] \{[^}]*--hero-glow: #256a49;/)
    expect(outsideEtBlock()).not.toContain('--hero-glow')
  })
  it('hero texts keep 4.5:1 even at the brightest point of the EthioTax glow (layer opacity up to .25)', () => {
    const top = over(rgb('#256a49'), 0.25, GREEN)
    expect(ratio(ET_GOLD, top)).toBeGreaterThanOrEqual(4.5) // gold-400 eyebrows
    expect(ratio(over(WHITE, 0.6, top), top)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(over(WHITE, 0.7, top), top)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(ET_GOLD, over(rgb('#308f63'), 0.25, GREEN))).toBeLessThan(4.5) // the full OKLCH step was too bright
  })
})

describe('F5: the last navy surfaces on EthioTax', () => {
  it('content table headers and code blocks are green on EthioTax, at element weight (utility classes still win)', () => {
    const b = etBlock()
    expect(b).toContain(':where(html[data-brand="ethiotax"]) th,')
    expect(b).toContain(':where(html[data-brand="ethiotax"]) pre,')
    expect(b).toContain(':where(html[data-brand="ethiotax"]) .html-content table th { background-color: #1A4731; }')
  })
  it('the EthioTax <html> defines the surface and text variables; nothing else does', () => {
    const b = etBlock()
    expect(b).toMatch(/--brand-surface: #1A4731;/)
    expect(b).toMatch(/--brand-gold-text: #e8b030;/)
    expect(b).toMatch(/--brand-gold-tint-text: #efc85d;/)
    expect(b).toMatch(/--brand-muted-text: rgba\(255, 255, 255, 0\.6\);/)
    const rest = outsideEtBlock()
    for (const v of ['--brand-surface', '--brand-gold-text', '--brand-gold-tint-text', '--brand-muted-text']) expect(rest).not.toContain(v)
  })
  it('the calculators hero, the result box and the course phone bar use the variables with their navy-era values as fallback', () => {
    const calc = read('app/calculators/page.tsx')
    expect(calc).toContain("<section style={{ background: 'var(--brand-surface, #0C1A3D)', padding: '72px 0 56px' }}>")
    expect(calc).toContain("color: 'var(--brand-gold-text, #C9982A)', fontSize: 11")
    expect(calc).toContain("color: 'var(--brand-muted-text, rgba(255,255,255,0.55))', fontSize: 17")
    const card = read('components/CalcCard.tsx')
    expect(card).toContain("<div style={{ background: 'var(--brand-surface, #0C1A3D)', borderRadius: 12, padding: 16, marginBottom: 12 }}>")
    expect(card).toContain("color: 'var(--brand-muted-text, rgba(255,255,255,0.5))'")
    expect(card).toContain("fontSize: 15, fontWeight: 800, color: 'var(--brand-gold-text, #C9982A)'")
    const bar = read('components/course/MobileNavDrawer.tsx')
    expect(bar).toContain("background: 'var(--brand-surface, #0C1A3D)',")
    expect(bar).toContain("style={{ background: 'rgba(212,160,23,0.15)', color: 'var(--brand-gold-tint-text, #C9982A)', border: '1px solid rgba(212,160,23,0.3)' }}")
  })
  it('every text on the new green surfaces reaches 4.5:1 (WCAG 2.2 AA)', () => {
    expect(ratio(WHITE, GREEN)).toBeGreaterThanOrEqual(4.5) // table header text
    expect(ratio(rgb('#e2e8f0'), GREEN)).toBeGreaterThanOrEqual(4.5) // code text
    expect(ratio(ET_GOLD, GREEN)).toBeGreaterThanOrEqual(4.5) // small gold text
    expect(ratio(over(WHITE, 0.6, GREEN), GREEN)).toBeGreaterThanOrEqual(4.5) // muted text
    const tint = over(rgb('#d4a017'), 0.15, GREEN)
    expect(ratio(rgb('#efc85d'), tint)).toBeGreaterThanOrEqual(4.5) // "Course Contents" on its gold tint
    // the navy-era values would fail on the green
    expect(ratio(GOLD, GREEN)).toBeLessThan(4.5)
    expect(ratio(over(WHITE, 0.55, GREEN), GREEN)).toBeLessThan(4.5)
    expect(ratio(over(WHITE, 0.5, GREEN), GREEN)).toBeLessThan(4.5)
    expect(ratio(ET_GOLD, tint)).toBeLessThan(4.5)
  })
})
