// app/terms/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service — AccountingBody',
  description: 'The terms and conditions governing your use of AccountingBody. Last updated March 2026.',
}

const sections = [
  {
    id: 'acceptance',
    title: '1. Acceptance of terms',
    body: [
      'By accessing or using accountingbody.com ("the Site"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the Site.',
      'These Terms apply to all visitors, registered users, and subscribers. We may update these Terms at any time. Continued use of the Site after changes constitutes acceptance of the updated Terms.',
    ],
  },
  {
    id: 'use-of-site',
    title: '2. Use of the site',
    body: [
      'You may use AccountingBody for lawful, personal, and non-commercial educational purposes. You must not use the Site in any way that is unlawful, harmful, or that could damage our reputation.',
      'You must not attempt to gain unauthorised access to any part of the Site, its servers, or any database connected to it. You must not use automated tools to scrape, harvest, or copy content from the Site without prior written permission.',
    ],
  },
  {
    id: 'accounts',
    title: '3. Accounts and registration',
    body: [
      'To access certain features you must create a free account. You are responsible for keeping your account credentials secure and for all activity that occurs under your account.',
      'You must provide accurate information when registering. We reserve the right to suspend or terminate accounts that provide false information or that breach these Terms.',
    ],
  },
  {
    id: 'subscriptions',
    title: '4. Pro subscriptions and payments',
    body: [
      'Pro subscriptions are billed monthly (£29/month) or annually (£249/year) via Lemon Squeezy. Prices include VAT where applicable. You may cancel your subscription at any time from your account settings.',
      'Cancellation takes effect at the end of the current billing period. We do not offer refunds for partial billing periods except where required by law. If you believe you have been charged in error, contact us within 14 days.',
    ],
  },
  {
    id: 'intellectual-property',
    title: '5. Intellectual property',
    body: [
      'All original content on AccountingBody — including study notes, practice questions, articles, and guides — is owned by AccountingBody or its content contributors and is protected by copyright.',
      'You may not reproduce, redistribute, or republish any content without prior written permission. You may print or download content for your own personal, non-commercial study use only.',
      'AccountingBody is not affiliated with, endorsed by, or officially connected to ACCA, CIMA, AAT, ICAEW, ATT, or any other professional body. All qualification names are trademarks of their respective owners.',
    ],
  },
  {
    id: 'disclaimer',
    title: '6. Content disclaimer',
    body: [
      'Content on AccountingBody is provided for educational purposes only. It does not constitute professional accounting, tax, legal, or financial advice. See our full Disclaimer for details.',
      'We make every effort to keep content accurate and up to date, but we cannot guarantee that all content reflects the very latest syllabus or regulatory requirements. Always verify against official sources.',
    ],
  },
  {
    id: 'limitation',
    title: '7. Limitation of liability',
    body: [
      'To the fullest extent permitted by law, AccountingBody shall not be liable for any indirect, incidental, special, or consequential loss arising from your use of the Site or its content.',
      'Our total liability to you for any claim arising from your use of the Site shall not exceed the amount you paid us in the 12 months preceding the claim, or £50, whichever is greater.',
    ],
  },
  {
    id: 'termination',
    title: '8. Termination',
    body: [
      'We reserve the right to suspend or terminate your access to the Site at any time, with or without notice, if we reasonably believe you have breached these Terms.',
      'You may close your account at any time by contacting us at hello@accountingbody.com. Upon closure, your data will be handled in accordance with our Privacy Policy.',
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
      'If you have any questions about these Terms, please contact us at hello@accountingbody.com or via our contact form at accountingbody.com/contact.',
      'These Terms were last updated in March 2026.',
    ],
  },
]

export default function TermsPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-navy-950 py-16 md:py-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[80%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
        </div>
        <div className="container-site relative z-10">
          <span className="eyebrow text-gold-400 mb-4 block">Legal</span>
          <h1 className="font-display text-white mb-3 leading-tight">Terms of Service</h1>
          <p className="text-white/50 text-sm">Last updated: March 2026</p>
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
                  Please read these Terms of Service carefully before using AccountingBody.
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
