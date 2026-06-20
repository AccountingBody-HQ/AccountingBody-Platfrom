'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef } from 'react'
import Script from 'next/script'

declare global {
  interface Window {
    turnstile: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string
      reset: (widgetId: string) => void
    }
  }
}

const firmTypes = ['Accounting Firm','Audit Firm','Tax Consultancy','Bookkeeping Practice','Payroll Bureau','Financial Planning Practice','Business Advisory Practice','Other']
const independentTypes = ['Chartered Accountant','Certified Accountant','Bookkeeper','Tax Advisor','Payroll Specialist','Financial Planner','Auditor','Management Accountant','Other']
const specialismOptions = ['Tax Advice','Bookkeeping','Payroll','Financial Planning','Audit & Assurance','Business Advisory','Company Formation','VAT & Sales Tax','Self Assessment','Management Accounting','Financial Reporting','Forensic Accounting']
const qualificationOptions = ['ACCA','CIMA','ICAEW / ACA','AAT','CPA','CA','SAICA','ICAP','Other']

type ApplicantType = 'firm' | 'independent'

export default function JoinNetworkPage() {
  const [applicantType, setApplicantType] = useState<ApplicantType | null>(null)
  const [form, setForm] = useState({
    practice_name: '', contact_name: '', email: '', phone: '', website: '',
    practice_type: '', location: '', years_of_experience: '', languages: '', specialisms: '', about: '', _h: '',
    open_to_employment: '', currently_hiring: '',
  })
  const [qualifications, setQualifications] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [fieldErrors, setFieldErrors] = useState<{ open_to_employment?: boolean; currently_hiring?: boolean; about?: boolean }>({})
  const empRef = useRef<HTMLDivElement>(null)
  const hiringRef = useRef<HTMLDivElement>(null)
  const aboutRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetId = useRef<string | null>(null)
  const isEthioTax = typeof window !== 'undefined' && window.location.hostname.includes('ethiotax.com')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Validate deselectable questions and about field (in form order)
    const errors: { open_to_employment?: boolean; currently_hiring?: boolean; about?: boolean } = {}
    if (applicantType === 'independent' && !form.open_to_employment) errors.open_to_employment = true
    if (!form.currently_hiring) errors.currently_hiring = true
    if (!form.about.trim()) errors.about = true
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      // Scroll to first error in form order
      if (errors.open_to_employment && empRef.current) {
        empRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else if (errors.currently_hiring && hiringRef.current) {
        hiringRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else if (errors.about && aboutRef.current) {
        aboutRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }
    setFieldErrors({})
    setStatus('loading')
    const token = (document.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement)?.value ?? ''
    const payload = {
      ...form,
      about: `[${applicantType === 'firm' ? 'FIRM' : 'INDEPENDENT'}] Qualifications: ${qualifications.join(', ')}. ${form.about}${form.open_to_employment ? ` | Open to employment: ${form.open_to_employment}` : ''}${form.currently_hiring ? ` | Currently hiring: ${form.currently_hiring}` : ''}`,
      'cf-turnstile-response': token,
    }
    try {
      const res = await fetch('/api/firms-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Something went wrong')
      setStatus('success')
      if (turnstileWidgetId.current) window.turnstile?.reset(turnstileWidgetId.current)
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  const toggleSpecialism = (s: string) => {
    const current = form.specialisms ? form.specialisms.split(', ').filter(Boolean) : []
    const updated = current.includes(s) ? current.filter(x => x !== s) : [...current, s]
    setForm({ ...form, specialisms: updated.join(', ') })
  }

  const toggleQualification = (q: string) => {
    setQualifications(prev => prev.includes(q) ? prev.filter(x => x !== q) : [...prev, q])
  }

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <main className="min-h-screen bg-surface">

      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-950 py-16 md:py-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>
        <div className="container-site relative z-10">
          <nav className="flex items-center gap-2 text-white/40 text-sm mb-8">
            <a href="/" className="hover:text-white/70 transition-colors">Home</a>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <a href="/firms-freelancers" className="hover:text-white/70 transition-colors">Firms &amp; Freelancers</a>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span className="text-white/70">Apply to Join</span>
          </nav>
          <span className="eyebrow text-gold-400 mb-4 block">Accounting Body Professionals</span>
          <h1 className="font-display text-white text-4xl md:text-5xl mb-4 leading-tight" style={{ letterSpacing: '-0.02em' }}>Apply to Join Our Network</h1>
          <p className="text-white/60 text-xl leading-relaxed max-w-2xl">All applications are reviewed individually by our team. Acceptance into the Accounting Body professional network is subject to satisfactory completion of our vetting process.</p>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">

          {status === 'success' ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
              <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="font-display text-2xl text-navy-950 mb-3">Application Received</h2>
              <p className="text-slate-500 leading-relaxed max-w-md mx-auto">Thank you for your application. Our team will review your credentials and professional standing. We aim to review all applications within 5 working days. You will hear from us once your application has been assessed.</p>
              <button onClick={() => { setStatus('idle'); setApplicantType(null); setQualifications([]); setForm({ practice_name: '', contact_name: '', email: '', phone: '', website: '', practice_type: '', location: '', years_of_experience: '', languages: '', specialisms: '', about: '', _h: '', open_to_employment: '', currently_hiring: '' }) }}
                className="mt-6 text-sm font-medium text-navy-700 hover:text-gold-600 transition-colors">
                Submit another application
              </button>
            </div>
          ) : (
            <div className="space-y-6">

              {/* TYPE SELECTOR */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
                <h2 className="font-display text-xl text-navy-950 mb-2">I am applying as a</h2>
                <p className="text-sm text-slate-500 mb-6">Please select the option that best describes your professional status. The application form will adapt accordingly.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setApplicantType('firm')}
                    className={`flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all ${
                      applicantType === 'firm'
                        ? 'border-navy-950 bg-navy-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      applicantType === 'firm' ? 'bg-navy-950' : 'bg-slate-100'
                    }`}>
                      <svg className={`w-5 h-5 ${applicantType === 'firm' ? 'text-white' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeWidth="1.75" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-navy-950 mb-1">Accounting Firm</p>
                      <p className="text-xs text-slate-500 leading-relaxed">An established practice, consultancy, or bureau applying on behalf of the organisation.</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setApplicantType('independent')}
                    className={`flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all ${
                      applicantType === 'independent'
                        ? 'border-navy-950 bg-navy-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      applicantType === 'independent' ? 'bg-navy-950' : 'bg-slate-100'
                    }`}>
                      <svg className={`w-5 h-5 ${applicantType === 'independent' ? 'text-white' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeWidth="1.75" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-navy-950 mb-1">Independent Professional</p>
                      <p className="text-xs text-slate-500 leading-relaxed">A qualified individual accountant, bookkeeper, tax advisor, or finance professional applying in a personal capacity.</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* FORM — shown only after type selected */}
              {applicantType && (
                <form onSubmit={handleSubmit} className="space-y-6">

                  {/* PRACTICE / PERSONAL DETAILS */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
                    <h2 className="font-display text-xl text-navy-950">
                      {applicantType === 'firm' ? 'Firm Details' : 'Personal Details'}
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {applicantType === 'firm' && (
                        <div>
                          <label className="block text-sm font-semibold text-navy-950 mb-2">Firm Name *</label>
                          <input required type="text" value={form.practice_name} onChange={(e) => setForm({ ...form, practice_name: e.target.value })}
                            className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent" placeholder="Your firm name" />
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-semibold text-navy-950 mb-2">{applicantType === 'firm' ? 'Practice Type *' : 'Professional Role *'}</label>
                        <select required value={form.practice_type} onChange={(e) => setForm({ ...form, practice_type: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent bg-white">
                          <option value="">Select</option>
                          {(applicantType === 'firm' ? firmTypes : independentTypes).map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-navy-950 mb-2">{applicantType === 'firm' ? 'Primary Contact Name *' : 'Full Name *'}</label>
                        <input required type="text" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent" placeholder="Full name" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-navy-950 mb-2">Email Address *</label>
                        <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent" placeholder="you@example.com" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-navy-950 mb-2">Phone Number</label>
                        <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent" placeholder="Optional" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-navy-950 mb-2">{applicantType === 'firm' ? 'Firm Website' : 'LinkedIn or Website'}</label>
                        <input type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent" placeholder="https://" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-navy-950 mb-2">Location / Country *</label>
                      <input required type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent" placeholder="e.g. London, UK / Johannesburg, South Africa / New York, USA" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-navy-950 mb-2">Years of Experience</label>
                        <select value={form.years_of_experience} onChange={(e) => setForm({ ...form, years_of_experience: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent bg-white">
                          <option value="">Select</option>
                          <option value="0-2 years">0–2 years</option>
                          <option value="3-5 years">3–5 years</option>
                          <option value="6-10 years">6–10 years</option>
                          <option value="10+ years">10+ years</option>
                        </select>
                      </div>
                      {(isEthioTax || applicantType === 'independent') && (
                        <div>
                          <label className="block text-sm font-semibold text-navy-950 mb-2">Languages Spoken</label>
                          <input type="text" value={form.languages} onChange={(e) => setForm({ ...form, languages: e.target.value })}
                            className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                            placeholder={isEthioTax ? "e.g. English, Amharic, Afaan Oromoo" : "e.g. English, French, Spanish"} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* QUALIFICATIONS */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-4">
                    <h2 className="font-display text-xl text-navy-950">Professional Qualifications</h2>
                    <p className="text-sm text-slate-500">Select all professional qualifications held by {applicantType === 'firm' ? 'your team' : 'you'}.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {qualificationOptions.map((q) => (
                        <label key={q} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input type="checkbox" className="accent-gold-500" checked={qualifications.includes(q)} onChange={() => toggleQualification(q)} />
                          {q}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* SPECIALISMS */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-4">
                    <h2 className="font-display text-xl text-navy-950">Service Specialisms</h2>
                    <p className="text-sm text-slate-500">Select all service areas {applicantType === 'firm' ? 'your firm' : 'you'} can deliver. We use this to match you with relevant client requests.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {specialismOptions.map((s) => (
                        <label key={s} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input type="checkbox" className="accent-gold-500"
                            checked={form.specialisms.split(', ').filter(Boolean).includes(s)}
                            onChange={() => toggleSpecialism(s)} />
                          {s}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* EMPLOYMENT QUESTIONS */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
                    <h2 className="font-display text-xl text-navy-950">Employment &amp; Hiring</h2>
                    <p className="text-sm text-slate-500">These questions help us match you with the right opportunities. Both are required.</p>

                    {/* Q1 — open to employment — independent only */}
                    {applicantType === 'independent' && (
                      <div ref={empRef} className="rounded-lg p-3 -m-3 transition-all"
                        style={fieldErrors.open_to_employment ? { outline: '2px solid #C9982A', outlineOffset: '2px', borderRadius: '8px' } : {}}>
                        <label className="block text-sm font-semibold mb-3"
                          style={{ color: fieldErrors.open_to_employment ? '#C9982A' : '#0C1A3D' }}>
                          Are you currently open to permanent or contract employment opportunities? *
                        </label>
                        {fieldErrors.open_to_employment && (
                          <p className="text-xs font-semibold mb-2" style={{ color: '#C9982A' }}>Please select an option to continue.</p>
                        )}
                        <div className="space-y-2">
                          {[
                            { value: 'Yes — actively looking', label: 'Yes — actively looking' },
                            { value: 'Yes — open but not actively searching', label: 'Yes — open but not actively searching' },
                            { value: 'No — not currently open to employment', label: 'No — not currently open to employment' },
                          ].map(opt => (
                            <button
                              type="button"
                              key={opt.value}
                              onClick={() => { setForm({ ...form, open_to_employment: form.open_to_employment === opt.value ? '' : opt.value }); setFieldErrors(prev => ({ ...prev, open_to_employment: false })) }}
                              className="flex items-center gap-3 text-sm text-left w-full px-4 py-3 rounded-lg border transition-all"
                              style={{
                                borderColor: form.open_to_employment === opt.value ? '#C9982A' : '#e2e8f0',
                                background: form.open_to_employment === opt.value ? '#fdf8ee' : '#fff',
                                color: form.open_to_employment === opt.value ? '#0C1A3D' : '#475569',
                                fontWeight: form.open_to_employment === opt.value ? 600 : 400,
                              }}>
                              <span className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
                                style={{ borderColor: form.open_to_employment === opt.value ? '#C9982A' : '#cbd5e1' }}>
                                {form.open_to_employment === opt.value && (
                                  <span className="w-2 h-2 rounded-full" style={{ background: '#C9982A' }} />
                                )}
                              </span>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Q2 — currently hiring — both */}
                    <div ref={hiringRef} className="rounded-lg p-3 -m-3 transition-all"
                      style={fieldErrors.currently_hiring ? { outline: '2px solid #C9982A', outlineOffset: '2px', borderRadius: '8px' } : {}}>
                      <label className="block text-sm font-semibold mb-3"
                        style={{ color: fieldErrors.currently_hiring ? '#C9982A' : '#0C1A3D' }}>
                        {applicantType === 'firm' ? 'Is your firm currently hiring?' : 'Are you or your contacts currently hiring?'} *
                      </label>
                      {fieldErrors.currently_hiring && (
                        <p className="text-xs font-semibold mb-2" style={{ color: '#C9982A' }}>Please select an option to continue.</p>
                      )}
                      <div className="space-y-2">
                        {[
                          { value: 'Yes — actively hiring now', label: 'Yes — actively hiring now' },
                          { value: 'Possibly — within the next 6 months', label: 'Possibly — within the next 6 months' },
                          { value: 'No — not hiring at this time', label: 'No — not hiring at this time' },
                        ].map(opt => (
                          <button
                            type="button"
                            key={opt.value}
                            onClick={() => { setForm({ ...form, currently_hiring: form.currently_hiring === opt.value ? '' : opt.value }); setFieldErrors(prev => ({ ...prev, currently_hiring: false })) }}
                            className="flex items-center gap-3 text-sm text-left w-full px-4 py-3 rounded-lg border transition-all"
                            style={{
                              borderColor: form.currently_hiring === opt.value ? '#C9982A' : '#e2e8f0',
                              background: form.currently_hiring === opt.value ? '#fdf8ee' : '#fff',
                              color: form.currently_hiring === opt.value ? '#0C1A3D' : '#475569',
                              fontWeight: form.currently_hiring === opt.value ? 600 : 400,
                            }}>
                            <span className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
                              style={{ borderColor: form.currently_hiring === opt.value ? '#C9982A' : '#cbd5e1' }}>
                              {form.currently_hiring === opt.value && (
                                <span className="w-2 h-2 rounded-full" style={{ background: '#C9982A' }} />
                              )}
                            </span>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ABOUT */}
                  <div ref={aboutRef} className="bg-white rounded-xl border shadow-sm p-8 space-y-4 transition-all"
                    style={{ borderColor: fieldErrors.about ? '#C9982A' : '#e2e8f0', outline: fieldErrors.about ? '2px solid #C9982A' : 'none', outlineOffset: '2px' }}>
                    <h2 className="font-display text-xl"
                      style={{ color: fieldErrors.about ? '#C9982A' : '#0C1A3D' }}>
                      {applicantType === 'firm' ? 'About Your Firm *' : 'About You *'}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {applicantType === 'firm'
                        ? 'Provide a brief overview of your firm — size, history, key services, and the types of clients you typically serve.'
                        : 'Provide a brief professional biography — your background, experience, areas of expertise, and the types of engagements you are looking to take on.'}
                    </p>
                    {fieldErrors.about && (
                      <p className="text-xs font-semibold" style={{ color: '#C9982A' }}>Please complete this field to continue.</p>
                    )}
                    <textarea required rows={5} value={form.about} onChange={(e) => { setForm({ ...form, about: e.target.value }); if (e.target.value.trim()) setFieldErrors(prev => ({ ...prev, about: false })) }}
                      className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                      placeholder={applicantType === 'firm'
                        ? 'e.g. We are a mid-sized accounting firm based in Johannesburg with 12 qualified professionals specialising in audit, tax, and advisory services for SMEs...'
                        : 'e.g. I am an ACCA-qualified accountant with 8 years of experience in financial reporting and tax compliance, having worked with clients across the UK and Nigeria...'} />
                  </div>

                  {/* SUBMIT */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
                    <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 mb-6">
                      <p className="text-xs text-slate-500 leading-relaxed">
                        By submitting this application you confirm that all information provided is accurate and complete. Accounting Body reserves the right to verify all credentials independently. Submission of this form does not guarantee acceptance into the network.
                      </p>
                    </div>
                    {status === 'error' && <p className="text-red-500 text-sm mb-4">Something went wrong. Please try again.</p>}
                    {/* Honeypot — hidden from real users, bots fill it */}
                    <input type="text" value={form._h} onChange={(e) => setForm({ ...form, _h: e.target.value })} style={{ display: 'none' }} tabIndex={-1} autoComplete="off" aria-hidden="true" />
                    {/* Turnstile invisible widget */}
                    <div ref={(el) => {
                      if (el && window.turnstile && !turnstileWidgetId.current) {
                        turnstileWidgetId.current = window.turnstile.render(el, {
                          sitekey: '0x4AAAAADeWpXpm7NrIBZp_',
                          size: 'invisible',
                        })
                      }
                    }} />
                    <button type="submit" disabled={status === 'loading'}
                      className="w-full bg-navy-950 hover:bg-navy-900 text-white font-semibold h-12 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                      {status === 'loading' ? 'Submitting...' : 'Submit Application'}
                      {status !== 'loading' && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                      )}
                    </button>
                  </div>

                </form>
              )}

            </div>
          )}
        </div>
      </section>
    </main>
    </>
  )
}
