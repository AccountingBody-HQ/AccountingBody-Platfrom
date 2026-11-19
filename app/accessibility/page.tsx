// app/accessibility/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { canonicalMetadata } from '@/lib/canonical'

// One brand switch for the page and its metadata (the brand is keyed on the x-et-platform request header).
async function brand() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  return {
    isEthioTax,
    platformName: isEthioTax ? 'EthioTax' : 'Accounting Body',
    domain: isEthioTax ? 'ethiotax.com' : 'accountingbody.com',
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { platformName } = await brand()
  return {
    title: 'Accessibility Statement',
    description: `${platformName} accessibility statement: the standard we aim to meet, what we have done, known limitations and how to contact us.`,
    ...(await canonicalMetadata('/accessibility')),
  }
}

const standards = [
  {
    title: 'Skip link and page layout',
    body: 'Every page has a "Skip to main content" link and one clear main area.',
  },
  {
    title: 'Headings',
    body: 'Pages use headings in order, so screen-reader users can move around the page easily.',
  },
  {
    title: 'Keyboard use',
    body: 'You can use the site with a keyboard, with a clear frame showing where you are. This includes the menus on phones.',
  },
  {
    title: 'Colours',
    body: 'Text colours were changed so text is easier to read against its background.',
  },
  {
    title: 'Forms',
    body: 'Every field has a label, errors are explained, and the cursor moves to the first problem.',
  },
  {
    title: 'Quizzes and mock exams',
    body: 'The answer you choose and your result are announced to screen readers.',
  },
  {
    title: 'Links',
    body: 'Links make sense on their own (for example "View all services", not just "View all").',
  },
]

const known = [
  'Some free-course lessons include YouTube or Vimeo videos. These players are run by those companies.',
  'Our forms use a security check from Cloudflare, which we do not control.',
  'Some animations do not yet follow the "reduce motion" setting on your device.',
  'Internal tools used by our staff are not covered by this statement.',
]

export default async function AccessibilityPage() {
  const { isEthioTax, platformName, domain } = await brand()
  const heroBg = isEthioTax ? '#1A4731' : '#0C1A3D'
  return (
    <>
      <section className="relative overflow-hidden py-16 md:py-20" style={{ background: heroBg }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[80%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, var(--hero-glow, #3a4f9a) 0%, transparent 70%)' }} />
        </div>
        <div className="container-site relative z-10">
          <span className="eyebrow text-gold-400 mb-4 block">Accessibility</span>
          <h1 className="font-display text-white mb-3 leading-tight">Accessibility Statement</h1>
          <p className="text-white/70 text-sm">Last reviewed: November 2026</p>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container-site">
          <div className="max-w-3xl">

            <div className="border-l-4 border-gold-400 pl-5 mb-10">
              <p className="text-slate-600 text-base leading-relaxed">
                {platformName} is committed to making its website usable by everyone, including people
                with disabilities. This statement covers {domain}. {platformName} aims to meet the Web
                Content Accessibility Guidelines (WCAG) 2.2 at Level AA.
              </p>
            </div>

            <h2 className="font-display text-2xl text-navy-950 mb-6">What we have done</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
              {standards.map(s => (
                <div key={s.title} className="bg-slate-50 rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-teal-600 shrink-0" />
                    <h3 className="font-semibold text-navy-950 text-sm">{s.title}</h3>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>

            <h2 className="font-display text-2xl text-navy-950 mb-4">Known limitations</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-4">
              These are the limitations we know about:
            </p>
            <ul className="space-y-3 mb-10">
              {known.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-gold-50 border border-gold-200 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gold-500" />
                  </span>
                  <p className="text-sm text-slate-500 leading-relaxed">{item}</p>
                </li>
              ))}
            </ul>

            <h2 className="font-display text-2xl text-navy-950 mb-4">Feedback and contact</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              We welcome feedback on the accessibility of {platformName}. If you find a barrier, please
              tell us. We will reply to accessibility feedback as soon as we can.
            </p>

            <div className="bg-navy-950 rounded-xl p-6 relative overflow-hidden mb-10">
              <div className="absolute inset-0 opacity-10 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 80% 20%, #C9982A 0%, transparent 60%)' }} />
              <div className="relative z-10">
                <h3 className="font-display text-white text-lg mb-2">Report an accessibility issue</h3>
                <p className="text-white/60 text-sm leading-relaxed mb-4">
                  If you cannot use any part of this site or need content in a different format,
                  contact us and we will do our best to help.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/contact"
                    className="inline-flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors">
                    Contact us
                  </Link>
                </div>
              </div>
            </div>

            <h2 className="font-display text-2xl text-navy-950 mb-4">How we tested</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-3">
              In November 2026 we checked key pages of the site on desktop and phone screen sizes. We
              used automated checks, moved through the pages with a keyboard in a real browser, and ran
              colour-contrast scans.
            </p>
            <p className="text-slate-500 text-sm leading-relaxed">
              This statement was last reviewed in November 2026. We will review it at least once a
              year and after significant changes.
            </p>

          </div>
        </div>
      </section>

      <section className="bg-slate-50 border-t border-slate-200 py-8">
        <div className="container-site flex flex-wrap gap-4 text-sm text-slate-500">
          <span className="font-medium text-navy-950">Related:</span>
          <Link href="/privacy-policy"  className="hover:text-navy-700 transition-colors">Privacy Policy</Link>
          <Link href="/terms"           className="hover:text-navy-700 transition-colors">Terms of Service</Link>
          <Link href="/contact"         className="hover:text-navy-700 transition-colors">Contact Us</Link>
        </div>
      </section>
    </>
  )
}
