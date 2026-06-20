/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js'
import { unstable_noStore as noStore } from 'next/cache'
import AutoRefresh from '@/components/roodber8/AutoRefresh'
import { DeleteButton, ReplyButton } from '@/components/roodber8/AdminActions'
import { Building2, Search } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getEmployerBriefs(filters: { search?: string; status?: string; platform?: string }) {
  noStore()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
  let query = supabase
    .from('employer_briefs')
    .select('*')
    .order('created_at', { ascending: false })
  if (filters.status)   query = query.eq('status', filters.status)
  if (filters.platform) query = query.eq('platform', filters.platform)
  if (filters.search)   query = query.or(
    'company_name.ilike.%' + filters.search + '%,contact_name.ilike.%' + filters.search + '%,contact_email.ilike.%' + filters.search + '%,role_title.ilike.%' + filters.search + '%'
  )
  const { data } = await query
  return (data ?? []) as any[]
}

export default async function EmployersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; platform?: string }>
}) {
  const sp       = await searchParams
  const search   = sp.search   ?? ''
  const status   = sp.status   ?? ''
  const platform = sp.platform ?? ''
  const briefs = await getEmployerBriefs({ search, status, platform })

  const pendingCount    = briefs.filter((b: any) => b.status === 'pending').length
  const reviewingCount  = briefs.filter((b: any) => b.status === 'reviewing').length
  const placedCount     = briefs.filter((b: any) => b.status === 'placed').length
  const closedCount     = briefs.filter((b: any) => b.status === 'closed').length

  const csvRows = briefs.map((r: any) => [
    r.company_name ?? '', r.contact_name ?? '', r.contact_email ?? '',
    r.role_title ?? '', r.contract_type ?? '', r.location ?? '',
    r.salary_budget ?? '', r.status ?? '', r.platform ?? '', r.created_at ?? ''
  ].map((v: string) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n')
  const csvContent = 'company,contact_name,contact_email,role_title,contract_type,location,salary_budget,status,platform,created_at\n' + csvRows

  return (
    <div className="p-8">
      <AutoRefresh />

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Employer Briefs</h1>
          <p className="text-sm" style={{ color: '#475569' }}>
            {briefs.length} total briefs received
          </p>
        </div>
        <a href={'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent)} download="employer-briefs.csv"
          className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl"
          style={{ background: '#059669', color: '#ffffff' }}>
          Export CSV
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Pending Review',  value: pendingCount,   color: '#fbbf24', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)'  },
          { label: 'Reviewing',       value: reviewingCount, color: '#60a5fa', bg: 'rgba(37,99,235,0.08)',   border: 'rgba(37,99,235,0.2)'   },
          { label: 'Placed',          value: placedCount,    color: '#34d399', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)'  },
          { label: 'Closed',          value: closedCount,    color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
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
            <input name="search" defaultValue={search} placeholder="Search company, contact or role..."
              className="bg-transparent text-white text-sm flex-1 focus:outline-none placeholder-slate-600"
              style={{ minWidth: 0 }} />
          </div>
          <select name="status" defaultValue={status}
            className="rounded-xl px-3 py-2 text-sm focus:outline-none"
            style={{ background: '#111827', border: '1px solid #1f2937', color: status ? '#ffffff' : '#475569' }}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="reviewing">Reviewing</option>
            <option value="placed">Placed</option>
            <option value="closed">Closed</option>
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
            <a href="/roodber8/employers" className="text-xs font-semibold" style={{ color: '#475569' }}>Clear</a>
          )}
        </form>
      </div>

      {/* Brief list */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: '#0d1424', borderColor: '#1a2238' }}>
        <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: '#1a2238' }}>
          <Building2 size={16} style={{ color: '#60a5fa' }} />
          <h2 className="text-white font-bold text-sm">Employer Briefs</h2>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold ml-auto"
            style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>
            {briefs.length}
          </span>
        </div>

        {briefs.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm" style={{ color: '#334155' }}>No employer briefs yet.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#1a2238' }}>
            {briefs.map((b: any) => {
              const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
                pending:   { color: '#fbbf24', bg: 'rgba(245,158,11,0.1)',  label: 'Pending' },
                reviewing: { color: '#60a5fa', bg: 'rgba(37,99,235,0.1)',  label: 'Reviewing' },
                placed:    { color: '#34d399', bg: 'rgba(16,185,129,0.1)', label: 'Placed' },
                closed:    { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', label: 'Closed' },
              }
              const st = statusConfig[b.status] ?? { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', label: b.status }
              return (
                <div key={b.id} className="px-6 py-5 hover:bg-white/[0.01] transition-colors">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <p className="text-white font-bold text-sm">{b.company_name}</p>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                          style={{ background: st.bg, color: st.color }}>
                          {st.label}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-lg font-semibold"
                          style={{ background: b.platform === 'et' ? 'rgba(26,71,49,0.3)' : 'rgba(12,26,61,0.3)', color: b.platform === 'et' ? '#4ade80' : '#60a5fa' }}>
                          {b.platform === 'et' ? 'ET' : 'AB'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs flex-wrap mb-2" style={{ color: '#475569' }}>
                        <span className="font-semibold" style={{ color: '#e2e8f0' }}>{b.role_title}</span>
                        <span>{b.contract_type}</span>
                        <span>{b.location}</span>
                        {b.salary_budget && <span style={{ color: '#34d399' }}>{b.salary_budget}</span>}
                        {b.start_date && <span>Start: {b.start_date}</span>}
                      </div>
                      <div className="flex items-center gap-4 text-xs flex-wrap mb-2" style={{ color: '#475569' }}>
                        <span>{b.contact_name}</span>
                        <a href={'mailto:' + b.contact_email} style={{ color: '#60a5fa' }}>{b.contact_email}</a>
                        {b.contact_phone && <span>{b.contact_phone}</span>}
                        <span>{b.created_at ? new Date(b.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span>
                      </div>
                      {b.role_description && (
                        <p className="text-xs mt-1 line-clamp-2" style={{ color: '#475569' }}>{b.role_description}</p>
                      )}
                      {b.must_haves && (
                        <p className="text-xs mt-1" style={{ color: '#334155' }}>Must-haves: {b.must_haves}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ReplyButton email={b.contact_email} subject={'Re: Hiring Brief — ' + b.role_title + ' at ' + b.company_name} />
                      <DeleteButton id={b.id} table="employer_briefs" />
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
