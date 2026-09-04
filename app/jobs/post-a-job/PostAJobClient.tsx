'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

type ApplyMethod = 'platform' | 'external' | 'email'

const QUALIFICATIONS = ['ACCA', 'CIMA', 'ICAEW', 'AAT', 'CPA', 'ETICPA', 'ATT', 'None required']

const EMPLOYMENT_TYPES: { value: string; label: string }[] = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'contract', label: 'Contract' },
  { value: 'temporary', label: 'Temporary' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'internship', label: 'Internship' },
]

const SENIORITY_LEVELS: { value: string; label: string }[] = [
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid-level' },
  { value: 'senior', label: 'Senior' },
  { value: 'executive', label: 'Executive' },
  { value: 'director', label: 'Director' },
]

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'financial-accounting', label: 'Financial Accounting' },
  { value: 'management-accounting', label: 'Management Accounting' },
  { value: 'taxation', label: 'Taxation' },
  { value: 'audit-assurance', label: 'Audit & Assurance' },
  { value: 'financial-management', label: 'Financial Management' },
  { value: 'business-management', label: 'Business Management' },
]

const MIN_DESCRIPTION_LENGTH = 200

interface FormState {
  title: string
  companyName: string
  locationText: string
  locationRemote: boolean
  employmentType: string
  description: string
  salaryText: string
  qualifications: string[]
  skillsText: string
  seniorityLevel: string
  category: string
  applyMethod: ApplyMethod
  applicationInstructions: string
  applicationUrl: string
  applicationEmail: string
  employerName: string
  employerEmail: string
  employerPhone: string
}

const INITIAL_STATE: FormState = {
  title: '',
  companyName: '',
  locationText: '',
  locationRemote: false,
  employmentType: '',
  description: '',
  salaryText: '',
  qualifications: [],
  skillsText: '',
  seniorityLevel: '',
  category: '',
  applyMethod: 'external',
  applicationInstructions: '',
  applicationUrl: '',
  applicationEmail: '',
  employerName: '',
  employerEmail: '',
  employerPhone: '',
}

const STEPS = [
  { number: 1, label: 'Job Details', shortLabel: 'Details' },
  { number: 2, label: 'Application Method', shortLabel: 'Method' },
  { number: 3, label: 'Your Details & Payment', shortLabel: 'Payment' },
]

function ProgressBar({ currentStep, brand }: { currentStep: number; brand: string }) {
  return (
    <div className="mb-8">
      <div className="hidden sm:flex items-start justify-between mb-3">
        {STEPS.map(step => (
          <div key={step.number} className="flex flex-col items-center" style={{ width: '33.33%' }}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-1 transition-all"
              style={{ background: currentStep >= step.number ? brand : '#e2e8f0', color: currentStep >= step.number ? '#fff' : '#94a3b8' }}
            >
              {currentStep > step.number
                ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                : step.number}
            </div>
            <span className="text-xs text-center leading-tight" style={{ color: currentStep >= step.number ? brand : '#94a3b8', fontWeight: currentStep === step.number ? 600 : 400 }}>
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
        <span className="text-xs font-semibold" style={{ color: brand }}>{STEPS[currentStep - 1].shortLabel}</span>
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="block text-sm font-semibold text-navy-950 mb-2">
        {label}{required && <span style={{ color: '#C9982A' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

const inputClass = 'w-full border border-slate-200 rounded-lg px-4 py-3 text-sm text-navy-950 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-colors'

export default function PostAJobClient({ isEthioTax }: { isEthioTax: boolean }) {
  const brand = isEthioTax ? '#1A4731' : '#0C1A3D'
  const gold = '#C9982A'
  const platformName = isEthioTax ? 'EthioTax' : 'Accounting Body'

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>(INITIAL_STATE)
  const [stepError, setStepError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function toggleQualification(q: string) {
    setForm(f => ({
      ...f,
      qualifications: f.qualifications.includes(q)
        ? f.qualifications.filter(x => x !== q)
        : [...f.qualifications, q],
    }))
  }

  const descriptionLength = form.description.trim().length
  const descriptionOk = descriptionLength >= MIN_DESCRIPTION_LENGTH

  function validateStep1(): string | null {
    if (!form.title.trim()) return 'Job title is required.'
    if (!form.companyName.trim()) return 'Company name is required.'
    if (!form.locationText.trim() && !form.locationRemote) return 'Location is required (or mark as remote).'
    if (!form.employmentType) return 'Please select an employment type.'
    if (!descriptionOk) return `Job description must be at least ${MIN_DESCRIPTION_LENGTH} characters (currently ${descriptionLength}).`
    return null
  }

  function validateStep2(): string | null {
    if (form.applyMethod === 'external' && !form.applicationUrl.trim()) return 'Please provide your application page URL.'
    if (form.applyMethod === 'email' && !form.applicationEmail.trim()) return 'Please provide an application email address.'
    if (form.applyMethod === 'platform' && !form.applicationInstructions.trim()) return 'Please describe how candidates should apply.'
    return null
  }

  function validateStep3(): string | null {
    if (!form.employerName.trim()) return 'Your name is required.'
    if (!form.employerEmail.trim()) return 'Your email is required.'
    if (!form.companyName.trim()) return 'Company name is required.'
    return null
  }

  function goNext() {
    const err = step === 1 ? validateStep1() : step === 2 ? validateStep2() : null
    if (err) { setStepError(err); return }
    setStepError(null)
    setStep(s => Math.min(3, s + 1))
  }

  function goBack() {
    setStepError(null)
    setStep(s => Math.max(1, s - 1))
  }

  const skillsArray = useMemo(
    () => form.skillsText.split(',').map(s => s.trim()).filter(Boolean),
    [form.skillsText]
  )

  async function handleSubmit() {
    const err = validateStep3()
    if (err) { setStepError(err); return }
    setStepError(null)
    setSubmitError(null)
    setSubmitting(true)

    // apply_method='platform' has no dedicated free-text column in the
    // Phase 1 jobs schema (only application_url / application_email).
    // Rather than invent a column outside the authorised migration, the
    // candidate-facing instructions are folded into the stored job
    // description, clearly separated. Phase 2 should add a dedicated
    // `application_instructions` column once the in-platform apply flow
    // (job_applications) is fully built.
    const description = form.applyMethod === 'platform' && form.applicationInstructions.trim()
      ? `${form.description.trim()}\n\n---\nHow to apply: ${form.applicationInstructions.trim()}`
      : form.description.trim()

    const payload = {
      title: form.title.trim(),
      company_name: form.companyName.trim(),
      description,
      location_text: form.locationRemote ? (form.locationText.trim() || 'Remote') : form.locationText.trim(),
      location_remote: form.locationRemote,
      employment_type: form.employmentType || undefined,
      seniority_level: form.seniorityLevel || undefined,
      category: form.category || undefined,
      salary_text: form.salaryText.trim() || undefined,
      qualifications_required: form.qualifications.length > 0 ? form.qualifications : undefined,
      skills_required: skillsArray.length > 0 ? skillsArray : undefined,
      apply_method: form.applyMethod,
      application_url: form.applyMethod === 'external' ? form.applicationUrl.trim() : undefined,
      application_email: form.applyMethod === 'email' ? form.applicationEmail.trim() : undefined,
      employer_name: form.employerName.trim(),
      employer_email: form.employerEmail.trim(),
      employer_company: form.companyName.trim(),
      employer_phone: form.employerPhone.trim() || undefined,
    }

    try {
      const res = await fetch('/api/jobs/employer/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.checkoutUrl) {
        setSubmitError(data.error || 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }
      window.location.href = data.checkoutUrl
    } catch {
      setSubmitError('Could not reach the server. Please check your connection and try again.')
      setSubmitting(false)
    }
  }

  return (
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
            <span className="text-white/70">Post a Job</span>
          </nav>
          <span className="eyebrow text-gold-400 mb-4 block">{platformName} Recruitment</span>
          <h1 className="font-display text-white text-4xl md:text-5xl mb-4 leading-tight" style={{ letterSpacing: '-0.02em' }}>
            {isEthioTax ? 'Post a Job on EthioTax' : 'Post a Job'}
          </h1>
          <p className="text-white/60 text-xl leading-relaxed max-w-2xl">
            {isEthioTax
              ? 'Reach the Ethiopian accounting and finance community worldwide.'
              : 'Reach thousands of qualified accounting and finance professionals. Listings go live within 24 hours after review.'}
          </p>
        </div>
      </section>

      {/* MAIN CONTENT */}
      <section className="py-16 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
            <ProgressBar currentStep={step} brand={brand} />

            {stepError && (
              <p className="text-red-500 text-sm mb-6">{stepError}</p>
            )}

            {step === 1 && (
              <div>
                <Field label="Job title" required>
                  <input className={inputClass} value={form.title} onChange={e => update('title', e.target.value)} placeholder="e.g. Senior Financial Accountant" />
                </Field>
                <Field label="Company name" required>
                  <input className={inputClass} value={form.companyName} onChange={e => update('companyName', e.target.value)} placeholder="e.g. Acme Ltd" />
                </Field>
                <Field label="Location" required>
                  <input className={inputClass} value={form.locationText} onChange={e => update('locationText', e.target.value)}
                    placeholder="e.g. London, UK" disabled={form.locationRemote} />
                  <label className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                    <input type="checkbox" checked={form.locationRemote} onChange={e => update('locationRemote', e.target.checked)} className="accent-gold-500" />
                    This role is fully remote
                  </label>
                </Field>
                <Field label="Employment type" required>
                  <select className={inputClass} value={form.employmentType} onChange={e => update('employmentType', e.target.value)}>
                    <option value="">Select employment type</option>
                    {EMPLOYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </Field>
                <Field label="Job description" required>
                  <textarea className={inputClass} rows={8} value={form.description}
                    onChange={e => update('description', e.target.value)}
                    placeholder="Describe the role, responsibilities and what makes it a great opportunity..." />
                  <p className="text-xs mt-1" style={{ color: descriptionOk ? '#16a34a' : '#94a3b8' }}>
                    {descriptionLength} / {MIN_DESCRIPTION_LENGTH} characters minimum
                  </p>
                </Field>
                <Field label="Salary">
                  <input className={inputClass} value={form.salaryText} onChange={e => update('salaryText', e.target.value)}
                    placeholder="e.g. £40,000 – £50,000 per annum" />
                </Field>
                <Field label="Qualifications required">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {QUALIFICATIONS.map(q => (
                      <label key={q} className="flex items-center gap-2 min-h-[44px] text-sm text-slate-600 px-3 py-2 rounded-lg border border-slate-200 cursor-pointer"
                        style={form.qualifications.includes(q) ? { borderColor: gold, background: '#fdf8ee' } : undefined}>
                        <input type="checkbox" checked={form.qualifications.includes(q)} onChange={() => toggleQualification(q)} className="accent-gold-500 shrink-0" />
                        {q}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Skills required">
                  <input className={inputClass} value={form.skillsText} onChange={e => update('skillsText', e.target.value)}
                    placeholder="Comma-separated, e.g. Excel, SAP, IFRS" />
                </Field>
                <Field label="Seniority level">
                  <select className={inputClass} value={form.seniorityLevel} onChange={e => update('seniorityLevel', e.target.value)}>
                    <option value="">Select seniority level</option>
                    {SENIORITY_LEVELS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </Field>
                <Field label="Category">
                  <select className={inputClass} value={form.category} onChange={e => update('category', e.target.value)}>
                    <option value="">Select a category</option>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </Field>
              </div>
            )}

            {step === 2 && (
              <div>
                <Field label="How should candidates apply?" required>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 cursor-pointer"
                      style={form.applyMethod === 'platform' ? { borderColor: gold, background: '#fdf8ee' } : undefined}>
                      <input type="radio" className="mt-1 accent-gold-500" name="applyMethod" checked={form.applyMethod === 'platform'}
                        onChange={() => update('applyMethod', 'platform')} />
                      <span className="text-sm text-navy-950 font-semibold">
                        Candidates apply on {platformName}
                        <span className="block text-xs font-normal text-slate-500 mt-0.5">We collect applications directly through this listing.</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 cursor-pointer"
                      style={form.applyMethod === 'external' ? { borderColor: gold, background: '#fdf8ee' } : undefined}>
                      <input type="radio" className="mt-1 accent-gold-500" name="applyMethod" checked={form.applyMethod === 'external'}
                        onChange={() => update('applyMethod', 'external')} />
                      <span className="text-sm text-navy-950 font-semibold">
                        Link to your own application page
                        <span className="block text-xs font-normal text-slate-500 mt-0.5">Candidates are sent to your careers site or ATS.</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 cursor-pointer"
                      style={form.applyMethod === 'email' ? { borderColor: gold, background: '#fdf8ee' } : undefined}>
                      <input type="radio" className="mt-1 accent-gold-500" name="applyMethod" checked={form.applyMethod === 'email'}
                        onChange={() => update('applyMethod', 'email')} />
                      <span className="text-sm text-navy-950 font-semibold">
                        Candidates email you directly
                        <span className="block text-xs font-normal text-slate-500 mt-0.5">We display an email address for candidates to contact.</span>
                      </span>
                    </label>
                  </div>
                </Field>

                {form.applyMethod === 'platform' && (
                  <Field label="Application instructions" required>
                    <textarea className={inputClass} rows={4} value={form.applicationInstructions}
                      onChange={e => update('applicationInstructions', e.target.value)}
                      placeholder="Tell candidates what to include, e.g. CV and a short cover note." />
                  </Field>
                )}
                {form.applyMethod === 'external' && (
                  <Field label="Application URL" required>
                    <input className={inputClass} type="url" value={form.applicationUrl}
                      onChange={e => update('applicationUrl', e.target.value)}
                      placeholder="https://yourcompany.com/careers/role" />
                  </Field>
                )}
                {form.applyMethod === 'email' && (
                  <Field label="Application email" required>
                    <input className={inputClass} type="email" value={form.applicationEmail}
                      onChange={e => update('applicationEmail', e.target.value)}
                      placeholder={form.employerEmail || 'hiring@yourcompany.com'} />
                  </Field>
                )}
              </div>
            )}

            {step === 3 && (
              <div>
                <Field label="Your name" required>
                  <input className={inputClass} value={form.employerName} onChange={e => update('employerName', e.target.value)} placeholder="Full name" />
                </Field>
                <Field label="Your email" required>
                  <input className={inputClass} type="email" value={form.employerEmail} onChange={e => update('employerEmail', e.target.value)} placeholder="you@company.com" />
                  <p className="text-xs mt-1 text-slate-400">Approval and rejection notifications go here.</p>
                </Field>
                <Field label="Your phone">
                  <input className={inputClass} value={form.employerPhone} onChange={e => update('employerPhone', e.target.value)} placeholder="Optional" />
                </Field>
                <Field label="Company name" required>
                  <input className={inputClass} value={form.companyName} onChange={e => update('companyName', e.target.value)} />
                </Field>

                <div className="rounded-xl border border-slate-200 p-5 mb-6" style={{ background: '#FAFAF8' }}>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Summary</p>
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex justify-between gap-4"><dt className="text-slate-500 shrink-0">Job title</dt><dd className="text-navy-950 font-semibold text-right min-w-0 break-words">{form.title || '—'}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500 shrink-0">Company</dt><dd className="text-navy-950 font-semibold text-right min-w-0 break-words">{form.companyName || '—'}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500 shrink-0">Location</dt><dd className="text-navy-950 font-semibold text-right min-w-0 break-words">{form.locationRemote ? 'Remote' : (form.locationText || '—')}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500 shrink-0">Employment type</dt><dd className="text-navy-950 font-semibold text-right capitalize min-w-0 break-words">{form.employmentType.replace('_', ' ') || '—'}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500 shrink-0">Application method</dt><dd className="text-navy-950 font-semibold text-right capitalize min-w-0 break-words">{form.applyMethod}</dd></div>
                  </dl>
                </div>

                <div className="rounded-xl p-6 mb-6" style={{ background: brand }}>
                  <p className="text-white font-display text-4xl mb-2">£9.00</p>
                  <p className="text-white/70 text-sm mb-1">60-day listing · Hiring Direct badge · Top placement</p>
                  <p className="text-white/40 text-xs">All taxes handled · Secure payment via Lemon Squeezy</p>
                </div>

                {submitError && (
                  <p className="text-red-500 text-sm mb-4">{submitError}</p>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 h-12 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: gold, color: brand }}>
                  {submitting
                    ? <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        Processing...
                      </>
                    : <>Post Job & Pay £9 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg></>
                  }
                </button>
              </div>
            )}

            {step !== 3 && (
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
                {step > 1 ? (
                  <button type="button" onClick={goBack}
                    className="flex items-center gap-2 text-sm font-semibold h-11 px-6 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" /></svg>
                    Back
                  </button>
                ) : <div />}
                <button type="button" onClick={goNext}
                  className="flex items-center gap-2 text-sm font-semibold h-11 px-6 rounded-lg text-white transition-colors"
                  style={{ background: brand }}>
                  Continue
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </button>
              </div>
            )}
            {step === 3 && (
              <div className="flex items-center justify-start mt-4">
                <button type="button" onClick={goBack}
                  className="flex items-center gap-2 text-sm font-semibold h-11 px-6 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" /></svg>
                  Back
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
