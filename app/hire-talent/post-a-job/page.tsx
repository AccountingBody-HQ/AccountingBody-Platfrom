'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const jobTypes = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Temporary', 'Internship']
const roleTitles = ['Accountant','Bookkeeper','CFO','Tax Advisor','Auditor','Payroll Manager','Finance Director','Management Accountant','Financial Controller','Credit Controller','Accounts Assistant','Practice Manager','Other']

export default function PostAJobPage() {
  const [form, setForm] = useState({ company_name: '', contact_email: '', job_title: '', location: '', job_type: '', salary_range: '', description: '', requirements: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    const { error } = await supabase.from('job_listings').insert([form])
    if (error) { console.error(error); setStatus('error') } else { setStatus('success') }
  }

  return (
    <main className="min-h-screen bg-surface">
            <section className="relative overflow-hidden bg-navy-950 py-16 md:py-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: "radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)" }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        </div>
        <div className="container-site relative z-10">
          <nav className="flex items-center gap-2 text-white/40 text-sm mb-8">
            <a href="/" className="hover:text-white/70 transition-colors">Home</a>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <a href="/hire-talent" className="hover:text-white/70 transition-colors">Hire Talent</a>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span className="text-white/70">Post a Job</span>
          </nav>
          <span className="eyebrow text-gold-400 mb-4 block">Employers</span>
          <h1 className="font-display text-white text-4xl md:text-5xl mb-4 leading-tight">Post a Job</h1>
          <p className="text-white/60 text-xl leading-relaxed">Reach qualified accounting and finance professionals across the UK.</p>
        </div>
      </section>
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          {status === 'success' ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-green-800 mb-3">Job Submitted</h2>
              <p className="text-green-700">We will review your listing and publish it within one business day.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
              <h2 className="text-xl font-bold text-navy-950">Company Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-navy-950 mb-2">Company Name *</label>
                  <input required type="text" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent" placeholder="Your company name" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-navy-950 mb-2">Contact Email *</label>
                  <input required type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent" placeholder="hiring@yourcompany.com" />
                </div>
              </div>
              <hr className="border-slate-200" />
              <h2 className="text-xl font-bold text-navy-950">Role Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-navy-950 mb-2">Job Title *</label>
                  <select required value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent bg-white">
                    <option value="">Select a role</option>
                    {roleTitles.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-navy-950 mb-2">Job Type *</label>
                  <select required value={form.job_type} onChange={(e) => setForm({ ...form, job_type: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent bg-white">
                    <option value="">Select type</option>
                    {jobTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-navy-950 mb-2">Location *</label>
                  <input required type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent" placeholder="e.g. London / Remote / Hybrid" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-navy-950 mb-2">Salary Range</label>
                  <input type="text" value={form.salary_range} onChange={(e) => setForm({ ...form, salary_range: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent" placeholder="e.g. £35,000 – £45,000" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-navy-950 mb-2">Job Description *</label>
                <textarea required rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  placeholder="Describe the role, responsibilities and company..." />
              </div>
              <div>
                <label className="block text-sm font-semibold text-navy-950 mb-2">Requirements &amp; Qualifications</label>
                <textarea rows={4} value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  placeholder="e.g. ACA/ACCA qualified, 3+ years experience..." />
              </div>
              {status === 'error' && <p className="text-red-500 text-sm">Something went wrong. Please try again.</p>}
              <button type="submit" disabled={status === 'loading'}
                className="w-full bg-navy-950 hover:bg-navy-900 text-white font-semibold h-11 px-6 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50">
                {status === 'loading' ? 'Submitting...' : 'Submit Job Listing →'}
              </button>
              <p className="text-xs text-slate-400 text-center">All listings are reviewed before going live. We aim to publish within one business day.</p>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}
