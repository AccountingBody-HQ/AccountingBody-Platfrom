// lib/consent.ts
// Cookie consent (CC-1, owner decision D245): the visitor's stored choice and the only code that loads
// Google Tag Manager and Google AdSense. Nothing here runs on the server; every browser access is guarded.
// The key and its two values are unchanged from the first version, so earlier choices are honoured.

export const CONSENT_KEY = 'ab_cookie_consent'
export type ConsentChoice = 'accepted' | 'declined'
export type ConsentIds = { gtmId?: string; adsenseId?: string }
export type ConsentEvent = 'change' | 'open'

type ConsentWindow = Window & { __gtm_loaded?: boolean; __ads_loaded?: boolean; dataLayer?: unknown[] }

const listeners = new Set<(e: ConsentEvent) => void>()

function emit(e: ConsentEvent) {
  Array.from(listeners).forEach((fn) => fn(e))
}

/** Listen for a changed choice or a request to show the choice again. Returns the unsubscribe function. */
export function subscribeConsent(fn: (e: ConsentEvent) => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

// The choice made on this page, for when storage cannot keep it (blocked or full).
let pageChoice: ConsentChoice | null = null

export function readConsent(): ConsentChoice | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY)
    return v === 'accepted' || v === 'declined' ? v : pageChoice
  } catch {
    return pageChoice
  }
}

export function writeConsent(choice: ConsentChoice) {
  pageChoice = choice
  try {
    localStorage.setItem(CONSENT_KEY, choice)
  } catch {
    // Storage blocked: the choice still applies to this page.
  }
  emit('change')
}

/**
 * The AdSense client id, or '' when ads are off. The one condition for "this site can load AdSense":
 * the root layout passes it to the banner, and the cookie page lists the advertising cookies only
 * when it is set. Safe on the server (it only reads the build-time value).
 */
export function adsenseClientId(): string {
  return process.env.NEXT_PUBLIC_ADSENSE_ID ?? ''
}

/** Re-open the banner so the visitor can change the choice (footer "Cookie settings"). */
export function openConsentSettings() {
  emit('open')
}

export function loadGTM(gtmId: string): boolean {
  if (!gtmId || typeof window === 'undefined') return false
  const w = window as ConsentWindow
  if (w.__gtm_loaded) return false
  w.__gtm_loaded = true
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`
  document.head.appendChild(script)
  return true
}

export function loadAdSense(clientId: string): boolean {
  if (!clientId || typeof window === 'undefined') return false
  const w = window as ConsentWindow
  if (w.__ads_loaded || document.querySelector('script[src*="adsbygoogle.js"]')) return false
  w.__ads_loaded = true
  const script = document.createElement('script')
  script.async = true
  script.crossOrigin = 'anonymous'
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`
  document.head.appendChild(script)
  return true
}

/** Apply a choice to this page: only 'accepted' loads anything. */
export function applyConsent(choice: ConsentChoice | null, ids: ConsentIds) {
  if (choice !== 'accepted' || typeof window === 'undefined') return
  document.documentElement.setAttribute('data-consent-applied', 'accepted')
  loadGTM(ids.gtmId || '')
  loadAdSense(ids.adsenseId || '')
}

/** True when Google code was loaded into this page (it cannot be unloaded without a reload). */
export function thirdPartyLoaded(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as ConsentWindow
  return !!(w.__gtm_loaded || w.__ads_loaded)
}

/**
 * How far to scroll the page down so a focused item sits `gap` px above the banner (WCAG 2.2 SC 2.4.11).
 * Never moves the item's top above `topLimit` (the bottom of the fixed header): an item taller than the
 * free area ends with its top just below the header. Returns 0 when the item is clear or nothing helps.
 */
export function focusScrollDelta(rect: { top: number; bottom: number }, bannerTop: number, topLimit: number, gap = 8): number {
  if (rect.bottom <= rect.top || rect.bottom <= bannerTop) return 0
  const room = rect.top - topLimit
  if (room <= 0) return 0
  return Math.ceil(Math.min(rect.bottom - bannerTop + gap, room))
}

/** True when the element or an ancestor is fixed or sticky: scrolling the page does not move it. */
export function isPinned(el: Element): boolean {
  for (let n: Element | null = el; n && n.nodeType === 1; n = n.parentElement) {
    const p = getComputedStyle(n).position
    if (p === 'fixed' || p === 'sticky') return true
  }
  return false
}

const GOOGLE_COOKIE = /^(_ga|_ga_.+|_gid|_gat.*|_gcl_.+|__gads|__gpi|__eoi)$/

/** Remove first-party Google analytics and ad cookies (on this host and its parent domain). */
export function clearGoogleCookies(): string[] {
  if (typeof window === 'undefined') return []
  let names: string[] = []
  try {
    names = document.cookie
      .split(';')
      .map((c) => c.split('=')[0].trim())
      .filter((n) => GOOGLE_COOKIE.test(n))
  } catch {
    return []
  }
  const host = window.location.hostname
  const parts = host.split('.')
  const domains = ['', host, parts.length > 2 ? '.' + parts.slice(-2).join('.') : '.' + host]
  for (const n of names) {
    for (const d of domains) {
      document.cookie = `${n}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d ? '; domain=' + d : ''}`
    }
  }
  return names
}
