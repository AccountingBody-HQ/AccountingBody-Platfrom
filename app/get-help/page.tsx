
'use client'
import { useState, useEffect } from 'react'

const etServices = [
  {
    category: 'Accounting & Bookkeeping',
    description: 'Accurate books, annual accounts and management reports — handled end to end.',
    bullets: ['Monthly & quarterly bookkeeping', 'Annual accounts preparation', 'Xero, QuickBooks & Sage setup', 'ETICPA-standard Ethiopian accounts'],
    svg: '<svg viewBox=\'0 0 48 48\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'><rect x=\'10\' y=\'6\' width=\'20\' height=\'36\' rx=\'2\' stroke=\'#C9982A\' strokeWidth=\'2\'/><rect x=\'10\' y=\'6\' width=\'6\' height=\'36\' rx=\'1\' fill=\'#C9982A\' opacity=\'0.2\'/><path d=\'M18 16h9M18 22h9M18 28h6\' stroke=\'#ffffff\' strokeWidth=\'2\' strokeLinecap=\'round\'/><path d=\'M34 18v16\' stroke=\'#C9982A\' strokeWidth=\'2\' strokeLinecap=\'round\'/><path d=\'M31 18h6M31 34h6\' stroke=\'#C9982A\' strokeWidth=\'1.6\' strokeLinecap=\'round\'/></svg>',
  },
  {
    category: 'Tax Filing & Compliance',
    description: 'UK, US, Canadian and Ethiopian tax returns — cross-border expertise for the diaspora.',
    bullets: ['UK Self Assessment & corporation tax', 'US Federal returns, FBAR & FATCA', 'Ethiopian ERCA income & business tax', 'Cross-border tax planning & relief'],
    svg: '<svg viewBox=\'0 0 48 48\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'><path d=\'M14 8h20v32l-3-2-3 2-3-2-3 2-3-2-3 2-3-2V8z\' stroke=\'#C9982A\' strokeWidth=\'2\' strokeLinejoin=\'round\'/><path d=\'M19 18h10M19 24h10M19 30h7\' stroke=\'#ffffff\' strokeWidth=\'2\' strokeLinecap=\'round\'/><path d=\'M19 13h4\' stroke=\'#C9982A\' strokeWidth=\'1.6\' strokeLinecap=\'round\'/></svg>',
  },
  {
    category: 'Business Consulting',
    description: 'Strategic advice, business plans and diaspora investment structuring.',
    bullets: ['Business plan development', 'Financial modelling & forecasting', 'Diaspora investment in Ethiopia', 'Market entry & exit planning'],
    svg: '<svg viewBox=\'0 0 48 48\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'><rect x=\'8\' y=\'28\' width=\'8\' height=\'12\' rx=\'1\' fill=\'#C9982A\' opacity=\'0.4\' stroke=\'#C9982A\' strokeWidth=\'1.8\'/><rect x=\'20\' y=\'20\' width=\'8\' height=\'20\' rx=\'1\' fill=\'#C9982A\' opacity=\'0.6\' stroke=\'#C9982A\' strokeWidth=\'1.8\'/><rect x=\'32\' y=\'10\' width=\'8\' height=\'30\' rx=\'1\' fill=\'#C9982A\' stroke=\'#C9982A\' strokeWidth=\'1.8\'/><path d=\'M8 8v34h34\' stroke=\'#ffffff\' strokeWidth=\'2\' strokeLinecap=\'round\'/></svg>',
  },
  {
    category: 'Payroll Services',
    description: 'UK PAYE, Ethiopian payroll and pension compliance — fully managed.',
    bullets: ['UK PAYE setup & monthly processing', 'Ethiopian payroll & ERCA compliance', 'Pension auto-enrolment (UK)', 'US payroll tax & W-2 preparation'],
    svg: '<svg viewBox=\'0 0 48 48\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'><rect x=\'8\' y=\'14\' width=\'32\' height=\'22\' rx=\'3\' stroke=\'#C9982A\' strokeWidth=\'2\'/><path d=\'M8 22h32\' stroke=\'#C9982A\' strokeWidth=\'2\'/><rect x=\'13\' y=\'28\' width=\'9\' height=\'4\' rx=\'1.5\' fill=\'#C9982A\'/><circle cx=\'34\' cy=\'30\' r=\'3\' fill=\'#ffffff\' opacity=\'0.3\'/><circle cx=\'38\' cy=\'30\' r=\'3\' fill=\'#ffffff\' opacity=\'0.6\'/></svg>',
  },
  {
    category: 'Company Formation',
    description: 'UK, US, Canadian and Ethiopian company registration handled end to end.',
    bullets: ['UK limited company — Companies House', 'USA LLC & corporation registration', 'Ethiopian business & trade licence', 'Registered office & company secretary'],
    svg: '<svg viewBox=\'0 0 48 48\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'><rect x=\'8\' y=\'16\' width=\'20\' height=\'26\' rx=\'2\' stroke=\'#C9982A\' strokeWidth=\'2\'/><path d=\'M28 24h12v18H28\' stroke=\'#C9982A\' strokeWidth=\'2\' strokeLinejoin=\'round\'/><path d=\'M13 22h4M19 22h4M13 28h4M19 28h4M13 34h4M19 34h4\' stroke=\'#ffffff\' strokeWidth=\'1.6\' strokeLinecap=\'round\'/><path d=\'M32 30h4M32 36h4\' stroke=\'#C9982A\' strokeWidth=\'1.6\' strokeLinecap=\'round\'/><path d=\'M17 42v-6h4v6\' stroke=\'#C9982A\' strokeWidth=\'1.6\' strokeLinejoin=\'round\'/></svg>',
  },
  {
    category: 'Audit & Assurance',
    description: 'Statutory audit, ETICPA-standard audit and assurance reports for lenders and investors.',
    bullets: ['Statutory audit via FRC registered firm', 'ETICPA-standard audit for Ethiopian entities', 'Internal audit & controls review', 'Due diligence for acquisitions'],
    svg: '<svg viewBox=\'0 0 48 48\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'><rect x=\'8\' y=\'8\' width=\'32\' height=\'32\' rx=\'4\' stroke=\'#C9982A\' strokeWidth=\'2\'/><path d=\'M17 24l6 6 10-12\' stroke=\'#C9982A\' strokeWidth=\'2.5\' strokeLinecap=\'round\' strokeLinejoin=\'round\'/><path d=\'M8 20h4M8 28h4\' stroke=\'#ffffff\' strokeWidth=\'1.4\' strokeLinecap=\'round\' opacity=\'0.5\'/></svg>',
  },
  {
    category: 'Financial Planning',
    description: 'Personal financial planning, retirement planning and property investment structuring.',
    bullets: ['Personal financial planning', 'Retirement planning for diaspora professionals', 'Property investment — UK & Ethiopia', 'Business finance & funding advisory'],
    svg: '<svg viewBox=\'0 0 48 48\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'><path d=\'M8 40h34\' stroke=\'#C9982A\' strokeWidth=\'2\' strokeLinecap=\'round\'/><path d=\'M12 34l8-10 6 6 10-14\' stroke=\'#C9982A\' strokeWidth=\'2.5\' strokeLinecap=\'round\' strokeLinejoin=\'round\'/><circle cx=\'12\' cy=\'34\' r=\'2.5\' fill=\'#ffffff\'/><circle cx=\'20\' cy=\'24\' r=\'2.5\' fill=\'#ffffff\'/><circle cx=\'26\' cy=\'30\' r=\'2.5\' fill=\'#ffffff\'/><circle cx=\'36\' cy=\'16\' r=\'2.5\' fill=\'#C9982A\'/></svg>',
  },
]

const etProcess = [
  { step: '01', title: 'Contact EthioTax', desc: 'Reach us via WhatsApp, email or our website. We respond within 24 hours in English, Amharic or Afaan Oromoo.' },
  { step: '02', title: 'We Qualify Your Brief', desc: 'EthioTax reviews your requirements and sources the right qualified professional from our network.' },
  { step: '03', title: 'Fixed-Fee Proposal', desc: 'You receive a clear, fixed-fee proposal within 72 hours. No surprises. No hidden costs.' },
  { step: '04', title: 'EthioTax Manages Delivery', desc: 'We instruct the professional, monitor progress and quality-check every deliverable.' },
  { step: '05', title: 'Delivered to You', desc: 'You receive the completed work from EthioTax. We follow up and track your next deadline.' },
]

const abServices = [
  { name: 'Tax Advice', slug: 'tax-advice', desc: 'Personal and corporate tax planning, compliance, and advisory services.' },
  { name: 'Bookkeeping', slug: 'bookkeeping', desc: 'Accurate, up-to-date financial records maintained by our professionals.' },
  { name: 'Payroll', slug: 'payroll', desc: 'End-to-end payroll management — processing, submissions and pension compliance.' },
  { name: 'Financial Planning', slug: 'financial-planning', desc: 'Strategic financial planning, cash flow forecasting, and budgeting.' },
]

const abProcess = [
  { step: '01', title: 'Submit Your Brief', desc: 'Complete a short service brief. Our team reviews every submission personally.' },
  { step: '02', title: 'We Assess and Assign', desc: 'We determine the scope of work and assign the appropriate specialist.' },
  { step: '03', title: 'Engagement Confirmed', desc: 'We contact you with a proposed scope and fee. Your engagement begins immediately.' },
]

export default function GetHelpPage() {
  const [isEthioTax, setIsEthioTax] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setIsEthioTax(window.location.hostname.includes('ethiotax.com'))
    setMounted(true)
  }, [])

  if (!mounted) return null

  if (isEthioTax) {
    return (
      <main className="min-h-screen" style={{ backgroundColor: '#F7F8F4' }}>

        {/* HERO */}
        <section className="relative overflow-hidden py-24 md:py-32" style={{ backgroundColor: '#1A4731' }}>
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
              <h1 className="font-display text-white text-5xl md:text-6xl mb-6 leading-tight" style={{ letterSpacing: '-0.02em' }}>
                Professional services,<br />managed by EthioTax
              </h1>
              <p className="text-white/70 text-xl leading-relaxed mb-10 max-w-2xl">
                You tell us what you need — EthioTax sources the right qualified professional, manages the engagement, and delivers quality-checked work. UK · USA · Canada · UAE · Ethiopia.
              </p>
              <div className="flex flex-wrap gap-4">
                <a href="/wa" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 text-sm font-semibold rounded-xl transition-all hover:opacity-90"
                  style={{ backgroundColor: '#C9982A', color: '#1A4731', height: '52px', minWidth: '220px', padding: '0 32px' }}>
                  Talk to us on WhatsApp →
                </a>
                <a href="#services"
                  className="inline-flex items-center justify-center gap-2 text-sm font-semibold rounded-xl border-2 text-white hover:bg-white/10 transition-all"
                  style={{ borderColor: 'rgba(255,255,255,0.4)', height: '52px', minWidth: '220px', padding: '0 32px' }}>
                  View all services
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST BAR */}
        <section className="border-b py-8" style={{ backgroundColor: '#ffffff', borderColor: '#e8f0eb' }}>
          <div className="container-site">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { value: '24hr', label: 'Response Guarantee', sub: 'Every inquiry, every channel' },
                { value: '72hr', label: 'Fixed-Fee Proposal', sub: 'Clear scope, clear price' },
                { value: '100%', label: 'Quality Checked', sub: 'Every deliverable reviewed' },
                { value: 'Global', label: 'Diaspora Coverage', sub: 'UK, USA, Canada, UAE, Ethiopia' },
              ].map(stat => (
                <div key={stat.value} className="text-center py-4">
                  <p className="font-display text-3xl font-bold mb-1" style={{ color: '#1A4731' }}>{stat.value}</p>
                  <p className="text-sm font-semibold mb-0.5" style={{ color: '#1A4731' }}>{stat.label}</p>
                  <p className="text-xs" style={{ color: '#6b7280' }}>{stat.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SERVICES */}
        <section id="services" className="py-24">
          <div className="container-site">
            <div className="max-w-2xl mb-16">
              <span className="text-xs font-semibold uppercase tracking-widest mb-3 block" style={{ color: '#1A4731' }}>What EthioTax Delivers</span>
              <h2 className="font-display text-4xl mb-4" style={{ color: '#1a1a1a', letterSpacing: '-0.02em' }}>
                A full suite of professional services
              </h2>
              <p className="text-lg leading-relaxed" style={{ color: '#4a5568' }}>
                Every service is coordinated and quality-checked by EthioTax. Qualified Ethiopian-origin professionals. Amharic and Afaan Oromoo available.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" style={{ alignItems: 'stretch' }}>
              {etServices.map((s) => (
                <a key={s.category} href="/wa" target="_blank" rel="noopener noreferrer"
                  className="group flex flex-col rounded-2xl p-7 transition-all duration-300 cursor-pointer hover:shadow-2xl hover:-translate-y-1"
                  style={{ textDecoration: 'none', backgroundColor: '#ffffff', border: '2px solid #1A4731' }}>
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-105"
                    style={{ backgroundColor: '#1A4731' }}
                    dangerouslySetInnerHTML={{ __html: s.svg }} />
                  <h3 className="font-display text-xl font-bold mb-2"
                    style={{ color: '#1A4731' }}>{s.category}</h3>
                  <p className="text-sm leading-relaxed mb-5" style={{ color: '#6b7280' }}>{s.description}</p>
                  <ul className="space-y-2.5 flex-1">
                    {s.bullets.map(b => (
                      <li key={b} className="flex items-start gap-2.5 text-sm" style={{ color: '#374151' }}>
                        <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#C9982A' }} />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 pt-5 flex items-center justify-between" style={{ borderTop: '1px solid #e8f0eb' }}>
                    <span className="text-sm font-bold" style={{ color: '#C9982A' }}>Get a free quote →</span>
                    <span className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 group-hover:translate-x-1"
                      style={{ backgroundColor: '#1A4731' }}>
                      <svg className="w-4 h-4" fill="none" stroke="#ffffff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* PROCESS */}
        <section className="py-24 relative overflow-hidden" style={{ backgroundColor: '#1A4731' }}>
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10" style={{ backgroundColor: '#C9982A', filter: 'blur(80px)' }} />
            <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-10" style={{ backgroundColor: '#C9982A', filter: 'blur(80px)' }} />
          </div>
          <div className="container-site relative z-10">
            <div className="text-center mb-16">
              <span className="text-xs font-semibold uppercase tracking-widest mb-4 block" style={{ color: '#C9982A' }}>How It Works</span>
              <h2 className="font-display text-4xl text-white mb-4" style={{ letterSpacing: '-0.02em' }}>
                Five steps to a managed service
              </h2>
              <p className="text-white/60 text-lg max-w-xl mx-auto">
                EthioTax manages every stage. You deal with us — we handle the rest.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-8 max-w-5xl mx-auto">
              {etProcess.map((item, i) => (
                <div key={item.step} className="flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg mb-5 shadow-lg"
                    style={{ backgroundColor: '#C9982A', color: '#1A4731' }}>
                    {item.step}
                  </div>
                  {i < etProcess.length - 1 && (
                    <div className="hidden md:block absolute mt-7 ml-28 w-full h-px opacity-20" style={{ backgroundColor: '#C9982A' }} />
                  )}
                  <h3 className="font-display text-white text-sm font-semibold mb-2">{item.title}</h3>
                  <p className="text-white/50 text-xs leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-white border-t" style={{ borderColor: '#e8f0eb' }}>
          <div className="container-site">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="font-display text-4xl mb-4" style={{ color: '#1A4731', letterSpacing: '-0.02em' }}>Ready to get started?</h2>
              <p className="text-lg mb-10" style={{ color: '#4a5568' }}>
                Contact EthioTax today. We respond within 24 hours in English, Amharic or Afaan Oromoo.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <a href="/wa" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center justify-center text-sm font-semibold rounded-xl transition-all hover:opacity-90"
                  style={{ backgroundColor: '#1A4731', color: '#ffffff', height: '52px', minWidth: '220px', padding: '0 32px' }}>
                  Talk to us on WhatsApp
                </a>
                <a href="/contact"
                  className="inline-flex items-center justify-center text-sm font-semibold rounded-xl border-2 transition-all hover:bg-slate-50"
                  style={{ borderColor: '#1A4731', color: '#1A4731', height: '52px', minWidth: '220px', padding: '0 32px' }}>
                  Send us a message
                </a>
              </div>
            </div>
          </div>
        </section>

      </main>
    )
  }

  return (
    <main className="min-h-screen bg-surface">
      <section className="relative overflow-hidden bg-navy-950 py-20 md:py-28">
        <div className="container-site relative z-10">
          <div className="max-w-3xl">
            <span className="eyebrow text-gold-400 mb-5 block">Accounting Body Professional Services</span>
            <h1 className="font-display text-white text-4xl md:text-5xl lg:text-6xl mb-6 leading-tight" style={{ letterSpacing: '-0.02em' }}>
              Expert Accounting Services,<br />Managed by Us
            </h1>
            <p className="text-white/60 text-xl leading-relaxed mb-10 max-w-2xl">
              Accounting Body delivers professional accounting, tax, audit, and advisory services through our managed network of verified specialists.
            </p>
            <a href="#services" className="inline-flex items-center gap-2 h-12 px-7 text-sm font-semibold rounded-lg bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors">
              View Our Services
            </a>
          </div>
        </div>
      </section>
      <section id="services" className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block">Our Services</span>
            <h2 className="section-title mb-4">A full suite of professional accounting services</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {abServices.map((s) => (
              <a key={s.name} href={'/get-help/' + s.slug}
                className="group bg-white rounded-xl border border-slate-200 p-6 hover:border-gold-400 hover:shadow-lg transition-all duration-200 block">
                <h3 className="font-display text-lg text-navy-950 mb-2">{s.name}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
              </a>
            ))}
          </div>
        </div>
      </section>
      <section className="section section-navy">
        <div className="container-site">
          <div className="text-center mb-14">
            <span className="eyebrow text-gold-400 mb-4 block">How It Works</span>
            <h2 className="font-display text-4xl text-white mb-4">A managed engagement from brief to delivery</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {abProcess.map((item) => (
              <div key={item.step} className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-gold-500 flex items-center justify-center text-navy-950 font-bold text-lg mb-5">{item.step}</div>
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
