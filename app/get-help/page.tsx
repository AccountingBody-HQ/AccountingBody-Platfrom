'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const services = [
  { name: 'Tax Advice',         icon: '📊', desc: 'Personal and business tax planning, returns and HMRC compliance.' },
  { name: 'Bookkeeping',        icon: '📒', desc: 'Day-to-day financial records, bank reconciliations and reporting.' },
  { name: 'Payroll',            icon: '💷', desc: 'End-to-end payroll processing, RTI submissions and auto-enrolment.' },
  { name: 'Financial Planning', icon: '📈', desc: 'Strategic financial planning, forecasting and cash flow management.' },
  { name: 'Audit',              icon: '🔍', desc: 'Statutory and voluntary audits for businesses of all sizes.' },
  { name: 'Business Advisory',  icon: '🤝', desc: 'Strategic advice to grow, scale and protect your business.' },
  { name: 'Company Formation',  icon: '🏢', desc: 'Register your limited company quickly and correctly from day one.' },
  { name: 'VAT',                icon: '🧾', desc: 'VAT registration, returns, MTD compliance and HMRC advice.' },
  { name: 'Self Assessment',    icon: '📝', desc: 'Personal tax returns filed accurately and submitted on time.' },
]

const steps = [
  { step: '01', title: 'Tell us what you need', desc: 'Fill in the short form below describing the accounting help you are looking for.' },
  { step: '02', title: 'We match you',          desc: 'Our team reviews your request and connects you with a vetted professional within one business day.' },
  { step: '03', title: 'Get expert help',       desc: 'Speak directly with your matched professional and get the support you need.' },
]

export default function GetHelpPage() {
  const [form,   setForm]   = useState({ name: '', email: '', phone: '', service_type: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    const { error } = await supabase.from('help_requests').insert([form])
    if (error) { console.error(error); setStatus('error') }
    else { setStatus('success'); setForm({ name: '', email: '', phone: '', service_type: '', message: '' }) }
  }

  return (
    <main className="min-h-screen bg-surface">

      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-950 py-16 md:py-24">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>
        <div className="container-site relative z-10">
          <div className="max-w-3xl">
            <nav className="flex items-center gap-2 text-white/40 text-sm mb-8">
              <a href="/" className="hover:text-white/70 transition-colors">Home</a>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              <span className="text-white/70">Get Help</span>
            </nav>
            <span className="eyebrow text-gold-400 mb-4 block">Professional Services</span>
            <h1 className="font-display text-white text-4xl md:text-5xl mb-5 leading-tight" style={{ letterSpacing: '-0.02em' }}>
              Find the Right<br />Accounting Expert
            </h1>
            <p className="text-white/60 text-xl leading-relaxed mb-10 max-w-2xl">
              Connect with verified accountants, bookkeepers, tax advisors and financial professionals across the UK.
            </p>
            <a href="#request-form"
              className="inline-flex items-center gap-2 h-12 px-7 text-sm font-semibold rounded-lg bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold">
              Find a Professional
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </a>
          </div>
        </div>
      </section>

      {/* SERVICES GRID */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block">Service Categories</span>
            <h2 className="section-title mb-4">Whatever you need, we have an expert</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Every professional in our network is qualified, vetted, and experienced in their specialism.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((s) => (
              <div key={s.name}
                className="group bg-white rounded-xl border border-slate-200 p-6 hover:border-gold-400 hover:shadow-lg transition-all duration-200 cursor-pointer">
                <div className="text-3xl mb-4">{s.icon}</div>
                <h3 className="font-display text-lg text-navy-950 mb-2 group-hover:text-navy-700 transition-colors">{s.name}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section section-navy relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-gold-500/10 blur-3xl" />
        </div>
        <div className="container-site relative z-10">
          <div className="text-center mb-14">
            <span className="eyebrow text-gold-400 mb-4 block">How It Works</span>
            <h2 className="font-display text-4xl text-white mb-4 leading-tight">
              Matched to the right expert in 24 hours
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Three simple steps to get the accounting help you need.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((item) => (
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

      {/* REQUEST FORM */}
      <section id="request-form" className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <span className="eyebrow mb-3 block">Get Matched</span>
              <h2 className="section-title mb-4">Find a Professional</h2>
              <p className="text-slate-500 text-lg">
                Tell us what you need and we will connect you with the right expert.
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
                    <label className="block text-sm font-semibold text-navy-950 mb-1.5">Service Required *</label>
                    <select required value={form.service_type}
                      onChange={(e) => setForm({ ...form, service_type: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-navy-950 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent bg-white transition-all">
                      <option value="">Select a service</option>
                      {services.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
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
                  <p className="text-crimson-600 text-sm">Something went wrong. Please try again or email us directly.</p>
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

    </main>
  )
}
