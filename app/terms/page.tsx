// app/terms/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { canonicalMetadata } from '@/lib/canonical'

// The brand comes from the x-et-platform header, as on the privacy policy.
async function termsBrand() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  return {
    isEthioTax,
    platformName: isEthioTax ? 'EthioTax' : 'Accounting Body',
    platformUrl: isEthioTax ? 'ethiotax.com' : 'accountingbody.com',
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { platformName } = await termsBrand()
  return {
    title: 'Terms of Service',
    description: `The terms and conditions governing your use of ${platformName}. Last updated November 2026.`,
    ...(await canonicalMetadata('/terms')),
  }
}

// Owner-approved wording (PRIV-2, D356). The section ids stay the same
// (inbound links), including 'subscriptions' for "4. Payments".
function termsSections(platformName: string, platformUrl: string, isEthioTax: boolean) {
  return [
    {
      id: 'acceptance',
      title: '1. Acceptance of terms',
      body: [
        `By accessing or using ${platformUrl} ("the Site"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the Site.`,
        'These Terms apply to everyone who visits or uses the Site, including job seekers, employers and firms who send us their details. We may update these Terms at any time. Continued use of the Site after changes means you accept the updated Terms.',
        ...(isEthioTax ? [] : ['The Site is run by Accounting Body Ltd, a company registered in England and Wales (company number 17014642). Registered office: 71-75 Shelton Street, Covent Garden, London WC2H 9JQ, United Kingdom.']),
      ],
    },
    {
      id: 'use-of-site',
      title: '2. Use of the site',
      body: [
        `You may use ${platformName} for lawful, personal, and non-commercial educational purposes. You must not use the Site in any way that is unlawful, harmful, or that could damage our reputation.`,
        'You must not attempt to gain unauthorised access to any part of the Site, its servers, or any database connected to it. You must not use automated tools to scrape, harvest, or copy content from the Site without prior written permission.',
      ],
    },
    {
      id: 'accounts',
      title: '3. Registration',
      body: [
        'You do not need an account to use our learning content. If you register as a job seeker, employer or firm, you must give accurate information. We may remove a registration that gives false information or breaks these Terms.',
      ],
    },
    {
      id: 'subscriptions',
      title: '4. Payments',
      body: [
        'Our learning content is free to use. If we ever charge for a service, the price and terms will be shown before you pay.',
      ],
    },
    {
      id: 'intellectual-property',
      title: '5. Intellectual property',
      body: [
        `All original content on ${platformName} — including study notes, practice questions, articles, and guides — is owned by ${platformName} or its content contributors and is protected by copyright.`,
        'You may not reproduce, redistribute, or republish any content without prior written permission. You may print or download content for your own personal, non-commercial study use only.',
        `${platformName} is not affiliated with, endorsed by, or officially connected to ACCA, CIMA, AAT, ICAEW, or any other professional body. All qualification names are trademarks of their respective owners.`,
      ],
    },
    {
      id: 'disclaimer',
      title: '6. Content disclaimer',
      body: [
        `Content on ${platformName} is provided for educational purposes only. It does not constitute professional accounting, tax, legal, or financial advice. See our full Disclaimer for details.`,
        'We make every effort to keep content accurate and up to date, but we cannot guarantee that all content reflects the very latest syllabus or regulatory requirements. Always verify against official sources.',
      ],
    },
    {
      id: 'limitation',
      title: '7. Limitation of liability',
      body: [
        `To the fullest extent permitted by law, ${platformName} shall not be liable for any indirect, incidental, special, or consequential loss arising from your use of the Site or its content.`,
        'Our total liability to you for any claim arising from your use of the Site shall not exceed the amount you paid us in the 12 months preceding the claim, or £50, whichever is greater.',
      ],
    },
    {
      id: 'termination',
      title: '8. Termination',
      body: [
        'We reserve the right to suspend or terminate your access to the Site at any time, with or without notice, if we reasonably believe you have breached these Terms.',
        'You can ask us to remove your registration or your details at any time through our contact form. We will handle your data as our Privacy Policy explains.',
      ],
    },
    {
      id: 'governing-law',
      title: '9. Governing law',
      body: [
        'These Terms are governed by the laws of England and Wales. Any disputes arising from these Terms or your use of the Site shall be subject to the exclusive jurisdiction of the courts of England and Wales.',
      ],
    },
    {
      id: 'contact',
      title: '10. Contact',
      body: [
        `If you have any questions about these Terms, please use our contact form at ${platformUrl}/contact.`,
        'These Terms were last updated in November 2026.',
      ],
    },
  ]
}

export default async function TermsPage() {
  const { isEthioTax, platformName, platformUrl } = await termsBrand()
  const sections = termsSections(platformName, platformUrl, isEthioTax)
  return (
    <>
      <section className="relative overflow-hidden bg-navy-950 py-16 md:py-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[80%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, var(--hero-glow, #3a4f9a) 0%, transparent 70%)' }} />
        </div>
        <div className="container-site relative z-10">
          <span className="eyebrow text-gold-400 mb-4 block">Legal</span>
          <h1 className="font-display text-white mb-3 leading-tight">Terms of Service</h1>
          <p className="text-white/70 text-sm">Last updated: November 2026</p>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">

            <aside className="lg:col-span-1 hidden lg:block">
              <div className="sticky top-8 bg-slate-50 rounded-xl border border-slate-200 p-5">
                <p className="text-xs font-bold text-navy-950 uppercase tracking-widest mb-4">Contents</p>
                <nav className="space-y-2">
                  {sections.map(s => (
                    <a key={s.id} href={`#${s.id}`}
                      className="block text-sm text-slate-500 hover:text-navy-950 transition-colors py-0.5">
                      {s.title}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            <div className="lg:col-span-3">
              <div className="border-l-4 border-gold-400 pl-5 mb-10">
                <p className="text-slate-600 text-base leading-relaxed">
                  Please read these Terms of Service carefully before using {platformName}.
                  By using the Site you agree to be bound by these Terms.
                </p>
              </div>

              <div className="space-y-10">
                {sections.map(s => (
                  <div key={s.id} id={s.id} className="scroll-mt-8">
                    <h2 className="font-display text-xl text-navy-950 mb-4">{s.title}</h2>
                    <div className="space-y-3">
                      {s.body.map((para, i) => (
                        <p key={i} className="text-slate-500 leading-relaxed text-sm">{para}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-12 bg-slate-50 rounded-xl border border-slate-200 p-6">
                <h2 className="font-display text-xl text-navy-950 mb-3">Questions about these Terms?</h2>
                <div className="flex flex-wrap gap-3">
                  <Link href="/contact"
                    className="inline-flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors">
                    Contact us
                  </Link>
                  <Link href="/privacy-policy"
                    className="inline-flex items-center h-10 px-5 rounded-lg text-sm font-medium border border-slate-300 text-navy-950 hover:border-navy-950 transition-colors">
                    Privacy Policy
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 border-t border-slate-200 py-8">
        <div className="container-site flex flex-wrap gap-4 text-sm text-slate-500">
          <span className="font-medium text-navy-950">Related:</span>
          <Link href="/privacy-policy"  className="hover:text-navy-700 transition-colors">Privacy Policy</Link>
          <Link href="/cookie-policy"   className="hover:text-navy-700 transition-colors">Cookie Policy</Link>
          <Link href="/disclaimer"      className="hover:text-navy-700 transition-colors">Disclaimer</Link>
          <Link href="/contact"         className="hover:text-navy-700 transition-colors">Contact Us</Link>
        </div>
      </section>
    </>
  )
}
