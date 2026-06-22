'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect } from 'react'
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

const contractTypeOptions = ['Permanent','Contract / Freelance','Temporary','Part-time','Open to both permanent and contract']
const jurisdictionOptionsAB = [
  'United Kingdom','United States','Canada','Australia','New Zealand',
  'Ireland','Singapore','UAE','Saudi Arabia','Germany','France',
  'Netherlands','Sweden','Switzerland','Other',
]
const jurisdictionOptionsET = [
  'United Kingdom','Ethiopia','United States','Canada','UAE','Saudi Arabia',
  'Australia','Sweden','Germany','Netherlands','Kenya','South Africa','Other',
]

const STEPS = [
  { number: 1, label: 'Your Details' },
  { number: 2, label: 'The Role' },
  { number: 3, label: 'Role Description' },
  { number: 4, label: 'Confirmation' },
]

function ProgressBar({ currentStep, brand }: { currentStep: number; brand: string }) {
  return (
    <div className="mb-8">
      <div className="hidden sm:flex items-start justify-between mb-3">
        {STEPS.map(step => (
          <div key={step.number} className="flex flex-col items-center" style={{ width: '25%' }}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-1 transition-all"
              style={{ background: currentStep >= step.number ? brand : '#e2e8f0', color: currentStep >= step.number ? '#fff' : '#94a3b8' }}
            >
              {currentStep > step.number
                ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                : step.number}
            </div>
            <span className="text-xs font-medium text-center leading-tight" style={{ color: currentStep >= step.number ? brand : '#94a3b8' }}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
      <div className="sm:hidden text-sm font-semibold mb-2" style={{ color: brand }}>
        Step {currentStep} of {STEPS.length} — {STEPS[currentStep - 1].label}
      </div>
      <div className="relative h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
          style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%`, background: '#C9982A' }}
        />
      </div>
    </div>
  )
}

function TrustPanel({ brand, isEthioTax }: { brand: string; isEthioTax: boolean }) {
  return (
    <div className="hidden lg:block sticky top-8 space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-display text-base font-bold mb-4" style={{ color: brand }}>Why submit a brief with us?</h3>
        <div className="space-y-4">
          {[
            { icon: <svg className="w-5 h-5" fill="none" stroke="#C9982A" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>, text: isEthioTax ? 'We present vetted Ethiopian-origin finance professionals — you only meet candidates we recommend.' : 'We present shortlisted professionals — you only meet candidates we recommend.' },
            { icon: <svg className="w-5 h-5" fill="none" stroke="#C9982A" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>, text: 'A Fee Agreement Letter is sent before any search begins — no surprises.' },
            { icon: <svg className="w-5 h-5" fill="none" stroke="#C9982A" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, text: 'Every brief is reviewed personally by our team within 2 working days.' },
            { icon: <svg className="w-5 h-5" fill="none" stroke="#C9982A" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, text: '90-day replacement guarantee on every permanent placement.' },
          ].map((item, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="shrink-0 mt-0.5">{item.icon}</div>
              <p className="text-sm text-slate-600 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-display text-base font-bold mb-4" style={{ color: brand }}>What happens next?</h3>
        <div className="space-y-3">
          {['Submit your brief','We review personally','Fee Agreement sent','Search begins'].map((step, i) => (
            <div key={i} className="flex gap-3 items-center">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: brand }}>{i + 1}</div>
              <p className="text-sm text-slate-600">{step}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <p className="text-xs text-slate-500 leading-relaxed"><span className="font-bold text-slate-700">Your brief is confidential.</span> It is never posted publicly. We use it only to search our candidate pool on your behalf.</p>
      </div>
    </div>
  )
}

export default function HireTalentClient({ isEthioTax: isEthioTaxProp }: { isEthioTax: boolean }) {
  const isEthioTax = isEthioTaxProp
  const brand = isEthioTax ? '#1A4731' : '#0C1A3D'
  const platformName = isEthioTax ? 'EthioTax' : 'Accounting Body'

  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    company_name: '', contact_name: '', contact_email: '', contact_phone: '',
    role_title: '', contract_type: '', location: '', salary_budget: '',
    start_date: '', must_haves: '', nice_to_haves: '', role_description: '',
    jurisdiction: '', _h: '',
  })
  const [status, setStatus] = useState<'idle'|'loading'|'success'|'error'|'confirmed'|'cancelled'|'invalid'>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('brief')
      if (p === 'confirmed') return 'confirmed'
      if (p === 'cancelled') return 'cancelled'
      if (p === 'invalid') return 'invalid'
    }
    return 'idle'
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string,boolean>>({})
  const [editToken, setEditToken] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('edit')
    if (!token) return
    setEditToken(token)
    fetch('/api/recruitment/fetch-brief?token=' + token)
      .then(r => r.json())
      .then(({ data }) => {
        if (!data) return
        setForm({
          company_name:     data.company_name ?? '',
          contact_name:     data.contact_name ?? '',
          contact_email:    data.contact_email ?? '',
          contact_phone:    data.contact_phone ?? '',
          role_title:       data.role_title ?? '',
          contract_type:    data.contract_type ?? '',
          location:         data.location ?? '',
          salary_budget:    data.salary_budget ?? '',
          start_date:       data.start_date ?? '',
          must_haves:       data.must_haves ?? '',
          nice_to_haves:    data.nice_to_haves ?? '',
          role_description: data.role_description ?? '',
          jurisdiction:     data.jurisdiction ?? '',
          _h: '',
        })
      })
      .catch(console.error)
  }, [])

  const topRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetId = useRef<string | null>(null)

  const refs = {
    company_name: useRef<HTMLDivElement>(null),
    contact_name: useRef<HTMLDivElement>(null),
    contact_email: useRef<HTMLDivElement>(null),
    role_title: useRef<HTMLDivElement>(null),
    contract_type: useRef<HTMLDivElement>(null),
    location: useRef<HTMLDivElement>(null),
    role_description: useRef<HTMLDivElement>(null),
  }

  const validateStep = (s: number): Record<string,boolean> => {
    const errors: Record<string,boolean> = {}
    if (s === 1) {
      if (!form.company_name.trim()) errors.company_name = true
      if (!form.contact_name.trim()) errors.contact_name = true
      if (!form.contact_email.trim()) errors.contact_email = true
    }
    if (s === 2) {
      if (!form.role_title.trim()) errors.role_title = true
      if (!form.contract_type) errors.contract_type = true
      if (!form.location.trim()) errors.location = true
    }
    if (s === 3) {
      if (!form.role_description.trim()) errors.role_description = true
    }
    return errors
  }

  const handleNext = () => {
    const errors = validateStep(step)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      const firstRef = Object.keys(errors).map(k => refs[k as keyof typeof refs]).find(r => r?.current)
      firstRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setFieldErrors({})
    setStep(s => s + 1)
    topRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleBack = () => {
    setFieldErrors({})
    setStep(s => s - 1)
    topRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSubmit = async () => {
    setStatus('loading')
    const token = (document.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement)?.value ?? ''
    const payload = {
      ...form,
      platform: isEthioTax ? 'et' : 'ab',
      'cf-turnstile-response': token,
      edit_token: editToken ?? undefined,
    }
    try {
      const res = await fetch('/api/recruitment/employer-brief', {
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
              <span className="text-white/70">Hire Talent</span>
            </nav>
            <span className="eyebrow text-gold-400 mb-4 block">{platformName} Recruitment</span>
            <h1 className="font-display text-white text-4xl md:text-5xl mb-4 leading-tight" style={{ letterSpacing: '-0.02em' }}>
              Tell us your hiring need
            </h1>
            <p className="text-white/60 text-xl leading-relaxed max-w-2xl">
              {isEthioTax
                ? 'Tell us the role you need to fill. We search our vetted pool of Ethiopian-origin finance professionals and present you with the right candidates. We will send you a Fee Agreement Letter before any search begins.'
                : 'Complete this brief and we will search our vetted candidate pool. We present you with shortlisted professionals — you only meet candidates we recommend. We will send you a Fee Agreement Letter before any search begins.'}
            </p>
          </div>
        </section>

        <section className="py-16 px-6">
          <div ref={topRef} />
          <div className="max-w-6xl mx-auto">

            {(status === 'success' || status === 'confirmed' || status === 'cancelled' || status === 'invalid') ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm max-w-3xl mx-auto">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                  style={{ background: status === 'cancelled' || status === 'invalid' ? '#fee2e2' : '#f0fdf4' }}>
                  {status === 'cancelled' || status === 'invalid'
                    ? <svg className="w-8 h-8" fill="none" stroke="#ef4444" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    : <svg className="w-8 h-8" fill="none" stroke="#16a34a" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                  }
                </div>
                {status === 'success' && <>
                  <h2 className="font-display text-2xl mb-3" style={{ color: brand }}>Brief Received</h2>
                  <p className="text-slate-500 leading-relaxed mb-4">Thank you. Please check your inbox — we have sent you a confirmation email with your full brief details. Please review and confirm before we begin our search.</p>
                  <p className="text-xs text-slate-400 text-center">Did not receive the email? Check your spam folder.</p>
                </>}
                {status === 'confirmed' && <>
                  <h2 className="font-display text-2xl mb-3" style={{ color: brand }}>Brief Confirmed</h2>
                  <p className="text-slate-500 leading-relaxed mb-4">Your hiring brief has been confirmed. Our team will review it and be in touch within 2 working days. We will send you a Fee Agreement Letter before any search begins.</p>
                  <p className="text-xs text-slate-400 text-center">You do not need to do anything else.</p>
                </>}
                {status === 'cancelled' && <>
                  <h2 className="font-display text-2xl mb-3" style={{ color: '#dc2626' }}>Brief Cancelled</h2>
                  <p className="text-slate-500 leading-relaxed mb-4">Your hiring brief has been cancelled and removed. If you would like to submit a new brief, please use the form below.</p>
                  <a href="/jobs/hire-talent" className="text-sm font-semibold underline" style={{ color: brand }}>Submit a new brief</a>
                </>}
                {status === 'invalid' && <>
                  <h2 className="font-display text-2xl mb-3" style={{ color: '#dc2626' }}>Invalid Link</h2>
                  <p className="text-slate-500 leading-relaxed mb-4">This link is invalid or has already been used. If you need help, please <a href="/jobs/hire-talent" className="underline" style={{ color: brand }}>submit a new brief</a>.</p>
                </>}
              </div>
            ) : (
              <div className="lg:grid lg:grid-cols-[1fr_300px] gap-10 items-start">
                <div>
                  <ProgressBar currentStep={step} brand={brand} />

                  {/* STEP 1 — YOUR DETAILS */}
                  {step === 1 && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
                      <div>
                        <h2 className="font-display text-xl text-navy-950 mb-1">Your Details</h2>
                        <p className="text-sm text-slate-500">Tell us who you are and how to reach you.</p>
                      </div>
                      <div className="rounded-xl border p-5" style={{ background: '#f8f9ff', borderColor: '#e0e4f0' }}>
                        <p className="text-sm font-semibold text-navy-950 mb-1">Before we begin</p>
                        <p className="text-sm text-slate-500 leading-relaxed">We will review your brief personally and contact you within 2 working days. A Fee Agreement Letter will be sent before any search begins.</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div ref={refs.company_name}>
                          <label className="block text-sm font-semibold mb-2" style={errLabel('company_name')}>Company Name *</label>
                          {fieldErrors.company_name && <p className="text-xs font-semibold mb-1" style={{ color: '#C9982A' }}>Please enter your company name.</p>}
                          <input type="text" value={form.company_name} onChange={e => { setForm({...form, company_name: e.target.value}); if (e.target.value.trim()) setFieldErrors(p => ({...p, company_name: false})) }}
                            className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                            placeholder="Your company name" style={errStyle('company_name')} />
                        </div>
                        <div ref={refs.contact_name}>
                          <label className="block text-sm font-semibold mb-2" style={errLabel('contact_name')}>Your Name *</label>
                          {fieldErrors.contact_name && <p className="text-xs font-semibold mb-1" style={{ color: '#C9982A' }}>Please enter your name.</p>}
                          <input type="text" value={form.contact_name} onChange={e => { setForm({...form, contact_name: e.target.value}); if (e.target.value.trim()) setFieldErrors(p => ({...p, contact_name: false})) }}
                            className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                            placeholder="Full name" style={errStyle('contact_name')} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div ref={refs.contact_email}>
                          <label className="block text-sm font-semibold mb-2" style={errLabel('contact_email')}>Email Address *</label>
                          {fieldErrors.contact_email && <p className="text-xs font-semibold mb-1" style={{ color: '#C9982A' }}>Please enter a valid email address.</p>}
                          <input type="email" value={form.contact_email} onChange={e => { setForm({...form, contact_email: e.target.value}); if (e.target.value.trim()) setFieldErrors(p => ({...p, contact_email: false})) }}
                            className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                            placeholder="you@company.com" style={errStyle('contact_email')} />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-navy-950 mb-2">Phone Number</label>
                          <input type="tel" value={form.contact_phone} onChange={e => setForm({...form, contact_phone: e.target.value})}
                            className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                            placeholder="Optional" />
                        </div>
                      </div>
                      <div className="flex justify-end pt-2">
                        <button type="button" onClick={handleNext}
                          className="h-11 px-6 rounded-lg font-semibold text-sm text-white flex items-center gap-2 transition-opacity hover:opacity-90"
                          style={{ background: brand }}>
                          Continue
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 2 — THE ROLE */}
                  {step === 2 && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
                      <div>
                        <h2 className="font-display text-xl text-navy-950 mb-1">The Role</h2>
                        <p className="text-sm text-slate-500">Tell us about the position you need to fill.</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div ref={refs.role_title}>
                          <label className="block text-sm font-semibold mb-2" style={errLabel('role_title')}>Role Title *</label>
                          {fieldErrors.role_title && <p className="text-xs font-semibold mb-1" style={{ color: '#C9982A' }}>Please enter the role title.</p>}
                          <input type="text" value={form.role_title} onChange={e => { setForm({...form, role_title: e.target.value}); if (e.target.value.trim()) setFieldErrors(p => ({...p, role_title: false})) }}
                            className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                            placeholder="e.g. Senior Accountant" style={errStyle('role_title')} />
                        </div>
                        <div ref={refs.contract_type}>
                          <label className="block text-sm font-semibold mb-2" style={errLabel('contract_type')}>Permanent or Contract *</label>
                          {fieldErrors.contract_type && <p className="text-xs font-semibold mb-1" style={{ color: '#C9982A' }}>Please select a contract type.</p>}
                          <select value={form.contract_type} onChange={e => { setForm({...form, contract_type: e.target.value}); if (e.target.value) setFieldErrors(p => ({...p, contract_type: false})) }}
                            className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 bg-white"
                            style={errStyle('contract_type')}>
                            <option value="">Select</option>
                            {contractTypeOptions.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div ref={refs.location}>
                          <label className="block text-sm font-semibold mb-2" style={errLabel('location')}>Location *</label>
                          {fieldErrors.location && <p className="text-xs font-semibold mb-1" style={{ color: '#C9982A' }}>Please enter the role location.</p>}
                          <input type="text" value={form.location} onChange={e => { setForm({...form, location: e.target.value}); if (e.target.value.trim()) setFieldErrors(p => ({...p, location: false})) }}
                            className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                            placeholder="e.g. London, UK / Remote" style={errStyle('location')} />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-navy-950 mb-2">Salary / Day Rate Budget</label>
                          <input type="text" value={form.salary_budget} onChange={e => setForm({...form, salary_budget: e.target.value})}
                            className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                            placeholder="e.g. £45,000–£55,000 or £350/day" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-semibold text-navy-950 mb-2">Ideal Start Date</label>
                          <input type="text" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})}
                            className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                            placeholder="e.g. ASAP / January 2027" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-navy-950 mb-2">Jurisdiction</label>
                          <select value={form.jurisdiction} onChange={e => setForm({...form, jurisdiction: e.target.value})}
                            className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 bg-white">
                            <option value="">Select</option>
                            {(isEthioTax ? jurisdictionOptionsET : jurisdictionOptionsAB).map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-between pt-2">
                        <button type="button" onClick={handleBack}
                          className="h-11 px-6 rounded-lg font-semibold text-sm border-2 flex items-center gap-2 transition-opacity hover:opacity-80"
                          style={{ borderColor: brand, color: brand, background: 'transparent' }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" /></svg>
                          Back
                        </button>
                        <button type="button" onClick={handleNext}
                          className="h-11 px-6 rounded-lg font-semibold text-sm text-white flex items-center gap-2 transition-opacity hover:opacity-90"
                          style={{ background: brand }}>
                          Continue
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 3 — ROLE DESCRIPTION */}
                  {step === 3 && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
                      <div>
                        <h2 className="font-display text-xl text-navy-950 mb-1">Role Description</h2>
                        <p className="text-sm text-slate-500">The more detail you provide, the better we can match you.</p>
                      </div>
                      <div ref={refs.role_description}>
                        <label className="block text-sm font-semibold mb-2" style={errLabel('role_description')}>Role Description *</label>
                        {fieldErrors.role_description && <p className="text-xs font-semibold mb-1" style={{ color: '#C9982A' }}>Please describe the role.</p>}
                        <p className="text-xs text-slate-400 mb-2">Describe the role, responsibilities, and what success looks like.</p>
                        <textarea rows={6} value={form.role_description} onChange={e => { setForm({...form, role_description: e.target.value}); if (e.target.value.trim()) setFieldErrors(p => ({...p, role_description: false})) }}
                          className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                          placeholder="e.g. We are looking for an experienced accountant to manage month-end close, prepare management accounts, and liaise with external auditors..."
                          style={errStyle('role_description')} />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-navy-950 mb-2">Must-Have Requirements</label>
                        <textarea rows={3} value={form.must_haves} onChange={e => setForm({...form, must_haves: e.target.value})}
                          className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                          placeholder="e.g. ACCA qualified, 5+ years experience, UK tax knowledge" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-navy-950 mb-2">Nice-to-Have</label>
                        <textarea rows={2} value={form.nice_to_haves} onChange={e => setForm({...form, nice_to_haves: e.target.value})}
                          className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                          placeholder="e.g. Experience with Xero, knowledge of Ethiopian business law" />
                      </div>
                      <div className="flex justify-between pt-2">
                        <button type="button" onClick={handleBack}
                          className="h-11 px-6 rounded-lg font-semibold text-sm border-2 flex items-center gap-2 transition-opacity hover:opacity-80"
                          style={{ borderColor: brand, color: brand, background: 'transparent' }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" /></svg>
                          Back
                        </button>
                        <button type="button" onClick={handleNext}
                          className="h-11 px-6 rounded-lg font-semibold text-sm text-white flex items-center gap-2 transition-opacity hover:opacity-90"
                          style={{ background: brand }}>
                          Continue
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 4 — CONFIRMATION */}
                  {step === 4 && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
                      <div>
                        <h2 className="font-display text-xl text-navy-950 mb-1">Confirm & Submit</h2>
                        <p className="text-sm text-slate-500">Review the details below then submit your brief.</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-200 text-sm">
                        <div className="px-5 py-3 flex gap-3"><span className="font-semibold text-slate-700 w-36 shrink-0">Company</span><span className="text-slate-600">{form.company_name}</span></div>
                        <div className="px-5 py-3 flex gap-3"><span className="font-semibold text-slate-700 w-36 shrink-0">Contact</span><span className="text-slate-600">{form.contact_name}</span></div>
                        <div className="px-5 py-3 flex gap-3"><span className="font-semibold text-slate-700 w-36 shrink-0">Email</span><span className="text-slate-600">{form.contact_email}</span></div>
                        {form.contact_phone && <div className="px-5 py-3 flex gap-3"><span className="font-semibold text-slate-700 w-36 shrink-0">Phone</span><span className="text-slate-600">{form.contact_phone}</span></div>}
                        <div className="px-5 py-3 flex gap-3"><span className="font-semibold text-slate-700 w-36 shrink-0">Role</span><span className="text-slate-600">{form.role_title}</span></div>
                        <div className="px-5 py-3 flex gap-3"><span className="font-semibold text-slate-700 w-36 shrink-0">Contract Type</span><span className="text-slate-600">{form.contract_type}</span></div>
                        <div className="px-5 py-3 flex gap-3"><span className="font-semibold text-slate-700 w-36 shrink-0">Location</span><span className="text-slate-600">{form.location}</span></div>
                        {form.salary_budget && <div className="px-5 py-3 flex gap-3"><span className="font-semibold text-slate-700 w-36 shrink-0">Budget</span><span className="text-slate-600">{form.salary_budget}</span></div>}
                        {form.start_date && <div className="px-5 py-3 flex gap-3"><span className="font-semibold text-slate-700 w-36 shrink-0">Start Date</span><span className="text-slate-600">{form.start_date}</span></div>}
                        {form.jurisdiction && <div className="px-5 py-3 flex gap-3"><span className="font-semibold text-slate-700 w-36 shrink-0">Jurisdiction</span><span className="text-slate-600">{form.jurisdiction}</span></div>}
                      </div>
                      <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                        <p className="text-xs text-slate-500 leading-relaxed">By submitting this brief you confirm that you have authority to engage a recruitment service on behalf of your organisation. We will contact you within 2 working days to discuss your requirement and send a Fee Agreement Letter before any search begins.</p>
                      </div>
                      {status === 'error' && <p className="text-red-500 text-sm">Something went wrong. Please try again or contact us directly.</p>}
                      <input type="text" value={form._h} onChange={e => setForm({...form, _h: e.target.value})} style={{ display: 'none' }} tabIndex={-1} autoComplete="off" aria-hidden="true" />
                      <div ref={el => {
                        if (el && window.turnstile && !turnstileWidgetId.current) {
                          const sitekey = isEthioTax
                            ? (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '')
                            : (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY_AB ?? '')
                          turnstileWidgetId.current = window.turnstile.render(el, { sitekey, size: 'invisible' })
                        }
                      }} />
                      <div className="flex justify-between pt-2">
                        <button type="button" onClick={handleBack}
                          className="h-11 px-6 rounded-lg font-semibold text-sm border-2 flex items-center gap-2 transition-opacity hover:opacity-80"
                          style={{ borderColor: brand, color: brand, background: 'transparent' }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" /></svg>
                          Back
                        </button>
                        <button type="button" onClick={handleSubmit} disabled={status === 'loading'}
                          className="h-11 px-6 rounded-lg font-semibold text-sm text-white flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
                          style={{ background: brand }}>
                          {status === 'loading' ? 'Submitting...' : 'Submit Hiring Brief'}
                          {status !== 'loading' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>}
                        </button>
                      </div>
                    </div>
                  )}

                </div>
                <TrustPanel brand={brand} isEthioTax={isEthioTax} />
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  )
}
