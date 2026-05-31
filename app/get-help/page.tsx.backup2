'use client'
import { useState, useEffect } from 'react'

// ── ET Service Categories ─────────────────────────────────────────────────────
const etServices = [
  {
    category: 'Accounting & Bookkeeping',
    icon: (<svg viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg' className='w-10 h-10'><rect width='40' height='40' rx='10' fill='#f0f7f4'/><rect x='11' y='9' width='14' height='22' rx='2' stroke='#1A4731' strokeWidth='1.6'/><path d='M17 15h6M17 19h6M17 23h4' stroke='#C9982A' strokeWidth='1.6' strokeLinecap='round'/></svg>),
    description: 'Monthly and quarterly bookkeeping, annual accounts, management reports and software setup.',
    items: [
      'Monthly and quarterly bookkeeping',
      'Annual accounts — sole traders, partnerships, limited companies',
      'Management accounts for investor reporting',
      'Xero, QuickBooks and Sage setup',
      'Accounts clean-up and catch-up',
      'Ethiopian statutory accounts under ETICPA standards',
    ],
  },
  {
    category: 'Tax Filing & Compliance',
    icon: (<svg viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg' className='w-10 h-10'><rect width='40' height='40' rx='10' fill='#f0f7f4'/><path d='M12 10h16v22l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5V10z' stroke='#1A4731' strokeWidth='1.6' strokeLinejoin='round'/><path d='M16 16h8M16 20h8M16 24h5' stroke='#C9982A' strokeWidth='1.6' strokeLinecap='round'/></svg>),
    description: 'UK, US, Canadian, and Ethiopian tax returns. Cross-border expertise for the diaspora.',
    items: [
      'UK Self Assessment — employment, rental, overseas income',
      'US Federal and state returns (1040, 1120, 1065), FBAR and FATCA',
      'Canadian T1 personal and T2 corporate returns',
      'Ethiopian income tax and business tax under ERCA',
      'VAT registration, quarterly returns and scheme advice',
      'Cross-border tax planning and double taxation relief',
      'Capital gains tax — property and investments',
    ],
  },
  {
    category: 'Business Consulting & Strategy',
    icon: (<svg viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg' className='w-10 h-10'><rect width='40' height='40' rx='10' fill='#f0f7f4'/><rect x='10' y='24' width='5' height='7' rx='1' fill='#1A4731' opacity='0.3' stroke='#1A4731' strokeWidth='1.4'/><rect x='17' y='18' width='5' height='13' rx='1' fill='#1A4731' opacity='0.5' stroke='#1A4731' strokeWidth='1.4'/><rect x='24' y='12' width='5' height='19' rx='1' fill='#1A4731' stroke='#1A4731' strokeWidth='1.4'/><path d='M11 10v22h20' stroke='#C9982A' strokeWidth='1.6' strokeLinecap='round'/></svg>),
    description: 'Business plans, financial modelling, diaspora investment structuring and strategic advisory.',
    items: [
      'Business plan development for startups and growth businesses',
      'Financial modelling, forecasting and scenario analysis',
      'Market entry strategy for Ethiopian businesses expanding internationally',
      'Diaspora investment in Ethiopia — structuring and regulatory navigation',
      'Business performance review and strategic advisory',
      'Exit planning and business valuation',
    ],
  },
  {
    category: 'Payroll Services',
    icon: (<svg viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg' className='w-10 h-10'><rect width='40' height='40' rx='10' fill='#f0f7f4'/><rect x='8' y='13' width='24' height='15' rx='3' stroke='#1A4731' strokeWidth='1.6'/><path d='M8 18h24' stroke='#1A4731' strokeWidth='1.6'/><rect x='12' y='22' width='6' height='2.5' rx='1' fill='#C9982A'/><circle cx='26' cy='23' r='2' fill='#1A4731' opacity='0.3'/><circle cx='29' cy='23' r='2' fill='#1A4731' opacity='0.6'/></svg>),
    description: 'UK PAYE, Ethiopian payroll, pension auto-enrolment and cross-border payroll compliance.',
    items: [
      'UK PAYE setup, monthly processing and RTI filing',
      'US payroll tax filing and W-2 preparation',
      'Ethiopian payroll — income tax withholding and ERCA compliance',
      'Payroll for diaspora businesses employing staff in Ethiopia',
      'Pension auto-enrolment (UK) and P11D benefits reporting',
    ],
  },
  {
    category: 'Company Formation & Registration',
    icon: (<svg viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg' className='w-10 h-10'><rect width='40' height='40' rx='10' fill='#f0f7f4'/><rect x='10' y='12' width='13' height='19' rx='1.5' stroke='#1A4731' strokeWidth='1.6'/><path d='M23 18h7v13H23' stroke='#1A4731' strokeWidth='1.6' strokeLinejoin='round'/><path d='M14 16h2M18 16h2M14 20h2M18 20h2M14 24h2M18 24h2' stroke='#C9982A' strokeWidth='1.4' strokeLinecap='round'/><path d='M16 31v-4h3v4' stroke='#1A4731' strokeWidth='1.4' strokeLinejoin='round'/></svg>),
    description: 'UK, US, Canadian and Ethiopian company registration handled end to end.',
    items: [
      'UK limited company — Companies House and HMRC registration',
      'USA LLC and corporation — state selection and EIN registration',
      'Canadian provincial company registration',
      'Ethiopian business registration — EIC and trade licence',
      'Registered office and company secretary services',
    ],
  },
  {
    category: 'Audit & Assurance',
    icon: (<svg viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg' className='w-10 h-10'><rect width='40' height='40' rx='10' fill='#f0f7f4'/><rect x='10' y='10' width='20' height='20' rx='3' stroke='#1A4731' strokeWidth='1.6'/><path d='M15 20l4 4 7-8' stroke='#C9982A' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'/></svg>),
    description: 'Statutory audit, ETICPA-standard audit, internal controls review and due diligence.',
    items: [
      'Statutory audit for UK companies (via FRC registered partner firm)',
      'ETICPA-standard audit for Ethiopian entities',
      'Internal audit and controls review',
      'Assurance reports for lenders, investors and grant bodies',
      'Due diligence for business acquisitions',
    ],
  },
  {
    category: 'Financial Planning & Advisory',
    icon: (<svg viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg' className='w-10 h-10'><rect width='40' height='40' rx='10' fill='#f0f7f4'/><path d='M10 30h22' stroke='#1A4731' strokeWidth='1.6' strokeLinecap='round'/><path d='M12 26l6-7 4 4 8-10' stroke='#C9982A' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'/><circle cx='12' cy='26' r='1.5' fill='#1A4731'/><circle cx='18' cy='19' r='1.5' fill='#1A4731'/><circle cx='22' cy='23' r='1.5' fill='#1A4731'/><circle cx='30' cy='13' r='1.5' fill='#C9982A'/></svg>),
    description: 'Personal financial planning, retirement planning and property investment structuring.',
    items: [
      'Personal financial planning — savings, investments, protection',
      'Retirement planning for diaspora professionals',
      'Property investment structuring — UK and Ethiopia',
      'Business finance and funding advisory',
    ],
  },
]

const etProcess = [
  { step: '01', title: 'Contact EthioTax',       desc: 'Reach us via WhatsApp, email or our website form. We respond within 24 hours, in English, Amharic or Afaan Oromoo.' },
  { step: '02', title: 'We Qualify Your Brief',   desc: 'EthioTax reviews your requirements, confirms scope and sources the right qualified professional from our network.' },
  { step: '03', title: 'Fixed-Fee Proposal',      desc: 'You receive a clear, fixed-fee proposal within 72 hours. No surprises. No hidden costs.' },
  { step: '04', title: 'EthioTax Manages Delivery', desc: 'We instruct the professional, monitor progress and quality-check every deliverable before it reaches you.' },
  { step: '05', title: 'Delivered to You',        desc: 'You receive the completed work from EthioTax. We follow up to confirm satisfaction and track your next deadline.' },
]

// ── AB Service data (unchanged) ───────────────────────────────────────────────
const services = [
  {
    name: 'Tax Advice',
    slug: 'tax-advice',
    desc: 'Personal and corporate tax planning, compliance, and advisory services delivered by our qualified tax specialists.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#EEF2FF"/>
        <path d="M12 28V14a2 2 0 012-2h8l6 6v10a2 2 0 01-2 2H14a2 2 0 01-2-2z" stroke="#0C1A3D" strokeWidth="1.6" strokeLinejoin="round"/>
        <path d="M22 12v6h6" stroke="#0C1A3D" strokeWidth="1.6" strokeLinejoin="round"/>
        <path d="M16 21h8M16 25h5" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    name: 'Bookkeeping',
    slug: 'bookkeeping',
    desc: 'Accurate, up-to-date financial records maintained by our bookkeeping professionals.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#F0FDF4"/>
        <rect x="10" y="11" width="20" height="18" rx="2" stroke="#0C1A3D" strokeWidth="1.6"/>
        <path d="M14 16h12M14 20h12M14 24h7" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    name: 'Payroll',
    slug: 'payroll',
    desc: 'End-to-end payroll management — processing, statutory submissions, payslips, and pension compliance.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#FFFBEB"/>
        <circle cx="20" cy="20" r="9" stroke="#0C1A3D" strokeWidth="1.6"/>
        <path d="M20 14v1.5M20 24.5V26M17 17.5c0-1.38 1.12-2.5 3-2.5s3 1.12 3 2.5c0 1.5-1.5 2-3 2.5-1.5.5-3 1.12-3 2.5 0 1.38 1.12 2.5 3 2.5s3-1.12 3-2.5" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    name: 'Financial Planning',
    slug: 'financial-planning',
    desc: 'Strategic financial planning, cash flow forecasting, and budgeting to help your business grow.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#EFF6FF"/>
        <path d="M11 29l6-7 4 4 8-10" stroke="#D4A017" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
]

const process = [
  { step: '01', title: 'Submit Your Brief',      desc: 'Complete a short service brief outlining your requirements. Our team reviews every submission personally.' },
  { step: '02', title: 'We Assess and Assign',   desc: 'Accounting Body reviews your brief and assigns the appropriate specialist from our professional network.' },
  { step: '03', title: 'Engagement Confirmed',   desc: 'We contact you with a proposed scope and fee. Once confirmed, your engagement begins under our full service standard.' },
]

export default function GetHelpPage() {
  const [isEthioTax, setIsEthioTax] = useState(false)

  useEffect(() => {
    setIsEthioTax(window.location.hostname.includes('ethiotax.com'))
  }, [])

  if (isEthioTax) {
    return (
      <main className="min-h-screen" style={{ backgroundColor: '#F7F8F4' }}>

        {/* ET HERO */}
        <section className="relative overflow-hidden py-20 md:py-28" style={{ backgroundColor: '#1A4731' }}>
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
              style={{ background: 'radial-gradient(ellipse at center top, #2d6a4f 0%, transparent 70%)' }} />
            <div className="absolute inset-0 opacity-[0.03]"
              style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
          </div>
          <div className="container-site relative z-10">
            <div className="max-w-3xl">
              <nav className="flex items-center gap-2 text-white/40 text-sm mb-10">
                <a href="/" className="hover:text-white/70 transition-colors">Home</a>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                <span className="text-white/70">Our Services</span>
              </nav>
              <span className="text-xs font-semibold uppercase tracking-widest mb-5 block" style={{ color: '#C9982A' }}>EthioTax Professional Services</span>
              <h1 className="font-display text-white text-4xl md:text-5xl lg:text-6xl mb-6 leading-tight" style={{ letterSpacing: '-0.02em' }}>
                Professional services,<br />managed by EthioTax
              </h1>
              <p className="text-white/70 text-xl leading-relaxed mb-4 max-w-2xl">
                EthioTax delivers accounting, tax, audit, payroll and business consulting to the Ethiopian community worldwide. You tell us what you need — we handle everything.
              </p>
              <p className="text-white/40 text-base leading-relaxed mb-10 max-w-2xl">
                Qualified professionals. Amharic and Afaan Oromoo service available. UK · USA · Canada · UAE · Ethiopia and beyond.
              </p>
              <div className="flex flex-wrap gap-4">
                <a href="/wa"
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 h-12 px-7 text-sm font-semibold rounded-lg transition-colors"
                  style={{ backgroundColor: '#C9982A', color: '#1A4731' }}>
                  Talk to us on WhatsApp
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </a>
                <a href="#services"
                  className="inline-flex items-center gap-2 h-12 px-7 text-sm font-semibold rounded-lg border border-white/30 text-white hover:bg-white/10 transition-colors">
                  View all services
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ET TRUST BAR */}
        <section className="border-b py-6" style={{ backgroundColor: '#f0f7f4', borderColor: '#d1e8db' }}>
          <div className="container-site">
            <div className="flex flex-wrap justify-center gap-8 md:gap-16">
              {[
                { value: '24hr', label: 'Response Guarantee' },
                { value: '72hr', label: 'Fixed-Fee Proposal' },
                { value: '100%', label: 'Quality Checked' },
                { value: 'Global', label: 'Diaspora Coverage' },
              ].map(stat => (
                <div key={stat.value} className="text-center">
                  <p className="font-display text-2xl font-bold" style={{ color: '#1A4731' }}>{stat.value}</p>
                  <p className="text-sm" style={{ color: '#2d6a4f' }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ET SERVICES */}
        <section id="services" className="py-20">
          <div className="container-site">
            <div className="max-w-2xl mb-14">
              <span className="text-xs font-semibold uppercase tracking-widest mb-3 block" style={{ color: '#1A4731' }}>What EthioTax Delivers</span>
              <h2 className="font-display text-3xl md:text-4xl mb-4" style={{ color: '#1a1a1a', letterSpacing: '-0.02em' }}>A full suite of professional services for the Ethiopian community</h2>
              <p className="text-lg leading-relaxed" style={{ color: '#4a5568' }}>
                Every service is delivered by qualified Ethiopian-origin professionals, coordinated and quality-checked by EthioTax from start to finish.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {etServices.map((s) => (
                <div key={s.category}
                  className="bg-white rounded-xl p-6 border hover:shadow-lg transition-all duration-200"
                  style={{ borderColor: '#1A4731' }}>
                  <div className="text-3xl mb-4">{s.icon}</div>
                  <h3 className="font-display text-lg mb-2" style={{ color: '#1A4731' }}>{s.category}</h3>
                  <p className="text-sm mb-4 leading-relaxed" style={{ color: '#4a5568' }}>{s.description}</p>
                  <ul className="space-y-1.5">
                    {s.items.map(item => (
                      <li key={item} className="flex items-start gap-2 text-sm" style={{ color: '#374151' }}>
                        <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#C9982A' }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <a href="/wa"
                    target="_blank" rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center gap-1 text-xs font-semibold transition-all"
                    style={{ color: '#C9982A' }}>
                    Get a free quote
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ET PROCESS */}
        <section className="py-20 relative overflow-hidden" style={{ backgroundColor: '#1A4731' }}>
          <div className="container-site relative z-10">
            <div className="text-center mb-14">
              <span className="text-xs font-semibold uppercase tracking-widest mb-4 block" style={{ color: '#C9982A' }}>How It Works</span>
              <h2 className="font-display text-4xl text-white mb-4 leading-tight">
                Five steps to a managed service
              </h2>
              <p className="text-white/60 text-lg max-w-xl mx-auto">
                EthioTax manages every stage. You deal with us — we handle the rest.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 max-w-5xl mx-auto">
              {etProcess.map((item) => (
                <div key={item.step} className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-base mb-4"
                    style={{ backgroundColor: '#C9982A', color: '#1A4731' }}>
                    {item.step}
                  </div>
                  <h3 className="font-display text-white text-sm mb-2">{item.title}</h3>
                  <p className="text-white/55 text-xs leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ET CTA */}
        <section className="py-16 bg-white border-t" style={{ borderColor: '#d1e8db' }}>
          <div className="container-site text-center">
            <h2 className="font-display text-3xl mb-4" style={{ color: '#1A4731' }}>Ready to get started?</h2>
            <p className="text-lg mb-8 max-w-xl mx-auto" style={{ color: '#4a5568' }}>
              Contact EthioTax today. We respond within 24 hours in English, Amharic or Afaan Oromoo.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a href="/wa"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 h-12 px-8 text-sm font-semibold rounded-lg transition-colors"
                style={{ backgroundColor: '#1A4731', color: '#ffffff' }}>
                Talk to us on WhatsApp
              </a>
              <a href="/contact"
                className="inline-flex items-center gap-2 h-12 px-8 text-sm font-semibold rounded-lg border transition-colors"
                style={{ borderColor: '#1A4731', color: '#1A4731' }}>
                Send us a message
              </a>
            </div>
          </div>
        </section>

      </main>
    )
  }

  // ── AB version (unchanged) ────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-surface">
      <section className="relative overflow-hidden bg-navy-950 py-20 md:py-28">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>
        <div className="container-site relative z-10">
          <div className="max-w-3xl">
            <nav className="flex items-center gap-2 text-white/40 text-sm mb-10">
              <a href="/" className="hover:text-white/70 transition-colors">Home</a>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              <span className="text-white/70">Professional Services</span>
            </nav>
            <span className="eyebrow text-gold-400 mb-5 block">Accounting Body Professional Services</span>
            <h1 className="font-display text-white text-4xl md:text-5xl lg:text-6xl mb-6 leading-tight" style={{ letterSpacing: '-0.02em' }}>
              Expert Accounting Services,<br />Managed by Us
            </h1>
            <p className="text-white/60 text-xl leading-relaxed mb-4 max-w-2xl">
              Accounting Body delivers professional accounting, tax, audit, and advisory services through our managed network of verified specialists. You engage us — we handle everything.
            </p>
            <p className="text-white/40 text-base leading-relaxed mb-10 max-w-2xl">
              Every engagement is managed directly by Accounting Body. We oversee scope, quality, communication, and delivery from start to finish.
            </p>
            <a href="#services"
              className="inline-flex items-center gap-2 h-12 px-7 text-sm font-semibold rounded-lg bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold">
              View Our Services
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </a>
          </div>
        </div>
      </section>
      <section id="services" className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block">Our Services</span>
            <h2 className="section-title mb-4">A full suite of professional accounting services</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Each service is delivered by qualified professionals within the Accounting Body network.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((s) => (
              <a key={s.name} href={`/get-help/${s.slug}`}
                className="group bg-white rounded-xl border border-slate-200 p-6 hover:border-gold-400 hover:shadow-lg transition-all duration-200 text-left block">
                <div className="mb-4">{s.icon}</div>
                <h3 className="font-display text-lg text-navy-950 mb-2 group-hover:text-navy-700 transition-colors">{s.name}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-gold-600 group-hover:gap-2 transition-all">
                  View service
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>
      <section className="section section-navy relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-gold-500/10 blur-3xl" />
        </div>
        <div className="container-site relative z-10">
          <div className="text-center mb-14">
            <span className="eyebrow text-gold-400 mb-4 block">How It Works</span>
            <h2 className="font-display text-4xl text-white mb-4 leading-tight">
              A managed engagement from brief to delivery
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Accounting Body manages every stage of your engagement. You deal with us — we handle the rest.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
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
    </main>
  )
}
