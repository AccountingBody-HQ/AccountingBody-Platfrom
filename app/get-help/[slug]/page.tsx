'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'

const services: Record<string, {
  name: string
  tagline: string
  intro: string
  bullets: string[]
  whoFor: string
}> = {
  'tax-advice': {
    name: 'Tax Advice',
    tagline: 'Stay compliant, reduce your liability and keep more of what you earn.',
    intro: 'Tax is one of the most complex areas of managing a business or personal finances. Whether you are a sole trader, a company director, a landlord, or an individual with multiple income sources, getting your tax right is essential — not just to stay compliant, but to make sure you are never paying more than you need to.',
    bullets: [
      'Personal and business tax return preparation and submission',
      'Tax authority correspondence and enquiry handling',
      'Tax planning to legally minimise your liability',
      'Capital gains tax advice on property and investments',
      'Corporate tax computation and filing',
      'Contractor and freelancer tax status reviews',
    ],
    whoFor: 'Ideal for self-employed individuals, company directors, landlords, investors, and anyone who wants their tax affairs handled correctly and efficiently — wherever they are based.',
  },
  'bookkeeping': {
    name: 'Bookkeeping',
    tagline: 'Accurate books, real-time visibility, and no surprises at year end.',
    intro: 'Good bookkeeping is the foundation of every healthy business. Without accurate, up-to-date financial records, you cannot make informed decisions, file your returns, or understand how your business is truly performing. Yet for most business owners, keeping on top of the books is one of the most time-consuming tasks they face.',
    bullets: [
      'Day-to-day transaction recording and categorisation',
      'Bank reconciliation — monthly or weekly',
      'Accounts payable and receivable management',
      'Sales tax-ready bookkeeping aligned with local compliance requirements',
      'Management reports so you always know where you stand',
      'Setup and training on cloud software such as Xero or QuickBooks',
    ],
    whoFor: 'Perfect for small business owners, sole traders, and growing companies who want their finances kept in order — without spending hours doing it themselves.',
  },
  'payroll': {
    name: 'Payroll',
    tagline: 'Pay your team correctly, on time, every time — fully compliant.',
    intro: 'Running payroll is more than just transferring salaries. Employers must calculate income tax, social contributions, statutory entitlements, and pension obligations — and submit accurate reports to the relevant authorities every single pay period. A single mistake can result in penalties, unhappy employees, or both.',
    bullets: [
      'Monthly or weekly payroll processing for any team size',
      'Statutory submissions to tax authorities on time, every pay period',
      'Payslip generation and distribution',
      'Pension scheme setup and ongoing management',
      'Statutory pay calculations — sick pay, maternity, paternity',
      'Year-end reporting and benefits documentation',
    ],
    whoFor: 'Suitable for any employer — from a business with one employee to a company with hundreds of staff — who wants payroll handled professionally and compliantly.',
  },
  'financial-planning': {
    name: 'Financial Planning',
    tagline: 'A clear financial roadmap so your business grows with confidence.',
    intro: 'Most businesses react to their finances rather than planning ahead. Financial planning changes that. A skilled financial planner helps you understand where your money is going, where it needs to go, and how to get from where you are now to where you want to be — whether that means growing revenue, improving margins, securing funding, or planning an exit.',
    bullets: [
      'Cash flow forecasting — 3, 6, and 12-month projections',
      'Budget preparation and variance analysis',
      'Scenario planning for growth, investment, or downturns',
      'Profitability analysis by product, service, or department',
      'Business plan financial modelling for investors or lenders',
      'KPI dashboards so you track what actually matters',
    ],
    whoFor: 'Built for founders, directors, and business owners who want to make smarter financial decisions and build a business that is genuinely sustainable and scalable.',
  },
  'audit': {
    name: 'Audit',
    tagline: 'Independent, thorough, and delivered on time — every time.',
    intro: 'An audit provides independent verification that your financial statements are accurate and your business controls are sound. Whether required by law or undertaken voluntarily, a professionally conducted audit builds credibility with banks, investors, and partners — and gives leadership the confidence to make better decisions.',
    bullets: [
      'Statutory audits for companies that meet the legal audit threshold',
      'Voluntary audits for credibility with lenders or investors',
      'Internal audits to identify process weaknesses and risks',
      'Non-profit and charity audits',
      'Group audit coordination across multiple entities',
      'Post-audit recommendations to strengthen financial controls',
    ],
    whoFor: 'Essential for organisations required by law to be audited, and invaluable for any business that wants to demonstrate financial transparency to stakeholders, investors, or grant bodies.',
  },
  'business-advisory': {
    name: 'Business Advisory',
    tagline: 'Expert guidance to help you grow, protect, and future-proof your business.',
    intro: 'Running a business means constantly making decisions with incomplete information. A trusted business adviser gives you the experienced perspective you need — someone who has seen the challenges you are facing before, knows what works, and can help you avoid costly mistakes. This is practical, hands-on support tailored to your specific situation.',
    bullets: [
      'Strategic business reviews and growth planning',
      'Profitability improvement and cost reduction analysis',
      'Funding and investment readiness preparation',
      'Business restructuring and turnaround advisory',
      'Mergers, acquisitions, and exit planning',
      'Board-level financial mentoring for founders and directors',
    ],
    whoFor: 'For ambitious founders and directors who want more than just compliance — they want a trusted partner helping them build something that lasts.',
  },
  'company-formation': {
    name: 'Company Formation',
    tagline: 'Get your business set up correctly from the very first day.',
    intro: 'Forming a company can appear straightforward — but getting the structure, shareholding, governance, and director responsibilities right from the start makes an enormous difference. Mistakes made at formation can be expensive and time-consuming to unwind later. A professional handles it properly so you can focus on building your business.',
    bullets: [
      'Company incorporation — correctly structured from day one',
      'Shareholder and director setup and documentation',
      'Bespoke articles of association or equivalent governance documents',
      'Tax registration with the relevant authorities',
      'Registered address and corporate secretarial services',
      'Advice on the most tax-efficient ownership structure',
    ],
    whoFor: 'Perfect for anyone starting a new business, transitioning from sole trader to incorporated company, or restructuring an existing business.',
  },
  'vat': {
    name: 'VAT & Sales Tax',
    tagline: 'Indirect tax done right — compliant, optimised, and stress-free.',
    intro: 'VAT, GST, and sales tax are among the most error-prone areas of business finance globally. The rules are complex, vary significantly by jurisdiction, and the penalties for mistakes can be severe. Whether you are registering for the first time, managing ongoing returns, or trading across borders, professional support makes all the difference.',
    bullets: [
      'VAT, GST or sales tax registration when required',
      'Regular return preparation and submission',
      'Digital tax compliance setup and management',
      'Tax scheme selection to optimise cash flow',
      'Cross-border and international indirect tax advice',
      'Tax authority enquiry and investigation support',
    ],
    whoFor: 'Any business that is registered for indirect tax, approaching a registration threshold, or trading internationally — and wants to make sure they are fully compliant and on the most efficient scheme.',
  },
  'self-assessment': {
    name: 'Self Assessment',
    tagline: 'Your personal tax return filed accurately, on time, and stress-free.',
    intro: 'Millions of individuals around the world are required to file a personal tax return each year — including the self-employed, landlords, company directors, investors, and those with multiple income sources. Missing deadlines, making errors, or failing to claim allowable deductions can cost you significantly. A qualified professional makes sure your return is complete, correct, and optimised.',
    bullets: [
      'Full personal tax return preparation and submission',
      'Identification of all allowable expenses and deductions',
      'Rental income, foreign income, and investment income reporting',
      'Capital gains computation and reporting',
      'Tax payment planning and cashflow advice',
      'Tax authority query and penalty appeal handling',
    ],
    whoFor: 'Sole traders, landlords, company directors, freelancers, investors, and anyone required to file a personal tax return — wherever they are in the world.',
  },
}

const allServices = [
  { name: 'Tax Advice', slug: 'tax-advice' },
  { name: 'Bookkeeping', slug: 'bookkeeping' },
  { name: 'Payroll', slug: 'payroll' },
  { name: 'Financial Planning', slug: 'financial-planning' },
  { name: 'Audit', slug: 'audit' },
  { name: 'Business Advisory', slug: 'business-advisory' },
  { name: 'Company Formation', slug: 'company-formation' },
  { name: 'VAT & Sales Tax', slug: 'vat' },
  { name: 'Self Assessment', slug: 'self-assessment' },
]

export default function ServicePage({ params }: { params: { slug: string } }) {
  const service = services[params.slug]
  if (!service) notFound()

  const [form, setForm] = useState({
    name: '', email: '', phone: '', service_type: service.name, message: '', _h: ''
  })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/help-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Something went wrong')
      setStatus('success')
      setForm({ name: '', email: '', phone: '', service_type: service.name, message: '', _h: '' })
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  return (
    <main className="min-h-screen bg-surface">

      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-950 py-16 md:py-24">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
        </div>
        <div className="container-site relative z-10">
          <div className="max-w-3xl">
            <nav className="flex items-center gap-2 text-white/40 text-sm mb-8 flex-wrap">
              <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              <Link href="/get-help" className="hover:text-white/70 transition-colors">Get Help</Link>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              <span className="text-white/70">{service.name}</span>
            </nav>
            <span className="eyebrow text-gold-400 mb-4 block">Professional Services</span>
            <h1 className="font-display text-white text-4xl md:text-5xl mb-5 leading-tight" style={{ letterSpacing: '-0.02em' }}>
              {service.name}
            </h1>
            <p className="text-white/70 text-xl leading-relaxed max-w-2xl">
              {service.tagline}
            </p>
          </div>
        </div>
      </section>

      {/* INTRO + BULLETS */}
      <section className="section bg-white">
        <div className="container-site">
          <div className="max-w-3xl">
            <p className="text-slate-600 text-lg leading-relaxed mb-10">{service.intro}</p>
            <h2 className="font-display text-2xl text-navy-950 mb-6">What&apos;s included</h2>
            <ul className="space-y-3 mb-10">
              {service.bullets.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-gold-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-slate-600 text-base">{b}</span>
                </li>
              ))}
            </ul>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
              <h3 className="font-display text-lg text-navy-950 mb-2">Who is this for?</h3>
              <p className="text-slate-500 text-base leading-relaxed">{service.whoFor}</p>
            </div>
          </div>
        </div>
      </section>

      {/* FORM */}
      <section id="request-form" className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <span className="eyebrow mb-3 block">Submit a Brief</span>
              <h2 className="section-title mb-4">{service.name} — Submit Your Service Brief</h2>
              <p className="text-slate-500 text-lg">
                Outline your requirements below. Our team will review your brief and confirm your engagement within one business day.
              </p>
            </div>

            {status === 'success' ? (
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-12 text-center">
                <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-5">
                  <svg className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-display text-2xl text-navy-950 mb-3">Brief Received</h3>
                <p className="text-slate-600">Your service brief has been received by our team. We will review your requirements and confirm your engagement within one business day.</p>
                <button onClick={() => setStatus('idle')}
                  className="mt-6 text-sm font-medium text-navy-700 hover:text-gold-600 transition-colors">
                  Submit another brief
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-navy-950 mb-1.5">Full Name *</label>
                    <input required type="text" value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-navy-950 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-all"
                      placeholder="Your full name" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-navy-950 mb-1.5">Email Address *</label>
                    <input required type="email" value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-navy-950 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-all"
                      placeholder="you@example.com" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-navy-950 mb-1.5">Phone Number</label>
                    <input type="tel" value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-navy-950 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-all"
                      placeholder="Optional" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-navy-950 mb-1.5">Service Required</label>
                    <input type="text" readOnly value={service.name}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-navy-950 bg-slate-50 cursor-not-allowed" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-navy-950 mb-1.5">Tell us more about what you need *</label>
                  <textarea required rows={5} value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-navy-950 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-all resize-none"
                    placeholder="Please describe your situation, the scope of work required, and any relevant deadlines or jurisdictions..." />
                </div>
                {status === 'error' && (
                  <p className="text-red-600 text-sm">Something went wrong. Please try again or contact us directly.</p>
                )}
                <button type="submit" disabled={status === 'loading'}
                  className="w-full h-12 rounded-lg bg-navy-950 text-white font-semibold text-sm hover:bg-navy-900 transition-colors disabled:opacity-50 shadow-sm">
                  {status === 'loading' ? 'Submitting...' : 'Submit Service Brief →'}
                </button>
                {/* Honeypot — hidden from real users, bots fill it */}
                <input type="text" value={form._h} onChange={(e) => setForm({ ...form, _h: e.target.value })} style={{ display: 'none' }} tabIndex={-1} autoComplete="off" aria-hidden="true" />
                <p className="text-xs text-slate-400 text-center">
                  All briefs are reviewed by our team. We will confirm your engagement scope and fee before any work commences.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* OTHER SERVICES */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="text-center mb-10">
            <span className="eyebrow mb-3 block">Our Services</span>
            <h2 className="font-display text-3xl text-navy-950">Other services we deliver</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {allServices.filter(s => s.slug !== params.slug).map(s => (
              <Link key={s.slug} href={`/get-help/${s.slug}`}
                className="group bg-white rounded-xl border border-slate-200 p-5 hover:border-gold-400 hover:shadow-md transition-all duration-200 flex flex-col items-center text-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gold-500 flex items-center justify-center group-hover:bg-navy-950 transition-colors">
                  <svg className="w-5 h-5 text-navy-950 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <span className="font-semibold text-sm text-navy-950 group-hover:text-navy-700 leading-tight">{s.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

    </main>
  )
}
