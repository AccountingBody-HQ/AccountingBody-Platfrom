import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { unstable_noStore as noStore } from 'next/cache'
import AutoRefresh from '@/components/roodber8/AutoRefresh'
import {
  ApproveJobButton, RejectJobButton, ToggleFeaturedButton,
  NotesToggleButton, DeleteJobButton,
} from '@/components/roodber8/JobAdminActions'
import { getAdminJobs, type Job, type JobStatus, type JobSource } from '@/lib/jobs'
import { Briefcase, ChevronRight, ExternalLink, Search } from 'lucide-react'

export const dynamic = 'force-dynamic'

const C = {
  card: { background: '#0d1424', border: '1px solid #1a2238', borderRadius: 16 },
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  draft:             { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', label: 'Draft' },
  pending_payment:   { bg: 'rgba(139,92,246,0.1)',  color: '#a78bfa', label: 'Pending Payment' },
  pending_approval:  { bg: 'rgba(245,158,11,0.1)',  color: '#fbbf24', label: 'Pending Approval' },
  active:            { bg: 'rgba(16,185,129,0.1)',  color: '#34d399', label: 'Active' },
  expired:           { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', label: 'Expired' },
  closed:            { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', label: 'Closed' },
  rejected:          { bg: 'rgba(239,68,68,0.1)',   color: '#f87171', label: 'Rejected' },
}

const SOURCE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  employer:  { bg: 'rgba(45,212,191,0.1)',  color: '#2dd4bf', label: 'Employer' },
  careerjet: { bg: 'rgba(96,165,250,0.1)',  color: '#60a5fa', label: 'Careerjet' },
  adzuna:    { bg: 'rgba(251,146,60,0.1)',  color: '#fb923c', label: 'Adzuna' },
  scrape:    { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', label: 'Scrape' },
  manual:    { bg: 'rgba(212,160,23,0.1)',  color: '#D4A017', label: 'Manual' },
}

const PAYMENT_STYLE: Record<string, { color: string; label: string }> = {
  paid:     { color: '#34d399', label: 'Paid' },
  unpaid:   { color: '#f87171', label: 'Unpaid' },
  free:     { color: '#94a3b8', label: 'Free' },
  refunded: { color: '#94a3b8', label: 'Refunded' },
}

function qualityColor(score: number): string {
  if (score < 0.4) return '#f87171'
  if (score < 0.7) return '#fbbf24'
  return '#34d399'
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

async function getJobStats() {
  noStore()
  const supabase = getSupabase()
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: pendingApproval },
    { count: active },
    { count: directEmployer },
    { count: expiringThisWeek },
    { count: totalAllTime },
  ] = await Promise.all([
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('payment_status', 'paid').eq('status', 'pending_approval'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('source', 'employer').eq('status', 'active'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'active').lte('expires_at', sevenDaysFromNow),
    supabase.from('jobs').select('*', { count: 'exact', head: true }),
  ])

  return {
    pendingApproval: pendingApproval ?? 0,
    active: active ?? 0,
    directEmployer: directEmployer ?? 0,
    expiringThisWeek: expiringThisWeek ?? 0,
    totalAllTime: totalAllTime ?? 0,
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isExpiringSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  const days = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return days <= 7
}

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; source?: string; page?: string }>
}) {
  const sp = await searchParams
  const safeSearch = (sp.search ?? '').replace(/[,()%]/g, '')
  const status = sp.status ?? ''
  const source = sp.source ?? ''
  const pageParam = parseInt(sp.page ?? '1', 10)
  const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam

  const [stats, { jobs, total }] = await Promise.all([
    getJobStats(),
    getAdminJobs({
      status: status || undefined,
      source: source || undefined,
      search: safeSearch || undefined,
      page,
    }),
  ])

  const PAGE_SIZE = 50
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function pageHref(p: number) {
    const params = new URLSearchParams()
    if (safeSearch) params.set('search', safeSearch)
    if (status) params.set('status', status)
    if (source) params.set('source', source)
    params.set('page', String(p))
    return `/roodber8/jobs?${params.toString()}`
  }

  const STATS = [
    { label: 'Pending Approval',   value: stats.pendingApproval,   color: '#fbbf24', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
    { label: 'Active',             value: stats.active,            color: '#34d399', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
    { label: 'Direct Employer',    value: stats.directEmployer,    color: '#60a5fa', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
    { label: 'Expiring This Week', value: stats.expiringThisWeek,  color: '#fb923c', bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.2)' },
    { label: 'Total All Time',     value: stats.totalAllTime,      color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
  ]

  return (
    <div className="p-8">
      <AutoRefresh />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs mb-4">
        <Link href="/roodber8" style={{ color: '#475569' }}>Command Centre</Link>
        <ChevronRight size={12} style={{ color: '#1e293b' }} />
        <span style={{ color: '#64748b' }}>Jobs</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(96,165,250,0.12)' }}>
            <Briefcase size={20} style={{ color: '#60a5fa' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Jobs</h1>
            <p className="text-sm" style={{ color: '#475569' }}>{total} total listings across all sources and statuses</p>
          </div>
        </div>
        <a href="/jobs/post-a-job" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl"
          style={{ background: '#D4A017', color: '#0C1A3D' }}>
          Post a Job <ExternalLink size={14} />
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {STATS.map(s => (
          <div key={s.label} className="rounded-2xl border p-5" style={{ background: s.bg, borderColor: s.border }}>
            <p className="text-3xl font-black mb-1" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: s.color }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl border p-4 mb-6 flex items-center gap-3 flex-wrap"
        style={{ background: '#0d1424', borderColor: '#1a2238' }}>
        <form method="GET" className="flex items-center gap-3 flex-wrap flex-1">
          <div className="flex items-center gap-2 flex-1 min-w-48 rounded-xl px-3 py-2"
            style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <Search size={13} style={{ color: '#475569' }} />
            <input name="search" defaultValue={safeSearch} placeholder="Search title or company..."
              className="bg-transparent text-white text-sm flex-1 focus:outline-none placeholder-slate-600"
              style={{ minWidth: 0 }} />
          </div>
          <select name="status" defaultValue={status}
            className="rounded-xl px-3 py-2 text-sm focus:outline-none"
            style={{ background: '#111827', border: '1px solid #1f2937', color: status ? '#ffffff' : '#475569' }}>
            <option value="">All statuses</option>
            <option value="pending_payment">Pending Payment</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="closed">Closed</option>
            <option value="rejected">Rejected</option>
          </select>
          <select name="source" defaultValue={source}
            className="rounded-xl px-3 py-2 text-sm focus:outline-none"
            style={{ background: '#111827', border: '1px solid #1f2937', color: source ? '#ffffff' : '#475569' }}>
            <option value="">All sources</option>
            <option value="employer">Employer</option>
            <option value="careerjet">Careerjet</option>
            <option value="adzuna">Adzuna</option>
            <option value="scrape">Scrape</option>
            <option value="manual">Manual</option>
          </select>
          <button type="submit"
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: '#0C1A3D', color: '#ffffff', border: '1px solid #D4A017' }}>
            Filter
          </button>
          {(safeSearch || status || source) && (
            <Link href="/roodber8/jobs" className="text-xs font-semibold" style={{ color: '#475569' }}>Clear</Link>
          )}
        </form>
      </div>

      {/* Job list */}
      <div className="rounded-2xl border overflow-hidden" style={C.card}>
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#1a2238' }}>
          <h2 className="text-white font-bold text-sm">Listings</h2>
          <span className="text-xs font-semibold" style={{ color: '#475569' }}>
            Page {page} of {totalPages} · {total} listings
          </span>
        </div>

        {jobs.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <Briefcase size={32} style={{ color: '#1a2238' }} className="mx-auto mb-4" />
            <p className="text-white font-semibold mb-2">No jobs match these filters</p>
            <p className="text-sm" style={{ color: '#334155' }}>Try clearing your search or filters.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#1a2238' }}>
            {jobs.map((job: Job) => {
              const statusStyle = STATUS_STYLE[job.status as JobStatus] ?? STATUS_STYLE.draft
              const sourceStyle = SOURCE_STYLE[job.source as JobSource] ?? SOURCE_STYLE.manual
              const paymentStyle = PAYMENT_STYLE[job.payment_status] ?? PAYMENT_STYLE.free
              const expiringSoon = isExpiringSoon(job.expires_at)

              return (
                <div key={job.id} className="px-6 py-4 hover:bg-white/[0.01] transition-colors">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <p className="text-white font-bold text-sm">{job.title}</p>
                        <span className="text-xs" style={{ color: '#94a3b8' }}>{job.company_name}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                          style={{ background: statusStyle.bg, color: statusStyle.color }}>
                          {statusStyle.label}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                          style={{ background: sourceStyle.bg, color: sourceStyle.color }}>
                          {sourceStyle.label}
                        </span>
                        {job.source === 'employer' && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
                            style={{ background: 'rgba(45,212,191,0.15)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.3)' }}>
                            Hiring Direct
                          </span>
                        )}
                        <span className="text-xs font-semibold" style={{ color: paymentStyle.color }}>
                          {paymentStyle.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs flex-wrap mb-2" style={{ color: '#475569' }}>
                        <span>{job.location_text}</span>
                        <span>Posted {formatDate(job.created_at)}</span>
                        <span style={{ color: expiringSoon ? '#f87171' : '#475569' }}>
                          Expires {formatDate(job.expires_at)}
                        </span>
                      </div>

                      {/* Quality score bar */}
                      <div className="flex items-center gap-2 mb-1" style={{ maxWidth: 160 }}>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <div className="h-full rounded-full" style={{
                            width: `${Math.round(job.quality_score * 100)}%`,
                            background: qualityColor(job.quality_score),
                          }} />
                        </div>
                        <span className="text-xs" style={{ color: '#334155' }}>{job.quality_score.toFixed(2)}</span>
                      </div>

                      <NotesToggleButton id={job.id} initialNotes={job.admin_notes} />
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {job.status === 'pending_approval' && (
                        <>
                          <ApproveJobButton id={job.id} />
                          <RejectJobButton id={job.id} />
                        </>
                      )}
                      {job.status === 'active' && (
                        <a href={`/jobs/listings?job=${job.slug}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #1a2238', color: '#60a5fa' }}>
                          View <ExternalLink size={11} />
                        </a>
                      )}
                      <ToggleFeaturedButton id={job.id} isFeatured={job.is_featured} />
                      <DeleteJobButton id={job.id} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: '#1a2238' }}>
            <span className="text-xs" style={{ color: '#475569' }}>Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className="text-xs font-semibold px-4 py-2 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#64748b' }}>
                  Prev
                </Link>
              ) : (
                <span className="text-xs font-semibold px-4 py-2 rounded-xl opacity-40"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#64748b' }}>
                  Prev
                </span>
              )}
              {page < totalPages ? (
                <Link href={pageHref(page + 1)} className="text-xs font-bold px-4 py-2 rounded-xl"
                  style={{ background: '#0C1A3D', color: '#fff', border: '1px solid #D4A017' }}>
                  Next
                </Link>
              ) : (
                <span className="text-xs font-bold px-4 py-2 rounded-xl opacity-40"
                  style={{ background: '#0C1A3D', color: '#fff', border: '1px solid #D4A017' }}>
                  Next
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
