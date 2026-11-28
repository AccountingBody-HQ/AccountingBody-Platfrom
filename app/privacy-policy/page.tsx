// app/privacy-policy/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { ownerCanonical } from '@/lib/canonical'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Privacy Policy',
    description: 'How we collect, use, and protect your personal data. Last updated November 2026.',
    ...ownerCanonical('accountingbody', '/privacy-policy'),
  }
}

export default async function PrivacyPolicyPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  const platformName = isEthioTax ? 'EthioTax' : 'Accounting Body'
  const platformUrl  = isEthioTax ? 'ethiotax.com' : 'accountingbody.com'
  const heroBg       = isEthioTax ? '#1A4731' : undefined

  // Owner-approved wording (PRIV-2, D352–D356). One string per paragraph.
  // The Contents list is built from these sections (id + nav), so the two
  // can never drift apart.
  const sections: { id: string; nav: string; title: string; body: string[] }[] = [
    {
      id: 'who-we-are', nav: 'Who we are', title: '1. Who we are',
      body: [
        `${platformName} (${platformUrl}) decides how your personal data is used (we are the "controller"). For any privacy question, use our contact form at ${platformUrl}/contact.`,
        ...(isEthioTax ? [] : ['Accounting Body is run by Accounting Body Ltd, a company registered in England and Wales (company number 17014642). Registered office: 71-75 Shelton Street, Covent Garden, London WC2H 9JQ, United Kingdom.']),
      ],
    },
    {
      id: 'what-we-collect', nav: 'What we collect', title: '2. What we collect and why',
      body: [
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
      ],
    },
    {
      id: 'lawful-bases', nav: 'Lawful bases', title: '3. Our lawful bases',
      body: [
        'Replying to you and running the service you asked for: steps you asked for, and our legitimate interest in answering. Newsletter, Google Analytics and advertising cookies: your consent, which you can withdraw at any time. Security, error reports and visit counting: our legitimate interest in keeping the site safe and working.',
      ],
    },
    {
      id: 'third-parties', nav: 'Who we share with', title: '4. Who we share it with',
      body: [
        'We do not sell your data. Our service providers are Supabase (database), Vercel (hosting and statistics), Resend (sending e-mails), Cloudflare (security check on forms) and Sentry (error reports). Google (only if you accept cookies), WhatsApp (only if you message us there) and Lemon Squeezy (job-post payments) make their own decisions about the data they receive. If you register as a job seeker, we may share your profile with an employer, in the UK or abroad, but we will always tell you first.',
        ...(isEthioTax ? ['On EthioTax, Google Translate is used only if you choose Amharic or Oromo.'] : []),
      ],
    },
    {
      id: 'transfers', nav: 'Transfers', title: '5. Transfers outside the UK',
      body: [
        "Some providers store data in the United States or elsewhere. They use the UK's approved safeguards.",
      ],
    },
    {
      id: 'cookies', nav: 'Cookies', title: '6. Cookies',
      body: [
        'See our Cookie Policy. You can change your choice at any time with "Cookie settings" at the bottom of every page.',
      ],
    },
    {
      id: 'retention', nav: 'How long we keep it', title: '7. How long we keep it',
      body: [
        'Unconfirmed newsletter sign-ups: 7 days.',
        'Saved jobs: 7 days.',
        'Newsletter: until you unsubscribe, then deleted within 30 days.',
        'Contact messages and enquiries: 24 months after our last contact.',
        'Job seeker profiles: 24 months after your last update.',
        'Firm applications: while you are listed, plus 12 months.',
      ],
    },
    {
      id: 'your-rights', nav: 'Your rights', title: '8. Your rights',
      body: [
        'You can ask for a copy of your data, or ask us to correct it, delete it, restrict or object to its use, or move it. You can also withdraw consent. To leave the newsletter, use "Unsubscribe" at the bottom of every page. For anything else, use our contact form. We reply within one month.',
      ],
    },
    {
      id: 'children', nav: 'Children', title: '9. Children',
      body: [
        'Our learning pages are open to everyone. The job, recruitment and network services are for adults (18 and over).',
      ],
    },
    {
      id: 'contact', nav: 'Contact', title: '10. Contact and complaints',
      body: [
        "Use our contact form. If you are unhappy, you can complain to the Information Commissioner's Office at ico.org.uk.",
      ],
    },
  ]

  return (
    <>
      <section className="relative overflow-hidden py-16 md:py-20" style={{ background: heroBg ?? '#0C1A3D' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[80%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, var(--hero-glow, #3a4f9a) 0%, transparent 70%)' }} />
        </div>
        <div className="container-site relative z-10">
          <span className="eyebrow text-gold-400 mb-4 block">Legal</span>
          <h1 className="font-display text-white mb-3 leading-tight">Privacy Policy</h1>
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
                      className="block text-sm text-slate-500 hover:text-navy-950 transition-colors py-0.5">{s.nav}</a>
                  ))}
                </nav>
              </div>
            </aside>

            <div className="lg:col-span-3 space-y-10">
              <div className="border-l-4 border-gold-400 pl-5">
                <p className="text-slate-600 text-base leading-relaxed">
                  {platformName} is committed to protecting your privacy. This policy explains what personal data
                  we collect, how we use it, and the rights you have over it.
                </p>
              </div>

              {sections.map(s => (
                <div key={s.id} id={s.id} className="scroll-mt-8">
                  <h2 className="font-display text-xl text-navy-950 mb-3">{s.title}</h2>
                  <div className="space-y-3">
                    {s.body.map((para, i) => (
                      <p key={i} className="text-slate-500 leading-relaxed text-sm">{para}</p>
                    ))}
                  </div>
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
