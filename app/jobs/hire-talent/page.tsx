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
const jurisdictionOptions = ['United Kingdom','Ethiopia','United States','Canada','UAE','European Union','Australia','Other']

export default function HireTalentPage() {
  const isEthioTax = typeof window !== 'undefined' && window.location.hostname.includes('ethiotax.com')
  const brand = isEthioTax ? '#1A4731' : '#0C1A3D'
  const platformName = isEthioTax ? 'EthioTax' : 'Accounting Body'

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

  const refs = {
    company_name: useRef<HTMLDivElement>(null),
    contact_name: useRef<HTMLDivElement>(null),
    contact_email: useRef<HTMLDivElement>(null),
    role_title: useRef<HTMLDivElement>(null),
    contract_type: useRef<HTMLDivElement>(null),
    location: useRef<HTMLDivElement>(null),
    role_description: useRef<HTMLDivElement>(null),
  }

  const turnstileWidgetId = useRef<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string,boolean> = {}
    if (!form.company_name.trim()) errors.company_name = true
    if (!form.contact_name.trim()) errors.contact_name = true
    if (!form.contact_email.trim()) errors.contact_email = true
    if (!form.role_title.trim()) errors.role_title = true
    if (!form.contract_type) errors.contract_type = true
    if (!form.location.trim()) errors.location = true
    if (!form.role_description.trim()) errors.role_description = true
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
          <div className="max-w-3xl mx-auto">

            {(status === 'success' || status === 'confirmed' || status === 'cancelled' || status === 'invalid') ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                  style={{ background: status === 'cancelled' || status === 'invalid' ? '#fee2e2' : '#f0fdf4' }}>
                  {status === 'cancelled' || status === 'invalid'
                    ? <svg className="w-8 h-8" fill="none" stroke="#ef4444" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    : <svg className="w-8 h-8" fill="none" stroke="#16a34a" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                  }
                </div>
                {status === 'success' && <>
                  <h2 className="font-display text-2xl mb-3" style={{ color: brand }}>Brief Received</h2>
                  <p className="text-slate-500 leading-relaxed mb-4">
                    Thank you. Please check your inbox — we have sent you a confirmation email with your full brief details. Please review and confirm before we begin our search.
                  </p>
                  <p className="text-xs text-slate-400 text-center">Did not receive the email? Check your spam folder.</p>
                </>}
                {status === 'confirmed' && <>
                  <h2 className="font-display text-2xl mb-3" style={{ color: brand }}>Brief Confirmed</h2>
                  <p className="text-slate-500 leading-relaxed mb-4">
                    Your hiring brief has been confirmed. Our team will review it and be in touch within 2 working days. We will send you a Fee Agreement Letter before any search begins.
                  </p>
                  <p className="text-xs text-slate-400 text-center">You do not need to do anything else.</p>
                </>}
                {status === 'cancelled' && <>
                  <h2 className="font-display text-2xl mb-3" style={{ color: '#dc2626' }}>Brief Cancelled</h2>
                  <p className="text-slate-500 leading-relaxed mb-4">
                    Your hiring brief has been cancelled and removed. If you would like to submit a new brief, please use the form below.
                  </p>
                  <a href="/jobs/hire-talent" className="text-sm font-semibold underline" style={{ color: brand }}>Submit a new brief</a>
                </>}
                {status === 'invalid' && <>
                  <h2 className="font-display text-2xl mb-3" style={{ color: '#dc2626' }}>Invalid Link</h2>
                  <p className="text-slate-500 leading-relaxed mb-4">
                    This link is invalid or has already been used. If you need help, please <a href="/jobs/hire-talent" className="underline" style={{ color: brand }}>submit a new brief</a>.
                  </p>
                </>}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">

                {/* INFO NOTICE */}
                <div className="rounded-xl border p-5" style={{ background: '#f8f9ff', borderColor: '#e0e4f0' }}>
                  <p className="text-sm font-semibold text-navy-950 mb-1">Before we begin</p>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    We will review your brief personally and contact you within 2 working days. A Fee Agreement Letter will be sent before any search begins. You only meet candidates we recommend — we manage the introduction.
                  </p>
                </div>

                {/* COMPANY DETAILS */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
                  <h2 className="font-display text-xl text-navy-950">Your Details</h2>
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
                </div>

                {/* ROLE DETAILS */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
                  <h2 className="font-display text-xl text-navy-950">The Role</h2>
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
                        {jurisdictionOptions.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* ROLE DESCRIPTION */}
                <div ref={refs.role_description} className="bg-white rounded-xl border shadow-sm p-8 space-y-4 transition-all"
                  style={{ borderColor: fieldErrors.role_description ? '#C9982A' : '#e2e8f0' }}>
                  <h2 className="font-display text-xl" style={{ color: fieldErrors.role_description ? '#C9982A' : '#0C1A3D' }}>
                    Role Description *
                  </h2>
                  <p className="text-sm text-slate-500">Describe the role, responsibilities, and what success looks like. The more detail you provide, the better we can match you with the right candidate.</p>
                  {fieldErrors.role_description && <p className="text-xs font-semibold" style={{ color: '#C9982A' }}>Please describe the role.</p>}
                  <textarea rows={5} value={form.role_description} onChange={e => { setForm({...form, role_description: e.target.value}); if (e.target.value.trim()) setFieldErrors(p => ({...p, role_description: false})) }}
                    className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                    placeholder="e.g. We are looking for an experienced accountant to manage month-end close, prepare management accounts, and liaise with external auditors..." />
                </div>

                {/* REQUIREMENTS */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
                  <h2 className="font-display text-xl text-navy-950">Requirements</h2>
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
                </div>

                {/* SUBMIT */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
                  <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 mb-6">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      By submitting this brief you confirm that you have authority to engage a recruitment service on behalf of your organisation. We will contact you within 2 working days to discuss your requirement and send a Fee Agreement Letter before any search begins.
                    </p>
                  </div>
                  {status === 'error' && <p className="text-red-500 text-sm mb-4">Something went wrong. Please try again or contact us directly.</p>}
                  <input type="text" value={form._h} onChange={e => setForm({...form, _h: e.target.value})} style={{ display: 'none' }} tabIndex={-1} autoComplete="off" aria-hidden="true" />
                  <div ref={el => {
                    if (el && window.turnstile && !turnstileWidgetId.current) {
                      turnstileWidgetId.current = window.turnstile.render(el, {
                        sitekey: '0x4AAAAADeWpXpm7NrIBZp_',
                        size: 'invisible',
                      })
                    }
                  }} />
                  <button type="submit" disabled={status === 'loading'}
                    className="w-full text-white font-semibold h-12 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    style={{ background: brand }}>
                    {status === 'loading' ? 'Submitting...' : 'Submit Hiring Brief'}
                    {status !== 'loading' && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    )}
                  </button>
                  <p className="text-xs text-slate-400 text-center mt-4">We review every brief personally and respond within 2 working days.</p>
                </div>

              </form>
            )}
          </div>
        </section>
      </main>
    </>
  )
}
