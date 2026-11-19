import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// ET-4 (Group 3 Part A, owner decisions D254/D257/D260): the last parts of the EthioTax look come from the
// app. On EthioTax only: readable /jobs card labels and one EthioTax hero glow (G1), the exam-body accent
// stripes and section bars in the one gold (G2), navy borders (G3) and navy text on light surfaces (G4) in the
// EthioTax green family, with text on gold surfaces kept navy, and the last navy shades (G5). Every rule sits
// under the EthioTax <html>, and every inline use keeps the Accounting Body value as the fallback.

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
const START = '/* ET-4 (Group 3 Part A)'
const END = '/* End of ET-4 */'
const et4 = () => {
  const a = css.indexOf(START)
  const b = css.indexOf(END)
  return a >= 0 && b > a ? css.slice(a, b) : ''
}
const outsideEt4 = () => {
  const a = css.indexOf(START)
  const b = css.indexOf(END)
  return a >= 0 && b > a ? css.slice(0, a) + css.slice(b) : css
}

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
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
// The colour the ET-4 section gives a selector (the selector must appear in a rule whose body sets `prop`).
function ruleValue(selector: string, prop = 'color'): string {
  const re = new RegExp(`(?:^|[,}\\n])\\s*[^{}]*${esc(selector)}(?![\\w-])[^{}]*\\{[^}]*?(?:^|[;{\\s])${esc(prop)}:\\s*([^;}]+)`, 'm')
  const m = re.exec(et4())
  return m ? m[1].trim() : ''
}

const G950 = '#1A4731'
// One analogue for the lighter navy shades: the 3/4 OKLCH step would be lighter, but the cap (4.6:1 on the
// lightest-to-darkest light surfaces, including the navy-200 avatar tint) brings 800, 700, 600 and 500 together.
const G800 = '#335f48'
const G700 = '#335f48'
const G600 = '#335f48'
const LIGHT: Array<[string, string]> = [
  ['white', '#ffffff'], ['page cream', '#F8F7F4'], ['slate-100', '#f1f0ec'], ['navy-50 tint', '#f0f3fa'],
  ['navy-100 tint', '#dde4f2'], ['navy-200 tint', '#c3cfe8'],
  ['lesson card', '#ede9e3'], ['green tint', '#f0f7f4'], ['gold-50', '#fdf9ec'],
]

describe('ET-4 section exists only for the EthioTax <html>', () => {
  it('every selector in the ET-4 section is scoped to the EthioTax <html>', () => {
    const block = et4()
    expect(block.length).toBeGreaterThan(500)
    // Split each rule's selector list on top-level commas only (commas inside :is()/:where() belong to one selector).
    const topSplit = (s: string) => {
      const out: string[] = []
      let depth = 0
      let cur = ''
      for (const ch of s) {
        if (ch === '(') depth++
        if (ch === ')') depth--
        if (ch === ',' && depth === 0) { out.push(cur); cur = '' } else cur += ch
      }
      return [...out, cur]
    }
    const selectors = block.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.split('{')[0]).flatMap(topSplit)
      .map((s) => s.trim()).filter(Boolean)
    expect(selectors.length).toBeGreaterThan(40)
    for (const s of selectors) expect(s, s).toMatch(/^(:where\(html\[data-brand="ethiotax"\]\)|html\[data-brand="ethiotax"\])/)
  })
  it('the new hook class and variables are not styled for Accounting Body', () => {
    const rest = outsideEt4()
    expect(rest).not.toContain('brand-accent-bar')
    expect(rest).not.toContain('--brand-ink')
    expect(rest).not.toContain('--brand-sheet')
  })
})

describe('G2: decorative exam-body stripes and section bars are the one gold on EthioTax', () => {
  it('the hook paints gold over the class or inline exam colour', () => {
    expect(et4()).toMatch(/html\[data-brand="ethiotax"\] \.brand-accent-bar \{ background-color: #C9982A !important; \}/)
  })
  it('every decorative bar carries the hook; exam badges do not', () => {
    expect(read('app/articles/[slug]/page.tsx')).toContain('<div className={`h-1 w-full brand-accent-bar ${accentBar}`} />')
    expect(read('app/study/[category]/[slug]/page.tsx')).toContain('<div className={`h-1 w-full brand-accent-bar ${accentBar}`} />')
    const home = read('app/page.tsx')
    expect(home).toContain('<div className="h-1 brand-accent-bar" style={{ backgroundColor: bodyColor }} />')
    expect(home.split('<div className={`h-1.5 brand-accent-bar ${q.accent}`} />').length - 1).toBe(2)
    expect(read('app/study/page.tsx')).toContain('<div className={`h-1.5 brand-accent-bar ${body.accent}`} />')
    expect(read('app/calculators/page.tsx')).toContain("<div className=\"brand-accent-bar\" style={{ width: 4, height: 28, borderRadius: 4, background: color }} />")
    expect(read('app/page.tsx')).not.toMatch(/rounded-full shrink-0 brand-accent-bar/)
  })
})

describe('G4: navy text on light surfaces is the EthioTax green family', () => {
  it('maps each navy text shade to its green analogue', () => {
    expect(ruleValue('.text-navy-950')).toBe(G950)
    expect(ruleValue('.text-navy-900')).toBe(G950)
    expect(ruleValue('.text-navy-800')).toBe(G800)
    expect(ruleValue('.text-navy-700')).toBe(G700)
    expect(ruleValue('.text-navy-600')).toBe(G600)
    expect(ruleValue('.text-navy-500')).toBe(G600)
    expect(ruleValue('.text-\\[\\#0C1A3D\\]')).toBe(G950)
  })
  it('maps the hover, group-hover and focus states', () => {
    expect(ruleValue('.hover\\:text-navy-950:hover')).toBe(G950)
    expect(ruleValue('.group:hover .group-hover\\:text-navy-950')).toBe(G950)
    expect(ruleValue('.focus\\:text-navy-950:focus')).toBe(G950)
    expect(ruleValue('.hover\\:text-navy-700:hover')).toBe(G700)
    expect(ruleValue('.group:hover .group-hover\\:text-navy-700')).toBe(G700)
    expect(ruleValue('.group\\/link:hover .group-hover\\/link\\:text-navy-700')).toBe(G700)
    expect(ruleValue('.group:hover .group-hover\\:text-navy-600')).toBe(G600)
    expect(ruleValue('.hover\\:text-\\[\\#0C1A3D\\]:hover')).toBe(G950)
  })
  it('maps the element and component rules that colour text navy', () => {
    expect(ruleValue(':is(h1, h2, h3, h4, h5, h6)')).toBe(G950)
    expect(ruleValue(':where(html[data-brand="ethiotax"]) a')).toBe(G700)
    expect(ruleValue(':where(html[data-brand="ethiotax"]) article a')).toBe(G700)
    expect(ruleValue(':where(html[data-brand="ethiotax"]) .prose a')).toBe(G700)
    expect(ruleValue('.section-title')).toBe(G950)
    expect(ruleValue('.stat-number')).toBe(G950)
    expect(ruleValue('.prose-ab :is(h1, h2, h3, h4)')).toBe(G950)
    expect(ruleValue('.prose-ab strong')).toBe(G800)
    expect(ruleValue(':where(html[data-brand="ethiotax"]) code')).toBe(G800)
    expect(ruleValue(':where(html[data-brand="ethiotax"]) blockquote')).toBe(G800)
    expect(ruleValue('.html-content :is(h1, h2, h3, h4, h5, h6, .wp-block-heading)')).toBe(G950)
    expect(ruleValue('.html-content :is(strong, b)')).toBe(G950)
    expect(ruleValue('.html-content a')).toBe(G800)
    expect(ruleValue('.html-content code')).toBe(G800)
    expect(ruleValue('p[class*="has-background"]) a')).toBe(`${G800} !important`)
  })
  for (const [name, hex] of [['950/900', G950], ['800', G800], ['700', G700], ['600/500', G600]] as const) {
    it(`green ${name} (${hex}) reaches 4.5:1 on every light surface it sits on`, () => {
      const used = [ruleValue('.text-navy-950'), ruleValue('.text-navy-800'), ruleValue('.text-navy-700'), ruleValue('.text-navy-600')]
      expect(used).toContain(hex)
      for (const [bg, b] of LIGHT) expect(ratio(rgb(hex), rgb(b)), `${hex} on ${bg}`).toBeGreaterThanOrEqual(4.5)
    })
  }
  it('rest and hover link colours differ visibly and both pass (hover keeps gold-600)', () => {
    expect(ratio(rgb(G950), rgb(G700))).toBeGreaterThan(1.4)
    expect(ratio(rgb('#88671c'), rgb('#ffffff'))).toBeGreaterThanOrEqual(4.5)
    expect(et4()).not.toMatch(/a:hover/)
  })
  it('text on gold surfaces stays navy (navy on gold 6.51:1; green on gold fails)', () => {
    const block = et4()
    const gold = /:is\(\.text-navy-950, [^)]*\):where\(\.bg-gold-500[^{]*\{ color: #0C1A3D; \}/
    expect(block).toMatch(gold)
    for (const g of ['.bg-gold-400', '.bg-\\[\\#C9982A\\]', '.surface-gold', '.hover\\:bg-gold-400:hover', '[style*="background:#C9982A" i]', '[style*="background: rgb(201, 152, 42)"]'])
      expect(block, g).toContain(g)
    expect(block).toMatch(/:is\(h1, h2, h3, h4, h5, h6\):where\([^{]*\{ color: #0C1A3D; \}/)
    expect(block).toMatch(/ a:where\([^{]*\{ color: #30407e; \}/)
    // Pure maths (cannot fail before the change): why the exclusion exists.
    expect(ratio(rgb('#0C1A3D'), rgb('#C9982A'))).toBeGreaterThanOrEqual(4.5)
    expect(ratio(rgb(G950), rgb('#C9982A'))).toBeLessThan(4.5)
  })
})

describe('G3: navy borders are green on EthioTax', () => {
  it('maps the navy border shades and their hover states', () => {
    expect(ruleValue('.border-navy-950', 'border-color')).toBe(G950)
    expect(ruleValue('.border-navy-900', 'border-color')).toBe(G950)
    expect(ruleValue('.border-navy-800', 'border-color')).toBe(G800)
    expect(ruleValue('.border-navy-600', 'border-color')).toBe(G600)
    expect(ruleValue('.border-navy-500', 'border-color')).toBe(G600)
    expect(ruleValue('.border-l-navy-500', 'border-left-color')).toBe(G600)
    expect(ruleValue('.hover\\:border-navy-950:hover', 'border-color')).toBe(G950)
    expect(ruleValue('.hover\\:border-navy-900:hover', 'border-color')).toBe('#0d2b1f')
  })
  it('a green outline (control boundary) keeps 3:1 on white and cream', () => {
    expect(ratio(rgb(G950), rgb('#ffffff'))).toBeGreaterThanOrEqual(3)
    expect(ratio(rgb(G950), rgb('#F8F7F4'))).toBeGreaterThanOrEqual(3)
  })
})

describe('G5: the last navy shades are green on EthioTax', () => {
  it('maps the phone-menu backdrop, the dark quiz and table shades and the navy tints', () => {
    expect(ruleValue('.bg-navy-950\\/50', 'background-color')).toBe('rgb(13 43 31 / 0.5)')
    expect(ruleValue('.bg-navy-900', 'background-color')).toBe('#0d2b1f')
    expect(ruleValue('.bg-navy-800', 'background-color')).toBe(G950)
    expect(ruleValue('.bg-navy-900\\/70', 'background-color')).toBe('rgb(13 43 31 / 0.7)')
    expect(ruleValue('.bg-navy-900\\/60', 'background-color')).toBe('rgb(13 43 31 / 0.6)')
    expect(ruleValue('.bg-navy-950\\/40', 'background-color')).toBe('rgb(26 71 49 / 0.4)')
    expect(ruleValue('.bg-navy-950\\/15', 'background-color')).toBe('rgb(26 71 49 / 0.15)')
    expect(ruleValue('.bg-navy-950\\/10', 'background-color')).toBe('rgb(26 71 49 / 0.1)')
    expect(ruleValue('.hover\\:bg-navy-950\\/10:hover', 'background-color')).toBe('rgb(26 71 49 / 0.1)')
    expect(ruleValue('.group:hover .group-hover\\:bg-navy-950', 'background-color')).toBe(G950)
  })
  it('the course drawer sheet reads a variable with the Accounting Body value as fallback', () => {
    expect(read('components/course/MobileNavDrawer.tsx')).toContain("style={{ background: 'var(--brand-sheet, #081428)', maxHeight: '82vh' }}")
    expect(et4()).toMatch(/--brand-sheet: #0d2b1f;/)
    // white/60 (the lightest drawer text) stays readable on the green sheet.
    const sheet = rgb('#0d2b1f')
    const w60 = sheet.map((c) => 0.6 + 0.4 * c)
    expect(ratio(w60, sheet)).toBeGreaterThanOrEqual(4.5)
  })
  it('the recruitment cards use a green tint on EthioTax and keep the navy tint on Accounting Body', () => {
    const s = read('components/JobsRecruitmentSection.tsx')
    expect(s).toContain("style={{ background: isEthioTax ? 'rgba(15,45,30,0.1)' : 'rgba(12,26,61,0.1)', border: isEthioTax ? '1.5px solid rgba(15,45,30,0.2)' : '1.5px solid rgba(12,26,61,0.2)' }}>")
    expect(s).toContain("style={{ background: isEthioTax ? 'rgba(15,45,30,0.12)' : 'rgba(12,26,61,0.12)' }}>")
  })
})

describe('G1: /jobs labels readable on real pixels and one EthioTax hero glow', () => {
  const et = renderToStaticMarkup(createElement(JobsHubClient, { isEthioTax: true, jobCount: 10 }))
  const ab = renderToStaticMarkup(createElement(JobsHubClient, { isEthioTax: false, jobCount: 10 }))
  it('the two card labels and the card outline link use the pale gold on EthioTax; the pills keep #e8b030', () => {
    expect((et.match(/(?<![-\w])color:#efc85d/g) || []).length).toBe(3)
    expect((et.match(/(?<![-\w])color:#e8b030/g) || []).length).toBe(3)
    expect((ab.match(/(?<![-\w])color:#C9982A/g) || []).length).toBe(6)
    expect(ab).not.toContain('#efc85d')
    // LV-70 / ET-4 brightest real pixel under the labels: #efc85d passes there, #e8b030 does not (pure maths).
    expect(ratio(rgb('#efc85d'), rgb('#2e5641'))).toBeGreaterThanOrEqual(4.5)
    expect(ratio(rgb('#e8b030'), rgb('#2e5641'))).toBeLessThan(4.5)
  })
  it('both /jobs gold glows read the EthioTax glow variable with the gold glow as fallback', () => {
    const src = read('app/jobs/JobsHubClient.tsx')
    expect(src).toContain("style={{ background: 'radial-gradient(ellipse at center top, var(--hero-glow, rgba(212,160,23,0.3)) 0%, transparent 70%)' }} />")
    expect(src).toContain("style={{ background: 'radial-gradient(ellipse at center top, var(--hero-glow, rgba(212,160,23,0.4)) 0%, transparent 70%)' }} />")
    expect(src).not.toContain("'radial-gradient(ellipse at center top, rgba(212,160,23,")
  })
  it('the EthioTax mock-exams page (where /mock-exams leads on EthioTax) uses the same glow variable', () => {
    const src = read('app/study/mock-exams/page.tsx')
    expect(src).toContain("style={{ background: 'radial-gradient(ellipse at center top, var(--hero-glow, #C9982A) 0%, transparent 70%)' }} />")
  })
  it('the navy outline links on the /jobs hub follow the brand colour', () => {
    expect((et.match(/border:2px solid #1A4731;color:#1A4731/g) || []).length).toBe(2)
    expect((ab.match(/border:2px solid #0C1A3D;color:#0C1A3D/g) || []).length).toBe(2)
  })
  it('the stat values on the white /jobs band follow the brand colour; text on gold stays navy', () => {
    expect((et.match(/<span class="font-display text-3xl block mb-1" style="color:#1A4731">/g) || []).length).toBe(4)
    expect((ab.match(/<span class="font-display text-3xl block mb-1" style="color:#0C1A3D">/g) || []).length).toBe(4)
    expect(et).toContain('style="background:#C9982A;color:#0C1A3D"')
  })
})

describe('inline navy text that a CSS rule cannot reach reads the EthioTax ink variable', () => {
  it('the calculators section headings and calculator cards', () => {
    expect(read('app/calculators/page.tsx')).toContain("color: 'var(--brand-ink, #0C1A3D)', margin: 0 }}>{title}</h2>")
    const card = read('components/CalcCard.tsx')
    expect(card).toContain("fontSize: '1.25rem', color: 'var(--brand-ink, #0C1A3D)'")
    expect(card).toContain("fontSize: 14, color: 'var(--brand-ink, #0C1A3D)'")
    expect(et4()).toMatch(/--brand-ink: #1A4731;/)
  })
})
