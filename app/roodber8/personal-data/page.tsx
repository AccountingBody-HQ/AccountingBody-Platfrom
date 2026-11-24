'use client'

// Personal data: find, export or erase everything the database holds about
// one person, by e-mail address (lib/personal-data.ts). The address is sent
// in the request body only, never in the page address.

import { useState } from 'react'
import { adminFetch } from '@/lib/admin-fetch'
import { ADMIN_COLORS } from '@/lib/admin-theme'
import { Download, Loader2, Search, Trash2, UserSearch } from 'lucide-react'

const API = '/api/roodber8/personal-data'

const C = {
  page:    { background: ADMIN_COLORS.bg, minHeight: '100vh' },
  card:    { background: ADMIN_COLORS.card, border: `1px solid ${ADMIN_COLORS.border}`, borderRadius: 16 },
  input:   { background: ADMIN_COLORS.bg, border: `1px solid ${ADMIN_COLORS.borderLight}`, color: ADMIN_COLORS.text },
  idle:    { background: 'transparent', border: `1px solid ${ADMIN_COLORS.borderLight}`, color: ADMIN_COLORS.text },
  primary: { background: ADMIN_COLORS.gold, color: '#0C1A3D', border: `1px solid ${ADMIN_COLORS.gold}` },
  danger:  { background: ADMIN_COLORS.dangerBg, border: `1px solid ${ADMIN_COLORS.danger}`, color: ADMIN_COLORS.danger },
  success: { background: ADMIN_COLORS.successBg, border: `1px solid ${ADMIN_COLORS.success}`, color: ADMIN_COLORS.success },
  warning: { background: ADMIN_COLORS.warningBg, border: `1px solid ${ADMIN_COLORS.warning}`, color: ADMIN_COLORS.text },
  muted:   { color: ADMIN_COLORS.textMuted },
}

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'

type Row = Record<string, unknown>

interface Source {
  table:  string
  label:  string
  action: 'erase' | 'keep'
  note:   string | null
  count:  number
  rows:   Row[]
}

interface BinCopy {
  id:         string
  kind:       string
  label:      string
  deleted_at: string | null
}

interface Found {
  email:   string
  sources: Source[]
  bin:     BinCopy[]
}

interface EraseSummary {
  ok:       boolean
  error:    string
  deleted:  Record<string, number>
  done:     string[]
  not_done: string[]
  kept:     { table: string; label: string; count: number; note: string }[]
}

const OUTSIDE = [
  'The team inbox info@accountingbody.com: delete the notification e-mails about this person.',
  'Resend (the e-mail sending service): its sent-message log holds the e-mails sent to this address.',
  'Lemon Squeezy (payments): if they paid for a job post, their order is held there.',
  'WhatsApp (EthioTax enquiries): delete any chat with this person.',
]

const text = (value: unknown): string => (typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value))

function day(value: unknown): string {
  const iso = text(value)
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })
}

// The few fields that tell the admin which entry a row is.
function keyFields(row: Row): { date: string; name: string; status: string } {
  return {
    date:   day(row.created_at ?? row.subscribed_at),
    name:   text(row.full_name ?? row.contact_name ?? row.applicant_name ?? row.name ?? row.employer_name ?? row.title),
    status: text(row.status),
  }
}

const sameAddress = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export default function PersonalDataPage() {
  const [email, setEmail]         = useState('')
  const [found, setFound]         = useState<Found | null>(null)
  const [busy, setBusy]           = useState<'' | 'find' | 'export' | 'erase'>('')
  const [error, setError]         = useState('')
  const [confirming, setConfirming] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [result, setResult]       = useState<EraseSummary | null>(null)

  const post = (body: Record<string, unknown>, file = false) =>
    adminFetch(API, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    }, file ? { expect: 'file' } : undefined)

  async function find(address: string) {
    setBusy('find')
    setError('')
    setResult(null)
    setFound(null)
    try {
      const res = await post({ action: 'find', email: address })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not read the records. Nothing was shown.')
      } else {
        setFound({
          email:   address.trim(),
          sources: Array.isArray(data.sources) ? data.sources : [],
          bin:     Array.isArray(data.recycle_bin) ? data.recycle_bin : [],
        })
      }
    } catch {
      setError('Could not read the records. Nothing was shown.')
    }
    setBusy('')
  }

  async function exportJson() {
    if (!found) return
    setBusy('export')
    setError('')
    try {
      const res = await post({ action: 'export', email: found.email }, true)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Export failed.')
      } else {
        const url = URL.createObjectURL(await res.blob())
        const link = document.createElement('a')
        link.href = url
        link.download = 'personal-data-export.json'
        document.body.appendChild(link)
        link.click()
        link.remove()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      }
    } catch {
      setError('Export failed.')
    }
    setBusy('')
  }

  async function erase() {
    if (!found) return
    setBusy('erase')
    setError('')
    try {
      const res = await post({ action: 'erase', email: found.email, confirm: confirmText })
      const data = await res.json()
      if (data && typeof data === 'object' && data.deleted) {
        setResult({
          ok:       res.ok,
          error:    res.ok ? '' : (data.error ?? 'Erase stopped. Some tables were not erased.'),
          deleted:  data.deleted ?? {},
          done:     Array.isArray(data.done) ? data.done : [],
          not_done: Array.isArray(data.not_done) ? data.not_done : [],
          kept:     Array.isArray(data.kept) ? data.kept : [],
        })
        setFound(null)
      } else {
        setError(data?.error ?? 'Erase failed. Nothing was erased.')
      }
    } catch {
      setError('Erase failed: no answer from the server. Find the person again to see what is left.')
    }
    setBusy('')
    setConfirming(false)
    setConfirmText('')
  }

  const toErase = found ? found.sources.filter((s) => s.action === 'erase' && s.count > 0) : []
  const toKeep  = found ? found.sources.filter((s) => s.action === 'keep' && s.count > 0) : []
  const total   = found ? found.sources.reduce((n, s) => n + s.count, 0) + found.bin.length : 0
  const labelOf = (table: string) => found?.sources.find((s) => s.table === table)?.label ?? (table === 'admin_recycle_bin' ? 'Recycle bin copies' : table)

  return (
    <div className="p-8 max-w-5xl" style={C.page}>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: ADMIN_COLORS.warningBg }}>
          <UserSearch size={20} style={{ color: ADMIN_COLORS.gold }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Personal data</h1>
          <p className="text-sm" style={C.muted}>
            Find, export or erase everything we hold about one person, by e-mail address, on every site.
          </p>
        </div>
      </div>

      <form
        className="rounded-2xl p-5 mb-6 flex flex-wrap items-end gap-3"
        style={C.card}
        onSubmit={(e) => { e.preventDefault(); if (email.trim()) find(email) }}
      >
        <div className="flex-1 min-w-[240px]">
          <label htmlFor="pd-email" className="block text-sm font-semibold text-white mb-1">E-mail address</label>
          <input
            id="pd-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full h-10 px-3 rounded-lg text-sm ${FOCUS}`}
            style={C.input}
            placeholder="person@example.com"
          />
        </div>
        <button type="submit" disabled={busy !== '' || !email.trim()}
          className={`flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-bold disabled:opacity-50 ${FOCUS}`}
          style={C.primary}>
          {busy === 'find' ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Find
        </button>
      </form>

      {error && <p className="text-sm rounded-lg px-3 py-2 mb-4" role="alert" style={C.danger}>{error}</p>}

      {result && (
        <div className="rounded-2xl p-5 mb-6 space-y-2" role="status" style={result.ok ? C.success : C.danger}>
          <p className="font-semibold">{result.ok ? 'Erased.' : result.error}</p>
          <ul className="text-sm space-y-1">
            {Object.entries(result.deleted).filter(([, n]) => n > 0).map(([table, n]) => (
              <li key={table}>{labelOf(table)}: {n} deleted</li>
            ))}
            {result.not_done.map((table) => <li key={table}>{labelOf(table)}: not erased</li>)}
            {result.kept.map((k) => <li key={k.table}>{k.label}: {k.count} kept. {k.note}</li>)}
          </ul>
        </div>
      )}

      {found && (
        <div className="space-y-4 mb-6">
          <p className="text-sm text-white">
            {total === 0 ? 'Nothing found for this address.' : `Found ${total} ${total === 1 ? 'item' : 'items'} for this address.`}
          </p>
          {found.sources.map((s) => (
            <section key={s.table} className="rounded-2xl p-5" style={C.card} aria-labelledby={`pd-${s.table}`}>
              <h2 id={`pd-${s.table}`} className="text-white font-semibold text-sm">
                {s.label}: {s.count}
              </h2>
              {s.note && s.count > 0 && <p className="text-xs mt-1" style={C.muted}>{s.note}</p>}
              {s.count > 0 && (
                <table className="w-full text-sm mt-3">
                  <thead>
                    <tr className="text-left" style={C.muted}>
                      <th className="py-1 pr-4 font-medium">Date</th>
                      <th className="py-1 pr-4 font-medium">Name or title</th>
                      <th className="py-1 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.rows.map((row, i) => {
                      const k = keyFields(row)
                      return (
                        <tr key={text(row.id) || i} className="text-white" style={{ borderTop: `1px solid ${ADMIN_COLORS.border}` }}>
                          <td className="py-1 pr-4 whitespace-nowrap">{k.date}</td>
                          <td className="py-1 pr-4 break-words">{k.name}</td>
                          <td className="py-1">{k.status}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </section>
          ))}
          <section className="rounded-2xl p-5" style={C.card}>
            <h2 className="text-white font-semibold text-sm">Copies in the recycle bin: {found.bin.length}</h2>
            {found.bin.length > 0 && (
              <ul className="text-sm mt-2 space-y-1" style={C.muted}>
                {found.bin.map((b) => <li key={b.id}>{b.label} · deleted {day(b.deleted_at)}</li>)}
              </ul>
            )}
          </section>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={exportJson} disabled={busy !== ''}
              className={`flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold disabled:opacity-50 ${FOCUS}`}
              style={C.idle}>
              {busy === 'export' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Download export (JSON)
            </button>
            <button type="button" onClick={() => { setConfirmText(''); setConfirming(true) }}
              disabled={busy !== '' || (toErase.length === 0 && found.bin.length === 0)}
              className={`flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold disabled:opacity-50 ${FOCUS}`}
              style={C.danger}>
              <Trash2 size={14} /> Erase…
            </button>
          </div>
        </div>
      )}

      <section className="rounded-2xl p-5" style={C.warning} aria-labelledby="pd-outside">
        <h2 id="pd-outside" className="font-sans font-semibold text-sm mb-2" style={{ color: ADMIN_COLORS.text }}>Also check outside our database</h2>
        <ul className="text-sm list-disc pl-5 space-y-1">
          {OUTSIDE.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </section>

      {confirming && found && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div role="dialog" aria-modal="true" aria-labelledby="pd-erase-title" className="rounded-2xl p-6 max-w-lg w-full mx-4" style={C.card}>
            <h2 id="pd-erase-title" className="text-white font-bold text-base mb-3">Erase this person&rsquo;s data</h2>
            <p className="text-sm mb-2 text-white">This deletes:</p>
            <ul className="text-sm mb-3 list-disc pl-5 space-y-1" style={C.muted}>
              {toErase.map((s) => <li key={s.table}>{s.label}: {s.count}</li>)}
              {found.bin.length > 0 && <li>Copies in the recycle bin: {found.bin.length}</li>}
            </ul>
            {toKeep.length > 0 && (
              <>
                <p className="text-sm mb-2 text-white">This keeps:</p>
                <ul className="text-sm mb-3 list-disc pl-5 space-y-1" style={C.muted}>
                  {toKeep.map((s) => <li key={s.table}>{s.label}: {s.count}. {s.note}</li>)}
                </ul>
              </>
            )}
            <p className="text-sm mb-3" style={C.muted}>
              Erased entries do not go to the recycle bin and cannot be restored.
            </p>
            <label htmlFor="pd-confirm" className="block text-sm font-semibold text-white mb-1">
              Type the e-mail address again to confirm
            </label>
            <input
              id="pd-confirm"
              type="email"
              autoComplete="off"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className={`w-full h-10 px-3 rounded-lg text-sm mb-5 ${FOCUS}`}
              style={C.input}
            />
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setConfirming(false)} disabled={busy === 'erase'}
                className={`px-5 py-2 rounded-xl text-sm font-semibold ${FOCUS}`} style={C.idle}>
                Cancel
              </button>
              <button type="button" onClick={erase} disabled={busy === 'erase' || !sameAddress(confirmText, found.email)}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-50 ${FOCUS}`}
                style={C.danger}>
                {busy === 'erase' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Erase
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
