import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { unstable_noStore as noStore } from 'next/cache'
import AutoRefresh from '@/components/roodber8/AutoRefresh'
import { getAllProviders, type ProviderRun } from '@/lib/providers'
import { Server, ChevronRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

const C = {
  card: { background: '#0d1424', border: '1px solid #1a2238', borderRadius: 16 },
}

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

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
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

async function getProvidersWithRuns() {
  noStore()
  const providers = await getAllProviders()

  const runBySlug: Record<string, ProviderRun> = {}
  if (providers.length > 0) {
    const supabase = getSupabase()
    const { data: recentRuns } = await supabase
      .from('provider_runs')
      .select('*')
      .in('provider_slug', providers.map(p => p.slug))
      .order('started_at', { ascending: false })

    for (const run of (recentRuns ?? []) as ProviderRun[]) {
      if (!runBySlug[run.provider_slug]) {
        runBySlug[run.provider_slug] = run
      }
    }
  }

  return { providers, runBySlug }
}

export default async function ProvidersPage() {
  const { providers, runBySlug } = await getProvidersWithRuns()

  const activeCount = providers.filter(p => p.status === 'active').length
  const pausedCount = providers.filter(p => p.status === 'paused').length
  const downCount = providers.filter(p => p.health_status === 'down').length
  const totalJobsToday = providers.reduce((sum, p) => sum + (p.jobs_today ?? 0), 0)

  const STATS = [
    { label: 'Active Providers', value: activeCount,     color: '#34d399', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
    { label: 'Jobs Today',       value: totalJobsToday,  color: '#60a5fa', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
    { label: 'Providers Down',   value: downCount,       color: '#f87171', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
    { label: 'Total Providers',  value: providers.length, color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
  ]

  return (
    <div className="p-8">
      <AutoRefresh />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs mb-4">
        <Link href="/roodber8" style={{ color: '#475569' }}>Command Centre</Link>
        <ChevronRight size={12} style={{ color: '#1e293b' }} />
        <span style={{ color: '#64748b' }}>Providers</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(96,165,250,0.12)' }}>
          <Server size={20} style={{ color: '#60a5fa' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Provider Management</h1>
          <p className="text-sm" style={{ color: '#475569' }}>
            {activeCount} active · {pausedCount} paused · {totalJobsToday.toLocaleString()} jobs today
            {downCount > 0 && <span style={{ color: '#f87171' }}> · {downCount} down</span>}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {STATS.map(s => (
          <div key={s.label} className="rounded-2xl border p-5" style={{ background: s.bg, borderColor: s.border }}>
            <p className="text-3xl font-black mb-1" style={{ color: s.color }}>{s.value.toLocaleString()}</p>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: s.color }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Provider table */}
      <div className="rounded-2xl border overflow-hidden" style={C.card}>
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#1a2238' }}>
          <h2 className="text-white font-bold text-sm">Providers</h2>
          <span className="text-xs font-semibold" style={{ color: '#475569' }}>{providers.length} configured</span>
        </div>

        {providers.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <Server size={32} style={{ color: '#1a2238' }} className="mx-auto mb-4" />
            <p className="text-white font-semibold mb-2">No providers configured yet</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#1a2238' }}>
            {providers.map(provider => {
              const statusStyle = STATUS_STYLE[provider.status] ?? STATUS_STYLE.active
              const healthStyle = HEALTH_STYLE[provider.health_status] ?? HEALTH_STYLE.unknown
              const latestRun = runBySlug[provider.slug]

              return (
                <Link
                  key={provider.slug}
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

                  <div className="text-right shrink-0">
                    <p className="text-lg font-black text-white">{(provider.jobs_today ?? 0).toLocaleString()}</p>
                    <p className="text-xs" style={{ color: '#334155' }}>today · {(provider.total_jobs_ingested ?? 0).toLocaleString()} total</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
