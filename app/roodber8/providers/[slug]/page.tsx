import type { ReactNode } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { unstable_noStore as noStore } from 'next/cache'
import { notFound } from 'next/navigation'
import { getProvider, type JobProvider, type ProviderRun } from '@/lib/providers'
import { ADMIN_COLORS, HEALTH_COLORS, RUN_STATUS_COLORS } from '@/lib/admin-theme'
import RunNowButton from './RunNowButton'
import TestConnectionButton from './TestConnectionButton'

export const dynamic = 'force-dynamic'

// ── Types ────────────────────────────────────────────────────────────────

interface ProviderError {
  id: string
  provider_id: string
  run_id: string | null
  error_type: string
  error_code: string | null
  error_message: string
  raw_job_data: Record<string, unknown> | null
  created_at: string
}

// ── Time helpers ─────────────────────────────────────────────────────────

function relativeTime(date: string | null | undefined): string {
  if (!date) return '—'
  const diffMs = Date.now() - new Date(date).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hr ago`
  const diffDays = Math.floor(diffHr / 24)
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
}

function timeUntil(date: string | null | undefined): string {
  if (!date) return '—'
  const diffMs = new Date(date).getTime() - Date.now()
  if (diffMs < 0) return 'Overdue'
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) return `in ${diffMin} min`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `in ${diffHr} hr`
  const diffDays = Math.floor(diffHr / 24)
  return `in ${diffDays} day${diffDays === 1 ? '' : 's'}`
}

function formatRunDate(date: string): string {
  const d = new Date(date)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = String(d.getUTCDate()).padStart(2, '0')
  const mon = months[d.getUTCMonth()]
  const yr = d.getUTCFullYear()
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${day} ${mon} ${yr} ${hh}:${mm} UTC`
}

// ── Misc helpers ─────────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s
}

function isEmptyRecord(data: Record<string, unknown> | null): boolean {
  return !data || Object.keys(data).length === 0
}

function extractSourceJobId(raw: Record<string, unknown> | null): string | null {
  if (!raw) return null
  const v = raw.source_job_id
  return typeof v === 'string' && v.length > 0 ? v : null
}

function groupErrorsByType(errors: ProviderError[]): [string, ProviderError[]][] {
  const map = new Map<string, ProviderError[]>()
  for (const err of errors) {
    const list = map.get(err.error_type) ?? []
    list.push(err)
    map.set(err.error_type, list)
  }
  return Array.from(map.entries())
}

// ── Small presentational components ─────────────────────────────────────

function Dot({ color }: { color: string }) {
  return <span style={{ width: 6, height: 6, borderRadius: 9999, background: color, display: 'inline-block' }} />
}

function StatusPill({ status }: { status: string }) {
  const isPaused = status === 'paused'
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full font-semibold"
      style={{
        background: isPaused ? ADMIN_COLORS.warningBg : ADMIN_COLORS.successBg,
        color: isPaused ? ADMIN_COLORS.warning : ADMIN_COLORS.success,
        fontSize: 12,
      }}
    >
      {status}
    </span>
  )
}

function HealthBadge({ status, large }: { status: string; large?: boolean }) {
  const meta = HEALTH_COLORS[status] ?? HEALTH_COLORS.unknown
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full font-semibold"
      style={{
        background: meta.bg,
        color: meta.color,
        fontSize: large ? 14 : 12,
        padding: large ? '8px 16px' : '6px 12px',
      }}
    >
      <Dot color={meta.color} />
      {meta.label}
    </span>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p
      className="text-[10px] font-bold uppercase mb-2 mt-4"
      style={{ color: ADMIN_COLORS.textDim, letterSpacing: '0.08em' }}
    >
      {children}
    </p>
  )
}

function ConfigRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm py-1">
      <span style={{ color: ADMIN_COLORS.textMuted }}>{label}</span>
      <span className="font-mono text-xs text-right" style={{ color: ADMIN_COLORS.text }}>{value}</span>
    </div>
  )
}

function PillList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return <span className="text-sm" style={{ color: ADMIN_COLORS.textDim }}>{empty}</span>
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => (
        <span
          key={item}
          className="px-2 py-0.5 rounded-full font-mono"
          style={{ background: ADMIN_COLORS.border, color: ADMIN_COLORS.textMuted, fontSize: 11 }}
        >
          {item}
        </span>
      ))}
    </div>
  )
}

function JsonBlock({ label, data }: { label: string; data: Record<string, unknown> | null }) {
  return (
    <div className="mb-3">
      <p
        className="text-xs font-bold uppercase mb-1.5"
        style={{ color: ADMIN_COLORS.textDim, letterSpacing: '0.06em' }}
      >
        {label}
      </p>
      {isEmptyRecord(data) ? (
        <p className="text-sm" style={{ color: ADMIN_COLORS.textDim }}>Not configured</p>
      ) : (
        <pre
          className="rounded-lg p-3 overflow-y-auto"
          style={{ background: ADMIN_COLORS.bg, color: ADMIN_COLORS.textMuted, fontSize: 12, maxHeight: 120, margin: 0 }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}

function MetricChip({ label, value }: { label: string; value: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md"
      style={{ background: ADMIN_COLORS.bg, color: ADMIN_COLORS.textMuted, fontSize: 11 }}
    >
      <span style={{ color: ADMIN_COLORS.text, fontWeight: 600 }}>{value}</span> {label}
    </span>
  )
}

// ── Data ─────────────────────────────────────────────────────────────────

async function getProviderDetail(slug: string): Promise<{
  provider: JobProvider
  runs: ProviderRun[]
  errors: ProviderError[]
  activeJobCount: number
} | null> {
  noStore()
  const provider = await getProvider(slug)
  if (!provider) return null

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const [runsResult, errorsResult, activeJobResult] = await Promise.all([
    supabase.from('provider_runs').select('*').eq('provider_slug', slug).order('started_at', { ascending: false }).limit(50),
    supabase.from('provider_errors').select('*').eq('provider_id', provider.id).order('created_at', { ascending: false }).limit(100),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('provider_id', provider.id).eq('status', 'active'),
  ])

  return {
    provider,
    runs: (runsResult.data ?? []) as ProviderRun[],
    errors: (errorsResult.data ?? []) as ProviderError[],
    activeJobCount: activeJobResult.count ?? 0,
  }
}

// ── Page ─────────────────────────────────────────────────────────────────

export default async function ProviderDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const detail = await getProviderDetail(slug)
  if (!detail) notFound()

  const { provider, runs, errors, activeJobCount } = detail

  const avgInserted = runs.length === 0
    ? null
    : Math.round(runs.reduce((sum, r) => sum + r.jobs_inserted, 0) / runs.length)

  const successRate = runs.length === 0
    ? null
    : Math.round((runs.filter(r => r.status === 'completed').length / runs.length) * 100)

  const successRateColor = successRate === null
    ? ADMIN_COLORS.textMuted
    : successRate >= 90
      ? ADMIN_COLORS.success
      : successRate >= 70
        ? ADMIN_COLORS.warning
        : ADMIN_COLORS.danger

  const STATS: { label: string; value: string; color: string }[] = [
    { label: 'Active Jobs', value: activeJobCount.toLocaleString(), color: ADMIN_COLORS.gold },
    { label: 'Jobs Today', value: (provider.jobs_today ?? 0).toLocaleString(), color: ADMIN_COLORS.success },
    { label: 'Total Ingested', value: (provider.total_jobs_ingested ?? 0).toLocaleString(), color: ADMIN_COLORS.info },
    { label: 'Avg Jobs/Run', value: avgInserted === null ? '—' : avgInserted.toLocaleString(), color: ADMIN_COLORS.textMuted },
    { label: 'Success Rate', value: successRate === null ? '—' : `${successRate}%`, color: successRateColor },
  ]

  const groupedErrors = groupErrorsByType(errors)

  return (
    <div className="p-8" style={{ background: ADMIN_COLORS.bg }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs mb-3" style={{ color: ADMIN_COLORS.textDim }}>
            <Link href="/roodber8" style={{ color: ADMIN_COLORS.textDim }}>Command Centre</Link>
            <span>/</span>
            <Link href="/roodber8/providers" style={{ color: ADMIN_COLORS.textDim }}>Providers</Link>
            <span>/</span>
            <span style={{ color: ADMIN_COLORS.textDim }}>{provider.name}</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: ADMIN_COLORS.text }}>{provider.name}</h1>
          <p className="font-mono text-sm mt-1" style={{ color: ADMIN_COLORS.textDim }}>{provider.slug}</p>
          <div className="mt-3">
            <StatusPill status={provider.status} />
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <HealthBadge status={provider.health_status} />
          <TestConnectionButton slug={provider.slug} />
          <RunNowButton slug={provider.slug} />
          <Link
            href={`/roodber8/providers/${provider.slug}/edit`}
            className="px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ border: `1px solid ${ADMIN_COLORS.border}`, color: ADMIN_COLORS.textMuted }}
          >
            Edit
          </Link>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {STATS.map(s => (
          <div
            key={s.label}
            className="rounded-2xl p-5"
            style={{ background: ADMIN_COLORS.card, border: `1px solid ${ADMIN_COLORS.border}`, borderLeft: `3px solid ${s.color}` }}
          >
            <p className="text-3xl font-black mb-1" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: ADMIN_COLORS.textMuted }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Configuration + Health panels */}
      <div className="mb-6" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1.5rem' }}>
        {/* Configuration */}
        <div className="rounded-2xl overflow-hidden" style={{ background: ADMIN_COLORS.card, border: `1px solid ${ADMIN_COLORS.border}` }}>
          <div className="px-6 py-4" style={{ borderBottom: `1px solid ${ADMIN_COLORS.border}` }}>
            <h2 className="font-bold text-sm" style={{ color: ADMIN_COLORS.text }}>Configuration</h2>
          </div>
          <div className="px-6 py-5">
            <SectionLabel>Identity</SectionLabel>
            <div className="space-y-1">
              <ConfigRow label="Status" value={<StatusPill status={provider.status} />} />
              <ConfigRow label="Provider Type" value={provider.provider_type} />
              <ConfigRow label="Adapter" value={provider.adapter_key} />
              <ConfigRow label="Source Name" value={provider.source_name ?? '—'} />
              <ConfigRow label="Priority" value={String(provider.priority)} />
              <ConfigRow label="Commercial Terms" value={provider.commercial_terms ?? '—'} />
              <ConfigRow label="Data Ownership" value={provider.data_ownership ?? '—'} />
            </div>

            <SectionLabel>API &amp; Authentication</SectionLabel>
            <div className="space-y-1">
              <ConfigRow
                label="Base URL"
                value={
                  <span title={provider.base_url ?? undefined}>
                    {provider.base_url ? truncate(provider.base_url, 50) : '—'}
                  </span>
                }
              />
              <ConfigRow label="Auth Type" value={provider.auth_type} />
              <ConfigRow label="Response Path" value={provider.response_path ?? '—'} />
              <ConfigRow label="Pagination Style" value={provider.pagination_style ?? '—'} />
              <ConfigRow label="Max Pages/Run" value={String(provider.max_pages_per_run ?? '—')} />
            </div>

            <SectionLabel>Rate Limits &amp; Schedule</SectionLabel>
            <div className="space-y-1">
              <ConfigRow label="Fetch Interval" value={`${provider.fetch_interval_minutes} min`} />
              <ConfigRow label="Rate Limit RPM" value={String(provider.rate_limit_rpm ?? 'Unlimited')} />
              <ConfigRow label="Rate Limit Daily" value={String(provider.rate_limit_daily ?? 'Unlimited')} />
            </div>

            <SectionLabel>Coverage</SectionLabel>
            <div className="space-y-3">
              <div>
                <p className="text-xs mb-1.5" style={{ color: ADMIN_COLORS.textMuted }}>Platform Tags</p>
                <PillList items={provider.platform_tags} empty="None" />
              </div>
              <div>
                <p className="text-xs mb-1.5" style={{ color: ADMIN_COLORS.textMuted }}>Country Codes</p>
                <PillList items={provider.country_codes.map(c => c.toUpperCase())} empty="Global" />
              </div>
              <div>
                <p className="text-xs mb-1.5" style={{ color: ADMIN_COLORS.textMuted }}>Regions</p>
                <p className="text-sm" style={{ color: ADMIN_COLORS.text }}>
                  {provider.regions.length > 0 ? provider.regions.join(', ') : 'All'}
                </p>
              </div>
            </div>

            <SectionLabel>Field Mapping</SectionLabel>
            <JsonBlock label="Request Config" data={provider.request_config} />
            <JsonBlock label="Field Mapping" data={provider.field_mapping} />
          </div>
        </div>

        {/* Health & Operations */}
        <div className="rounded-2xl overflow-hidden" style={{ background: ADMIN_COLORS.card, border: `1px solid ${ADMIN_COLORS.border}` }}>
          <div className="px-6 py-4" style={{ borderBottom: `1px solid ${ADMIN_COLORS.border}` }}>
            <h2 className="font-bold text-sm" style={{ color: ADMIN_COLORS.text }}>Health &amp; Operations</h2>
          </div>
          <div className="px-6 py-5">
            <div className="mb-4">
              <HealthBadge status={provider.health_status} large />
            </div>
            <div className="space-y-1">
              <ConfigRow label="Last Successful Run" value={provider.last_success_at ? relativeTime(provider.last_success_at) : 'Never'} />
              <ConfigRow label="Last Fetched" value={provider.last_fetched_at ? relativeTime(provider.last_fetched_at) : 'Never'} />
              <ConfigRow label="Next Fetch" value={provider.next_fetch_at ? timeUntil(provider.next_fetch_at) : 'Not scheduled'} />
              <ConfigRow
                label="Consecutive Failures"
                value={
                  <span style={{ color: provider.consecutive_failures > 0 ? ADMIN_COLORS.danger : ADMIN_COLORS.text }}>
                    {provider.consecutive_failures}
                  </span>
                }
              />
              <ConfigRow label="Avg Response Time" value={provider.avg_response_ms ? `${provider.avg_response_ms} ms` : '—'} />
              <ConfigRow label="Requests Today" value={String(provider.requests_today ?? 0)} />
              <ConfigRow label="Last Error Time" value={provider.last_error_at ? relativeTime(provider.last_error_at) : 'None'} />
              <ConfigRow label="Last Error Code" value={provider.last_error_code ?? '—'} />
            </div>
            {provider.last_error_message && (
              <div
                className="mt-3 p-3 rounded-lg overflow-y-auto"
                style={{ background: ADMIN_COLORS.dangerBg, borderLeft: `3px solid ${ADMIN_COLORS.danger}`, maxHeight: 80 }}
              >
                <p className="font-mono" style={{ color: ADMIN_COLORS.danger, fontSize: 12 }}>{provider.last_error_message}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Keywords + Notes */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="rounded-2xl overflow-hidden" style={{ background: ADMIN_COLORS.card, border: `1px solid ${ADMIN_COLORS.border}` }}>
          <div className="px-6 py-4" style={{ borderBottom: `1px solid ${ADMIN_COLORS.border}` }}>
            <h2 className="font-bold text-sm" style={{ color: ADMIN_COLORS.text }}>Keywords</h2>
          </div>
          <div className="px-6 py-4">
            {provider.keywords.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {provider.keywords.map(kw => (
                  <span
                    key={kw}
                    className="px-2.5 py-1 rounded-lg"
                    style={{ background: ADMIN_COLORS.border, color: ADMIN_COLORS.textMuted, fontSize: 11 }}
                  >
                    {kw}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: ADMIN_COLORS.textDim }}>No keywords configured.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ background: ADMIN_COLORS.card, border: `1px solid ${ADMIN_COLORS.border}` }}>
          <div className="px-6 py-4" style={{ borderBottom: `1px solid ${ADMIN_COLORS.border}` }}>
            <h2 className="font-bold text-sm" style={{ color: ADMIN_COLORS.text }}>Notes</h2>
          </div>
          <div className="px-6 py-4">
            {provider.notes ? (
              <p className="text-sm leading-relaxed" style={{ color: ADMIN_COLORS.textMuted }}>{provider.notes}</p>
            ) : (
              <p className="text-sm" style={{ color: ADMIN_COLORS.textDim }}>No notes.</p>
            )}
          </div>
        </div>
      </div>

      {/* Run history */}
      <div className="rounded-2xl overflow-hidden mb-6" style={{ background: ADMIN_COLORS.card, border: `1px solid ${ADMIN_COLORS.border}` }}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${ADMIN_COLORS.border}` }}>
          <h2 className="font-bold text-sm" style={{ color: ADMIN_COLORS.text }}>Run History</h2>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: ADMIN_COLORS.border, color: ADMIN_COLORS.textMuted }}
          >
            {runs.length}
          </span>
        </div>

        {runs.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm" style={{ color: ADMIN_COLORS.textDim }}>No runs recorded yet.</p>
          </div>
        ) : (
          <div>
            {runs.map((run, i) => {
              const statusMeta = RUN_STATUS_COLORS[run.status] ?? { color: ADMIN_COLORS.textMuted, label: run.status }
              const rowBg = i % 2 === 1 ? ADMIN_COLORS.borderLight : ADMIN_COLORS.card
              return (
                <div
                  key={run.id}
                  className="px-6 py-3.5"
                  style={{ background: rowBg, borderBottom: `1px solid ${ADMIN_COLORS.border}` }}
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Dot color={statusMeta.color} />
                        <span className="text-xs font-semibold" style={{ color: statusMeta.color }}>{statusMeta.label}</span>
                      </div>
                      <span className="text-xs" style={{ color: ADMIN_COLORS.textDim }}>{formatRunDate(run.started_at)}</span>
                      <span className="text-xs" style={{ color: ADMIN_COLORS.textDim }}>{run.trigger ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <MetricChip label="fetched" value={run.jobs_fetched} />
                      <MetricChip label="inserted" value={run.jobs_inserted} />
                      <MetricChip label="dedup" value={run.jobs_deduplicated} />
                      <MetricChip label="rejected" value={run.jobs_rejected} />
                      <span className="text-xs" style={{ color: ADMIN_COLORS.textMuted }}>
                        {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—'}
                      </span>
                    </div>
                  </div>
                  {run.status === 'failed' && run.error_message && (
                    <p className="text-xs mt-1.5" style={{ color: ADMIN_COLORS.danger }}>
                      {truncate(run.error_message, 120)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Error log */}
      {errors.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: ADMIN_COLORS.card, border: `1px solid ${ADMIN_COLORS.border}` }}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${ADMIN_COLORS.border}` }}>
            <h2 className="font-bold text-sm" style={{ color: ADMIN_COLORS.text }}>Recent Errors</h2>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: ADMIN_COLORS.dangerBg, color: ADMIN_COLORS.danger }}
            >
              {errors.length}
            </span>
          </div>
          <div className="px-6 py-5 space-y-5">
            {groupedErrors.map(([type, group]) => (
              <div key={type}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold" style={{ color: ADMIN_COLORS.danger, fontSize: 13 }}>{type}</span>
                  <span
                    className="px-1.5 py-0.5 rounded-full font-semibold"
                    style={{ background: ADMIN_COLORS.dangerBg, color: ADMIN_COLORS.danger, fontSize: 11 }}
                  >
                    {group.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {group.slice(0, 5).map(err => {
                    const sourceJobId = extractSourceJobId(err.raw_job_data)
                    return (
                      <div key={err.id} className="pl-3" style={{ borderLeft: `2px solid ${ADMIN_COLORS.border}` }}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: ADMIN_COLORS.textDim }}>{relativeTime(err.created_at)}</span>
                          {sourceJobId && (
                            <span className="font-mono" style={{ color: ADMIN_COLORS.textDim, fontSize: 11 }}>{sourceJobId}</span>
                          )}
                        </div>
                        <p className="text-xs" style={{ color: ADMIN_COLORS.textMuted }}>{truncate(err.error_message, 150)}</p>
                      </div>
                    )
                  })}
                  {group.length > 5 && (
                    <p className="text-xs" style={{ color: ADMIN_COLORS.textDim }}>+ {group.length - 5} more</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
