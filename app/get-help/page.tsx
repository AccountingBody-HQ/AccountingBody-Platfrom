'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const services = [
  { name: 'Tax Advice', icon: '📊', desc: 'Personal and business tax planning, returns and HMRC compliance.' },
  { name: 'Bookkeeping', icon: '📒', desc: 'Day-to-day financial records, bank reconciliations and reporting.' },
  { name: 'Payroll', icon: '💷', desc: 'End-to-end payroll processing, RTI submissions and auto-enrolment.' },
  { name: 'Financial Planning', icon: '📈', desc: 'Strategic financial planning, forecasting and cash flow management.' },
  { name: 'Audit', icon: '🔍', desc: 'Statutory and voluntary audits for businesses of all sizes.' },
  { name: 'Business Advisory', icon: '🤝', desc: 'Strategic advice to grow, scale and protect your business.' },
  { name: 'Company Formation', icon: '🏢', desc: 'Register your limited company quickly and correctly from day one.' },
  { name: 'VAT', icon: '🧾', desc: 'VAT registration, returns, MTD compliance and HMRC advice.' },
  { name: 'Self Assessment', icon: '📝', desc: 'Personal tax returns filed accurately and submitted on time.' },
]

export default function GetHelpPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', service_type: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    const { error } = await supabase.from('help_requests').insert([form])
    if (error) { console.error(error); setStatus('error') }
    else { setStatus('success'); setForm({ name: '', email: '', phone: '', service_type: '', message: '' }) }
  }

  return (
    <main className="min-h-screen bg-[#faf9f7]">
      <section className="relative overflow-hidden bg-navy-950 py-16 md:py-24">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: "radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)" }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        </div>
        <div className="container-site relative z-10">
          <div className="max-w-3xl">
            <span className="eyebrow text-gold-400 mb-4 block">Professional Services</span>
            <h1 className="font-display text-white text-4xl md:text-5xl mb-5 leading-tight">
              Find the Right Accounting Expert
            </h1>
            <p className="text-white/60 text-xl leading-relaxed mb-10">
              Connect with verified accountants, bookkeepers, tax advisors and financial professionals across the UK.
            </p>
            <a href="#request-form" className="inline-flex items-center h-12 px-7 text-sm font-semibold rounded-lg bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors">
              Find a Professional →
            </a>
          </div>
        </div>
      </section>

      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-[#0f2444] mb-4">Our Service Categories</h2>
            <p className="text-gray-500 text-lg">Whatever you need, we have a qualified expert to help.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((s) => (
              <div key={s.name} className="bg-white border border-gray-100 rounded-2xl p-7 shadow-sm hover:shadow-lg transition-all hover:border-[#c9963f] cursor-pointer group">
                <div className="text-4xl mb-4">{s.icon}</div>
                <h3 className="font-bold text-[#0f2444] text-xl mb-2 group-hover:text-[#c9963f] transition-colors">{s.name}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0f2444] text-white py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-blue-200 text-lg mb-16">Get matched with the right professional in three simple steps.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { step: '01', title: 'Tell us what you need', desc: 'Fill in the short form below describing the accounting help you are looking for.' },
              { step: '02', title: 'We match you', desc: 'Our team reviews your request and connects you with a vetted professional within one business day.' },
              { step: '03', title: 'Get expert help', desc: 'Speak directly with your matched professional and get the support you need.' },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-[#c9963f] flex items-center justify-center text-white font-bold text-xl mb-5">{item.step}</div>
                <h3 className="font-bold text-xl mb-3">{item.title}</h3>
                <p className="text-blue-200 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="request-form" className="py-24 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#0f2444] mb-4">Find a Professional</h2>
            <p className="text-gray-500 text-lg">Tell us what you need and we will connect you with the right expert.</p>
          </div>
          {status === 'success' ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-12 text-center">
              <div className="text-5xl mb-5">✅</div>
              <h3 className="text-2xl font-bold text-green-800 mb-3">Request Received</h3>
              <p className="text-green-700">We will be in touch within one business day to connect you with the right professional.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-[#0f2444] mb-2">Full Name *</label>
                  <input required type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#c9963f]" placeholder="Your full name" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#0f2444] mb-2">Email Address *</label>
                  <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#c9963f]" placeholder="you@example.com" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-[#0f2444] mb-2">Phone Number</label>
                  <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#c9963f]" placeholder="Optional" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#0f2444] mb-2">Service Required *</label>
                  <select required value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#c9963f] bg-white">
                    <option value="">Select a service</option>
                    {services.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#0f2444] mb-2">Tell us more about what you need *</label>
                <textarea required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#c9963f]"
                  placeholder="Briefly describe your situation and what help you are looking for..." />
              </div>
              {status === 'error' && <p className="text-red-500 text-sm">Something went wrong. Please try again or email us directly.</p>}
              <button type="submit" disabled={status === 'loading'}
                className="w-full bg-[#0f2444] hover:bg-[#1a3a6b] text-white font-semibold py-4 rounded-lg transition-colors disabled:opacity-50 text-base">
                {status === 'loading' ? 'Sending your request...' : 'Find a Professional →'}
              </button>
              <p className="text-xs text-gray-400 text-center">We will respond within one business day. Your details are never shared without your permission.</p>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}
