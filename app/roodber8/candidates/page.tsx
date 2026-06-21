/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js'
import { unstable_noStore as noStore } from 'next/cache'
import AutoRefresh from '@/components/roodber8/AutoRefresh'
import { DeleteButton, ReplyButton } from '@/components/roodber8/AdminActions'
import { Users, Search } from 'lucide-react'
import { CandidateActionButtons } from '@/components/roodber8/CandidateActions'

export const dynamic = 'force-dynamic'

async function getCandidates(filters: { search?: string; status?: string; platform?: string }) {
  noStore()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
  let query = supabase
    .from('job_seeker_registrations')
    .select('*')
    .neq('status', 'pending_verification')
    .order('created_at', { ascending: false })
  if (filters.status)   query = query.eq('status', filters.status)
  if (filters.platform) query = query.eq('platform', filters.platform)
  if (filters.search)   query = query.or(
    'full_name.ilike.%' + filters.search + '%,email.ilike.%' + filters.search + '%,professional_role.ilike.%' + filters.search + '%'
  )
  const { data } = await query
  return (data ?? []) as any[]
}

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; platform?: string }>
}) {
  const sp       = await searchParams
  const search   = sp.search   ?? ''
  const status   = sp.status   ?? ''
  const platform = sp.platform ?? ''
  const candidates = await getCandidates({ search, status, platform })

  const pendingVerCount = candidates.filter((c: any) => c.status === 'pending_verification').length
  const pendingRevCount = candidates.filter((c: any) => c.status === 'pending_review').length
  const activeCount     = candidates.filter((c: any) => c.status === 'active').length
  const rejectedCount   = candidates.filter((c: any) => c.status === 'rejected').length

  const csvRows = candidates.map((r: any) => [
    r.full_name ?? '', r.email ?? '', r.professional_role ?? '',
    r.qualification ?? '', r.years_experience ?? '', r.location_city ?? '',
    r.location_country ?? '', r.employment_status ?? '', r.status ?? '',
    r.platform ?? '', r.created_at ?? ''
  ].map((v: string) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n')
  const csvContent = 'full_name,email,role,qualification,experience,city,country,employment_status,status,platform,created_at\n' + csvRows

  return (
    <div className="p-8">
      <AutoRefresh />

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Candidates</h1>
          <p className="text-sm" style={{ color: '#475569' }}>
            {candidates.length} total registrations
          </p>
        </div>
        <a href={'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent)} download="candidates.csv"
          className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl"
          style={{ background: '#059669', color: '#ffffff' }}>
          Export CSV
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Awaiting Verification', value: pendingVerCount, color: '#94a3b8', bg: 'rgba(148,163,184,0.08)',  border: 'rgba(148,163,184,0.2)' },
          { label: 'Pending Review',        value: pendingRevCount, color: '#fbbf24', bg: 'rgba(245,158,11,0.08)',   border: 'rgba(245,158,11,0.2)' },
          { label: 'Active',                value: activeCount,     color: '#34d399', bg: 'rgba(16,185,129,0.08)',   border: 'rgba(16,185,129,0.2)' },
          { label: 'Rejected',              value: rejectedCount,   color: '#f87171', bg: 'rgba(239,68,68,0.08)',    border: 'rgba(239,68,68,0.2)' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border p-4"
            style={{ background: s.bg, borderColor: s.border }}>
            <p className="text-2xl font-black mb-1" style={{ color: s.color }}>{s.value}</p>
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
            <input name="search" defaultValue={search} placeholder="Search name, email or role..."
              className="bg-transparent text-white text-sm flex-1 focus:outline-none placeholder-slate-600"
              style={{ minWidth: 0 }} />
          </div>
          <select name="status" defaultValue={status}
            className="rounded-xl px-3 py-2 text-sm focus:outline-none"
            style={{ background: '#111827', border: '1px solid #1f2937', color: status ? '#ffffff' : '#475569' }}>
            <option value="">All statuses</option>
            <option value="pending_verification">Awaiting Verification</option>
            <option value="pending_review">Pending Review</option>
            <option value="active">Active</option>
            <option value="rejected">Rejected</option>
          </select>
          <select name="platform" defaultValue={platform}
            className="rounded-xl px-3 py-2 text-sm focus:outline-none"
            style={{ background: '#111827', border: '1px solid #1f2937', color: platform ? '#ffffff' : '#475569' }}>
            <option value="">All platforms</option>
            <option value="ab">Accounting Body</option>
            <option value="et">EthioTax</option>
          </select>
          <button type="submit"
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: '#0C1A3D', color: '#ffffff', border: '1px solid #D4A017' }}>
            Filter
          </button>
          {(search || status || platform) && (
            <a href="/roodber8/candidates" className="text-xs font-semibold" style={{ color: '#475569' }}>Clear</a>
          )}
        </form>
      </div>

      {/* Candidate list */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: '#0d1424', borderColor: '#1a2238' }}>
        <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: '#1a2238' }}>
          <Users size={16} style={{ color: '#C9982A' }} />
          <h2 className="text-white font-bold text-sm">Candidate Registrations</h2>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold ml-auto"
            style={{ background: 'rgba(201,152,42,0.12)', color: '#C9982A' }}>
            {candidates.length}
          </span>
        </div>

        {candidates.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm" style={{ color: '#334155' }}>No candidate registrations yet.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#1a2238' }}>
            {candidates.map((c: any) => {
              const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
                pending_verification: { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  label: 'Awaiting Verification' },
                pending_review:       { color: '#fbbf24', bg: 'rgba(245,158,11,0.1)',   label: 'Pending Review' },
                active:               { color: '#34d399', bg: 'rgba(16,185,129,0.1)',   label: 'Active' },
                rejected:             { color: '#f87171', bg: 'rgba(239,68,68,0.1)',    label: 'Rejected' },
              }
              const st = statusConfig[c.status] ?? { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', label: c.status }
              return (
                <div key={c.id} className="px-6 py-5 hover:bg-white/[0.01] transition-colors">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <p className="text-white font-bold text-sm">{c.full_name}</p>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                          style={{ background: st.bg, color: st.color }}>
                          {st.label}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-lg font-semibold"
                          style={{ background: c.platform === 'et' ? 'rgba(26,71,49,0.3)' : 'rgba(12,26,61,0.3)', color: c.platform === 'et' ? '#4ade80' : '#60a5fa' }}>
                          {c.platform === 'et' ? 'ET' : 'AB'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs flex-wrap mb-2" style={{ color: '#475569' }}>
                        <a href={'mailto:' + c.email} style={{ color: '#60a5fa' }}>{c.email}</a>
                        {c.phone && <a href={'tel:' + c.phone} style={{ color: '#94a3b8' }}>{c.phone}</a>}
                        <span>{c.professional_role}</span>
                        <span>{c.qualification}</span>
                        <span>{c.years_experience}</span>
                        <span>{c.employment_status}</span>
                        <span>{c.location_city}{c.location_country ? ', ' + c.location_country : ''}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs flex-wrap mb-2" style={{ color: '#334155' }}>
                        {c.languages && <span>Languages: {Array.isArray(c.languages) ? c.languages.join(', ') : c.languages}</span>}
                        {c.jurisdictions && <span>Jurisdictions: {Array.isArray(c.jurisdictions) ? c.jurisdictions.join(', ') : c.jurisdictions}</span>}
                        {c.role_types && <span>Seeking: {Array.isArray(c.role_types) ? c.role_types.join(', ') : c.role_types}</span>}
                        {c.salary_expectation && <span style={{ color: '#34d399' }}>{c.salary_expectation}</span>}
                        <span>{c.created_at ? new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                      </div>
                      {c.linkedin_url && (
                        <div className="text-xs mb-2">
                          <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>LinkedIn: {c.linkedin_url}</a>
                        </div>
                      )}
                      {c.biography && (
                        <p className="text-xs mt-2" style={{ color: '#475569' }}>{c.biography}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ReplyButton email={c.email} subject={'Re: Candidate Registration — ' + c.full_name} />
                      <CandidateActionButtons id={c.id} currentStatus={c.status} email={c.email} name={c.full_name} platform={c.platform} />
                      <DeleteButton id={c.id} table="job_seeker_registrations" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
