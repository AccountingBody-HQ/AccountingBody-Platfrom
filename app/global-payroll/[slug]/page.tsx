'use client'

import { useState } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const services: Record<string, {
  name: string
  tagline: string
  intro: string
  bullets: string[]
  whoFor: string
}> = {
  'entity-setup': {
    name: 'Entity Setup & Registration',
    tagline: 'Establish your legal presence in any country — structured correctly from day one.',
    intro: 'Expanding into a new country requires more than just registering a company name. The legal structure, shareholding, director requirements, tax registration, and banking setup all vary significantly by jurisdiction — and getting any of these wrong at formation can be costly to unwind. AccountingBody manages the entire entity setup process through our verified local specialists, so your new entity is compliant, correctly structured, and ready to operate from day one.',
    bullets: [
      'Company incorporation and legal entity registration in any jurisdiction',
      'Director, shareholder, and governance structure setup',
      'Local tax registration — corporate tax, VAT/GST, payroll tax',
      'Registered office and corporate secretarial services',
      'Business bank account guidance and setup support',
      'Ongoing compliance and annual filing management post-setup',
    ],
    whoFor: 'Businesses entering a new market for the first time, EOR providers establishing local delivery entities, multinationals restructuring their global footprint, and any organisation that needs a legal entity set up correctly in an unfamiliar jurisdiction.',
  },
  'global-payroll-management': {
    name: 'Global Payroll Management',
    tagline: 'Your global payroll, processed accurately and on time — every pay period, every country.',
    intro: 'Running payroll across borders is one of the most operationally complex tasks a growing business faces. Each country has its own tax rates, social contribution rules, statutory entitlements, and reporting deadlines. A single missed submission or miscalculated deduction can trigger penalties, damage employee trust, or create compliance liabilities. AccountingBody manages your global payroll end-to-end through our verified specialists in each jurisdiction — giving you a single point of contact for payroll across every country you operate in.',
    bullets: [
      'Monthly and weekly payroll processing across multiple countries',
      'Gross-to-net calculations including all local statutory deductions',
      'Payslip generation and distribution in local format',
      'Tax authority submissions on time in every jurisdiction',
      'Social contribution calculations and remittances',
      'Year-end reporting, P60 equivalents, and benefits documentation',
    ],
    whoFor: 'Multinational businesses running payroll in two or more countries, EOR providers that need reliable local payroll delivery, and any organisation that wants global payroll consolidated into a single professionally managed engagement.',
  },
  'eor-support': {
    name: 'Employer of Record (EOR) Support',
    tagline: 'The local payroll and compliance backbone your EOR operation depends on.',
    intro: 'Employer of Record providers operate in some of the most complex payroll and employment law environments in the world. To deliver reliable EOR services across multiple countries, you need a trusted local partner in each jurisdiction who understands the rules, manages the filings, and keeps your operation compliant. AccountingBody provides exactly that — acting as your local delivery partner for payroll, compliance, and entity management, so you can focus on growing your EOR business.',
    bullets: [
      'Local payroll processing and statutory submissions on behalf of EOR clients',
      'In-country employment tax and social contribution management',
      'Local entity setup and maintenance for EOR operations',
      'Payroll compliance monitoring as regulations change',
      'Multi-country coordination under a single AccountingBody engagement',
      'Confidential, white-label delivery for EOR providers',
    ],
    whoFor: 'EOR platforms and providers that need a reliable, vetted local partner network for payroll delivery, compliance, and entity management across the countries they serve.',
  },
  'payroll-compliance': {
    name: 'Payroll Compliance & Reporting',
    tagline: 'Every filing. Every deadline. Every jurisdiction. Managed.',
    intro: 'Payroll compliance is not a one-time task — it is an ongoing obligation that changes as regulations evolve, headcounts grow, and your business enters new markets. Missed filings, incorrect deductions, or late submissions can result in significant penalties, interest charges, and reputational risk. AccountingBody manages your payroll compliance obligations across every jurisdiction you operate in, ensuring every statutory report is accurate, every authority submission is on time, and every regulatory change is captured and applied.',
    bullets: [
      'Monthly and annual payroll tax filings in each jurisdiction',
      'Social security, pension, and insurance contribution submissions',
      'Statutory reporting — new hire notifications, leavers, changes',
      'Regulatory change monitoring and compliance updates',
      'Payroll audit support and internal reporting',
      'Tax authority enquiry and penalty appeal handling',
    ],
    whoFor: 'Any business with employees in one or more countries that needs full confidence their payroll obligations are being met correctly, consistently, and on time — without managing it internally.',
  },
  'multi-country-payroll': {
    name: 'Multi-Country Payroll',
    tagline: 'One engagement. Multiple countries. Complete coordination.',
    intro: 'Managing payroll across two or more countries introduces a level of complexity that quickly overwhelms internal teams. Different currencies, different pay cycles, different statutory rules, and different reporting authorities all need to be coordinated and reconciled. AccountingBody provides a single, consolidated multi-country payroll service — one point of contact, one managed engagement, full local compliance in every jurisdiction. We coordinate everything across our specialist network so you see a unified, accurate picture of your global payroll at all times.',
    bullets: [
      'Consolidated payroll management across two or more countries',
      'Single point of contact for your entire global payroll operation',
      'Multi-currency payroll processing and reconciliation',
      'Country-by-country statutory compliance and reporting',
      'Unified payroll reporting dashboard by country and entity',
      'Scalable as you enter new markets — add countries without adding complexity',
    ],
    whoFor: 'Businesses already operating in multiple countries that want to consolidate their payroll under a single professionally managed engagement, and those expanding internationally who want to build a scalable global payroll operation from the start.',
  },
  'payroll-advisory': {
    name: 'Payroll Advisory',
    tagline: 'Strategic payroll advice to build a global operation that scales.',
    intro: 'International expansion brings payroll decisions that have long-term cost and compliance implications — which entity structure to use, which jurisdictions to enter first, how to structure compensation across borders, and how to build a payroll infrastructure that grows with your business. AccountingBody provides senior payroll advisory support from specialists who have built and managed global payroll operations across multiple industries and jurisdictions. This is not generic advice — it is practical, experienced guidance tailored to your situation.',
    bullets: [
      'Jurisdiction selection and payroll cost modelling for new markets',
      'Entity structure advice to optimise payroll compliance and cost',
      'Payroll system selection and implementation advisory',
      'Compensation benchmarking and benefits structuring across borders',
      'EOR vs own-entity cost-benefit analysis by country',
      'Payroll process design for scaling international operations',
    ],
    whoFor: 'CFOs, Finance Directors, and HR leaders building or scaling a global workforce, EOR providers designing their delivery model, and PE-backed businesses expanding their international footprint.',
  },
}

const allServices = [
  { name: 'Entity Setup & Registration',    slug: 'entity-setup' },
  { name: 'Global Payroll Management',      slug: 'global-payroll-management' },
  { name: 'Employer of Record (EOR) Support', slug: 'eor-support' },
  { name: 'Payroll Compliance & Reporting', slug: 'payroll-compliance' },
  { name: 'Multi-Country Payroll',          slug: 'multi-country-payroll' },
  { name: 'Payroll Advisory',               slug: 'payroll-advisory' },
]

export default function GlobalPayrollServicePage({ params }: { params: { slug: string } }) {
  const service = services[params.slug]
  if (!service) notFound()

  const [form, setForm] = useState({
    name: '', email: '', phone: '', service_type: service.name, message: ''
  })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
    const { error } = await supabase.from('help_requests').insert([form])
    if (error) { console.error(error); setStatus('error') }
    else {
      setStatus('success')
      setForm({ name: '', email: '', phone: '', service_type: service.name, message: '' })
    }
  }

  return (
    <main className="min-h-screen bg-surface">

      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-950 py-16 md:py-24">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #1a3a6a 0%, transparent 70%)' }} />
        </div>
        <div className="container-site relative z-10">
          <div className="max-w-3xl">
            <nav className="flex items-center gap-2 text-white/40 text-sm mb-8 flex-wrap">
              <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              <Link href="/global-payroll" className="hover:text-white/70 transition-colors">Global Payroll</Link>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              <span className="text-white/70">{service.name}</span>
            </nav>
            <span className="eyebrow text-gold-400 mb-4 block">Global Payroll Services</span>
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
                  <label className="block text-sm font-semibold text-navy-950 mb-1.5">Tell us about your requirements *</label>
                  <textarea required rows={5} value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-navy-950 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-all resize-none"
                    placeholder="Please describe your situation — countries involved, employee headcount, current setup, and any relevant deadlines..." />
                </div>
                {status === 'error' && (
                  <p className="text-red-600 text-sm">Something went wrong. Please try again or contact us directly.</p>
                )}
                <button type="submit" disabled={status === 'loading'}
                  className="w-full h-12 rounded-lg bg-navy-950 text-white font-semibold text-sm hover:bg-navy-900 transition-colors disabled:opacity-50 shadow-sm">
                  {status === 'loading' ? 'Submitting...' : 'Submit Service Brief →'}
                </button>
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
            <span className="eyebrow mb-3 block">Global Payroll</span>
            <h2 className="font-display text-3xl text-navy-950">Other services we deliver</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {allServices.filter(s => s.slug !== params.slug).map(s => (
              <Link key={s.slug} href={`/global-payroll/${s.slug}`}
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
