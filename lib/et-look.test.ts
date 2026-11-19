import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// ET-2 (owner decisions D253/D254): on EthioTax the footer is EthioTax green with readable text and the
// legal line "© <year> EthioTax. All rights reserved.", the header mark is the EthioTax shield, the tab
// icon is an EthioTax icon, and the find-work description names EthioTax only. Both brands: no head link
// to an icon or manifest file that does not exist; the 404 title carries one brand suffix.
// Accounting Body keeps its look; the one brand gold #C9982A stays (D233).

// vitest compiles .tsx with the classic JSX transform, which reads a global React.
;(globalThis as { React?: typeof React }).React = React

const brand = { et: false }
vi.mock('next/headers', () => ({
  headers: async () => new Headers(brand.et ? { 'x-et-platform': 'ethiotax' } : {}),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createElement('a', { href, ...rest }, children as never),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => '/' }))

import { Footer } from '@/components/layout/Footer'
import { Navigation } from '@/components/layout/Navigation'
import { metadata as notFoundMetadata } from '@/app/not-found'
import { generateMetadata as findWorkMetadata } from '@/app/jobs/find-work/page'

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const year = String(new Date().getFullYear())
const footer = (isEthioTax: boolean) =>
  renderToStaticMarkup(createElement(Footer, { isEthioTax, jobCount: 1234, articleCount: 300, questionCount: 5000 }))

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

const ET_GREEN = '#1A4731'
const G = rgb(ET_GREEN)
const WHITE = rgb('#ffffff')
const surface = (hex: string, alpha: number) => over(rgb(hex), alpha, G)

// Every text colour class used inside the EthioTax footer, with the surface it sits on and its WCAG 2.2 AA
// threshold (4.5:1 normal text; the footer has no large coloured text other than white).
const ET_FOOTER_TEXT: Record<string, { fg: string; alpha: number; bg: number[] }> = {
  'text-white': { fg: '#ffffff', alpha: 1, bg: G },
  'hover:text-white': { fg: '#ffffff', alpha: 1, bg: G },
  'text-white/70': { fg: '#ffffff', alpha: 0.7, bg: G },
  'text-white/60': { fg: '#ffffff', alpha: 0.6, bg: G },
  'placeholder:text-white/70': { fg: '#ffffff', alpha: 0.7, bg: surface('#ffffff', 0.1) },
  'text-green-100/70': { fg: '#dcfce7', alpha: 0.7, bg: G },
  'hover:text-green-100': { fg: '#dcfce7', alpha: 1, bg: G },
  'text-gold-400': { fg: '#e8b030', alpha: 1, bg: G },
  'text-gold-300': { fg: '#efc85d', alpha: 1, bg: surface('#C9982A', 0.2) },
  'text-teal-300': { fg: '#5be8d6', alpha: 1, bg: surface('#14b4a3', 0.2) },
  'text-red-300': { fg: '#fca5a5', alpha: 1, bg: G },
  'text-navy-950': { fg: '#0C1A3D', alpha: 1, bg: rgb('#C9982A') },
}

describe('EthioTax footer (ET-2)', () => {
  it('uses the EthioTax green and the D253 legal line on EthioTax', () => {
    const html = footer(true)
    expect(html).toContain('<footer class="bg-[#1A4731] text-white" aria-label="Site footer">')
    expect(html).toContain(`<p class="text-xs text-white/70">© ${year} EthioTax. All rights reserved.</p>`)
    expect(html).not.toMatch(/accounting ?body|Ltd\.|Registered in England/i)
  })

  it('keeps the Accounting Body footer as it was', () => {
    const html = footer(false)
    expect(html).toContain('<footer class="bg-navy-950 text-white" aria-label="Site footer">')
    expect(html).toContain(`<p class="text-xs text-white/70">© ${year} AccountingBody Ltd. All rights reserved. Registered in England &amp; Wales.</p>`)
    expect(html).toContain('class="text-[#C9982A] underline hover:text-[#e0b84e]"')
    expect(html).toContain('bg-white/10 border border-white/30 text-white')
    // The badges and the error/success states do not render on the Accounting Body footer at rest:
    // their Accounting Body classes are pinned in the source instead.
    const src = read('components/layout/Footer.tsx')
    for (const ab of ["isEthioTax ? 'text-teal-300' : 'text-teal-400'", "isEthioTax ? 'text-gold-300' : 'text-gold-400'", "isEthioTax ? 'text-red-300' : 'text-red-400'"]) {
      expect(src, ab).toContain(ab)
    }
    for (const etOnly of ['bg-[#1A4731]', 'border-white/50', 'text-gold-300', 'text-teal-300', 'EthioTax']) {
      expect(html, etOnly).not.toContain(etOnly)
    }
  })

  it('every text colour in the EthioTax footer reaches 4.5:1 on its surface', () => {
    for (const [cls, { fg, alpha, bg }] of Object.entries(ET_FOOTER_TEXT)) {
      const r = ratio(over(rgb(fg), alpha, bg), bg)
      expect(r, `${cls} ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('the EthioTax footer uses only text colours from that checked map', () => {
    // Rendered classes, plus the error and success states that render only after a submit (source).
    const src = read('components/layout/Footer.tsx')
    const classes = new Set((footer(true).match(/class="[^"]*"/g) || []).flatMap((c) => c.slice(7, -1).split(/\s+/)))
    const colour = /^(?:hover:|placeholder:)?text-(?:white(?:\/\d+)?|\[#[0-9a-fA-F]{6}\]|[a-z]+-\d{2,3}(?:\/\d+)?)$/
    const used = Array.from(classes).filter((c) => colour.test(c))
    expect(used.length).toBeGreaterThan(5)
    for (const c of used) expect(Object.keys(ET_FOOTER_TEXT), c).toContain(c)
    expect(src).toContain("isEthioTax ? 'text-red-300' : 'text-red-400'")
  })

  it('the field border and the shield stay visible on the green (3:1 for non-text)', () => {
    const html = footer(true)
    expect(html).toContain('bg-white/10 border border-white/50 text-white')
    expect(ratio(over(WHITE, 0.5, G), G)).toBeGreaterThanOrEqual(3)
    expect(html).toContain('<path d="M16 2L4 8v8c0 7 5.4 13.5 12 15.5C22.6 29.5 28 23 28 16V8L16 2z" fill="#C9982A"></path>')
    expect(ratio(rgb('#C9982A'), G)).toBeGreaterThanOrEqual(3)
  })
})

describe('header logo mark (ET-2)', () => {
  const et = { groups: [], cta: { label: 'Free quote', href: '/get-help', description: 'd' } }
  const logo = (html: string) => {
    const start = html.indexOf('<a href="/" class="flex items-center gap-2 shrink-0 mr-2"')
    expect(start).toBeGreaterThan(-1)
    return html.slice(start, html.indexOf('</a>', start))
  }
  it('EthioTax shows the shield with a green outline, decorative, and keeps its name', () => {
    const a = logo(renderToStaticMarkup(createElement(Navigation, { etGetHelpLinks: et, etCompanyLinks: et })))
    expect(a).toContain('aria-label="EthioTax home"')
    expect(a).toContain('<svg width="20" height="20" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">')
    expect(a).toContain('fill="#C9982A" stroke="#1A4731"')
    expect(a).not.toContain('<rect')
    expect(ratio(rgb('#1A4731'), WHITE)).toBeGreaterThanOrEqual(3)
  })
  it('Accounting Body keeps the four-square mark', () => {
    const a = logo(renderToStaticMarkup(createElement(Navigation, {})))
    expect(a).toContain('aria-label="AccountingBody home"')
    expect((a.match(/<rect [^>]*fill="#1e3a7a"/g) || []).length).toBe(3)
    expect(a).not.toContain('<path')
  })
})

describe('tab icon and head links (ET-2)', () => {
  const layout = read('app/layout.tsx')
  it('links no icon or manifest file that does not exist', () => {
    for (const gone of ['/favicon.ico', '/apple-touch-icon.png', '/site.webmanifest', 'manifest:']) {
      expect(layout, gone).not.toContain(gone)
    }
    const block = layout.slice(layout.indexOf('icons: {'), layout.indexOf('verification:'))
    const urls = Array.from(block.matchAll(/'(\/[^']+)'/g)).map((m) => m[1])
    expect(urls.sort()).toEqual(['/ethiotax-icon.svg', '/icon.svg'])
    for (const u of urls) expect(existsSync(join(root, 'public', u)) || existsSync(join(root, 'app', u)), u).toBe(true)
  })
  it('gives each brand its own icon; Accounting Body keeps /icon.svg', () => {
    expect(layout).toContain("icon: [{ url: isEthioTax ? '/ethiotax-icon.svg' : '/icon.svg', type: 'image/svg+xml' }],")
    expect(read('app/icon.svg')).toContain('fill="#1e3a7a"')
    const et = read('public/ethiotax-icon.svg')
    expect(et).toMatch(/^<svg [^>]*viewBox="0 0 32 32"/)
    expect(et).toContain('fill="#1A4731"')
    expect(et).toContain('fill="#C9982A"')
    expect(et).not.toMatch(/#D4A017/i)
  })
})

describe('page metadata per brand (ET-2)', () => {
  it('the not-found title is the bare title, so the root template adds one brand suffix', () => {
    expect(notFoundMetadata.title).toBe('Page Not Found')
    expect(read('app/layout.tsx')).toContain("template: isEthioTax ? '%s | EthioTax' : '%s | Accounting Body',")
  })
  it('the find-work description names EthioTax only on EthioTax', async () => {
    brand.et = true
    expect((await findWorkMetadata()).description).toBe(
      'Register as a candidate with EthioTax. We place accounting and finance professionals in permanent and contract roles.',
    )
    brand.et = false
    expect((await findWorkMetadata()).description).toBe(
      'Register as a candidate with Accounting Body or EthioTax. We place accounting and finance professionals in permanent and contract roles.',
    )
  })
})
