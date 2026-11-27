import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Cookie consent guard (CC-1, owner decision D245): a small non-blocking banner at the bottom with equal
// Accept and Reject buttons, a footer "Cookie settings" control, and no Google Tag Manager or Google
// AdSense code until the visitor accepts. The stored key and its two values stay as they were, so every
// earlier choice is still honoured.
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

type FakeScript = { tagName: string; async: boolean; src: string; crossOrigin: string | null }

function fakeBrowser(initial: Record<string, string> = {}, { throwing = false } = {}) {
  const store = new Map(Object.entries(initial))
  const scripts: FakeScript[] = []
  const cookieWrites: string[] = []
  const attrs = new Map<string, string>()
  const localStorage = {
    getItem: (k: string) => { if (throwing) throw new Error('blocked'); return store.has(k) ? store.get(k)! : null },
    setItem: (k: string, v: string) => { if (throwing) throw new Error('blocked'); store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
  }
  const document = {
    head: { appendChild: (el: FakeScript) => { scripts.push(el) } },
    createElement: (tag: string) => ({ tagName: tag.toUpperCase(), async: false, src: '', crossOrigin: null }),
    querySelector: (sel: string) => {
      const m = sel.match(/src\*="([^"]+)"/)
      return m ? scripts.find((s) => s.src.includes(m[1])) || null : null
    },
    documentElement: {
      setAttribute: (k: string, v: string) => { attrs.set(k, v) },
      removeAttribute: (k: string) => { attrs.delete(k) },
      getAttribute: (k: string) => (attrs.has(k) ? attrs.get(k)! : null),
    },
    get cookie() { return '_ga=GA1.1.1; _ga_ABC=GS1.1; _gid=GA1.2; __gads=ID=1; keep=1; et_language=en' },
    set cookie(v: string) { cookieWrites.push(v) },
  }
  const window: Record<string, unknown> = { localStorage, document, location: { hostname: 'www.example.test' } }
  vi.stubGlobal('window', window)
  vi.stubGlobal('document', document)
  vi.stubGlobal('localStorage', localStorage)
  return { store, scripts, cookieWrites, attrs, window }
}

async function freshModule() {
  vi.resetModules()
  return import('./consent')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('consent module (lib/consent.ts)', () => {
  it('keeps the stored key and both legacy values', async () => {
    fakeBrowser({ ab_cookie_consent: 'accepted' })
    const m = await freshModule()
    expect(m.CONSENT_KEY).toBe('ab_cookie_consent')
    expect(m.readConsent()).toBe('accepted')
    m.writeConsent('declined')
    expect(m.readConsent()).toBe('declined')
    expect(localStorage.getItem('ab_cookie_consent')).toBe('declined')
  })

  it('treats no value, an unknown value and blocked storage as no choice', async () => {
    fakeBrowser()
    let m = await freshModule()
    expect(m.readConsent()).toBeNull()
    fakeBrowser({ ab_cookie_consent: 'maybe' })
    m = await freshModule()
    expect(m.readConsent()).toBeNull()
    fakeBrowser({}, { throwing: true })
    m = await freshModule()
    expect(m.readConsent()).toBeNull()
    expect(() => m.writeConsent('accepted')).not.toThrow()
  })

  it('loads no Google script without consent or after a rejection', async () => {
    const b = fakeBrowser()
    const m = await freshModule()
    m.applyConsent(null, { gtmId: 'GTM-TEST', adsenseId: 'ca-pub-test' })
    m.applyConsent('declined', { gtmId: 'GTM-TEST', adsenseId: 'ca-pub-test' })
    expect(b.scripts).toHaveLength(0)
    expect(m.thirdPartyLoaded()).toBe(false)
    expect(b.attrs.has('data-consent-applied')).toBe(false)
  })

  it('loads Google Tag Manager and AdSense once each after Accept', async () => {
    const b = fakeBrowser()
    const m = await freshModule()
    m.applyConsent('accepted', { gtmId: 'GTM-TEST', adsenseId: 'ca-pub-test' })
    m.applyConsent('accepted', { gtmId: 'GTM-TEST', adsenseId: 'ca-pub-test' })
    expect(b.scripts).toHaveLength(2)
    const gtm = b.scripts.filter((s) => s.src.startsWith('https://www.googletagmanager.com/gtm.js?id='))
    const ads = b.scripts.filter((s) => s.src.startsWith('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='))
    expect(gtm).toHaveLength(1)
    expect(ads).toHaveLength(1)
    expect(gtm[0].async && ads[0].async).toBe(true)
    expect(ads[0].crossOrigin).toBe('anonymous')
    expect(m.thirdPartyLoaded()).toBe(true)
    expect(b.attrs.get('data-consent-applied')).toBe('accepted')
    expect((b.window.dataLayer as unknown[]).length).toBe(1)
  })

  it('runs the accepted path without ids but injects nothing', async () => {
    const b = fakeBrowser()
    const m = await freshModule()
    m.applyConsent('accepted', { gtmId: '', adsenseId: '' })
    expect(b.scripts).toHaveLength(0)
    expect(b.attrs.get('data-consent-applied')).toBe('accepted')
    expect(m.thirdPartyLoaded()).toBe(false)
  })

  it('notifies subscribers of a change and of a settings request', async () => {
    fakeBrowser()
    const m = await freshModule()
    const seen: string[] = []
    const off = m.subscribeConsent((e) => seen.push(e))
    m.writeConsent('accepted')
    m.openConsentSettings()
    off()
    m.openConsentSettings()
    expect(seen).toEqual(['change', 'open'])
  })

  it('clears only first-party Google analytics and ad cookies on Reject', async () => {
    const b = fakeBrowser()
    const m = await freshModule()
    const names = m.clearGoogleCookies()
    expect(names).toEqual(['_ga', '_ga_ABC', '_gid', '__gads'])
    expect(b.cookieWrites.length).toBeGreaterThan(0)
    expect(b.cookieWrites.every((c) => /^(_ga|_ga_ABC|_gid|__gads)=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=\//.test(c))).toBe(true)
    expect(b.cookieWrites.some((c) => c.startsWith('keep=') || c.startsWith('et_language='))).toBe(false)
  })
})

describe('no Google tag or ad code before consent (app/layout.tsx)', () => {
  const layout = read('app/layout.tsx')
  it('renders no AdSense script and no GTM noscript frame on the server', () => {
    expect(layout).not.toContain('adsbygoogle')
    expect(layout).not.toContain('pagead2.googlesyndication.com')
    expect(layout).not.toMatch(/<noscript/)
    expect(layout).not.toContain('googletagmanager.com/ns.html')
    // the site-verification meta tag (no request) stays
    expect(layout).toContain('<meta name="google-adsense-account" content={process.env.NEXT_PUBLIC_ADSENSE_ID} />')
  })
  it('passes the brand and both public ids to the banner, placed right after the skip link', () => {
    // PRIV-3 S1: the AdSense id comes from the one helper the cookie page also uses.
    expect(layout).toMatch(/<CookieConsent gtmId=\{GTM_ID \?\? ''\} adsenseId=\{adsenseClientId\(\)\} isEthioTax=\{isEthioTax\} \/>/)
    expect(layout).toContain("import { adsenseClientId } from '@/lib/consent'")
    expect(layout.match(/<CookieConsent\b/g)).toHaveLength(1)
    const skip = layout.indexOf('Skip to main content')
    const banner = layout.indexOf('<CookieConsent')
    expect(skip).toBeGreaterThan(-1)
    expect(banner).toBeGreaterThan(skip)
    expect(banner).toBeLessThan(layout.indexOf('<NavigationWrapper'))
  })
})

describe('the banner (components/CookieConsent.tsx)', () => {
  const src = read('components/CookieConsent.tsx')
  it('is a named, non-modal region at the bottom with no backdrop', () => {
    expect(src).toContain('role="region"')
    expect(src).toContain('aria-labelledby="cookie-banner-title"')
    expect(src).toContain('id="cookie-banner-title"')
    expect(src).toMatch(/className="fixed inset-x-0 bottom-0 z-30 /)
    expect(src).not.toMatch(/aria-modal|alertdialog|role="dialog"/)
    expect(src).not.toMatch(/(?<![\w-])inset-0(?![\w-])|backdrop-/)
    expect(src).not.toMatch(/autoFocus/)
  })
  it('has two equal buttons with the exact names', () => {
    expect(src).toContain('>Accept cookies</button>')
    expect(src).toContain('>Reject non-essential cookies</button>')
    expect(src).not.toContain('Decline non-essential cookies')
    expect((src.match(/<button\b/g) || []).length).toBe(2)
    expect((src.match(/className=\{buttonClass\}/g) || []).length).toBe(2)
  })
  it('shows the approved words and takes the brand from one switch', () => {
    expect(src).toContain("const brand = isEthioTax ? 'EthioTax' : 'Accounting Body'")
    expect(src).toContain('Cookies on {brand}')
    // PRIV-3 S1 (D358): the first sentence names the security check and the cookie-free visit counting.
    expect(src).toContain("We use what is needed to run this site, a security check on forms, cookie-free visit counting, and your practice notes on this device.{' '}\n            {adsenseId")
    expect(src).not.toContain('We use only what is needed to run this site and to remember your practice on this device.')
    expect(src).not.toContain('We only use what is needed to run this site unless you accept.')
    expect(src).not.toContain('unless you accept')
    expect(src).toContain('If you accept, we also use analytics and advertising cookies to understand how the site is used and to show ads.')
    expect(src).toContain('If you accept, we also use analytics cookies to understand how the site is used.')
    expect(src).toContain('Read our cookie policy')
    expect(src).toMatch(/<Link\s+href="\/cookie-policy"/)
    expect((src.replace(/isEthioTax/g, '').match(/Accounting ?Body|Ethio ?Tax/gi) || []).length).toBe(2)
  })
  it('loads third-party code only through the consent module', () => {
    expect(src).toContain("from '@/lib/consent'")
    expect(src).not.toMatch(/googletagmanager|googlesyndication|createElement\('script'\)/)
  })
})

describe('the footer "Cookie settings" control (components/layout/Footer.tsx)', () => {
  const src = read('components/layout/Footer.tsx')
  it('is a button in the legal links group on both brands that re-opens the choice', () => {
    expect(src).toContain("import { openConsentSettings } from '@/lib/consent'")
    const nav = src.slice(src.indexOf('aria-label="Legal navigation"'), src.indexOf('</nav>', src.indexOf('aria-label="Legal navigation"')))
    expect(nav).toMatch(/<button\s+type="button"\s+onClick=\{openConsentSettings\}/)
    expect(nav).toContain('>\n                Cookie settings\n              </button>')
    // same look as the legal links, per brand
    expect((nav.match(/text-xs transition-colors \$\{isEthioTax \? "text-green-100\/70 hover:text-green-100" : "text-white\/70 hover:text-white\/70"\}/g) || []).length).toBe(2)
  })
})

// RV-66 (WCAG 2.2 SC 2.4.11): while the banner shows, an item reached with the keyboard is moved out from
// under it. The browser's own focus scroll can leave a tall item partly behind the banner.
describe('focused items are not hidden behind the banner (lib/consent.ts)', () => {
  it('works out how far to scroll so the item sits just above the banner', async () => {
    const { focusScrollDelta } = await freshModule()
    // [top, bottom, bannerTop, topLimit] -> delta
    const cases: Array<[number, number, number, number, number]> = [
      [100, 140, 773, 64, 0], // clear of the banner
      [700, 773, 773, 64, 0], // touches the top of the banner only
      [740, 780, 773, 64, 15], // 7 px behind: 7 + 8 px gap
      [800, 840, 773, 64, 75], // wholly behind
      [283, 564, 563, 64, 9], // tall card, 1 px behind
      [352, 633, 563, 64, 78], // tall card, 70 px behind
      [100, 700, 563, 64, 36], // taller than the free area: top stops just below the header
      [64, 700, 563, 64, 0], // already at the header: nothing more can help
      [30, 700, 563, 64, 0], // under the header: never pushed further up
      [740, 740, 773, 64, 0], // no height
    ]
    for (const [top, bottom, bt, limit, want] of cases) {
      expect(focusScrollDelta({ top, bottom }, bt, limit)).toBe(want)
    }
  })

  it('treats items in a fixed or sticky layer as pinned', async () => {
    const { isPinned } = await freshModule()
    type N = { nodeType: number; parentElement: N | null; pos: string }
    const node = (pos: string, parentElement: N | null = null): N => ({ nodeType: 1, parentElement, pos })
    const style = (n: unknown) => ({ position: (n as N).pos }) as CSSStyleDeclaration
    vi.stubGlobal('getComputedStyle', style)
    const body = node('static')
    expect(isPinned(node('static', node('relative', body)) as unknown as Element)).toBe(false)
    expect(isPinned(node('static', node('fixed', body)) as unknown as Element)).toBe(true)
    expect(isPinned(node('static', node('sticky', body)) as unknown as Element)).toBe(true)
    expect(isPinned(node('fixed') as unknown as Element)).toBe(true)
  })
})

describe('the banner moves keyboard focus out from under itself (components/CookieConsent.tsx)', () => {
  const src = read('components/CookieConsent.tsx')
  const effect = src.slice(src.indexOf("addEventListener('focusin'") - 1600, src.indexOf("removeEventListener('focusin'") + 80)
  it('listens for focus only while the banner shows and stops when it closes', () => {
    expect((src.match(/document\.addEventListener\('focusin', onFocusIn\)/g) || []).length).toBe(1)
    expect((src.match(/document\.removeEventListener\('focusin', onFocusIn\)/g) || []).length).toBe(1)
    expect(effect).toMatch(/if \(!mode \|\| !banner\) return/)
    expect(effect).toMatch(/return \(\) => \{\s*cancelAnimationFrame\(raf\)\s*document\.removeEventListener\('focusin', onFocusIn\)/)
  })
  it('skips the banner itself, mouse focus and pinned items, and scrolls instantly', () => {
    expect(effect).toContain('banner.contains(el)')
    expect(effect).toContain(":focus-visible")
    expect(effect).toContain('isPinned(el)')
    expect(effect).toContain('focusScrollDelta(')
    expect(effect).toContain("window.scrollBy({ top: delta, behavior: 'instant' })")
    expect(effect).toContain('requestAnimationFrame(')
    expect(src).not.toMatch(/scrollIntoView|behavior: 'smooth'/)
  })
})

describe('space kept for the banner (app/globals.css)', () => {
  const css = read('app/globals.css')
  it('reserves space and lifts bottom-pinned bars only while the banner shows', () => {
    expect(css).toContain('html[data-consent-open] { scroll-padding-bottom: var(--consent-height, 0px); }')
    expect(css).toContain('html[data-consent-open] body { padding-bottom: var(--consent-height, 0px); }')
    expect(css).toMatch(/html\[data-consent-open\] \.fixed\.bottom-0:not\(#cookie-banner\),\s*html\[data-consent-open\] \.fixed\.bottom-\\\[80px\\\] \{ translate: 0 calc\(-1 \* var\(--consent-height, 0px\)\); \}/)
  })
})
