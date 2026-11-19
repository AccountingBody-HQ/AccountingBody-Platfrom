import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// ET-3 (owner decisions D254/D255/D257): EthioTax pages render the EthioTax green #1A4731 instead of the
// Accounting Body navy on brand surfaces, through one server-rendered rule set: the root layout marks the
// EthioTax <html> with data-brand="ethiotax" and app/globals.css maps the navy background classes under it.
// Text colours are not changed; every text measured on the green stays readable (WCAG 2.2 AA).
// Accounting Body renders exactly as before (no attribute, no rule applies). Also guards the small fixes
// of the same job: footer bar clear of Back to top on phones, no quiz-bar shadow over the open banner,
// the AB footer field border at 3:1, the one-segment 404 title, the home role-card badge wrap, and two
// retired files.

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
const GREEN_DARK = rgb('#0d2b1f')
const NAVY = rgb('#0C1A3D')
const WHITE = rgb('#ffffff')

// The public template files (admin area, its login, its components, route handlers, AB Press and tests excluded).
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

describe('one server-rendered brand mechanism (ET-3)', () => {
  it('the root layout marks only the EthioTax <html>', () => {
    const layout = read('app/layout.tsx')
    expect(layout).toContain(`<html lang="en-GB" className="scroll-smooth" data-brand={isEthioTax ? 'ethiotax' : undefined}>`)
    expect((layout.match(/<html\b/g) || []).length).toBe(1)
    // React leaves an undefined attribute out, so the Accounting Body tag is byte-identical to before.
    const tag = (b: string | undefined) => {
      const html = renderToStaticMarkup(createElement('html', { lang: 'en-GB', className: 'scroll-smooth', 'data-brand': b }))
      return (html.match(/<html[^>]*>/) || [''])[0]
    }
    expect(tag(undefined)).toBe('<html lang="en-GB" class="scroll-smooth">')
    expect(tag('ethiotax')).toBe('<html lang="en-GB" class="scroll-smooth" data-brand="ethiotax">')
  })

  it('maps every navy surface class to the EthioTax green, backgrounds only', () => {
    const b = etBlock()
    expect(b).toContain('html[data-brand="ethiotax"] .bg-navy-950,\nhtml[data-brand="ethiotax"] .surface-navy { background-color: #1A4731; }')
    expect(b).toMatch(/html\[data-brand="ethiotax"\] \.section-navy \{\s*background-color: #1A4731;\s*background-image:\s*url\("data:image\/svg\+xml,[^"]+"\),\s*linear-gradient\(135deg, #1A4731 0%, #0d2b1f 100%\);\s*\}/)
    expect(b).toContain('html[data-brand="ethiotax"] .bg-gradient-navy { background-image: linear-gradient(135deg, #1A4731 0%, #0d2b1f 100%); }')
    expect(b).toContain('html[data-brand="ethiotax"] .hover\\:bg-navy-950:hover,\nhtml[data-brand="ethiotax"] .hover\\:bg-navy-900:hover,\nhtml[data-brand="ethiotax"] .hover\\:bg-navy-800:hover { background-color: #0d2b1f; }')
    // No text colour is changed by the brand block (navy text on light surfaces stays as it is).
    expect(b).not.toMatch(/(^|[\s;{])color\s*:/)
    expect(b).not.toContain('!important')
    // The section-navy noise layer is the same one the Accounting Body section uses.
    const noise = (s: string) => (s.match(/url\("data:image\/svg\+xml,[^"]+"\)/) || [''])[0]
    const ab = css.slice(css.indexOf('.section-navy {'), css.indexOf('.section-navy {') + 900)
    expect(noise(b)).toBe(noise(ab))
    expect(noise(b).length).toBeGreaterThan(50)
  })

  it('every dark navy background class in public code is mapped or a recorded exception', () => {
    // Mapped by the brand block (all variants of the base class are covered by the same rule).
    const MAPPED = new Set(['bg-navy-950', 'surface-navy', 'section-navy', 'bg-gradient-navy', 'hover:bg-navy-950', 'hover:bg-navy-900', 'hover:bg-navy-800'])
    // Recorded exceptions (ET-3 report §12): overlays and tints with an alpha, quiz-bank shades, one pressed
    // and one group-hover state, and the cookie-policy table head. The count may only shrink.
    const KNOWN: Record<string, number> = {
      'bg-navy-800': 3, 'bg-navy-900': 1, 'bg-navy-900/70': 1, 'bg-navy-900/60': 1,
      'bg-navy-950/50': 1, 'bg-navy-950/40': 1, 'bg-navy-950/15': 1, 'bg-navy-950/10': 1,
      'hover:bg-navy-950/10': 1, 'group-hover:bg-navy-950': 2, 'active:bg-navy-950': 1, 'active:bg-navy-900': 1,
    }
    const dark = /^((?:[a-z-]+:)*)(bg-navy-(?:950|900|800)(?:\/\d+)?|bg-\[#0[cC]1[aA]3[dD]\](?:\/\d+)?|(?:from|via|to)-navy-(?:950|900|800)(?:\/\d+)?|bg-gradient-navy|section-navy|surface-navy)$/
    const seen: Record<string, number> = {}
    for (const f of publicTsx()) {
      for (const tok of read(f).split(/[\s'"`{}()]+/)) {
        const m = dark.exec(tok)
        if (m) seen[tok] = (seen[tok] || 0) + 1
      }
    }
    expect(seen['bg-navy-950']).toBeGreaterThan(100)
    for (const [tok, n] of Object.entries(seen)) {
      if (MAPPED.has(tok)) continue
      expect(KNOWN[tok], `unmapped navy background ${tok} (${n})`).toBeDefined()
      expect(n, tok).toBeLessThanOrEqual(KNOWN[tok])
    }
  })

  it('no public component keeps an unbranched navy brand constant; inline navy backgrounds are recorded', () => {
    const KNOWN_INLINE: Record<string, number> = {
      // ET-3b (F5): the calculators hero, CalcCard and the course phone bar now use var(--brand-surface, #0C1A3D).
      'app/get-help/page.tsx': 4, 'app/global-payroll/page.tsx': 3,
      'app/global-payroll/[slug]/page.tsx': 3, 'app/page.tsx': 2,
    }
    const seen: Record<string, number> = {}
    for (const f of publicTsx()) {
      const s = read(f)
      expect(s, f).not.toMatch(/const (brand|brandColor|brandBg)\s*=\s*'#0C1A3D'/)
      const n = (s.match(/background(?:Color)?:\s*'#0C1A3D'/g) || []).length
      if (n) seen[f] = n
    }
    for (const [f, n] of Object.entries(seen)) {
      expect(KNOWN_INLINE[f], `inline navy background in ${f}`).toBeDefined()
      expect(n, f).toBeLessThanOrEqual(KNOWN_INLINE[f])
    }
  })
})

describe('the /jobs hub on EthioTax (ET-3)', () => {
  const et = renderToStaticMarkup(createElement(JobsHubClient, { isEthioTax: true, jobCount: 10 }))
  const ab = renderToStaticMarkup(createElement(JobsHubClient, { isEthioTax: false, jobCount: 10 }))
  it('paints the hero and the filled buttons green on EthioTax and keeps navy text on gold', () => {
    expect(et).toContain('<section class="relative overflow-hidden py-20 md:py-28" style="background:#1A4731">')
    expect(et).not.toMatch(/background:#0C1A3D/)
    // The hero, "Tell us your hiring need", "Find a job", plus the EthioTax-only section that was already green.
    expect((et.match(/style="background:#1A4731"/g) || []).length).toBe(4)
    expect(et).toContain('style="background:#C9982A;color:#0C1A3D"')
  })
  it('uses the EthioTax gold for the small gold text on the green (D238), the one gold elsewhere', () => {
    // Three stat pills, the two card labels and the "Register as a candidate" outline link, all small text.
    expect((et.match(/(?<![-\w])color:#e8b030/g) || []).length).toBe(6)
    expect(et).not.toMatch(/(?<![-\w])color:#C9982A/)
    expect(ratio(rgb('#e8b030'), GREEN)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(rgb('#C9982A'), GREEN)).toBeLessThan(4.5)
  })
  it('keeps the Accounting Body /jobs hub as it was', () => {
    expect(ab).toContain('<section class="relative overflow-hidden py-20 md:py-28" style="background:#0C1A3D">')
    expect((ab.match(/style="background:#0C1A3D"/g) || []).length).toBe(3)
    expect((ab.match(/(?<![-\w])color:#C9982A/g) || []).length).toBe(6)
    expect(ab).not.toMatch(/#1A4731|#e8b030/)
  })
})

describe('text on the EthioTax green stays readable (ET-3, WCAG 2.2 AA)', () => {
  // Every text colour measured on a navy surface in the ET-3 BEFORE run, now on the green and on the
  // gradient's dark end and the hover shade.
  const TEXT: Array<[string, number[], number]> = [
    ['white', WHITE, 1], ['white/70', WHITE, 0.7], ['white/65', WHITE, 0.65], ['white/60', WHITE, 0.6],
    ['gold-400 #e8b030', rgb('#e8b030'), 1],
  ]
  for (const bg of [['#1A4731', GREEN], ['#0d2b1f', GREEN_DARK]] as const) {
    for (const [name, fg, a] of TEXT) {
      it(`${name} on ${bg[0]} is at least 4.5:1`, () => {
        expect(ratio(over(fg, a, bg[1] as number[]), bg[1] as number[])).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
  it('gold buttons (D233, #C9982A) stay visible on the green (3:1 non-text) and keep navy text (4.5:1)', () => {
    expect(ratio(rgb('#C9982A'), GREEN)).toBeGreaterThanOrEqual(3)
    expect(ratio(NAVY, rgb('#C9982A'))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('texts that would fail on the new green get an EthioTax colour (ET-3)', () => {
  it('the set page breadcrumb links take the breadcrumb white/70 on EthioTax (the base link colour is navy)', () => {
    const page = read('app/practice-questions/[slug]/page.tsx')
    // ET-3b (F3): one class on both sites now (Accounting Body was 1.76:1 with the base link colour).
    expect(page).toContain("const crumbLink = 'text-inherit hover:text-white hover:underline transition-colors'")
    expect(page.split('className={crumbLink}').length - 1).toBe(2)
    expect(page).toContain("<nav className='flex items-center gap-2 text-white/70 text-sm mb-8 flex-wrap'>")
    expect(ratio(over(WHITE, 0.7, GREEN), GREEN)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(rgb('#30407e'), GREEN)).toBeLessThan(4.5)
  })
  it('the glossary "View full A–Z" chip uses gold-300 on the green (gold-400 is 4.09 there)', () => {
    expect(read('app/glossary/page.tsx')).toContain("bg-gold-500/20 ${isEthioTax ? 'text-gold-300' : 'text-gold-400'} border border-gold-500/30")
    const chip = over(rgb('#C9982A'), 0.2, GREEN)
    expect(ratio(rgb('#efc85d'), chip)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(rgb('#e8b030'), chip)).toBeLessThan(4.5)
  })
  it('the contact newsletter field border is white/50 on EthioTax (3:1 non-text)', () => {
    expect(read('app/contact/ContactForm.tsx')).toContain("bg-white/10 border ${isEthioTax ? 'border-white/50' : 'border-white/20'} text-white")
    expect(read('app/contact/page.tsx')).toContain('<ContactForm isEthioTax={isEthioTax} />')
    expect(ratio(over(WHITE, 0.5, GREEN), GREEN)).toBeGreaterThanOrEqual(3)
  })
})

describe('small fixes (ET-3)', () => {
  const footer = read('components/layout/Footer.tsx')
  it('C2: below lg the footer legal bar keeps clear of the Back to top column', () => {
    // The copyright and brand lines sit in the button's band when scrolled to the end; the legal links and
    // Cookie settings already sit below it (CC-2, lib/consent-layout.test.ts) and are not moved.
    expect(footer).toContain('<div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">\n            <div className="space-y-1 pr-14 lg:pr-0">')
    // Back to top: 44 px wide, 24 px from the edge below lg; 56 px padding covers it at every container padding.
    const btn = read('components/ScrollToTop.tsx')
    expect(btn).toContain('fixed bottom-[80px] lg:bottom-6 lg:right-6 z-40 w-11 h-11')
    expect(btn).toContain('style={{right:"24px"}}')
  })
  it('C3: the quiz bar drops its shadow only while the cookie banner is open', () => {
    expect(css).toContain('html[data-consent-open] .sticky.bottom-0.shadow-lg { box-shadow: none; }')
    expect(read('components/QuizRenderer.tsx')).toContain('className="sticky bottom-0 z-30 mt-8 -mx-4 px-4 py-4 bg-white border-t border-slate-200 shadow-lg"')
  })
  it('C4: the Accounting Body footer field border reaches 3:1 on navy; EthioTax keeps its border', () => {
    expect(footer).toContain("${isEthioTax ? 'border-white/50' : 'border-white/40'}")
    expect(ratio(over(WHITE, 0.4, NAVY), NAVY)).toBeGreaterThanOrEqual(3)
    expect(ratio(over(WHITE, 0.3, NAVY), NAVY)).toBeLessThan(3)
  })
  it('C5: an unknown one-segment address gets the bare 404 title (the root template adds the brand)', () => {
    const page = read('app/[slug]/page.tsx')
    expect(page).toContain("export const metadata: Metadata = { title: 'Page Not Found' }")
    expect(page).not.toContain('generateMetadata')
  })
  it('C1: the home role-card header row wraps instead of widening the page', () => {
    const home = read('app/page.tsx')
    // ET-3b (F1): the wrap is bounded to 768-786 px, the widths where the row widened the page.
    const i = home.indexOf('<div className="flex md:max-[786px]:flex-wrap items-start justify-between gap-3 mb-3">')
    expect(i).toBeGreaterThan(-1)
    expect(home.slice(i, i + 400)).toContain('shrink-0 whitespace-nowrap bg-slate-100 text-slate-600')
  })
  it('C6: the two unused files are retired; /icon.svg is still served by app/icon.svg', () => {
    expect(existsSync(join(root, 'public/icon.svg'))).toBe(false)
    expect(existsSync(join(root, 'app/get-help/page.tsx.backup2'))).toBe(false)
    expect(read('app/icon.svg')).toContain('fill="#1e3a7a"')
  })
})
