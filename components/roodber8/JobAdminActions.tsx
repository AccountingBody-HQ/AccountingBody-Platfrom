'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, X, Star, Trash2, StickyNote } from 'lucide-react'

async function postJobAction(id: string, payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`/api/roodber8/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return res.ok
  } catch {
    return false
  }
}

// ── Approve ──────────────────────────────────────────────────────────────────

export function ApproveJobButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const router = useRouter()

  async function handleApprove() {
    setLoading(true)
    setError(false)
    const ok = await postJobAction(id, { action: 'approve' })
    if (ok) {
      router.refresh()
    } else {
      setError(true)
      setTimeout(() => setError(false), 3000)
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleApprove}
      disabled={loading}
      className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
      style={{ background: 'rgba(212,160,23,0.12)', color: '#D4A017', border: '1px solid rgba(212,160,23,0.3)' }}>
      {loading ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
      {error ? 'Failed — retry' : 'Approve'}
    </button>
  )
}

// ── Reject (inline reason input) ────────────────────────────────────────────

export function RejectJobButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const router = useRouter()

  async function handleReject() {
    if (!reason.trim()) return
    setLoading(true)
    setError(false)
    const ok = await postJobAction(id, { action: 'reject', reason: reason.trim() })
    if (ok) {
      router.refresh()
    } else {
      setError(true)
      setTimeout(() => setError(false), 3000)
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors"
        style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
        <X size={11} /> Reject
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Reason (sent to employer)..."
        className="text-xs rounded-lg px-2.5 py-1.5 focus:outline-none w-48"
        style={{ background: '#111827', border: '1px solid #1f2937', color: '#e2e8f0' }}
      />
      <button
        onClick={handleReject}
        disabled={loading || !reason.trim()}
        className="text-xs font-bold px-2.5 py-1.5 rounded-lg disabled:opacity-40"
        style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
        {loading ? <Loader2 size={11} className="animate-spin" /> : (error ? 'Retry' : 'Confirm')}
      </button>
      <button
        onClick={() => { setOpen(false); setReason('') }}
        className="text-xs px-2 py-1.5 rounded-lg"
        style={{ color: '#475569' }}>
        Cancel
      </button>
    </div>
  )
}

// ── Toggle featured ──────────────────────────────────────────────────────────

export function ToggleFeaturedButton({ id, isFeatured }: { id: string; isFeatured: boolean }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleToggle() {
    setLoading(true)
    const ok = await postJobAction(id, { action: 'toggle_featured' })
    if (ok) router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      title={isFeatured ? 'Remove featured' : 'Mark featured'}
      className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors disabled:opacity-50"
      style={{
        background: isFeatured ? 'rgba(212,160,23,0.15)' : 'rgba(255,255,255,0.04)',
        border: '1px solid ' + (isFeatured ? 'rgba(212,160,23,0.4)' : '#1a2238'),
      }}>
      {loading ? (
        <Loader2 size={12} className="animate-spin" style={{ color: '#D4A017' }} />
      ) : (
        <Star size={12} fill={isFeatured ? '#D4A017' : 'none'} style={{ color: '#D4A017' }} />
      )}
    </button>
  )
}

// ── Notes (saved on blur) ────────────────────────────────────────────────────

export function JobNotesField({ id, initialNotes }: { id: string; initialNotes?: string | null }) {
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    if (notes === (initialNotes ?? '')) return
    setSaving(true)
    setSaved(false)
    const ok = await postJobAction(id, { action: 'update_notes', admin_notes: notes })
    setSaving(false)
    if (ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div className="flex items-center gap-2 mt-2 w-full">
      <input
        value={notes}
        onChange={e => setNotes(e.target.value)}
        onBlur={handleSave}
        placeholder="Internal notes (saved on blur)…"
        className="flex-1 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1a2238', color: '#94a3b8' }}
      />
      {saving && <Loader2 size={11} className="animate-spin" style={{ color: '#475569' }} />}
      {saved && <span className="text-xs font-semibold" style={{ color: '#34d399' }}>Saved ✓</span>}
    </div>
  )
}

// ── Notes toggle (button reveals JobNotesField) ─────────────────────────────

export function NotesToggleButton({ id, initialNotes }: { id: string; initialNotes?: string | null }) {
  const [open, setOpen] = useState(Boolean(initialNotes))

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
        style={{
          background: initialNotes ? 'rgba(96,165,250,0.1)' : 'rgba(255,255,255,0.04)',
          border: '1px solid ' + (initialNotes ? 'rgba(96,165,250,0.3)' : '#1a2238'),
        }}
        title="Internal notes">
        <StickyNote size={12} style={{ color: initialNotes ? '#60a5fa' : '#475569' }} />
      </button>
      {open && <JobNotesField id={id} initialNotes={initialNotes} />}
    </div>
  )
}

// ── Delete (soft — closes the listing) ──────────────────────────────────────

export function DeleteJobButton({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/roodber8/jobs/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
      } else {
        setDeleting(false)
        setConfirm(false)
      }
    } catch {
      setDeleting(false)
      setConfirm(false)
    }
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs" style={{ color: '#f87171' }}>Close listing?</span>
        <button onClick={handleDelete} disabled={deleting}
          className="text-xs font-bold px-2 py-1 rounded-lg"
          style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
          {deleting ? <Loader2 size={10} className="animate-spin inline" /> : 'Yes'}
        </button>
        <button onClick={() => setConfirm(false)} className="text-xs px-2 py-1 rounded-lg" style={{ color: '#475569' }}>
          No
        </button>
      </div>
    )
  }

  return (
    <button onClick={() => setConfirm(true)}
      className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-red-500/10"
      style={{ border: '1px solid #1a2238' }}
      title="Close listing">
      <Trash2 size={12} style={{ color: '#475569' }} />
    </button>
  )
}
