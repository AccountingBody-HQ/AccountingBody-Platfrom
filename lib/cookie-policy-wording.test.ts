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
// PQB-3b S5 (D352): the row gains ab_practice_off and the exact new wording.
const PRACTICE: [string, string, string] = ['ab_mock_v1:*, ab_mock_hist_v1, ab_pq_v1, ab_practice_off', 'Remembers your practice and mock exam results, flagged questions and an unfinished mock exam on this device. If you choose to stop saving below, only that choice is kept.', 'Until you clear it; an unfinished exam is no longer used once its time runs out']
const OLD_PRACTICE_DURATION = 'an unfinished exam is removed when its time runs out'
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
      // PQB-3 S4: the mock and practice keys are listed once, in their own row.
      expect(count(html, storageRow(...PRACTICE))).toBe(1)
      expect(count(html, 'ab_mock_v1')).toBe(1)
      expect(count(html, 'ab_pq_v1')).toBe(1)
      expect(count(html, 'ab_practice_off')).toBe(1)
      expect(html).not.toContain(OLD_PRACTICE_DURATION)
    }
  })

  it('PQB-3: the practice row comes right after sidebar_open_*; AB shows 7 storage rows, ET 8; the other rows unchanged', async () => {
    const storageNames = (html: string) => {
      const part = html.slice(html.indexOf(`>${HEADING}</h2>`), html.indexOf('>How to manage cookies</h2>'))
      return Array.from(part.matchAll(/<code class="text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">([^<]+)<\/code>/g)).map((m) => m[1])
    }
    const ab = await render(false)
    const et = await render(true)
    const before = ['ab_cookie_consent', 'course_progress_*', 'sidebar_open_*']
    const after = ['ab_job_alerts', 'ab_visited_listings, jobs-listings-scroll:*']
    expect(storageNames(ab)).toStrictEqual([...before, PRACTICE[0], ...after, 'ab_saved_jobs'])
    expect(storageNames(et)).toStrictEqual([...before, PRACTICE[0], ...after, 'et-lang-reload', 'ab_saved_jobs'])
    expect(storageNames(ab)).toHaveLength(7)
    expect(storageNames(et)).toHaveLength(8)
    for (const html of [ab, et]) {
      for (const [name, purpose, duration] of STORAGE) expect(count(html, storageRow(name, purpose, duration))).toBe(1)
      expect(count(html, storageRow(...SAVED_JOBS))).toBe(1)
    }
  })

  it('PQB-3: the row names exactly the keys the device store uses', async () => {
    const store = await import('@/lib/practice-store')
    expect(store.MOCK_ATTEMPT_PREFIX).toBe('ab_mock_v1:')
    expect(store.MOCK_HISTORY_KEY).toBe('ab_mock_hist_v1')
    expect(store.PRACTICE_SETS_KEY).toBe('ab_pq_v1')
    expect(store.PRACTICE_OFF_KEY).toBe('ab_practice_off')
    expect(PRACTICE[0]).toBe(`${store.MOCK_ATTEMPT_PREFIX}*, ${store.MOCK_HISTORY_KEY}, ${store.PRACTICE_SETS_KEY}, ${store.PRACTICE_OFF_KEY}`)
  })

  it('PQB-3: the "Forget" button is under the storage table on both brands; its messages are exact', async () => {
    const forget = await import('@/components/ForgetPracticeProgress')
    expect(forget.FORGET_BUTTON_TEXT).toBe('Forget my practice results on this device')
    expect(forget.FORGET_DONE_TEXT).toBe('Your practice results on this device have been removed.')
    expect(forget.FORGET_FAILED_TEXT).toBe("This device's storage could not be changed. You can clear this website's data in your browser settings.")
    // PQB-3b S5: the "Stop saving" button sits beside it (server HTML shows the
    // "Stop saving…" text); the one polite line stays under both.
    const cls = 'inline-flex items-center h-10 px-5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-navy-300 transition-colors'
    const button = `<div class="-mt-6 mb-10"><div class="flex flex-wrap gap-4"><button type="button" class="${cls}">Forget my practice results on this device</button><button type="button" class="${cls}">Stop saving my practice results on this device</button></div><p class="text-xs text-slate-500 mt-3" aria-live="polite"></p></div>`
    for (const et of [false, true]) {
      const html = await render(et)
      expect(count(html, button)).toBe(1)
      const stored = html.indexOf(`>${HEADING}</h2>`)
      const lastRow = html.indexOf('>ab_saved_jobs</code>')
      const at = html.indexOf(button)
      const manage = html.indexOf('>How to manage cookies</h2>')
      expect(stored).toBeLessThan(lastRow)
      expect(lastRow).toBeLessThan(at)
      expect(at).toBeLessThan(manage)
    }
    expect(src).toContain("import ForgetPracticeProgress from '@/components/ForgetPracticeProgress'")
    expect(src).toContain('<ForgetPracticeProgress />')
  })

  it('PQB-3: the button removes only the practice keys and makes no request', async () => {
    const forget = await import('@/components/ForgetPracticeProgress')
    const map = new Map<string, string>([['ab_mock_v1:ab:x', '1'], ['ab_mock_hist_v1', '1'], ['ab_pq_v1', '1'], ['ab_cookie_consent', 'accepted'], ['course_progress_c', '[]'], ['ab_saved_jobs', '[]']])
    const storage = {
      get length() { return map.size },
      key: (i: number) => Array.from(map.keys())[i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, v) },
      removeItem: (k: string) => { map.delete(k) },
    }
    expect(forget.forgetPracticeMessage(storage)).toBe(forget.FORGET_DONE_TEXT)
    expect(Array.from(map.keys()).sort()).toStrictEqual(['ab_cookie_consent', 'ab_saved_jobs', 'course_progress_c'])
    expect(forget.forgetPracticeMessage(null)).toBe(forget.FORGET_FAILED_TEXT)
    const broken = { ...storage, get length(): number { throw new Error('blocked') } }
    expect(forget.forgetPracticeMessage(broken)).toBe(forget.FORGET_FAILED_TEXT)
    const fsrc = readFileSync(join(process.cwd(), 'components/ForgetPracticeProgress.tsx'), 'utf8')
    expect(fsrc).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|confirm\(/)
    expect(fsrc.startsWith("'use client'")).toBe(true)
  })

  it('PQB-3b: "Stop saving" / "Start saving again" — exact texts, lasting choice, Forget keeps it, no request', async () => {
    const forget = await import('@/components/ForgetPracticeProgress')
    expect(forget.STOP_BUTTON_TEXT).toBe('Stop saving my practice results on this device')
    expect(forget.START_BUTTON_TEXT).toBe('Start saving my practice results again')
    expect(forget.STOP_DONE_TEXT).toBe('Your practice results will not be saved on this device, and the saved ones have been removed.')
    expect(forget.START_DONE_TEXT).toBe('Your practice results will be saved on this device again.')
    const map = new Map<string, string>([['ab_mock_v1:ab:x', '1'], ['ab_mock_hist_v1', '1'], ['ab_pq_v1', '1'], ['ab_cookie_consent', 'accepted']])
    const storage = {
      get length() { return map.size },
      key: (i: number) => Array.from(map.keys())[i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, v) },
      removeItem: (k: string) => { map.delete(k) },
    }
    expect(forget.savingChoiceMessage(storage, true)).toBe(forget.STOP_DONE_TEXT)
    expect(Array.from(map.entries()).sort()).toStrictEqual([['ab_cookie_consent', 'accepted'], ['ab_practice_off', '1']])
    expect(forget.forgetPracticeMessage(storage)).toBe(forget.FORGET_DONE_TEXT)
    expect(map.get('ab_practice_off')).toBe('1')
    expect(forget.savingChoiceMessage(storage, false)).toBe(forget.START_DONE_TEXT)
    expect(Array.from(map.keys())).toStrictEqual(['ab_cookie_consent'])
    expect(forget.savingChoiceMessage(null, true)).toBe(forget.FORGET_FAILED_TEXT)
    expect(forget.savingChoiceMessage(null, false)).toBe(forget.FORGET_FAILED_TEXT)
    const broken = { ...storage, setItem: () => { throw new Error('blocked') } }
    expect(forget.savingChoiceMessage(broken, true)).toBe(forget.FORGET_FAILED_TEXT)
    const fsrc = readFileSync(join(process.cwd(), 'components/ForgetPracticeProgress.tsx'), 'utf8')
    // One polite line for every message; the choice is read after mount.
    expect(count(fsrc, 'aria-live="polite"')).toBe(1)
    expect(fsrc).toContain('{off ? START_BUTTON_TEXT : STOP_BUTTON_TEXT}')
    expect(fsrc).toMatch(/useEffect\(\(\) => \{\s+const store = deviceStorage\(\)\s+setOff\(!!store && isPracticeSavingOff\(store\)\)\s+\}, \[\]\)/)
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
    // PQB-3 S4: the practice row sits after sidebar_open_* (the third PQB-1 row).
    const five = STORAGE.map(([name]) => name)
    const six = [...five.slice(0, 3), PRACTICE[0], ...five.slice(3)]
    expect(storageNames(ab)).toStrictEqual([...six, 'ab_saved_jobs'])
    expect(storageNames(et)).toStrictEqual([...six, 'et-lang-reload', 'ab_saved_jobs'])
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
