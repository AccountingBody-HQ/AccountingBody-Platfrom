import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { unstable_noStore as noStore } from 'next/cache'
import { notFound } from 'next/navigation'
import AutoRefresh from '@/components/roodber8/AutoRefresh'
import RunNowButton from './RunNowButton'
import TestConnectionButton from './TestConnectionButton'
import { getProvider, type ProviderRun } from '@/lib/providers'
import { Server, ChevronRight, Pencil } from 'lucide-react'

export const dynamic = 'force-dynamic'

const C = {
  card: { background: '#0d1424', border: '1px solid #1a2238', borderRadius: 16 },
}

const HEALTH_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  healthy:  { bg: 'rgba(16,185,129,0.1)', color: '#34d399', label: 'Healthy' },
  degraded: { bg: 'rgba(245,158,11,0.1)', color: '#fbbf24', label: 'Degraded' },
  down:     { bg: 'rgba(239,68,68,0.1)',  color: '#f87171', label: 'Down' },
  unknown:  { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', label: 'Unknown' },
}

const RUN_STATUS_COLOR: Record<string, string> = {
  completed: '#34d399',
  failed:    '#f87171',
  running:   '#fbbf24',
}

interface ProviderError {
  id: string
  error_type: string
  error_code: string | null
  error_message: string
  created_at: string
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

async function getProviderDetail(slug: string) {
  noStore()
  const provider = await getProvider(slug)
  if (!provider) return null

  const supabase = getSupabase()

  const [{ data: runs }, { data: errors }, { count: activeJobCount }] = await Promise.all([
    supabase.from('provider_runs').select('*').eq('provider_slug', slug).order('started_at', { ascending: false }).limit(20),
    supabase.from('provider_errors').select('*').eq('provider_id', provider.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('provider_id', provider.id).eq('status', 'active'),
  ])

  return {
    provider,
    runs: (runs ?? []) as ProviderRun[],
    errors: (errors ?? []) as ProviderError[],
    activeJobCount: activeJobCount ?? 0,
  }
}

export default async function ProviderDetailPage({
  params,
}: {
  params: { slug: string }
}) {
  const detail = await getProviderDetail(params.slug)
  if (!detail) notFound()

  const { provider, runs, errors, activeJobCount } = detail
  const healthStyle = HEALTH_STYLE[provider.health_status] ?? HEALTH_STYLE.unknown

  const STATS = [
    { label: 'Active Jobs',            value: activeJobCount,                    color: '#60a5fa', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
    { label: 'Jobs Today',             value: provider.jobs_today ?? 0,          color: '#34d399', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
    { label: 'Total Ingested',         value: provider.total_jobs_ingested ?? 0, color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
    { label: 'Consecutive Failures',   value: provider.consecutive_failures ?? 0, color: provider.consecutive_failures > 0 ? '#f87171' : '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
  ]

  const CONFIG_ROWS: Array<{ label: string; value: string | number }> = [
    { label: 'Status',         value: provider.status },
    { label: 'Adapter',        value: provider.adapter_key },
    { label: 'Provider Type',  value: provider.provider_type },
    { label: 'Auth Type',      value: provider.auth_type },
    { label: 'Source Score',   value: provider.source_score },
    { label: 'Fetch Interval', value: `${provider.fetch_interval_minutes} min` },
    { label: 'Max Pages',      value: provider.max_pages_per_run },
    { label: 'Coverage',       value: (provider.country_codes ?? []).join(', ').toUpperCase() || '—' },
    { label: 'Platforms',      value: (provider.platform_tags ?? []).join(', ') || '—' },
    { label: 'Commercial',     value: provider.commercial_terms ?? '—' },
  ]

  const HEALTH_ROWS: Array<{ label: string; value: string | number }> = [
    { label: 'Health Status',   value: provider.health_status },
    { label: 'Last Success',    value: formatRelative(provider.last_success_at) },
    { label: 'Last Fetched',    value: formatRelative(provider.last_fetched_at) },
    { label: 'Next Fetch',      value: formatDate(provider.next_fetch_at) },
    { label: 'Last Error',      value: formatRelative(provider.last_error_at) },
    { label: 'Last Error Code', value: provider.last_error_code ?? '—' },
    { label: 'Avg Response',    value: provider.avg_response_ms ? `${provider.avg_response_ms}ms` : '—' },
    { label: 'Requests Today',  value: provider.requests_today ?? 0 },
  ]

  return (
    <div className="p-8">
      <AutoRefresh />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs mb-4">
        <Link href="/roodber8" style={{ color: '#475569' }}>Command Centre</Link>
        <ChevronRight size={12} style={{ color: '#1e293b' }} />
        <Link href="/roodber8/providers" style={{ color: '#475569' }}>Providers</Link>
        <ChevronRight size={12} style={{ color: '#1e293b' }} />
        <span style={{ color: '#64748b' }}>{provider.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(96,165,250,0.12)' }}>
            <Server size={20} style={{ color: '#60a5fa' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{provider.name}</h1>
            <p className="text-sm font-mono" style={{ color: '#475569' }}>{provider.slug}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: healthStyle.bg, color: healthStyle.color }}>
            {healthStyle.label}
          </span>
          <Link
            href={`/roodber8/providers/${provider.slug}/edit`}
            className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl transition-opacity hover:opacity-90"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1a2238', color: '#94a3b8' }}
          >
            <Pencil size={14} />
            Edit
          </Link>
          <TestConnectionButton slug={provider.slug} />
          <RunNowButton slug={provider.slug} />
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

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Configuration panel */}
        <div className="rounded-2xl border overflow-hidden" style={C.card}>
          <div className="px-6 py-4 border-b" style={{ borderColor: '#1a2238' }}>
            <h2 className="text-white font-bold text-sm">Configuration</h2>
          </div>
          <div className="px-6 py-4 space-y-3">
            {CONFIG_ROWS.map(row => (
              <div key={row.label} className="flex items-center justify-between gap-4 text-sm">
                <span style={{ color: '#475569' }}>{row.label}</span>
                <span className="font-mono text-xs text-right text-white">{String(row.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Health panel */}
        <div className="rounded-2xl border overflow-hidden" style={C.card}>
          <div className="px-6 py-4 border-b" style={{ borderColor: '#1a2238' }}>
            <h2 className="text-white font-bold text-sm">Health</h2>
          </div>
          <div className="px-6 py-4 space-y-3">
            {HEALTH_ROWS.map(row => (
              <div key={row.label} className="flex items-center justify-between gap-4 text-sm">
                <span style={{ color: '#475569' }}>{row.label}</span>
                <span className="font-mono text-xs text-right text-white">{String(row.value)}</span>
              </div>
            ))}
            {provider.last_error_message && (
              <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <p className="text-xs font-mono break-all" style={{ color: '#ef4444' }}>{provider.last_error_message}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Keywords + Notes */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="rounded-2xl border overflow-hidden" style={C.card}>
          <div className="px-6 py-4 border-b" style={{ borderColor: '#1a2238' }}>
            <h2 className="text-white font-bold text-sm">Keywords</h2>
          </div>
          <div className="px-6 py-4 flex flex-wrap gap-2">
            {(provider.keywords ?? []).length === 0 ? (
              <span className="text-sm" style={{ color: '#334155' }}>No keywords configured.</span>
            ) : (
              provider.keywords.map(kw => (
                <span key={kw} className="text-xs font-mono px-2.5 py-1 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.03)', color: '#94a3b8', border: '1px solid #1f2937' }}>
                  {kw}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border overflow-hidden" style={C.card}>
          <div className="px-6 py-4 border-b" style={{ borderColor: '#1a2238' }}>
            <h2 className="text-white font-bold text-sm">Notes</h2>
          </div>
          <div className="px-6 py-4">
            <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
              {provider.notes ?? 'No notes.'}
            </p>
            {provider.base_url && (
              <p className="text-xs font-mono mt-3 break-all" style={{ color: '#475569' }}>{provider.base_url}</p>
            )}
          </div>
        </div>
      </div>

      {/* Run history */}
      <div className="rounded-2xl border overflow-hidden mb-6" style={C.card}>
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#1a2238' }}>
          <h2 className="text-white font-bold text-sm">Recent Runs</h2>
          <span className="text-xs font-semibold" style={{ color: '#475569' }}>Last {runs.length} runs</span>
        </div>

        {runs.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm" style={{ color: '#334155' }}>No runs yet. The orchestrator fires every 15 minutes.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#1a2238' }}>
            {runs.map(run => (
              <div key={run.id} className="px-6 py-3.5 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 text-xs" style={{ color: '#475569' }}>
                  <span>{formatDate(run.started_at)}</span>
                  <span className="font-semibold" style={{ color: RUN_STATUS_COLOR[run.status] ?? '#94a3b8' }}>{run.status}</span>
                  {run.trigger && <span>{run.trigger}</span>}
                </div>
                <div className="flex items-center gap-4 text-xs" style={{ color: '#475569' }}>
                  <span>{run.jobs_fetched} fetched</span>
                  <span className="font-bold text-white">+{run.jobs_inserted} inserted</span>
                  <span>{run.jobs_deduplicated} dupes</span>
                  <span>{run.jobs_rejected} rejected</span>
                  <span>{run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error log */}
      {errors.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={C.card}>
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#1a2238' }}>
            <h2 className="text-white font-bold text-sm">Recent Errors</h2>
            <span className="text-xs font-semibold" style={{ color: '#475569' }}>Last {errors.length} errors</span>
          </div>
          <div className="divide-y" style={{ borderColor: '#1a2238' }}>
            {errors.map(err => (
              <div key={err.id} className="px-6 py-3.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold" style={{ color: '#f87171' }}>{err.error_type}</span>
                  <span className="text-xs" style={{ color: '#334155' }}>{formatRelative(err.created_at)}</span>
                </div>
                <p className="text-xs font-mono" style={{ color: '#94a3b8' }}>{err.error_message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
