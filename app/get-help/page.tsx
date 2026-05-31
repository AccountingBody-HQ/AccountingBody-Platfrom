'use client'
import { useState, useEffect } from 'react'

const etServices = [
  {
    category: 'Accounting & Bookkeeping',
    description: 'Accurate books, annual accounts and management reports — handled end to end by qualified professionals.',
    bullets: ['Monthly & quarterly bookkeeping', 'Annual accounts — sole traders & limited companies', 'Xero, QuickBooks & Sage setup', 'ETICPA-standard Ethiopian accounts'],
  },
  {
    category: 'Tax Filing & Compliance',
    description: 'UK, US, Canadian and Ethiopian tax returns — cross-border expertise built for the diaspora.',
    bullets: ['UK Self Assessment & corporation tax', 'US Federal returns, FBAR & FATCA', 'Ethiopian ERCA income & business tax', 'Cross-border tax planning & double taxation relief'],
  },
  {
    category: 'Business Consulting',
    description: 'Strategic advice, business plans and diaspora investment structuring for growth-stage businesses.',
    bullets: ['Business plan development & financial modelling', 'Diaspora investment in Ethiopia — structuring & regulatory navigation', 'Market entry strategy & exit planning', 'Business performance review & valuation'],
  },
  {
    category: 'Payroll Services',
    description: 'UK PAYE, Ethiopian payroll and pension compliance — fully managed from setup to filing.',
    bullets: ['UK PAYE setup, monthly processing & RTI filing', 'Ethiopian payroll & ERCA compliance', 'Pension auto-enrolment (UK) & P11D reporting', 'US payroll tax & W-2 preparation'],
  },
  {
    category: 'Company Formation',
    description: 'UK, US, Canadian and Ethiopian company registration handled end to end — fast and fully compliant.',
    bullets: ['UK limited company — Companies House & HMRC', 'USA LLC & corporation — state selection & EIN', 'Ethiopian business registration & trade licence', 'Registered office & company secretary services'],
  },
  {
    category: 'Audit & Assurance',
    description: 'Statutory audit, ETICPA-standard audit and assurance reports for lenders, investors and grant bodies.',
    bullets: ['Statutory audit via FRC registered partner firm', 'ETICPA-standard audit for Ethiopian entities', 'Internal audit & controls review', 'Due diligence for business acquisitions'],
  },
  {
    category: 'Financial Planning & Advisory',
    description: 'Personal financial planning, retirement planning and property investment structuring for diaspora professionals.',
    bullets: ['Personal financial planning — savings, investments & protection', 'Retirement planning for diaspora professionals', 'Property investment structuring — UK & Ethiopia', 'Business finance & funding advisory'],
  },
]

const etProcess = [
  { step: '01', title: 'Contact EthioTax', desc: 'Via WhatsApp, email or our website. We respond within 24 hours in English, Amharic or Afaan Oromoo.' },
  { step: '02', title: 'We Qualify Your Brief', desc: 'EthioTax reviews your requirements and sources the right qualified professional from our network.' },
  { step: '03', title: 'Fixed-Fee Proposal', desc: 'A clear, fixed-fee proposal within 72 hours. No surprises. No hidden costs.' },
  { step: '04', title: 'EthioTax Manages Delivery', desc: 'We instruct, monitor and quality-check every deliverable before it reaches you.' },
  { step: '05', title: 'Delivered to You', desc: 'You receive the completed work. We follow up and proactively track your next deadline.' },
]

const icons: Record<string, JSX.Element> = {
  'Accounting & Bookkeeping': (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="2" width="13" height="24" rx="1.5" stroke="#C9982A" strokeWidth="1.8"/>
      <rect x="5" y="2" width="4" height="24" rx="1" fill="#C9982A" fillOpacity="0.25"/>
      <path d="M11 8h5M11 13h5M11 18h4" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M21 9v10" stroke="#C9982A" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M19 9h4M19 19h4" stroke="#C9982A" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  'Tax Filing & Compliance': (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 4h14v20l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4V4z" stroke="#C9982A" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M10 10h8M10 14h8M10 18h5" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  'Business Consulting': (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 24h22" stroke="#C9982A" strokeWidth="1.8" strokeLinecap="round"/>
      <rect x="4" y="16" width="5" height="8" rx="1" fill="#C9982A" fillOpacity="0.3" stroke="#C9982A" strokeWidth="1.4"/>
      <rect x="12" y="11" width="5" height="13" rx="1" fill="#C9982A" fillOpacity="0.5" stroke="#C9982A" strokeWidth="1.4"/>
      <rect x="20" y="5" width="5" height="19" rx="1" fill="#C9982A" stroke="#C9982A" strokeWidth="1.4"/>
      <path d="M6 14l5-5 4 4 6-8" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  'Payroll Services': (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="8" width="22" height="14" rx="2.5" stroke="#C9982A" strokeWidth="1.8"/>
      <path d="M3 13h22" stroke="#C9982A" strokeWidth="1.6"/>
      <rect x="7" y="17" width="7" height="3" rx="1.5" fill="#C9982A"/>
      <circle cx="21" cy="18.5" r="2" fill="white" fillOpacity="0.35"/>
      <circle cx="24" cy="18.5" r="2" fill="white" fillOpacity="0.6"/>
    </svg>
  ),
  'Company Formation': (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="10" width="14" height="16" rx="1.5" stroke="#C9982A" strokeWidth="1.8"/>
      <path d="M17 14h8v12H17" stroke="#C9982A" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M7 14h3M7 18h3M7 22h3" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M20 18h3M20 22h3" stroke="#C9982A" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M9 26v-4h3v4" stroke="#C9982A" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  ),
  'Audit & Assurance': (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="20" height="20" rx="3" stroke="#C9982A" strokeWidth="1.8"/>
      <path d="M9 14l4 4 7-8" stroke="#C9982A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 11h3M4 17h3" stroke="white" strokeWidth="1.4" strokeLinecap="round" fillOpacity="0.5"/>
    </svg>
  ),
  'Financial Planning & Advisory': (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 24h22" stroke="#C9982A" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M6 20l6-8 5 5 7-10" stroke="#C9982A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="6" cy="20" r="2" fill="white"/>
      <circle cx="12" cy="12" r="2" fill="white"/>
      <circle cx="17" cy="17" r="2" fill="white"/>
      <circle cx="24" cy="7" r="2.5" fill="#C9982A"/>
    </svg>
  ),
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
      <main className="min-h-screen" style={{ backgroundColor: '#F7F8F4' }}>

        {/* HERO */}
        <section style={{ backgroundColor: '#1A4731', paddingTop: '80px', paddingBottom: '80px' }}>
          <div className="container-site">
            <div style={{ maxWidth: '680px' }}>
              <nav style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '32px' }}>
                <a href="/" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Home</a>
                <span>›</span>
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>Our Services</span>
              </nav>
              <p style={{ color: '#C9982A', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '20px' }}>
                EthioTax Professional Services
              </p>
              <h1 style={{ color: '#ffffff', fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.025em', marginBottom: '24px', fontFamily: 'var(--font-display, serif)' }}>
                Professional services,<br />managed by EthioTax
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '18px', lineHeight: 1.7, marginBottom: '40px', maxWidth: '560px' }}>
                You tell us what you need — EthioTax sources the right qualified professional, manages the engagement, and delivers quality-checked work. UK · USA · Canada · UAE · Ethiopia.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <a href="/wa" target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '52px', padding: '0 32px', backgroundColor: '#C9982A', color: '#1A4731', fontSize: '14px', fontWeight: 700, borderRadius: '10px', textDecoration: 'none', minWidth: '210px' }}>
                  Talk to us on WhatsApp →
                </a>
                <a href="#services"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '52px', padding: '0 32px', backgroundColor: 'transparent', color: '#ffffff', fontSize: '14px', fontWeight: 600, borderRadius: '10px', textDecoration: 'none', border: '2px solid rgba(255,255,255,0.35)', minWidth: '210px' }}>
                  View all services
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST BAR */}
        <section style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e8f0eb', padding: '32px 0' }}>
          <div className="container-site">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
              {[
                { value: '24hr', label: 'Response Guarantee', sub: 'Every inquiry, every channel' },
                { value: '72hr', label: 'Fixed-Fee Proposal', sub: 'Clear scope, clear price' },
                { value: '100%', label: 'Quality Checked', sub: 'Every deliverable reviewed' },
                { value: 'Global', label: 'Diaspora Coverage', sub: 'UK, USA, Canada, UAE & Ethiopia' },
              ].map(stat => (
                <div key={stat.value} style={{ textAlign: 'center', padding: '16px 8px' }}>
                  <p style={{ color: '#1A4731', fontSize: '28px', fontWeight: 800, marginBottom: '4px', fontFamily: 'var(--font-display, serif)' }}>{stat.value}</p>
                  <p style={{ color: '#1A4731', fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>{stat.label}</p>
                  <p style={{ color: '#9ca3af', fontSize: '12px' }}>{stat.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SERVICES */}
        <section id="services" style={{ padding: '80px 0' }}>
          <div className="container-site">
            <div style={{ maxWidth: '600px', marginBottom: '56px' }}>
              <p style={{ color: '#1A4731', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>What EthioTax Delivers</p>
              <h2 style={{ color: '#111827', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: '16px', fontFamily: 'var(--font-display, serif)' }}>
                A full suite of professional services for the Ethiopian community
              </h2>
              <p style={{ color: '#6b7280', fontSize: '17px', lineHeight: 1.7 }}>
                Every service is coordinated and quality-checked by EthioTax. Qualified Ethiopian-origin professionals. Amharic and Afaan Oromoo available.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
              {etServices.map((s, idx) => (
                <a key={s.category} href="/wa" target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    padding: '32px',
                    borderLeft: '4px solid #1A4731',
                    border: '1px solid #e8f0eb',
                    borderLeftWidth: '4px',
                    borderLeftColor: '#1A4731',
                    textDecoration: 'none',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    gridColumn: idx === 6 ? '1 / -1' : 'auto',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget
                    el.style.borderLeftColor = '#C9982A'
                    el.style.boxShadow = '0 8px 30px rgba(0,0,0,0.10)'
                    el.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget
                    el.style.borderLeftColor = '#1A4731'
                    el.style.boxShadow = 'none'
                    el.style.transform = 'translateY(0)'
                  }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', marginBottom: '16px' }}>
                    <div style={{ width: '52px', height: '52px', borderRadius: '12px', backgroundColor: '#1A4731', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {icons[s.category]}
                    </div>
                    <div>
                      <h3 style={{ color: '#111827', fontSize: '18px', fontWeight: 700, marginBottom: '6px', fontFamily: 'var(--font-display, serif)' }}>{s.category}</h3>
                      <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: 1.6 }}>{s.description}</p>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '24px', paddingLeft: '72px' }}>
                    {s.bullets.map(b => (
                      <div key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#C9982A', flexShrink: 0, marginTop: '7px' }} />
                        <span style={{ color: '#374151', fontSize: '13px', lineHeight: 1.5 }}>{b}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ paddingLeft: '72px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: '#C9982A', fontSize: '13px', fontWeight: 700 }}>Get a free quote →</span>
                    <span style={{ color: '#9ca3af', fontSize: '12px' }}>Opens WhatsApp</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* PROCESS */}
        <section style={{ backgroundColor: '#1A4731', padding: '80px 0' }}>
          <div className="container-site">
            <div style={{ textAlign: 'center', marginBottom: '56px' }}>
              <p style={{ color: '#C9982A', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '16px' }}>How It Works</p>
              <h2 style={{ color: '#ffffff', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '16px', fontFamily: 'var(--font-display, serif)' }}>
                Five steps to a managed service
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '17px', maxWidth: '480px', margin: '0 auto' }}>
                EthioTax manages every stage. You deal with us — we handle the rest.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '24px', maxWidth: '1000px', margin: '0 auto' }}>
              {etProcess.map((item) => (
                <div key={item.step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#C9982A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1A4731', fontWeight: 800, fontSize: '16px', marginBottom: '16px' }}>
                    {item.step}
                  </div>
                  <h3 style={{ color: '#ffffff', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>{item.title}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section style={{ backgroundColor: '#ffffff', borderTop: '1px solid #e8f0eb', padding: '72px 0' }}>
          <div className="container-site">
            <div style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center' }}>
              <h2 style={{ color: '#1A4731', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '16px', fontFamily: 'var(--font-display, serif)' }}>
                Ready to get started?
              </h2>
              <p style={{ color: '#6b7280', fontSize: '17px', lineHeight: 1.7, marginBottom: '40px' }}>
                Contact EthioTax today. We respond within 24 hours in English, Amharic or Afaan Oromoo.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px' }}>
                <a href="/wa" target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '52px', padding: '0 36px', backgroundColor: '#1A4731', color: '#ffffff', fontSize: '14px', fontWeight: 700, borderRadius: '10px', textDecoration: 'none', minWidth: '210px' }}>
                  Talk to us on WhatsApp
                </a>
                <a href="/contact"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '52px', padding: '0 36px', backgroundColor: 'transparent', color: '#1A4731', fontSize: '14px', fontWeight: 600, borderRadius: '10px', textDecoration: 'none', border: '2px solid #1A4731', minWidth: '210px' }}>
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
              { name: 'Tax Advice', slug: 'tax-advice', desc: 'Personal and corporate tax planning, compliance, and advisory services.' },
              { name: 'Bookkeeping', slug: 'bookkeeping', desc: 'Accurate, up-to-date financial records maintained by our professionals.' },
              { name: 'Payroll', slug: 'payroll', desc: 'End-to-end payroll management — processing, submissions and pension compliance.' },
              { name: 'Financial Planning', slug: 'financial-planning', desc: 'Strategic financial planning, cash flow forecasting, and budgeting.' },
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
