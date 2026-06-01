'use client'
import { useState, useEffect } from 'react'

const etServices = [
  {
    category: 'Accounting & Bookkeeping',
    href: '/get-help/accounting-bookkeeping',
    description: 'Accurate books, annual accounts and management reports — handled end to end.',
    bullets: ['Monthly & quarterly bookkeeping', 'Annual accounts preparation', 'Xero, QuickBooks & Sage setup', 'ETICPA-standard Ethiopian accounts'],
  },
  {
    category: 'Tax Filing & Compliance',
    href: '/get-help/tax-filing-compliance',
    description: 'UK, US, Canadian and Ethiopian tax returns — cross-border expertise for the diaspora.',
    bullets: ['UK Self Assessment & corporation tax', 'US Federal returns, FBAR & FATCA', 'Ethiopian ERCA income & business tax', 'Cross-border tax planning & relief'],
  },
  {
    category: 'Business Consulting',
    href: '/get-help/business-consulting',
    description: 'Strategic advice, business plans and diaspora investment structuring.',
    bullets: ['Business plan & financial modelling', 'Diaspora investment in Ethiopia', 'Market entry & exit planning', 'Business performance & valuation'],
  },
  {
    category: 'Payroll Services',
    href: '/get-help/payroll-services',
    description: 'UK PAYE, Ethiopian payroll and pension compliance — fully managed.',
    bullets: ['UK PAYE setup & monthly processing', 'Ethiopian payroll & ERCA compliance', 'Pension auto-enrolment (UK)', 'US payroll tax & W-2 preparation'],
  },
  {
    category: 'Company Formation',
    href: '/get-help/company-formation',
    description: 'UK, US, Canadian and Ethiopian company registration — fast and fully compliant.',
    bullets: ['UK limited company — Companies House', 'USA LLC & corporation registration', 'Ethiopian business & trade licence', 'Registered office & company secretary'],
  },
  {
    category: 'Audit & Assurance',
    href: '/get-help/audit-assurance',
    description: 'Statutory audit, ETICPA-standard audit and assurance reports for lenders and investors.',
    bullets: ['Statutory audit via FRC registered firm', 'ETICPA-standard audit for Ethiopian entities', 'Internal audit & controls review', 'Due diligence for acquisitions'],
  },
  {
    category: 'Financial Planning',
    href: '/get-help/financial-planning-advisory',
    description: 'Personal financial planning, retirement planning and property investment structuring.',
    bullets: ['Personal financial planning', 'Retirement planning for diaspora professionals', 'Property investment — UK & Ethiopia', 'Business finance & funding advisory'],
  },
]

const etProcess = [
  { step: '01', title: 'Contact EthioTax', desc: 'Via WhatsApp, email or our website. We respond within 24 hours in English, Amharic or Afaan Oromoo.' },
  { step: '02', title: 'We Qualify Your Brief', desc: 'EthioTax reviews your requirements and sources the right qualified professional.' },
  { step: '03', title: 'Fixed-Fee Proposal', desc: 'A clear, fixed-fee proposal within 72 hours. No surprises. No hidden costs.' },
  { step: '04', title: 'EthioTax Manages Delivery', desc: 'We instruct, monitor and quality-check every deliverable before it reaches you.' },
  { step: '05', title: 'Delivered to You', desc: 'You receive the completed work. We follow up and track your next deadline.' },
]

function ServiceIcon({ category }: { category: string }) {
  const style = { width: 28, height: 28 }
  if (category === 'Accounting & Bookkeeping') return (
    <svg {...style} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="2" width="14" height="24" rx="2" stroke="#C9982A" strokeWidth="1.8"/>
      <rect x="4" y="2" width="4" height="24" fill="#C9982A" fillOpacity="0.2" rx="1"/>
      <path d="M10 8h6M10 13h6M10 18h4" stroke="white" strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M22 8v12M20 8h4M20 20h4" stroke="#C9982A" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
  if (category === 'Tax Filing & Compliance') return (
    <svg {...style} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 3h16v22l-2.5-1.8-2.5 1.8-2.5-1.8-2.5 1.8-2.5-1.8-2.5 1.8V3z" stroke="#C9982A" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M10 10h8M10 14h8M10 18h5" stroke="white" strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M10 7h3" stroke="#C9982A" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
  if (category === 'Business Consulting') return (
    <svg {...style} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="17" width="5" height="8" rx="1" fill="#C9982A" fillOpacity="0.35" stroke="#C9982A" strokeWidth="1.5"/>
      <rect x="11" y="12" width="5" height="13" rx="1" fill="#C9982A" fillOpacity="0.55" stroke="#C9982A" strokeWidth="1.5"/>
      <rect x="19" y="5" width="5" height="20" rx="1" fill="#C9982A" stroke="#C9982A" strokeWidth="1.5"/>
      <path d="M3 24h22" stroke="white" strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M5 15l7-7 4 4 7-9" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (category === 'Payroll Services') return (
    <svg {...style} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="8" width="24" height="14" rx="2.5" stroke="#C9982A" strokeWidth="1.8"/>
      <path d="M2 13h24" stroke="#C9982A" strokeWidth="1.6"/>
      <rect x="6" y="17" width="8" height="3" rx="1.5" fill="#C9982A"/>
      <circle cx="21" cy="18.5" r="2" fill="white" fillOpacity="0.3"/>
      <circle cx="24" cy="18.5" r="2" fill="white" fillOpacity="0.6"/>
    </svg>
  )
  if (category === 'Company Formation') return (
    <svg {...style} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="10" width="15" height="17" rx="1.5" stroke="#C9982A" strokeWidth="1.8"/>
      <path d="M17 14h9v13H17" stroke="#C9982A" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M6 14h4M6 18h4M6 22h4" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M20 18h4M20 22h4" stroke="#C9982A" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M8 27v-5h3v5" stroke="#C9982A" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  )
  if (category === 'Audit & Assurance') return (
    <svg {...style} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="22" height="22" rx="3.5" stroke="#C9982A" strokeWidth="1.8"/>
      <path d="M8 14l5 5 8-9" stroke="#C9982A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 10h4M3 18h4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
  return (
    <svg {...style} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 24h22" stroke="#C9982A" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M5 20l7-9 5 5 7-11" stroke="#C9982A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="5" cy="20" r="2" fill="white"/>
      <circle cx="12" cy="11" r="2" fill="white"/>
      <circle cx="17" cy="16" r="2" fill="white"/>
      <circle cx="24" cy="5" r="2.5" fill="#C9982A"/>
    </svg>
  )
}

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
      <main className="min-h-screen bg-[#F7F8F4]">

        {/* HERO */}
        <section className="py-20 bg-[#1A4731]">
          <div className="max-w-5xl mx-auto px-6">
            <div className="max-w-3xl">
              <nav className="flex items-center gap-2 text-sm mb-6">
                <a href="/" style={{ color: '#C9982A' }}>Home</a>
                <span className="text-green-200 mx-1">›</span>
                <span className="text-green-200">Our Services</span>
              </nav>
              <h1 className="font-display text-white text-4xl md:text-5xl mb-6">
                Professional services,<br />managed by EthioTax
              </h1>
              <p className="text-green-100 text-xl max-w-3xl mb-10">
                Our team of specialists delivers accounting, tax, audit, payroll and business consulting — fully managed, to the highest professional standards. UK · USA · Canada · UAE · Ethiopia.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a href="/wa" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center justify-center h-[52px] w-full sm:w-[220px] bg-[#C9982A] text-[#1A4731] text-sm font-bold rounded-xl hover:opacity-90 transition-opacity">
                  Talk to us on WhatsApp →
                </a>
                <a href="#services"
                  className="inline-flex items-center justify-center h-[52px] w-full sm:w-[220px] border-2 border-white/30 text-white text-sm font-semibold rounded-xl hover:bg-white/10 transition-colors">
                  View all services
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST BAR */}
        <section className="bg-white border-b border-[#e8f0eb] py-8">
          <div className="container-site">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { value: '24hr', label: 'Response Guarantee', sub: 'Every inquiry, every channel' },
                { value: '72hr', label: 'Fixed-Fee Proposal', sub: 'Clear scope, clear price' },
                { value: '100%', label: 'Quality Checked', sub: 'Every deliverable reviewed' },
                { value: 'Global', label: 'Diaspora Coverage', sub: 'UK, USA, Canada, UAE & Ethiopia' },
              ].map(stat => (
                <div key={stat.value} className="text-center py-4 px-2">
                  <p className="font-display text-[28px] font-extrabold text-[#1A4731] mb-1">{stat.value}</p>
                  <p className="text-[#1A4731] text-[13px] font-semibold mb-0.5">{stat.label}</p>
                  <p className="text-gray-400 text-[12px]">{stat.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SERVICES */}
        <section id="services" className="py-20 md:py-24">
          <div className="container-site">
            <div className="max-w-2xl mb-14">
              <p className="text-[#1A4731] text-[11px] font-bold uppercase tracking-[0.12em] mb-3">What EthioTax Delivers</p>
              <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-gray-900 mb-4">
                A full suite of professional services for the Ethiopian community
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed">
                Every service is managed and quality-checked by EthioTax. Qualified Ethiopian-origin specialists. Amharic and Afaan Oromoo available.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {etServices.map((s) => (
                <a key={s.category} href={s.href}
                  className="group flex flex-col bg-white rounded-2xl p-6 md:p-8 border-l-4 border border-[#1A4731] hover:border-l-[#C9982A] hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 no-underline">
                  <div className="flex items-start gap-5 mb-5">
                    <div className="w-[52px] h-[52px] rounded-xl bg-[#1A4731] flex items-center justify-center shrink-0">
                      <ServiceIcon category={s.category} />
                    </div>
                    <div>
                      <h3 className="font-display text-[17px] font-bold text-gray-900 mb-1.5">{s.category}</h3>
                      <p className="text-gray-500 text-sm leading-relaxed">{s.description}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6 pl-[72px]">
                    {s.bullets.map(b => (
                      <div key={b} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#C9982A] shrink-0 mt-[7px]" />
                        <span className="text-gray-600 text-[13px] leading-snug">{b}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pl-[72px] flex items-center justify-between pt-4 border-t border-gray-100">
                    <span className="text-[#C9982A] text-[13px] font-bold">Get a free quote →</span>
                    <span className="text-gray-400 text-[12px]">Opens WhatsApp</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* PROCESS */}
        <section className="bg-[#1A4731] py-20 md:py-24">
          <div className="container-site">
            <div className="text-center mb-14">
              <p className="text-[#C9982A] text-[11px] font-bold uppercase tracking-[0.12em] mb-4">How It Works</p>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-white tracking-tight mb-4">
                Five steps to a managed service
              </h2>
              <p className="text-white/55 text-lg max-w-md mx-auto">
                EthioTax manages every stage. You deal with us — we handle the rest.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-8 max-w-5xl mx-auto">
              {etProcess.map((item) => (
                <div key={item.step} className="flex flex-col items-center text-center">
                  <div className="w-[52px] h-[52px] rounded-full bg-[#C9982A] flex items-center justify-center text-[#1A4731] font-extrabold text-base mb-4 shrink-0">
                    {item.step}
                  </div>
                  <h3 className="font-display text-white text-[15px] font-bold mb-2">{item.title}</h3>
                  <p className="text-white/50 text-[12px] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* DISCLAIMER */}
        <section className="py-12 bg-white border-t" style={{ borderColor: '#e8f0eb' }}>
          <div className="max-w-5xl mx-auto px-6">
            <p className="text-gray-400 text-xs leading-relaxed max-w-3xl">
              All professional work, filings and regulatory submissions are prepared and carried out by qualified specialists. EthioTax manages your engagement and maintains service standards throughout.
            </p>
          </div>
        </section>
        {/* CTA */}
        <section className="bg-white border-t border-[#e8f0eb] py-20">
          <div className="container-site">
            <div className="max-w-lg mx-auto text-center">
              <h2 className="font-display text-3xl md:text-4xl font-bold text-[#1A4731] tracking-tight mb-4">
                Ready to get started?
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed mb-10">
                Contact EthioTax today. We respond within 24 hours in English, Amharic or Afaan Oromoo.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <a href="/wa" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center justify-center h-[52px] w-full sm:w-[220px] bg-[#1A4731] text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity">
                  Talk to us on WhatsApp
                </a>
                <a href="/contact"
                  className="inline-flex items-center justify-center h-[52px] w-full sm:w-[220px] border-2 border-[#1A4731] text-[#1A4731] text-sm font-semibold rounded-xl hover:bg-[#f0f7f4] transition-colors">
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
            {[
              { name: 'Tax Advice', slug: 'tax-advice', desc: 'Personal and corporate tax planning, compliance, and advisory services delivered by our qualified tax specialists.' },
              { name: 'Bookkeeping', slug: 'bookkeeping', desc: 'Accurate, up-to-date financial records maintained by our bookkeeping professionals.' },
              { name: 'Payroll', slug: 'payroll', desc: 'End-to-end payroll management — processing, statutory submissions, payslips, and pension compliance.' },
              { name: 'Financial Planning', slug: 'financial-planning', desc: 'Strategic financial planning, cash flow forecasting, and budgeting to help your business grow.' },
              { name: 'Audit', slug: 'audit', desc: 'Statutory and voluntary audit services delivered by our qualified audit professionals.' },
              { name: 'Business Advisory', slug: 'business-advisory', desc: 'Strategic business advice, growth planning, and performance improvement for ambitious businesses.' },
              { name: 'Company Formation', slug: 'company-formation', desc: 'Register your limited company correctly and compliantly — fast, affordable, and stress-free.' },
              { name: 'VAT & Sales Tax', slug: 'vat', desc: 'VAT registration, returns, and advisory — MTD compliant and always on time.' },
              { name: 'Self Assessment', slug: 'self-assessment', desc: 'Personal tax return preparation and submission handled by our specialists — accurate and filed on time.' },
            ].map((s) => (
              <a key={s.name} href={'/get-help/' + s.slug}
                className="group bg-white rounded-xl border border-slate-200 p-6 hover:border-gold-400 hover:shadow-lg transition-all duration-200 block">
                <h3 className="font-display text-lg text-navy-950 mb-2">{s.name}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
              </a>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
