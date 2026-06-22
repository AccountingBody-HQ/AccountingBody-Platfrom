'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef } from 'react'
import Link from 'next/link'
import Script from 'next/script'

declare global {
  interface Window {
    turnstile: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string
      reset: (widgetId: string) => void
    }
  }
}

const roleOptions = ['Accountant','Tax Advisor','Bookkeeper','Finance Manager','CFO / Finance Director','Payroll Specialist','Auditor','Financial Planner','Management Accountant','IT Professional','Other']
const qualificationOptions = ['ACA / ICAEW','ACCA','CIMA','AAT','ETICPA / CPA','CPA (US)','CA','Degree (Accounting/Finance)','Other']
const experienceOptions = ['Under 1 year','1-3 years','3-5 years','5-10 years','10+ years']
const employmentStatusOptions = ['Employed','Self-employed','Between roles','Student']
const roleTypeOptions = ['Permanent','Contract / Freelance','Remote only','Open to relocation']
const jurisdictionOptionsET = ['United Kingdom','Ethiopia','United States','Canada','UAE','European Union','Australia','Other']
const jurisdictionOptionsAB = ['United Kingdom','United States','Canada','Australia','European Union','UAE','Singapore','Other']
const languageOptionsET = ['English','Amharic','Afaan Oromoo','Tigrinya','Arabic','French','Spanish','Other']

const countryOptionsAB = [
  'United Kingdom','United States','Canada','Australia','New Zealand',
  'Ireland','Singapore','UAE','Saudi Arabia','Qatar','South Africa',
  'Germany','France','Netherlands','Sweden','Switzerland','Other',
]
const countryOptionsET = [
  'United Kingdom','Ethiopia','United States','Canada','UAE','Saudi Arabia',
  'Australia','Sweden','Germany','Netherlands','France','South Africa',
  'Qatar','Kenya','Other',
]
const languageOptionsAB = ['English','Arabic','French','Spanish','Portuguese','Mandarin','Hindi','Other']

export default function FindWorkClient({ isEthioTax: isEthioTaxProp }: { isEthioTax: boolean }) {
  const isEthioTax = isEthioTaxProp
  const brand = isEthioTax ? '#1A4731' : '#0C1A3D'
  const platformName = isEthioTax ? 'EthioTax' : 'Accounting Body'

  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', location_city: '', location_country: '',
    linkedin_url: '', professional_role: '', qualification: '', years_experience: '',
    employment_status: '', salary_expectation: '', biography: '', _h: '',
  })
  const [roleTypes, setRoleTypes] = useState<string[]>([])
  const [jurisdictions, setJurisdictions] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [dataConsent, setDataConsent] = useState(false)
  const [status, setStatus] = useState<'idle'|'loading'|'success'|'error'|'verified'|'already'|'invalid'>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('verified')
      if (p === 'true') return 'verified'
      if (p === 'already') return 'already'
      if (p === 'invalid') return 'invalid'
    }
    return 'idle'
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string,boolean>>({})

  const refs = {
    full_name: useRef<HTMLDivElement>(null),
    email: useRef<HTMLDivElement>(null),
    location_city: useRef<HTMLDivElement>(null),
    professional_role: useRef<HTMLDivElement>(null),
    qualification: useRef<HTMLDivElement>(null),
    years_experience: useRef<HTMLDivElement>(null),
    employment_status: useRef<HTMLDivElement>(null),
    biography: useRef<HTMLDivElement>(null),
    terms: useRef<HTMLDivElement>(null),
  }

  const turnstileWidgetId = useRef<string | null>(null)

  const toggleMulti = (value: string, current: string[], setter: (v: string[]) => void) => {
    setter(current.includes(value) ? current.filter(x => x !== value) : [...current, value])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string,boolean> = {}
    if (!form.full_name.trim()) errors.full_name = true
    if (!form.email.trim()) errors.email = true
    if (!form.location_city.trim()) errors.location_city = true
    if (!form.professional_role) errors.professional_role = true
    if (!form.qualification) errors.qualification = true
    if (!form.years_experience) errors.years_experience = true
    if (!form.employment_status) errors.employment_status = true
    if (!form.biography.trim() || form.biography.trim().split(/\s+/).length < 50) errors.biography = true
    if (!termsAgreed || !dataConsent) errors.terms = true
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      const firstRef = Object.keys(errors).map(k => refs[k as keyof typeof refs]).find(r => r?.current)
      firstRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setFieldErrors({})
    setStatus('loading')
    const token = (document.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement)?.value ?? ''
    const payload = {
      ...form,
      role_types: roleTypes.join(', '),
      jurisdictions: jurisdictions.join(', '),
      languages: languages.join(', '),
      terms_agreed: termsAgreed,
      data_consent: dataConsent,
      platform: isEthioTax ? 'et' : 'ab',
      'cf-turnstile-response': token,
    }
    try {
      const res = await fetch('/api/recruitment/job-seeker-apply', {
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

  const errStyle = (field: string) => fieldErrors[field] ? { borderColor: '#C9982A' } : {}
  const errLabel = (field: string) => ({ color: fieldErrors[field] ? '#C9982A' : brand })

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <main className="min-h-screen bg-surface">

        {/* HERO */}
        <section className="relative overflow-hidden py-16 md:py-20" style={{ background: brand }}>
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
              style={{ background: 'radial-gradient(ellipse at center top, rgba(212,160,23,0.3) 0%, transparent 70%)' }} />
            <div className="absolute inset-0 opacity-[0.03]"
              style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
          </div>
          <div className="container-site relative z-10">
            <nav className="flex items-center gap-2 text-white/40 text-sm mb-8">
              <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              <Link href="/jobs" className="hover:text-white/70 transition-colors">Jobs</Link>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              <span className="text-white/70">Find Work</span>
            </nav>
            <span className="eyebrow text-gold-400 mb-4 block">{platformName} Recruitment</span>
            <h1 className="font-display text-white text-4xl md:text-5xl mb-4 leading-tight" style={{ letterSpacing: '-0.02em' }}>
              Register as a Candidate
            </h1>
            <p className="text-white/60 text-xl leading-relaxed max-w-2xl">
              {isEthioTax
                ? 'Register with EthioTax and we will match you to permanent and contract roles with employers who value Ethiopian-origin finance professionals. Every profile is reviewed personally.' 
                : 'Register with us and we will match you to suitable accounting and finance roles. We advocate for you — you never deal with employers directly. Every profile is reviewed personally by our team.'}
            </p>
          </div>
        </section>

        <section className="py-16 px-6">
          <div className="max-w-3xl mx-auto">

            {(status === 'success' || status === 'verified' || status === 'already' || status === 'invalid') ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                  style={{ background: status === 'invalid' ? '#fee2e2' : '#f0fdf4' }}>
                  {status === 'invalid'
                    ? <svg className="w-8 h-8" fill="none" stroke="#ef4444" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    : <svg className="w-8 h-8" fill="none" stroke="#16a34a" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                  }
                </div>
                {status === 'success' && <>
                  <h2 className="font-display text-2xl mb-3" style={{ color: brand }}>Registration Received</h2>
                  <p className="text-slate-500 leading-relaxed mb-4">
                    Thank you for registering. We have sent a verification link to your email address. Please click it to confirm your email — your application will not be reviewed until you do.
                  </p>
                  <p className="text-xs text-slate-400 text-center">Did not receive the email? Check your spam folder.</p>
                </>}
                {status === 'verified' && <>
                  <h2 className="font-display text-2xl mb-3" style={{ color: brand }}>Email Verified</h2>
                  <p className="text-slate-500 leading-relaxed mb-4">
                    Your email address has been confirmed. Your profile is now with our team for review. We will be in touch only when a suitable role becomes available.
                  </p>
                  <p className="text-xs text-slate-400 text-center">You do not need to do anything else.</p>
                </>}
                {status === 'already' && <>
                  <h2 className="font-display text-2xl mb-3" style={{ color: brand }}>Already Verified</h2>
                  <p className="text-slate-500 leading-relaxed max-w-md mx-auto">
                    Your email address has already been verified. Your profile is with our team for review.
                  </p>
                </>}
                {status === 'invalid' && <>
                  <h2 className="font-display text-2xl mb-3" style={{ color: '#dc2626' }}>Invalid Link</h2>
                  <p className="text-slate-500 leading-relaxed max-w-md mx-auto">
                    This verification link is invalid or has already been used. If you believe this is an error, please <a href="/jobs/find-work" style={{ color: brand, textDecoration: 'underline' }}>register again</a>.
                  </p>
                </>}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">

                {/* HOW IT WORKS NOTICE */}
                <div className="rounded-xl border p-5" style={{ background: '#f8f9ff', borderColor: '#e0e4f0' }}>
                  <p className="text-sm font-semibold text-navy-950 mb-1">How this works</p>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Complete this form carefully — we review every registration personally. Once approved, we will contact you only when a role matches your profile. Your details are never shared with any employer without your prior knowledge.
                  </p>
                </div>

                {/* PERSONAL DETAILS */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
                  <h2 className="font-display text-xl text-navy-950">Personal Details</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div ref={refs.full_name}>
                      <label className="block text-sm font-semibold mb-2" style={errLabel('full_name')}>Full Name *</label>
                      {fieldErrors.full_name && <p className="text-xs font-semibold mb-1" style={{ color: '#C9982A' }}>Please enter your full name.</p>}
                      <input type="text" value={form.full_name} onChange={e => { setForm({...form, full_name: e.target.value}); if (e.target.value.trim()) setFieldErrors(p => ({...p, full_name: false})) }}
                        className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                        placeholder="Your full name" style={errStyle('full_name')} />
                    </div>
                    <div ref={refs.email}>
                      <label className="block text-sm font-semibold mb-2" style={errLabel('email')}>Email Address *</label>
                      {fieldErrors.email && <p className="text-xs font-semibold mb-1" style={{ color: '#C9982A' }}>Please enter a valid email address.</p>}
                      <input type="email" value={form.email} onChange={e => { setForm({...form, email: e.target.value}); if (e.target.value.trim()) setFieldErrors(p => ({...p, email: false})) }}
                        className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                        placeholder="you@example.com" style={errStyle('email')} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-navy-950 mb-2">Phone Number</label>
                      <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                        className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                        placeholder="Optional" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-navy-950 mb-2">LinkedIn Profile URL</label>
                      <input type="url" value={form.linkedin_url} onChange={e => setForm({...form, linkedin_url: e.target.value})}
                        className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                        placeholder="https://linkedin.com/in/yourprofile" />
                      <p className="text-xs text-slate-400 mt-1">Strongly recommended — helps us match you faster</p>
                    </div>
                  </div>
                  <div ref={refs.location_city} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold mb-2" style={errLabel('location_city')}>City *</label>
                      {fieldErrors.location_city && <p className="text-xs font-semibold mb-1" style={{ color: '#C9982A' }}>Please enter your city.</p>}
                      <input type="text" value={form.location_city} onChange={e => { setForm({...form, location_city: e.target.value}); if (e.target.value.trim()) setFieldErrors(p => ({...p, location_city: false})) }}
                        className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                        placeholder="e.g. London" style={errStyle('location_city')} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-navy-950 mb-2">Country</label>
                      <select value={form.location_country} onChange={e => setForm({...form, location_country: e.target.value})}
                        className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 bg-white">
                        <option value="">Select country</option>
                        {(isEthioTax ? countryOptionsET : countryOptionsAB).map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* PROFESSIONAL PROFILE */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
                  <h2 className="font-display text-xl text-navy-950">Professional Profile</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div ref={refs.professional_role}>
                      <label className="block text-sm font-semibold mb-2" style={errLabel('professional_role')}>Professional Role *</label>
                      {fieldErrors.professional_role && <p className="text-xs font-semibold mb-1" style={{ color: '#C9982A' }}>Please select your role.</p>}
                      <select value={form.professional_role} onChange={e => { setForm({...form, professional_role: e.target.value}); if (e.target.value) setFieldErrors(p => ({...p, professional_role: false})) }}
                        className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 bg-white"
                        style={errStyle('professional_role')}>
                        <option value="">Select your role</option>
                        {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div ref={refs.qualification}>
                      <label className="block text-sm font-semibold mb-2" style={errLabel('qualification')}>Highest Qualification *</label>
                      {fieldErrors.qualification && <p className="text-xs font-semibold mb-1" style={{ color: '#C9982A' }}>Please select your qualification.</p>}
                      <select value={form.qualification} onChange={e => { setForm({...form, qualification: e.target.value}); if (e.target.value) setFieldErrors(p => ({...p, qualification: false})) }}
                        className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 bg-white"
                        style={errStyle('qualification')}>
                        <option value="">Select qualification</option>
                        {qualificationOptions.map(q => <option key={q} value={q}>{q}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div ref={refs.years_experience}>
                      <label className="block text-sm font-semibold mb-2" style={errLabel('years_experience')}>Years of Experience *</label>
                      {fieldErrors.years_experience && <p className="text-xs font-semibold mb-1" style={{ color: '#C9982A' }}>Please select your experience level.</p>}
                      <select value={form.years_experience} onChange={e => { setForm({...form, years_experience: e.target.value}); if (e.target.value) setFieldErrors(p => ({...p, years_experience: false})) }}
                        className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 bg-white"
                        style={errStyle('years_experience')}>
                        <option value="">Select</option>
                        {experienceOptions.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div ref={refs.employment_status}>
                      <label className="block text-sm font-semibold mb-2" style={errLabel('employment_status')}>Current Employment Status *</label>
                      {fieldErrors.employment_status && <p className="text-xs font-semibold mb-1" style={{ color: '#C9982A' }}>Please select your status.</p>}
                      <select value={form.employment_status} onChange={e => { setForm({...form, employment_status: e.target.value}); if (e.target.value) setFieldErrors(p => ({...p, employment_status: false})) }}
                        className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 bg-white"
                        style={errStyle('employment_status')}>
                        <option value="">Select</option>
                        {employmentStatusOptions.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-navy-950 mb-2">Salary / Day Rate Expectation</label>
                    <input type="text" value={form.salary_expectation} onChange={e => setForm({...form, salary_expectation: e.target.value})}
                      className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                      placeholder="e.g. £45,000 per year or £350 per day" />
                  </div>
                </div>

                {/* WHAT YOU ARE LOOKING FOR */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
                  <h2 className="font-display text-xl text-navy-950">What You Are Looking For</h2>
                  <div>
                    <label className="block text-sm font-semibold text-navy-950 mb-3">Type of Role Sought</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {roleTypeOptions.map(opt => (
                        <button key={opt} type="button" onClick={() => toggleMulti(opt, roleTypes, setRoleTypes)}
                          className="px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-left"
                          style={{
                            borderColor: roleTypes.includes(opt) ? '#C9982A' : '#e2e8f0',
                            background: roleTypes.includes(opt) ? '#fdf8ee' : '#fff',
                            color: roleTypes.includes(opt) ? '#0C1A3D' : '#475569',
                            fontWeight: roleTypes.includes(opt) ? 600 : 400,
                          }}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-navy-950 mb-3">Jurisdictions You Can Work In</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(isEthioTax ? jurisdictionOptionsET : jurisdictionOptionsAB).map(opt => (
                        <button key={opt} type="button" onClick={() => toggleMulti(opt, jurisdictions, setJurisdictions)}
                          className="px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-left"
                          style={{
                            borderColor: jurisdictions.includes(opt) ? '#C9982A' : '#e2e8f0',
                            background: jurisdictions.includes(opt) ? '#fdf8ee' : '#fff',
                            color: jurisdictions.includes(opt) ? '#0C1A3D' : '#475569',
                            fontWeight: jurisdictions.includes(opt) ? 600 : 400,
                          }}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-navy-950 mb-3">Languages Spoken</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(isEthioTax ? languageOptionsET : languageOptionsAB).map(opt => (
                        <button key={opt} type="button" onClick={() => toggleMulti(opt, languages, setLanguages)}
                          className="px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-left"
                          style={{
                            borderColor: languages.includes(opt) ? '#C9982A' : '#e2e8f0',
                            background: languages.includes(opt) ? '#fdf8ee' : '#fff',
                            color: languages.includes(opt) ? '#0C1A3D' : '#475569',
                            fontWeight: languages.includes(opt) ? 600 : 400,
                          }}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* BIOGRAPHY */}
                <div ref={refs.biography} className="bg-white rounded-xl border shadow-sm p-8 space-y-4 transition-all"
                  style={{ borderColor: fieldErrors.biography ? '#C9982A' : '#e2e8f0' }}>
                  <h2 className="font-display text-xl" style={{ color: fieldErrors.biography ? '#C9982A' : '#0C1A3D' }}>
                    Professional Biography *
                  </h2>
                  <p className="text-sm text-slate-500">
                    Tell us about your experience, specialisms, and what makes you a strong candidate. Minimum 50 words. This is what our team reads when matching you to roles.
                  </p>
                  {fieldErrors.biography && <p className="text-xs font-semibold" style={{ color: '#C9982A' }}>Please write at least 50 words about your professional background.</p>}
                  <textarea rows={6} value={form.biography}
                    onChange={e => { setForm({...form, biography: e.target.value}); if (e.target.value.trim().split(/\s+/).length >= 50) setFieldErrors(p => ({...p, biography: false})) }}
                    className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                    placeholder="e.g. I am an ACCA-qualified accountant with 8 years of experience in financial reporting and tax compliance, having worked with clients across the UK and Ethiopia. I specialise in..." />
                  <p className="text-xs text-slate-400">{form.biography.trim() ? form.biography.trim().split(/\s+/).length : 0} words</p>
                </div>

                {/* TERMS */}
                <div ref={refs.terms} className="bg-white rounded-xl border shadow-sm p-8 space-y-4"
                  style={{ borderColor: fieldErrors.terms ? '#C9982A' : '#e2e8f0' }}>
                  <h2 className="font-display text-xl text-navy-950">Confirmation</h2>
                  {fieldErrors.terms && <p className="text-xs font-semibold" style={{ color: '#C9982A' }}>Please accept both confirmations to continue.</p>}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={termsAgreed} onChange={e => { setTermsAgreed(e.target.checked); if (e.target.checked) setFieldErrors(p => ({...p, terms: false})) }}
                      className="mt-0.5 accent-gold-500 shrink-0" />
                    <span className="text-sm text-slate-600">
                      I confirm that I have read and agree to the{' '}
                      <Link href="/terms" className="underline text-navy-700 hover:text-gold-600">Job Seeker Registration Terms</Link>.
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={dataConsent} onChange={e => { setDataConsent(e.target.checked); if (e.target.checked) setFieldErrors(p => ({...p, terms: false})) }}
                      className="mt-0.5 accent-gold-500 shrink-0" />
                    <span className="text-sm text-slate-600">
                      I consent to {platformName} holding and processing my personal data for the purpose of matching me with suitable roles, in accordance with the{' '}
                      <Link href="/privacy-policy" className="underline text-navy-700 hover:text-gold-600">Privacy Policy</Link>.
                    </span>
                  </label>
                  <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 mt-2">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Your profile will never be made public. We will not share your details with any employer without your prior knowledge. Submission does not guarantee placement.
                    </p>
                  </div>
                </div>

                {/* SUBMIT */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
                  {status === 'error' && <p className="text-red-500 text-sm mb-4">Something went wrong. Please try again or contact us directly.</p>}
                  <input type="text" value={form._h} onChange={e => setForm({...form, _h: e.target.value})} style={{ display: 'none' }} tabIndex={-1} autoComplete="off" aria-hidden="true" />
                  <div ref={el => {
                    if (el && window.turnstile && !turnstileWidgetId.current) {
                      const sitekey = isEthioTax
                        ? (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '')
                        : (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY_AB ?? '')
                      turnstileWidgetId.current = window.turnstile.render(el, {
                        sitekey,
                        size: 'invisible',
                      })
                    }
                  }} />
                  <button type="submit" disabled={status === 'loading'}
                    className="w-full text-white font-semibold h-12 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    style={{ background: brand }}>
                    {status === 'loading' ? 'Submitting...' : 'Submit Registration'}
                    {status !== 'loading' && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    )}
                  </button>
                  <p className="text-xs text-slate-400 text-center mt-4">We review every registration personally. You will hear from us within 5 working days of email verification.</p>
                </div>

              </form>
            )}
          </div>
        </section>
      </main>
    </>
  )
}
