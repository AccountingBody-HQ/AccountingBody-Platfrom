'use client'
import { useState, useEffect, useRef } from 'react'
import Script from 'next/script'

const employmentStatusOptions = ['Employed','Self-employed','Between roles','Student']
const roleTypeOptions = ['Permanent','Contract / Freelance','Remote only','Open to relocation']
const jurisdictionOptionsET = ['United Kingdom','Ethiopia','United States','Canada','UAE','European Union','Australia','Other']
const jurisdictionOptionsAB = ['United Kingdom','United States','Canada','Australia','European Union','UAE','Singapore','Other']
const languageOptionsET = ['English','Amharic','Afaan Oromoo','Tigrinya','Arabic','French','Spanish','Other']
const languageOptionsAB = ['English','Arabic','French','Spanish','Portuguese','Mandarin','Hindi','Other']

export default function FindWorkManageClient({ isEthioTax: isEthioTaxProp }: { isEthioTax: boolean }) {
  const isEthioTax = isEthioTaxProp
  const brand = isEthioTax ? '#1A4731' : '#0C1A3D'
  const platformName = isEthioTax ? 'EthioTax' : 'Accounting Body'

  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'idle'|'loading'|'success'|'error'|'invalid'>('idle')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [form, setForm] = useState({
    phone: '', location_city: '', location_country: '', linkedin_url: '',
    employment_status: '', salary_expectation: '', biography: '',
  })
  const [roleTypes, setRoleTypes] = useState<string[]>([])
  const [jurisdictions, setJurisdictions] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const turnstileWidgetId = useRef<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('token')
    if (!t) { setStatus('invalid'); setLoading(false); return }
    setToken(t)
    fetch('/api/recruitment/get-profile?token=' + t + '&type=candidate')
      .then(r => r.json())
      .then(({ data, error }) => {
        if (error || !data) { setStatus('invalid'); setLoading(false); return }
        setReferenceNumber(data.reference_number ?? '')
        setForm({
          phone:              data.phone ?? '',
          location_city:      data.location_city ?? '',
          location_country:   data.location_country ?? '',
          linkedin_url:       data.linkedin_url ?? '',
          employment_status:  data.employment_status ?? '',
          salary_expectation: data.salary_expectation ?? '',
          biography:          data.biography ?? '',
        })
        setRoleTypes(Array.isArray(data.role_types) ? data.role_types : [])
        setJurisdictions(Array.isArray(data.jurisdictions) ? data.jurisdictions : [])
        setLanguages(Array.isArray(data.languages) ? data.languages : [])
        setLoading(false)
      })
      .catch(() => { setStatus('invalid'); setLoading(false) })
  }, [])

  const toggle = (val: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(val) ? list.filter(x => x !== val) : [...list, val])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setStatus('loading')
    const cfToken = (document.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement)?.value ?? ''
    try {
      const res = await fetch('/api/recruitment/update-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, role_types: roleTypes, jurisdictions, languages, token, 'cf-turnstile-response': cfToken }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Update failed')
      setStatus('success')
      if (turnstileWidgetId.current) window.turnstile?.reset(turnstileWidgetId.current)
    } catch {
      setStatus('error')
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
      <p style={{ color: brand, fontFamily: 'Georgia, serif', fontSize: 16 }}>Loading your profile...</p>
    </div>
  )

  if (status === 'invalid') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm max-w-md">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: '#fee2e2' }}>
          <svg className="w-8 h-8" fill="none" stroke="#ef4444" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </div>
        <h2 className="font-display text-2xl mb-3" style={{ color: '#dc2626' }}>Invalid Link</h2>
        <p className="text-slate-500">This link is invalid. Please contact us if you need help updating your profile.</p>
      </div>
    </div>
  )

  if (status === 'success') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm max-w-md">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: '#f0fdf4' }}>
          <svg className="w-8 h-8" fill="none" stroke="#16a34a" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="font-display text-2xl mb-3" style={{ color: brand }}>Profile Updated</h2>
        <p className="text-slate-500 text-center">Your profile has been updated successfully. We will be in touch when a suitable role becomes available.</p>
      </div>
    </div>
  )

  const btnStyle = (active: boolean) => ({
    padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: active ? 'none' : '1px solid #e2e8f0',
    background: active ? brand : '#f8fafc',
    color: active ? '#fff' : '#475569',
  })

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <div style={{ background: brand, padding: '32px 24px 48px' }}>
        <div className="max-w-3xl mx-auto">
          <p style={{ color: '#D4A017', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
            {platformName} — Candidate Profile
          </p>
          <h1 style={{ color: '#fff', fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, margin: 0 }}>
            Update your profile
          </h1>
          {referenceNumber && (
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 8 }}>Reference: {referenceNumber}</p>
          )}
        </div>
      </div>

      <div style={{ background: '#f8fafc', padding: '40px 24px' }}>
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-4">
            <p className="text-sm font-semibold mb-1" style={{ color: brand }}>What you can update</p>
            <p className="text-sm text-slate-500">You can update your contact details, location, employment status, salary expectation, role preferences, and biography. Your name, email, qualification, and professional role cannot be changed — contact us if these need to be amended.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
              <h2 className="font-display text-xl" style={{ color: brand }}>Contact Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: brand }}>Phone</label>
                  <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                    className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none" placeholder="Your phone number" style={{ borderColor: '#e2e8f0' }} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: brand }}>LinkedIn URL</label>
                  <input type="url" value={form.linkedin_url} onChange={e => setForm({...form, linkedin_url: e.target.value})}
                    className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none" placeholder="https://linkedin.com/in/..." style={{ borderColor: '#e2e8f0' }} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: brand }}>City</label>
                  <input type="text" value={form.location_city} onChange={e => setForm({...form, location_city: e.target.value})}
                    className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none" placeholder="Current city" style={{ borderColor: '#e2e8f0' }} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: brand }}>Country</label>
                  <input type="text" value={form.location_country} onChange={e => setForm({...form, location_country: e.target.value})}
                    className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none" placeholder="Current country" style={{ borderColor: '#e2e8f0' }} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
              <h2 className="font-display text-xl" style={{ color: brand }}>Employment &amp; Availability</h2>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: brand }}>Employment Status</label>
                <div className="flex flex-wrap gap-2">
                  {employmentStatusOptions.map(o => (
                    <button key={o} type="button" onClick={() => setForm({...form, employment_status: o})}
                      style={btnStyle(form.employment_status === o)}>{o}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: brand }}>Salary / Rate Expectation</label>
                <input type="text" value={form.salary_expectation} onChange={e => setForm({...form, salary_expectation: e.target.value})}
                  className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none" placeholder="e.g. £45,000 or £300/day" style={{ borderColor: '#e2e8f0' }} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-3" style={{ color: brand }}>Role Types Sought</label>
                <div className="flex flex-wrap gap-2">
                  {roleTypeOptions.map(o => (
                    <button key={o} type="button" onClick={() => toggle(o, roleTypes, setRoleTypes)}
                      style={btnStyle(roleTypes.includes(o))}>{o}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-3" style={{ color: brand }}>Jurisdictions</label>
                <div className="flex flex-wrap gap-2">
                  {(isEthioTax ? jurisdictionOptionsET : jurisdictionOptionsAB).map(o => (
                    <button key={o} type="button" onClick={() => toggle(o, jurisdictions, setJurisdictions)}
                      style={btnStyle(jurisdictions.includes(o))}>{o}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-3" style={{ color: brand }}>Languages</label>
                <div className="flex flex-wrap gap-2">
                  {(isEthioTax ? languageOptionsET : languageOptionsAB).map(o => (
                    <button key={o} type="button" onClick={() => toggle(o, languages, setLanguages)}
                      style={btnStyle(languages.includes(o))}>{o}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
              <h2 className="font-display text-xl mb-6" style={{ color: brand }}>Professional Biography</h2>
              <textarea value={form.biography} onChange={e => setForm({...form, biography: e.target.value})}
                rows={8} className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none resize-none"
                placeholder="Update your professional biography..." style={{ borderColor: '#e2e8f0' }} />
            </div>

            <div className="flex justify-center">
              <div className="cf-turnstile" data-sitekey={isEthioTax ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY : process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY_AB}
                ref={el => { if (el && !turnstileWidgetId.current) { turnstileWidgetId.current = window.turnstile?.render(el, { sitekey: el.dataset.sitekey ?? '' }) } }} />
            </div>

            {status === 'error' && <p className="text-center text-sm font-semibold" style={{ color: '#dc2626' }}>Something went wrong. Please try again.</p>}

            <button type="submit" disabled={status === 'loading'}
              className="w-full py-4 rounded-xl text-white font-bold text-base disabled:opacity-50"
              style={{ background: brand }}>
              {status === 'loading' ? 'Saving...' : 'Save changes'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
