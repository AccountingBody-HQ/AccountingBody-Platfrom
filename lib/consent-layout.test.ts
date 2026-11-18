import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Cookie banner follow-ups (CC-2, owner decisions D245/D246): the footer legal row stays clear of the
// "Back to top" button, sticky layers stay above the banner while it shows, and the page makes no
// Google Tag Manager contact before the visitor accepts.
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const css = read('app/globals.css')

describe('no Google Tag Manager contact before consent (app/layout.tsx)', () => {
  const src = read('app/layout.tsx')
  it('has no DNS or connection hint to Google Tag Manager', () => {
    expect(src).not.toContain('googletagmanager')
  })
  it('keeps the font hints', () => {
    expect(src).toContain('<link rel="preconnect" href="https://fonts.googleapis.com" />')
    expect(src).toContain('<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />')
  })
})

describe('lib/consent.ts formatting', () => {
  it('spaces the Google cookie pattern assignment', () => {
    expect(read('lib/consent.ts')).toContain('const GOOGLE_COOKIE = /^(')
  })
})

describe('sticky layers while the banner shows (app/globals.css)', () => {
  it('lifts bars stuck to the bottom above the banner', () => {
    expect(css).toContain('html[data-consent-open] .sticky.bottom-0 { bottom: var(--consent-height, 0px); }')
    expect(read('components/QuizRenderer.tsx')).toContain('className="sticky bottom-0 z-30 ')
  })

  it('lets the sticky sidebars scroll with the page, only while the banner shows', () => {
    expect(css).toContain('html[data-consent-open] .lg\\:sticky { position: static; }')
    // no other rule targets the class
    expect(css.match(/\.lg\\:sticky/g) || []).toHaveLength(1)
    for (const f of [
      'app/articles/[slug]/page.tsx',
      'app/study/[category]/[slug]/page.tsx',
      'app/practice-questions/[slug]/page.tsx',
      'app/practice-questions/page.tsx',
    ]) {
      expect(read(f)).toMatch(/<aside className=['"][^'"]*lg:sticky lg:top-24/)
    }
  })
})

describe('footer legal row vs the "Back to top" button', () => {
  it('reserves room at the end of the legal row from lg up', () => {
    const footer = read('components/layout/Footer.tsx')
    expect(footer).toMatch(/<nav className="footer-legal-nav flex flex-wrap items-center gap-x-4 gap-y-1\.5 shrink-0" aria-label="Legal navigation">/)
    expect(css).toMatch(
      /@media \(min-width: 1024px\) \{\s*\.footer-legal-nav \{ padding-right: max\(0px, calc\(3rem - max\(0px, \(100vw - 90rem\) \/ 2\)\)\); \}\s*\}/,
    )
  })

  it('still matches the container and button sizes the rule is built on', () => {
    expect(css).toMatch(/\.container-wide \{\s*max-width: 90rem;\s*margin-inline: auto;\s*padding-inline: clamp\(1rem, 4vw, 2\.5rem\);/)
    const btn = read('components/ScrollToTop.tsx')
    expect(btn).toContain('fixed bottom-[80px] lg:bottom-6 lg:right-6 z-40 w-11 h-11 ')
    expect(btn).toContain('style={{right:"24px"}}')
  })

  it('leaves at least 10px between the row end and the button at every lg width', () => {
    // Button: 24px from the right edge, 44px wide. Container edge: max(40px, (W - 1440) / 2 + 40px) from the
    // right edge at lg (4vw >= 40px). The rule adds max(0, 48 - max(0, (100vw - 1440) / 2)); 100vw may
    // include a classic scrollbar of up to 17px, which only makes the reserved room smaller by half of it.
    for (let w = 1024; w <= 2560; w += 8) {
      for (const scrollbar of [0, 17]) {
        const layout = w - scrollbar
        const edge = Math.max(40, (layout - 1440) / 2 + 40)
        const pad = Math.max(0, 48 - Math.max(0, (w - 1440) / 2))
        expect(edge + pad - (24 + 44)).toBeGreaterThanOrEqual(10)
      }
    }
  })
})
