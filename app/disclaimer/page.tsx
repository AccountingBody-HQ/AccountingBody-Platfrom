// app/disclaimer/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Disclaimer — AccountingBody',
  description: 'Important disclaimers regarding the accuracy and use of content on AccountingBody. Last updated March 2026.',
}

const sections = [
  {
    id: 'general', title: '1. General disclaimer',
    body: [
      'The content on AccountingBody is provided for educational and informational purposes only. While we make every effort to ensure accuracy, we make no warranties about the completeness, reliability, or suitability of any content on this site.',
      'Your use of any content is entirely at your own risk. AccountingBody shall not be liable for any loss or damage arising from the use of, or inability to use, materials on this site.',
    ],
  },
  {
    id: 'not-advice', title: '2. Not professional advice',
    body: [
      'Nothing on AccountingBody constitutes professional accounting, tax, legal, or financial advice. Study notes and articles are designed to help students understand concepts for educational purposes — they are not a substitute for advice from a qualified professional.',
      'If you require professional advice, consult a qualified and appropriately regulated professional.',
    ],
  },
  {
    id: 'exam-content', title: '3. Exam content and syllabus accuracy',
    body: [
      'Professional accounting qualifications — including ACCA, CIMA, AAT, ICAEW, and others — are managed by independent examining bodies whose syllabuses can change at any time. AccountingBody strives to keep content current, but cannot guarantee it reflects the very latest syllabus.',
      'Always cross-reference with the official published syllabus. AccountingBody is not affiliated with, endorsed by, or officially connected to any professional accounting body.',
    ],
  },
  {
    id: 'third-party', title: '4. Third-party links',
    body: [
      'AccountingBody may contain links to external websites. These links are provided for convenience only. We have no control over those sites and accept no responsibility for them or for any loss arising from your use of them.',
    ],
  },
  {
    id: 'errors', title: '5. Errors and corrections',
    body: [
      'We take accuracy seriously. If you believe any content contains an error, please report it via our contact form. We will investigate and correct verified errors promptly.',
      'Despite our best efforts, AccountingBody cannot accept responsibility for errors or omissions, or for any loss resulting from reliance on such content.',
    ],
  },
  {
    id: 'ip', title: '6. Intellectual property',
    body: [
      'All original content on AccountingBody — including study notes, practice questions, and guides — is the intellectual property of AccountingBody unless otherwise stated. Content may not be reproduced or republished without prior written permission.',
    ],
  },
  {
    id: 'changes', title: '7. Changes to this disclaimer',
    body: [
      'We may update this disclaimer at any time. The last updated date at the top reflects the most recent revision. Continued use of the site after changes constitutes acceptance of the updated disclaimer.',
    ],
  },
]

export default function DisclaimerPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-navy-950 py-16 md:py-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[80%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
        </div>
        <div className="container-site relative z-10">
          <span className="eyebrow text-gold-400 mb-4 block">Legal</span>
          <h1 className="font-display text-white mb-3 leading-tight">Disclaimer</h1>
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
                  Please read this disclaimer carefully before using accountingbody.com.
                  By using this site, you accept the terms set out below.
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
                <h2 className="font-display text-xl text-navy-950 mb-3">Questions?</h2>
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
          <Link href="/privacy-policy" className="hover:text-navy-700 transition-colors">Privacy Policy</Link>
          <Link href="/cookie-policy"  className="hover:text-navy-700 transition-colors">Cookie Policy</Link>
          <Link href="/contact"        className="hover:text-navy-700 transition-colors">Contact Us</Link>
        </div>
      </section>
    </>
  )
}
