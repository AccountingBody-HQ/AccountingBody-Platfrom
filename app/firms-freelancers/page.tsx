import Link from 'next/link'
import type { Metadata } from 'next'
import { headers } from 'next/headers'

export const metadata: Metadata = {
  title:       'Professional Network | Firms & Freelancers',
  description: 'A managed global network of verified accounting firms and independent professionals. Every engagement overseen from brief to delivery.',
}

const standards = [
  {
    title: 'Rigorous Vetting',
    desc:  'Every firm and independent professional undergoes a structured review of credentials, qualifications, experience, and professional standing before joining our network. Acceptance is not guaranteed.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#ECFDF5"/>
        <circle cx="20" cy="20" r="9" stroke="#1A4731" strokeWidth="1.6"/>
        <path d="M15 20l3 3 7-7" stroke="#D4A017" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: 'Managed Engagements',
    desc:  'We manage the full client journey — from receiving your service request, assessing requirements, selecting the right professional, and overseeing delivery throughout.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#FFF7ED"/>
        <rect x="11" y="10" width="18" height="20" rx="2" stroke="#1A4731" strokeWidth="1.6"/>
        <path d="M15 17l2 2 4-4" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M15 23l2 2 4-4" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M23 18h2M23 24h2" stroke="#1A4731" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    title: 'Global Coverage',
    desc:  'Our professional network spans multiple jurisdictions worldwide. When you require expertise in a specific territory, we draw on local professionals with the relevant regulatory and market knowledge.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#EFF6FF"/>
        <circle cx="20" cy="20" r="9" stroke="#1A4731" strokeWidth="1.6"/>
        <path d="M20 11c-2 3-3 5.5-3 9s1 6 3 9M20 11c2 3 3 5.5 3 9s-1 6-3 9M11 20h18" stroke="#D4A017" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    title: 'Quality Assurance',
    desc:  'All work delivered through our network is subject to our quality standards. We monitor engagement outcomes, gather client feedback, and maintain the right to remove professionals who do not meet our standards.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#EEF2FF"/>
        <path d="M20 11l2.5 5 5.5.8-4 3.9.9 5.5L20 23.5l-4.9 2.7.9-5.5-4-3.9 5.5-.8z" stroke="#1A4731" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M20 15v5l3 2" stroke="#D4A017" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
]

const clientSteps = [
  { step: '01', title: 'Tell us what you need', desc: 'Submit a service request describing your requirements, timeline, and jurisdiction. No commitment required at this stage.' },
  { step: '02', title: 'We match you with the right professional', desc: 'Our team reviews your request and identifies the most suitable verified professional from our network.' },
  { step: '03', title: 'Receive your proposal', desc: 'We present a clear proposal on behalf of the matched professional. You review, approve, and we manage everything from there.' },
]

export default async function FirmsFreelancersPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  const brand = isEthioTax ? '#1A4731' : '#0C1A3D'
  const platformName = isEthioTax ? 'EthioTax' : 'Accounting Body'

  return (
    <main className="min-h-screen bg-surface">

      {/* HERO */}
      <section className="relative overflow-hidden py-20 md:py-28" style={{ background: brand }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, rgba(212,160,23,0.3) 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>
        <div className="container-site relative z-10">
          <nav className="flex items-center gap-2 text-white/40 text-sm mb-10">
            <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span className="text-white/70">Firms &amp; Freelancers</span>
          </nav>
          <div className="max-w-4xl">
            <span className="eyebrow text-gold-400 mb-5 block">Verified Professional Network</span>
            <h1 className="font-display text-white text-4xl md:text-5xl lg:text-6xl mb-6 leading-tight" style={{ letterSpacing: '-0.02em' }}>
              Accounting expertise,<br />
              <span style={{ background: 'linear-gradient(135deg, #D4A017 0%, #e8c050 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                managed end to end.
              </span>
            </h1>
            <p className="text-white/60 text-xl leading-relaxed mb-10 max-w-3xl">
              {platformName} operates a carefully managed global network of verified accounting firms and independent professionals. We handle every aspect of your engagement — so you can focus on your business.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link href="/get-help"
                className="h-13 px-7 flex items-center justify-center gap-2 text-sm font-semibold rounded-lg bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold">
                Get Professional Help
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS FOR CLIENTS */}
      <section className="section bg-white border-b border-slate-200">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block">How It Works</span>
            <h2 className="section-title mb-4">Simple for clients</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              You submit your requirement. We do the rest — matching, vetting, coordinating, and delivering.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {clientSteps.map((item) => (
              <div key={item.step} className="flex flex-col">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base mb-5 shadow-md" style={{ background: brand }}>
                  {item.step}
                </div>
                <h3 className="font-display text-lg text-navy-950 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <Link href="/get-help"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-colors shadow-sm"
              style={{ background: brand }}>
              Submit a service request
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* NETWORK STANDARDS */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block">Our Standards</span>
            <h2 className="section-title mb-4">Why you can trust our network</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Every professional in our network operates under the {platformName} standard — a structured framework covering vetting, engagement management, and quality assurance.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {standards.map((s) => (
              <div key={s.title} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <div className="mb-4">{s.icon}</div>
                <h3 className="font-display text-lg text-navy-950 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section relative overflow-hidden" style={{ background: brand }}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-gold-500/10 blur-3xl" />
        </div>
        <div className="container-site relative z-10 text-center">
          <span className="eyebrow text-gold-400 mb-4 block">Get Started</span>
          <h2 className="font-display text-4xl text-white mb-4 leading-tight">Ready to get professional help?</h2>
          <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto leading-relaxed">
            Tell us what you need and we will match you with the right verified professional from our network.
          </p>
          <Link href="/get-help"
            className="inline-flex items-center gap-2 h-13 px-7 rounded-lg text-base font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold">
            Get Professional Help
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </Link>
        </div>
      </section>

    </main>
  )
}
