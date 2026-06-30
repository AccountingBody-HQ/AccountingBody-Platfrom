'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

const faqs = [
  {
    q: 'What exactly is freelancing?',
    a: 'Freelancing means offering your professional skills to clients on a self-employed basis, rather than working as a permanent employee. You choose your clients, set your rates, and manage your own schedule. As a freelance accountant or finance professional, you might work with multiple businesses simultaneously, providing services such as bookkeeping, tax preparation, payroll, or financial consulting.',
  },
  {
    q: 'Do I need to be fully qualified to start freelancing?',
    a: 'Not necessarily. While formal qualifications such as ACCA, CIMA, AAT, or ETICPA strengthen your credibility significantly, many clients value practical experience and results above credentials alone. That said, certain regulated activities — such as signing off statutory accounts or providing regulated financial advice — do require appropriate authorisation. Start with services that match your current qualification level and build from there.',
  },
  {
    q: 'How do I find my first freelance clients?',
    a: 'Most professionals find their first clients through their existing network — former colleagues, employers, friends, or family members who run businesses. Beyond your network, professional platforms, local business communities, and managed networks such as ours can connect you with clients who need your services. The key is to be specific about what you offer and who you serve rather than positioning yourself as a generalist.',
  },
  {
    q: 'How should I set my rates as a freelance professional?',
    a: 'Research what other professionals with your experience level and specialism charge in your market. Freelance rates are typically set as an hourly rate, a day rate, or a fixed project fee. As a guide, your freelance day rate should reflect your employment salary equivalent divided by roughly 200 working days, then increased to account for gaps between clients, holidays, and administration time. Do not undercharge — it undermines the market and your own sustainability.',
  },
  {
    q: 'What documents and registrations do I need?',
    a: 'The core requirements are registering as self-employed with your relevant tax authority, opening a dedicated business bank account, and having a simple contract template that covers scope, fees, payment terms, and confidentiality. You should also consider professional indemnity insurance, which protects you if a client claims your work caused them financial loss. If you plan to handle client data, understand your obligations under applicable data protection laws.',
  },
  {
    q: 'How is freelance income taxed?',
    a: 'As a self-employed professional, you are responsible for declaring your own income and paying tax on your profits. The specifics depend on your country of residence. In all cases, keep clear records of your income and allowable business expenses from day one. Setting aside a portion of every payment for tax — typically 25 to 30 percent — is a sound habit regardless of jurisdiction.',
  },
  {
    q: 'Can I freelance while still employed full-time?',
    a: 'Yes, and many professionals start this way. Check your employment contract first — some include clauses restricting outside work, particularly with competing businesses. Subject to those constraints, building a freelance client base while employed gives you financial security during the transition period. Be transparent about your capacity with clients and do not let freelance commitments affect your primary employment obligations.',
  },
  {
    q: 'What is the difference between freelancing and joining a professional network?',
    a: 'Freelancing independently means you find your own clients, manage your own relationships, and handle all billing and administration yourself. Joining a managed professional network means the network finds clients for you, manages the client relationship and communications, and handles billing on your behalf. You receive matched engagements suited to your specialism without having to prospect for work yourself.',
  },
  {
    q: 'How long does it take to build a sustainable freelance practice?',
    a: 'Most professionals find their first client within one to three months of actively looking. Building a stable, recurring client base typically takes six to eighteen months. The timeline depends significantly on your network, your specialism, your pricing, and how consistently you communicate your availability. Managed networks can shorten this timeline considerably by connecting you with clients from the outset.',
  },
  {
    q: 'What support does this platform provide to aspiring freelancers?',
    a: 'When you register your interest through this platform, our team reviews your profile and works to match you with client engagements suited to your experience and specialism. We handle client communications, billing, and quality oversight so you can focus on delivering excellent work. This is a managed pathway, not a job board.',
  },
]

function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null)
  const gold = '#C9982A'
  return (
    <div className="space-y-3">
      {faqs.map((item, i) => (
        <div key={i} className="rounded-xl overflow-hidden transition-all"
          style={{
            border: `1px solid ${open === i ? gold : 'rgba(255,255,255,0.15)'}`,
            background: open === i ? 'rgba(201,152,42,0.08)' : 'rgba(255,255,255,0.05)',
          }}>
          <button type="button" onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between px-6 py-5 text-left gap-4">
            <span className="font-semibold text-sm leading-snug" style={{ color: open === i ? gold : 'white' }}>{item.q}</span>
            <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all"
              style={{ background: open === i ? gold : 'rgba(255,255,255,0.1)', border: `1px solid ${open === i ? gold : 'rgba(255,255,255,0.2)'}` }}>
              <svg className="w-3 h-3" style={{ transform: open === i ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s', color: 'white' }}
                fill="none" stroke="white" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </button>
          {open === i && (
            <div className="px-6 pb-6">
              <div className="h-px mb-4" style={{ background: 'rgba(201,152,42,0.3)' }} />
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{item.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const roleOptions = ['Accountant','Tax Advisor','Bookkeeper','Finance Manager','CFO / Finance Director','Payroll Specialist','Auditor','Financial Planner','Management Accountant','Other']
const qualificationOptions = ['ACA / ICAEW','ACCA','CIMA','AAT','ETICPA / CPA','CPA (US)','CA','Degree (Accounting/Finance)','Other']
const experienceOptions = ['Under 1 year','1-3 years','3-5 years','5-10 years','10+ years']
const currentStatusOptions = ['Looking for work (unemployed)','Recently graduated','Employed full-time','Employed part-time','Self-employed']
const countryOptionsAB = ['United Kingdom','United States','Canada','Australia','New Zealand','Ireland','Singapore','UAE','Saudi Arabia','Qatar','South Africa','Germany','France','Netherlands','Sweden','Switzerland','Other']
const countryOptionsET = ['United Kingdom','Ethiopia','United States','Canada','UAE','Saudi Arabia','Australia','Sweden','Germany','Netherlands','France','South Africa','Qatar','Kenya','Other']

const STEPS = [
  { number: 1, label: 'Personal Details' },
  { number: 2, label: 'Professional Profile' },
  { number: 3, label: 'Your Statement' },
  { number: 4, label: 'Confirmation' },
]

function ProgressBar({ currentStep, brand }: { currentStep: number; brand: string }) {
  return (
    <div className="mb-8">
      <div className="hidden sm:flex items-start justify-between mb-3">
        {STEPS.map(step => (
          <div key={step.number} className="flex flex-col items-center" style={{ width: '25%' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-1 transition-all"
              style={{ background: currentStep >= step.number ? brand : '#e2e8f0', color: currentStep >= step.number ? '#fff' : '#94a3b8' }}>
              {currentStep > step.number
                ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                : step.number}
            </div>
            <span className="text-xs text-center leading-tight"
              style={{ color: currentStep >= step.number ? brand : '#94a3b8', fontWeight: currentStep === step.number ? 600 : 400 }}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
      <div className="relative h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%`, background: brand }} />
      </div>
      <div className="flex sm:hidden justify-between items-center mt-2">
        <span className="text-xs text-slate-400">Step {currentStep} of {STEPS.length}</span>
        <span className="text-xs font-semibold" style={{ color: brand }}>{STEPS[currentStep - 1].label}</span>
      </div>
    </div>
  )
}

function FreelancingForm({ isEthioTax, brand, platformName }: { isEthioTax: boolean; brand: string; platformName: string }) {
  const [currentStep, setCurrentStep] = useState(1)
  const formTopRef = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', location_city: '', location_country: '',
    linkedin_url: '', professional_role: '', qualification: '', years_experience: '',
    current_status: '', biography: '', _h: '',
  })
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [dataConsent, setDataConsent] = useState(false)
  const [status, setStatus] = useState<'idle'|'loading'|'success'|'error'>('idle')
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({})

  const scrollToForm = () => {
    setTimeout(() => {
      formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const validateStep = (step: number): Record<string, boolean> => {
    const errors: Record<string, boolean> = {}
    if (step === 1) {
      if (!form.full_name.trim()) errors.full_name = true
      if (!form.email.trim()) errors.email = true
      if (!form.location_city.trim()) errors.location_city = true
    }
    if (step === 2) {
      if (!form.professional_role) errors.professional_role = true
      if (!form.qualification) errors.qualification = true
      if (!form.years_experience) errors.years_experience = true
      if (!form.current_status) errors.current_status = true
    }
    if (step === 3) {
      if (!form.biography.trim() || form.biography.trim().split(/\s+/).length < 30) errors.biography = true
    }
    if (step === 4) {
      if (!termsAgreed || !dataConsent) errors.terms = true
    }
    return errors
  }

  const handleNext = () => {
    const errors = validateStep(currentStep)
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return }
    setFieldErrors({})
    setCurrentStep(s => s + 1)
    scrollToForm()
  }

  const handleBack = () => {
    setFieldErrors({})
    setCurrentStep(s => s - 1)
    scrollToForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors = validateStep(4)
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return }
    setStatus('loading')
    const payload = {
      full_name:         form.full_name.trim(),
      email:             form.email.trim().toLowerCase(),
      phone:             form.phone?.trim() || null,
      location_city:     form.location_city.trim(),
      location_country:  form.location_country?.trim() || null,
      linkedin_url:      form.linkedin_url?.trim() || null,
      professional_role: form.professional_role,
      qualification:     form.qualification,
      years_experience:  form.years_experience,
      employment_status: form.current_status,
      biography:         form.biography.trim(),
      terms_agreed:      termsAgreed,
      data_consent:      dataConsent,
      platform:          isEthioTax ? 'et' : 'ab',
      pathway:           'freelancing-pathways',
      _h:                form._h,
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
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  const errStyle = (field: string) => fieldErrors[field] ? { borderColor: '#C9982A' } : {}
  const errLabel = (field: string) => ({ color: fieldErrors[field] ? '#C9982A' : '#0f172a' })

  const NavButtons = () => (
    <div className="flex items-center justify-between pt-4">
      {currentStep > 1
        ? <button type="button" onClick={handleBack}
            className="flex items-center gap-2 text-sm font-semibold h-11 px-6 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" /></svg>
            Back
          </button>
        : <div />}
      <button type="button" onClick={handleNext}
        className="flex items-center gap-2 text-sm font-semibold h-11 px-6 rounded-lg text-white transition-colors"
        style={{ background: brand }}>
        Continue
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
      </button>
    </div>
  )

  if (status === 'success') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: '#f0fdf4' }}>
          <svg className="w-8 h-8" fill="none" stroke="#16a34a" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="font-display text-2xl mb-3" style={{ color: brand }}>Interest Registered</h2>
        <p className="text-slate-500 leading-relaxed mb-4">Thank you for registering your interest. We have sent a verification link to your email address. Please click it to confirm your email — your profile will not be reviewed until you do.</p>
        <p className="text-xs text-slate-400">Did not receive the email? Check your spam folder.</p>
      </div>
    )
  }

  return (
    <div ref={formTopRef}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <ProgressBar currentStep={currentStep} brand={brand} />

        {currentStep === 1 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
            <h2 className="font-display text-xl text-navy-950">Personal Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold mb-2" style={errLabel('full_name')}>Full Name *</label>
                {fieldErrors.full_name && <p className="text-xs font-semibold mb-1" style={{ color: '#C9982A' }}>Please enter your full name.</p>}
                <input type="text" value={form.full_name} onChange={e => { setForm({...form, full_name: e.target.value}); if (e.target.value.trim()) setFieldErrors(p => ({...p, full_name: false})) }}
                  className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  placeholder="Your full name" style={errStyle('full_name')} />
              </div>
              <div>
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
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                  {(isEthioTax ? countryOptionsET : countryOptionsAB).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <NavButtons />
          </div>
        )}

        {currentStep === 2 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
            <h2 className="font-display text-xl text-navy-950">Professional Profile</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold mb-2" style={errLabel('professional_role')}>Professional Role *</label>
                {fieldErrors.professional_role && <p className="text-xs font-semibold mb-1" style={{ color: '#C9982A' }}>Please select your role.</p>}
                <select value={form.professional_role} onChange={e => { setForm({...form, professional_role: e.target.value}); if (e.target.value) setFieldErrors(p => ({...p, professional_role: false})) }}
                  className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 bg-white" style={errStyle('professional_role')}>
                  <option value="">Select your role</option>
                  {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={errLabel('qualification')}>Highest Qualification *</label>
                {fieldErrors.qualification && <p className="text-xs font-semibold mb-1" style={{ color: '#C9982A' }}>Please select your qualification.</p>}
                <select value={form.qualification} onChange={e => { setForm({...form, qualification: e.target.value}); if (e.target.value) setFieldErrors(p => ({...p, qualification: false})) }}
                  className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 bg-white" style={errStyle('qualification')}>
                  <option value="">Select qualification</option>
                  {qualificationOptions.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold mb-2" style={errLabel('years_experience')}>Years of Experience *</label>
                {fieldErrors.years_experience && <p className="text-xs font-semibold mb-1" style={{ color: '#C9982A' }}>Please select your experience level.</p>}
                <select value={form.years_experience} onChange={e => { setForm({...form, years_experience: e.target.value}); if (e.target.value) setFieldErrors(p => ({...p, years_experience: false})) }}
                  className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 bg-white" style={errStyle('years_experience')}>
                  <option value="">Select</option>
                  {experienceOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={errLabel('current_status')}>Current Situation *</label>
                {fieldErrors.current_status && <p className="text-xs font-semibold mb-1" style={{ color: '#C9982A' }}>Please select your current situation.</p>}
                <select value={form.current_status} onChange={e => { setForm({...form, current_status: e.target.value}); if (e.target.value) setFieldErrors(p => ({...p, current_status: false})) }}
                  className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 bg-white" style={errStyle('current_status')}>
                  <option value="">Select</option>
                  {currentStatusOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <NavButtons />
          </div>
        )}

        {currentStep === 3 && (
          <div className="bg-white rounded-xl border shadow-sm p-8 space-y-4"
            style={{ borderColor: fieldErrors.biography ? '#C9982A' : '#e2e8f0' }}>
            <h2 className="font-display text-xl" style={{ color: fieldErrors.biography ? '#C9982A' : '#0C1A3D' }}>
              Your Statement *
            </h2>
            <p className="text-sm text-slate-500">
              Tell us about your background and why you are interested in freelancing. What services could you offer? What kind of clients would you like to work with? Minimum 30 words.
            </p>
            {fieldErrors.biography && <p className="text-xs font-semibold" style={{ color: '#C9982A' }}>Please write at least 30 words about your background and freelancing interest.</p>}
            <textarea rows={7} value={form.biography}
              onChange={e => { setForm({...form, biography: e.target.value}); if (e.target.value.trim().split(/\s+/).length >= 30) setFieldErrors(p => ({...p, biography: false})) }}
              className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
              placeholder="e.g. I am an ACCA-qualified accountant currently working full-time in industry. I am interested in taking on bookkeeping and tax clients on the side to build my own practice over time..." />
            <p className="text-xs text-slate-400">{form.biography.trim() ? form.biography.trim().split(/\s+/).length : 0} words</p>
            <NavButtons />
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border shadow-sm p-8 space-y-4"
              style={{ borderColor: fieldErrors.terms ? '#C9982A' : '#e2e8f0' }}>
              <h2 className="font-display text-xl text-navy-950">Confirmation</h2>
              {fieldErrors.terms && <p className="text-xs font-semibold" style={{ color: '#C9982A' }}>Please accept both confirmations to continue.</p>}
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={termsAgreed} onChange={e => { setTermsAgreed(e.target.checked); if (e.target.checked) setFieldErrors(p => ({...p, terms: false})) }}
                  className="mt-0.5 accent-gold-500 shrink-0" />
                <span className="text-sm text-slate-600">
                  I confirm that I have read and agree to the{' '}
                  <Link href="/terms" className="underline text-navy-700 hover:text-gold-600">Terms of Service</Link>.
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={dataConsent} onChange={e => { setDataConsent(e.target.checked); if (e.target.checked) setFieldErrors(p => ({...p, terms: false})) }}
                  className="mt-0.5 accent-gold-500 shrink-0" />
                <span className="text-sm text-slate-600">
                  I consent to {platformName} holding and processing my personal data for the purpose of matching me with freelancing opportunities, in accordance with the{' '}
                  <Link href="/privacy-policy" className="underline text-navy-700 hover:text-gold-600">Privacy Policy</Link>.
                </span>
              </label>
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 mt-2">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Registering your interest does not guarantee placement. Our team will review your profile and contact you when a suitable opportunity becomes available.
                </p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
              {status === 'error' && <p className="text-red-500 text-sm mb-4">Something went wrong. Please try again or contact us directly.</p>}
              <input type="text" value={form._h} onChange={e => setForm({...form, _h: e.target.value})} style={{ display: 'none' }} tabIndex={-1} autoComplete="off" aria-hidden="true" />
              <div className="flex items-center justify-between">
                <button type="button" onClick={handleBack}
                  className="flex items-center gap-2 text-sm font-semibold h-11 px-6 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" /></svg>
                  Back
                </button>
                <button type="submit" disabled={status === 'loading'}
                  className="text-white font-semibold h-11 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  style={{ background: brand }}>
                  {status === 'loading' ? 'Submitting...' : 'Register My Interest'}
                  {status !== 'loading' && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-400 text-center mt-4">We review every registration personally. You will hear from us once a suitable opportunity becomes available.</p>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}

export default function FreelancingPathwaysClient({ isEthioTax }: { isEthioTax: boolean }) {
  const brand        = isEthioTax ? '#1A4731' : '#0C1A3D'
  const gold         = '#C9982A'
  const platformName = isEthioTax ? 'EthioTax' : 'Accounting Body'

  const audienceCards = [
    {
      eyebrow: 'Qualified but not yet freelancing',
      title: isEthioTax ? 'Looking for work or recently graduated?' : 'Qualified and looking for opportunities?',
      body: isEthioTax
        ? 'Many Ethiopian finance professionals are qualified but not yet working in their field. Freelancing is a powerful way to build your practice, serve your community, and grow your income on your own terms.'
        : 'If you are qualified or recently graduated and open to freelancing as an alternative to traditional employment, we can help you find your first clients and build a sustainable independent practice.',
      points: [
        'No need to wait for a permanent role',
        'Build experience while earning income',
        'We match you to clients suited to your level',
        'Grow at your own pace',
      ],
      dark: false,
    },
    {
      eyebrow: 'Already employed — want more',
      title: isEthioTax ? 'Working full-time but want to grow beyond it?' : 'Employed professional exploring freelancing?',
      body: isEthioTax
        ? 'Thousands of Ethiopian professionals across the diaspora work in accounting and finance but have never explored freelancing. The Ethiopian community needs qualified professionals. Your skills are in demand.'
        : 'Many of the strongest freelancers started while still employed. If you are a finance or accounting professional looking to build a side practice — or eventually transition to full independence — this is the right starting point.',
      points: [
        'Start part-time alongside your current role',
        'Build a client base before going independent',
        'We handle client matching and administration',
        'Transition to full independence when ready',
      ],
      dark: true,
    },
  ]

  return (
    <main className="min-h-screen bg-surface">

      {/* HERO */}
      <section className="relative overflow-hidden py-20 md:py-28" style={{ background: brand }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, rgba(212,160,23,0.3) 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>
        <div className="container-site relative z-10">
          <nav className="flex items-center gap-2 text-white/40 text-sm mb-10">
            <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span className="text-white/70">Freelancing Pathways</span>
          </nav>
          <span className="eyebrow text-gold-400 mb-5 block">{platformName} — Freelancing Pathways</span>
          <h1 className="font-display text-white text-4xl md:text-5xl lg:text-6xl mb-6 leading-tight"
            style={{ letterSpacing: '-0.02em' }}>
            {isEthioTax
              ? 'Your skills are in demand.\nFreelancing is the opportunity.'
              : 'Turn your qualifications\ninto an independent practice.'}
          </h1>
          <p className="text-white/60 text-xl leading-relaxed mb-10 max-w-2xl">
            {isEthioTax
              ? 'Whether you are looking for work, recently graduated, or already employed — if you have accounting or finance skills, there is a freelancing opportunity waiting for you. EthioTax will help you find it.'
              : 'Whether you are between roles, newly qualified, or employed and ready to build something of your own — we can help you take the first steps into freelancing and grow from there.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
            <a href="#register"
              className="flex-1 inline-flex items-center justify-center gap-2 px-7 rounded-xl min-h-[56px] text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: gold, color: brand }}>
              Register Your Interest
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </a>
            <a href="#faq"
              className="flex-1 inline-flex items-center justify-center gap-2 px-7 rounded-xl min-h-[56px] text-sm font-medium text-white border border-white/25 hover:bg-white/10 transition-colors">
              How freelancing works
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </a>
          </div>
        </div>
      </section>

      {/* AUDIENCE CARDS */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <span className="eyebrow mb-3 block">Who This Is For</span>
            <h2 className="section-title mb-4">Two groups. One opportunity.</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Freelancing is not just for established independents. It is a genuine pathway for qualified professionals at any stage of their career.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {audienceCards.map((card, i) => (
              <div key={i} className="rounded-2xl p-8 flex flex-col"
                style={card.dark
                  ? { background: brand, border: '1px solid transparent' }
                  : { background: 'white', border: `2px solid ${brand}20`, boxShadow: `0 0 0 1px ${brand}10` }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-3"
                  style={{ color: card.dark ? gold : brand }}>{card.eyebrow}</p>
                <h3 className="font-display text-2xl mb-3 leading-snug"
                  style={{ color: card.dark ? 'white' : '#0C1A3D' }}>{card.title}</h3>
                <p className="text-sm leading-relaxed mb-6 flex-1"
                  style={{ color: card.dark ? 'rgba(255,255,255,0.6)' : '#475569' }}>{card.body}</p>
                <ul className="space-y-3">
                  {card.points.map(pt => (
                    <li key={pt} className="flex items-center gap-3 text-sm"
                      style={{ color: card.dark ? 'rgba(255,255,255,0.8)' : '#374151' }}>
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke={card.dark ? gold : brand} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REGISTRATION FORM */}
      <section id="register" className="section bg-white border-t border-slate-200">
        <div className="container-site">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <span className="eyebrow mb-3 block">Register Your Interest</span>
            <h2 className="section-title mb-4">Tell us about yourself</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Complete the form below and our team will review your profile. We will be in touch when a suitable freelancing opportunity becomes available.
            </p>
          </div>
          <div className="max-w-2xl mx-auto">
            <FreelancingForm isEthioTax={isEthioTax} brand={brand} platformName={platformName} />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="section relative overflow-hidden" style={{ background: brand }}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="container-site relative z-10">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest mb-3 block" style={{ color: gold }}>Freelancing Explained</span>
            <h2 className="font-display text-3xl md:text-4xl text-white mb-4">
              Everything you need to know
            </h2>
            <p className="text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Common questions about freelancing answered clearly, without jargon, for professionals at any stage.
            </p>
          </div>
          <div className="max-w-3xl mx-auto">
            <FaqAccordion />
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="relative overflow-hidden py-24 md:py-32 bg-slate-50 border-t border-slate-200">
        <div className="container-site relative z-10">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="font-display text-3xl md:text-4xl mb-4" style={{ color: brand }}>Ready to take the first step?</h2>
            <p className="text-slate-500 text-lg mb-10 leading-relaxed">Register your interest and our team will be in touch. No commitment required.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a href="#register"
                className="flex-1 h-13 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-colors shadow-sm min-h-[52px]"
                style={{ background: brand }}>
                Register Your Interest
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </a>
              <Link href="/jobs/find-work"
                className="flex-1 h-13 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold border-2 transition-colors min-h-[52px]"
                style={{ borderColor: brand, color: brand }}>
                Looking for employment instead?
              </Link>
            </div>
          </div>
        </div>
      </section>

    </main>
  )
}
