'use client'
import { useState, useRef } from 'react'
import { Trash2, Loader2, ChevronDown, Globe } from 'lucide-react'

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
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const options = STATUS_OPTIONS[table] ?? []
  const style   = error ? STATUS_STYLE.error : (STATUS_STYLE[status] ?? STATUS_STYLE.open)

  function openDropdown() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setDropPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX })
    }
    setOpen(o => !o)
  }

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
        if (table === 'firms_applications' && (newStatus === 'approved' || newStatus === 'rejected')) {
          try {
            const notifyRes = await fetch('/api/roodber8/notify-firm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, status: newStatus }),
            })
            if (notifyRes.ok) {
              setToast({ msg: newStatus === 'approved' ? '✓ Approval email sent to applicant' : '✓ Rejection email sent to applicant', ok: true })
            } else {
              setToast({ msg: '⚠ Status updated but email failed to send', ok: false })
            }
          } catch {
            setToast({ msg: '⚠ Status updated but email failed to send', ok: false })
          }
          setTimeout(() => setToast(null), 4000)
        }
      }
    } catch {
      setError(true)
      setTimeout(() => setError(false), 3000)
    } finally { setSaving(false) }
  }

  return (
    <>
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl"
          style={{
            transform: 'translateX(-50%)',
            background: toast.ok ? 'rgba(16,185,129,0.95)' : 'rgba(245,158,11,0.95)',
            color: '#fff',
            border: toast.ok ? '1px solid #059669' : '1px solid #d97706',
          }}>
          {toast.msg}
        </div>
      )}
      <div className="relative inline-block">
        <button
          ref={btnRef}
          onClick={openDropdown}
          disabled={saving}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
          style={{ background: style.bg, color: style.color, border: '1px solid ' + style.color + '30' }}>
          {saving ? <Loader2 size={10} className="animate-spin" /> : null}
          {error ? 'failed — retry' : status.replace('_', ' ')}
          {!saving && <span style={{ opacity: 0.6 }}>▾</span>}
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="fixed z-50 rounded-xl overflow-hidden shadow-2xl"
              style={{ top: dropPos.top, left: dropPos.left, background: '#0d1424', border: '1px solid #1a2238', minWidth: 140 }}>
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
    </>
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

// ── Firm Application Card (Accordion) ────────────────────────────────────────
interface FirmApplicationCardProps {
  item: {
    id: string
    firm_name?: string
    contact_name?: string
    contact_email?: string
    contact_phone?: string
    website?: string
    firm_type?: string
    status?: string
    message?: string
    years_of_experience?: string
    languages?: string
    notes?: string
    created_at?: string
  }
}

export function FirmApplicationCard({ item }: FirmApplicationCardProps) {
  const [expanded, setExpanded] = useState(false)

  const msg = item.message ?? ''
  const locationMatch = msg.match(/Location: ([^\n]+)/)
  const specialismsMatch = msg.match(/Specialisms: ([^\n]+)/)
  const qualsMatch = msg.match(/\[(FIRM|INDEPENDENT)\]\s*Qualifications:\s*([^.]+)/)
  const qualsText = qualsMatch ? qualsMatch[2].trim() : null
  const aboutText = msg
    .replace(/Location: [^\n]+\n?/g, '')
    .replace(/Specialisms: [^\n]+\n?/g, '')
    .replace(/\[(FIRM|INDEPENDENT)\]\s*Qualifications:[^.]*\.?/g, '')
    .replace(/By submitting this application.*?acceptance into the network\.?/gi, '')
    .trim()
  const quals = qualsText ? qualsText.split(',').map((q: string) => q.trim()).filter(Boolean) : []
  const specs = specialismsMatch ? specialismsMatch[1].split(',').map((s: string) => s.trim()).filter(Boolean) : []

  return (
    <div className="border-b last:border-b-0 transition-colors hover:bg-white/[0.01]" style={{ borderColor: '#1a2238' }}>
      {/* ── Collapsed header — always visible ── */}
      <div className="px-6 py-4 flex items-center gap-4">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
          style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.25)' }}>
          {(item.firm_name ?? item.contact_name ?? '?')[0].toUpperCase()}
        </div>

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white font-bold text-sm">{item.firm_name ?? '—'}</p>
            {item.firm_type && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>
                {item.firm_type}
              </span>
            )}
            <StatusBadge id={item.id} table="firms_applications" currentStatus={item.status ?? 'pending'} />
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs flex-wrap" style={{ color: '#475569' }}>
            <span style={{ color: '#94a3b8' }}>{item.contact_name ?? '—'}</span>
            <a href={'mailto:' + item.contact_email} style={{ color: '#60a5fa' }}>{item.contact_email ?? '—'}</a>
            {locationMatch && <span>{locationMatch[1]}</span>}
            <span>{item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <ReplyButton email={item.contact_email ?? ''} name={item.contact_name} subject={'Re: Your application — ' + (item.firm_name ?? '')} />
          <DeleteButton id={item.id} table="firms_applications" />
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #1a2238' }}
            aria-label={expanded ? 'Collapse' : 'Expand'}>
            <ChevronDown size={14} style={{ color: '#475569', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
          </button>
        </div>
      </div>

      {/* ── Expanded details ── */}
      {expanded && (
        <div className="px-6 pb-6 space-y-5" style={{ paddingLeft: '64px' }}>

          {/* Detail grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {locationMatch && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Location</p>
                <p className="text-sm" style={{ color: '#cbd5e1' }}>{locationMatch[1]}</p>
              </div>
            )}
            {(item.years_of_experience || item.languages) && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Experience / Languages</p>
                <p className="text-sm" style={{ color: '#cbd5e1' }}>
                  {[item.years_of_experience, item.languages].filter(Boolean).join(' · ')}
                </p>
              </div>
            )}
            {item.contact_phone && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Phone</p>
                <p className="text-sm" style={{ color: '#cbd5e1' }}>{item.contact_phone}</p>
              </div>
            )}
            {item.website && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Website</p>
                <a href={item.website} target="_blank" rel="noopener noreferrer"
                  className="text-sm flex items-center gap-1 hover:opacity-80" style={{ color: '#60a5fa' }}>
                  <Globe size={11} /> {item.website}
                </a>
              </div>
            )}
          </div>

          {/* Qualifications chips */}
          {quals.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#475569' }}>Qualifications</p>
              <div className="flex flex-wrap gap-1.5">
                {quals.map((q: string) => (
                  <span key={q} className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                    style={{ background: 'rgba(16,185,129,0.08)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>
                    {q}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Specialisms chips */}
          {specs.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#475569' }}>Specialisms</p>
              <div className="flex flex-wrap gap-1.5">
                {specs.map((s: string) => (
                  <span key={s} className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                    style={{ background: 'rgba(37,99,235,0.08)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.2)' }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* About */}
          {aboutText && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>About</p>
              <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>{aboutText}</p>
            </div>
          )}

          {/* Internal notes */}
          <div className="pt-3 border-t" style={{ borderColor: '#1a2238' }}>
            <NotesField id={item.id} table="firms_applications" initialNotes={item.notes} />
          </div>

        </div>
      )}
    </div>
  )
}
