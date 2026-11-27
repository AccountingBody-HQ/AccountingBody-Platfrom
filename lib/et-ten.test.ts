import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import * as React from 'react'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// The components use the classic JSX transform under vitest (as in lib/et-brand-surfaces.test.ts).
;(globalThis as { React?: typeof React }).React = React

// ET-10 guards (BOARD #8 part 2; owner decisions D248, D257, D272, D274):
// the EthioTax view renders the EthioTax wording the ethiotax.com proxy used
// to produce by rewriting the page — EthioTax names, ETICPA labels and
// /study/eticpa links — through one wording source, plus the WhatsApp button.
// Form and filter values never change, e-mail addresses stay the
// accountingbody.com ones (D274) and the Accounting Body view is unchanged.

const H = vi.hoisted(() => ({ map: new Map<string, string>() }))
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => H.map.get(k.toLowerCase()) ?? null }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], has: () => false }),
}))

const read = (f: string) => readFileSync(f, 'utf8')
const view = (et: boolean) => {
  H.map.clear()
  if (et) H.map.set('x-et-platform', 'ethiotax')
}
beforeEach(() => H.map.clear())

const wording = () => import('@/lib/et-wording')

// The ethiotax.com proxy's text pairs, in its order, without its domain pair
// (website lines and e-mail addresses are not wording).
const PROXY_TEXT_PAIRS: Array<[string, string]> = [
  ['/study/icaew', '/study/eticpa'],
  ['ICAEW / ACA', 'ETICPA / CPA'],
  ['ICAEW/ACA', 'ETICPA/CPA'],
  ['ICAEW', 'ETICPA'],
  ['ACCOUNTING BODY', 'ETHIOTAX'],
  ['Accounting Body', 'EthioTax'],
  ['AccountingBody', 'EthioTax'],
  ['@accountingbody', '@ethiotax'],
  ['@AccountingBody', '@EthioTax'],
]
const proxyText = (s: string) => PROXY_TEXT_PAIRS.reduce((t, [a, b]) => t.split(a).join(b), s)

describe('G1 the EthioTax wording function', () => {
  it('applies each proxy pair on its own', async () => {
    const { etWording } = await wording()
    for (const [a, b] of PROXY_TEXT_PAIRS) expect(etWording(`x ${a} y`), a).toBe(`x ${b} y`)
  })
  it('equals the proxy result on a combined string, pairs in the proxy order', async () => {
    const { etWording, ET_WORDING_PAIRS } = await wording()
    expect(ET_WORDING_PAIRS).toEqual(PROXY_TEXT_PAIRS)
    const s = 'ACCOUNTING BODY: Accounting Body (AccountingBody) for ICAEW / ACA, ICAEW/ACA and ICAEW — /study/icaew, @accountingbody, @AccountingBody'
    expect(etWording(s)).toBe(proxyText(s))
    expect(etWording(s)).toBe('ETHIOTAX: EthioTax (EthioTax) for ETICPA / CPA, ETICPA/CPA and ETICPA — /study/eticpa, @ethiotax, @EthioTax')
  })
  it('never applies the domain pair and never changes an e-mail address', async () => {
    const { etWording } = await wording()
    expect(etWording('Visit accountingbody.com today')).toBe('Visit accountingbody.com today')
    for (const e of ['info@accountingbody.com', 'privacy@accountingbody.com', 'noreply@accountingbody.com', 'Info@AccountingBody.com']) {
      expect(etWording(`Write to ${e}.`), e).toBe(`Write to ${e}.`)
    }
  })
  it('is idempotent on its own output', async () => {
    const { etWording } = await wording()
    const once = etWording('Accounting Body for ICAEW / ACA and ICAEW')
    expect(etWording(once)).toBe(once)
  })
  it('brandText returns the text unchanged on the Accounting Body view', async () => {
    const { brandText } = await wording()
    const s = 'Accounting Body for ICAEW / ACA — /study/icaew'
    expect(brandText(false, s)).toBe(s)
    expect(brandText(true, s)).toBe('EthioTax for ETICPA / CPA — /study/eticpa')
  })
})

// Every class-(b) site of the ET-10 census: the EthioTax view renders the
// proxy's string, the Accounting Body view keeps its own.
const CALC_HERO = '24 free instant calculators for ACCA, CIMA, ICAEW and AAT students. Results update as you type. No signup required.'
const CALC_NOTE = 'These calculators use standard accounting formulas and are suitable for ACCA, CIMA, ICAEW and AAT exam preparation. For professional decisions always consult a qualified accountant.'
const COOKIE_INTRO = 'Cookies are small text files stored on your device. This policy explains every cookie Accounting Body uses and how to control your preferences.'
const COOKIE_PURPOSE = 'Identifies which platform (Accounting Body or EthioTax) the visitor is using. No personal data stored.'
const FC_TRUST = 'Every lesson is written or reviewed by ACCA, CIMA, or ICAEW members — not generic content writers.'
const LISTINGS_LD = 'Find accounting and finance jobs globally. Roles for ACCA, CIMA, ICAEW, CPA and AAT qualified professionals.'

async function renderCalculators(et: boolean) {
  const { EthioTaxViewProvider } = await import('@/components/EthioTaxViewContext')
  const Page = (await import('@/app/calculators/page')).default
  return renderToStaticMarkup(EthioTaxViewProvider({ isEthioTax: et, children: createElement(Page) }))
}
const decode = (html: string) => html.replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"')

describe('G2 class-(b) sites render the proxy string on the EthioTax view only', () => {
  it('/calculators: hero and note', async () => {
    const et = decode(await renderCalculators(true))
    const ab = decode(await renderCalculators(false))
    expect(et).toContain(proxyText(CALC_HERO))
    expect(et).toContain(proxyText(CALC_NOTE))
    expect(et).not.toContain('ICAEW')
    expect(ab).toContain(CALC_HERO)
    expect(ab).toContain(CALC_NOTE)
  })
  it('/cookie-policy: intro and provider cell (the purpose cell is left for the owner)', async () => {
    const Page = (await import('@/app/cookie-policy/page')).default as () => Promise<ReactElement>
    view(true)
    const et = decode(renderToStaticMarkup(await Page()))
    view(false)
    const ab = decode(renderToStaticMarkup(await Page()))
    expect(et).toContain('This policy explains every cookie EthioTax uses and how to control your preferences.')
    expect(et).toContain('>EthioTax<')
    expect(et).not.toContain('>Accounting Body<')
    expect(et).toContain(COOKIE_PURPOSE)
    expect(ab).toContain(COOKIE_INTRO)
    expect(ab).toContain('>Accounting Body<')
    expect(ab).toContain(COOKIE_PURPOSE)
  })
  it('/free-courses: the trust point goes through the wording source', () => {
    const s = read('app/free-courses/page.tsx')
    expect(s).toContain(FC_TRUST)
    expect(s).toContain('<p className="text-xs text-slate-500 leading-relaxed">{brandText(isEthioTax, w.body)}</p>')
    expect(s.split('{w.body}').length - 1).toBe(0)
  })
  it('/jobs/listings JSON-LD: description per view, url stays the accountingbody.com owner (D272)', async () => {
    const { JobListingsStructuredData } = await import('@/app/jobs/listings/structured-data')
    const ld = (et: boolean) => JSON.parse(renderToStaticMarkup(createElement(JobListingsStructuredData, { isEthioTax: et })).replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''))
    expect(ld(true).description).toBe(proxyText(LISTINGS_LD))
    expect(ld(false).description).toBe(LISTINGS_LD)
    expect(ld(true).url).toBe('https://accountingbody.com/jobs/listings')
    expect(ld(false).url).toBe('https://accountingbody.com/jobs/listings')
  })
  it('/jobs/listings filter: the label follows the view, the value stays the Accounting Body key', () => {
    const s = read('app/jobs/listings/JobListingsClient.tsx')
    expect(s).toContain("const QUALIFICATIONS = ['ACCA', 'CIMA', 'ICAEW', 'CPA', 'AAT', 'CFA'] as const")
    expect(s).toMatch(/key=\{q\}\s+label=\{brandText\(isEthioTax, q\)\}\s+checked=\{filters\.qualifications\.includes\(q\)\}/)
    expect(s).toContain('qualifications: toggleInArray(filters.qualifications, q)')
  })
  it('/search no-results links: ETICPA → /study/eticpa on the EthioTax view', () => {
    const s = read('app/search/SearchClient.tsx')
    expect(s).toContain("{(isEthioTax ? ['ACCA', 'CIMA', 'AAT', 'ETICPA'] : ['ACCA', 'CIMA', 'AAT', 'ICAEW']).map(body => (")
  })
})

// The files ET-10 changed for wording: no AB literal of the census is left
// outside the wording source or an Accounting Body branch.
const SITES: Array<[string, string]> = [
  ['app/calculators/page.tsx', CALC_HERO],
  ['app/calculators/page.tsx', CALC_NOTE],
  ['app/cookie-policy/page.tsx', COOKIE_INTRO],
  ['app/cookie-policy/page.tsx', "How Accounting Body uses cookies and how to manage your preferences. Last updated November 2026."],
  ['app/jobs/listings/page.tsx', 'Find accounting and finance jobs globally. Search roles for ACCA, CIMA, ICAEW, CPA and AAT qualified professionals across UK, US, Australia, Canada, Singapore and Africa.'],
  ['app/jobs/listings/structured-data.tsx', LISTINGS_LD],
  ['app/jobs/post-a-job/page.tsx', 'Reach thousands of qualified ACCA, CIMA, ICAEW and AAT professionals.'],
  ['app/study/page.tsx', 'Comprehensive study notes for ACCA, CIMA, AAT, and ICAEW — the four leading professional accounting qualifications.'],
]
describe('G3 no un-branched class-(b) literal left in the changed files', () => {
  for (const [file, literal] of SITES) {
    it(`${file}: ${literal.slice(0, 40)}…`, () => {
      const lines = read(file).split('\n')
      const at = lines.map((l, i) => (l.includes(literal) ? i : -1)).filter((i) => i >= 0)
      expect(at.length, 'literal present').toBeGreaterThan(0)
      for (const i of at) {
        const near = lines.slice(Math.max(0, i - 2), i + 1).join('\n')
        expect(near, `${file}:${i + 1}`).toMatch(/brandText\(|etWording\(/)
      }
    })
  }
})

describe('G4 values stay data; the intended corrections are pinned', () => {
  it('post-a-job, find-work, freelancing-pathways option values are unchanged', async () => {
    const { etWording } = await wording()
    expect(read('app/jobs/post-a-job/PostAJobClient.tsx')).toContain("const QUALIFICATIONS = ['ACCA', 'CIMA', 'ICAEW', 'AAT', 'CPA', 'ETICPA', 'ATT', 'None required']")
    for (const f of ['app/jobs/find-work/FindWorkClient.tsx', 'app/freelancing-pathways/FreelancingPathwaysClient.tsx']) {
      expect(read(f), f).toContain("const qualificationOptions = ['ACA / ICAEW','ACCA','CIMA','AAT','ETICPA / CPA','CPA (US)','CA','Degree (Accounting/Finance)','Other']")
      expect(read(f), f).not.toMatch(/etWording|brandText/)
    }
    // kind 1: the blind swap would show two "ETICPA" options in the post-a-job list
    expect(etWording('ICAEW')).toBe('ETICPA')
    expect(read('app/jobs/post-a-job/PostAJobClient.tsx')).not.toMatch(/etWording|brandText/)
  })
  it('kind 2: "ACA / ICAEW" stays beside its own description on /jobs/ethiopian-professionals', async () => {
    const { etWording } = await wording()
    expect(read('app/jobs/ethiopian-professionals/page.tsx')).toContain("{ q: 'ACA / ICAEW', d: 'Institute of Chartered Accountants England & Wales' },")
    expect(etWording('ACA / ICAEW')).toBe('ACA / ETICPA')
  })
  it('kind 2: the /study/icaew page keeps its ICAEW name beside its description; its filter links keep their address', async () => {
    const { etWording } = await wording()
    const s = read('app/study/[category]/page.tsx')
    expect(s).toContain("icaew: { name: 'ICAEW', description: 'Institute of Chartered Accountants — ACA qualification pathway.'")
    expect(s).not.toMatch(/etWording|brandText/)
    expect(etWording('/study/icaew')).toBe('/study/eticpa')
  })
})

describe('G5 the 404 page quick links (K4)', () => {
  it('EthioTax view: ETICPA → /study/eticpa; Accounting Body view unchanged', async () => {
    const NotFound = (await import('@/app/not-found')).default as () => Promise<ReactElement>
    view(true)
    const et = renderToStaticMarkup(await NotFound())
    view(false)
    const ab = renderToStaticMarkup(await NotFound())
    expect(et).toContain('href="/study/eticpa"')
    expect(et).toMatch(/>ETICPA</)
    expect(et).not.toContain('/study/icaew')
    expect(et).not.toMatch(/>ICAEW</)
    expect(ab).toContain('href="/study/icaew"')
    expect(ab).toMatch(/>ICAEW</)
    expect(ab).not.toContain('/study/eticpa')
  })
})

describe('G6 the EthioTax home ETICPA card (K3)', () => {
  it('the ETICPA card comes first and no ICAEW card shows on the EthioTax view', async () => {
    const { etWording } = await wording()
    const s = read('app/page.tsx')
    expect(s).toContain("code:        'ETICPA',")
    expect(s).toContain(`description: "Ethiopia's national accountancy body — CPA and ATQ qualifications for finance professionals.",`)
    expect(s).toContain("accent:      'bg-[#1A4731]',")
    expect(s).toContain("badgeBg:     'bg-[#f0f7f4]',")
    expect(s).toContain("badgeText:   'text-[#1A4731]',")
    expect(s).toContain("highlights:  ['CPA Professional', 'ATQ Foundation', 'ATQ Advanced', 'Ethiopian Taxation'],")
    expect(s).toContain("? [eticpaCard, ...qualificationPaths.filter(q => q.slug !== 'icaew')]")
    expect(s).toContain('Browse {q.code} notes')
    expect(etWording('ICAEW')).toBe('ETICPA')
  })
})

const WA_PATH_SHA16 = '281335ac991e0f1a'
describe('G7 the WhatsApp button (K5)', () => {
  it('renders exactly one plain link with the proxy attributes and glyph', async () => {
    const { EthioTaxWhatsAppButton, ET_WHATSAPP_GLYPH } = await import('@/components/layout/EthioTaxWhatsAppButton')
    const html = renderToStaticMarkup(createElement(EthioTaxWhatsAppButton))
    expect(html.match(/<a /g)?.length).toBe(1)
    expect(html).toMatch(/^<a id="et-wa-btn" href="\/wa" target="_blank" rel="noopener noreferrer" aria-label="Chat with EthioTax on WhatsApp"><svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="30" height="30" viewBox="0 0 24 24" fill="white"><path d="[^"]+"><\/path><\/svg><\/a>$/)
    expect(ET_WHATSAPP_GLYPH.length).toBe(1104)
    expect(createHash('sha256').update(ET_WHATSAPP_GLYPH).digest('hex').slice(0, 16)).toBe(WA_PATH_SHA16)
    expect(html).toContain(`d="${ET_WHATSAPP_GLYPH}"`)
    expect(html).not.toMatch(/\son[a-z]+=/i)
    expect(html).not.toContain('style=')
  })
  it('is a server component with no next/link, no script and no handler', () => {
    const s = read('components/layout/EthioTaxWhatsAppButton.tsx')
    expect(s).not.toContain("'use client'")
    expect(s).not.toContain('next/link')
    expect(s).not.toMatch(/\bon[A-Z][a-zA-Z]+=|prefetch|<script/i)
  })
  it('the root layout mounts it once, at the end of <body>, on the EthioTax view only', () => {
    const s = read('app/layout.tsx')
    expect(s).toContain("import { EthioTaxWhatsAppButton } from '@/components/layout/EthioTaxWhatsAppButton'")
    expect(s.split('<EthioTaxWhatsAppButton').length - 1).toBe(1)
    expect(s).toMatch(/<SpeedInsights \/>\n\s+\{isEthioTax && <EthioTaxWhatsAppButton \/>\}\n\s+<\/body>/)
    expect(s.indexOf('<EthioTaxWhatsAppButton')).toBeGreaterThan(s.indexOf('</main>'))
  })
  it('the box, hover and keyboard-focus styles are CSS only, scoped to #et-wa-btn', () => {
    const css = read('app/globals.css')
    const block = (sel: string) => {
      const i = css.indexOf('\n' + sel + ' {')
      expect(i, sel).toBeGreaterThanOrEqual(0)
      return css.slice(i, css.indexOf('}', i))
    }
    const base = block('#et-wa-btn')
    for (const d of ['position: fixed;', 'bottom: 150px;', 'right: 16px;', 'z-index: 9999;', 'display: flex;', 'align-items: center;', 'justify-content: center;',
      'width: 60px;', 'height: 60px;', 'border-radius: 50%;', 'background-color: #25D366;', 'box-shadow: 0 4px 16px rgba(37, 211, 102, 0.4);',
      'transition: transform 0.2s ease, box-shadow 0.2s ease;', 'text-decoration: none;']) expect(base, d).toContain(d)
    const hover = block('#et-wa-btn:hover, #et-wa-btn:focus-visible')
    expect(hover).toContain('transform: scale(1.1);')
    expect(hover).toContain('box-shadow: 0 6px 24px rgba(37, 211, 102, 0.6);')
    const focus = block('#et-wa-btn:focus-visible')
    expect(focus).toContain('outline: 2px solid #ffffff;')
    expect(focus).toContain('box-shadow: 0 0 0 6px #0C1A3D, 0 6px 24px rgba(37, 211, 102, 0.6);')
  })
})

describe('G9 e-mail addresses (D274): no ethiotax.com address from the app', () => {
  it('no public page or component renders an ethiotax.com e-mail address', () => {
    const files = execFileSync('git', ['ls-files', 'app', 'components'], { encoding: 'utf8' }).split('\n').filter((f) => /\.(tsx?|mdx?)$/.test(f) && !/\.test\./.test(f))
    const hits = files.filter((f) => /[a-z0-9.+-]+@ethiotax\.com/i.test(read(f)))
    expect(hits).toEqual([])
  })
  // PRIV-2 S1 (D355): the privacy policy shows no e-mail address any more;
  // the two remaining EthioTax-view addresses are the accountingbody.com ones.
  it('the EthioTax-view addresses are the accountingbody.com ones; the privacy policy has none', () => {
    expect(read('app/privacy-policy/page.tsx')).not.toMatch(/[a-z0-9.+-]+@[a-z0-9-]+\./i)
    expect(read('app/jobs/guarantee/page.tsx')).toContain("const contactEmail = 'info@accountingbody.com'")
    expect(read('app/jobs/ethiopian-professionals/page.tsx')).toContain('<a href="mailto:info@accountingbody.com" className="text-white/70 hover:text-white/70 underline">info@accountingbody.com</a>')
  })
})

type Gen = () => Promise<{ description?: string | null; title?: unknown }>
const META: Array<[string, () => Promise<Gen>, string]> = [
  ['/study', async () => (await import('@/app/study/page')).generateMetadata as Gen, 'Comprehensive study notes for ACCA, CIMA, AAT, and ICAEW — the four leading professional accounting qualifications.'],
  ['/jobs/listings', async () => (await import('@/app/jobs/listings/page')).generateMetadata as Gen, 'Find accounting and finance jobs globally. Search roles for ACCA, CIMA, ICAEW, CPA and AAT qualified professionals across UK, US, Australia, Canada, Singapore and Africa.'],
  ['/cookie-policy', async () => (await import('@/app/cookie-policy/page')).generateMetadata as Gen, 'How Accounting Body uses cookies and how to manage your preferences. Last updated November 2026.'],
]
describe('G10 page metadata: Accounting Body unchanged, EthioTax = the proxy string', () => {
  for (const [path, load, ab] of META) {
    it(path, async () => {
      const { etWording } = await wording()
      const gen = await load()
      view(false)
      expect((await gen()).description).toBe(ab)
      view(true)
      expect((await gen()).description).toBe(etWording(ab))
      expect((await gen()).description).toBe(proxyText(ab))
    })
  }
  it('/jobs/post-a-job', async () => {
    const { etWording } = await wording()
    const gen = (await import('@/app/jobs/post-a-job/page')).generateMetadata as Gen
    view(false)
    expect((await gen()).description).toBe('Post your accounting or finance job vacancy on AccountingBody. Reach thousands of qualified ACCA, CIMA, ICAEW and AAT professionals. Listings reviewed and live within 24 hours.')
    view(true)
    expect((await gen()).description).toBe(etWording('Post your accounting or finance job vacancy on EthioTax. Reach thousands of qualified ACCA, CIMA, ICAEW and AAT professionals. Listings reviewed and live within 24 hours.'))
    expect((await gen()).description).toBe('Post your accounting or finance job vacancy on EthioTax. Reach thousands of qualified ACCA, CIMA, ETICPA and AAT professionals. Listings reviewed and live within 24 hours.')
  })
})
