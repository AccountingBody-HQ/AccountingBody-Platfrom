'use client'

import { useState } from 'react'
import { ADMIN_COLORS } from '@/lib/admin-theme'

interface Props {
  slug: string
  initialStatus: string
}

export default function StatusToggleButton({ slug, initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isPaused = status === 'paused'

  async function handleToggle() {
    const newStatus = isPaused ? 'active' : 'paused'
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/roodber8/providers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, status: newStatus }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (res.ok && data.ok) {
        setStatus(newStatus)
      } else {
        setError(data.error ?? 'Failed to update status')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column',
      alignItems: 'flex-end', gap: '4px' }}>
      <button
        onClick={handleToggle}
        disabled={loading}
        style={{
          background: isPaused
            ? ADMIN_COLORS.successBg
            : ADMIN_COLORS.warningBg,
          border: '1px solid ' + (isPaused
            ? ADMIN_COLORS.success
            : ADMIN_COLORS.warning),
          color: isPaused ? ADMIN_COLORS.success : ADMIN_COLORS.warning,
          borderRadius: '6px',
          padding: '6px 14px',
          fontSize: '12px',
          fontWeight: '600',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        {loading
          ? 'Updating...'
          : isPaused
            ? '▶ Resume Provider'
            : '⏸ Pause Provider'}
      </button>
      {error && (
        <span style={{
          color: ADMIN_COLORS.danger,
          fontSize: '11px',
        }}>
          {error}
        </span>
      )}
    </div>
  )
}
