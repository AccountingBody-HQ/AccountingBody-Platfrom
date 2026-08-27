/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Trash2, Edit3, X, Plus, ChevronDown,
  ChevronUp, AlertTriangle, Loader2, BookOpen, Save,
  Eye, EyeOff
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface QuestionSet {
  id: string
  title: string
  slug: string
  excerpt?: string
  difficulty?: string
  topic?: string
  exam_body?: string[]
  question_type?: string
  status?: string
  show_on_sites?: string[]
  canonical_owner?: string
  seo_title?: string
  seo_description?: string
  created_at?: string
  updated_at?: string
}

interface Question {
  id: string
  set_id: string
  question_order: number
  type: string
  question_text: string
  option_a?: string
  option_b?: string
  option_c?: string
  option_d?: string
  correct_index?: number | null
  explanation?: string | null
  writing_model_answer?: string | null
  writing_explanation?: string | null
  primary_topic?: string
  difficulty?: string
  time_target_minutes?: number
  points?: number
}

// ── Style constants ───────────────────────────────────────────────────────────

const C = {
  card:    { background: '#0d1424', border: '1px solid #1a2238', borderRadius: 16 },
  input:   { background: '#111827', border: '1px solid #1f2937', borderRadius: 10, color: '#fff' },
  active:  { background: 'rgba(212,160,23,0.12)', border: '1px solid #D4A017', color: '#fff' },
  idle:    { background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#64748b' },
  danger:  { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' },
  success: { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' },
}

const DIFF_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  beginner:     { bg: 'rgba(16,185,129,0.08)',  color: '#10b981', border: 'rgba(16,185,129,0.2)'  },
  intermediate: { bg: 'rgba(245,158,11,0.08)',  color: '#f59e0b', border: 'rgba(245,158,11,0.2)'  },
  advanced:     { bg: 'rgba(239,68,68,0.08)',   color: '#ef4444', border: 'rgba(239,68,68,0.2)'   },
}

const OPTION_LABELS = ['A', 'B', 'C', 'D']
const DIFFICULTIES  = ['beginner', 'intermediate', 'advanced']
const QUESTION_TYPES = [
  { value: 'multiple-choice', label: 'MCQ' },
  { value: 'scenario',        label: 'Scenario' },
  { value: 'writing',         label: 'Writing' },
]

// ── Inline field input ────────────────────────────────────────────────────────

function FieldInput({
  label, value, onChange, multiline = false, rows = 3,
}: {
  label: string; value: string; onChange: (v: string) => void
  multiline?: boolean; rows?: number
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>{label}</p>
      {multiline ? (
        <textarea
          rows={rows}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 text-sm resize-none focus:outline-none"
          style={C.input}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 text-sm focus:outline-none"
          style={C.input}
        />
      )}
    </div>
  )
}

// ── Confirmation modal ────────────────────────────────────────────────────────

function ConfirmModal({
  title, message, onConfirm, onCancel, loading,
}: {
  title: string; message: string
  onConfirm: () => void; onCancel: () => void; loading?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="rounded-2xl p-6 max-w-md w-full mx-4" style={C.card}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(239,68,68,0.12)' }}>
            <AlertTriangle size={18} style={{ color: '#ef4444' }} />
          </div>
          <h3 className="text-white font-bold text-base">{title}</h3>
        </div>
        <p className="text-sm mb-6" style={{ color: '#64748b' }}>{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={loading}
            className="px-5 py-2 rounded-xl text-sm font-semibold"
            style={C.idle}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold"
            style={{ background: '#dc2626', color: '#fff' }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Question editor row ───────────────────────────────────────────────────────

function QuestionRow({
  question, index, setId, onUpdated, onDeleted,
}: {
  question: Question; index: number; setId: string
  onUpdated: (q: Question) => void; onDeleted: (id: string) => void
}) {
  const [expanded, setExpanded]       = useState(false)
  const [editing, setEditing]         = useState(false)
  const [showExpl, setShowExpl]       = useState(false)
  const [saving, setSaving]           = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [confirmDel, setConfirmDel]   = useState(false)
  const [error, setError]             = useState('')

  // Draft state
  const [draft, setDraft] = useState<Question>({ ...question })

  const isMCQ = draft.type === 'multiple-choice' || draft.type === 'scenario'

  function resetDraft() {
    setDraft({ ...question })
    setEditing(false)
    setError('')
  }

  async function handleSave() {
    setSaving(true); setError('')
    try {
      const fields: Record<string, any> = {
        question_text:        draft.question_text,
        primary_topic:        draft.primary_topic ?? '',
        difficulty:           draft.difficulty ?? 'intermediate',
        time_target_minutes:  draft.time_target_minutes ?? 2,
        points:               draft.points ?? 2,
      }
      if (isMCQ) {
        fields.option_a      = draft.option_a ?? ''
        fields.option_b      = draft.option_b ?? ''
        fields.option_c      = draft.option_c ?? ''
        fields.option_d      = draft.option_d ?? ''
        fields.correct_index = draft.correct_index ?? 0
        fields.explanation   = draft.explanation ?? ''
      }
      if (draft.type === 'writing') {
        fields.writing_model_answer = draft.writing_model_answer ?? ''
        fields.writing_explanation  = draft.writing_explanation ?? ''
      }

      const res = await fetch(`/api/roodber8/questions/${setId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_question', questionId: question.id, fields }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      onUpdated({ ...question, ...draft })
      setEditing(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true); setError('')
    try {
      const res = await fetch(`/api/roodber8/questions/${setId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_question', questionId: question.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      onDeleted(question.id)
    } catch (e: any) {
      setError(e.message)
      setConfirmDel(false)
    } finally {
      setDeleting(false)
    }
  }

  const diff = DIFF_STYLE[draft.difficulty ?? ''] ?? DIFF_STYLE.intermediate
  const options = [draft.option_a, draft.option_b, draft.option_c, draft.option_d]
  const correctLabel = typeof draft.correct_index === 'number'
    ? OPTION_LABELS[draft.correct_index] : '—'

  return (
    <>
      {confirmDel && (
        <ConfirmModal
          title="Delete this question?"
          message="This question will be permanently removed from the set. This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setConfirmDel(false)}
          loading={deleting}
        />
      )}

      <div className="border-b last:border-b-0" style={{ borderColor: '#1a2238' }}>
        {/* ── Row header ── */}
        <div className="px-5 py-4 flex items-start gap-3">
          {/* Number */}
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5"
            style={{ background: '#0C1A3D', color: '#D4A017', border: '1px solid #D4A017' }}>
            {index + 1}
          </span>

          {/* Stem preview */}
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(v => !v)}>
            <p className="text-white text-sm font-medium leading-relaxed">
              {expanded ? draft.question_text : (draft.question_text?.slice(0, 140) + (draft.question_text?.length > 140 ? '…' : ''))}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {draft.primary_topic && (
                <span className="text-xs" style={{ color: '#475569' }}>{draft.primary_topic}</span>
              )}
              <span className="text-xs font-semibold px-2 py-0.5 rounded capitalize"
                style={{ background: diff.bg, color: diff.color, border: `1px solid ${diff.border}` }}>
                {draft.difficulty}
              </span>
              {isMCQ && (
                <span className="text-xs font-bold px-2 py-0.5 rounded"
                  style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                  ✓ {correctLabel}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setExpanded(v => !v)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: '#475569' }}>
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            <button
              onClick={() => { setExpanded(true); setEditing(true) }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(37,99,235,0.1)', color: '#3b82f6', border: '1px solid rgba(37,99,235,0.2)' }}>
              <Edit3 size={11} /> Edit
            </button>
            <button onClick={() => setConfirmDel(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              <Trash2 size={11} />
            </button>
          </div>
        </div>

        {/* ── Expanded content ── */}
        {expanded && (
          <div className="px-5 pb-5">
            {error && (
              <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={C.danger}>{error}</div>
            )}

            {/* VIEW MODE */}
            {!editing && (
              <div className="space-y-3">
                {isMCQ && (
                  <div className="space-y-1.5">
                    {options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs"
                        style={oi === draft.correct_index
                          ? { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }
                          : { background: 'rgba(255,255,255,0.02)', border: '1px solid #1f2937', color: '#475569' }}>
                        <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0"
                          style={oi === draft.correct_index
                            ? { background: '#10b981', color: '#fff' }
                            : { background: 'rgba(255,255,255,0.06)', color: '#334155' }}>
                          {oi === draft.correct_index ? '✓' : OPTION_LABELS[oi]}
                        </span>
                        {opt || <span style={{ color: '#334155' }}>—</span>}
                      </div>
                    ))}
                  </div>
                )}

                {draft.type === 'writing' && draft.writing_model_answer && (
                  <div className="rounded-xl p-3" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#10b981' }}>Model Answer</p>
                    <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>
                      {draft.writing_model_answer.slice(0, 300)}{draft.writing_model_answer.length > 300 ? '…' : ''}
                    </p>
                  </div>
                )}

                {draft.explanation && (
                  <div>
                    <button onClick={() => setShowExpl(v => !v)}
                      className="flex items-center gap-1.5 text-xs font-semibold py-1"
                      style={{ color: '#475569' }}>
                      {showExpl ? <EyeOff size={12} /> : <Eye size={12} />}
                      {showExpl ? 'Hide' : 'Show'} explanation
                    </button>
                    {showExpl && (
                      <p className="text-xs leading-relaxed mt-2 whitespace-pre-line"
                        style={{ color: '#334155' }}>
                        {draft.explanation}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* EDIT MODE */}
            {editing && (
              <div className="space-y-4">
                <FieldInput
                  label="Question stem"
                  value={draft.question_text}
                  onChange={v => setDraft(d => ({ ...d, question_text: v }))}
                  multiline rows={5}
                />

                {isMCQ && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#475569' }}>
                      Options — click letter to mark correct
                    </p>
                    <div className="space-y-2">
                      {(['option_a','option_b','option_c','option_d'] as const).map((key, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <button
                            onClick={() => setDraft(d => ({ ...d, correct_index: oi }))}
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all"
                            style={oi === draft.correct_index
                              ? { background: '#10b981', color: '#fff' }
                              : { background: 'rgba(255,255,255,0.06)', color: '#475569', border: '1px solid #1f2937' }}>
                            {oi === draft.correct_index ? '✓' : OPTION_LABELS[oi]}
                          </button>
                          <input
                            type="text"
                            value={draft[key] ?? ''}
                            onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                            className="flex-1 px-3 py-2 text-sm focus:outline-none"
                            style={oi === draft.correct_index
                              ? { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, color: '#fff' }
                              : C.input}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isMCQ && (
                  <FieldInput
                    label="Explanation"
                    value={draft.explanation ?? ''}
                    onChange={v => setDraft(d => ({ ...d, explanation: v }))}
                    multiline rows={6}
                  />
                )}

                {draft.type === 'writing' && (
                  <>
                    <FieldInput
                      label="Model Answer"
                      value={draft.writing_model_answer ?? ''}
                      onChange={v => setDraft(d => ({ ...d, writing_model_answer: v }))}
                      multiline rows={6}
                    />
                    <FieldInput
                      label="Teaching Notes"
                      value={draft.writing_explanation ?? ''}
                      onChange={v => setDraft(d => ({ ...d, writing_explanation: v }))}
                      multiline rows={4}
                    />
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Difficulty</p>
                    <div className="flex gap-2">
                      {DIFFICULTIES.map(d => (
                        <button key={d} onClick={() => setDraft(prev => ({ ...prev, difficulty: d }))}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                          style={draft.difficulty === d ? C.active : C.idle}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <FieldInput
                    label="Primary Topic"
                    value={draft.primary_topic ?? ''}
                    onChange={v => setDraft(d => ({ ...d, primary_topic: v }))}
                  />
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold"
                    style={{ background: '#059669', color: '#fff' }}>
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    Save Changes
                  </button>
                  <button onClick={resetDraft} disabled={saving}
                    className="px-5 py-2 rounded-xl text-sm font-semibold"
                    style={C.idle}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ── Add question form ─────────────────────────────────────────────────────────

function AddQuestionForm({
  setId, onAdded, onClose,
}: {
  setId: string; onAdded: (q: Question) => void; onClose: () => void
}) {
  const [type, setType]             = useState('multiple-choice')
  const [questionText, setQText]    = useState('')
  const [optionA, setOptA]          = useState('')
  const [optionB, setOptB]          = useState('')
  const [optionC, setOptC]          = useState('')
  const [optionD, setOptD]          = useState('')
  const [correctIndex, setCorrect]  = useState(0)
  const [explanation, setExpl]      = useState('')
  const [modelAnswer, setModel]     = useState('')
  const [teachingNotes, setNotes]   = useState('')
  const [primaryTopic, setTopic]    = useState('')
  const [difficulty, setDiff]       = useState('intermediate')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  const isMCQ = type === 'multiple-choice' || type === 'scenario'

  async function handleSave() {
    if (!questionText.trim()) { setError('Question stem is required'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/roodber8/questions/${setId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type, question_text: questionText,
          option_a: optionA, option_b: optionB,
          option_c: optionC, option_d: optionD,
          correct_index: correctIndex,
          explanation, writing_model_answer: modelAnswer,
          writing_explanation: teachingNotes,
          primary_topic: primaryTopic, difficulty,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add question')
      onAdded(data.question)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border mt-4" style={C.card}>
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#1a2238' }}>
        <p className="text-white font-bold text-sm">Add Question Manually</p>
        <button onClick={onClose} style={{ color: '#475569' }}><X size={16} /></button>
      </div>
      <div className="p-5 space-y-4">
        {error && (
          <div className="rounded-xl px-4 py-3 text-sm" style={C.danger}>{error}</div>
        )}

        {/* Type */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#475569' }}>Question Type</p>
          <div className="flex gap-2">
            {QUESTION_TYPES.map(t => (
              <button key={t.value} onClick={() => setType(t.value)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                style={type === t.value ? C.active : C.idle}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <FieldInput label="Question Stem" value={questionText} onChange={setQText} multiline rows={5} />

        {isMCQ && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#475569' }}>
              Options — click letter to mark correct
            </p>
            <div className="space-y-2">
              {[
                { key: 'A', val: optionA, set: setOptA, idx: 0 },
                { key: 'B', val: optionB, set: setOptB, idx: 1 },
                { key: 'C', val: optionC, set: setOptC, idx: 2 },
                { key: 'D', val: optionD, set: setOptD, idx: 3 },
              ].map(({ key, val, set, idx }) => (
                <div key={key} className="flex items-center gap-2">
                  <button onClick={() => setCorrect(idx)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={correctIndex === idx
                      ? { background: '#10b981', color: '#fff' }
                      : { background: 'rgba(255,255,255,0.06)', color: '#475569', border: '1px solid #1f2937' }}>
                    {correctIndex === idx ? '✓' : key}
                  </button>
                  <input type="text" value={val} onChange={e => set(e.target.value)}
                    placeholder={`Option ${key}`}
                    className="flex-1 px-3 py-2 text-sm focus:outline-none placeholder-slate-600"
                    style={correctIndex === idx
                      ? { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, color: '#fff' }
                      : C.input} />
                </div>
              ))}
            </div>
          </div>
        )}

        {isMCQ && (
          <FieldInput label="Explanation" value={explanation} onChange={setExpl} multiline rows={5} />
        )}

        {type === 'writing' && (
          <>
            <FieldInput label="Model Answer" value={modelAnswer} onChange={setModel} multiline rows={6} />
            <FieldInput label="Teaching Notes" value={teachingNotes} onChange={setNotes} multiline rows={4} />
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Difficulty</p>
            <div className="flex gap-2">
              {DIFFICULTIES.map(d => (
                <button key={d} onClick={() => setDiff(d)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize"
                  style={difficulty === d ? C.active : C.idle}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <FieldInput label="Primary Topic" value={primaryTopic} onChange={setTopic} />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: '#D4A017', color: '#0C1A3D' }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Add Question
          </button>
          <button onClick={onClose} disabled={saving}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={C.idle}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Set metadata editor ───────────────────────────────────────────────────────

function SetMetadataEditor({
  set, setId, onUpdated, onClose,
}: {
  set: QuestionSet; setId: string
  onUpdated: (s: QuestionSet) => void; onClose: () => void
}) {
  const [title, setTitle]       = useState(set.title)
  const [topic, setTopic]       = useState(set.topic ?? '')
  const [excerpt, setExcerpt]   = useState(set.excerpt ?? '')
  const [difficulty, setDiff]   = useState(set.difficulty ?? 'intermediate')
  const [status, setStatus]     = useState(set.status ?? 'published')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function handleSave() {
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/roodber8/questions/${setId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_set',
          fields: { title, topic, excerpt, difficulty, status },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      onUpdated({ ...set, title, topic, excerpt, difficulty, status })
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border mb-6" style={C.card}>
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#1a2238' }}>
        <p className="text-white font-bold text-sm">Edit Set Metadata</p>
        <button onClick={onClose} style={{ color: '#475569' }}><X size={16} /></button>
      </div>
      <div className="p-5 space-y-4">
        {error && (
          <div className="rounded-xl px-4 py-3 text-sm" style={C.danger}>{error}</div>
        )}
        <FieldInput label="Title" value={title} onChange={setTitle} />
        <FieldInput label="Topic" value={topic} onChange={setTopic} />
        <FieldInput label="Excerpt" value={excerpt} onChange={setExcerpt} multiline rows={3} />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Difficulty</p>
            <div className="flex gap-2">
              {DIFFICULTIES.map(d => (
                <button key={d} onClick={() => setDiff(d)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize"
                  style={difficulty === d ? C.active : C.idle}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Status</p>
            <div className="flex gap-2">
              {['published', 'draft'].map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize"
                  style={status === s
                    ? s === 'published' ? C.success : C.active
                    : C.idle}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: '#059669', color: '#fff' }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save Metadata
          </button>
          <button onClick={onClose} disabled={saving}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={C.idle}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function QuestionSetManagerPage() {
  const params    = useParams()
  const router    = useRouter()
  const setId     = params.setId as string

  const [set, setSet]               = useState<QuestionSet | null>(null)
  const [questions, setQuestions]   = useState<Question[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [editingMeta, setEditingMeta]   = useState(false)
  const [showAddForm, setShowAddForm]   = useState(false)
  const [confirmDelSet, setConfirmDelSet] = useState(false)
  const [deletingSet, setDeletingSet]   = useState(false)
  const [deleteSetError, setDeleteSetError] = useState('')

  const fetchSet = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/roodber8/questions/${setId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setSet(data.set)
      setQuestions(data.questions)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [setId])

  useEffect(() => { fetchSet() }, [fetchSet])

  async function handleDeleteSet() {
    setDeletingSet(true); setDeleteSetError('')
    try {
      const res = await fetch(`/api/roodber8/questions/${setId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_set' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      router.push('/roodber8/questions')
    } catch (e: any) {
      setDeleteSetError(e.message)
      setConfirmDelSet(false)
    } finally {
      setDeletingSet(false)
    }
  }

  function handleQuestionUpdated(updated: Question) {
    setQuestions(qs => qs.map(q => q.id === updated.id ? updated : q))
  }

  function handleQuestionDeleted(id: string) {
    setQuestions(qs => qs.filter(q => q.id !== id))
  }

  function handleQuestionAdded(q: Question) {
    setQuestions(qs => [...qs, q])
    setShowAddForm(false)
  }

  const diff = DIFF_STYLE[set?.difficulty ?? ''] ?? DIFF_STYLE.intermediate

  // ── Loading ──
  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <Loader2 size={28} className="animate-spin" style={{ color: '#D4A017' }} />
      </div>
    )
  }

  // ── Error ──
  if (error || !set) {
    return (
      <div className="p-8">
        <Link href="/roodber8/questions"
          className="flex items-center gap-2 text-sm font-semibold mb-6"
          style={{ color: '#475569' }}>
          <ArrowLeft size={15} /> Back to Questions
        </Link>
        <div className="rounded-2xl p-6" style={C.danger}>
          <p className="font-bold mb-1">Failed to load question set</p>
          <p className="text-sm">{error || 'Set not found'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl">

      {/* Delete set modal */}
      {confirmDelSet && (
        <ConfirmModal
          title="Delete this entire question set?"
          message={`"${set.title}" and all ${questions.length} question${questions.length !== 1 ? 's' : ''} will be permanently deleted. This cannot be undone.`}
          onConfirm={handleDeleteSet}
          onCancel={() => setConfirmDelSet(false)}
          loading={deletingSet}
        />
      )}

      {/* ── Back link ── */}
      <Link href="/roodber8/questions"
        className="flex items-center gap-2 text-sm font-semibold mb-6 w-fit"
        style={{ color: '#475569' }}>
        <ArrowLeft size={15} /> Back to Questions
      </Link>

      {/* ── Set header ── */}
      {!editingMeta && (
        <div className="rounded-2xl border p-6 mb-6" style={C.card}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(212,160,23,0.12)' }}>
                  <BookOpen size={18} style={{ color: '#D4A017' }} />
                </div>
                <h1 className="text-xl font-black text-white leading-tight">{set.title}</h1>
              </div>
              <div className="flex items-center gap-3 flex-wrap mt-1">
                {set.topic && (
                  <span className="text-sm" style={{ color: '#475569' }}>{set.topic}</span>
                )}
                {set.difficulty && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg capitalize"
                    style={{ background: diff.bg, color: diff.color, border: `1px solid ${diff.border}` }}>
                    {set.difficulty}
                  </span>
                )}
                {set.exam_body?.[0] && (
                  <span className="text-xs font-bold uppercase px-2.5 py-1 rounded-lg"
                    style={{ background: 'rgba(212,160,23,0.1)', color: '#D4A017' }}>
                    {set.exam_body[0]}
                  </span>
                )}
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg capitalize"
                  style={set.status === 'published' ? C.success : C.idle}>
                  {set.status ?? 'published'}
                </span>
                <span className="text-xs" style={{ color: '#334155' }}>
                  {questions.length} question{questions.length !== 1 ? 's' : ''}
                </span>
              </div>
              {set.excerpt && (
                <p className="text-sm mt-3 leading-relaxed" style={{ color: '#475569' }}>{set.excerpt}</p>
              )}
            </div>

            {/* Header actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setEditingMeta(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl"
                style={{ background: 'rgba(37,99,235,0.1)', color: '#3b82f6', border: '1px solid rgba(37,99,235,0.2)' }}>
                <Edit3 size={12} /> Edit Metadata
              </button>
              <button onClick={() => setConfirmDelSet(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                <Trash2 size={12} /> Delete Set
              </button>
            </div>
          </div>
          {deleteSetError && (
            <div className="rounded-xl px-4 py-3 mt-4 text-sm" style={C.danger}>{deleteSetError}</div>
          )}
        </div>
      )}

      {/* ── Metadata editor ── */}
      {editingMeta && (
        <SetMetadataEditor
          set={set} setId={setId}
          onUpdated={s => { setSet(s); setEditingMeta(false) }}
          onClose={() => setEditingMeta(false)}
        />
      )}

      {/* ── Questions list ── */}
      <div className="rounded-2xl border overflow-hidden mb-4" style={C.card}>
        <div className="px-5 py-4 border-b flex items-center justify-between"
          style={{ borderColor: '#1a2238' }}>
          <p className="text-white font-bold text-sm">
            Questions
            <span className="ml-2 text-xs font-normal" style={{ color: '#475569' }}>
              {questions.length} total
            </span>
          </p>
          <button
            onClick={() => setShowAddForm(v => !v)}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl"
            style={{ background: '#D4A017', color: '#0C1A3D' }}>
            <Plus size={13} />
            Add Question
          </button>
        </div>

        {questions.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <BookOpen size={28} className="mx-auto mb-3" style={{ color: '#1a2238' }} />
            <p className="text-white font-semibold mb-1">No questions yet</p>
            <p className="text-sm" style={{ color: '#334155' }}>Add questions manually or regenerate this set.</p>
          </div>
        ) : (
          <div>
            {questions.map((q, i) => (
              <QuestionRow
                key={q.id}
                question={q}
                index={i}
                setId={setId}
                onUpdated={handleQuestionUpdated}
                onDeleted={handleQuestionDeleted}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Add question form ── */}
      {showAddForm && (
        <AddQuestionForm
          setId={setId}
          onAdded={handleQuestionAdded}
          onClose={() => setShowAddForm(false)}
        />
      )}
    </div>
  )
}
