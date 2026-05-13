/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js'
import { unstable_noStore as noStore } from 'next/cache'
import AutoRefresh from '@/components/admin/AutoRefresh'
import { StatusBadge, DeleteButton } from '@/components/admin/AdminActions'
import { Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getSubscribers(filters: { status?: string; source?: string }) {
  noStore()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
  let query = supabase.from('email_subscribers').select('*', { count: 'exact' }).eq('platform', 'ab').order('subscribed_at', { ascending: false })
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.source) query = query.eq('source', filters.source)
  const { data, count } = await query
  return { subscribers: (data ?? []) as any[], total: count ?? 0 }
}

async function getSources() {
  noStore()
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)
  const { data } = await supabase.from('email_subscribers').select('source').eq('platform', 'ab').not('source', 'is', null)
  return Array.from(new Set((data ?? []).map((r: any) => r.source).filter(Boolean))) as string[]
}

export default async function SubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; source?: string }>
}) {
  const sp     = await searchParams
  const status = sp.status ?? ''
  const source = sp.source ?? ''

  const [{ subscribers, total }, sources] = await Promise.all([
    getSubscribers({ status, source }),
    getSources(),
  ])

  const subscribedCount   = subscribers.filter((s: any) => s.status === 'subscribed' || s.status === 'active' || !s.status).length
  const unsubscribedCount = subscribers.filter((s: any) => s.status === 'unsubscribed').length

  const csvRows   = subscribers.map((s: any) => [s.email, s.status ?? 'subscribed', s.source ?? '', s.subscribed_at ?? ''].join(',')).join('\n')
  const csvContent = 'email,status,source,subscribed_at\n' + csvRows

  return (
    <div className="p-8">
      <AutoRefresh />

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Subscribers</h1>
          <p className="text-sm" style={{ color: '#475569' }}>Email list from footer and homepage signup forms</p>
        </div>
        <a href={'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent)} download="subscribers.csv"
          className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl"
          style={{ background: '#059669', color: '#ffffff' }}>
          Export CSV
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Subscribers', value: total,             color: '#D4A017', bg: 'rgba(212,160,23,0.08)',  border: 'rgba(212,160,23,0.2)'  },
          { label: 'Subscribed',        value: subscribedCount,   color: '#34d399', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)'  },
          { label: 'Unsubscribed',      value: unsubscribedCount, color: '#f87171', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)'   },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border p-4" style={{ background: s.bg, borderColor: s.border }}>
            <p className="text-2xl font-black mb-1" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: s.color }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl border p-4 mb-6 flex items-center gap-3 flex-wrap"
        style={{ background: '#0d1424', borderColor: '#1a2238' }}>
        <form method="GET" className="flex items-center gap-3 flex-wrap">
          <select name="status" defaultValue={status}
            className="rounded-xl px-3 py-2 text-sm focus:outline-none"
            style={{ background: '#111827', border: '1px solid #1f2937', color: status ? '#ffffff' : '#475569' }}>
            <option value="">All statuses</option>
            <option value="subscribed">Subscribed</option>
            <option value="unsubscribed">Unsubscribed</option>
          </select>
          <select name="source" defaultValue={source}
            className="rounded-xl px-3 py-2 text-sm focus:outline-none"
            style={{ background: '#111827', border: '1px solid #1f2937', color: source ? '#ffffff' : '#475569' }}>
            <option value="">All sources</option>
            {sources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button type="submit" className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: '#0C1A3D', color: '#ffffff', border: '1px solid #D4A017' }}>
            Filter
          </button>
          {(status || source) && (
            <a href="/admin/subscribers" className="text-xs font-semibold" style={{ color: '#475569' }}>Clear</a>
          )}
        </form>
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: '#0d1424', borderColor: '#1a2238' }}>
        <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: '#1a2238' }}>
          <Users size={16} style={{ color: '#10b981' }} />
          <h2 className="text-white font-bold text-sm">All Subscribers</h2>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold ml-auto"
            style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399' }}>
            {total}
          </span>
        </div>

        {subscribers.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm" style={{ color: '#334155' }}>
            No subscribers{status || source ? ' matching filters' : ' yet'}.
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#1a2238' }}>
            {subscribers.map((item: any) => (
              <div key={item.id} className="px-6 py-3.5 flex items-center gap-4 hover:bg-white/[0.01] transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{item.email}</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {item.source && (
                      <span className="text-xs" style={{ color: '#334155' }}>{item.source}</span>
                    )}
                    <span className="text-xs" style={{ color: '#334155' }}>
                      {item.subscribed_at ? new Date(item.subscribed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge id={item.id} table="email_subscribers" currentStatus={item.status ?? 'subscribed'} />
                  <DeleteButton id={item.id} table="email_subscribers" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
