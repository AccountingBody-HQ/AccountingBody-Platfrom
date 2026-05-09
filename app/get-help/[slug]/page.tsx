'use client'

import { useState } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

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
    intro: 'Tax is one of the most complex areas of running a business or managing personal finances in the UK. Whether you are a sole trader, limited company director, landlord, or an individual with multiple income streams, getting your tax right is essential — not just to avoid HMRC penalties, but to make sure you are not overpaying.',
    bullets: [
      'Personal and business tax return preparation and submission',
      'HMRC correspondence and enquiry handling',
      'Tax planning to legally minimise your liability',
      'Capital gains tax advice on property and investments',
      'Corporation tax computation and filing for limited companies',
      'IR35 status reviews for contractors and freelancers',
    ],
    whoFor: 'Ideal for self-employed individuals, limited company directors, landlords, investors, and anyone who wants to make sure their tax affairs are handled correctly and efficiently.',
  },
  'bookkeeping': {
    name: 'Bookkeeping',
    tagline: 'Accurate books, real-time visibility, and no surprises at year end.',
    intro: 'Good bookkeeping is the foundation of every healthy business. Without accurate, up-to-date financial records, you cannot make informed decisions, prepare tax returns, or understand how your business is really performing. Yet for most business owners, keeping on top of the books is one of the most time-consuming and frustrating tasks they face.',
    bullets: [
      'Day-to-day transaction recording and categorisation',
      'Bank reconciliation — monthly or weekly',
      'Accounts payable and receivable management',
      'VAT-ready bookkeeping aligned with MTD requirements',
      'Management reports so you always know where you stand',
      'Setup and training on cloud software such as Xero or QuickBooks',
    ],
    whoFor: 'Perfect for small business owners, sole traders, and growing companies who want their finances kept in order without spending hours doing it themselves.',
  },
  'payroll': {
    name: 'Payroll',
    tagline: 'Pay your team correctly, on time, every time — fully RTI compliant.',
    intro: 'Running payroll is more than just transferring salaries. In the UK, employers must calculate income tax, National Insurance contributions, statutory pay entitlements, pension auto-enrolment, and submit Real Time Information to HMRC every single pay run. A single mistake can result in penalties, unhappy employees, or both.',
    bullets: [
      'Monthly or weekly payroll processing for any team size',
      'RTI submissions to HMRC on time, every pay period',
      'Payslip generation and distribution',
      'Auto-enrolment pension setup and ongoing management',
      'Statutory pay calculations — SSP, SMP, SPP',
      'P60s, P45s, and P11D expenses and benefits reporting',
    ],
    whoFor: 'Suitable for any UK employer — from a business with one employee to a company with hundreds of staff — who wants payroll handled professionally and compliantly.',
  },
  'financial-planning': {
    name: 'Financial Planning',
    tagline: 'A clear financial roadmap so your business grows with confidence.',
    intro: 'Most businesses react to their finances rather than planning ahead. Financial planning changes that. A skilled financial planner helps you understand where your money is going, where it needs to go, and how to get from where you are now to where you want to be — whether that is growing revenue, improving margins, securing funding, or planning an exit.',
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
    intro: 'A statutory audit is a legal requirement for many UK companies, but even when it is not mandatory, a voluntary audit can provide enormous credibility with banks, investors, and suppliers. It demonstrates that your financial statements are accurate and that your business controls are sound.',
    bullets: [
      'Statutory audits for companies that meet the audit threshold',
      'Voluntary audits for credibility with lenders or investors',
      'Internal audits to identify process weaknesses and risks',
      'Charity and not-for-profit audits',
      'Group audit coordination across multiple entities',
      'Post-audit recommendations to improve financial controls',
    ],
    whoFor: 'Required by law for larger UK companies, and invaluable for any organisation that wants to demonstrate financial transparency to stakeholders, investors, or grant bodies.',
  },
  'business-advisory': {
    name: 'Business Advisory',
    tagline: 'Expert guidance to help you grow, protect, and future-proof your business.',
    intro: 'Running a business means constantly making decisions with incomplete information. A trusted business adviser gives you the experienced perspective you need — someone who has seen the challenges you are facing before, knows what works, and can help you avoid costly mistakes. This is not generic consultancy. It is practical, hands-on support tailored to your specific situation.',
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
    tagline: 'Get your limited company set up correctly from the very first day.',
    intro: 'Forming a limited company in the UK is straightforward on the surface — but getting the structure, shareholding, articles, and director responsibilities right from the start makes an enormous difference. Mistakes made at formation can be expensive and time-consuming to unwind later. A professional handles it properly so you can focus on building your business.',
    bullets: [
      'Companies House incorporation — correctly structured from day one',
      'Shareholder and director setup and documentation',
      'Bespoke articles of association where needed',
      'HMRC registration for Corporation Tax, VAT, and PAYE',
      'Registered office address service',
      'Advice on the most tax-efficient ownership structure',
    ],
    whoFor: 'Perfect for anyone starting a new business, switching from sole trader to limited company, or restructuring an existing business.',
  },
  'vat': {
    name: 'VAT',
    tagline: 'VAT done right — compliant, optimised, and MTD-ready.',
    intro: 'VAT is one of the most error-prone areas of UK business finance. The rules are complex, the penalties for mistakes are significant, and with Making Tax Digital now mandatory for most VAT-registered businesses, keeping up with the requirements demands time and expertise that most business owners simply do not have.',
    bullets: [
      'VAT registration when you hit the threshold — or voluntarily',
      'Quarterly VAT return preparation and submission',
      'Making Tax Digital (MTD) setup and compliance',
      'VAT scheme selection — Standard, Flat Rate, Cash Accounting',
      'International VAT advice for businesses trading across borders',
      'HMRC VAT enquiry and investigation support',
    ],
    whoFor: 'Any UK business that is VAT-registered or approaching the registration threshold — particularly those who want to make sure they are on the right scheme and fully MTD compliant.',
  },
  'self-assessment': {
    name: 'Self Assessment',
    tagline: 'Your tax return filed accurately, on time, and stress-free.',
    intro: 'Millions of people in the UK are required to file a Self Assessment tax return each year — including the self-employed, landlords, company directors, higher earners, and those with complex income. Missing the deadline, making errors, or failing to claim allowable expenses can cost you significantly. A qualified professional makes sure your return is complete, correct, and optimised.',
    bullets: [
      'Full Self Assessment tax return preparation and online submission',
      'Identification of all allowable expenses and deductions',
      'Rental income, foreign income, and investment income reporting',
      'Capital gains computation and reporting',
      'Payment on account calculations and planning',
      'HMRC query and penalty appeal handling',
    ],
    whoFor: 'Sole traders, landlords, company directors, freelancers, higher earners, and anyone else required to file a UK Self Assessment tax return.',
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
  { name: 'VAT', slug: 'vat' },
  { name: 'Self Assessment', slug: 'self-assessment' },
]

export default function ServicePage({ params }: { params: { slug: string } }) {
  const service = services[params.slug]
  if (!service) notFound()

  const [form, setForm] = useState({
    name: '', email: '', phone: '', service_type: service.name, message: ''
  })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    const { error } = await supabase.from('help_requests').insert([form])
    if (error) { console.error(error); setStatus('error') }
    else { setStatus('success'); setForm({ name: '', email: '', phone: '', service_type: service.name, message: '' }) }
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
              <span className="eyebrow mb-3 block">Get Matched</span>
              <h2 className="section-title mb-4">Find a {service.name} Professional</h2>
              <p className="text-slate-500 text-lg">
                Tell us what you need and we will connect you with the right expert within one business day.
              </p>
            </div>

            {status === 'success' ? (
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-12 text-center">
                <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-5">
                  <svg className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-display text-2xl text-navy-950 mb-3">Request Received</h3>
                <p className="text-slate-600">We will be in touch within one business day to connect you with the right professional.</p>
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
                    placeholder="Briefly describe your situation and what help you are looking for..." />
                </div>
                {status === 'error' && (
                  <p className="text-red-600 text-sm">Something went wrong. Please try again or email us directly.</p>
                )}
                <button type="submit" disabled={status === 'loading'}
                  className="w-full h-12 rounded-lg bg-navy-950 text-white font-semibold text-sm hover:bg-navy-900 transition-colors disabled:opacity-50 shadow-sm">
                  {status === 'loading' ? 'Sending your request...' : 'Find a Professional →'}
                </button>
                <p className="text-xs text-slate-400 text-center">
                  We will respond within one business day. Your details are never shared without your permission.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* OTHER SERVICES */}
      <section className="section bg-white">
        <div className="container-site">
          <h2 className="font-display text-2xl text-navy-950 mb-8">Other services you might need</h2>
          <div className="flex flex-wrap gap-3">
            {allServices.filter(s => s.slug !== params.slug).map(s => (
              <Link key={s.slug} href={`/get-help/${s.slug}`}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:border-gold-400 hover:text-navy-950 transition-all bg-slate-50 hover:bg-white">
                {s.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

    </main>
  )
}
