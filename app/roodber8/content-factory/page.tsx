/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Sparkles, ChevronRight, BookOpen, Edit3, Check, Loader2, AlertCircle, Send,
  FileJson, Upload, Info, RefreshCw
} from 'lucide-react'

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

// ── Import mode: types, constants, extra styles ─────────────────────────────
// (Rule 54 — self-contained: copied from app/roodber8/articles/import/page.tsx
// rather than imported from it.)

interface NormalisedArticle {
  title: string; slug: string; content: string; excerpt: string
  category: string; category_title: string; exam_body: string[]
  show_on_sites: string[]; featured_image_url: string
  seo_title: string; seo_description: string; read_time: number
  author_name: string; status: string; difficulty: string
  ai_key_terms: string[]; ai_searchable: boolean
  eticpa_level: string; eticpa_module: string; eticpa_topic: string
  content_type: string; platform: string; canonical_owner: string
}

interface ImportResult {
  article:          NormalisedArticle
  changes:          string[]
  warnings:         string[]
  validationErrors: string[]
  ready:            boolean
}

const KNOWN_CATEGORIES = [
  { slug: 'financial-accounting',  label: 'Financial Accounting' },
  { slug: 'management-accounting', label: 'Management Accounting' },
  { slug: 'financial-management',  label: 'Financial Management' },
  { slug: 'audit-assurance',       label: 'Audit & Assurance' },
  { slug: 'taxation',              label: 'Taxation' },
  { slug: 'business-management',   label: 'Business Management' },
  { slug: 'economics',             label: 'Economics' },
  { slug: 'financial-market',      label: 'Financial Market' },
  { slug: 'cryptocurrency',        label: 'Cryptocurrency' },
  { slug: 'tools-templates',       label: 'Tools & Templates' },
]
const EXAM_BODIES  = ['acca', 'cima', 'icaew', 'aat', 'eticpa']
const IMPORT_STEPS = ['Paste JSON', 'Review & Configure', 'Publish']

// Colour scheme for the import Difficulty picker — matches
// app/roodber8/articles/import/page.tsx's DIFF_STYLE exactly.
const IMPORT_DIFF_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  beginner:     { bg: 'rgba(16,185,129,0.08)',  color: '#10b981', border: 'rgba(16,185,129,0.2)'  },
  intermediate: { bg: 'rgba(245,158,11,0.08)',  color: '#f59e0b', border: 'rgba(245,158,11,0.2)'  },
  advanced:     { bg: 'rgba(239,68,68,0.08)',   color: '#ef4444', border: 'rgba(239,68,68,0.2)'   },
}

// This page's existing C.active is blue (used throughout the generate flow's
// SelectCards). The import UI's Category/Exam Body/Show-On-Sites pickers need
// the gold "selected" treatment used on the sibling articles/import page —
// added here rather than repurposing C.active, which would recolour every
// existing generate-flow selector.
const GOLD_ACTIVE  = { background: 'rgba(212,160,23,0.12)', border: '1px solid #D4A017', color: '#ffffff' }
const GREEN_ACTIVE = { background: 'rgba(16,185,129,0.12)', border: '1px solid #10b981', color: '#ffffff' }

function stripHtmlForPreview(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
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

  // ── Mode toggle ──────────────────────────────────────────────────────────
  const [mode, setMode] = useState<'generate' | 'import'>('generate')

  // ── Import-flow state ────────────────────────────────────────────────────
  const [importStep, setImportStep]             = useState(0)
  const [importRawJson, setImportRawJson]       = useState('')
  const [importParsing, setImportParsing]       = useState(false)
  const [importParseError, setImportParseError] = useState('')
  const [importResult, setImportResult]         = useState<ImportResult | null>(null)
  const [importPublishing, setImportPublishing] = useState(false)
  const [importPublishError, setImportPublishError] = useState('')
  const [importPublishedSlug, setImportPublishedSlug] = useState('')

  // Editable metadata (pre-filled from normalised article)
  const [impTitle, setImpTitle]         = useState('')
  const [impSlug, setImpSlug]           = useState('')
  const [impExcerpt, setImpExcerpt]     = useState('')
  const [impAuthor, setImpAuthor]       = useState('')
  const [impCategory, setImpCategory]   = useState('')
  const [impStatus, setImpStatus]       = useState('published')
  const [impDifficulty, setImpDifficulty] = useState('')
  const [impExamBodies, setImpExamBodies] = useState<string[]>([])
  const [impShowOnSites, setImpShowOnSites] = useState<string[]>(['accountingbody'])
  const [impCanonical, setImpCanonical] = useState('accountingbody')
  const [impSeoTitle, setImpSeoTitle]   = useState('')
  const [impSeoDesc, setImpSeoDesc]     = useState('')
  const [impContentExpanded, setImpContentExpanded] = useState(false)

  // Switching mode resets the import flow back to step 0; the generate
  // flow's state (config, step, etc.) is left untouched either way, so
  // switching back and forth never loses generate-flow work in progress.
  function switchMode(next: 'generate' | 'import') {
    setImportStep(0)
    setMode(next)
  }

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

  // ── Import handlers ──────────────────────────────────────────────────────

  async function handleImportParse() {
    if (!importRawJson.trim()) { setImportParseError('Paste your JSON first'); return }
    setImportParsing(true); setImportParseError('')
    try {
      const res = await fetch('/api/roodber8/articles/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawJson: importRawJson }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Parse failed')
      setImportResult(data)
      // Pre-fill editable metadata from normalised article
      setImpTitle(data.article.title ?? '')
      setImpSlug(data.article.slug ?? '')
      setImpExcerpt(data.article.excerpt ?? '')
      setImpAuthor(data.article.author_name ?? '')
      setImpCategory(data.article.category ?? '')
      setImpStatus(data.article.status ?? 'published')
      setImpDifficulty(data.article.difficulty ?? '')
      setImpExamBodies(data.article.exam_body ?? [])
      setImpShowOnSites(
        data.article.show_on_sites?.length ? data.article.show_on_sites : ['accountingbody']
      )
      setImpCanonical(data.article.canonical_owner ?? 'accountingbody')
      setImpSeoTitle(data.article.seo_title ?? '')
      setImpSeoDesc(data.article.seo_description ?? '')
      setImportStep(1)
    } catch (e: any) {
      setImportParseError(e.message)
    } finally {
      setImportParsing(false)
    }
  }

  async function handleImportPublish() {
    if (!importResult) return
    setImportPublishing(true); setImportPublishError('')
    const selectedCategory = KNOWN_CATEGORIES.find(c => c.slug === impCategory)
    try {
      const res = await fetch('/api/roodber8/articles/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article: {
            ...importResult.article,
            title:           impTitle,
            slug:            impSlug,
            excerpt:         impExcerpt,
            author_name:     impAuthor,
            category:        impCategory,
            category_title:  selectedCategory?.label ?? importResult.article.category_title,
            status:          impStatus,
            difficulty:      impDifficulty,
            exam_body:       impExamBodies,
            seo_title:       impSeoTitle,
            seo_description: impSeoDesc,
          },
          showOnSites:    impShowOnSites,
          canonicalOwner: impCanonical,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Publish failed')
      setImportPublishedSlug(data.slug ?? '')
      setImportStep(3)
    } catch (e: any) {
      setImportPublishError(e.message)
    } finally {
      setImportPublishing(false)
    }
  }

  function resetImport() {
    setImportStep(0); setImportRawJson(''); setImportResult(null)
    setImportParseError(''); setImportPublishError('')
    setImpTitle(''); setImpSlug(''); setImpExcerpt(''); setImpAuthor('')
    setImpCategory(''); setImpStatus('published'); setImpDifficulty('')
    setImpExamBodies([]); setImpShowOnSites(['accountingbody'])
    setImpCanonical('accountingbody'); setImpSeoTitle(''); setImpSeoDesc('')
    setImportPublishedSlug(''); setImpContentExpanded(false)
  }

  const seo = seoScore()
  const seoColor = seo >= 75 ? '#10b981' : seo >= 50 ? '#f59e0b' : '#ef4444'
  const subjects = config.qualification ? QUAL_SUBJECTS[config.qualification] ?? [] : []

  const importContent = importResult?.article.content ?? ''
  const importContentPreview = impContentExpanded ? importContent : stripHtmlForPreview(importContent).slice(0, 300)

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

      {/* Mode toggle */}
      <div className="inline-flex rounded-xl border p-1 gap-1 mb-8"
        style={{ borderColor: '#1a2238', background: '#0d1424' }}>
        <button onClick={() => switchMode('generate')}
          className={`flex items-center gap-2 px-5 py-2 text-sm ${mode === 'generate' ? 'font-bold' : 'font-semibold'}`}
          style={mode === 'generate'
            ? { background: '#0C1A3D', color: '#ffffff', border: '1px solid #D4A017', borderRadius: 10 }
            : { background: 'transparent', color: '#475569', border: '1px solid transparent', borderRadius: 10 }}>
          <Sparkles size={14} /> Generate
        </button>
        <button onClick={() => switchMode('import')}
          className={`flex items-center gap-2 px-5 py-2 text-sm ${mode === 'import' ? 'font-bold' : 'font-semibold'}`}
          style={mode === 'import'
            ? { background: '#0C1A3D', color: '#ffffff', border: '1px solid #D4A017', borderRadius: 10 }
            : { background: 'transparent', color: '#475569', border: '1px solid transparent', borderRadius: 10 }}>
          <FileJson size={14} /> Import JSON
        </button>
      </div>

      {mode === 'generate' && (
        <>
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
        </>
      )}

      {mode === 'import' && (
        <>
          {/* Import step indicator */}
          <div className="flex items-center mb-10 flex-wrap gap-y-2">
            {IMPORT_STEPS.map((s, i) => (
              <div key={s} className="flex items-center">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
                  style={i === Math.min(importStep, 2)
                    ? { background: '#0C1A3D', color: '#ffffff', border: '1px solid #D4A017' }
                    : i < importStep
                      ? { background: 'rgba(16,185,129,0.12)', color: '#10b981' }
                      : { background: 'rgba(255,255,255,0.03)', color: '#334155' }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={i < importStep
                      ? { background: '#10b981', color: '#ffffff' }
                      : i === Math.min(importStep, 2)
                        ? { background: '#D4A017', color: '#0C1A3D' }
                        : { background: 'rgba(255,255,255,0.04)', color: '#334155' }}>
                    {i < importStep ? '✓' : i + 1}
                  </span>
                  <span className="text-sm font-semibold">{s}</span>
                </div>
                {i < IMPORT_STEPS.length - 1 && <ChevronRight size={14} style={{ color: '#1e293b' }} className="mx-1" />}
              </div>
            ))}
          </div>

          {/* IMPORT STEP 0 — PASTE JSON */}
          {importStep === 0 && (
            <div className="space-y-5">
              <div className="rounded-2xl p-4 flex gap-3"
                style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', color: '#3b82f6' }}>
                <Info size={16} className="shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p className="font-bold">Accepted formats</p>
                  <p style={{ color: '#93c5fd' }}>
                    Any JSON from ChatGPT, DeepSeek, Gemini, Claude, or a WordPress export.
                    Field names are normalised automatically.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border p-6" style={C.card}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white font-bold text-sm">Paste your JSON here</p>
                  {importRawJson && (
                    <button onClick={() => setImportRawJson('')}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={C.idle}>
                      Clear
                    </button>
                  )}
                </div>
                <textarea
                  value={importRawJson}
                  onChange={e => setImportRawJson(e.target.value)}
                  rows={18}
                  placeholder={`{ "title": "...", "content": "<p>...</p>", "excerpt": "...", "category": "financial-accounting" }`}
                  className="w-full text-sm font-mono resize-none focus:outline-none placeholder-slate-700"
                  style={{ ...C.input, borderRadius: 10, color: '#ffffff', minHeight: 360, lineHeight: 1.6 }}
                />
                <p className="text-xs mt-3" style={{ color: '#334155' }}>
                  {importRawJson.length > 0 ? `${importRawJson.length.toLocaleString()} characters` : 'No content yet'}
                </p>
              </div>

              {importParseError && (
                <div className="rounded-2xl p-4 flex items-center gap-3"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertCircle size={16} style={{ color: '#ef4444' }} className="shrink-0" />
                  <p className="text-sm" style={{ color: '#ef4444' }}>{importParseError}</p>
                </div>
              )}

              <div className="flex justify-end">
                <button onClick={handleImportParse} disabled={importParsing || !importRawJson.trim()}
                  className="flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl disabled:opacity-40"
                  style={{ background: '#0C1A3D', color: '#ffffff', border: '1px solid #D4A017' }}>
                  {importParsing
                    ? <><Loader2 size={14} className="animate-spin" /> Parsing…</>
                    : <><Upload size={14} /> Parse & Preview</>}
                </button>
              </div>
            </div>
          )}

          {/* IMPORT STEP 1 — REVIEW & CONFIGURE */}
          {importStep === 1 && importResult && (
            <div className="space-y-5">

              {/* Normalisation report */}
              {(importResult.changes.length > 0 || importResult.warnings.length > 0 || importResult.validationErrors.length > 0) && (
                <div className="rounded-2xl border p-5 space-y-3" style={C.card}>
                  <p className="text-white font-bold text-sm">Normalisation Report</p>

                  {importResult.changes.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#10b981' }}>
                        ✓ {importResult.changes.length} transformation{importResult.changes.length !== 1 ? 's' : ''} applied
                      </p>
                      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                        {importResult.changes.map((c, i) => (
                          <p key={i} className="text-xs font-mono" style={{ color: '#334155' }}>• {c}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {importResult.warnings.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#f59e0b' }}>
                        ⚠ {importResult.warnings.length} warning{importResult.warnings.length !== 1 ? 's' : ''}
                      </p>
                      <div className="space-y-1">
                        {importResult.warnings.map((w, i) => (
                          <p key={i} className="text-xs" style={{ color: '#f59e0b' }}>• {w}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {importResult.validationErrors.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#ef4444' }}>
                        ✗ {importResult.validationErrors.length} validation error{importResult.validationErrors.length !== 1 ? 's' : ''} — fix before publishing
                      </p>
                      <div className="space-y-1">
                        {importResult.validationErrors.map((e, i) => (
                          <p key={i} className="text-xs" style={{ color: '#ef4444' }}>• {e}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Metadata editor */}
              <div className="rounded-2xl border p-5 space-y-4" style={C.card}>
                <p className="text-white font-bold text-sm">Article Metadata</p>
                <p className="text-xs" style={{ color: '#475569' }}>
                  Pre-filled from your JSON. Edit before publishing.
                </p>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Title</p>
                  <input type="text" value={impTitle} onChange={e => setImpTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-white focus:outline-none rounded-lg"
                    style={{ ...C.input, borderRadius: 10 }} />
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Slug</p>
                  <input type="text" value={impSlug} onChange={e => setImpSlug(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-white focus:outline-none rounded-lg"
                    style={{ ...C.input, borderRadius: 10 }} />
                  <p className="text-xs mt-1.5" style={{ color: '#334155' }}>Changing the slug breaks existing links</p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Excerpt</p>
                  <textarea rows={3} value={impExcerpt} onChange={e => setImpExcerpt(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-white resize-none focus:outline-none rounded-lg"
                    style={{ ...C.input, borderRadius: 10 }} />
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Author</p>
                  <input type="text" value={impAuthor} onChange={e => setImpAuthor(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-white focus:outline-none rounded-lg"
                    style={{ ...C.input, borderRadius: 10 }} />
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Category</p>
                  <div className="grid grid-cols-3 gap-2">
                    {KNOWN_CATEGORIES.map(cat => (
                      <button key={cat.slug} onClick={() => setImpCategory(cat.slug)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-left"
                        style={impCategory === cat.slug ? GOLD_ACTIVE : C.idle}>
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Status</p>
                    <div className="flex gap-2">
                      {['published', 'draft'].map(s => (
                        <button key={s} onClick={() => setImpStatus(s)}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize"
                          style={impStatus === s ? (s === 'published' ? GREEN_ACTIVE : GOLD_ACTIVE) : C.idle}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Difficulty</p>
                    <div className="flex gap-2 flex-wrap">
                      {['beginner', 'intermediate', 'advanced'].map(d => {
                        const s = IMPORT_DIFF_STYLE[d]
                        return (
                          <button key={d} onClick={() => setImpDifficulty(d)}
                            className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize"
                            style={impDifficulty === d ? { background: s.bg, color: s.color, border: `1px solid ${s.border}` } : C.idle}>
                            {d}
                          </button>
                        )
                      })}
                      <button onClick={() => setImpDifficulty('')}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                        style={impDifficulty === '' ? GOLD_ACTIVE : C.idle}>
                        None
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Exam Body</p>
                  <div className="flex gap-2 flex-wrap">
                    {EXAM_BODIES.map(b => (
                      <button key={b}
                        onClick={() => setImpExamBodies(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase"
                        style={impExamBodies.includes(b) ? GOLD_ACTIVE : C.idle}>
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Show On Sites</p>
                    <div className="flex gap-2">
                      {['accountingbody', 'ethiotax'].map(site => (
                        <button key={site}
                          onClick={() => setImpShowOnSites(prev => prev.includes(site) ? prev.filter(s => s !== site) : [...prev, site])}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                          style={impShowOnSites.includes(site) ? GOLD_ACTIVE : C.idle}>
                          {site === 'accountingbody' ? 'AB' : 'ET'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Canonical Owner</p>
                    <div className="flex gap-2">
                      {['accountingbody', 'ethiotax'].map(site => (
                        <button key={site} onClick={() => setImpCanonical(site)}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                          style={impCanonical === site ? GREEN_ACTIVE : C.idle}>
                          {site === 'accountingbody' ? 'AB' : 'ET'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#475569' }}>SEO Title</p>
                    <p className="text-xs" style={{ color: impSeoTitle.length > 60 ? '#ef4444' : '#334155' }}>
                      {impSeoTitle.length} / 60
                    </p>
                  </div>
                  <input type="text" value={impSeoTitle} onChange={e => setImpSeoTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-white focus:outline-none rounded-lg"
                    style={{ ...C.input, borderRadius: 10 }} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#475569' }}>SEO Description</p>
                    <p className="text-xs" style={{ color: impSeoDesc.length > 160 ? '#ef4444' : '#334155' }}>
                      {impSeoDesc.length} / 160
                    </p>
                  </div>
                  <textarea rows={2} value={impSeoDesc} onChange={e => setImpSeoDesc(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-white resize-none focus:outline-none rounded-lg"
                    style={{ ...C.input, borderRadius: 10 }} />
                </div>
              </div>

              {/* Content preview */}
              <div className="rounded-2xl border overflow-hidden" style={C.card}>
                <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#1a2238' }}>
                  <p className="text-white font-bold text-sm">Content Preview</p>
                  <button onClick={() => setImpContentExpanded(v => !v)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={C.idle}>
                    {impContentExpanded ? 'Collapse' : 'Show full content'}
                  </button>
                </div>
                <div className="p-5">
                  {impContentExpanded ? (
                    <div
                      className="text-sm leading-relaxed max-w-prose overflow-y-auto max-h-96"
                      style={{ color: '#94a3b8' }}
                      dangerouslySetInnerHTML={{ __html: importContent }}
                    />
                  ) : (
                    <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
                      {importContentPreview}{stripHtmlForPreview(importContent).length > 300 ? '…' : ''}
                    </p>
                  )}
                </div>
              </div>

              {importPublishError && (
                <div className="rounded-2xl p-4 flex items-center gap-3"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertCircle size={16} style={{ color: '#ef4444' }} className="shrink-0" />
                  <p className="text-sm" style={{ color: '#ef4444' }}>{importPublishError}</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <button onClick={() => { setImportStep(0); setImportResult(null) }}
                  className="flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl"
                  style={C.idle}>
                  <RefreshCw size={13} /> Re-paste
                </button>
                <button
                  onClick={handleImportPublish}
                  disabled={importPublishing || !importResult.ready || !impTitle.trim()}
                  className="flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl disabled:opacity-40"
                  style={{ background: '#059669', color: '#ffffff' }}>
                  {importPublishing
                    ? <><Loader2 size={14} className="animate-spin" /> Publishing…</>
                    : <><Send size={14} /> Publish to Supabase</>}
                </button>
              </div>

              {!importResult.ready && importResult.validationErrors.length > 0 && (
                <p className="text-xs text-center" style={{ color: '#ef4444' }}>
                  Fix the validation errors above before publishing
                </p>
              )}
            </div>
          )}

          {/* IMPORT STEP 3 — SUCCESS */}
          {importStep === 3 && (
            <div className="rounded-2xl p-12 text-center"
              style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ background: '#059669' }}>
                <Check size={30} className="text-white" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Import Successful</h2>
              <p className="text-sm mb-2" style={{ color: '#475569' }}>
                Article published to Supabase
              </p>
              {importPublishedSlug && (
                <a href={`/articles/${importPublishedSlug}`} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-semibold inline-block mb-6" style={{ color: '#D4A017' }}>
                  View live → /articles/{importPublishedSlug}
                </a>
              )}
              <div className="flex items-center justify-center gap-3 mt-6">
                <button onClick={resetImport}
                  className="flex items-center gap-2 text-sm font-bold px-8 py-3 rounded-xl"
                  style={{ background: '#0C1A3D', color: '#ffffff', border: '1px solid #D4A017' }}>
                  <Sparkles size={14} /> Import Another Article
                </button>
                <Link href="/roodber8/articles"
                  className="flex items-center gap-2 text-sm font-bold px-8 py-3 rounded-xl"
                  style={C.idle}>
                  View Articles
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
