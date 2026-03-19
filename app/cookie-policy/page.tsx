// app/cookie-policy/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Cookie Policy — AccountingBody',
  description: 'How AccountingBody uses cookies and how to manage your preferences. Last updated March 2026.',
}

const cookies = [
  { category: 'Necessary',  bar: 'bg-teal-600',  always: true,
    items: [
      { name: '__session',      provider: 'Clerk',       purpose: 'Maintains your login session.',                     duration: '7 days' },
      { name: '_cf_clearance',  provider: 'Cloudflare',  purpose: 'Security — proves your browser passed a challenge.', duration: '30 mins' },
      { name: 'sb-*',           provider: 'Supabase',    purpose: 'Stores authentication tokens for account data.',    duration: '7 days' },
    ],
  },
  { category: 'Analytics',  bar: 'bg-navy-800',  always: false,
    items: [
      { name: '_va_*',  provider: 'Vercel Analytics', purpose: 'Privacy-first page view counting. No personal data stored.', duration: 'Session' },
      { name: '_ga',    provider: 'Google Analytics', purpose: 'Tracks pages visited and time on site (optional).',          duration: '2 years' },
    ],
  },
  { category: 'Functional', bar: 'bg-gold-500',  always: false,
    items: [
      { name: 'ab_preferences', provider: 'AccountingBody', purpose: 'Stores your preferences such as calculator settings.', duration: '1 year' },
    ],
  },
]

export default function CookiePolicyPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-navy-950 py-16 md:py-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[80%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
        </div>
        <div className="container-site relative z-10">
          <span className="eyebrow text-gold-400 mb-4 block">Legal</span>
          <h1 className="font-display text-white mb-3 leading-tight">Cookie Policy</h1>
          <p className="text-white/50 text-sm">Last updated: March 2026</p>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container-site">
          <div className="max-w-3xl">
            <div className="border-l-4 border-gold-400 pl-5 mb-10">
              <p className="text-slate-600 text-base leading-relaxed">
                Cookies are small text files stored on your device. This policy explains every cookie
                AccountingBody uses and how to control your preferences.
              </p>
            </div>

            <h2 className="font-display text-2xl text-navy-950 mb-6">Cookies we use</h2>
            <div className="space-y-6 mb-10">
              {cookies.map(cat => (
                <div key={cat.category} className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50">
                    <span className={`w-3 h-3 rounded-full ${cat.bar}`} />
                    <h3 className="font-semibold text-navy-950 text-sm">{cat.category} cookies</h3>
                    {cat.always && <span className="ml-auto text-xs text-slate-400 italic">Always active</span>}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {cat.items.map(item => (
                      <div key={item.name} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-5">
                        <div>
                          <code className="text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{item.name}</code>
                          <span className="text-xs text-slate-400 block mt-1">{item.provider}</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">{item.purpose}</p>
                        <p className="text-xs text-slate-500">{item.duration}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <h2 className="font-display text-2xl text-navy-950 mb-4">How to manage cookies</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              You can control cookies through your browser settings. Disabling necessary cookies will prevent the site
              from working correctly. You can also opt out of Google Analytics at{" "}
              <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer"
                className="text-navy-700 underline hover:text-gold-600 transition-colors">
                tools.google.com/dlpage/gaoptout
              </a>.
            </p>

            <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
              <h2 className="font-display text-xl text-navy-950 mb-3">Questions?</h2>
              <Link href="/contact"
                className="inline-flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors">
                Contact us
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 border-t border-slate-200 py-8">
        <div className="container-site flex flex-wrap gap-4 text-sm text-slate-500">
          <span className="font-medium text-navy-950">Related:</span>
          <Link href="/privacy-policy" className="hover:text-navy-700 transition-colors">Privacy Policy</Link>
          <Link href="/disclaimer"     className="hover:text-navy-700 transition-colors">Disclaimer</Link>
          <Link href="/contact"        className="hover:text-navy-700 transition-colors">Contact Us</Link>
        </div>
      </section>
    </>
  )
}
