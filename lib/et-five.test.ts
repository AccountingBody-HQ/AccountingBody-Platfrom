import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// ET-5 (BOARD #16 group 4, owner decisions D257/D266/D267): on EthioTax the language tool loads only after a
// language pick, the content security policy lists the language tool's hosts, the WhatsApp menu item is not
// prefetched, the ETICPA hero glows, the /study and /jobs icon marks and the text selection use the EthioTax
// look, and /search sends the right site name in its first HTML. Accounting Body keeps its look.

;(globalThis as { React?: typeof React }).React = React
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createElement('a', { href, ...rest }, children as never),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => '/' }))

import JobsHubClient from '@/app/jobs/JobsHubClient'
import { ET_COMPANY_LINKS } from '@/components/layout/nav-data'

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')

describe('E1: the language tool loads only after a language pick', () => {
  it('the server wrapper renders the loader and no Translate script of its own', () => {
    const src = read('components/layout/NavigationWrapper.tsx')
    expect(src).not.toContain('translate_a/element.js')
    expect(src).not.toContain('gt-init')
    expect(src).not.toContain("from 'next/script'")
    expect(src).toContain('<ETTranslateLoader />')
  })
  it('the loader is a client component that renders the scripts only for Amharic or Oromo, init first', () => {
    const src = read('components/layout/ETTranslateLoader.tsx')
    expect(src.startsWith("'use client'")).toBe(true)
    expect(src).toMatch(/if \(language === 'en'\) return null/)
    const init = src.indexOf('id="gt-init"')
    const el = src.indexOf('translate_a/element.js?cb=googleTranslateElementInit')
    expect(init).toBeGreaterThan(-1)
    expect(el).toBeGreaterThan(init)
    expect(src).toContain('<div id="google_translate_element" style={{ display: \'none\' }} />')
  })
  it('the first render (server and first client render) has no Translate script', async () => {
    const { ETTranslateLoader } = await import('@/components/layout/ETTranslateLoader')
    const { ETLanguageProvider } = await import('@/components/layout/ETLanguageContext')
    const html = renderToStaticMarkup(createElement(ETLanguageProvider, null, createElement(ETTranslateLoader)))
    expect(html).toBe('')
  })
  it('a visit without a pick does not write et_language; a pick still writes it', () => {
    const src = read('components/layout/ETLanguageContext.tsx')
    const effect = src.slice(src.indexOf('useEffect(() => {'), src.indexOf('}, [])'))
    expect(effect).toContain('detectCurrentLanguage()')
    expect(effect).not.toContain('setCookie(')
    const pick = src.slice(src.indexOf('const setLanguage = (lang: Language) => {'))
    expect(pick).toMatch(/setCookie\(COOKIE_NAME, lang\)[\s\S]*setGoogTransCookie\(GT_CODES\[lang\]\)/)
  })
})

describe('E2: the content security policy lists exactly the language tool hosts', () => {
  const csp = () => {
    const v = JSON.parse(read('vercel.json')) as { headers: { source: string; headers: { key: string; value: string }[] }[] }
    const all = v.headers.flatMap((h) => h.headers.filter((x) => x.key.toLowerCase() === 'content-security-policy').map((x) => ({ source: h.source, value: x.value })))
    expect(all.length).toBe(1)
    expect(all[0].source).toBe('/(.*)')
    const dirs: Record<string, string[]> = {}
    for (const d of all[0].value.split(';').map((s) => s.trim()).filter(Boolean)) {
      const [name, ...vals] = d.split(/\s+/)
      dirs[name] = vals
    }
    return dirs
  }
  const tail = (dir: string[], n: number) => dir.slice(dir.length - n)
  it('script-src, style-src, img-src and connect-src end with exactly the listed hosts', () => {
    const d = csp()
    expect(tail(d['script-src'], 3)).toEqual(['https://translate.google.com', 'https://translate.googleapis.com', 'https://translate-pa.googleapis.com'])
    expect(tail(d['style-src'], 1)).toEqual(['https://www.gstatic.com'])
    expect(tail(d['img-src'], 3)).toEqual(['https://translate.google.com', 'https://www.gstatic.com', 'https://www.google.com'])
    expect(tail(d['connect-src'], 2)).toEqual(['https://translate.googleapis.com', 'https://translate-pa.googleapis.com'])
  })
  it('the language tool hosts appear nowhere else and no hash or nonce is added', () => {
    const d = csp()
    const where = (h: string) => Object.keys(d).filter((k) => d[k].includes(h)).sort()
    expect(where('https://translate.google.com')).toEqual(['img-src', 'script-src'])
    expect(where('https://translate.googleapis.com')).toEqual(['connect-src', 'script-src'])
    expect(where('https://translate-pa.googleapis.com')).toEqual(['connect-src', 'script-src'])
    expect(where('https://www.gstatic.com')).toEqual(['img-src', 'style-src'])
    expect(where('https://www.google.com')).toEqual(['img-src'])
    expect(Object.values(d).flat().some((v) => /^'(nonce|sha256|sha384|sha512)-/.test(v))).toBe(false)
    expect(d['script-src'].slice(0, 3)).toEqual(["'self'", "'unsafe-inline'", "'unsafe-eval'"])
    expect(d['frame-ancestors']).toEqual(["'none'"])
  })
})

describe('E3: the WhatsApp menu item is not prefetched', () => {
  it('only the WhatsApp item opts out of prefetch', () => {
    const links = ET_COMPANY_LINKS.groups.flatMap((g) => g.links) as { href: string; noPrefetch?: boolean }[]
    expect(links.filter((l) => l.noPrefetch).map((l) => l.href)).toEqual(['/wa'])
    expect(read('components/layout/nav-data.ts').match(/noPrefetch: true/g)?.length).toBe(1)
  })
  it('both group-link render sites honour it and pass nothing for other links', () => {
    const src = read('components/layout/Navigation.tsx')
    expect(src.match(/\{\.\.\.\(link\.noPrefetch \? \{ prefetch: false \} : \{\}\)\}/g)?.length).toBe(2)
    expect(src).not.toMatch(/prefetch=\{false\}/)
  })
  it('the three home-page WhatsApp links are not prefetched (WA-1)', () => {
    const home = read('app/page.tsx')
    expect(home.match(/href="\/wa"/g)?.length).toBe(3)
    expect(home.match(/href="\/wa"\s+prefetch=\{false\}/g)?.length).toBe(3)
    expect(home.match(/prefetch=\{false\}/g)?.length).toBe(3)
  })
})

describe('E4: the ETICPA hero glows are the one EthioTax glow', () => {
  const files = [
    'app/study/eticpa/page.tsx', 'app/study/eticpa/cpa/page.tsx', 'app/study/eticpa/atq/level-1/page.tsx', 'app/study/eticpa/atq/level-2/page.tsx',
    'app/study/eticpa/atq/level-1/business-skills/page.tsx', 'app/study/eticpa/atq/level-1/cost-accounting/page.tsx',
    'app/study/eticpa/atq/level-1/ethiopian-business-law/page.tsx', 'app/study/eticpa/atq/level-1/introduction-to-accounting/page.tsx',
    'app/study/eticpa/atq/level-2/assurance-controls-ethics/page.tsx', 'app/study/eticpa/atq/level-2/ethiopian-public-sector-accounting/page.tsx',
    'app/study/eticpa/atq/level-2/ethiopian-taxation/page.tsx', 'app/study/eticpa/atq/level-2/financial-accounting/page.tsx',
    'app/study/eticpa/atq/level-2/management-accounting/page.tsx',
  ]
  it.each(files)('%s uses var(--hero-glow, #C9982A) and no bare gold glow', (f) => {
    const src = read(f)
    expect(src.match(/radial-gradient\(ellipse at center top, var\(--hero-glow, #C9982A\) 0%, transparent 70%\)/g)?.length).toBe(1)
    expect(src).not.toContain('radial-gradient(ellipse at center top, #C9982A 0%')
  })
})

describe('E5: icon marks on /study and /jobs follow the brand', () => {
  it('/study icons draw with currentColor on a text-navy-950 svg (green on EthioTax through the ET-4 rule)', () => {
    const src = read('app/study/page.tsx')
    expect(src).not.toMatch(/#0C1A3D/i)
    const svgs = src.match(/<svg viewBox="0 0 48 48" fill="none" xmlns="http:\/\/www\.w3\.org\/2000\/svg" className="w-8 h-8 text-navy-950">/g) || []
    expect(svgs.length).toBe(11)
    expect(read('app/globals.css')).toContain(':where(html[data-brand="ethiotax"]) .text-navy-950,')
  })
  it('/jobs employer check marks are green on EthioTax and navy on Accounting Body', () => {
    const et = renderToStaticMarkup(createElement(JobsHubClient, { isEthioTax: true, jobCount: 10 }))
    const ab = renderToStaticMarkup(createElement(JobsHubClient, { isEthioTax: false, jobCount: 10 }))
    expect(et).not.toMatch(/stroke="#0C1A3D"/i)
    expect((et.match(/stroke="#1A4731"/g) || []).length).toBeGreaterThan(0)
    expect((ab.match(/stroke="#0C1A3D"/g) || []).length).toBeGreaterThan(0)
  })
})

describe('E6: the proxy icon-tile selectors match nothing the EthioTax home renders (record)', () => {
  it('both tile uses sit in the Accounting Body arm of the home page', () => {
    const src = read('app/page.tsx')
    const etStart = src.indexOf('{isEthioTax ? (')
    const abStart = src.indexOf('\n      ) : (\n        <>', etStart)
    expect(etStart).toBeGreaterThan(-1)
    expect(abStart).toBeGreaterThan(etStart)
    const uses = Array.from(src.matchAll(/w-9 h-9 rounded-lg bg-navy-50/g)).map((m) => m.index ?? 0)
    expect(uses.length).toBe(2)
    for (const u of uses) expect(u).toBeGreaterThan(abStart)
  })
})

describe('E7: text selection on EthioTax is green', () => {
  it('one ET-5 rule under the EthioTax <html>; the shared rule is unchanged', () => {
    const css = read('app/globals.css')
    const a = css.indexOf('/* ET-5')
    const b = css.indexOf('/* End of ET-5 */')
    expect(a).toBeGreaterThan(css.indexOf('/* End of ET-4 */'))
    expect(b).toBeGreaterThan(a)
    expect(css.slice(a, b)).toContain('html[data-brand="ethiotax"] ::selection { background-color: #d6e7dd; color: #1A4731; }')
    expect(css).toMatch(/::selection \{\s*background-color: var\(--color-navy-100\);\s*color: var\(--color-navy-950\);\s*\}/)
  })
  it('the selected text meets 4.5:1 (pure maths; cannot be red)', () => {
    const lin = (x: number) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)
    const lum = (h: string) => { const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255)); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
    const ratio = (lum('#d6e7dd') + 0.05) / (lum('#1A4731') + 0.05)
    expect(ratio).toBeGreaterThan(4.5)
  })
})

describe('E9: /search sends the brand in its first HTML', () => {
  it('the page is a server component that reads the request header and passes the brand down', () => {
    const src = read('app/search/page.tsx')
    expect(src).not.toContain("'use client'")
    expect(src).toContain('isEthioTaxHeader(await headers())')
    expect(src).toContain('<SearchInner isEthioTax={isEthioTax} />')
  })
  it('the client part takes the brand as a prop and no longer guesses it after mount', () => {
    const src = read('app/search/SearchClient.tsx')
    expect(src.startsWith("'use client'")).toBe(true)
    expect(src).toContain('export function SearchInner({ isEthioTax }: { isEthioTax: boolean })')
    expect(src).not.toContain('setIsEthioTax')
    expect(src).not.toContain("startsWith('x-et-platform=')")
  })
})
