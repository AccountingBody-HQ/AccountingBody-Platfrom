'use client'
import { useState, useEffect, useRef } from 'react'
import Script from 'next/script'

const jurisdictionOptionsAB = ['United Kingdom','United States','Canada','Australia','European Union','UAE','Singapore','Other']
const jurisdictionOptionsET = ['United Kingdom','Ethiopia','United States','Canada','UAE','European Union','Australia','Other']

export default function HireTalentManageClient({ isEthioTax: isEthioTaxProp }: { isEthioTax: boolean }) {
  const isEthioTax = isEthioTaxProp
  const brand = isEthioTax ? '#1A4731' : '#0C1A3D'
  const platformName = isEthioTax ? 'EthioTax' : 'Accounting Body'

  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'idle'|'loading'|'success'|'error'|'invalid'>('idle')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [lockedFields, setLockedFields] = useState({ company_name: '', role_title: '', contract_type: '' })
  const [form, setForm] = useState({
    contact_phone: '', salary_budget: '', start_date: '',
    jurisdiction: '', role_description: '', must_haves: '', nice_to_haves: '',
  })
  const turnstileWidgetId = useRef<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('token')
    if (!t) { setStatus('invalid'); setLoading(false); return }
    setToken(t)
    fetch('/api/recruitment/get-profile?token=' + t + '&type=employer')
      .then(r => r.json())
      .then(({ data, error }) => {
        if (error || !data) { setStatus('invalid'); setLoading(false); return }
        setReferenceNumber(data.reference_number ?? '')
        setLockedFields({
          company_name:  data.company_name ?? '',
          role_title:    data.role_title ?? '',
          contract_type: data.contract_type ?? '',
        })
        setForm({
          contact_phone:    data.contact_phone ?? '',
          salary_budget:    data.salary_budget ?? '',
          start_date:       data.start_date ?? '',
          jurisdiction:     data.jurisdiction ?? '',
          role_description: data.role_description ?? '',
          must_haves:       data.must_haves ?? '',
          nice_to_haves:    data.nice_to_haves ?? '',
        })
        setLoading(false)
      })
      .catch(() => { setStatus('invalid'); setLoading(false) })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setStatus('loading')
    const cfToken = (document.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement)?.value ?? ''
    try {
      const res = await fetch('/api/recruitment/update-employer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, token, 'cf-turnstile-response': cfToken }),
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
      <p style={{ color: brand, fontFamily: 'Georgia, serif', fontSize: 16 }}>Loading your brief...</p>
    </div>
  )

  if (status === 'invalid') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm max-w-md">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: '#fee2e2' }}>
          <svg className="w-8 h-8" fill="none" stroke="#ef4444" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </div>
        <h2 className="font-display text-2xl mb-3" style={{ color: '#dc2626' }}>Invalid Link</h2>
        <p className="text-slate-500">This link is invalid or your brief is no longer open for updates. Please contact us if you need help.</p>
      </div>
    </div>
  )

  if (status === 'success') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm max-w-md">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: '#f0fdf4' }}>
          <svg className="w-8 h-8" fill="none" stroke="#16a34a" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="font-display text-2xl mb-3" style={{ color: brand }}>Brief Updated</h2>
        <p className="text-slate-500 text-center">Your hiring brief has been updated successfully. We will be in touch shortly.</p>
      </div>
    </div>
  )

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <div style={{ background: brand, padding: '32px 24px 48px' }}>
        <div className="max-w-3xl mx-auto">
          <p style={{ color: '#D4A017', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
            {platformName} — Employer Brief
          </p>
          <h1 style={{ color: '#fff', fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, margin: 0 }}>
            Update your hiring brief
          </h1>
          {referenceNumber && (
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 8 }}>Reference: {referenceNumber}</p>
          )}
        </div>
      </div>

      <div style={{ background: '#f8fafc', padding: '40px 24px' }}>
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
            <p className="text-sm font-semibold mb-3" style={{ color: brand }}>Brief summary — locked fields</p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><p className="text-slate-400 text-xs mb-1">Company</p><p className="font-semibold text-slate-700">{lockedFields.company_name}</p></div>
              <div><p className="text-slate-400 text-xs mb-1">Role</p><p className="font-semibold text-slate-700">{lockedFields.role_title}</p></div>
              <div><p className="text-slate-400 text-xs mb-1">Type</p><p className="font-semibold text-slate-700">{lockedFields.contract_type}</p></div>
            </div>
            <p className="text-xs text-slate-400 mt-3">Company name, role title, and contract type cannot be changed. Contact us if these need to be amended.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
              <h2 className="font-display text-xl" style={{ color: brand }}>Contact &amp; Timeline</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: brand }}>Contact Phone</label>
                  <input type="tel" value={form.contact_phone} onChange={e => setForm({...form, contact_phone: e.target.value})}
                    className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none" style={{ borderColor: '#e2e8f0' }} placeholder="Phone number" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: brand }}>Salary / Day Rate Budget</label>
                  <input type="text" value={form.salary_budget} onChange={e => setForm({...form, salary_budget: e.target.value})}
                    className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none" style={{ borderColor: '#e2e8f0' }} placeholder="e.g. £50,000 or £350/day" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: brand }}>Target Start Date</label>
                  <input type="text" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})}
                    className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none" style={{ borderColor: '#e2e8f0' }} placeholder="e.g. ASAP or January 2027" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: brand }}>Jurisdiction</label>
                  <select value={form.jurisdiction} onChange={e => setForm({...form, jurisdiction: e.target.value})}
                    className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none" style={{ borderColor: '#e2e8f0' }}>
                    <option value="">Select jurisdiction</option>
                    {(isEthioTax ? jurisdictionOptionsET : jurisdictionOptionsAB).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
              <h2 className="font-display text-xl" style={{ color: brand }}>Role Details</h2>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: brand }}>Role Description</label>
                <textarea value={form.role_description} onChange={e => setForm({...form, role_description: e.target.value})}
                  rows={6} className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none resize-none" style={{ borderColor: '#e2e8f0' }}
                  placeholder="Describe the role, responsibilities, and what success looks like." />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: brand }}>Must-Haves</label>
                <textarea value={form.must_haves} onChange={e => setForm({...form, must_haves: e.target.value})}
                  rows={3} className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none resize-none" style={{ borderColor: '#e2e8f0' }}
                  placeholder="Non-negotiable requirements." />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: brand }}>Nice-to-Haves</label>
                <textarea value={form.nice_to_haves} onChange={e => setForm({...form, nice_to_haves: e.target.value})}
                  rows={3} className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none resize-none" style={{ borderColor: '#e2e8f0' }}
                  placeholder="Desirable but not essential." />
              </div>
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
