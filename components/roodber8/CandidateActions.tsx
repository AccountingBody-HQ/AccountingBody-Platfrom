'use client'

import { useState } from 'react'

interface CandidateActionButtonsProps {
  id: string
  currentStatus: string
  email: string
  name: string
  platform: string
}

export function CandidateActionButtons({ id, currentStatus, email, name, platform }: CandidateActionButtonsProps) {
  const [status, setStatus] = useState(currentStatus)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const updateStatus = async (newStatus: string) => {
    if (newStatus === status) return
    setLoading(true)
    setToast(null)
    try {
      const res = await fetch('/api/roodber8/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_status',
          table: 'job_seeker_registrations',
          id,
          payload: { status: newStatus, reviewed_at: new Date().toISOString() },
        }),
      })
      if (!res.ok) throw new Error('Status update failed')

      const emailRes = await fetch('/api/roodber8/notify-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus, email, name, platform }),
      })

      setStatus(newStatus)
      setToast({
        msg: emailRes.ok
          ? (newStatus === 'active' ? '✓ Approval email sent' : '✓ Rejection email sent')
          : '✓ Status updated (email failed)',
        ok: emailRes.ok,
      })
    } catch {
      setToast({ msg: '✗ Update failed', ok: false })
    } finally {
      setLoading(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {toast && (
        <span className="text-xs font-semibold px-2 py-1 rounded-lg"
          style={{ color: toast.ok ? '#34d399' : '#f87171', background: toast.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
          {toast.msg}
        </span>
      )}
      {status !== 'active' && (
        <button onClick={() => updateStatus('active')} disabled={loading}
          className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>
          {loading ? '...' : 'Approve'}
        </button>
      )}
      {status !== 'rejected' && (
        <button onClick={() => updateStatus('rejected')} disabled={loading}
          className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
          {loading ? '...' : 'Reject'}
        </button>
      )}
    </div>
  )
}
