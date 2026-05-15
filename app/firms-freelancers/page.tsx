import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title:       'Accounting Body Professionals | Firms & Freelancers',
  description: 'Join the Accounting Body managed professional network. We oversee every client engagement — from initial request through to delivery — on behalf of our verified global network of firms and independent professionals.',
}

const standards = [
  {
    title: 'Rigorous Vetting',
    desc:  'Every firm and independent professional undergoes a structured review of credentials, qualifications, experience, and professional standing before joining our network. Acceptance is not guaranteed.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#ECFDF5"/>
        <circle cx="20" cy="20" r="9" stroke="#0C1A3D" strokeWidth="1.6"/>
        <path d="M15 20l3 3 7-7" stroke="#D4A017" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: 'Managed Engagements',
    desc:  'Accounting Body manages the full client journey. We receive service requests, assess requirements, select the right professional, oversee delivery, and manage client communication throughout.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#FFF7ED"/>
        <rect x="11" y="10" width="18" height="20" rx="2" stroke="#0C1A3D" strokeWidth="1.6"/>
        <path d="M15 17l2 2 4-4" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M15 23l2 2 4-4" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M23 18h2M23 24h2" stroke="#0C1A3D" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    title: 'Global Coverage',
    desc:  'Our professional network spans multiple jurisdictions worldwide. When a client requires expertise in a specific territory, we draw on local professionals with the relevant regulatory and market knowledge.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#EFF6FF"/>
        <circle cx="20" cy="20" r="9" stroke="#0C1A3D" strokeWidth="1.6"/>
        <path d="M20 11c-2 3-3 5.5-3 9s1 6 3 9M20 11c2 3 3 5.5 3 9s-1 6-3 9M11 20h18" stroke="#D4A017" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    title: 'Quality Assurance',
    desc:  'All work delivered through Accounting Body is subject to our quality standards. We monitor engagement outcomes, gather client feedback, and maintain the right to remove professionals who do not meet our standards.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#EEF2FF"/>
        <path d="M20 11l2.5 5 5.5.8-4 3.9.9 5.5L20 23.5l-4.9 2.7.9-5.5-4-3.9 5.5-.8z" stroke="#0C1A3D" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M20 15v5l3 2" stroke="#D4A017" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
]

const process = [
  { step: '01', title: 'Application',        desc: 'Submit a detailed application including your professional credentials, jurisdictions covered, service areas, and relevant qualifications. Applications are reviewed individually.' },
  { step: '02', title: 'Vetting & Approval', desc: 'Our team conducts a structured review of your credentials and professional standing. You will be notified of the outcome. Approved professionals are added to our internal network.' },
  { step: '03', title: 'Engagement Briefing', desc: 'When a client request matches your profile, Accounting Body contacts you with a full brief. You provide a fee proposal which we review and present to the client on your behalf.' },
  { step: '04', title: 'Delivery & Payment', desc: 'Upon client approval, you receive a formal engagement instruction from Accounting Body. We manage client communication, handle billing, and remit your agreed fee on completion.' },
]

const firmBenefits = [
  'Access to a pipeline of pre-qualified client engagements',
  'Accounting Body manages all client-facing communication',
  'Operate across multiple jurisdictions within one network',
  'Your firm is presented as part of a premium managed service',
  'Structured onboarding and engagement process throughout',
]

const independentBenefits = [
  'Join a credentialled network of independent professionals',
  'Receive matched engagements suited to your specialism',
  'Accounting Body handles billing and client management',
  'Work flexibly — accept engagements that suit your capacity',
  'Professional representation through an established platform',
]

export default function FirmsFreelancersPage() {
  return (
    <main className="min-h-screen bg-surface">

      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-950 py-20 md:py-28">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
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
            <span className="eyebrow text-gold-400 mb-5 block">Accounting Body Professionals</span>
            <h1 className="font-display text-white text-4xl md:text-5xl lg:text-6xl mb-6 leading-tight" style={{ letterSpacing: '-0.02em' }}>
              A Managed Network of<br />Verified Accounting Professionals
            </h1>
            <p className="text-white/60 text-xl leading-relaxed mb-4 max-w-3xl">
              Accounting Body operates a carefully managed global network of accounting firms and independent professionals. We oversee every client engagement — from initial brief through to final delivery — ensuring a consistent, high-quality service experience.
            </p>
            <p className="text-white/40 text-base leading-relaxed mb-10 max-w-2xl">
              Professionals within our network do not operate independently on this platform. All client relationships, communications, pricing, and quality oversight are managed directly by Accounting Body.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-stretch">
              <Link href="/firms-freelancers/join"
                className="h-12 px-7 flex items-center justify-center gap-2 text-sm font-semibold rounded-lg bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold">
                Apply to Join Our Network
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
              <Link href="/get-help"
                className="h-12 px-7 flex items-center justify-center text-sm font-medium rounded-lg border border-white/25 text-white hover:bg-white/10 hover:border-white/40 transition-all">
                I Need Accounting Services
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* NETWORK STANDARDS */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block">Our Standards</span>
            <h2 className="section-title mb-4">How we manage our professional network</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Every professional in our network operates under the Accounting Body standard — a structured framework covering vetting, engagement management, and quality assurance.
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

      {/* ENGAGEMENT PROCESS */}
      <section className="section section-navy relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-gold-500/10 blur-3xl" />
        </div>
        <div className="container-site relative z-10">
          <div className="text-center mb-14">
            <span className="eyebrow text-gold-400 mb-4 block">Engagement Process</span>
            <h2 className="font-display text-4xl text-white mb-4 leading-tight">How engagements work</h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">From application through to completed delivery — Accounting Body manages every stage of the professional engagement process.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
            {process.map((item) => (
              <div key={item.step} className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-gold-500 flex items-center justify-center text-navy-950 font-bold text-lg mb-5 shadow-gold">
                  {item.step}
                </div>
                <h3 className="font-display text-white text-lg mb-3">{item.title}</h3>
                <p className="text-white/55 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FIRMS / INDEPENDENTS */}
      <section className="section bg-white border-t border-slate-200">
        <div className="container-site">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="eyebrow mb-3 block">Who Can Apply</span>
            <h2 className="section-title mb-4">Open to firms and independent professionals</h2>
            <p className="text-slate-500 text-lg leading-relaxed">We welcome applications from established accounting firms and qualified independent professionals across all jurisdictions.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-8">
              <div className="w-12 h-12 rounded-xl bg-navy-50 flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-navy-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="1.75" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="font-display text-2xl text-navy-950 mb-2">Accounting Firms</h3>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">Established practices looking to extend their reach through a managed engagement channel. We represent your firm professionally and manage all client interaction on your behalf.</p>
              <ul className="space-y-3 mb-8">
                {firmBenefits.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slate-600">
                    <svg className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/firms-freelancers/join"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-navy-950 text-white text-sm font-semibold hover:bg-navy-900 transition-colors shadow-sm">
                Apply as a Firm
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
            </div>
            <div className="bg-navy-950 rounded-xl p-8">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="1.75" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="font-display text-2xl text-white mb-2">Independent Professionals</h3>
              <p className="text-white/55 text-sm mb-6 leading-relaxed">Qualified independent accountants, bookkeepers, tax advisors, and finance professionals who wish to receive managed client engagements through the Accounting Body network.</p>
              <ul className="space-y-3 mb-8">
                {independentBenefits.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-white/65">
                    <svg className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/firms-freelancers/join"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-gold-500 text-navy-950 text-sm font-semibold hover:bg-gold-400 transition-colors shadow-gold">
                Apply as an Independent
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* DISCLAIMER */}
      <section className="bg-slate-50 border-t border-slate-200 py-10">
        <div className="container-site">
          <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
            Professionals listed within the Accounting Body network operate under our managed engagement framework. Accounting Body acts as the principal point of contact for all client engagements. All fees are collected by Accounting Body and disbursed to professionals following completion of agreed deliverables. Acceptance into the network is subject to satisfactory completion of our vetting process.
          </p>
        </div>
      </section>

    </main>
  )
}
