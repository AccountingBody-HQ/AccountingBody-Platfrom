/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useState, useEffect } from 'react'
import { Sparkles, ChevronRight, BookOpen, Edit3, Check, Loader2, AlertCircle, Send } from 'lucide-react'

const QUALIFICATIONS = ['ACCA', 'CIMA', 'ICAEW', 'AAT', 'ETICPA / CPA', 'ETICPA / ATQ']

const CONTENT_TYPES = [
  { label: 'Study Note',                       desc: 'Exam-focused topic breakdown'         },
  { label: 'Article',                           desc: 'Professional insight piece'           },
  { label: 'Exam Technique Guide',             desc: 'How to maximise marks'                },
  { label: 'Practice Question Explainer',      desc: 'Worked question with commentary'      },
  { label: 'Subject Overview',                 desc: 'Full subject orientation guide'       },
  { label: 'Accounting Guide',                 desc: 'Financial reporting deep dive'        },
  { label: 'Management Accounting Guide',      desc: 'Decision-support analytics guide'    },
  { label: 'Tax Guide',                        desc: 'Tax rules and compliance guide'       },
  { label: 'Audit and Assurance Guide',        desc: 'Audit process and standards guide'   },
  { label: 'Financial Management Guide',       desc: 'Corporate finance guide'             },
  { label: 'Ethics and Professional Standards Guide', desc: 'Ethics and conduct guide'     },
  { label: 'Business Law and Regulation Guide', desc: 'Law and regulatory guide'           },
]

const TONES = [
  { label: 'Educational',   desc: 'Clear, accessible, structured'   },
  { label: 'Authoritative', desc: 'Expert, confident, definitive'   },
  { label: 'Technical',     desc: 'Precise, detailed, professional' },
]
const LENGTHS = [
  { label: 'Short',     desc: '~500 words',   value: 'short'    },
  { label: 'Standard',  desc: '~1,000 words', value: 'standard' },
  { label: 'Deep Dive', desc: '2,000+ words', value: 'deep'     },
]
const DIFFICULTIES = [
  { label: 'Foundation',   desc: 'New to topic — build from first principles' },
  { label: 'Intermediate', desc: 'Some familiarity — focus on depth'          },
  { label: 'Advanced',     desc: 'Near exam-ready — complex scenarios'        },
]
const STEPS = ['Select', 'Configure', 'Generate', 'Review', 'Publish']

const QUAL_SUBJECTS: Record<string, string[]> = {
  ACCA:  ['Business and Technology (BT)', 'Management Accounting (MA)', 'Financial Accounting (FA)', 'Corporate and Business Law (LW)', 'Performance Management (PM)', 'Taxation (TX)', 'Financial Reporting (FR)', 'Audit and Assurance (AA)', 'Financial Management (FM)', 'Strategic Business Leader (SBL)', 'Strategic Business Reporting (SBR)', 'Advanced Financial Management (AFM)', 'Advanced Performance Management (APM)', 'Advanced Taxation (ATX)', 'Advanced Audit and Assurance (AAA)'],
  CIMA:  ['Business Economics (BA1)', 'Fundamentals of Management Accounting (BA2)', 'Fundamentals of Financial Accounting (BA3)', 'Fundamentals of Ethics (BA4)', 'Management Accounting (P1)', 'Advanced Management Accounting (P2)', 'Risk Management (P3)', 'Financial Reporting (F1)', 'Advanced Financial Reporting (F2)', 'Financial Strategy (F3)', 'Organisational Management (E1)', 'Project and Relationship Management (E2)', 'Strategic Management (E3)', 'Case Study'],
  ICAEW: ['Accounting (A)', 'Assurance (As)', 'Business, Technology and Finance (BTF)', 'Law (L)', 'Management Information (MI)', 'Principles of Taxation (PoT)', 'Financial Accounting and Reporting (FAR)', 'Audit and Assurance (AA)', 'Business Strategy and Technology (BST)', 'Financial Management (FM)', 'Tax Compliance (TC)', 'Corporate Reporting (CR)', 'Strategic Business Management (SBM)', 'Case Study'],
  AAT:   ['Bookkeeping Transactions (BTRN)', 'Bookkeeping Controls (BKCL)', 'Introduction to Payroll (ITPF)', 'Business Environment (BENV)', 'Financial Accounting: Preparing Financial Statements (FAPS)', 'Management Accounting Techniques (MATS)', 'Tax Processes for Businesses (TPFB)', 'Business Awareness (BUAW)', 'Advanced Bookkeeping (AVBK)', 'Financial Statements of Limited Companies (FSLC)', 'Management Accounting: Decision and Control (MDCL)', 'Management Accounting: Budgeting (MABU)', 'Business Tax (BNTA)', 'Personal Tax (PNTA)', 'Audit and Assurance (AUDT)', 'Cash and Financial Management (CAFM)', 'Credit and Debt Management (CDMT)', 'Synoptic Assessment'],
  'ETICPA / CPA': ['Financial Reporting (IFRS)', 'Audit and Assurance (ISAs)', 'Ethiopian Taxation (ERCA)', 'Management Accounting', 'Professional Ethics (IFAC)', 'Financial Management', 'Business Law (Ethiopian Commercial Code)', 'Public Sector Accounting'],
  'ETICPA / ATQ': ['Introduction to Accounting (Level 1)', 'Cost Accounting (Level 1)', 'Business Skills (Level 1)', 'Ethiopian Business Law (Level 1)', 'Financial Accounting (Level 2)', 'Management Accounting (Level 2)', 'Assurance Controls and Ethics (Level 2)', 'Ethiopian Taxation (Level 2)', 'Ethiopian Public Sector Accounting (Level 2)'],
}

type Config = {
  qualification: string; contentType: string; subject: string
  topic: string; tone: string; length: string; difficulty: string
  aiSummary: string; keyTerms: string; categoryId: string; categoryTitle: string
  eticpaLevel: string; eticpaModule: string; eticpaTopic: string
}
const EMPTY: Config = {
  qualification: '', contentType: '', subject: '', topic: '',
  tone: 'Educational', length: 'standard', difficulty: 'Intermediate',
  aiSummary: '', keyTerms: '', categoryId: '', categoryTitle: '',
  eticpaLevel: '', eticpaModule: '', eticpaTopic: '',
}

const C = {
  card:   { background: '#0d1424', border: '1px solid #1a2238', borderRadius: 16 },
  input:  { background: '#111827', border: '1px solid #1f2937' },
  active: { background: 'rgba(37,99,235,0.12)', border: '1px solid #2563eb', color: '#ffffff' },
  idle:   { background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#64748b' },
}

function SelectCard({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="rounded-xl p-4 text-left transition-all w-full" style={active ? C.active : C.idle}>
      {children}
    </button>
  )
}

export default function ContentFactoryPage() {
  const [step, setStep]             = useState(0)
  const [config, setConfig]         = useState<Config>(EMPTY)
  const [generated, setGenerated]   = useState('')
  const [edited, setEdited]         = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateStatus, setGenerateStatus] = useState<'idle' | 'in-flight' | 'success'>('idle')
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished]   = useState(false)
  const [error, setError]           = useState('')
  const [showOnSites, setShowOnSites] = useState<string[]>(['accountingbody'])
  const [canonical, setCanonical]   = useState('accountingbody')

  // Auto-default showOnSites and canonical for ETICPA qualifications
  const handleQualificationSelect = (qual: string) => {
    setConfig(prev => ({ ...prev, qualification: qual, subject: '' }))
    if (qual.startsWith('ETICPA')) {
      setShowOnSites(['ethiotax'])
      setCanonical('ethiotax')
    } else {
      setShowOnSites(['accountingbody'])
      setCanonical('accountingbody')
    }
  }
  const [docId, setDocId]           = useState('')
  const [categories, setCategories] = useState<{slug:string;title:string}[]>([])
  const [categoriesError, setCategoriesError] = useState(false)

  function fetchCategories() {
    setCategoriesError(false)
    fetch('/api/roodber8/categories')
      .then(r => r.json())
      .then(d => setCategories(d.categories ?? []))
      .catch(() => setCategoriesError(true))
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  const wordCount = (edited || generated).split(/\s+/).filter(Boolean).length

  function seoScore() {
    let s = 0
    if (wordCount >= 300) s += 25
    if (wordCount >= 800) s += 25
    if (config.topic.length >= 20) s += 25
    if (config.aiSummary.length >= 50) s += 25
    return s
  }

  function step1Valid() {
    return !!(config.qualification && config.contentType && config.topic.trim())
  }

  async function handleGenerate() {
    setGenerating(true)
    setGenerateStatus('in-flight')
    setError('')
    try {
      const controller = new AbortController()
      const tid = setTimeout(() => controller.abort(), 180000)
      const res = await fetch('/api/roodber8/content-factory/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
        signal: controller.signal,
      })
      clearTimeout(tid)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setGenerated(data.content)
      setEdited(data.content)
      if (data.aiSummary) setConfig(c => ({ ...c, aiSummary: data.aiSummary }))
      if (data.keyTerms)  setConfig(c => ({ ...c, keyTerms: data.keyTerms }))
      setGenerateStatus('success')
      setStep(3)
    } catch (e: any) {
      setGenerateStatus('idle')
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handlePublish() {
    if (publishing) return
    setPublishing(true); setError('')
    try {
      const res = await fetch('/api/roodber8/content-factory/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          content: edited || generated,
          showOnSites,
          canonicalOwner: canonical,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Publish failed')
      setDocId(data.documentId ?? '')
      setPublished(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setPublishing(false)
    }
  }

  function reset() {
    setStep(0); setConfig(EMPTY); setGenerated(''); setEdited('')
    setPublished(false); setError('')
    setShowOnSites(['accountingbody']); setCanonical('accountingbody'); setDocId('')
  }

  const seo = seoScore()
  const seoColor = seo >= 75 ? '#10b981' : seo >= 50 ? '#f59e0b' : '#ef4444'
  const subjects = config.qualification ? QUAL_SUBJECTS[config.qualification] ?? [] : []

  return (
    <div className="p-8 max-w-5xl">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(212,160,23,0.12)' }}>
          <Sparkles size={20} style={{ color: '#D4A017' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Content Factory</h1>
          <p className="text-sm" style={{ color: '#475569' }}>Two-pass AI pipeline — Author generates, Critic audits. Publish directly to Supabase.</p>
        </div>
      </div>

      {/* Step indicator */}
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

      {/* STEP 1 — SELECT */}
      {step === 0 && (
        <div className="space-y-5">
          <div className="rounded-2xl border p-6" style={C.card}>
            <h2 className="text-white font-bold text-sm mb-1">Qualification</h2>
            <p className="text-xs mb-4" style={{ color: '#334155' }}>Which qualification is this content for?</p>
            <div className="grid grid-cols-4 gap-3">
              {QUALIFICATIONS.map(q => (
                <SelectCard key={q} active={config.qualification === q} onClick={() => handleQualificationSelect(q)}>
                  <BookOpen size={14} className="mb-2 opacity-60" />
                  <p className="font-bold text-sm">{q}</p>
                </SelectCard>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border p-6" style={C.card}>
            <h2 className="text-white font-bold text-sm mb-1">Content Type</h2>
            <p className="text-xs mb-4" style={{ color: '#334155' }}>What type of content do you need? All 12 types available.</p>
            <div className="grid grid-cols-3 gap-3">
              {CONTENT_TYPES.map(type => (
                <SelectCard key={type.label} active={config.contentType === type.label} onClick={() => setConfig(c => ({ ...c, contentType: type.label }))}>
                  <p className="font-semibold text-xs leading-snug">{type.label}</p>
                  <p className="text-xs mt-1 leading-snug" style={{ color: '#475569' }}>{type.desc}</p>
                </SelectCard>
              ))}
            </div>
          </div>

          {config.qualification && (
            <div className="rounded-2xl border p-6" style={C.card}>
              <h2 className="text-white font-bold text-sm mb-1">Subject / Paper</h2>
              <p className="text-xs mb-4" style={{ color: '#334155' }}>Select the paper or type a custom subject</p>
              <div className="grid grid-cols-2 gap-2 mb-3 max-h-48 overflow-y-auto pr-1">
                {subjects.map(s => (
                  <SelectCard key={s} active={config.subject === s} onClick={() => setConfig(c => ({ ...c, subject: s }))}>
                    <p className="font-semibold text-xs leading-snug">{s}</p>
                  </SelectCard>
                ))}
              </div>
              <input type="text" value={config.subject}
                onChange={e => setConfig(c => ({ ...c, subject: e.target.value }))}
                placeholder="Or type a custom subject / paper name..."
                className="w-full rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none mt-2"
                style={C.input} />
            </div>
          )}

          <div className="rounded-2xl border p-6" style={C.card}>
            <h2 className="text-white font-bold text-sm mb-1">Topic</h2>
            <p className="text-xs mb-4" style={{ color: '#334155' }}>Be specific — the more detail you give, the better the output</p>
            <textarea value={config.topic} rows={3}
              onChange={e => setConfig(c => ({ ...c, topic: e.target.value }))}
              placeholder="e.g. Lease accounting under IFRS 16 — right-of-use assets, lease liabilities, and disclosure requirements…"
              className="w-full rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none resize-none"
              style={C.input} />
          </div>
          <div className="rounded-2xl border p-6" style={C.card}>
            <h2 className="text-white font-bold text-sm mb-1">Category <span style={{ color: '#475569', fontWeight: 400 }}>(optional)</span></h2>
            <p className="text-xs mb-4" style={{ color: '#334155' }}>Assign this content to a category</p>
            {categoriesError ? (
              <div className="rounded-xl p-4 flex items-center justify-between gap-3" style={{ background: '#111827', border: '1px solid #1f2937' }}>
                <p className="text-xs" style={{ color: '#ef4444' }}>Couldn&apos;t load categories.</p>
                <button onClick={fetchCategories}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid #1f2937' }}>
                  Retry
                </button>
              </div>
            ) : categories.length === 0 ? (
              <p className="text-xs" style={{ color: '#334155' }}>Loading categories…</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {categories.map(cat => (
                  <SelectCard key={cat.slug} active={config.categoryId === cat.slug} onClick={() => setConfig(c => ({
                    ...c,
                    categoryId:    c.categoryId === cat.slug ? '' : cat.slug,
                    categoryTitle: c.categoryId === cat.slug ? '' : cat.title,
                  }))}>
                    <p className="font-semibold text-xs leading-snug">{cat.title}</p>
                  </SelectCard>
                ))}
              </div>
            )}
          </div>


          <div className="flex justify-end">
            <button onClick={() => setStep(1)} disabled={!step1Valid()}
              className="flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl transition-all disabled:opacity-40"
              style={{ background: '#0C1A3D', color: '#ffffff', border: '1px solid #D4A017' }}>
              Continue <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 — CONFIGURE */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="rounded-2xl border p-6" style={C.card}>
            <h2 className="text-white font-bold text-sm mb-1">Difficulty Level</h2>
            <p className="text-xs mb-4" style={{ color: '#334155' }}>Who is this content written for?</p>
            <div className="grid grid-cols-3 gap-3">
              {DIFFICULTIES.map(d => (
                <SelectCard key={d.label} active={config.difficulty === d.label} onClick={() => setConfig(c => ({ ...c, difficulty: d.label }))}>
                  <p className="font-semibold text-sm">{d.label}</p>
                  <p className="text-xs mt-1" style={{ color: '#334155' }}>{d.desc}</p>
                </SelectCard>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border p-6" style={C.card}>
            <h2 className="text-white font-bold text-sm mb-1">Tone</h2>
            <p className="text-xs mb-4" style={{ color: '#334155' }}>How should the content feel to the reader?</p>
            <div className="grid grid-cols-3 gap-3">
              {TONES.map(t => (
                <SelectCard key={t.label} active={config.tone === t.label} onClick={() => setConfig(c => ({ ...c, tone: t.label }))}>
                  <p className="font-semibold text-sm">{t.label}</p>
                  <p className="text-xs mt-1" style={{ color: '#334155' }}>{t.desc}</p>
                </SelectCard>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border p-6" style={C.card}>
            <h2 className="text-white font-bold text-sm mb-1">Length</h2>
            <p className="text-xs mb-4" style={{ color: '#334155' }}>How comprehensive should this content be?</p>
            <div className="grid grid-cols-3 gap-3">
              {LENGTHS.map(l => (
                <SelectCard key={l.value} active={config.length === l.value} onClick={() => setConfig(c => ({ ...c, length: l.value }))}>
                  <p className="font-semibold text-sm">{l.label}</p>
                  <p className="text-xs mt-1" style={{ color: '#334155' }}>{l.desc}</p>
                </SelectCard>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(0)}
              className="text-sm font-bold px-6 py-2.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid #1f2937' }}>
              Back
            </button>
            <button onClick={() => setStep(2)}
              className="flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl"
              style={{ background: '#0C1A3D', color: '#ffffff', border: '1px solid #D4A017' }}>
              Continue <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — GENERATE */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="rounded-2xl border p-6" style={C.card}>
            <h2 className="text-white font-bold text-sm mb-5">Ready to Generate</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Qualification', value: config.qualification },
                { label: 'Content Type',  value: config.contentType   },
                { label: 'Subject',       value: config.subject || '—' },
                { label: 'Difficulty',    value: config.difficulty    },
                { label: 'Tone',          value: config.tone          },
                { label: 'Length',        value: LENGTHS.find(l => l.value === config.length)?.label ?? config.length },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-3" style={{ background: '#111827' }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#334155' }}>{item.label}</p>
                  <p className="text-white text-sm font-semibold">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl p-3 mb-4" style={{ background: '#111827' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#334155' }}>Topic</p>
              <p className="text-white text-sm">{config.topic}</p>
            </div>

            {/* Pipeline info */}
            <div className="rounded-xl p-3" style={{ background: 'rgba(212,160,23,0.04)', border: '1px solid rgba(212,160,23,0.1)' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#D4A017' }}>Two-Pass Pipeline</p>
              <div className="flex gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: '#3b82f6' }} />
                  <span className="text-xs" style={{ color: '#64748b' }}>Pass 1: Author generates content with full qualification and subject calibration</span>
                </div>
              </div>
              <div className="flex gap-3 mt-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: '#10b981' }} />
                  <span className="text-xs" style={{ color: '#64748b' }}>Pass 2: Critic audits technical accuracy, compliance, and insight density</span>
                </div>
              </div>
            </div>
          </div>

          {generating && (
            <div className="rounded-xl p-4 mb-4 flex items-center gap-3"
              style={{ background: 'rgba(212,160,23,0.06)', border: '1px solid rgba(212,160,23,0.2)' }}>
              <Loader2 size={15} className="animate-spin" style={{ color: '#D4A017' }} />
              <span className="text-sm font-bold text-white">Generating content… this may take up to 60 seconds</span>
            </div>
          )}
          {!generating && generateStatus === 'success' && (
            <div className="rounded-xl p-4 mb-4 flex items-center gap-3"
              style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Check size={15} style={{ color: '#10b981' }} />
              <span className="text-sm font-bold text-white">Generation complete — reviewing below</span>
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} disabled={generating}
              className="text-sm font-bold px-6 py-2.5 rounded-xl disabled:opacity-40"
              style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid #1f2937' }}>
              Back
            </button>
            <button onClick={handleGenerate} disabled={generating}
              className="flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl disabled:opacity-40"
              style={{ background: '#0C1A3D', color: '#ffffff', border: '1px solid #D4A017' }}>
              {generating
                ? <><Loader2 size={14} className="animate-spin" /> Generating...</>
                : <><Sparkles size={14} /> Generate Content</>}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4 — REVIEW */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'SEO Score',     value: `${seo}%`,          color: seoColor   },
              { label: 'Word Count',    value: wordCount,           color: '#3b82f6'  },
              { label: 'Status',        value: 'Critic Approved',   color: '#10b981'  },
              { label: 'Qualification', value: config.qualification, color: '#D4A017' },
            ].map(c => (
              <div key={c.label} className="rounded-2xl border p-4" style={C.card}>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#334155' }}>{c.label}</p>
                <p className="text-xl font-black" style={{ color: c.color }}>{c.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border p-6" style={C.card}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-sm flex items-center gap-2">
                <Edit3 size={14} style={{ color: '#3b82f6' }} /> Edit Content
              </h2>
              <button onClick={() => setEdited(generated)}
                className="text-xs font-semibold" style={{ color: '#334155' }}>
                Reset to original
              </button>
            </div>
            <textarea value={edited} rows={22}
              onChange={e => setEdited(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-none font-mono leading-relaxed"
              style={{ ...C.input, color: '#94a3b8' }} />
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)}
              className="text-sm font-bold px-6 py-2.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid #1f2937' }}>
              Regenerate
            </button>
            <button onClick={() => setStep(4)}
              className="flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl"
              style={{ background: '#0C1A3D', color: '#ffffff', border: '1px solid #D4A017' }}>
              Continue to Publish <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5 — PUBLISH */}
      {step === 4 && !published && (
        <div className="space-y-5">
          <div className="rounded-2xl border p-6" style={C.card}>
            <h2 className="text-white font-bold text-sm mb-1">Show On Sites</h2>
            <p className="text-xs mb-4" style={{ color: '#334155' }}>Which platforms should display this content? Select all that apply.</p>
            <div className="grid grid-cols-3 gap-3">
              {['accountingbody', 'hrlake', 'ethiotax'].map(site => (
                <button key={site}
                  onClick={() => {
                    setShowOnSites(prev => prev.includes(site) ? prev.filter(s => s !== site) : [...prev, site])
                  }}
                  className="rounded-xl p-4 text-left transition-all"
                  style={showOnSites.includes(site) ? C.active : C.idle}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-sm capitalize">{site}</p>
                    {showOnSites.includes(site) && <Check size={13} style={{ color: '#3b82f6' }} />}
                  </div>
                  <p className="text-xs" style={{ color: '#334155' }}>{site}.com</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border p-6" style={C.card}>
            <h2 className="text-white font-bold text-sm mb-1">Canonical Owner</h2>
            <p className="text-xs mb-4" style={{ color: '#334155' }}>Which site owns the SEO ranking for this content?</p>
            <div className="grid grid-cols-3 gap-3">
              {['accountingbody', 'hrlake', 'ethiotax'].map(site => (
                <button key={site} onClick={() => setCanonical(site)}
                  className="rounded-xl p-4 text-left transition-all"
                  style={canonical === site
                    ? { background: 'rgba(16,185,129,0.12)', border: '1px solid #10b981', color: '#ffffff' }
                    : C.idle}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-sm capitalize">{site}</p>
                    {canonical === site && <Check size={13} style={{ color: '#10b981' }} />}
                  </div>
                  <p className="text-xs" style={{ color: '#334155' }}>SEO owner</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border p-6" style={C.card}>
            <h2 className="text-white font-bold text-sm mb-3">Publish Summary</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Qualification', value: config.qualification },
                { label: 'Content Type',  value: config.contentType   },
                { label: 'Difficulty',    value: config.difficulty     },
                { label: 'Canonical',     value: canonical             },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-3" style={{ background: '#111827' }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#334155' }}>{item.label}</p>
                  <p className="text-white text-sm font-semibold capitalize">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(3)}
              className="text-sm font-bold px-6 py-2.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid #1f2937' }}>
              Back
            </button>
            <button onClick={handlePublish}
              disabled={publishing || showOnSites.length === 0 || !canonical}
              className="flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl disabled:opacity-40"
              style={{ background: '#059669', color: '#ffffff' }}>
              {publishing
                ? <><Loader2 size={14} className="animate-spin" /> Publishing...</>
                : <><Send size={14} /> Publish to Supabase</>}
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
            Your content is now live in Supabase and will appear on AccountingBody within 60 seconds.
          </p>
          {docId && (
            <p className="text-xs mb-2" style={{ color: '#334155' }}>
              Article ID: <span className="text-white font-mono">{docId}</span>
            </p>
          )}
          <p className="text-sm mb-8" style={{ color: '#334155' }}>
            Canonical owner: <span className="text-white font-semibold">{canonical}</span> &middot;
            Qualification: <span className="text-white font-semibold">{config.qualification}</span>
          </p>
          <button onClick={reset}
            className="flex items-center gap-2 text-sm font-bold px-8 py-3 rounded-xl mx-auto"
            style={{ background: '#0C1A3D', color: '#ffffff', border: '1px solid #D4A017' }}>
            <Sparkles size={14} /> Create Another Article
          </button>
        </div>
      )}
    </div>
  )
}
