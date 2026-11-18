import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Accessibility statement guard (A11-F7). The /accessibility page carries the owner-approved text on both
// brands: an aim (never a conformance claim), what was done and measured, the known limitations, the
// feedback route and the review date. Any change to the statement must change this guard on purpose.
const src = readFileSync(join(process.cwd(), 'app/accessibility/page.tsx'), 'utf8')
const flat = src.replace(/\s+/g, ' ')
const count = (re: RegExp) => (src.match(re) || []).length

const cards: Array<[string, string]> = [
  ['Skip link and page layout', 'Every page has a "Skip to main content" link and one clear main area.'],
  ['Headings', 'Pages use headings in order, so screen-reader users can move around the page easily.'],
  ['Keyboard use', 'You can use the site with a keyboard, with a clear frame showing where you are. This includes the menus on phones.'],
  ['Colours', 'Text colours were changed so text is easier to read against its background.'],
  ['Forms', 'Every field has a label, errors are explained, and the cursor moves to the first problem.'],
  ['Quizzes and mock exams', 'The answer you choose and your result are announced to screen readers.'],
  ['Links', 'Links make sense on their own (for example "View all services", not just "View all").'],
]

const limitations = [
  'Some free-course lessons include YouTube or Vimeo videos. These players are run by those companies.',
  'Our forms use a security check from Cloudflare, which we do not control.',
  'Some animations do not yet follow the "reduce motion" setting on your device.',
  'Internal tools used by our staff are not covered by this statement.',
]

describe('accessibility statement text', () => {
  it('states the aim, the scope and the review date in the owner-approved words', () => {
    expect(flat).toContain('{platformName} is committed to making its website usable by everyone, including people with disabilities.')
    expect(flat).toContain('This statement covers {domain}.')
    expect(flat).toContain('{platformName} aims to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at Level AA.')
    expect(flat).toContain('Last reviewed: November 2026')
    expect(flat).toContain('This statement was last reviewed in November 2026. We will review it at least once a year and after significant changes.')
    expect(flat).toContain('In November 2026 we checked key pages of the site on desktop and phone screen sizes. We used automated checks, moved through the pages with a keyboard in a real browser, and ran colour-contrast scans.')
  })

  it('lists exactly the seven measured items and the four known limitations', () => {
    // CC-1: the cookie banner replaced the first-visit box, so its limitation is gone.
    expect(src).not.toContain('The cookie notice shown on your first visit')
    for (const [title, body] of cards) {
      expect(src).toContain(`title: '${title}'`)
      expect(src).toContain(`body: '${body}'`)
    }
    const standards = src.match(/const standards = \[([\s\S]*?)\n\]/)
    expect(standards).not.toBeNull()
    expect((standards![1].match(/^\s+title: '/gm) || []).length).toBe(cards.length)
    for (const item of limitations) expect(src).toContain(`'${item}'`)
    const known = src.match(/const known = \[([\s\S]*?)\n\]/)
    expect(known).not.toBeNull()
    expect((known![1].match(/^\s+'/gm) || []).length).toBe(limitations.length)
    expect(flat).toContain('These are the limitations we know about:')
  })

  it('carries the owner reply sentence and the contact route, and no other promise', () => {
    expect(flat).toContain('We welcome feedback on the accessibility of {platformName}. If you find a barrier, please tell us. We will reply to accessibility feedback as soon as we can.')
    expect(flat).toContain('If you cannot use any part of this site or need content in a different format, contact us and we will do our best to help.')
    expect(src).toMatch(/<Link href="\/contact"\s/)
    expect(src).not.toMatch(/business days/i)
    expect(src).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/)
  })

  it('makes no unproven or conformance claim', () => {
    for (const re of [/NVDA/, /JAWS/, /VoiceOver/i, /TalkBack/i, /screen[- ]reader test/i, /200%/, /Sanity/i,
      /Next\.js\s*\d/, /WCAG\)?\s*2\.1/, /prefers-reduced-motion/, /works well with/i, /WAVE/,
      /partially/i, /fully conforms/i, /conforms to/i, /complies with/i, /compliant/i, /accessible to everyone/i]) {
      expect(src).not.toMatch(re)
    }
  })

  it('takes every brand mention from one switch, metadata included', () => {
    expect(count(/'Accounting Body'/g)).toBe(1)
    expect(count(/'EthioTax'/g)).toBe(1)
    expect(count(/'accountingbody\.com'/g)).toBe(1)
    expect(count(/'ethiotax\.com'/g)).toBe(1)
    // Brand words anywhere in the file (the isEthioTax flag and the header value aside): only the four switch values.
    const rest = src.replace(/isEthioTax/g, '').replace("=== 'ethiotax'", '')
    const words = rest.match(/accountingbody\.com|ethiotax\.com|Accounting ?Body|Ethio ?Tax/gi) || []
    expect(words.length).toBe(4)
    expect(flat).toMatch(/isEthioTax \? 'EthioTax' : 'Accounting Body'/)
    expect(flat).toMatch(/isEthioTax \? 'ethiotax\.com' : 'accountingbody\.com'/)
    expect(flat).toContain('description: `${platformName} accessibility statement: the standard we aim to meet, what we have done, known limitations and how to contact us.`')
    expect(src).toContain("title: 'Accessibility Statement'")
  })

  it('keeps the page design: headings, classes and the related links', () => {
    expect(src).toContain('<h1 className="font-display text-white mb-3 leading-tight">Accessibility Statement</h1>')
    expect(count(/<h2 className="font-display text-2xl text-navy-950 mb-[46]">/g)).toBe(4)
    expect(count(/<h3 /g)).toBe(2)
    for (const h of ['What we have done', 'Known limitations', 'Feedback and contact', 'How we tested']) expect(src).toContain(`>${h}</h2>`)
    expect(src).toContain('<h3 className="font-semibold text-navy-950 text-sm">{s.title}</h3>')
    expect(src).toContain('<h3 className="font-display text-white text-lg mb-2">Report an accessibility issue</h3>')
    for (const l of ['/privacy-policy', '/terms', '/contact']) expect(src).toContain(`<Link href="${l}"`)
    expect(src).not.toContain('/cookie-policy')
  })
})
