'use client'
import { useState } from 'react'

interface EmployerStatusButtonsProps {
  id: string
  currentStatus: string
}

export function EmployerStatusButtons({ id, currentStatus }: EmployerStatusButtonsProps) {
  const [status, setStatus] = useState(currentStatus)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const statusOptions = [
    { value: 'pending',   label: 'Pending Review', color: '#fbbf24' },
    { value: 'reviewing', label: 'Reviewing',      color: '#60a5fa' },
    { value: 'placed',    label: 'Placed',         color: '#34d399' },
    { value: 'closed',    label: 'Closed',         color: '#94a3b8' },
  ]

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
          table: 'employer_briefs',
          id,
          payload: { status: newStatus, reviewed_at: new Date().toISOString() },
        }),
      })
      if (!res.ok) throw new Error('Status update failed')
      setStatus(newStatus)
      setToast({ msg: '✓ Status updated', ok: true })
    } catch {
      setToast({ msg: '✗ Update failed', ok: false })
    } finally {
      setLoading(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  const current = statusOptions.find(s => s.value === status)

  return (
    <div className="flex items-center gap-2">
      {toast && (
        <span className="text-xs font-semibold px-2 py-1 rounded-lg"
          style={{ color: toast.ok ? '#34d399' : '#f87171', background: toast.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
          {toast.msg}
        </span>
      )}
      <select
        value={status}
        onChange={e => updateStatus(e.target.value)}
        disabled={loading}
        className="text-xs font-bold px-2 py-1.5 rounded-lg border focus:outline-none disabled:opacity-50"
        style={{
          background: 'rgba(255,255,255,0.05)',
          color: current?.color ?? '#94a3b8',
          borderColor: current?.color ?? '#94a3b8',
        }}>
        {statusOptions.map(s => (
          <option key={s.value} value={s.value} style={{ background: '#0d1424', color: s.color }}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  )
}
