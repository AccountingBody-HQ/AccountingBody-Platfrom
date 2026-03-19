'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const firmTypes = ['Accounting Firm','Bookkeeping Practice','Tax Consultancy','Freelance Accountant','Freelance Bookkeeper','Payroll Bureau','Financial Planning Practice','Audit Firm','Other']
const specialismOptions = ['Tax Advice','Bookkeeping','Payroll','Financial Planning','Audit','Business Advisory','Company Formation','VAT','Self Assessment']

export default function JoinDirectoryPage() {
  const [form, setForm] = useState({ firm_name: '', contact_name: '', email: '', phone: '', website: '', firm_type: '', location: '', specialisms: '', description: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    const { error } = await supabase.from('firms_applications').insert([form])
    if (error) { console.error(error); setStatus('error') } else { setStatus('success') }
  }

  return (
    <main className="min-h-screen bg-[#faf9f7]">
            <section className="relative overflow-hidden bg-navy-950 py-16 md:py-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: "radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)" }} />
        </div>
        <div className="container-site relative z-10">
          <span className="eyebrow text-gold-400 mb-4 block">Directory</span>
          <h1 className="font-display text-white text-4xl md:text-5xl mb-4 leading-tight">List Your Practice</h1>
          <p className="text-white/60 text-xl leading-relaxed">Join our accounting directory and get discovered by clients across the UK.</p>
        </div>
      </section>
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          {status === 'success' ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-12 text-center">
              <div className="text-5xl mb-5">✅</div>
              <h2 className="text-2xl font-bold text-green-800 mb-3">Application Received</h2>
              <p className="text-green-700 leading-relaxed">Thank you for applying. We will review your application and be in touch within two business days.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 space-y-6">
              <h2 className="text-xl font-bold text-[#0f2444]">Your Practice Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-[#0f2444] mb-2">Practice / Firm Name *</label>
                  <input required type="text" value={form.firm_name} onChange={(e) => setForm({ ...form, firm_name: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#c9963f]" placeholder="Your practice name" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#0f2444] mb-2">Practice Type *</label>
                  <select required value={form.firm_type} onChange={(e) => setForm({ ...form, firm_type: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#c9963f] bg-white">
                    <option value="">Select type</option>
                    {firmTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <hr className="border-gray-100" />
              <h2 className="text-xl font-bold text-[#0f2444]">Contact Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-[#0f2444] mb-2">Your Name *</label>
                  <input required type="text" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#c9963f]" placeholder="Your full name" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#0f2444] mb-2">Email Address *</label>
                  <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#c9963f]" placeholder="you@yourfirm.com" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-[#0f2444] mb-2">Phone</label>
                  <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#c9963f]" placeholder="Optional" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#0f2444] mb-2">Website</label>
                  <input type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#c9963f]" placeholder="https://yourwebsite.com" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#0f2444] mb-2">Location *</label>
                <input required type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#c9963f]" placeholder="e.g. London / Manchester / Nationwide" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#0f2444] mb-2">Specialisms (select all that apply)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {specialismOptions.map((s) => (
                    <label key={s} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input type="checkbox" className="accent-[#c9963f]"
                        checked={form.specialisms.includes(s)}
                        onChange={(e) => {
                          const current = form.specialisms ? form.specialisms.split(', ').filter(Boolean) : []
                          const updated = e.target.checked ? [...current, s] : current.filter((x) => x !== s)
                          setForm({ ...form, specialisms: updated.join(', ') })
                        }} />
                      {s}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#0f2444] mb-2">About Your Practice</label>
                <textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#c9963f]"
                  placeholder="Tell potential clients about your practice and what makes you stand out..." />
              </div>
              {status === 'error' && <p className="text-red-500 text-sm">Something went wrong. Please try again.</p>}
              <button type="submit" disabled={status === 'loading'}
                className="w-full bg-[#0f2444] hover:bg-[#1a3a6b] text-white font-semibold py-4 rounded-lg transition-colors disabled:opacity-50">
                {status === 'loading' ? 'Submitting...' : 'Submit Your Application →'}
              </button>
              <p className="text-xs text-gray-400 text-center">All listings are reviewed before going live. We aim to respond within two business days.</p>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}
