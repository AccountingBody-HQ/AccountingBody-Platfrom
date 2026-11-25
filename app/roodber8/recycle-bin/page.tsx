'use client'

// Admin recycle bin: everything the admin area deleted, or a Course Factory
// save replaced, in the last 90 days, with a Restore button for each item.

import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/lib/admin-fetch'
import { CONFIRM_TEXT } from '@/lib/question-publish-checks'
import { ArchiveRestore, Loader2, RotateCcw } from 'lucide-react'

const C = {
  page:   { background: '#080d1a', minHeight: '100vh' },
  card:   { background: '#0d1424', border: '1px solid #1a2238', borderRadius: 16 },
  idle:   { background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#cbd5e1' },
  danger: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' },
  success:{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' },
  muted:  { color: '#94a3b8' },
}

interface BinItem {
  id:          string
  kind:        string
  reason:      string
  label:       string
  row_count:   number
  deleted_at:  string
  expires_at:  string
  restored_at: string | null
}

const KIND_WORDS: Record<string, string> = {
  course:                'Course',
  course_chapter:        'Course chapter',
  course_lesson:         'Course lesson',
  course_lesson_article: 'Article link in a lesson',
  article:               'Article',
  question_set:          'Question set',
  question:              'Question',
  job_provider:          'Job provider',
  studio_reference:      'Studio reference',
  form_entry:            'Form entry',
}

function when(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.toLocaleString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} UTC`
}

function day(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })
}

export default function RecycleBinPage() {
  const [items, setItems]         = useState<BinItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [confirming, setConfirming] = useState<BinItem | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [message, setMessage]     = useState('')
  const [restoreError, setRestoreError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/roodber8/recycle-bin', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not read the recycle bin.')
      setItems(Array.isArray(data.items) ? data.items : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the recycle bin.')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function restore(item: BinItem) {
    setRestoring(true)
    setRestoreError('')
    setMessage('')
    try {
      const res = await adminFetch('/api/roodber8/recycle-bin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'restore', id: item.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setRestoreError(data.error ?? 'Restore failed. Nothing was changed.')
      } else {
        setMessage(`Restored "${item.label}".`)
        setRestoreError([data.restoreNote, data.unlinkWarning, data.linkWarning, data.linkNote].filter(Boolean).join(' '))
        await load()
      }
    } catch {
      setRestoreError('Restore failed. Nothing was changed.')
    }
    setRestoring(false)
    setConfirming(null)
  }

  return (
    <div className="p-8 max-w-4xl" style={C.page}>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(212,160,23,0.12)' }}>
          <ArchiveRestore size={20} style={{ color: '#C9982A' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Recycle bin</h1>
          <p className="text-sm" style={C.muted}>
            Anything deleted in the admin area, or replaced by a Course Factory save, is kept here for 90 days.
          </p>
        </div>
      </div>

      {message && <p className="text-sm rounded-lg px-3 py-2 mb-4" role="status" style={C.success}>{message}</p>}
      {restoreError && <p className="text-sm rounded-lg px-3 py-2 mb-4" role="alert" style={C.danger}>{restoreError}</p>}
      {error && <p className="text-sm rounded-lg px-3 py-2 mb-4" role="alert" style={C.danger}>{error}</p>}

      {loading ? (
        <p className="flex items-center gap-2 text-sm" style={C.muted}>
          <Loader2 size={14} className="animate-spin" /> Loading…
        </p>
      ) : !error && items.length === 0 ? (
        <div className="rounded-2xl p-6 text-sm" style={{ ...C.card, ...C.muted }}>
          The recycle bin is empty. Anything deleted in the admin area is kept here for 90 days.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl p-5 flex flex-wrap items-start justify-between gap-4" style={C.card}>
              <div className="min-w-0 space-y-1">
                <p className="text-white font-semibold break-words">{item.label}</p>
                <p className="text-xs" style={C.muted}>
                  {KIND_WORDS[item.kind] ?? item.kind}
                  {' · '}
                  {item.reason === 'course_save' ? 'Replaced by a course save' : 'Deleted'} {when(item.deleted_at)}
                  {' · '}
                  {item.row_count} {item.row_count === 1 ? 'row' : 'rows'}
                </p>
                <p className="text-xs" style={C.muted}>
                  {item.restored_at ? `Restored ${when(item.restored_at)}` : `Kept until ${day(item.expires_at)}`}
                </p>
              </div>
              {!item.restored_at && (
                <button
                  onClick={() => { setRestoreError(''); setMessage(''); setConfirming(item) }}
                  className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ background: '#0C1A3D', color: '#fff', border: '1px solid #C9982A' }}
                >
                  <RotateCcw size={14} /> Restore
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div role="dialog" aria-modal="true" aria-labelledby="restore-title" className="rounded-2xl p-6 max-w-md w-full mx-4" style={C.card}>
            <h2 id="restore-title" className="text-white font-bold text-base mb-2">Restore &ldquo;{confirming.label}&rdquo;</h2>
            <p className="text-sm mb-6" style={C.muted}>Put this back? {CONFIRM_TEXT}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirming(null)} disabled={restoring}
                className="px-5 py-2 rounded-xl text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={C.idle}>
                Cancel
              </button>
              <button onClick={() => restore(confirming)} disabled={restoring}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ background: '#C9982A', color: '#0C1A3D' }}>
                {restoring ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
