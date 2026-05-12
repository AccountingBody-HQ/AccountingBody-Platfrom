/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js'
import { unstable_noStore as noStore } from 'next/cache'
import AutoRefresh from '@/components/admin/AutoRefresh'
import { StatusBadge, DeleteButton, ReplyButton } from '@/components/admin/AdminActions'
import { Briefcase, Building2, Globe } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getJobsAndFirms() {
  noStore()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
  const [{ data: jobListings }, { data: firmsApplications }] = await Promise.all([
    supabase.from('job_listings').select('*').order('created_at', { ascending: false }),
    supabase.from('firms_applications').select('*').order('created_at', { ascending: false }),
  ])
  return {
    jobListings:       (jobListings ?? [])       as any[],
    firmsApplications: (firmsApplications ?? []) as any[],
  }
}

const FIRM_STATUS_COLOURS: Record<string, { bg: string; color: string }> = {
  pending:      { bg: 'rgba(245,158,11,0.12)',  color: '#fbbf24' },
  under_review: { bg: 'rgba(139,92,246,0.12)',  color: '#a78bfa' },
  approved:     { bg: 'rgba(16,185,129,0.12)',  color: '#34d399' },
  rejected:     { bg: 'rgba(239,68,68,0.12)',   color: '#f87171' },
}

export default async function JobsFirmsPage() {
  const { jobListings, firmsApplications } = await getJobsAndFirms()

  const pendingCount  = firmsApplications.filter((f: any) => f.status === 'pending' || !f.status).length
  const approvedCount = firmsApplications.filter((f: any) => f.status === 'approved').length
  const rejectedCount = firmsApplications.filter((f: any) => f.status === 'rejected').length

  return (
    <div className="p-8">
      <AutoRefresh />

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Jobs & Firms</h1>
        <p className="text-sm" style={{ color: '#475569' }}>
          {firmsApplications.length} firm applications · {jobListings.length} job listings
        </p>
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
            {firmsApplications.map((item: any) => {
              return (
                <div key={item.id} className="px-6 py-5 hover:bg-white/[0.01] transition-colors">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <p className="text-white font-bold text-sm">{item.firm_name ?? '—'}</p>
                        {item.firm_type && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                            style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>
                            {item.firm_type}
                          </span>
                        )}
                        <StatusBadge id={item.id} table="firms_applications" currentStatus={item.status ?? 'pending'} />
                      </div>

                      <div className="flex items-center gap-4 text-xs mb-3 flex-wrap" style={{ color: '#475569' }}>
                        <span className="text-white/80 font-medium">{item.contact_name ?? '—'}</span>
                        <a href={'mailto:' + item.contact_email} style={{ color: '#60a5fa' }}>{item.contact_email ?? '—'}</a>
                        {item.contact_phone && <span>{item.contact_phone}</span>}
                        {item.website && (
                          <a href={item.website} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1" style={{ color: '#60a5fa' }}>
                            <Globe size={10} /> Website
                          </a>
                        )}
                        <span>{item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                      </div>

                      {item.message && (
                        <div className="rounded-xl p-3 mt-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1a2238' }}>
                          <p className="text-xs leading-relaxed" style={{ color: '#64748b' }}>{item.message}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <ReplyButton email={item.contact_email} name={item.contact_name} subject={'Re: Your application — ' + (item.firm_name ?? '')} />
                      <DeleteButton id={item.id} table="firms_applications" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Job Listings */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: '#0d1424', borderColor: '#1a2238' }}>
        <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: '#1a2238' }}>
          <Briefcase size={16} style={{ color: '#3b82f6' }} />
          <h2 className="text-white font-bold text-sm">Job Listings</h2>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold ml-auto"
            style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>
            {jobListings.length}
          </span>
        </div>

        {jobListings.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm" style={{ color: '#334155' }}>No job listings yet.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#1a2238' }}>
            {jobListings.map((item: any) => (
              <div key={item.id} className="px-6 py-4 hover:bg-white/[0.01] transition-colors">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <p className="text-white font-bold text-sm">{item.job_title ?? '—'}</p>
                      <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>{item.company_name ?? '—'}</span>
                      {item.job_type && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                          style={{ background: 'rgba(37,99,235,0.1)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.2)' }}>
                          {item.job_type}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: '#475569' }}>
                      {item.location    && <span>{item.location}</span>}
                      {item.salary_range && <span style={{ color: '#34d399' }}>{item.salary_range}</span>}
                      <a href={'mailto:' + item.contact_email} style={{ color: '#60a5fa' }}>{item.contact_email ?? '—'}</a>
                      <span>{item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ReplyButton email={item.contact_email} subject={'Re: ' + (item.job_title ?? 'Job listing')} />
                    <DeleteButton id={item.id} table="job_listings" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
