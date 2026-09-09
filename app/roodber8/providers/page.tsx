import type { ReactNode } from 'react'
import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { getAllProviders, getLatestRunPerProvider, type JobProvider, type ProviderRun } from '@/lib/providers'
import { ADMIN_COLORS, HEALTH_COLORS, RUN_STATUS_COLORS } from '@/lib/admin-theme'

export const dynamic = 'force-dynamic'

// ── Relative time helpers ──────────────────────────────────────────────────

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

function formatUTCTime(date: string): string {
  const d = new Date(date)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm} UTC`
}

// ── Icons ───────────────────────────────────────────────────────────────────

function GridIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ color }}>
      <rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="12" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="12" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="12" y="12" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function Dot({ color }: { color: string }) {
  return <span style={{ width: 6, height: 6, borderRadius: 9999, background: color, display: 'inline-block' }} />
}

// ── Row-level derived values ────────────────────────────────────────────────

function groupRank(p: JobProvider): number {
  if (p.health_status === 'down') return 0
  if (p.health_status === 'degraded') return 1
  if (p.status === 'paused') return 2
  return 3
}

function sortProviders(providers: JobProvider[]): JobProvider[] {
  return [...providers].sort((a, b) => {
    const ra = groupRank(a)
    const rb = groupRank(b)
    if (ra !== rb) return ra - rb
    return a.priority - b.priority
  })
}

function nextRunDisplay(p: JobProvider): { text: string; color: string } {
  if (p.status === 'paused') return { text: 'Paused', color: ADMIN_COLORS.warning }
  if (!p.next_fetch_at) return { text: 'Pending', color: ADMIN_COLORS.textDim }
  if (new Date(p.next_fetch_at).getTime() < Date.now()) return { text: 'Overdue', color: ADMIN_COLORS.danger }
  return { text: timeUntil(p.next_fetch_at), color: ADMIN_COLORS.textMuted }
}

// ── Data ─────────────────────────────────────────────────────────────────

async function getData() {
  noStore()
  const [providers, latestRuns] = await Promise.all([
    getAllProviders(),
    getLatestRunPerProvider(),
  ])
  return { providers, latestRuns }
}

// ── Page ─────────────────────────────────────────────────────────────────

export default async function ProvidersPage() {
  const { providers, latestRuns } = await getData()

  const totalProviders = providers.length
  const activeCount = providers.filter(p => p.status === 'active').length
  const needsAttentionCount = providers.filter(
    p => p.health_status === 'down' || p.health_status === 'degraded'
  ).length
  const jobsToday = providers.reduce((sum, p) => sum + (p.jobs_today ?? 0), 0)

  const sortedProviders = sortProviders(providers)

  const now = Date.now()
  const in60min = now + 60 * 60 * 1000
  const upcoming = providers
    .filter(p => p.next_fetch_at && new Date(p.next_fetch_at).getTime() >= now && new Date(p.next_fetch_at).getTime() <= in60min)
    .sort((a, b) => new Date(a.next_fetch_at as string).getTime() - new Date(b.next_fetch_at as string).getTime())

  const STATS: { label: string; value: number; color: string; icon?: ReactNode }[] = [
    { label: 'Total Providers', value: totalProviders, color: ADMIN_COLORS.textMuted, icon: <GridIcon color={ADMIN_COLORS.textMuted} /> },
    { label: 'Active', value: activeCount, color: ADMIN_COLORS.success },
    { label: 'Needs Attention', value: needsAttentionCount, color: needsAttentionCount > 0 ? ADMIN_COLORS.danger : ADMIN_COLORS.textMuted },
    { label: 'Jobs Today', value: jobsToday, color: ADMIN_COLORS.gold },
  ]

  return (
    <div className="p-8" style={{ background: ADMIN_COLORS.bg }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs mb-3" style={{ color: ADMIN_COLORS.textMuted }}>
            <Link href="/roodber8" style={{ color: ADMIN_COLORS.textMuted }}>Command Centre</Link>
            <span>/</span>
            <span>Providers</span>
          </div>
          <h1 className="text-3xl font-bold" style={{ color: ADMIN_COLORS.text }}>Provider Ecosystem</h1>
          <p className="text-sm mt-1" style={{ color: ADMIN_COLORS.textMuted }}>
            Monitor, manage and configure all job ingestion sources
          </p>
        </div>
        <Link
          href="/roodber8/providers/new"
          className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl shrink-0"
          style={{ background: ADMIN_COLORS.card, border: `1px solid ${ADMIN_COLORS.border}`, color: ADMIN_COLORS.gold }}
        >
          + Add Provider
        </Link>
      </div>

      {/* Aggregate stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {STATS.map(s => (
          <div
            key={s.label}
            className="rounded-2xl p-5"
            style={{ background: ADMIN_COLORS.card, border: `1px solid ${ADMIN_COLORS.border}`, borderLeft: `3px solid ${s.color}` }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-3xl font-black" style={{ color: s.color }}>{s.value.toLocaleString()}</p>
              {s.icon}
            </div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: ADMIN_COLORS.textMuted }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Providers table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: ADMIN_COLORS.card, border: `1px solid ${ADMIN_COLORS.border}` }}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${ADMIN_COLORS.border}` }}>
          <h2 className="font-bold text-sm" style={{ color: ADMIN_COLORS.text }}>All Providers</h2>
          <span className="text-xs font-semibold" style={{ color: ADMIN_COLORS.textMuted }}>{providers.length} configured</span>
        </div>

        {sortedProviders.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <p className="font-semibold" style={{ color: ADMIN_COLORS.text }}>No providers configured yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/*
              Global app/globals.css defines an unscoped `tr:hover td { background-color: var(--color-slate-50) }`
              rule (a near-white colour) that otherwise paints every cell of a hovered row near-white,
              making this dark-theme table's light text invisible. Override it here, scoped to this
              table only, using ADMIN_COLORS.borderLight instead — without touching globals.css.
            */}
            <style>{`
              .provider-list-row:hover td {
                background-color: ${ADMIN_COLORS.borderLight} !important;
              }
            `}</style>
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: ADMIN_COLORS.bg }}>
                  <th className="text-left px-6 py-3 font-bold" style={{ color: ADMIN_COLORS.textDim, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Provider</th>
                  <th className="text-left px-6 py-3 font-bold" style={{ color: ADMIN_COLORS.textDim, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Health</th>
                  <th className="text-left px-6 py-3 font-bold" style={{ color: ADMIN_COLORS.textDim, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Last Run</th>
                  <th className="text-left px-6 py-3 font-bold" style={{ color: ADMIN_COLORS.textDim, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Performance</th>
                  <th className="text-left px-6 py-3 font-bold" style={{ color: ADMIN_COLORS.textDim, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Next Run</th>
                  <th className="text-left px-6 py-3 font-bold" style={{ color: ADMIN_COLORS.textDim, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedProviders.map(provider => {
                  const latestRun: ProviderRun | undefined = latestRuns[provider.slug]
                  const health = HEALTH_COLORS[provider.health_status] ?? HEALTH_COLORS.unknown
                  const runStatus = latestRun ? (RUN_STATUS_COLORS[latestRun.status]?.color ?? ADMIN_COLORS.textMuted) : ADMIN_COLORS.textDim
                  const insertedColor = latestRun && latestRun.jobs_inserted === 0 && latestRun.jobs_fetched > 0
                    ? ADMIN_COLORS.textDim
                    : ADMIN_COLORS.success
                  const nextRun = nextRunDisplay(provider)

                  return (
                    <tr
                      key={provider.slug}
                      className="provider-list-row"
                      style={{ background: ADMIN_COLORS.card, borderBottom: `1px solid ${ADMIN_COLORS.border}` }}
                    >
                      {/* Provider */}
                      <td className="px-6 py-4 align-top">
                        <Link href={`/roodber8/providers/${provider.slug}`} className="font-bold" style={{ color: ADMIN_COLORS.text, fontSize: 14 }}>
                          {provider.name}
                        </Link>
                        <div className="font-mono mt-0.5" style={{ color: ADMIN_COLORS.textDim, fontSize: 12 }}>{provider.slug}</div>
                        <span
                          className="inline-block mt-1.5 px-2 py-0.5 rounded-full"
                          style={{ background: ADMIN_COLORS.border, color: ADMIN_COLORS.textMuted, fontSize: 11 }}
                        >
                          {provider.adapter_key}
                        </span>
                      </td>

                      {/* Health */}
                      <td className="px-6 py-4 align-top">
                        <div
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold"
                          style={{ background: health.bg, color: health.color, fontSize: 12 }}
                        >
                          <Dot color={health.color} />
                          {health.label}
                        </div>
                        {provider.consecutive_failures > 0 && (
                          <div className="mt-1" style={{ color: ADMIN_COLORS.danger, fontSize: 11 }}>
                            {provider.consecutive_failures} failures
                          </div>
                        )}
                      </td>

                      {/* Last Run */}
                      <td className="px-6 py-4 align-top">
                        {latestRun ? (
                          <div className="flex items-center gap-1.5">
                            <Dot color={runStatus} />
                            <span style={{ color: ADMIN_COLORS.text, fontSize: 13 }}>{relativeTime(latestRun.started_at)}</span>
                          </div>
                        ) : (
                          <span style={{ color: ADMIN_COLORS.textDim, fontSize: 13 }}>Never</span>
                        )}
                      </td>

                      {/* Performance */}
                      <td className="px-6 py-4 align-top">
                        {!latestRun ? (
                          <span style={{ color: ADMIN_COLORS.textDim, fontSize: 13 }}>—</span>
                        ) : (
                          <div>
                            <div className="font-semibold" style={{ color: insertedColor, fontSize: 12 }}>
                              ↑ {latestRun.jobs_inserted} inserted
                            </div>
                            <div style={{ color: ADMIN_COLORS.textMuted, fontSize: 11 }}>
                              {latestRun.jobs_fetched} fetched · {latestRun.jobs_deduplicated} dedup
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Next Run */}
                      <td className="px-6 py-4 align-top">
                        <span style={{ color: nextRun.color, fontSize: 13 }}>{nextRun.text}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 align-top">
                        <Link
                          href={`/roodber8/providers/${provider.slug}`}
                          className="inline-flex items-center px-3 py-1.5 rounded-full font-semibold"
                          style={{ background: ADMIN_COLORS.border, color: ADMIN_COLORS.text, fontSize: 12 }}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upcoming runs */}
      <div className="rounded-2xl overflow-hidden mt-6" style={{ background: ADMIN_COLORS.card, border: `1px solid ${ADMIN_COLORS.border}` }}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${ADMIN_COLORS.border}` }}>
          <h2 className="font-bold text-sm" style={{ color: ADMIN_COLORS.text }}>Next Scheduled (60 min)</h2>
          <span className="text-xs font-semibold" style={{ color: ADMIN_COLORS.textMuted }}>
            {upcoming.length} provider{upcoming.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="px-6 py-5">
          {upcoming.length === 0 ? (
            <p className="text-sm" style={{ color: ADMIN_COLORS.textDim }}>
              No runs scheduled in the next 60 minutes.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {upcoming.map(p => (
                <div key={p.slug} className="rounded-xl px-4 py-3" style={{ background: ADMIN_COLORS.bg, border: `1px solid ${ADMIN_COLORS.border}` }}>
                  <p className="font-semibold" style={{ color: ADMIN_COLORS.text, fontSize: 13 }}>{p.name}</p>
                  <p className="font-mono" style={{ color: ADMIN_COLORS.textDim, fontSize: 11 }}>{p.slug}</p>
                  <p className="font-mono mt-1" style={{ color: ADMIN_COLORS.gold, fontSize: 12 }}>
                    {formatUTCTime(p.next_fetch_at as string)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
