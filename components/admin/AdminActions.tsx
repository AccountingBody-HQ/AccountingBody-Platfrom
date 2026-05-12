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
}

interface StatusBadgeProps {
  id: string
  table: string
  currentStatus: string
}

export function StatusBadge({ id, table, currentStatus }: StatusBadgeProps) {
  const [status, setStatus]   = useState(currentStatus ?? 'open')
  const [saving, setSaving]   = useState(false)
  const [open, setOpen]       = useState(false)
  const options = STATUS_OPTIONS[table] ?? []
  const style   = STATUS_STYLE[status] ?? STATUS_STYLE.open

  async function handleSelect(newStatus: string) {
    if (newStatus === status) { setOpen(false); return }
    setSaving(true); setOpen(false)
    try {
      await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', table, id, payload: { status: newStatus } }),
      })
      setStatus(newStatus)
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
        style={{ background: style.bg, color: style.color, border: '1px solid ' + style.color + '30' }}>
        {saving ? <Loader2 size={10} className="animate-spin" /> : null}
        {status.replace('_', ' ')}
        <span style={{ opacity: 0.6 }}>▾</span>
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
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', table, id }),
      })
      onDeleted?.()
      // Reload page to reflect deletion
      window.location.reload()
    } catch { /* silent */ }
    finally { setDeleting(false); setConfirm(false) }
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

// ── Reply Button ──────────────────────────────────────────────────────────────
interface ReplyButtonProps {
  email: string
  subject?: string
  name?: string
}

export function ReplyButton({ email, subject, name }: ReplyButtonProps) {
  if (!email) return null
  const mailtoSubject = subject ? 'Re: ' + subject : 'Re: Your enquiry'
  const mailtoBody = name ? 'Dear ' + name + ',' : ''
  const href = 'mailto:' + email + '?subject=' + encodeURIComponent(mailtoSubject) + '&body=' + encodeURIComponent(mailtoBody)
  return (
    <a href={href}
      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
      style={{ background: 'rgba(37,99,235,0.1)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.2)' }}>
      ✉ Reply
    </a>
  )
}
