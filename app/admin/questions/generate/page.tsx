/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useState } from 'react'
import { Sparkles, ChevronRight, Check, Loader2, AlertCircle, Send, RefreshCw, Eye, BookOpen } from 'lucide-react'

const QUALIFICATIONS = ['ACCA', 'CIMA', 'ICAEW', 'AAT']

const QUAL_SUBJECTS: Record<string, string[]> = {
  ACCA:  ['Business and Technology', 'Management Accounting', 'Financial Accounting', 'Corporate and Business Law', 'Performance Management', 'Taxation', 'Financial Reporting', 'Audit and Assurance', 'Financial Management', 'Strategic Business Leader', 'Strategic Business Reporting', 'Advanced Financial Management', 'Advanced Performance Management', 'Advanced Taxation', 'Advanced Audit and Assurance'],
  CIMA:  ['Business Economics', 'Fundamentals of Management Accounting', 'Fundamentals of Financial Accounting', 'Fundamentals of Ethics', 'Management Accounting', 'Advanced Management Accounting', 'Risk Management', 'Financial Reporting', 'Advanced Financial Reporting', 'Financial Strategy', 'Organisational Management', 'Project and Relationship Management', 'Strategic Management'],
  ICAEW: ['Accounting', 'Assurance', 'Business Technology and Finance', 'Law', 'Management Information', 'Principles of Taxation', 'Financial Accounting and Reporting', 'Audit and Assurance', 'Business Strategy and Technology', 'Financial Management', 'Tax Compliance', 'Corporate Reporting', 'Strategic Business Management'],
  AAT:   ['Bookkeeping Transactions', 'Bookkeeping Controls', 'Introduction to Payroll', 'Business Environment', 'Financial Accounting: Preparing Financial Statements', 'Management Accounting Techniques', 'Tax Processes for Businesses', 'Business Awareness', 'Advanced Bookkeeping', 'Financial Statements of Limited Companies', 'Management Accounting: Decision and Control', 'Management Accounting: Budgeting', 'Business Tax', 'Personal Tax', 'Audit and Assurance', 'Cash and Financial Management', 'Credit and Debt Management'],
}

const QUESTION_TYPES = [
  { value: 'mcq',      label: 'MCQ',      desc: 'Multiple choice — 4 options, one correct answer' },
  { value: 'scenario', label: 'Scenario', desc: 'Case-based — shared exhibit with linked questions' },
  { value: 'writing',  label: 'Writing',  desc: 'Constructed response — model answer and teaching notes' },
]

const DIFFICULTIES = [
  { value: 'beginner',     label: 'Foundation',    desc: 'Recall and basic application' },
  { value: 'intermediate', label: 'Intermediate',  desc: 'Multi-step reasoning and professional judgement' },
  { value: 'advanced',     label: 'Advanced',      desc: 'Complex scenarios, exam peak difficulty' },
]

const COUNTS = [5, 10, 15, 20, 25, 30]

const FRAMEWORKS = ['None', 'IFRS', 'UK GAAP', 'US GAAP']

const NOISE_LEVELS = [
  { value: 'low',    label: 'Low',    desc: 'Clean stems, minimal distraction' },
  { value: 'medium', label: 'Medium', desc: 'One plausible irrelevant detail' },
  { value: 'high',   label: 'High',   desc: 'Two distractors — requires careful filtering' },
]

const STEPS = ['Configure', 'Generate', 'Review', 'Publish']

const C = {
  card:   { background: '#0d1424', border: '1px solid #1a2238', borderRadius: 16 },
  input:  { background: '#111827', border: '1px solid #1f2937' },
  active: { background: 'rgba(212,160,23,0.12)', border: '1px solid #D4A017', color: '#ffffff' },
  idle:   { background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#64748b' },
}

function SelectCard({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="rounded-xl p-4 text-left transition-all w-full" style={active ? C.active : C.idle}>
      {children}
    </button>
  )
}

type Config = {
  qualification: string; subject: string; topic: string
  questionType: string; difficulty: string; count: number
  framework: string; noiseLevel: string; rounding: string
}

const EMPTY: Config = {
  qualification: '', subject: '', topic: '',
  questionType: 'mcq', difficulty: 'intermediate', count: 10,
  framework: 'None', noiseLevel: 'medium', rounding: 'nearest whole number',
}

type Bundle = {
  title: string; slug: string; excerpt: string; difficulty: string
  questionType: string; topic: string; tags: string[]
  cases: any[]; questions: any[]
}

export default function GenerateQuestionsPage() {
  const [step, setStep]               = useState(0)
  const [config, setConfig]           = useState<Config>(EMPTY)
  const [bundle, setBundle]           = useState<Bundle | null>(null)
  const [generating, setGenerating]   = useState(false)
  const [publishing, setPublishing]   = useState(false)
  const [published, setPublished]     = useState(false)
  const [error, setError]             = useState('')
  const [warnings, setWarnings]       = useState<string[]>([])
  const [docId, setDocId]             = useState('')
  const [docSlug, setDocSlug]         = useState('')
  const [showOnSites, setShowOnSites] = useState<string[]>(['accountingbody'])
  const [canonical, setCanonical]     = useState('accountingbody')
  const [previewIdx, setPreviewIdx]   = useState(0)

  const subjects = config.qualification ? QUAL_SUBJECTS[config.qualification] ?? [] : []
  const configValid = !!(config.qualification && config.topic.trim() && config.questionType)

  async function handleGenerate() {
    setGenerating(true); setError(''); setWarnings([])
    try {
      const res = await fetch('/api/admin/questions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          examBody: config.qualification.toLowerCase(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setBundle(data.bundle)
      if (data.errors?.length) setWarnings(data.errors)
      setPreviewIdx(0)
      setStep(2)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handlePublish() {
    if (!bundle || publishing) return
    setPublishing(true); setError('')
    try {
      const res = await fetch('/api/admin/questions/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundle,
          qualification: config.qualification,
          examBody: config.qualification.toLowerCase(),
          showOnSites,
          canonicalOwner: canonical,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Publish failed')
      setDocId(data.documentId ?? '')
      setDocSlug(data.slug ?? '')
      setPublished(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setPublishing(false)
    }
  }

  function reset() {
    setStep(0); setConfig(EMPTY); setBundle(null)
    setPublished(false); setError(''); setWarnings([])
    setDocId(''); setDocSlug('')
    setShowOnSites(['accountingbody']); setCanonical('accountingbody')
  }

  const q = bundle?.questions[previewIdx]

  return (
    <div className="p-8 max-w-5xl">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(212,160,23,0.12)' }}>
          <Sparkles size={20} style={{ color: '#D4A017' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Question Generator</h1>
          <p className="text-sm" style={{ color: '#475569' }}>Generate exam-standard practice questions using Claude AI and publish to Sanity</p>
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center mb-10 flex-wrap gap-y-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
              style={i === step
                ? { background: '#0C1A3D', color: '#ffffff', border: '1px solid #D4A017' }
                : i < step
                  ? { background: 'rgba(16,185,129,0.12)', color: '#10b981' }
                  : { background: 'rgba(255,255,255,0.03)', color: '#334155' }}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={i < step
                  ? { background: '#10b981', color: '#ffffff' }
                  : i === step
                    ? { background: '#D4A017', color: '#0C1A3D' }
                    : { background: 'rgba(255,255,255,0.04)', color: '#334155' }}>
                {i < step ? '✓' : i + 1}
              </span>
              <span className="text-sm font-semibold">{s}</span>
            </div>
            {i < STEPS.length - 1 && <ChevronRight size={14} style={{ color: '#1e293b' }} className="mx-1" />}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl p-4 mb-6 flex items-center gap-3"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle size={16} style={{ color: '#ef4444' }} className="shrink-0" />
          <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="rounded-2xl p-4 mb-6"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <p className="text-xs font-bold mb-2" style={{ color: '#f59e0b' }}>Validation notes — questions were published but review these:</p>
          {warnings.map((w, i) => <p key={i} className="text-xs" style={{ color: '#f59e0b' }}>• {w}</p>)}
        </div>
      )}

      {/* STEP 0 — CONFIGURE */}
      {step === 0 && (
        <div className="space-y-5">

          {/* Qualification */}
          <div className="rounded-2xl border p-6" style={C.card}>
            <h2 className="text-white font-bold text-sm mb-1">Qualification</h2>
            <p className="text-xs mb-4" style={{ color: '#334155' }}>Which qualification level should these questions target?</p>
            <div className="grid grid-cols-4 gap-3">
              {QUALIFICATIONS.map(q => (
                <SelectCard key={q} active={config.qualification === q}
                  onClick={() => setConfig(c => ({ ...c, qualification: q, subject: '' }))}>
                  <BookOpen size={13} className="mb-2 opacity-60" />
                  <p className="font-bold text-sm">{q}</p>
                </SelectCard>
              ))}
            </div>
          </div>

          {/* Subject */}
          {config.qualification && (
            <div className="rounded-2xl border p-6" style={C.card}>
              <h2 className="text-white font-bold text-sm mb-1">Subject / Paper</h2>
              <p className="text-xs mb-4" style={{ color: '#334155' }}>Select a paper or type a custom subject</p>
              <div className="grid grid-cols-2 gap-2 mb-3 max-h-44 overflow-y-auto pr-1">
                {subjects.map(s => (
                  <SelectCard key={s} active={config.subject === s} onClick={() => setConfig(c => ({ ...c, subject: s }))}>
                    <p className="font-semibold text-xs leading-snug">{s}</p>
                  </SelectCard>
                ))}
              </div>
              <input type="text" value={config.subject}
                onChange={e => setConfig(c => ({ ...c, subject: e.target.value }))}
                placeholder="Or type a custom subject…"
                className="w-full rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none mt-1"
                style={C.input} />
            </div>
          )}

          {/* Topic */}
          <div className="rounded-2xl border p-6" style={C.card}>
            <h2 className="text-white font-bold text-sm mb-1">Topic</h2>
            <p className="text-xs mb-4" style={{ color: '#334155' }}>Be specific — the more detail, the better the questions</p>
            <textarea value={config.topic} rows={3}
              onChange={e => setConfig(c => ({ ...c, topic: e.target.value }))}
              placeholder="e.g. Lease accounting under IFRS 16 — right-of-use assets, lease liabilities, initial measurement and disclosure requirements"
              className="w-full rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none resize-none"
              style={C.input} />
          </div>

          {/* Question Type */}
          <div className="rounded-2xl border p-6" style={C.card}>
            <h2 className="text-white font-bold text-sm mb-1">Question Type</h2>
            <p className="text-xs mb-4" style={{ color: '#334155' }}>What format should the questions take?</p>
            <div className="grid grid-cols-3 gap-3">
              {QUESTION_TYPES.map(t => (
                <SelectCard key={t.value} active={config.questionType === t.value}
                  onClick={() => setConfig(c => ({ ...c, questionType: t.value }))}>
                  <p className="font-bold text-sm mb-1">{t.label}</p>
                  <p className="text-xs" style={{ color: '#334155' }}>{t.desc}</p>
                </SelectCard>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div className="rounded-2xl border p-6" style={C.card}>
            <h2 className="text-white font-bold text-sm mb-1">Difficulty</h2>
            <p className="text-xs mb-4" style={{ color: '#334155' }}>What level of challenge should these questions present?</p>
            <div className="grid grid-cols-3 gap-3">
              {DIFFICULTIES.map(d => (
                <SelectCard key={d.value} active={config.difficulty === d.value}
                  onClick={() => setConfig(c => ({ ...c, difficulty: d.value }))}>
                  <p className="font-bold text-sm mb-1">{d.label}</p>
                  <p className="text-xs" style={{ color: '#334155' }}>{d.desc}</p>
                </SelectCard>
              ))}
            </div>
          </div>

          {/* Count + Framework + Noise */}
          <div className="grid grid-cols-3 gap-5">
            <div className="rounded-2xl border p-6" style={C.card}>
              <h2 className="text-white font-bold text-sm mb-1">Number of Questions</h2>
              <p className="text-xs mb-4" style={{ color: '#334155' }}>How many questions to generate?</p>
              <div className="grid grid-cols-3 gap-2">
                {COUNTS.map(n => (
                  <SelectCard key={n} active={config.count === n} onClick={() => setConfig(c => ({ ...c, count: n }))}>
                    <p className="font-bold text-sm text-center">{n}</p>
                  </SelectCard>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border p-6" style={C.card}>
              <h2 className="text-white font-bold text-sm mb-1">Framework</h2>
              <p className="text-xs mb-4" style={{ color: '#334155' }}>Which accounting framework to use?</p>
              <div className="grid grid-cols-2 gap-2">
                {FRAMEWORKS.map(f => (
                  <SelectCard key={f} active={config.framework === f} onClick={() => setConfig(c => ({ ...c, framework: f }))}>
                    <p className="font-semibold text-xs">{f}</p>
                  </SelectCard>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border p-6" style={C.card}>
              <h2 className="text-white font-bold text-sm mb-1">Noise Level</h2>
              <p className="text-xs mb-4" style={{ color: '#334155' }}>How much irrelevant detail in stems?</p>
              <div className="space-y-2">
                {NOISE_LEVELS.map(n => (
                  <SelectCard key={n.value} active={config.noiseLevel === n.value}
                    onClick={() => setConfig(c => ({ ...c, noiseLevel: n.value }))}>
                    <p className="font-bold text-xs mb-0.5">{n.label}</p>
                    <p className="text-xs" style={{ color: '#334155' }}>{n.desc}</p>
                  </SelectCard>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={() => setStep(1)} disabled={!configValid}
              className="flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl disabled:opacity-40"
              style={{ background: '#0C1A3D', color: '#ffffff', border: '1px solid #D4A017' }}>
              Continue <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 1 — GENERATE */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="rounded-2xl border p-6" style={C.card}>
            <h2 className="text-white font-bold text-sm mb-5">Ready to Generate</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Qualification', value: config.qualification },
                { label: 'Subject',       value: config.subject || '—' },
                { label: 'Question Type', value: config.questionType   },
                { label: 'Difficulty',    value: config.difficulty     },
                { label: 'Count',         value: `${config.count} questions` },
                { label: 'Framework',     value: config.framework      },
                { label: 'Noise Level',   value: config.noiseLevel     },
                { label: 'Rounding',      value: config.rounding       },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-3" style={{ background: '#111827' }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#334155' }}>{item.label}</p>
                  <p className="text-white text-sm font-semibold capitalize">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl p-3" style={{ background: '#111827' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#334155' }}>Topic</p>
              <p className="text-white text-sm">{config.topic}</p>
            </div>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(0)}
              className="text-sm font-bold px-6 py-2.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid #1f2937' }}>
              Back
            </button>
            <button onClick={handleGenerate} disabled={generating}
              className="flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl disabled:opacity-40"
              style={{ background: '#0C1A3D', color: '#ffffff', border: '1px solid #D4A017' }}>
              {generating
                ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
                : <><Sparkles size={14} /> Generate {config.count} Questions</>}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 — REVIEW */}
      {step === 2 && bundle && (
        <div className="space-y-5">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Questions Generated', value: bundle.questions.length, color: '#10b981' },
              { label: 'Type',                value: bundle.questionType,     color: '#8b5cf6' },
              { label: 'Difficulty',          value: bundle.difficulty,       color: '#D4A017' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border p-4" style={C.card}>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#334155' }}>{s.label}</p>
                <p className="text-xl font-black capitalize" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Bundle metadata */}
          <div className="rounded-2xl border p-5" style={C.card}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#334155' }}>Set Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs" style={{ color: '#475569' }}>Title</p>
                <p className="text-white text-sm font-semibold mt-0.5">{bundle.title}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: '#475569' }}>Excerpt</p>
                <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>{bundle.excerpt}</p>
              </div>
            </div>
          </div>

          {/* Question preview */}
          <div className="rounded-2xl border overflow-hidden" style={C.card}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#1a2238' }}>
              <div className="flex items-center gap-2">
                <Eye size={14} style={{ color: '#D4A017' }} />
                <p className="text-white font-bold text-sm">Question Preview</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPreviewIdx(i => Math.max(0, i - 1))} disabled={previewIdx === 0}
                  className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#ffffff' }}>‹</button>
                <span className="text-xs" style={{ color: '#475569' }}>{previewIdx + 1} / {bundle.questions.length}</span>
                <button onClick={() => setPreviewIdx(i => Math.min(bundle.questions.length - 1, i + 1))}
                  disabled={previewIdx === bundle.questions.length - 1}
                  className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#ffffff' }}>›</button>
              </div>
            </div>

            {q && (
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded"
                    style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>
                    {q.type}
                  </span>
                  {q.difficulty && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded capitalize"
                      style={{ background: 'rgba(212,160,23,0.1)', color: '#D4A017' }}>
                      {q.difficulty}
                    </span>
                  )}
                  {q.timeTargetMinutes && (
                    <span className="text-xs px-2 py-0.5 rounded" style={{ color: '#475569' }}>
                      {q.timeTargetMinutes} min
                    </span>
                  )}
                  {q.primaryTopic && (
                    <span className="text-xs px-2 py-0.5 rounded ml-auto" style={{ color: '#475569' }}>
                      {q.primaryTopic}
                    </span>
                  )}
                </div>

                <p className="text-white text-sm font-semibold leading-relaxed">{q.questionText}</p>

                {q.type !== 'writing' && Array.isArray(q.options) && (
                  <div className="space-y-2">
                    {q.options.map((opt: string, i: number) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm"
                        style={i === q.correctIndex
                          ? { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }
                          : { background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#64748b' }}>
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={i === q.correctIndex
                            ? { background: '#10b981', color: '#ffffff' }
                            : { background: 'rgba(255,255,255,0.06)', color: '#475569' }}>
                          {i === q.correctIndex ? '✓' : String.fromCharCode(65 + i)}
                        </span>
                        {opt}
                      </div>
                    ))}
                  </div>
                )}

                {q.type === 'writing' && q.writingModelAnswer && (
                  <div className="rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#10b981' }}>Model Answer</p>
                    <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>{q.writingModelAnswer}</p>
                  </div>
                )}

                {q.explanation && (
                  <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937' }}>
                    <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#334155' }}>Explanation</p>
                    <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: '#64748b' }}>{q.explanation}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button onClick={() => { setStep(1); setBundle(null) }}
              className="flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid #1f2937' }}>
              <RefreshCw size={13} /> Regenerate
            </button>
            <button onClick={() => setStep(3)}
              className="flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl"
              style={{ background: '#0C1A3D', color: '#ffffff', border: '1px solid #D4A017' }}>
              Continue to Publish <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — PUBLISH */}
      {step === 3 && !published && bundle && (
        <div className="space-y-5">
          <div className="rounded-2xl border p-6" style={C.card}>
            <h2 className="text-white font-bold text-sm mb-1">Show On Sites</h2>
            <p className="text-xs mb-4" style={{ color: '#334155' }}>AccountingBody is required.</p>
            <div className="grid grid-cols-3 gap-3">
              {['accountingbody', 'hrlake', 'ethiotax'].map(site => (
                <button key={site}
                  onClick={() => {
                    if (site === 'accountingbody') return
                    setShowOnSites(prev => prev.includes(site) ? prev.filter(s => s !== site) : [...prev, site])
                  }}
                  className="rounded-xl p-4 text-left transition-all"
                  style={showOnSites.includes(site) ? C.active : C.idle}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-sm capitalize">{site}</p>
                    {showOnSites.includes(site) && <Check size={13} style={{ color: '#D4A017' }} />}
                    {site === 'accountingbody' && <span className="text-xs" style={{ color: '#D4A017' }}>Required</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border p-6" style={C.card}>
            <h2 className="text-white font-bold text-sm mb-1">Canonical Owner</h2>
            <p className="text-xs mb-4" style={{ color: '#334155' }}>Which site owns the SEO for this content?</p>
            <div className="grid grid-cols-3 gap-3">
              {['accountingbody', 'hrlake', 'ethiotax'].map(site => (
                <button key={site} onClick={() => setCanonical(site)}
                  className="rounded-xl p-4 text-left transition-all"
                  style={canonical === site
                    ? { background: 'rgba(16,185,129,0.12)', border: '1px solid #10b981', color: '#ffffff' }
                    : C.idle}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm capitalize">{site}</p>
                    {canonical === site && <Check size={13} style={{ color: '#10b981' }} />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border p-5" style={C.card}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#334155' }}>Publish Summary</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Title',         value: bundle.title },
                { label: 'Questions',     value: `${bundle.questions.length} questions` },
                { label: 'Qualification', value: config.qualification },
                { label: 'Canonical',     value: canonical },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-3" style={{ background: '#111827' }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#334155' }}>{item.label}</p>
                  <p className="text-white text-sm font-semibold capitalize">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)}
              className="text-sm font-bold px-6 py-2.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid #1f2937' }}>
              Back
            </button>
            <button onClick={handlePublish} disabled={publishing}
              className="flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl disabled:opacity-40"
              style={{ background: '#059669', color: '#ffffff' }}>
              {publishing
                ? <><Loader2 size={14} className="animate-spin" /> Publishing…</>
                : <><Send size={14} /> Publish to Sanity</>}
            </button>
          </div>
        </div>
      )}

      {/* SUCCESS */}
      {published && (
        <div className="rounded-2xl p-12 text-center"
          style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: '#059669' }}>
            <Check size={30} className="text-white" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Published Successfully</h2>
          <p className="text-sm mb-2" style={{ color: '#475569' }}>
            {bundle?.questions.length} questions are now live in Sanity.
          </p>
          {docId && <p className="text-xs mb-2" style={{ color: '#334155' }}>Document ID: <span className="text-white font-mono">{docId}</span></p>}
          {docSlug && (
            <a href={`/practice-questions/${docSlug}`} target="_blank" rel="noopener noreferrer"
              className="text-sm font-semibold mb-6 inline-block" style={{ color: '#D4A017' }}>
              View live → /practice-questions/{docSlug}
            </a>
          )}
          <div className="flex items-center justify-center gap-3 mt-6">
            <button onClick={reset}
              className="flex items-center gap-2 text-sm font-bold px-8 py-3 rounded-xl"
              style={{ background: '#0C1A3D', color: '#ffffff', border: '1px solid #D4A017' }}>
              <Sparkles size={14} /> Generate Another Set
            </button>
            <a href="/admin/questions"
              className="flex items-center gap-2 text-sm font-bold px-8 py-3 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid #1f2937' }}>
              View Library
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
