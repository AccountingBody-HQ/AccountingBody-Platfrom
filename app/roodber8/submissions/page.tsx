/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js'
import { unstable_noStore as noStore } from 'next/cache'
import AutoRefresh from '@/components/roodber8/AutoRefresh'
import { StatusBadge, DeleteButton, ReplyButton, NotesField } from '@/components/roodber8/AdminActions'
import { HelpCircle, Mail, Search } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getSubmissions(filters: { search?: string; serviceType?: string; status?: string; platform?: string }) {
  noStore()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const platformFilter = filters.platform || 'ab'
  let helpQuery = supabase.from('help_requests').select('*').eq('platform', platformFilter).order('created_at', { ascending: false })
  if (filters.status)      helpQuery = helpQuery.eq('status', filters.status)
  if (filters.serviceType) helpQuery = helpQuery.eq('service_type', filters.serviceType)
  if (filters.search)      helpQuery = helpQuery.or('name.ilike.%' + filters.search + '%,email.ilike.%' + filters.search + '%')

  let contactQuery = supabase.from('contact_submissions').select('*').eq('platform', platformFilter).order('created_at', { ascending: false })
  if (filters.search) contactQuery = contactQuery.or('name.ilike.%' + filters.search + '%,email.ilike.%' + filters.search + '%')

  const [{ data: helpRequests }, { data: contactSubmissions }] = await Promise.all([helpQuery, contactQuery])

  return {
    helpRequests:       (helpRequests ?? [])       as any[],
    contactSubmissions: (contactSubmissions ?? []) as any[],
  }
}

async function getServiceTypes() {
  noStore()
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)
  const { data } = await supabase.from('help_requests').select('service_type').not('service_type', 'is', null)
  const types = Array.from(new Set((data ?? []).map((r: any) => r.service_type).filter(Boolean)))
  return types as string[]
}

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; service?: string; status?: string; platform?: string }>
}) {
  const sp          = await searchParams
  const search      = sp.search ?? ''
  const serviceType = sp.service ?? ''
  const status      = sp.status ?? ''
  const platform    = sp.platform ?? 'ab'

  const [{ helpRequests, contactSubmissions }, serviceTypes] = await Promise.all([
    getSubmissions({ search, serviceType, status, platform }),
    getServiceTypes(),
  ])

  const helpCsvRows = helpRequests.map((r: any) => [
    r.name ?? '', r.email ?? '', r.phone ?? '', r.service_type ?? '',
    r.status ?? '', (r.message ?? '').split('\n').join(' '), r.created_at ?? ''
  ].map((v: string) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n')
  const helpCsvContent = 'name,email,phone,service_type,status,message,created_at\n' + helpCsvRows

  const contactCsvRows = contactSubmissions.map((r: any) => [
    r.name ?? r.full_name ?? '', r.email ?? '', r.subject ?? '', r.status ?? '',
    (r.message ?? '').split('\n').join(' '), r.created_at ?? ''
  ].map((v: string) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n')
  const contactCsvContent = 'name,email,subject,status,message,created_at\n' + contactCsvRows

  return (
    <div className="p-8">
      <AutoRefresh />

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Submissions</h1>
          <p className="text-sm" style={{ color: '#475569' }}>
            {helpRequests.length} help requests · {contactSubmissions.length} contact submissions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a href={'data:text/csv;charset=utf-8,' + encodeURIComponent(helpCsvContent)} download="help-requests.csv"
            className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl"
            style={{ background: '#0C1A3D', color: '#D4A017', border: '1px solid #D4A017' }}>
            Export Help Requests
          </a>
          <a href={'data:text/csv;charset=utf-8,' + encodeURIComponent(contactCsvContent)} download="contact-submissions.csv"
            className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl"
            style={{ background: '#059669', color: '#ffffff' }}>
            Export Contact
          </a>
        </div>
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl border p-4 mb-6 flex items-center gap-3 flex-wrap"
        style={{ background: '#0d1424', borderColor: '#1a2238' }}>
        <form method="GET" className="flex items-center gap-3 flex-wrap flex-1">
          <div className="flex items-center gap-2 flex-1 min-w-48 rounded-xl px-3 py-2"
            style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <Search size={13} style={{ color: '#475569' }} />
            <input name="search" defaultValue={search} placeholder="Search name or email…"
              className="bg-transparent text-white text-sm flex-1 focus:outline-none placeholder-slate-600"
              style={{ minWidth: 0 }} />
          </div>
          <select name="service" defaultValue={serviceType}
            className="rounded-xl px-3 py-2 text-sm focus:outline-none"
            style={{ background: '#111827', border: '1px solid #1f2937', color: serviceType ? '#ffffff' : '#475569' }}>
            <option value="">All services</option>
            {serviceTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select name="status" defaultValue={status}
            className="rounded-xl px-3 py-2 text-sm focus:outline-none"
            style={{ background: '#111827', border: '1px solid #1f2937', color: status ? '#ffffff' : '#475569' }}>
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select name="platform" defaultValue={platform}
            className="rounded-xl px-3 py-2 text-sm focus:outline-none"
            style={{ background: '#111827', border: '1px solid #1f2937', color: platform ? '#ffffff' : '#475569' }}>
            <option value="ab">AccountingBody</option>
            <option value="et">EthioTax</option>
          </select>
          <button type="submit"
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: '#0C1A3D', color: '#ffffff', border: '1px solid #D4A017' }}>
            Filter
          </button>
          {(search || serviceType || status) && (
            <a href="/roodber8/submissions" className="text-xs font-semibold" style={{ color: '#475569' }}>Clear</a>
          )}
        </form>
      </div>

      {/* Help Requests */}
      <div className="rounded-2xl border overflow-hidden mb-6" style={{ background: '#0d1424', borderColor: '#1a2238' }}>
        <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: '#1a2238' }}>
          <HelpCircle size={16} style={{ color: '#f59e0b' }} />
          <h2 className="text-white font-bold text-sm">Help & Service Requests</h2>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold ml-auto"
            style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
            {helpRequests.length}
          </span>
        </div>

        {helpRequests.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm" style={{ color: '#334155' }}>
            No help requests{search || serviceType || status ? ' matching filters' : ' yet'}.
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#1a2238' }}>
            {helpRequests.map((item: any) => {
              return (
                <div key={item.id} className="px-6 py-4 hover:bg-white/[0.01] transition-colors">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <p className="text-white font-semibold text-sm">{item.name ?? '—'}</p>
                        {item.service_type && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                            style={{ background: 'rgba(37,99,235,0.1)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.2)' }}>
                            {item.service_type}
                          </span>
                        )}
                        <StatusBadge id={item.id} table="help_requests" currentStatus={item.status ?? 'open'} />
                      </div>
                      <div className="flex items-center gap-4 text-xs mb-3 flex-wrap" style={{ color: '#475569' }}>
                        <a href={'mailto:' + item.email} style={{ color: '#60a5fa' }}>{item.email ?? '—'}</a>
                        {item.phone && <span>{item.phone}</span>}
                        <span>{item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                      </div>
                      {item.message && (
                        <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>{item.message}</p>
                      )}
                      <NotesField id={item.id} table="help_requests" initialNotes={item.notes} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ReplyButton email={item.email} subject={item.service_type ? 'Re: ' + item.service_type + ' enquiry' : undefined} name={item.name} />
                      <DeleteButton id={item.id} table="help_requests" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Contact Submissions */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: '#0d1424', borderColor: '#1a2238' }}>
        <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: '#1a2238' }}>
          <Mail size={16} style={{ color: '#3b82f6' }} />
          <h2 className="text-white font-bold text-sm">Contact Form Submissions</h2>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold ml-auto"
            style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>
            {contactSubmissions.length}
          </span>
        </div>

        {contactSubmissions.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm" style={{ color: '#334155' }}>
            No contact submissions{search ? ' matching search' : ' yet'}.
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#1a2238' }}>
            {contactSubmissions.map((item: any) => (
              <div key={item.id} className="px-6 py-4 hover:bg-white/[0.01] transition-colors">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <p className="text-white font-semibold text-sm">{item.name ?? item.full_name ?? '—'}</p>
                      {item.subject && (
                        <span className="text-xs" style={{ color: '#475569' }}>{item.subject}</span>
                      )}
                      <StatusBadge id={item.id} table="contact_submissions" currentStatus={item.status ?? 'open'} />
                    </div>
                    <div className="flex items-center gap-4 text-xs mb-3 flex-wrap" style={{ color: '#475569' }}>
                      <a href={'mailto:' + item.email} style={{ color: '#60a5fa' }}>{item.email ?? '—'}</a>
                      {item.organisation && <span>{item.organisation}</span>}
                      <span>{item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                    </div>
                    {item.message && (
                      <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>{item.message}</p>
                    )}
                    <NotesField id={item.id} table="contact_submissions" initialNotes={item.notes} />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ReplyButton email={item.email} subject={item.subject} name={item.name ?? item.full_name} />
                    <DeleteButton id={item.id} table="contact_submissions" />
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
