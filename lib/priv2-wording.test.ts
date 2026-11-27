import * as React from 'react'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// PRIV-2 S5 (D352–D356): every visible sentence of the new privacy policy
// and the changed terms, exactly as the owner approved them, on both sites.

// The pages use the classic JSX transform under vitest (as in lib/et-ten.test.ts).
;(globalThis as { React?: typeof React }).React = React

const H = vi.hoisted(() => ({ map: new Map<string, string>() }))
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => H.map.get(k.toLowerCase()) ?? null }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], has: () => false }),
}))
beforeEach(() => H.map.clear())

const SITES = [
  { et: false, brand: 'Accounting Body', site: 'accountingbody.com' },
  { et: true, brand: 'EthioTax', site: 'ethiotax.com' },
] as const

const PARA = '<p class="text-slate-500 leading-relaxed text-sm">'
const decode = (html: string) =>
  html.replace(/<!-- -->/g, '').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
const visible = (html: string) => decode(html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ')
const count = (text: string, s: string) => text.split(s).length - 1

async function render(file: 'privacy-policy' | 'terms', et: boolean): Promise<string> {
  H.map.clear()
  if (et) H.map.set('x-et-platform', 'ethiotax')
  const mod = file === 'privacy-policy' ? await import('@/app/privacy-policy/page') : await import('@/app/terms/page')
  const Page = mod.default as () => Promise<ReactElement>
  return decode(renderToStaticMarkup(await Page()))
}

type Section = { id: string; nav: string; title: string; body: string[] }

const privacy = (brand: string, site: string, et: boolean): Section[] => [
  { id: 'who-we-are', nav: 'Who we are', title: '1. Who we are', body: [
    `${brand} (${site}) decides how your personal data is used (we are the "controller"). For any privacy question, use our contact form at ${site}/contact.`,
  ] },
  { id: 'what-we-collect', nav: 'What we collect', title: '2. What we collect and why', body: [
    'You can read and practise without giving us any personal details. You do not need an account. We collect personal data only when you send it to us:',
    'Contact form: your name, e-mail, subject and message, so we can reply.',
    'Service enquiries ("Get help"): your name, e-mail, phone if you give it, the service and your message, so we can reply and quote.',
    'Newsletter: your e-mail, after you confirm it by clicking the link we send. We use it to send our weekly e-mail about study, exams and jobs.',
    'Firms and freelancers network: your details and practice details, so we can review your application and list you.',
    'Job seekers: your contact details, experience, the roles you want and your biography, so we can match you with roles. Please do not include health, religion or other sensitive details.',
    'Employers: your company, name, e-mail, phone and the role details, so we can run the search or post the job.',
    'Saved jobs: a random code in a cookie (ab_vid) and the jobs you saved. It does not identify you by name.',
    'Practice progress: kept only on your device, and never sent to us.',
    'Security and running the site: our providers process your IP address and browser details to stop spam and keep the site working. Error reports have personal details removed.',
    'Statistics: we count visits with Vercel Web Analytics, which uses no cookies. If you accept cookies, we also use Google Analytics and Google AdSense.',
  ] },
  { id: 'lawful-bases', nav: 'Lawful bases', title: '3. Our lawful bases', body: [
    'Replying to you and running the service you asked for: steps you asked for, and our legitimate interest in answering. Newsletter, Google Analytics and advertising cookies: your consent, which you can withdraw at any time. Security, error reports and visit counting: our legitimate interest in keeping the site safe and working.',
  ] },
  { id: 'third-parties', nav: 'Who we share with', title: '4. Who we share it with', body: [
    'We do not sell your data. Our service providers are Supabase (database), Vercel (hosting and statistics), Resend (sending e-mails), Cloudflare (security check on forms) and Sentry (error reports). Google (only if you accept cookies), WhatsApp (only if you message us there) and Lemon Squeezy (job-post payments) make their own decisions about the data they receive. If you register as a job seeker, we may share your profile with an employer, in the UK or abroad, but we will always tell you first.',
    ...(et ? [ET_ONLY] : []),
  ] },
  { id: 'transfers', nav: 'Transfers', title: '5. Transfers outside the UK', body: [
    "Some providers store data in the United States or elsewhere. They use the UK's approved safeguards.",
  ] },
  { id: 'cookies', nav: 'Cookies', title: '6. Cookies', body: [
    'See our Cookie Policy. You can change your choice at any time with "Cookie settings" at the bottom of every page.',
  ] },
  { id: 'retention', nav: 'How long we keep it', title: '7. How long we keep it', body: [
    'Unconfirmed newsletter sign-ups: 7 days.',
    'Saved jobs: 7 days.',
    'Newsletter: until you unsubscribe, then deleted within 30 days.',
    'Contact messages and enquiries: 24 months after our last contact.',
    'Job seeker profiles: 24 months after your last update.',
    'Firm applications: while you are listed, plus 12 months.',
  ] },
  { id: 'your-rights', nav: 'Your rights', title: '8. Your rights', body: [
    'You can ask for a copy of your data, or ask us to correct it, delete it, restrict or object to its use, or move it. You can also withdraw consent. To leave the newsletter, use "Unsubscribe" at the bottom of every page. For anything else, use our contact form. We reply within one month.',
  ] },
  { id: 'children', nav: 'Children', title: '9. Children', body: [
    'Our learning pages are open to everyone. The job, recruitment and network services are for adults (18 and over).',
  ] },
  { id: 'contact', nav: 'Contact', title: '10. Contact and complaints', body: [
    "Use our contact form. If you are unhappy, you can complain to the Information Commissioner's Office at ico.org.uk.",
  ] },
]
const ET_ONLY = 'On EthioTax, Google Translate is used only if you choose Amharic or Oromo.'

// The whole terms text: the five approved paragraphs, and every other
// sentence unchanged apart from the brand.
const terms = (brand: string, site: string): Omit<Section, 'nav'>[] => [
  { id: 'acceptance', title: '1. Acceptance of terms', body: [
    `By accessing or using ${site} ("the Site"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the Site.`,
    'These Terms apply to everyone who visits or uses the Site, including job seekers, employers and firms who send us their details. We may update these Terms at any time. Continued use of the Site after changes means you accept the updated Terms.',
  ] },
  { id: 'use-of-site', title: '2. Use of the site', body: [
    `You may use ${brand} for lawful, personal, and non-commercial educational purposes. You must not use the Site in any way that is unlawful, harmful, or that could damage our reputation.`,
    'You must not attempt to gain unauthorised access to any part of the Site, its servers, or any database connected to it. You must not use automated tools to scrape, harvest, or copy content from the Site without prior written permission.',
  ] },
  { id: 'accounts', title: '3. Registration', body: [
    'You do not need an account to use our learning content. If you register as a job seeker, employer or firm, you must give accurate information. We may remove a registration that gives false information or breaks these Terms.',
  ] },
  { id: 'subscriptions', title: '4. Payments', body: [
    'Our learning content is free to use. If we ever charge for a service, the price and terms will be shown before you pay.',
  ] },
  { id: 'intellectual-property', title: '5. Intellectual property', body: [
    `All original content on ${brand} — including study notes, practice questions, articles, and guides — is owned by ${brand} or its content contributors and is protected by copyright.`,
    'You may not reproduce, redistribute, or republish any content without prior written permission. You may print or download content for your own personal, non-commercial study use only.',
    `${brand} is not affiliated with, endorsed by, or officially connected to ACCA, CIMA, AAT, ICAEW, or any other professional body. All qualification names are trademarks of their respective owners.`,
  ] },
  { id: 'disclaimer', title: '6. Content disclaimer', body: [
    `Content on ${brand} is provided for educational purposes only. It does not constitute professional accounting, tax, legal, or financial advice. See our full Disclaimer for details.`,
    'We make every effort to keep content accurate and up to date, but we cannot guarantee that all content reflects the very latest syllabus or regulatory requirements. Always verify against official sources.',
  ] },
  { id: 'limitation', title: '7. Limitation of liability', body: [
    `To the fullest extent permitted by law, ${brand} shall not be liable for any indirect, incidental, special, or consequential loss arising from your use of the Site or its content.`,
    'Our total liability to you for any claim arising from your use of the Site shall not exceed the amount you paid us in the 12 months preceding the claim, or £50, whichever is greater.',
  ] },
  { id: 'termination', title: '8. Termination', body: [
    'We reserve the right to suspend or terminate your access to the Site at any time, with or without notice, if we reasonably believe you have breached these Terms.',
    'You can ask us to remove your registration or your details at any time through our contact form. We will handle your data as our Privacy Policy explains.',
  ] },
  { id: 'governing-law', title: '9. Governing law', body: [
    'These Terms are governed by the laws of England and Wales. Any disputes arising from these Terms or your use of the Site shall be subject to the exclusive jurisdiction of the courts of England and Wales.',
  ] },
  { id: 'contact', title: '10. Contact', body: [
    `If you have any questions about these Terms, please use our contact form at ${site}/contact.`,
    'These Terms were last updated in November 2026.',
  ] },
]

const BANNED = ['authentication', 'Account data', 'login', 'noreply', 'privacy@', 'March 2026', 'Registered office', 'Company number', 'ICO registration']

function expectNoBanned(html: string) {
  const text = visible(html)
  expect(text).not.toContain('@')
  expect(text).not.toMatch(/\bPro\b/)
  for (const word of BANNED) expect(text.toLowerCase(), word).not.toContain(word.toLowerCase())
}

describe('privacy policy (both brands)', () => {
  for (const { et, brand, site } of SITES) {
    describe(brand, () => {
      it('every section, title and paragraph is exact, one paragraph per item, in order', async () => {
        const html = await render('privacy-policy', et)
        const want = privacy(brand, site, et)
        const blocks = want.map((s) =>
          `<div id="${s.id}" class="scroll-mt-8"><h2 class="font-display text-xl text-navy-950 mb-3">${s.title}</h2><div class="space-y-3">${s.body.map((p) => `${PARA}${p}</p>`).join('')}</div></div>`,
        )
        expect(count(html, blocks.join(''))).toBe(1)
        expect(count(html, PARA)).toBe(want.reduce((n, s) => n + s.body.length, 0))
      })

      it('the Contents list is built from the sections: labels and #id links', async () => {
        const html = await render('privacy-policy', et)
        const links = Array.from(html.matchAll(/<a href="#([a-z-]+)"[^>]*>([^<]+)<\/a>/g), (m) => [m[1], m[2]])
        expect(links).toStrictEqual(privacy(brand, site, et).map((s) => [s.id, s.nav]))
        for (const s of privacy(brand, site, et)) {
          expect(count(html, `href="#${s.id}"`)).toBe(1)
          expect(count(html, `id="${s.id}"`)).toBe(1)
        }
      })

      it(`the EthioTax-only sentence is ${et ? 'present once' : 'absent'}`, async () => {
        expect(count(await render('privacy-policy', et), ET_ONLY)).toBe(et ? 1 : 0)
      })

      it('hero, intro and boxes are unchanged; no e-mail address or old wording', async () => {
        const html = await render('privacy-policy', et)
        expect(count(html, '<p class="text-white/70 text-sm">Last updated: November 2026</p>')).toBe(1)
        expect(visible(html)).toContain(`${brand} is committed to protecting your privacy. This policy explains what personal data we collect, how we use it, and the rights you have over it.`)
        expect(count(html, '>Questions?</h2>')).toBe(1)
        expect(count(html, 'Related:')).toBe(1)
        expectNoBanned(html)
        expect(html).not.toMatch(/<(ul|ol|li|strong|b)[ >]/)
      })
    })
  }

  it('the metadata is unchanged', async () => {
    const { generateMetadata } = await import('@/app/privacy-policy/page')
    const m = await generateMetadata()
    expect(m.title).toBe('Privacy Policy')
    expect(m.description).toBe('How we collect, use, and protect your personal data. Last updated November 2026.')
  })
})

describe('terms (both brands)', () => {
  for (const { et, brand, site } of SITES) {
    describe(brand, () => {
      it('the whole text is exact (five approved paragraphs, the rest with the brand swapped)', async () => {
        const html = await render('terms', et)
        const want = terms(brand, site)
        const blocks = want.map((s) =>
          `<div id="${s.id}" class="scroll-mt-8"><h2 class="font-display text-xl text-navy-950 mb-4">${s.title}</h2><div class="space-y-3">${s.body.map((p) => `${PARA}${p}</p>`).join('')}</div></div>`,
        )
        expect(count(html, blocks.join(''))).toBe(1)
        expect(count(html, PARA)).toBe(want.reduce((n, s) => n + s.body.length, 0))
      })

      it('the Contents links equal the section ids and titles', async () => {
        const html = await render('terms', et)
        const links = Array.from(html.matchAll(/<a href="#([a-z-]+)"[^>]*>\s*([^<]+?)\s*<\/a>/g), (m) => [m[1], m[2]])
        expect(links).toStrictEqual(terms(brand, site).map((s) => [s.id, s.title]))
      })

      it('hero, intro and boxes; no e-mail address, no old wording, no other brand', async () => {
        const html = await render('terms', et)
        const text = visible(html)
        expect(count(html, '<p class="text-white/70 text-sm">Last updated: November 2026</p>')).toBe(1)
        expect(text).toContain(`Please read these Terms of Service carefully before using ${brand}. By using the Site you agree to be bound by these Terms.`)
        expect(count(text, '4. Payments')).toBe(2)
        expect(text).not.toContain('Subscriptions and payments')
        expect(count(text, `${site}/contact`)).toBe(1)
        expect(count(html, '>Questions about these Terms?</h2>')).toBe(1)
        expectNoBanned(html)
        if (et) {
          expect(text).not.toContain('Accounting Body')
          expect(text).not.toContain('accountingbody.com')
        } else {
          expect(text).not.toContain('EthioTax')
          expect(text).not.toContain('ethiotax.com')
        }
        expect(html).not.toMatch(/<(ul|ol|li|strong|b)[ >]/)
      })

      it('the metadata description names the brand and November 2026', async () => {
        H.map.clear()
        if (et) H.map.set('x-et-platform', 'ethiotax')
        const { generateMetadata } = await import('@/app/terms/page')
        const m = await generateMetadata()
        expect(m.title).toBe('Terms of Service')
        expect(m.description).toBe(`The terms and conditions governing your use of ${brand}. Last updated November 2026.`)
      })
    })
  }
})
