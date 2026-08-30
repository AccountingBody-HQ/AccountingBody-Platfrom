/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Upload, CheckCircle2, AlertTriangle,
  Loader2, Send, RefreshCw, Eye, ChevronDown, ChevronUp,
  FileJson, Info, Sparkles
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface NormalisedQuestion {
  id:                 string
  type:               string
  questionText:       string
  options:            string[]
  correctIndex:       number | null
  explanation:        string | null
  writingModelAnswer: string | null
  writingExplanation: string | null
  caseId:             string | null
  primaryTopic:       string
  difficulty:         string
  timeTargetMinutes:  number
  points:             number
}

interface NormalisedBundle {
  title:        string
  slug:         string
  excerpt:      string
  difficulty:   string
  questionType: string
  topic:        string
  tags:         string[]
  cases:        { caseId: string; title: string; exhibitHtml: string }[]
  questions:    NormalisedQuestion[]
}

interface ImportResult {
  bundle:           NormalisedBundle
  changes:          string[]
  warnings:         string[]
  validationErrors: string[]
  ready:            boolean
  stats: {
    total: number; mcq: number; scenario: number
    writing: number; cases: number
  }
}

// ── Style constants ───────────────────────────────────────────────────────────

const C = {
  card:    { background: '#0d1424', border: '1px solid #1a2238', borderRadius: 16 },
  input:   { background: '#111827', border: '1px solid #1f2937', borderRadius: 10, color: '#fff' },
  active:  { background: 'rgba(212,160,23,0.12)', border: '1px solid #D4A017', color: '#fff' },
  idle:    { background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#64748b' },
  danger:  { background: 'rgba(239,68,68,0.08)',  border: '1px solid rgba(239,68,68,0.25)',   color: '#ef4444' },
  success: { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',  color: '#10b981' },
  warning: { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',  color: '#f59e0b' },
  info:    { background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',  color: '#3b82f6' },
}

const DIFF_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  beginner:     { bg: 'rgba(16,185,129,0.08)',  color: '#10b981', border: 'rgba(16,185,129,0.2)'  },
  intermediate: { bg: 'rgba(245,158,11,0.08)',  color: '#f59e0b', border: 'rgba(245,158,11,0.2)'  },
  advanced:     { bg: 'rgba(239,68,68,0.08)',   color: '#ef4444', border: 'rgba(239,68,68,0.2)'   },
}

const OPTION_LABELS = ['A', 'B', 'C', 'D']
const DIFFICULTIES  = ['beginner', 'intermediate', 'advanced']

// ── Question preview card ─────────────────────────────────────────────────────

function QuestionPreview({ q, index }: { q: NormalisedQuestion; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const [showExpl, setShowExpl] = useState(false)
  const diff = DIFF_STYLE[q.difficulty] ?? DIFF_STYLE.intermediate
  const isMCQ = q.type === 'multiple-choice' || q.type === 'scenario'
  const correctLabel = typeof q.correctIndex === 'number'
    ? OPTION_LABELS[q.correctIndex] : '—'

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: '#1a2238' }}>
      <div
        className="px-5 py-4 flex items-start gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5"
          style={{ background: '#0C1A3D', color: '#D4A017', border: '1px solid #D4A017' }}>
          {index + 1}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium leading-relaxed">
            {expanded
              ? q.questionText
              : q.questionText.slice(0, 140) + (q.questionText.length > 140 ? '…' : '')}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {q.primaryTopic && (
              <span className="text-xs" style={{ color: '#475569' }}>{q.primaryTopic}</span>
            )}
            <span className="text-xs font-semibold px-2 py-0.5 rounded capitalize"
              style={{ background: diff.bg, color: diff.color, border: `1px solid ${diff.border}` }}>
              {q.difficulty}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded"
              style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>
              {q.type === 'multiple-choice' ? 'MCQ' : q.type === 'scenario' ? 'Scenario' : 'Writing'}
            </span>
            {isMCQ && (
              <span className="text-xs font-bold px-2 py-0.5 rounded"
                style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                ✓ {correctLabel}
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 mt-1" style={{ color: '#475569' }}>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 space-y-3">
          {isMCQ && q.options.length > 0 && (
            <div className="space-y-1.5">
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs"
                  style={oi === q.correctIndex
                    ? { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }
                    : { background: 'rgba(255,255,255,0.02)', border: '1px solid #1f2937', color: '#475569' }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0"
                    style={oi === q.correctIndex
                      ? { background: '#10b981', color: '#fff' }
                      : { background: 'rgba(255,255,255,0.06)', color: '#334155' }}>
                    {oi === q.correctIndex ? '✓' : OPTION_LABELS[oi]}
                  </span>
                  {opt || <span style={{ color: '#334155' }}>—</span>}
                </div>
              ))}
            </div>
          )}

          {q.type === 'writing' && q.writingModelAnswer && (
            <div className="rounded-xl p-3"
              style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#10b981' }}>
                Model Answer
              </p>
              <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>
                {q.writingModelAnswer.slice(0, 400)}
                {q.writingModelAnswer.length > 400 ? '…' : ''}
              </p>
            </div>
          )}

          {q.explanation && (
            <div>
              <button onClick={e => { e.stopPropagation(); setShowExpl(v => !v) }}
                className="flex items-center gap-1.5 text-xs font-semibold py-1"
                style={{ color: '#475569' }}>
                <Eye size={12} />
                {showExpl ? 'Hide' : 'Show'} explanation
              </button>
              {showExpl && (
                <p className="text-xs leading-relaxed mt-2 whitespace-pre-line"
                  style={{ color: '#334155' }}>
                  {q.explanation}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ label, value, color, bg }: {
  label: string; value: number | string; color: string; bg: string
}) {
  return (
    <div className="rounded-xl px-4 py-3 text-center" style={{ background: bg, border: `1px solid ${color}22` }}>
      <p className="text-2xl font-black" style={{ color }}>{value}</p>
      <p className="text-xs font-bold uppercase tracking-wider mt-0.5" style={{ color }}>{label}</p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ImportQuestionsPage() {

  // Step 0 = paste, Step 1 = preview, Step 2 = publishing, Step 3 = done
  const [step, setStep]             = useState(0)
  const [rawJson, setRawJson]       = useState('')
  const [parsing, setParsing]       = useState(false)
  const [parseError, setParseError] = useState('')
  const [result, setResult]         = useState<ImportResult | null>(null)

  // Editable metadata (pre-filled from parsed bundle, user can adjust)
  const [metaTitle, setMetaTitle]         = useState('')
  const [metaTopic, setMetaTopic]         = useState('')
  const [metaExcerpt, setMetaExcerpt]     = useState('')
  const [metaDifficulty, setMetaDiff]     = useState('intermediate')
  const [metaExamBody, setMetaExamBody]   = useState('acca')
  const [showOnSites, setShowOnSites]     = useState<string[]>(['accountingbody'])
  const [canonical, setCanonical]         = useState('accountingbody')

  // Publish state
  const [publishing, setPublishing]   = useState(false)
  const [publishError, setPublishError] = useState('')
  const [publishedSlug, setPublishedSlug] = useState('')
  const [articleSlug, setArticleSlug]     = useState('')

  async function handleParse() {
    if (!rawJson.trim()) { setParseError('Paste your JSON first'); return }
    setParsing(true); setParseError('')
    try {
      const res = await fetch('/api/roodber8/questions/import', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rawJson }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Parse failed')

      setResult(data)
      // Pre-fill editable metadata from parsed bundle
      setMetaTitle(data.bundle.title)
      setMetaTopic(data.bundle.topic)
      setMetaExcerpt(data.bundle.excerpt)
      setMetaDiff(data.bundle.difficulty)
      setStep(1)
    } catch (e: any) {
      setParseError(e.message)
    } finally {
      setParsing(false)
    }
  }

  async function handlePublish() {
    if (!result) return
    setPublishing(true); setPublishError('')

    // Merge edited metadata back into bundle before publishing
    const bundleToPublish = {
      ...result.bundle,
      title:      metaTitle,
      topic:      metaTopic,
      excerpt:    metaExcerpt,
      difficulty: metaDifficulty,
    }

    try {
      const res = await fetch('/api/roodber8/questions/publish', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          bundle:        bundleToPublish,
          qualification: metaExamBody.toUpperCase(),
          examBody:      metaExamBody,
          showOnSites,
          canonicalOwner: canonical,
          articleSlug:    articleSlug.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Publish failed')
      setPublishedSlug(data.slug ?? '')
      setStep(3)
    } catch (e: any) {
      setPublishError(e.message)
    } finally {
      setPublishing(false)
    }
  }

  function handleReset() {
    setStep(0); setRawJson(''); setResult(null)
    setParseError(''); setPublishError('')
    setMetaTitle(''); setMetaTopic('')
    setMetaExcerpt(''); setMetaDiff('intermediate')
    setMetaExamBody('acca')
    setShowOnSites(['accountingbody']); setCanonical('accountingbody')
    setPublishedSlug('')
    setArticleSlug('')
  }

  const EXAM_BODIES = ['acca', 'cima', 'icaew', 'aat', 'eticpa']
  const SITES       = ['accountingbody', 'ethiotax']

  return (
    <div className="p-8 max-w-5xl">

      {/* ── Header ── */}
      <Link href="/roodber8/questions"
        className="flex items-center gap-2 text-sm font-semibold mb-6 w-fit"
        style={{ color: '#475569' }}>
        <ArrowLeft size={15} /> Back to Questions
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(212,160,23,0.12)' }}>
          <FileJson size={20} style={{ color: '#D4A017' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Import Questions</h1>
          <p className="text-sm" style={{ color: '#475569' }}>
            Paste JSON from any source — AI-generated or hand-written
          </p>
        </div>
      </div>

      {/* ── Step indicator ── */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        {['Paste JSON', 'Review & Configure', 'Publish'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
              style={i === Math.min(step, 2)
                ? { background: '#0C1A3D', color: '#fff', border: '1px solid #D4A017' }
                : i < step
                  ? { background: 'rgba(16,185,129,0.12)', color: '#10b981' }
                  : { background: 'rgba(255,255,255,0.03)', color: '#334155' }}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={i < step
                  ? { background: '#10b981', color: '#fff' }
                  : i === Math.min(step, 2)
                    ? { background: '#D4A017', color: '#0C1A3D' }
                    : { background: 'rgba(255,255,255,0.04)', color: '#334155' }}>
                {i < step ? '✓' : i + 1}
              </span>
              <span className="text-sm font-semibold">{s}</span>
            </div>
            {i < 2 && <span style={{ color: '#1e293b', fontSize: 14 }}>›</span>}
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          STEP 0 — PASTE JSON
      ══════════════════════════════════════════════════════ */}
      {step === 0 && (
        <div className="space-y-5">

          {/* Info banner */}
          <div className="rounded-2xl p-4 flex gap-3" style={C.info}>
            <Info size={16} className="shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-bold">Accepted formats</p>
              <p style={{ color: '#93c5fd' }}>
                Any JSON from any source — AI-generated or hand-written.
                Supports MCQ, Scenario, and Writing questions. The system automatically
                normalises field names, answer formats, and option structures.
              </p>
            </div>
          </div>

          {/* Paste area */}
          <div className="rounded-2xl border p-6" style={C.card}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-bold text-sm">Paste your JSON here</p>
              {rawJson && (
                <button onClick={() => setRawJson('')}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={C.idle}>
                  Clear
                </button>
              )}
            </div>
            <textarea
              value={rawJson}
              onChange={e => setRawJson(e.target.value)}
              rows={18}
              placeholder={`Paste your JSON here. Examples of accepted formats:\n\n[ { "question": "...", "choices": ["A","B","C","D"], "correct": "B", "explanation": "..." }, ... ]\n\n{ "title": "...", "questions": [ { "stem": "...", "options": {...}, "answer": 2 } ] }\n\n{ "questions": [ { "questionText": "...", "options": [...], "correctIndex": 0 } ] }`}
              className="w-full text-sm font-mono resize-none focus:outline-none placeholder-slate-700"
              style={{ ...C.input, minHeight: 360, lineHeight: 1.6 }}
            />
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs" style={{ color: '#334155' }}>
                {rawJson.length > 0 ? `${rawJson.length.toLocaleString()} characters` : 'No content yet'}
              </p>
              <p className="text-xs" style={{ color: '#334155' }}>
                Markdown code fences are stripped automatically
              </p>
            </div>
          </div>

          {parseError && (
            <div className="rounded-2xl p-4 flex gap-3" style={C.danger}>
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold mb-0.5">Could not parse JSON</p>
                <p className="text-sm">{parseError}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={handleParse} disabled={parsing || !rawJson.trim()}
              className="flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl disabled:opacity-40"
              style={{ background: '#0C1A3D', color: '#fff', border: '1px solid #D4A017' }}>
              {parsing
                ? <><Loader2 size={14} className="animate-spin" /> Parsing…</>
                : <><Upload size={14} /> Parse & Preview</>}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          STEP 1 — REVIEW & CONFIGURE
      ══════════════════════════════════════════════════════ */}
      {step === 1 && result && (
        <div className="space-y-5">

          {/* Stats row */}
          <div className="grid grid-cols-5 gap-3">
            <StatPill label="Total"    value={result.stats.total}    color="#D4A017" bg="rgba(212,160,23,0.08)" />
            <StatPill label="MCQ"      value={result.stats.mcq}      color="#10b981" bg="rgba(16,185,129,0.08)" />
            <StatPill label="Scenario" value={result.stats.scenario} color="#8b5cf6" bg="rgba(139,92,246,0.08)" />
            <StatPill label="Writing"  value={result.stats.writing}  color="#ec4899" bg="rgba(236,72,153,0.08)" />
            <StatPill label="Cases"    value={result.stats.cases}    color="#3b82f6" bg="rgba(59,130,246,0.08)" />
          </div>

          {/* Normalisation report */}
          {(result.changes.length > 0 || result.warnings.length > 0) && (
            <div className="rounded-2xl border p-5 space-y-3" style={C.card}>
              <p className="text-white font-bold text-sm">Normalisation Report</p>

              {result.changes.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#10b981' }}>
                    ✓ {result.changes.length} transformation{result.changes.length !== 1 ? 's' : ''} applied
                  </p>
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                    {result.changes.map((c, i) => (
                      <p key={i} className="text-xs font-mono" style={{ color: '#334155' }}>• {c}</p>
                    ))}
                  </div>
                </div>
              )}

              {result.warnings.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#f59e0b' }}>
                    ⚠ {result.warnings.length} warning{result.warnings.length !== 1 ? 's' : ''}
                  </p>
                  <div className="space-y-1">
                    {result.warnings.map((w, i) => (
                      <p key={i} className="text-xs" style={{ color: '#f59e0b' }}>• {w}</p>
                    ))}
                  </div>
                </div>
              )}

              {result.validationErrors.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#ef4444' }}>
                    ✗ {result.validationErrors.length} validation error{result.validationErrors.length !== 1 ? 's' : ''} — fix before publishing
                  </p>
                  <div className="space-y-1">
                    {result.validationErrors.map((e, i) => (
                      <p key={i} className="text-xs" style={{ color: '#ef4444' }}>• {e}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Metadata editor */}
          <div className="rounded-2xl border p-5 space-y-4" style={C.card}>
            <p className="text-white font-bold text-sm">Set Metadata</p>
            <p className="text-xs" style={{ color: '#475569' }}>
              Pre-filled from your JSON. Edit before publishing.
            </p>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Title</p>
              <input type="text" value={metaTitle} onChange={e => setMetaTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm focus:outline-none" style={C.input} />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Topic</p>
              <input type="text" value={metaTopic} onChange={e => setMetaTopic(e.target.value)}
                className="w-full px-3 py-2 text-sm focus:outline-none" style={C.input} />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Excerpt</p>
              <textarea rows={2} value={metaExcerpt} onChange={e => setMetaExcerpt(e.target.value)}
                className="w-full px-3 py-2 text-sm resize-none focus:outline-none" style={C.input} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Difficulty</p>
                <div className="flex gap-2">
                  {DIFFICULTIES.map(d => (
                    <button key={d} onClick={() => setMetaDiff(d)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize"
                      style={metaDifficulty === d ? C.active : C.idle}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Exam Body</p>
                <div className="flex gap-2 flex-wrap">
                  {EXAM_BODIES.map(b => (
                    <button key={b} onClick={() => setMetaExamBody(b)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase"
                      style={metaExamBody === b ? C.active : C.idle}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Show On Sites</p>
                <div className="flex gap-2">
                  {SITES.map(site => (
                    <button key={site}
                      onClick={() => {
                        setShowOnSites(prev =>
                          prev.includes(site)
                            ? prev.filter(s => s !== site)
                            : [...prev, site]
                        )
                      }}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize"
                      style={showOnSites.includes(site) ? C.active : C.idle}>
                      {site === 'accountingbody' ? 'AB' : 'ET'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Canonical Owner</p>
                <div className="flex gap-2">
                  {SITES.map(site => (
                    <button key={site} onClick={() => setCanonical(site)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize"
                      style={canonical === site
                        ? { background: 'rgba(16,185,129,0.12)', border: '1px solid #10b981', color: '#fff' }
                        : C.idle}>
                      {site === 'accountingbody' ? 'AB' : 'ET'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>
                Linked Article ID <span style={{ color: '#334155', fontWeight: 400 }}>(optional — paste the Article ID to link this PQ set to an article)</span>
              </p>
              <input
                type="text"
                value={articleSlug}
                onChange={e => setArticleSlug(e.target.value)}
                placeholder="e.g. AB-ART-02013"
                className="w-full px-3 py-2 text-sm focus:outline-none"
                style={C.input}
              />
            </div>
          </div>

          {/* Question preview list */}
          <div className="rounded-2xl border overflow-hidden" style={C.card}>
            <div className="px-5 py-4 border-b flex items-center justify-between"
              style={{ borderColor: '#1a2238' }}>
              <p className="text-white font-bold text-sm">
                Question Preview
                <span className="ml-2 text-xs font-normal" style={{ color: '#475569' }}>
                  Click any row to expand
                </span>
              </p>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                style={{ background: 'rgba(212,160,23,0.1)', color: '#D4A017' }}>
                {result.bundle.questions.length} questions
              </span>
            </div>
            <div>
              {result.bundle.questions.map((q, i) => (
                <QuestionPreview key={q.id} q={q} index={i} />
              ))}
            </div>
          </div>

          {publishError && (
            <div className="rounded-2xl p-4 flex gap-3" style={C.danger}>
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <p className="text-sm">{publishError}</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button onClick={() => { setStep(0); setResult(null); setParseError('') }}
              className="flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl"
              style={C.idle}>
              <RefreshCw size={13} /> Re-paste
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing || !result.ready || !metaTitle.trim()}
              className="flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl disabled:opacity-40"
              style={{ background: '#059669', color: '#fff' }}>
              {publishing
                ? <><Loader2 size={14} className="animate-spin" /> Publishing…</>
                : <><Send size={14} /> Publish {result.bundle.questions.length} Questions to Supabase</>}
            </button>
          </div>

          {!result.ready && result.validationErrors.length > 0 && (
            <p className="text-xs text-center" style={{ color: '#ef4444' }}>
              Fix the validation errors above before publishing
            </p>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          STEP 3 — SUCCESS
      ══════════════════════════════════════════════════════ */}
      {step === 3 && (
        <div className="rounded-2xl p-12 text-center" style={C.success}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: '#059669' }}>
            <CheckCircle2 size={30} className="text-white" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Import Successful</h2>
          <p className="text-sm mb-2" style={{ color: '#6ee7b7' }}>
            {result?.bundle.questions.length} questions published to Supabase
          </p>
          {publishedSlug && (
            <a href={`/practice-questions/${publishedSlug}`} target="_blank" rel="noopener noreferrer"
              className="text-sm font-semibold inline-block mb-6" style={{ color: '#D4A017' }}>
              View live → /practice-questions/{publishedSlug}
            </a>
          )}
          <div className="flex items-center justify-center gap-3 mt-6">
            <button onClick={handleReset}
              className="flex items-center gap-2 text-sm font-bold px-8 py-3 rounded-xl"
              style={{ background: '#0C1A3D', color: '#fff', border: '1px solid #D4A017' }}>
              <Sparkles size={14} /> Import Another Set
            </button>
            <Link href="/roodber8/questions"
              className="flex items-center gap-2 text-sm font-bold px-8 py-3 rounded-xl"
              style={C.idle}>
              View Library
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
