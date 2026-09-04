'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface ManagedJob {
  id: string
  title: string
  company_name: string
  location_text: string
  employment_type: string | null
  salary_text: string | null
  qualifications_required: string[]
  apply_method: string
  status: string
  rejection_reason: string | null
  created_at: string
  expires_at: string | null
}

interface StatusConfig {
  label: string
  bg: string
  color: string
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  pending_payment: { label: 'Awaiting payment. Your listing will be reviewed once payment is confirmed.', bg: '#fef3c7', color: '#92400e' },
  pending_approval: { label: 'Under review. Our team will approve your listing within 24 hours.', bg: '#dbeafe', color: '#1e40af' },
  active: { label: 'Your listing is live.', bg: '#f0fdf4', color: '#166534' },
  expired: { label: 'This listing has expired.', bg: '#f1f5f9', color: '#475569' },
  closed: { label: 'This listing has been withdrawn.', bg: '#f1f5f9', color: '#475569' },
  rejected: { label: 'This listing was not approved.', bg: '#fee2e2', color: '#991b1b' },
}

const WITHDRAWABLE_STATUSES = ['active', 'pending_approval']

function formatDate(value: string | null): string {
  if (!value) return 'Pending approval'
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ManageListingClient({ token, isEthioTax }: { token: string; isEthioTax: boolean }) {
  const brand = isEthioTax ? '#1A4731' : '#0C1A3D'
  const platformName = isEthioTax ? 'EthioTax' : 'Accounting Body'

  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)
  const [job, setJob] = useState<ManagedJob | null>(null)

  const [confirming, setConfirming] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [withdrawn, setWithdrawn] = useState(false)

  useEffect(() => {
    if (!token || !token.trim()) {
      setInvalid(true)
      setLoading(false)
      return
    }
    fetch('/api/jobs/manage?token=' + encodeURIComponent(token))
      .then(r => r.json())
      .then(({ job: data, error }) => {
        if (error || !data) { setInvalid(true); setLoading(false); return }
        setJob(data)
        setLoading(false)
      })
      .catch(() => { setInvalid(true); setLoading(false) })
  }, [token])

  async function handleWithdraw() {
    if (!job) return
    setWithdrawing(true)
    setWithdrawError(null)
    try {
      const res = await fetch('/api/jobs/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'close' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Something went wrong')
      setJob(j => j ? { ...j, status: 'closed' } : j)
      setWithdrawn(true)
      setConfirming(false)
    } catch (err: unknown) {
      setWithdrawError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setWithdrawing(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
      <p style={{ color: brand, fontFamily: 'Georgia, serif', fontSize: 16 }}>Loading your listing...</p>
    </div>
  )

  if (invalid || !job) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm max-w-md">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: '#fee2e2' }}>
          <svg className="w-8 h-8" fill="none" stroke="#ef4444" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </div>
        <h2 className="font-display text-2xl mb-3" style={{ color: '#dc2626' }}>Invalid Link</h2>
        <p className="text-slate-500 mb-4">This link is invalid or has expired.</p>
        <Link href="/jobs/listings" className="text-sm font-semibold underline" style={{ color: brand }}>Browse live jobs</Link>
      </div>
    </div>
  )

  const statusConfig = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.closed
  const canWithdraw = !withdrawn && WITHDRAWABLE_STATUSES.includes(job.status)

  return (
    <>
      <div style={{ background: brand, padding: '32px 24px 48px' }}>
        <div className="max-w-3xl mx-auto">
          <p style={{ color: '#D4A017', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
            {platformName} — Job Listings
          </p>
          <h1 style={{ color: '#fff', fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, margin: 0 }}>
            Manage your listing
          </h1>
        </div>
      </div>

      <div style={{ background: '#f8fafc', padding: '40px 24px' }}>
        <div className="max-w-3xl mx-auto">

          {/* STATUS BANNER */}
          <div className="rounded-xl border border-slate-200 shadow-sm p-6 mb-6" style={{ background: statusConfig.bg }}>
            <p className="text-sm font-semibold" style={{ color: statusConfig.color }}>
              {withdrawn ? 'Your listing has been withdrawn. A confirmation email has been sent.' : statusConfig.label}
            </p>
            {!withdrawn && job.status === 'active' && (
              <a href="/jobs/listings" target="_blank" rel="noopener noreferrer"
                className="text-sm font-semibold underline mt-1 inline-block" style={{ color: statusConfig.color }}>
                View live listings →
              </a>
            )}
            {!withdrawn && job.status === 'rejected' && job.rejection_reason && (
              <p className="text-sm mt-2" style={{ color: statusConfig.color }}>Reason: {job.rejection_reason}</p>
            )}
          </div>

          {/* LISTING SUMMARY */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 mb-6">
            <h2 className="font-display text-xl mb-6" style={{ color: brand }}>Listing summary</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
              <div><p className="text-slate-400 text-xs mb-1">Job title</p><p className="font-semibold text-slate-700">{job.title}</p></div>
              <div><p className="text-slate-400 text-xs mb-1">Company</p><p className="font-semibold text-slate-700">{job.company_name}</p></div>
              <div><p className="text-slate-400 text-xs mb-1">Location</p><p className="font-semibold text-slate-700">{job.location_text}</p></div>
              <div><p className="text-slate-400 text-xs mb-1">Employment type</p><p className="font-semibold text-slate-700 capitalize">{job.employment_type ? job.employment_type.replace('_', ' ') : 'Not specified'}</p></div>
              <div><p className="text-slate-400 text-xs mb-1">Salary</p><p className="font-semibold text-slate-700">{job.salary_text || 'Not specified'}</p></div>
              <div><p className="text-slate-400 text-xs mb-1">Application method</p><p className="font-semibold text-slate-700 capitalize">{job.apply_method}</p></div>
              <div><p className="text-slate-400 text-xs mb-1">Posted</p><p className="font-semibold text-slate-700">{formatDate(job.created_at)}</p></div>
              <div><p className="text-slate-400 text-xs mb-1">Expires</p><p className="font-semibold text-slate-700">{formatDate(job.expires_at)}</p></div>
              {job.qualifications_required.length > 0 && (
                <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                  <p className="text-slate-400 text-xs mb-1">Qualifications required</p>
                  <p className="font-semibold text-slate-700">{job.qualifications_required.join(', ')}</p>
                </div>
              )}
            </div>
          </div>

          {/* WITHDRAW */}
          {canWithdraw && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 mb-6">
              {!confirming ? (
                <button type="button" onClick={() => setConfirming(true)}
                  className="text-sm font-semibold h-11 px-6 rounded-lg border-2 transition-colors hover:bg-red-50"
                  style={{ borderColor: '#dc2626', color: '#dc2626', background: 'transparent' }}>
                  Withdraw this listing
                </button>
              ) : (
                <div className="rounded-lg border p-5" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
                  <p className="text-sm font-semibold mb-1" style={{ color: '#991b1b' }}>Are you sure you want to withdraw this listing?</p>
                  <p className="text-sm mb-4" style={{ color: '#991b1b' }}>This cannot be undone. Your listing will be removed from the platform immediately.</p>
                  {withdrawError && <p className="text-sm font-semibold mb-4" style={{ color: '#991b1b' }}>{withdrawError}</p>}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <button type="button" onClick={handleWithdraw} disabled={withdrawing}
                      className="w-full sm:w-auto text-sm font-semibold h-11 px-6 rounded-lg text-white disabled:opacity-50"
                      style={{ background: '#dc2626' }}>
                      {withdrawing ? 'Withdrawing...' : 'Yes, withdraw listing'}
                    </button>
                    <button type="button" onClick={() => { setConfirming(false); setWithdrawError(null) }} disabled={withdrawing}
                      className="w-full sm:w-auto text-sm font-semibold h-11 px-6 rounded-lg border-2 disabled:opacity-50"
                      style={{ borderColor: '#cbd5e1', color: '#64748b', background: 'transparent' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CONTACT */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
            <p className="text-sm font-semibold text-slate-700 mb-1">Need help with your {platformName} listing?</p>
            <p className="text-sm text-slate-500">Contact us at <a href="mailto:info@accountingbody.com" className="underline" style={{ color: brand }}>info@accountingbody.com</a></p>
          </div>

        </div>
      </div>
    </>
  )
}
