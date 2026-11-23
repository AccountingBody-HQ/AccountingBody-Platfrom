import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// vitest compiles .tsx with the classic JSX transform, which reads a global React.
;(globalThis as { React?: typeof React }).React = React

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createElement('a', { href, ...rest }, children as never),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => '/' }))

import { ShareButton } from '@/app/jobs/[slug]/ShareButton'
import { ETLanguageProvider } from '@/components/layout/ETLanguageContext'
import { LanguageSwitcher, MobileLangSwitcher } from '@/components/layout/LanguageSwitcher'
import { Navigation } from '@/components/layout/Navigation'
import { FONT_STYLESHEET } from '@/lib/fonts'

const ET_LINKS = { groups: [], cta: { label: 'Free quote', href: '/get-help', description: 'd' } }

// VF-2: the last Stage A polish. Source checks that keep each fix in place.
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const strip = (s: string) => s.replace(/<[^>]*>/g, '').replace(/®/g, '').replace(/\s+/g, ' ').trim()

describe('F2 accessible names contain the visible words (WCAG 2.5.3)', () => {
  it.each([['AB', {}, 'Accounting Body'], ['EthioTax', { etGetHelpLinks: ET_LINKS, etCompanyLinks: ET_LINKS }, 'EthioTax']])('%s header logo', (_brand, props, visible) => {
    const html = renderToStaticMarkup(createElement(Navigation, props))
    const start = html.indexOf('<a href="/" class="flex items-center gap-2 shrink-0 mr-2"')
    const a = html.slice(start, html.indexOf('</a>', start))
    expect(strip(a + '</a>')).toBe(visible)
    expect(a.match(/aria-label="([^"]*)"/)?.[1]).toContain(visible)
  })
  it.each([['desktop', LanguageSwitcher], ['mobile', MobileLangSwitcher]])('every %s language button', (_name, Switcher) => {
    const html = renderToStaticMarkup(createElement(ETLanguageProvider, null, createElement(Switcher)))
    const buttons = Array.from(html.matchAll(/<button[^>]*aria-label="([^"]*)"[^>]*>([\s\S]*?)<\/button>/g))
    expect(buttons).toHaveLength(3)
    for (const [, name, inner] of buttons) expect(name).toContain(strip(inner.replace(/<\/span>/g, ' ')))
  })
  it('the job page share button', () => {
    const html = renderToStaticMarkup(createElement(ShareButton, { url: 'https://accountingbody.com/jobs/x', jobTitle: 'Tax Manager', brandColor: '#0C1A3D' }))
    expect(html).toContain('<span>Share</span>')
    expect(html).toContain('aria-label="Share: copy link to Tax Manager"')
  })
})

describe('F2 targets are at least 24 by 24 px (WCAG 2.5.8)', () => {
  it('each desktop menu arrow is 14 + 2 + 8 = 24 px wide, with the link padding reduced by the same 2 px', () => {
    const nav = read('components/layout/Navigation.tsx')
    expect(nav).toContain('className="flex items-center pl-0.5 pr-2 py-2 text-navy-950 hover:text-navy-700"')
    expect(nav).toContain("'relative flex items-center pl-3 pr-0.5 py-2 text-sm font-medium transition-colors duration-150'")
    expect(nav).toContain('absolute bottom-0 left-3 right-0.5 h-0.5')
    expect(nav.match(/function ChevronDown[\s\S]{0,300}?w-3\.5 h-3\.5/)).not.toBeNull()
  })
  it('the search clear button is 20 + 4 = 24 px and stays where it was', () => {
    expect(read('app/search/SearchClient.tsx')).toMatch(/className="p-0\.5 -m-0\.5 [^"]*" aria-label="Clear search">\s*<svg className="w-5 h-5"/)
  })
})

describe('F3 the EthioTax sitemap lists final addresses only', () => {
  const paths = Array.from(read('app/et-sitemap/route.ts').matchAll(/\n\s+url\('([^']*)',/g)).map((m) => m[1])
  it('every fixed page is a real page, not one that only redirects', () => {
    expect(paths).toHaveLength(28)
    for (const p of paths) {
      const file = [`app${p}/page.tsx`, `app${p.replace(/\/[^/]+$/, '')}/[slug]/page.tsx`].find((f) => existsSync(join(process.cwd(), f)))
      expect(file, p).toBeTruthy()
      expect(read(file as string), p).not.toMatch(/export default (?:async )?function \w*\([^)]*\) \{\s*(?:permanentRedirect|redirect)\(/)
    }
  })
  it('the directory address still redirects and its target is listed', () => {
    expect(read('app/firms-freelancers/directory/page.tsx')).toContain("redirect('/firms-freelancers')")
    expect(paths).toContain('/firms-freelancers')
    expect(paths).not.toContain('/firms-freelancers/directory')
  })
})

describe('F1 the site fonts load by a link, so a blocked font host never fails the site stylesheet', () => {
  it('the stylesheet imports nothing from another site', () => {
    expect(read('app/globals.css')).not.toMatch(/@import\s+(?:url\()?\s*['"]?(?:https?:)?\/\//)
  })
  it.each(['app/layout.tsx', 'app/global-error.tsx'])('%s links the font stylesheet once, with no precedence (React must not wait for it)', (file) => {
    const src = read(file)
    expect(src.split('<link rel="stylesheet" href={FONT_STYLESHEET} />')).toHaveLength(2)
    expect(src).not.toMatch(/precedence=/)
  })
  it('the fonts are the same three families with swap', () => {
    const u = new URL(FONT_STYLESHEET)
    expect(u.origin + u.pathname).toBe('https://fonts.googleapis.com/css2')
    expect(u.searchParams.getAll('family').map((f) => f.split(':')[0])).toEqual(['DM Serif Display', 'DM Sans', 'JetBrains Mono'])
    expect(u.searchParams.get('display')).toBe('swap')
  })
})
