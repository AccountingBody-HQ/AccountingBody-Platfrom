'use client'

const services = [
  {
    name: 'Entity Setup & Registration',
    slug: 'entity-setup',
    desc: 'We establish your legal entity in any jurisdiction — from incorporation and registration to local compliance and banking, fully managed by our specialists.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#EEF2FF"/>
        <rect x="10" y="10" width="20" height="20" rx="2" stroke="#0C1A3D" strokeWidth="1.6"/>
        <path d="M15 20h10M20 15v10" stroke="#D4A017" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M13 10v2M27 10v2M13 28v2M27 28v2" stroke="#0C1A3D" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    name: 'Global Payroll Management',
    slug: 'global-payroll-management',
    desc: 'End-to-end payroll processing across multiple countries — salary calculations, statutory deductions, payslips, and authority submissions handled in full.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#FFFBEB"/>
        <circle cx="20" cy="20" r="9" stroke="#0C1A3D" strokeWidth="1.6"/>
        <path d="M20 11c0 0 4 3 4 9s-4 9-4 9" stroke="#D4A017" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M20 11c0 0-4 3-4 9s4 9 4 9" stroke="#D4A017" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M11 20h18" stroke="#0C1A3D" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M12.5 16h15M12.5 24h15" stroke="#0C1A3D" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2 2"/>
      </svg>
    ),
  },
  {
    name: 'Employer of Record (EOR) Support',
    slug: 'eor-support',
    desc: 'Full payroll and compliance support for EOR providers operating across multiple jurisdictions — we act as your local delivery partner on the ground.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#F0FDF4"/>
        <path d="M20 12c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" stroke="#0C1A3D" strokeWidth="1.6"/>
        <path d="M12 28c0-4.42 3.58-8 8-8s8 3.58 8 8" stroke="#0C1A3D" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M28 18l2 2 4-4" stroke="#D4A017" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    name: 'Payroll Compliance & Reporting',
    slug: 'payroll-compliance',
    desc: 'Stay compliant with every local payroll regulation — tax filings, social contributions, statutory reporting, and authority submissions managed by our specialists.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#F5F3FF"/>
        <rect x="11" y="10" width="18" height="20" rx="2" stroke="#0C1A3D" strokeWidth="1.6"/>
        <path d="M15 17l2 2 4-4" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M15 23l2 2 4-4" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M23 18h2M23 24h2" stroke="#0C1A3D" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    name: 'Multi-Country Payroll',
    slug: 'multi-country-payroll',
    desc: 'Consolidated payroll operations across two or more countries — a single managed service coordinating local compliance, currency, and reporting for every entity.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#EFF6FF"/>
        <rect x="9" y="14" width="10" height="13" rx="1.5" stroke="#0C1A3D" strokeWidth="1.6"/>
        <rect x="21" y="10" width="10" height="17" rx="1.5" stroke="#0C1A3D" strokeWidth="1.6"/>
        <path d="M19 27h2" stroke="#0C1A3D" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M11 20h6M23 17h6M23 21h6" stroke="#D4A017" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    name: 'Payroll Advisory',
    slug: 'payroll-advisory',
    desc: 'Strategic payroll advisory for businesses expanding globally — jurisdiction selection, cost modelling, compliance strategy, and payroll system design.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#FFF7ED"/>
        <path d="M11 29l6-8 4 4 8-11" stroke="#D4A017" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="29" cy="14" r="2.5" fill="#0C1A3D"/>
        <path d="M11 12v17h18" stroke="#0C1A3D" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
]

const process = [
  { step: '01', title: 'Submit Your Brief', desc: 'Tell us which countries you operate in, your headcount, and what you need. Our team reviews every brief personally.' },
  { step: '02', title: 'We Scope and Assign', desc: 'Accounting Body reviews your requirements, determines the jurisdictions involved, and assigns the right specialists from our global network.' },
  { step: '03', title: 'Engagement Confirmed', desc: 'We present a proposed scope and fee. Once confirmed, your engagement is managed end-to-end under the Accounting Body service standard.' },
]

const stats = [
  { value: '150+', label: 'Countries covered' },
  { value: '24hr', label: 'Brief response time' },
  { value: '100%', label: 'Managed by Accounting Body' },
]

export default function GlobalPayrollPage() {
  return (
    <main className="min-h-screen bg-surface">

      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-950 py-20 md:py-28">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #1a3a6a 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-500/30 to-transparent" />
        </div>
        <div className="container-site relative z-10">
          <div className="max-w-3xl">
            <nav className="flex items-center gap-2 text-white/40 text-sm mb-10">
              <a href="/" className="hover:text-white/70 transition-colors">Home</a>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              <span className="text-white/70">Global Payroll</span>
            </nav>
            <span className="eyebrow text-gold-400 mb-5 block">Accounting Body Global Payroll</span>
            <h1 className="font-display text-white text-4xl md:text-5xl lg:text-6xl mb-6 leading-tight" style={{ letterSpacing: '-0.02em' }}>
              Global Payroll & Entity<br />Setup, Managed by Us
            </h1>
            <p className="text-white/60 text-xl leading-relaxed mb-4 max-w-2xl">
              Accounting Body delivers end-to-end global payroll and entity setup services through our managed network of verified specialists across 150+ countries. You engage us — we handle everything.
            </p>
            <p className="text-white/40 text-base leading-relaxed mb-10 max-w-2xl">
              Whether you are establishing a new entity abroad or running payroll across multiple countries, every engagement is managed directly by Accounting Body — from brief to delivery.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-stretch">
              <a href="#services"
                className="flex-1 inline-flex items-center justify-center gap-2 h-12 px-7 text-sm font-semibold rounded-lg bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold">
                View Our Services
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </a>
              <a href="/firms-freelancers/join"
                className="flex-1 inline-flex items-center justify-center gap-2 h-12 px-7 text-sm font-semibold rounded-lg border border-white/20 text-white/80 hover:bg-white/10 transition-colors">
                Join Our Network
              </a>
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-16 grid grid-cols-3 gap-6 max-w-xl">
            {stats.map((s) => (
              <div key={s.label} className="border-l border-white/10 pl-5 first:border-0 first:pl-0">
                <div className="font-display text-2xl text-gold-400 mb-1">{s.value}</div>
                <div className="text-xs text-white/40 leading-snug">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES GRID */}
      <section id="services" className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block">Our Services</span>
            <h2 className="section-title mb-4">Global payroll and entity services, in one managed engagement</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Each service is delivered by verified specialists within the Accounting Body network, coordinated across jurisdictions under our managed engagement framework.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((s) => (
              <a key={s.name} href={`/global-payroll/${s.slug}`}
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

      {/* WHO WE SERVE */}
      <section className="section bg-white">
        <div className="container-site">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <span className="eyebrow mb-3 block">Who We Serve</span>
            <h2 className="section-title mb-4">Built for businesses operating across borders</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Our global payroll and entity services are designed for organisations at every stage of international expansion.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { title: 'EOR Providers', desc: 'Employer of Record companies that need local payroll delivery across multiple countries.' },
              { title: 'Multinational Companies', desc: 'Businesses with existing entities in multiple jurisdictions that need consolidated payroll management.' },
              { title: 'Expanding Businesses', desc: 'Companies entering new markets that need entity setup and payroll infrastructure from day one.' },
              { title: 'PE & Investment Firms', desc: 'Private equity and investment firms managing portfolio companies across different countries.' },
            ].map((item) => (
              <div key={item.title} className="bg-slate-50 rounded-xl border border-slate-200 p-6">
                <div className="w-8 h-8 rounded-lg bg-navy-950 flex items-center justify-center mb-4">
                  <svg className="w-4 h-4 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-display text-base text-navy-950 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
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
            <span className="eyebrow text-gold-400 mb-4 block">How It Works</span>
            <h2 className="font-display text-4xl text-white mb-4 leading-tight">
              A managed engagement from brief to delivery
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Accounting Body manages every stage of your global payroll engagement. You deal with us — we coordinate everything across jurisdictions.
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

      {/* FIRMS CTA */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="bg-white rounded-2xl border border-slate-200 p-10 md:p-14 flex flex-col md:flex-row items-center gap-8 md:gap-14">
            <div className="flex-1">
              <span className="eyebrow mb-3 block">For Professionals</span>
              <h2 className="font-display text-3xl text-navy-950 mb-4 leading-tight">Are you a global payroll specialist?</h2>
              <p className="text-slate-500 text-lg leading-relaxed">
                Accounting Body works with verified payroll professionals and firms across 150+ countries. If you specialise in payroll, entity setup, or EOR support, apply to join our professional network.
              </p>
            </div>
            <div className="shrink-0 flex flex-col gap-3 w-full md:w-auto">
              <a href="/firms-freelancers/join"
                className="inline-flex items-center justify-center gap-2 h-12 px-8 text-sm font-semibold rounded-lg bg-navy-950 text-white hover:bg-navy-900 transition-colors shadow-sm whitespace-nowrap">
                Apply to Join Our Network
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </a>
              <a href="/firms-freelancers"
                className="inline-flex items-center justify-center gap-2 h-12 px-8 text-sm font-semibold rounded-lg border border-slate-300 text-navy-950 hover:border-navy-950 transition-colors whitespace-nowrap">
                How Our Network Works
              </a>
            </div>
          </div>
        </div>
      </section>

    </main>
  )
}
