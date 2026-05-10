'use client'


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
    desc: 'Accurate, up-to-date financial records maintained by our bookkeeping professionals — so you always know where you stand.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#F0FDF4"/>
        <rect x="10" y="11" width="20" height="18" rx="2" stroke="#0C1A3D" strokeWidth="1.6"/>
        <path d="M14 16h12M14 20h12M14 24h7" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M10 15h2M10 20h2M10 25h2" stroke="#0C1A3D" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    name: 'Payroll',
    slug: 'payroll',
    desc: 'End-to-end payroll management — processing, statutory submissions, payslips, and pension compliance handled in full.',
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
    desc: 'Strategic financial planning, cash flow forecasting, and budgeting to help your business grow with confidence.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#EFF6FF"/>
        <path d="M11 29l6-7 4 4 8-10" stroke="#D4A017" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="29" cy="16" r="2" fill="#0C1A3D"/>
        <path d="M11 12v17h18" stroke="#0C1A3D" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    name: 'Audit',
    slug: 'audit',
    desc: 'Independent statutory and voluntary audits conducted by our qualified audit professionals to the highest professional standards.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#F5F3FF"/>
        <circle cx="19" cy="19" r="7" stroke="#0C1A3D" strokeWidth="1.6"/>
        <path d="M24 24l5 5" stroke="#0C1A3D" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M16 19h6M19 16v6" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    name: 'Business Advisory',
    slug: 'business-advisory',
    desc: 'Senior advisory support for growth, restructuring, investment, and strategic decision-making — delivered by experienced professionals.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#FFF7ED"/>
        <path d="M14 26c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="#0C1A3D" strokeWidth="1.6" strokeLinecap="round"/>
        <circle cx="20" cy="16" r="3" stroke="#0C1A3D" strokeWidth="1.6"/>
        <path d="M28 22c1.5.8 2.5 2.3 2.5 4" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round"/>
        <circle cx="28" cy="18" r="2" stroke="#D4A017" strokeWidth="1.4"/>
        <path d="M12 22c-1.5.8-2.5 2.3-2.5 4" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round"/>
        <circle cx="12" cy="18" r="2" stroke="#D4A017" strokeWidth="1.4"/>
      </svg>
    ),
  },
  {
    name: 'Company Formation',
    slug: 'company-formation',
    desc: 'Professional incorporation and company setup — structured correctly from day one, in any jurisdiction.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#ECFDF5"/>
        <rect x="11" y="18" width="18" height="11" rx="1.5" stroke="#0C1A3D" strokeWidth="1.6"/>
        <path d="M15 18v-3a5 5 0 0110 0v3" stroke="#0C1A3D" strokeWidth="1.6" strokeLinecap="round"/>
        <rect x="17" y="22" width="6" height="4" rx="1" fill="#D4A017"/>
      </svg>
    ),
  },
  {
    name: 'VAT & Sales Tax',
    slug: 'vat',
    desc: 'VAT, GST, and indirect tax compliance managed across jurisdictions — registration, returns, and advisory.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#FEF2F2"/>
        <rect x="10" y="13" width="20" height="14" rx="2" stroke="#0C1A3D" strokeWidth="1.6"/>
        <path d="M10 18h20" stroke="#0C1A3D" strokeWidth="1.4"/>
        <path d="M15 22.5h3M25 22.5h-4" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round"/>
        <circle cx="28" cy="12" r="4" fill="#0C1A3D"/>
        <path d="M26.5 12h3M28 10.5v3" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    name: 'Self Assessment',
    slug: 'self-assessment',
    desc: 'Personal tax return preparation and submission handled by our specialists — accurate, complete, and filed on time.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#F0FDF4"/>
        <rect x="11" y="10" width="18" height="20" rx="2" stroke="#0C1A3D" strokeWidth="1.6"/>
        <path d="M15 17l2 2 4-4" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M15 23l2 2 4-4" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M23 18h2M23 24h2" stroke="#0C1A3D" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
]

const process = [
  { step: '01', title: 'Submit Your Brief',        desc: 'Complete a short service brief outlining your requirements. Our team reviews every submission personally.' },
  { step: '02', title: 'We Assess and Assign',     desc: 'AccountingBody reviews your brief, determines the scope of work, and assigns the appropriate specialist from our professional network.' },
  { step: '03', title: 'Engagement Confirmed',     desc: 'We contact you with a proposed scope and fee. Once confirmed, your engagement begins under the full AccountingBody service standard.' },
]

export default function GetHelpPage() {
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
          <div className="max-w-3xl">
            <nav className="flex items-center gap-2 text-white/40 text-sm mb-10">
              <a href="/" className="hover:text-white/70 transition-colors">Home</a>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              <span className="text-white/70">Professional Services</span>
            </nav>
            <span className="eyebrow text-gold-400 mb-5 block">AccountingBody Professional Services</span>
            <h1 className="font-display text-white text-4xl md:text-5xl lg:text-6xl mb-6 leading-tight" style={{ letterSpacing: '-0.02em' }}>
              Expert Accounting Services,<br />Managed by Us
            </h1>
            <p className="text-white/60 text-xl leading-relaxed mb-4 max-w-2xl">
              AccountingBody delivers professional accounting, tax, audit, and advisory services through our managed network of verified specialists. You engage us — we handle everything.
            </p>
            <p className="text-white/40 text-base leading-relaxed mb-10 max-w-2xl">
              Every engagement is managed directly by AccountingBody. We oversee scope, quality, communication, and delivery from start to finish.
            </p>
            <a href="#services"
              className="inline-flex items-center gap-2 h-12 px-7 text-sm font-semibold rounded-lg bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold">
              View Our Services
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </a>
          </div>
        </div>
      </section>

      {/* SERVICES GRID */}
      <section id="services" className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block">Our Services</span>
            <h2 className="section-title mb-4">A full suite of professional accounting services</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Each service is delivered by qualified professionals within the AccountingBody network, operating under our managed engagement framework.
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
              AccountingBody manages every stage of your engagement. You deal with us — we handle the rest.
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
