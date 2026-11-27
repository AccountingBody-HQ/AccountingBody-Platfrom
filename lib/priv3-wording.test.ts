import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import * as React from 'react'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

// PRIV-3 S6: the wording proof. Every new visible sentence of S1 (cookie page, banner) and S3 (forms),
// exactly as the owner approved it (D358), on both brands where it applies; every removed sentence 0.
;(globalThis as { React?: typeof React }).React = React

const H = vi.hoisted(() => ({ map: new Map<string, string>() }))
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => H.map.get(k.toLowerCase()) ?? null }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], has: () => false }),
}))
afterEach(() => {
  H.map.clear()
  vi.unstubAllEnvs()
})

const read = (p: string) => readFileSync(p, 'utf8')
const count = (s: string, sub: string) => s.split(sub).length - 1
const visible = (html: string) =>
  html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ')

// --- S1: cookie page -------------------------------------------------------
const COOKIE_PAGE_ALWAYS = [
  'cf_clearance',
  'Security: set only if Cloudflare asks your browser to pass a check.',
  'Up to 30 minutes',
  'Turnstile (no cookie)',
  'Checks that forms are sent by a person, not a bot. It reads browser details but stores no cookie.',
  'While the page is open',
  'Statistics (no cookies)',
  'Vercel Web Analytics',
  'Counts page visits without cookies and without identifying you. Choosing "Reject non-essential cookies" turns it off.',
  'Vercel Speed Insights',
  'Measures how fast pages load. Choosing "Reject non-essential cookies" turns it off.',
  'Tells visits apart for Google Analytics (only if you accept).',
  '_ga_<id>',
  'Keeps the state of your visit for Google Analytics (only if you accept).',
  'You can change your choice at any time with "Cookie settings" at the bottom of every page.',
]
const COOKIE_PAGE_ADS = [
  'Advertising cookies',
  '__gads, __gpi, __eoi',
  'Google AdSense',
  'Shows ads and limits how often you see them (only if you accept). Google may also set cookies on its own domains.',
  'Up to 13 months',
]
const COOKIE_PAGE_REMOVED = [
  '_cf_clearance',
  'Security — proves your browser passed a challenge.',
  '_va_*',
  'Vercel Analytics',
  'Privacy-first page view counting. No personal data stored.',
  'Tracks pages visited and time on site (optional).',
]

// --- S1: banner ------------------------------------------------------------
const BANNER_FIRST = 'We use what is needed to run this site, a security check on forms, cookie-free visit counting, and your practice notes on this device.'
const BANNER_OLD = 'We use only what is needed to run this site and to remember your practice on this device.'

// --- S3: forms ---------------------------------------------------------------
const NOTE = 'We use these details only to deal with your request. See our Privacy Policy.'
const CONTACT_AND_FOOTER = 'See how we use your details in our Privacy Policy.'
const TICK = 'I have read the Privacy Policy. I understand you will share my profile with an employer only after telling me.'
const HINT = 'Please do not include health, religion or other sensitive details.'
const FORMS_REMOVED = [
  'By submitting this form you agree to our',
  'By subscribing you agree to our',
  'I consent to',
  'holding and processing my personal data for the purpose of matching me with',
]

const cookiePage = async (et: boolean, ads: string) => {
  H.map.clear()
  if (et) H.map.set('x-et-platform', 'ethiotax')
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_ID', ads)
  const Page = (await import('@/app/cookie-policy/page')).default as () => Promise<ReactElement>
  return visible(renderToStaticMarkup(await Page()))
}

describe('PRIV-3 S6: cookie page wording, both brands', () => {
  it.each([
    ['Accounting Body, AdSense on', false, 'ca-pub-0000000000000000'],
    ['Accounting Body, AdSense off', false, ''],
    ['EthioTax, AdSense on', true, 'ca-pub-0000000000000000'],
    ['EthioTax, AdSense off', true, ''],
  ])('%s', async (_label, et, ads) => {
    const text = await cookiePage(et, ads)
    for (const s of COOKIE_PAGE_ALWAYS) expect(count(text, s), s).toBeGreaterThanOrEqual(1)
    for (const s of ['Statistics (no cookies)', 'Turnstile (no cookie)', 'You can change your choice at any time with "Cookie settings" at the bottom of every page.']) {
      expect(count(text, s), s).toBe(1)
    }
    for (const s of COOKIE_PAGE_ADS) expect(count(text, s), s).toBe(ads ? 1 : 0)
    for (const s of COOKIE_PAGE_REMOVED) expect(count(text, s), s).toBe(0)
    expect(count(text, 'et_language')).toBe(et ? 1 : 0)
  })
})

describe('PRIV-3 S6: banner wording (client-only, so proven from the source)', () => {
  it('the first sentence is new on both brands; the rest of the banner is unchanged', () => {
    const src = read('components/CookieConsent.tsx')
    expect(count(src, BANNER_FIRST)).toBe(1)
    expect(count(src, BANNER_OLD)).toBe(0)
    expect(src).toContain('If you accept, we also use analytics and advertising cookies to understand how the site is used and to show ads.')
    expect(src).toContain('If you accept, we also use analytics cookies to understand how the site is used.')
    expect(src).toContain('>Accept cookies</button>')
    expect(src).toContain('>Reject non-essential cookies</button>')
    expect(src).toContain('Read our cookie policy')
    // one brand switch for the title only: the new sentence is the same on both brands
    expect(src).toContain('Cookies on {brand}')
  })
})

describe('PRIV-3 S6: form wording', () => {
  it('the privacy note', async () => {
    const PrivacyNote = (await import('@/components/PrivacyNote')).default
    expect(visible(renderToStaticMarkup(React.createElement(PrivacyNote))).trim()).toBe(NOTE)
  })

  it('the contact form, on both brands', async () => {
    const Contact = (await import('@/app/contact/ContactForm')).default as (p: { isEthioTax: boolean }) => ReactElement
    for (const isEthioTax of [false, true]) {
      const text = visible(renderToStaticMarkup(React.createElement(Contact, { isEthioTax })))
      expect(count(text, CONTACT_AND_FOOTER)).toBe(1)
    }
  })

  it('the footer newsletter box (one sentence for both brands)', () => {
    const flat = read('components/layout/Footer.tsx').replace(/\{' '\}\s*/g, ' ').replace(/<Link [^>]*>([^<]*)<\/Link>/g, '$1')
    expect(count(flat, CONTACT_AND_FOOTER)).toBe(1)
  })

  it('both job-seeker forms (one label and hint for both brands)', () => {
    for (const f of ['app/jobs/find-work/FindWorkClient.tsx', 'app/freelancing-pathways/FreelancingPathwaysClient.tsx']) {
      const flat = read(f).replace(/\{' '\}\s*/g, ' ').replace(/<Link [^>]*>([^<]*)<\/Link>/g, '$1').replace(/\s+/g, ' ')
      expect(count(flat, TICK), f).toBe(1)
      expect(count(flat, HINT), f).toBe(1)
    }
  })

  it('the removed sentences are gone from every tracked page and component', () => {
    const files = execFileSync('git', ['ls-files', '--', 'app', 'components'], { encoding: 'utf8' })
      .split('\n')
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
    expect(files.length).toBeGreaterThan(100)
    for (const f of files) {
      const src = read(f)
      for (const s of [...FORMS_REMOVED, BANNER_OLD, 'Privacy-first page view counting']) expect(src.includes(s), `${s} in ${f}`).toBe(false)
    }
  })
})
