/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Upload, CheckCircle2, AlertTriangle,
  Loader2, Send, RefreshCw, ChevronDown, ChevronUp,
  FileJson, Info, Sparkles
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface NormalisedArticle {
  title:               string
  slug:                string
  content:             string
  excerpt:             string
  category:            string
  category_title:      string
  exam_body:           string[]
  show_on_sites:       string[]
  featured_image_url:  string
  seo_title:           string
  seo_description:     string
  mcq_url:             string
  read_time:           number
  author_name:         string
  last_reviewed:       string | null
  status:              string
  platform:            string
  canonical_owner:     string
  wp_id:               string
  ai_summary:          string
  ai_key_terms:        string[]
  ai_searchable:       boolean
  eticpa_level:        string
  eticpa_module:       string
  eticpa_topic:        string
  content_type:        string
  difficulty:          string
  published_at:        string | null
}

interface ImportResult {
  article:          NormalisedArticle
  changes:          string[]
  warnings:         string[]
  validationErrors: string[]
  ready:            boolean
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
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced']
const SITES        = ['accountingbody', 'ethiotax']

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function wordCount(html: string): number {
  return stripHtml(html).split(/\s+/).filter(Boolean).length
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

export default function ImportArticlePage() {

  // Step 0 = paste, Step 1 = preview, Step 3 = done
  const [step, setStep]             = useState(0)
  const [rawJson, setRawJson]       = useState('')
  const [parsing, setParsing]       = useState(false)
  const [parseError, setParseError] = useState('')
  const [result, setResult]         = useState<ImportResult | null>(null)

  // Editable metadata (pre-filled from parsed article, user can adjust)
  const [metaTitle, setMetaTitle]           = useState('')
  const [metaSlug, setMetaSlug]             = useState('')
  const [originalSlug, setOriginalSlug]     = useState('')
  const [metaExcerpt, setMetaExcerpt]       = useState('')
  const [metaAuthor, setMetaAuthor]         = useState('')
  const [metaCategory, setMetaCategory]     = useState('')
  const [metaStatus, setMetaStatus]         = useState('published')
  const [metaDifficulty, setMetaDifficulty] = useState('')
  const [metaExamBody, setMetaExamBody]     = useState<string[]>([])
  const [metaSeoTitle, setMetaSeoTitle]     = useState('')
  const [metaSeoDesc, setMetaSeoDesc]       = useState('')
  const [showOnSites, setShowOnSites]       = useState<string[]>(['accountingbody'])
  const [canonical, setCanonical]           = useState('accountingbody')

  // Content preview
  const [showFullContent, setShowFullContent] = useState(false)
  const [contentCollapsed, setContentCollapsed] = useState(false)

  // Publish state
  const [publishing, setPublishing]       = useState(false)
  const [publishError, setPublishError]   = useState('')
  const [publishedSlug, setPublishedSlug] = useState('')

  async function handleParse() {
    if (!rawJson.trim()) { setParseError('Paste your JSON first'); return }
    setParsing(true); setParseError('')
    try {
      const res = await fetch('/api/roodber8/articles/import', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rawJson }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Parse failed')

      setResult(data)
      // Pre-fill editable metadata from normalised article
      setMetaTitle(data.article.title)
      setMetaSlug(data.article.slug)
      setOriginalSlug(data.article.slug)
      setMetaExcerpt(data.article.excerpt)
      setMetaAuthor(data.article.author_name)
      setMetaCategory(data.article.category)
      setMetaStatus(data.article.status === 'draft' ? 'draft' : 'published')
      setMetaDifficulty(data.article.difficulty)
      setMetaExamBody(data.article.exam_body ?? [])
      setMetaSeoTitle(data.article.seo_title)
      setMetaSeoDesc(data.article.seo_description)
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

    const selectedCategory = KNOWN_CATEGORIES.find(c => c.slug === metaCategory)

    // Merge edited metadata back into the normalised article before publishing
    const articleToPublish: NormalisedArticle = {
      ...result.article,
      title:          metaTitle,
      slug:           metaSlug,
      excerpt:        metaExcerpt,
      author_name:    metaAuthor,
      category:       metaCategory,
      category_title: selectedCategory?.label ?? result.article.category_title,
      status:         metaStatus,
      difficulty:     metaDifficulty,
      exam_body:      metaExamBody,
      seo_title:      metaSeoTitle,
      seo_description: metaSeoDesc,
    }

    try {
      const res = await fetch('/api/roodber8/articles/publish', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          article:        articleToPublish,
          showOnSites,
          canonicalOwner: canonical,
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
    setMetaTitle(''); setMetaSlug(''); setOriginalSlug('')
    setMetaExcerpt(''); setMetaAuthor(''); setMetaCategory('')
    setMetaStatus('published'); setMetaDifficulty('')
    setMetaExamBody([]); setMetaSeoTitle(''); setMetaSeoDesc('')
    setShowOnSites(['accountingbody']); setCanonical('accountingbody')
    setShowFullContent(false); setContentCollapsed(false)
    setPublishedSlug('')
  }

  const words   = result ? wordCount(result.article.content) : 0
  const content = result?.article.content ?? ''
  const previewContent = showFullContent ? content : content.slice(0, 500)

  return (
    <div className="p-8 max-w-5xl">

      {/* ── Header ── */}
      <Link href="/roodber8/articles"
        className="flex items-center gap-2 text-sm font-semibold mb-6 w-fit"
        style={{ color: '#475569' }}>
        <ArrowLeft size={15} /> Back to Articles
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(212,160,23,0.12)' }}>
          <FileJson size={20} style={{ color: '#D4A017' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Import Article</h1>
          <p className="text-sm" style={{ color: '#475569' }}>
            Paste JSON from any AI model, or a WordPress export — ChatGPT, DeepSeek, Gemini, Claude
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
                Any JSON from ChatGPT, DeepSeek, Gemini, Claude, or a WordPress export.
                The system automatically normalises field names, content structure, and metadata.
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
              placeholder={`Paste your JSON here. Example accepted shape:\n\n{\n  "title": "Lease Accounting Under IFRS 16",\n  "content": "<p>Full HTML article body...</p>",\n  "excerpt": "A deep dive into lease accounting.",\n  "category": "Financial Accounting",\n  "qualification": "ACCA",\n  "author": "Jane Smith"\n}`}
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
          <div className="grid grid-cols-4 gap-3">
            <StatPill label="Word Count"  value={words}                                        color="#D4A017" bg="rgba(212,160,23,0.08)" />
            <StatPill label="Read Time"   value={result.article.read_time ?? 'estimated'}       color="#10b981" bg="rgba(16,185,129,0.08)" />
            <StatPill label="Exam Bodies" value={result.article.exam_body.join(', ') || 'None'} color="#3b82f6" bg="rgba(59,130,246,0.08)" />
            <StatPill label="Status"      value={result.article.status}                         color="#8b5cf6" bg="rgba(139,92,246,0.08)" />
          </div>

          {/* Normalisation report */}
          {(result.changes.length > 0 || result.warnings.length > 0 || result.validationErrors.length > 0) && (
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
            <p className="text-white font-bold text-sm">Article Metadata</p>
            <p className="text-xs" style={{ color: '#475569' }}>
              Pre-filled from your JSON. Edit before publishing.
            </p>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Title</p>
              <input type="text" value={metaTitle} onChange={e => setMetaTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm focus:outline-none" style={C.input} />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Slug</p>
              <input type="text" value={metaSlug} onChange={e => setMetaSlug(e.target.value)}
                className="w-full px-3 py-2 text-sm focus:outline-none" style={C.input} />
              {metaSlug !== originalSlug && (
                <p className="text-xs mt-1.5" style={{ color: '#f59e0b' }}>
                  ⚠ Changing the slug breaks existing links
                </p>
              )}
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Excerpt</p>
              <textarea rows={3} value={metaExcerpt} onChange={e => setMetaExcerpt(e.target.value)}
                className="w-full px-3 py-2 text-sm resize-none focus:outline-none" style={C.input} />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Author</p>
              <input type="text" value={metaAuthor} onChange={e => setMetaAuthor(e.target.value)}
                className="w-full px-3 py-2 text-sm focus:outline-none" style={C.input} />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Category</p>
              <div className="grid grid-cols-3 gap-2">
                {KNOWN_CATEGORIES.map(cat => (
                  <button key={cat.slug} onClick={() => setMetaCategory(cat.slug)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-left"
                    style={metaCategory === cat.slug ? C.active : C.idle}>
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
                    <button key={s} onClick={() => setMetaStatus(s)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize"
                      style={metaStatus === s ? (s === 'published' ? C.success : C.active) : C.idle}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Difficulty</p>
                <div className="flex gap-2 flex-wrap">
                  {DIFFICULTIES.map(d => {
                    const diff = DIFF_STYLE[d]
                    return (
                      <button key={d} onClick={() => setMetaDifficulty(d)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize"
                        style={metaDifficulty === d
                          ? { background: diff.bg, color: diff.color, border: `1px solid ${diff.border}` }
                          : C.idle}>
                        {d}
                      </button>
                    )
                  })}
                  <button onClick={() => setMetaDifficulty('')}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                    style={metaDifficulty === '' ? C.active : C.idle}>
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
                    onClick={() => setMetaExamBody(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase"
                    style={metaExamBody.includes(b) ? C.active : C.idle}>
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Show On Sites</p>
                <div className="flex gap-2">
                  {SITES.map(site => (
                    <button key={site}
                      onClick={() => {
                        setShowOnSites(prev => prev.includes(site) ? prev.filter(s => s !== site) : [...prev, site])
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
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#475569' }}>SEO Title</p>
                <p className="text-xs" style={{ color: metaSeoTitle.length > 60 ? '#f59e0b' : '#334155' }}>
                  {metaSeoTitle.length} / 60
                </p>
              </div>
              <input type="text" value={metaSeoTitle} onChange={e => setMetaSeoTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm focus:outline-none" style={C.input} />
              {metaSeoTitle.length > 60 && (
                <p className="text-xs mt-1.5" style={{ color: '#f59e0b' }}>⚠ Longer than 60 characters — may be truncated in search results</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#475569' }}>SEO Description</p>
                <p className="text-xs" style={{ color: metaSeoDesc.length > 160 ? '#f59e0b' : '#334155' }}>
                  {metaSeoDesc.length} / 160
                </p>
              </div>
              <textarea rows={2} value={metaSeoDesc} onChange={e => setMetaSeoDesc(e.target.value)}
                className="w-full px-3 py-2 text-sm resize-none focus:outline-none" style={C.input} />
              {metaSeoDesc.length > 160 && (
                <p className="text-xs mt-1.5" style={{ color: '#f59e0b' }}>⚠ Longer than 160 characters — may be truncated in search results</p>
              )}
            </div>
          </div>

          {/* Content preview */}
          <div className="rounded-2xl border overflow-hidden" style={C.card}>
            <button
              onClick={() => setContentCollapsed(v => !v)}
              className="w-full px-5 py-4 border-b flex items-center justify-between"
              style={{ borderColor: '#1a2238' }}>
              <p className="text-white font-bold text-sm">Content Preview</p>
              {contentCollapsed ? <ChevronDown size={15} style={{ color: '#475569' }} /> : <ChevronUp size={15} style={{ color: '#475569' }} />}
            </button>
            {!contentCollapsed && (
              <div className="p-5">
                <div
                  className="text-sm leading-relaxed"
                  style={{ color: '#94a3b8' }}
                  dangerouslySetInnerHTML={{ __html: previewContent + (!showFullContent && content.length > 500 ? '…' : '') }}
                />
                {content.length > 500 && (
                  <button onClick={() => setShowFullContent(v => !v)}
                    className="text-xs font-semibold mt-3" style={{ color: '#D4A017' }}>
                    {showFullContent ? 'Show less' : 'Show full content'}
                  </button>
                )}
              </div>
            )}
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
                : <><Send size={14} /> Publish Article to Supabase</>}
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
            Article published to Supabase
          </p>
          {publishedSlug && (
            <a href={`/articles/${publishedSlug}`} target="_blank" rel="noopener noreferrer"
              className="text-sm font-semibold inline-block mb-6" style={{ color: '#D4A017' }}>
              View live → /articles/{publishedSlug}
            </a>
          )}
          <div className="flex items-center justify-center gap-3 mt-6">
            <button onClick={handleReset}
              className="flex items-center gap-2 text-sm font-bold px-8 py-3 rounded-xl"
              style={{ background: '#0C1A3D', color: '#fff', border: '1px solid #D4A017' }}>
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
    </div>
  )
}
