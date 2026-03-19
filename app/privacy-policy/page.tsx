// app/privacy-policy/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — AccountingBody',
  description: 'How AccountingBody collects, uses, and protects your personal data. Last updated March 2026.',
}

export default function PrivacyPolicyPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-navy-950 py-16 md:py-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[80%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
        </div>
        <div className="container-site relative z-10">
          <span className="eyebrow text-gold-400 mb-4 block">Legal</span>
          <h1 className="font-display text-white mb-3 leading-tight">Privacy Policy</h1>
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
                  {[
                    ['#who-we-are','Who we are'],['#what-we-collect','Data we collect'],
                    ['#how-we-use','How we use it'],['#third-parties','Third parties'],
                    ['#cookies','Cookies'],['#your-rights','Your rights'],
                    ['#retention','Retention'],['#contact','Contact us'],
                  ].map(([href,label]) => (
                    <a key={href} href={href}
                      className="block text-sm text-slate-500 hover:text-navy-950 transition-colors py-0.5">{label}</a>
                  ))}
                </nav>
              </div>
            </aside>

            <div className="lg:col-span-3 space-y-10">
              <div className="border-l-4 border-gold-400 pl-5">
                <p className="text-slate-600 text-base leading-relaxed">
                  AccountingBody is committed to protecting your privacy. This policy explains what personal data
                  we collect, how we use it, and the rights you have over it.
                </p>
              </div>

              {[
                {
                  id: 'who-we-are', title: '1. Who we are',
                  body: 'AccountingBody operates the website accountingbody.com — an accounting and finance education platform. For privacy questions email privacy@accountingbody.com.',
                },
                {
                  id: 'what-we-collect', title: '2. Data we collect',
                  body: 'We collect: name and email when you register; contact form submissions; newsletter opt-ins; usage analytics (pages visited, device type, approximate country); and cookies. See our Cookie Policy for cookie details.',
                },
                {
                  id: 'how-we-use', title: '3. How we use your data',
                  body: 'We use your data to: provide and improve the platform; respond to contact enquiries; send the weekly newsletter to subscribers who opted in; manage Pro subscriptions; and monitor performance. We do not sell your data.',
                },
                {
                  id: 'third-parties', title: '4. Third parties',
                  body: 'We use: Supabase (database); Vercel (hosting); Clerk (authentication); Lemon Squeezy (payments — we never store card details ourselves); and Cloudflare (DNS and security). All processors handle your data in compliance with applicable data protection law.',
                },
                {
                  id: 'cookies', title: '5. Cookies',
                  body: 'We use cookies for authentication, site performance, and optional analytics. See our full Cookie Policy for details.',
                },
                {
                  id: 'your-rights', title: '6. Your rights',
                  body: 'Under UK GDPR you have the right to access, correct, delete, restrict, and port your data, and to withdraw consent at any time. Email privacy@accountingbody.com. You may also complain to the ICO at ico.org.uk.',
                },
                {
                  id: 'retention', title: '7. Data retention',
                  body: 'Contact submissions: 24 months. Email subscribers: until unsubscribed + 30 days. Account data: lifetime of account + 90 days. Usage analytics: anonymised after 26 months.',
                },
                {
                  id: 'contact', title: '8. Contact us',
                  body: 'Email: privacy@accountingbody.com. Contact form: accountingbody.com/contact. This policy was last updated March 2026.',
                },
              ].map(s => (
                <div key={s.id} id={s.id} className="scroll-mt-8">
                  <h2 className="font-display text-xl text-navy-950 mb-3">{s.title}</h2>
                  <p className="text-slate-500 leading-relaxed text-sm">{s.body}</p>
                </div>
              ))}

              <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
                <h2 className="font-display text-xl text-navy-950 mb-3">Questions?</h2>
                <div className="flex flex-wrap gap-3">
                  <Link href="/contact"
                    className="inline-flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors">
                    Contact us
                  </Link>
                  <Link href="/cookie-policy"
                    className="inline-flex items-center h-10 px-5 rounded-lg text-sm font-medium border border-slate-300 text-navy-950 hover:border-navy-950 transition-colors">
                    Cookie Policy
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
          <Link href="/cookie-policy"  className="hover:text-navy-700 transition-colors">Cookie Policy</Link>
          <Link href="/disclaimer"     className="hover:text-navy-700 transition-colors">Disclaimer</Link>
          <Link href="/contact"        className="hover:text-navy-700 transition-colors">Contact Us</Link>
        </div>
      </section>
    </>
  )
}
