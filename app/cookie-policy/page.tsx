// app/cookie-policy/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { ownerCanonical } from '@/lib/canonical'
import { getRequestBrand } from '@/lib/brand-server'
import { brandText } from '@/lib/et-wording'
import ForgetPracticeProgress from '@/components/ForgetPracticeProgress'
import { adsenseClientId } from '@/lib/consent'

export async function generateMetadata(): Promise<Metadata> {
  const { isEthioTax } = await getRequestBrand()
  return {
    title: 'Cookie Policy',
    description: brandText(isEthioTax, 'How Accounting Body uses cookies and how to manage your preferences. Last updated November 2026.'),
    ...ownerCanonical('accountingbody', '/cookie-policy'),
  }
}

// etOnly rows are shown on the EthioTax view only.
type CookieRow = { name: string; provider: string; purpose: string; duration: string; etOnly?: boolean }

// adsOnly groups are shown only when this site can load AdSense: the same
// condition as the banner's advertising sentence (adsenseClientId, lib/consent.ts).
// The optional groups share one bar colour (one recorded class use, lib/et-brand-surfaces.test.ts).
const OPTIONAL_BAR = 'bg-navy-800'
const cookies: { category: string; bar: string; always: boolean; adsOnly?: boolean; items: CookieRow[] }[] = [
  { category: 'Necessary cookies',  bar: 'bg-teal-600',  always: true,
    items: [
      { name: 'cf_clearance',   provider: 'Cloudflare',  purpose: 'Security: set only if Cloudflare asks your browser to pass a check.', duration: 'Up to 30 minutes' },
      { name: 'Turnstile (no cookie)', provider: 'Cloudflare', purpose: 'Checks that forms are sent by a person, not a bot. It reads browser details but stores no cookie.', duration: 'While the page is open' },
      { name: 'ab_vid',         provider: 'Accounting Body', purpose: 'Remembers the jobs you saved on this device.', duration: '7 days' },
      { name: 'x-et-platform',  provider: 'Accounting Body', purpose: 'Identifies which platform (Accounting Body or EthioTax) the visitor is using. No personal data stored.', duration: 'Session' },
      { name: 'et_language',    provider: 'EthioTax',         purpose: 'Remembers the language you chose.', duration: '1 year', etOnly: true },
      { name: 'googtrans',      provider: 'Google Translate', purpose: 'Shows pages in the language you chose.', duration: 'Until you close your browser', etOnly: true },
    ],
  },
  { category: 'Statistics (no cookies)',  bar: OPTIONAL_BAR,  always: false,
    items: [
      { name: 'Vercel Web Analytics',  provider: 'Vercel', purpose: 'Counts page visits without cookies and without identifying you. Choosing "Reject non-essential cookies" turns it off.', duration: 'No cookie' },
      { name: 'Vercel Speed Insights', provider: 'Vercel', purpose: 'Measures how fast pages load. Choosing "Reject non-essential cookies" turns it off.', duration: 'No cookie' },
    ],
  },
  { category: 'Analytics cookies',  bar: OPTIONAL_BAR,  always: false,
    items: [
      { name: '_ga',      provider: 'Google Analytics', purpose: 'Tells visits apart for Google Analytics (only if you accept).', duration: '2 years' },
      { name: '_ga_<id>', provider: 'Google Analytics', purpose: 'Keeps the state of your visit for Google Analytics (only if you accept).', duration: '2 years' },
      { name: '_gid',     provider: 'Google Analytics', purpose: 'Tells visits apart for Google Analytics for one day (only if you accept).', duration: '24 hours' },
      { name: '_gat*',    provider: 'Google Analytics', purpose: 'Limits how often Google Analytics collects data (only if you accept).', duration: '1 minute' },
      { name: '_gcl_*',   provider: 'Google',           purpose: 'Measures whether a Google advert led to your visit (only if you accept).', duration: '90 days' },
    ],
  },
  { category: 'Advertising cookies',  bar: OPTIONAL_BAR,  always: false,  adsOnly: true,
    items: [
      { name: '__gads, __gpi, __eoi', provider: 'Google AdSense', purpose: 'Shows ads and limits how often you see them (only if you accept). Google may also set cookies on its own domains.', duration: 'Up to 13 months' },
    ],
  },
]

const STORAGE_INTRO = "Some features keep small notes in your browser's storage on this device instead of in a cookie. They stay on your device unless a row below says otherwise, and most of them stay until you clear this website's data in your browser settings."

// etOnly rows are shown on the EthioTax view only.
const storage: { name: string; purpose: string; duration: string; etOnly?: boolean }[] = [
  { name: 'ab_cookie_consent', purpose: 'Remembers your cookie choice.', duration: 'Until you clear it' },
  { name: 'course_progress_*', purpose: 'Remembers which free-course lessons you marked complete.', duration: 'Until you clear it' },
  { name: 'sidebar_open_*',    purpose: 'Remembers which course chapters you left open.', duration: 'Until you clear it' },
  // Keys from lib/practice-store.ts; the buttons below remove them or stop saving them.
  { name: 'ab_mock_v1:*, ab_mock_hist_v1, ab_pq_v1, ab_practice_off', purpose: 'Remembers your practice and mock exam results, flagged questions and an unfinished mock exam on this device. If you choose to stop saving below, only that choice is kept.', duration: 'Until you clear it; an unfinished exam is no longer used once its time runs out' },
  { name: 'ab_job_alerts',     purpose: 'Keeps the job alert details you entered on this device.', duration: 'Until you clear it' },
  { name: 'ab_visited_listings, jobs-listings-scroll:*', purpose: 'Helps the Back link return you to the same place in the job listings.', duration: 'Until you close the tab' },
  { name: 'et-lang-reload',    purpose: 'Keeps the page loading bar going after you change the language.', duration: 'Removed when the new page has loaded', etOnly: true },
  { name: 'ab_saved_jobs',     purpose: 'An older list of saved jobs. It is sent once to move those jobs into your saved jobs, then removed.', duration: 'Removed once the move has worked' },
]

export default async function CookiePolicyPage() {
  const { isEthioTax } = await getRequestBrand()
  const showAds = adsenseClientId() !== ''
  return (
    <>
      <section className="relative overflow-hidden bg-navy-950 py-16 md:py-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[80%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, var(--hero-glow, #3a4f9a) 0%, transparent 70%)' }} />
        </div>
        <div className="container-site relative z-10">
          <span className="eyebrow text-gold-400 mb-4 block">Legal</span>
          <h1 className="font-display text-white mb-3 leading-tight">Cookie Policy</h1>
          <p className="text-white/70 text-sm">Last updated: November 2026</p>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container-site">
          <div className="max-w-3xl">
            <div className="border-l-4 border-gold-400 pl-5 mb-10">
              <p className="text-slate-600 text-base leading-relaxed">
                {brandText(isEthioTax, 'Cookies are small text files stored on your device. This policy explains every cookie Accounting Body uses and how to control your preferences.')}
              </p>
            </div>

            <h2 className="font-display text-2xl text-navy-950 mb-6">Cookies we use</h2>
            <div className="space-y-6 mb-10">
              {cookies.filter(cat => !cat.adsOnly || showAds).map(cat => (
                <div key={cat.category} className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50">
                    <span className={`w-3 h-3 rounded-full ${cat.bar}`} />
                    <h3 className="font-semibold text-navy-950 text-sm">{cat.category}</h3>
                    {cat.always && <span className="ml-auto text-xs text-slate-400 italic">Always active</span>}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {cat.items.filter(item => !item.etOnly || isEthioTax).map(item => (
                      <div key={item.name} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-5">
                        <div>
                          <code className="text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{item.name}</code>
                          <span className="text-xs text-slate-400 block mt-1">{brandText(isEthioTax, item.provider)}</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">{item.purpose}</p>
                        <p className="text-xs text-slate-500">{item.duration}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <h2 className="font-display text-2xl text-navy-950 mb-4">Stored on your device</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">{STORAGE_INTRO}</p>
            <div className="rounded-xl border border-slate-200 overflow-hidden mb-10">
              <div className="divide-y divide-slate-100">
                {storage.filter(item => !item.etOnly || isEthioTax).map(item => (
                  <div key={item.name} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-5">
                    <div>
                      <code className="text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{item.name}</code>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{item.purpose}</p>
                    <p className="text-xs text-slate-500">{item.duration}</p>
                  </div>
                ))}
              </div>
            </div>
            <ForgetPracticeProgress />

            <h2 className="font-display text-2xl text-navy-950 mb-4">How to manage cookies</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              You can change your choice at any time with &quot;Cookie settings&quot; at the bottom of every page.{' '}
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
