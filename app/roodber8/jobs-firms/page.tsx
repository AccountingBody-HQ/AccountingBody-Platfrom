/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { unstable_noStore as noStore } from 'next/cache'
import AutoRefresh from '@/components/roodber8/AutoRefresh'
import { FirmApplicationCard } from '@/components/roodber8/AdminActions'
import { Building2, Search } from 'lucide-react'

export const dynamic = 'force-dynamic'

// ── Platform segmented filter (All / AB / ET) — additive with search + status ──
const PLATFORM_SEGMENTS = [
  { value: '',   label: 'All' },
  { value: 'ab', label: 'AB'  },
  { value: 'et', label: 'ET'  },
]
const SEGMENT_ACTIVE   = { background: 'rgba(201,152,42,0.15)', border: '1px solid #C9982A', color: '#C9982A', borderRadius: 6, padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }
const SEGMENT_INACTIVE = { background: 'transparent', border: '1px solid #1f2937', color: '#64748b', borderRadius: 6, padding: '3px 10px', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }

function platformHref(basePath: string, current: { search?: string; status?: string }, platform: string) {
  const params = new URLSearchParams()
  if (current.search) params.set('search', current.search)
  if (current.status) params.set('status', current.status)
  if (platform) params.set('platform', platform)
  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

// ── Per-row platform badge — never hides a record's platform, shows "—" if unknown ──
const AB_BADGE_STYLE = { background: 'rgba(12,26,61,0.12)', border: '1px solid rgba(12,26,61,0.4)', color: '#0C1A3D', fontSize: '0.65rem', fontWeight: 600, padding: '1px 6px', borderRadius: 4, letterSpacing: '0.05em' }
const ET_BADGE_STYLE = { background: 'rgba(26,71,49,0.12)', border: '1px solid rgba(26,71,49,0.4)', color: '#1A4731', fontSize: '0.65rem', fontWeight: 600, padding: '1px 6px', borderRadius: 4, letterSpacing: '0.05em' }

function PlatformBadges({ platform }: { platform: unknown }) {
  const values = Array.isArray(platform) ? platform : (platform ? [platform] : [])
  const hasAB = values.includes('ab')
  const hasET = values.includes('et')
  if (!hasAB && !hasET) {
    return <span className="text-xs" style={{ color: '#334155' }}>—</span>
  }
  return (
    <>
      {hasAB && <span style={AB_BADGE_STYLE}>AB</span>}
      {hasET && <span style={ET_BADGE_STYLE}>ET</span>}
    </>
  )
}

async function getJobsAndFirms(filters: { safeSearch?: string; status?: string; platform?: string }) {
  noStore()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
  let firmsQuery = supabase.from('firms_applications').select('*').order('created_at', { ascending: false })
  if (filters.status) firmsQuery = firmsQuery.eq('status', filters.status)
  if (filters.safeSearch) firmsQuery = firmsQuery.or(`firm_name.ilike.%${filters.safeSearch}%,contact_name.ilike.%${filters.safeSearch}%,contact_email.ilike.%${filters.safeSearch}%`)
  if (filters.platform) firmsQuery = firmsQuery.eq('platform', filters.platform)
  const { data: firmsApplications } = await firmsQuery
  return {
    firmsApplications: (firmsApplications ?? []) as any[],
  }
}

export default async function JobsFirmsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; platform?: string }>
}) {
  const sp         = await searchParams
  const safeSearch = (sp.search ?? '').replace(/[,()]/g, '')
  const status     = sp.status ?? ''
  const platform   = sp.platform ?? ''
  const { firmsApplications } = await getJobsAndFirms({ safeSearch, status, platform })

  const pendingCount  = firmsApplications.filter((f: any) => f.status === 'pending' || !f.status).length
  const approvedCount = firmsApplications.filter((f: any) => f.status === 'approved').length
  const rejectedCount = firmsApplications.filter((f: any) => f.status === 'rejected').length

  const firmsCsvRows = firmsApplications.map((r: any) => [
    r.firm_name ?? '', r.contact_name ?? '', r.contact_email ?? '',
    r.contact_phone ?? '', r.firm_type ?? '', r.status ?? '',
    r.website ?? '', (r.message ?? '').split('\n').join(' '), r.created_at ?? ''
  ].map((v: string) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n')
  const firmsCsvContent = 'firm_name,contact_name,contact_email,contact_phone,firm_type,status,website,message,created_at\n' + firmsCsvRows

  return (
    <div className="p-8">
      <AutoRefresh />

      <div className="rounded-xl px-4 py-3 mb-6 text-sm"
        style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', color: '#3b82f6' }}>
        Job listings have moved to the new Jobs admin →{' '}
        <Link href="/roodber8/jobs" className="font-bold" style={{ color: '#D4A017' }}>Manage Jobs</Link>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Jobs & Firms</h1>
          <p className="text-sm" style={{ color: '#475569' }}>
            {firmsApplications.length} firm applications
          </p>
        </div>
        <a href={'data:text/csv;charset=utf-8,' + encodeURIComponent(firmsCsvContent)} download="firms-applications.csv"
          className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl"
          style={{ background: '#059669', color: '#ffffff' }}>
          Export Applications
        </a>
      </div>

      {/* Firm application stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Pending Review', value: pendingCount,  color: '#fbbf24', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)'  },
          { label: 'Approved',       value: approvedCount, color: '#34d399', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)'  },
          { label: 'Rejected',       value: rejectedCount, color: '#f87171', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)'   },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border p-4"
            style={{ background: s.bg, borderColor: s.border }}>
            <p className="text-2xl font-black mb-1" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: s.color }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl border p-4 mb-6 flex flex-col gap-3"
        style={{ background: '#0d1424', borderColor: '#1a2238' }}>
        <div className="flex items-center gap-1">
          {PLATFORM_SEGMENTS.map(seg => (
            <Link key={seg.value || 'all'}
              href={platformHref('/roodber8/jobs-firms', { search: safeSearch, status }, seg.value)}
              style={platform === seg.value ? SEGMENT_ACTIVE : SEGMENT_INACTIVE}>
              {seg.label}
            </Link>
          ))}
        </div>
        <form method="GET" className="flex items-center gap-3 flex-wrap flex-1">
          <input type="hidden" name="platform" value={platform} />
          <div className="flex items-center gap-2 flex-1 min-w-48 rounded-xl px-3 py-2"
            style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <Search size={13} style={{ color: '#475569' }} />
            <input name="search" defaultValue={safeSearch} placeholder="Search name or email..."
              className="bg-transparent text-white text-sm flex-1 focus:outline-none placeholder-slate-600"
              style={{ minWidth: 0 }} />
          </div>
          <select name="status" defaultValue={status}
            className="rounded-xl px-3 py-2 text-sm focus:outline-none"
            style={{ background: '#111827', border: '1px solid #1f2937', color: status ? '#ffffff' : '#475569' }}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button type="submit"
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: '#0C1A3D', color: '#ffffff', border: '1px solid #D4A017' }}>
            Filter
          </button>
          {(safeSearch || status || platform) && (
            <a href="/roodber8/jobs-firms" className="text-xs font-semibold" style={{ color: '#475569' }}>Clear</a>
          )}
        </form>
      </div>

      {/* Firm Applications */}
      <div className="rounded-2xl border overflow-hidden mb-6" style={{ background: '#0d1424', borderColor: '#1a2238' }}>
        <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: '#1a2238' }}>
          <Building2 size={16} style={{ color: '#8b5cf6' }} />
          <h2 className="text-white font-bold text-sm">Firm & Freelancer Applications</h2>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold ml-auto"
            style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}>
            {firmsApplications.length}
          </span>
        </div>

        {firmsApplications.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm" style={{ color: '#334155' }}>No applications yet.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#1a2238' }}>
            {firmsApplications.map((item: any) => (
              <div key={item.id}>
                {/* FirmApplicationCard renders the row itself (components/roodber8/AdminActions.tsx,
                    out of scope for this change) — the platform badge sits in a slim strip
                    directly above the card rather than inline next to the firm name. */}
                <div className="px-6 pt-3 flex items-center gap-1.5">
                  <PlatformBadges platform={item.platform} />
                </div>
                <FirmApplicationCard item={item} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
