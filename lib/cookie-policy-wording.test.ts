import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as React from 'react'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// The page uses the classic JSX transform under vitest (as in lib/et-ten.test.ts).
;(globalThis as { React?: typeof React }).React = React

// PQB-1 S3 (PQ-D3 #13; D351): the cookie page lists what the site really
// keeps. sb-* (never set) is gone; ab_vid is listed on both brands; the
// EthioTax language cookies show on the EthioTax view only; a new "Stored on
// your device" section lists the browser-storage keys. Everything else stays.

const H = vi.hoisted(() => ({ map: new Map<string, string>() }))
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => H.map.get(k.toLowerCase()) ?? null }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], has: () => false }),
}))
beforeEach(() => H.map.clear())

const decode = (html: string) => html.replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"')
const render = async (et: boolean) => {
  H.map.clear()
  if (et) H.map.set('x-et-platform', 'ethiotax')
  const Page = (await import('@/app/cookie-policy/page')).default as () => Promise<ReactElement>
  return decode(renderToStaticMarkup(await Page()))
}
const count = (html: string, s: string) => html.split(s).length - 1
const src = readFileSync(join(process.cwd(), 'app/cookie-policy/page.tsx'), 'utf8')

// One rendered row: name cell (with the provider line for cookies), purpose, duration.
const cookieRow = (name: string, provider: string, purpose: string, duration: string) =>
  `<code class="text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">${name}</code><span class="text-xs text-slate-400 block mt-1">${provider}</span></div><p class="text-xs text-slate-500 leading-relaxed">${purpose}</p><p class="text-xs text-slate-500">${duration}</p>`
const storageRow = (name: string, purpose: string, duration: string) =>
  `<code class="text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">${name}</code></div><p class="text-xs text-slate-500 leading-relaxed">${purpose}</p><p class="text-xs text-slate-500">${duration}</p>`

const HEADING = 'Stored on your device'
// PQB-2 S3: the intro allows for a row that is sent to the site (ab_saved_jobs).
const INTRO = "Some features keep small notes in your browser's storage on this device instead of in a cookie. They stay on your device unless a row below says otherwise, and most of them stay until you clear this website's data in your browser settings."
const OLD_INTRO = "They are not sent to us, and they stay until you clear this website's data in your browser settings."
const ET_LANG_RELOAD: [string, string, string] = ['et-lang-reload', 'Keeps the page loading bar going after you change the language.', 'Removed when the new page has loaded']
const SAVED_JOBS: [string, string, string] = ['ab_saved_jobs', 'An older list of saved jobs. It is sent once to move those jobs into your saved jobs, then removed.', 'Removed once the move has worked']
const STORAGE: Array<[string, string, string]> = [
  ['ab_cookie_consent', 'Remembers your cookie choice.', 'Until you clear it'],
  ['course_progress_*', 'Remembers which free-course lessons you marked complete.', 'Until you clear it'],
  ['sidebar_open_*', 'Remembers which course chapters you left open.', 'Until you clear it'],
  ['ab_job_alerts', 'Keeps the job alert details you entered on this device.', 'Until you clear it'],
  ['ab_visited_listings, jobs-listings-scroll:*', 'Helps the Back link return you to the same place in the job listings.', 'Until you close the tab'],
]

describe('cookie page wording', () => {
  it('sb-* is gone on both brands, from the page and its source', async () => {
    for (const et of [false, true]) {
      const html = await render(et)
      expect(html).not.toContain('sb-*')
      expect(html).not.toContain('Supabase')
      expect(html).not.toContain('Stores authentication tokens for account data.')
    }
    expect(src).not.toContain("'sb-*'")
  })

  it('ab_vid is a necessary cookie on both brands; the provider follows the page brand rule', async () => {
    expect(await render(false)).toContain(cookieRow('ab_vid', 'Accounting Body', 'Remembers the jobs you saved on this device.', '7 days'))
    expect(await render(true)).toContain(cookieRow('ab_vid', 'EthioTax', 'Remembers the jobs you saved on this device.', '7 days'))
  })

  it('et_language and googtrans show on the EthioTax view only', async () => {
    const ab = await render(false)
    const et = await render(true)
    const lang = cookieRow('et_language', 'EthioTax', 'Remembers the language you chose.', '1 year')
    const gt = cookieRow('googtrans', 'Google Translate', 'Shows pages in the language you chose.', 'Until you close your browser')
    expect(count(et, lang)).toBe(1)
    expect(count(et, gt)).toBe(1)
    expect(ab).not.toContain('et_language')
    expect(ab).not.toContain('googtrans')
    expect(ab).not.toContain('Google Translate')
  })

  it('the necessary cookies are in this order: _cf_clearance, ab_vid, x-et-platform (+ the two EthioTax rows)', async () => {
    const names = (html: string) => Array.from(html.matchAll(/<code class="text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">([^<]+)<\/code>/g)).map((m) => m[1])
    expect(names(await render(false)).slice(0, 5)).toStrictEqual(['_cf_clearance', 'ab_vid', 'x-et-platform', '_va_*', '_ga'])
    expect(names(await render(true)).slice(0, 7)).toStrictEqual(['_cf_clearance', 'ab_vid', 'x-et-platform', 'et_language', 'googtrans', '_va_*', '_ga'])
  })

  it('the new section comes right after "Cookies we use", with the exact heading, text and rows, on both brands', async () => {
    for (const et of [false, true]) {
      const html = await render(et)
      expect(count(html, `<h2 class="font-display text-2xl text-navy-950 mb-4">${HEADING}</h2>`)).toBe(1)
      expect(count(html, `<p class="text-slate-500 text-sm leading-relaxed mb-6">${INTRO}</p>`)).toBe(1)
      for (const [name, purpose, duration] of STORAGE) expect(count(html, storageRow(name, purpose, duration))).toBe(1)
      const used = html.indexOf('>Cookies we use</h2>')
      const stored = html.indexOf(`>${HEADING}</h2>`)
      const manage = html.indexOf('>How to manage cookies</h2>')
      expect(used).toBeGreaterThan(-1)
      expect(stored).toBeGreaterThan(used)
      expect(manage).toBeGreaterThan(stored)
      // The future mock and practice keys arrive with the device-progress job.
      expect(html).not.toMatch(/ab_mock_|ab_pq_/)
    }
  })

  it('PQB-2: the new intro, exactly, on both brands; the old sentence is gone', async () => {
    for (const et of [false, true]) {
      const html = await render(et)
      expect(count(html, `<p class="text-slate-500 text-sm leading-relaxed mb-6">${INTRO}</p>`)).toBe(1)
      expect(html).not.toContain(OLD_INTRO)
    }
  })

  it('PQB-2: et-lang-reload is on the EthioTax view only; ab_saved_jobs on both; both exact, after the five PQB-1 rows', async () => {
    const storageNames = (html: string) => {
      const part = html.slice(html.indexOf(`>${HEADING}</h2>`), html.indexOf('>How to manage cookies</h2>'))
      return Array.from(part.matchAll(/<code class="text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">([^<]+)<\/code>/g)).map((m) => m[1])
    }
    const ab = await render(false)
    const et = await render(true)
    expect(ab).not.toContain('et-lang-reload')
    expect(count(et, storageRow(...ET_LANG_RELOAD))).toBe(1)
    expect(count(ab, storageRow(...SAVED_JOBS))).toBe(1)
    expect(count(et, storageRow(...SAVED_JOBS))).toBe(1)
    const five = STORAGE.map(([name]) => name)
    expect(storageNames(ab)).toStrictEqual([...five, 'ab_saved_jobs'])
    expect(storageNames(et)).toStrictEqual([...five, 'et-lang-reload', 'ab_saved_jobs'])
  })

  it('everything else stays: date, analytics rows, metadata', async () => {
    const ab = await render(false)
    expect(ab).toContain('Last updated: November 2026')
    expect(ab).toContain(cookieRow('_va_*', 'Vercel Analytics', 'Privacy-first page view counting. No personal data stored.', 'Session'))
    expect(ab).toContain(cookieRow('_ga', 'Google Analytics', 'Tracks pages visited and time on site (optional).', '2 years'))
    expect(ab).toContain(cookieRow('_cf_clearance', 'Cloudflare', 'Security — proves your browser passed a challenge.', '30 mins'))
    expect(src).toContain("description: brandText(isEthioTax, 'How Accounting Body uses cookies and how to manage your preferences. Last updated November 2026.'),")
  })
})
