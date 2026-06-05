'use client'
import { useState } from 'react'
import { Trash2, Loader2 } from 'lucide-react'

// ── Status Update Dropdown ────────────────────────────────────────────────────
const STATUS_OPTIONS: Record<string, string[]> = {
  help_requests:       ['open', 'in_progress', 'resolved', 'closed'],
  contact_submissions: ['open', 'in_progress', 'resolved', 'closed'],
  firms_applications:  ['pending', 'under_review', 'approved', 'rejected'],
  email_subscribers:   ['subscribed', 'unsubscribed'],
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  open:         { bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa' },
  in_progress:  { bg: 'rgba(245,158,11,0.12)',  color: '#fbbf24' },
  resolved:     { bg: 'rgba(16,185,129,0.12)',  color: '#34d399' },
  closed:       { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8' },
  pending:      { bg: 'rgba(245,158,11,0.12)',  color: '#fbbf24' },
  under_review: { bg: 'rgba(139,92,246,0.12)',  color: '#a78bfa' },
  approved:     { bg: 'rgba(16,185,129,0.12)',  color: '#34d399' },
  rejected:     { bg: 'rgba(239,68,68,0.12)',   color: '#f87171' },
  subscribed:   { bg: 'rgba(16,185,129,0.12)',  color: '#34d399' },
  unsubscribed: { bg: 'rgba(239,68,68,0.12)',   color: '#f87171' },
  error:        { bg: 'rgba(239,68,68,0.12)',   color: '#f87171' },
}

interface StatusBadgeProps {
  id: string
  table: string
  currentStatus: string
}

export function StatusBadge({ id, table, currentStatus }: StatusBadgeProps) {
  const [status, setStatus]   = useState(currentStatus ?? 'open')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(false)
  const [open, setOpen]       = useState(false)
  const options = STATUS_OPTIONS[table] ?? []
  const style   = error ? STATUS_STYLE.error : (STATUS_STYLE[status] ?? STATUS_STYLE.open)

  async function handleSelect(newStatus: string) {
    if (newStatus === status) { setOpen(false); return }
    setSaving(true); setOpen(false); setError(false)
    try {
      const res = await fetch('/api/roodber8/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', table, id, payload: { status: newStatus } }),
      })
      if (!res.ok) {
        setError(true)
        setTimeout(() => setError(false), 3000)
      } else {
        setStatus(newStatus)
      }
    } catch {
      setError(true)
      setTimeout(() => setError(false), 3000)
    } finally { setSaving(false) }
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
        style={{ background: style.bg, color: style.color, border: '1px solid ' + style.color + '30' }}>
        {saving ? <Loader2 size={10} className="animate-spin" /> : null}
        {error ? 'failed — retry' : status.replace('_', ' ')}
        {!saving && <span style={{ opacity: 0.6 }}>▾</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 rounded-xl overflow-hidden shadow-2xl"
            style={{ background: '#0d1424', border: '1px solid #1a2238', minWidth: 140 }}>
            {options.map(opt => {
              const s = STATUS_STYLE[opt] ?? STATUS_STYLE.open
              return (
                <button key={opt} onClick={() => handleSelect(opt)}
                  className="w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2 transition-colors hover:bg-white/5"
                  style={{ color: s.color }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color }} />
                  {opt.replace('_', ' ')}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Delete Button ─────────────────────────────────────────────────────────────
interface DeleteButtonProps {
  id: string
  table: string
  label?: string
  onDeleted?: () => void
}

export function DeleteButton({ id, table, label = 'Delete', onDeleted }: DeleteButtonProps) {
  const [confirm, setConfirm]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]       = useState(false)

  async function handleDelete() {
    setDeleting(true); setError(false)
    try {
      const res = await fetch('/api/roodber8/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', table, id }),
      })
      if (!res.ok) {
        setError(true)
        setTimeout(() => { setError(false); setConfirm(false) }, 3000)
      } else {
        onDeleted?.()
        window.location.reload()
      }
    } catch {
      setError(true)
      setTimeout(() => { setError(false); setConfirm(false) }, 3000)
    } finally { setDeleting(false) }
  }

  if (error) {
    return (
      <span className="text-xs font-semibold px-2 py-1 rounded-lg"
        style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
        Failed — try again
      </span>
    )
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs" style={{ color: '#f87171' }}>Sure?</span>
        <button onClick={handleDelete} disabled={deleting}
          className="text-xs font-bold px-2 py-1 rounded-lg"
          style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
          {deleting ? <Loader2 size={10} className="animate-spin inline" /> : 'Yes'}
        </button>
        <button onClick={() => setConfirm(false)}
          className="text-xs px-2 py-1 rounded-lg"
          style={{ color: '#475569' }}>No</button>
      </div>
    )
  }

  return (
    <button onClick={() => setConfirm(true)}
      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors hover:bg-red-500/10"
      style={{ color: '#475569' }}>
      <Trash2 size={11} />
      {label}
    </button>
  )
}

// ── Notes Field ──────────────────────────────────────────────────────────────
interface NotesFieldProps {
  id: string
  table: string
  initialNotes?: string | null
}

export function NotesField({ id, table, initialNotes }: NotesFieldProps) {
  const [notes, setNotes]   = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState(false)

  async function handleSave() {
    if (notes === (initialNotes ?? '')) return
    setSaving(true); setSaved(false); setError(false)
    try {
      const res = await fetch('/api/roodber8/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_notes', table, id, payload: { notes } }),
      })
      if (!res.ok) {
        setError(true)
        setTimeout(() => setError(false), 3000)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch {
      setError(true)
      setTimeout(() => setError(false), 3000)
    } finally { setSaving(false) }
  }

  return (
    <div className="mt-3 w-full">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#334155' }}>
          Internal Notes
        </span>
        {saved && <span className="text-xs font-semibold" style={{ color: '#34d399' }}>Saved ✓</span>}
        {error && <span className="text-xs font-semibold" style={{ color: '#f87171' }}>Failed — try again</span>}
      </div>
      <div className="flex gap-2 items-start">
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={handleSave}
          placeholder="Add internal notes (saved on blur)…"
          rows={2}
          className="flex-1 rounded-xl px-3 py-2 text-xs resize-none focus:outline-none"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid #1a2238',
            color: '#94a3b8',
            lineHeight: 1.6,
          }}
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-2 rounded-xl text-xs font-bold shrink-0"
          style={{ background: '#0C1A3D', color: '#D4A017', border: '1px solid #D4A017' }}>
          {saving ? <Loader2 size={10} className="animate-spin inline" /> : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ── Reply Button ──────────────────────────────────────────────────────────────
interface ReplyButtonProps {
  email: string
  subject?: string
  name?: string
}
export function ReplyButton({ email, subject, name }: ReplyButtonProps) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  if (!email) return null
  const defaultSubject = subject || 'Re: Your enquiry'

  const handleSend = async () => {
    if (!message.trim()) return
    setStatus('loading')
    try {
      const res = await fetch('/api/roodber8/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: email, name, subject: defaultSubject, message }),
      })
      if (!res.ok) throw new Error('Failed')
      setStatus('sent')
      setTimeout(() => { setOpen(false); setStatus('idle'); setMessage('') }, 2000)
    } catch {
      setStatus('error')
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
        style={{ background: 'rgba(37,99,235,0.1)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.2)' }}>
        ✉ Reply
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: '#0d1424', border: '1px solid #1a2238' }}>
            <div className="flex items-center justify-between">
              <p className="text-white font-bold text-sm">Reply to {name || email}</p>
              <button onClick={() => { setOpen(false); setStatus('idle'); setMessage('') }} className="text-slate-400 hover:text-white text-lg leading-none">×</button>
            </div>
            <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(255,255,255,0.04)', color: '#94a3b8' }}>
              <span className="font-semibold">To:</span> {email}<br/>
              <span className="font-semibold">Subject:</span> {defaultSubject}
            </div>
            <textarea
              rows={7}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Type your reply here..."
              className="w-full rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', border: '1px solid #1a2238' }}
            />
            {status === 'error' && <p className="text-red-400 text-xs">Failed to send. Please try again.</p>}
            {status === 'sent' && <p className="text-green-400 text-xs">✓ Reply sent successfully.</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setOpen(false); setStatus('idle'); setMessage('') }}
                className="text-xs font-semibold px-4 py-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                Cancel
              </button>
              <button onClick={handleSend} disabled={status === 'loading' || !message.trim()}
                className="text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
                style={{ background: '#2563eb', color: '#fff' }}>
                {status === 'loading' ? 'Sending...' : 'Send Reply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
