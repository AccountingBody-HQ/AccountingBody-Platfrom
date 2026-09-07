'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { JobProvider, ProviderRun } from '@/lib/providers'

const STATUS_STYLE: Record<string, { color: string; label: string }> = {
  active: { color: '#34d399', label: 'Active' },
  paused: { color: '#fbbf24', label: 'Paused' },
  error:  { color: '#f87171', label: 'Error' },
}

const HEALTH_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  healthy:  { bg: 'rgba(16,185,129,0.1)', color: '#34d399', label: 'Healthy' },
  degraded: { bg: 'rgba(245,158,11,0.1)', color: '#fbbf24', label: 'Degraded' },
  down:     { bg: 'rgba(239,68,68,0.1)',  color: '#f87171', label: 'Down' },
  unknown:  { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', label: 'Unknown' },
}

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function ProviderRow({
  provider,
  latestRun,
}: {
  provider: JobProvider
  latestRun?: ProviderRun
}) {
  const [status, setStatus] = useState(provider.status)
  const [toggling, setToggling] = useState(false)

  const statusStyle = STATUS_STYLE[status] ?? STATUS_STYLE.active
  const healthStyle = HEALTH_STYLE[provider.health_status] ?? HEALTH_STYLE.unknown
  const isActive = status === 'active'

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (toggling) return

    const nextStatus = isActive ? 'paused' : 'active'
    const prevStatus = status
    setStatus(nextStatus)
    setToggling(true)

    try {
      const res = await fetch('/api/roodber8/providers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: provider.slug, status: nextStatus }),
      })
      if (!res.ok) {
        setStatus(prevStatus)
      }
    } catch {
      setStatus(prevStatus)
    } finally {
      setToggling(false)
    }
  }

  return (
    <Link
      href={`/roodber8/providers/${provider.slug}`}
      className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-white/[0.01] transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <p className="text-white font-bold text-sm">{provider.name}</p>
          <span className="text-xs font-mono" style={{ color: '#475569' }}>{provider.slug}</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-lg" style={{ background: healthStyle.bg, color: healthStyle.color }}>
            {healthStyle.label}
          </span>
          <span className="text-xs font-semibold" style={{ color: statusStyle.color }}>
            {statusStyle.label}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: '#475569' }}>
          <span>{(provider.country_codes ?? []).join(', ').toUpperCase() || '—'}</span>
          <span>Score {provider.source_score}</span>
          <span>
            {latestRun
              ? `Last run ${formatRelative(latestRun.started_at)} · +${latestRun.jobs_inserted} inserted`
              : 'No runs yet'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          <p className="text-lg font-black text-white">{(provider.jobs_today ?? 0).toLocaleString()}</p>
          <p className="text-xs" style={{ color: '#334155' }}>today · {(provider.total_jobs_ingested ?? 0).toLocaleString()} total</p>
        </div>

        <button
          onClick={handleToggle}
          disabled={toggling}
          className="text-xs font-bold px-3 py-1.5 rounded-lg transition-opacity"
          style={{
            background: isActive ? 'rgba(251,191,36,0.12)' : 'rgba(16,185,129,0.12)',
            color: isActive ? '#fbbf24' : '#34d399',
            border: `1px solid ${isActive ? 'rgba(251,191,36,0.3)' : 'rgba(16,185,129,0.3)'}`,
            opacity: toggling ? 0.5 : 1,
          }}
        >
          {isActive ? 'Pause' : 'Resume'}
        </button>
      </div>
    </Link>
  )
}
