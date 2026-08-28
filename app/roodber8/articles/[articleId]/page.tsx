/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Trash2, Edit3, Loader2, FileText, Save,
  ChevronDown, ChevronUp, AlertTriangle, ExternalLink,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Article {
  id:                  string
  title:               string
  slug:                string
  content:             string
  excerpt?:            string
  category?:           string
  category_title?:     string
  exam_body?:          string[]
  show_on_sites?:      string[]
  featured_image_url?: string
  seo_title?:          string
  seo_description?:    string
  mcq_url?:            string
  read_time?:          number
  author_name?:        string
  last_reviewed?:      string
  status?:             string
  platform?:           string
  canonical_owner?:    string
  wp_id?:              string
  content_id?:         string
  ai_summary?:         string
  ai_key_terms?:       string[]
  ai_searchable?:      boolean
  eticpa_level?:       string
  eticpa_module?:      string
  eticpa_topic?:       string
  content_type?:       string
  difficulty?:         string
  published_at?:       string
  created_at?:         string
  updated_at?:         string
}

// Every field the PATCH route will accept — kept in sync with
// app/api/roodber8/articles/[articleId]/route.ts's ALLOWED_FIELDS.
const ALLOWED_FIELDS = [
  'title', 'slug', 'content', 'excerpt', 'category', 'category_title',
  'exam_body', 'show_on_sites', 'featured_image_url', 'seo_title',
  'seo_description', 'mcq_url', 'read_time', 'author_name',
  'last_reviewed', 'status', 'canonical_owner', 'ai_summary',
  'ai_key_terms', 'ai_searchable', 'eticpa_level', 'eticpa_module',
  'eticpa_topic', 'content_type', 'difficulty',
]

// ── Style constants ───────────────────────────────────────────────────────────

const C = {
  card:    { background: '#0d1424', border: '1px solid #1a2238', borderRadius: 16 },
  input:   { background: '#111827', border: '1px solid #1f2937', borderRadius: 10, color: '#fff' },
  active:  { background: 'rgba(212,160,23,0.12)', border: '1px solid #D4A017', color: '#fff' },
  idle:    { background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#64748b' },
  danger:  { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' },
  success: { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' },
  warning: { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' },
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
// The show_on_sites column stores SITE_CODE_MAP codes ('ab'/'et'), not full
// site names — editing must toggle the same codes already on the row,
// otherwise saving would silently drop the article from public site filters
// (e.g. lib/db.ts's `.contains('show_on_sites', ['ab'])`).
const SITE_CODES = [
  { code: 'ab', label: 'AB' },
  { code: 'et', label: 'ET' },
]

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ArticleEditorPage() {
  const params    = useParams()
  const router    = useRouter()
  const articleId = params.articleId as string

  const [article, setArticle]   = useState<Article | null>(null)
  const [draft, setDraft]       = useState<Article | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  const [editing, setEditing]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState('')

  const [confirmDel, setConfirmDel]   = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [showContent, setShowContent] = useState(false)

  const fetchArticle = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/roodber8/articles/${articleId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setArticle(data.article)
      setDraft({ ...data.article })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [articleId])

  useEffect(() => { fetchArticle() }, [fetchArticle])

  function resetDraft() {
    if (article) setDraft({ ...article })
    setEditing(false)
    setSaveError('')
  }

  async function handleSave() {
    if (!draft) return
    setSaving(true); setSaveError('')
    try {
      const fields: Record<string, any> = {}
      for (const key of ALLOWED_FIELDS) {
        if (key in draft) fields[key] = (draft as any)[key]
      }

      const res = await fetch(`/api/roodber8/articles/${articleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setArticle(draft)
      setEditing(false)
    } catch (e: any) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true); setDeleteError('')
    try {
      const res = await fetch(`/api/roodber8/articles/${articleId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      router.push('/roodber8/articles')
    } catch (e: any) {
      setDeleteError(e.message)
      setConfirmDel(false)
    } finally {
      setDeleting(false)
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <Loader2 size={28} className="animate-spin" style={{ color: '#D4A017' }} />
      </div>
    )
  }

  // ── Error ──
  if (error || !article || !draft) {
    return (
      <div className="p-8">
        <Link href="/roodber8/articles"
          className="flex items-center gap-2 text-sm font-semibold mb-6"
          style={{ color: '#475569' }}>
          <ArrowLeft size={15} /> Back to Articles
        </Link>
        <div className="rounded-2xl p-6" style={C.danger}>
          <p className="font-bold mb-1">Failed to load article</p>
          <p className="text-sm">{error || 'Article not found'}</p>
        </div>
      </div>
    )
  }

  const diff = DIFF_STYLE[article.difficulty ?? ''] ?? null

  return (
    <div className="p-8 max-w-5xl">

      {confirmDel && (
        <ConfirmModal
          title="Delete this article?"
          message={`"${article.title}" will be permanently deleted. This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDel(false)}
          loading={deleting}
        />
      )}

      {/* ── Back link ── */}
      <Link href="/roodber8/articles"
        className="flex items-center gap-2 text-sm font-semibold mb-6 w-fit"
        style={{ color: '#475569' }}>
        <ArrowLeft size={15} /> Back to Articles
      </Link>

      {/* ── Header (view mode) ── */}
      {!editing && (
        <div className="rounded-2xl border p-6 mb-6" style={C.card}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(212,160,23,0.12)' }}>
                  <FileText size={18} style={{ color: '#D4A017' }} />
                </div>
                <h1 className="text-xl font-black text-white leading-tight">{article.title}</h1>
              </div>
              <div className="flex items-center gap-3 flex-wrap mt-1">
                {(article.category_title || article.category) && (
                  <span className="text-sm" style={{ color: '#475569' }}>
                    {article.category_title || article.category}
                  </span>
                )}
                {article.author_name && (
                  <span className="text-sm" style={{ color: '#475569' }}>{article.author_name}</span>
                )}
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg capitalize"
                  style={article.status === 'published' ? C.success : C.idle}>
                  {article.status ?? 'draft'}
                </span>
                {article.exam_body?.[0] && (
                  <span className="text-xs font-bold uppercase px-2.5 py-1 rounded-lg"
                    style={{ background: 'rgba(212,160,23,0.1)', color: '#D4A017' }}>
                    {article.exam_body[0]}
                  </span>
                )}
                {diff && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg capitalize"
                    style={{ background: diff.bg, color: diff.color, border: `1px solid ${diff.border}` }}>
                    {article.difficulty}
                  </span>
                )}
                {article.read_time != null && (
                  <span className="text-xs" style={{ color: '#334155' }}>{article.read_time} min read</span>
                )}
                <span className="text-xs" style={{ color: '#334155' }}>
                  {article.created_at
                    ? new Date(article.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '—'}
                </span>
              </div>
              {article.excerpt && (
                <p className="text-sm mt-3 leading-relaxed" style={{ color: '#475569' }}>{article.excerpt}</p>
              )}
              {article.status === 'published' && article.slug && (
                <a href={`/articles/${article.slug}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-semibold mt-3 flex items-center gap-1 w-fit" style={{ color: '#2563eb' }}>
                  View live <ExternalLink size={11} />
                </a>
              )}
            </div>

            {/* Header actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl"
                style={{ background: 'rgba(37,99,235,0.1)', color: '#3b82f6', border: '1px solid rgba(37,99,235,0.2)' }}>
                <Edit3 size={12} /> Edit
              </button>
              <button onClick={() => setConfirmDel(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
          {deleteError && (
            <div className="rounded-xl px-4 py-3 mt-4 text-sm" style={C.danger}>{deleteError}</div>
          )}
        </div>
      )}

      {/* ── Edit mode ── */}
      {editing && (
        <div className="rounded-2xl border mb-6" style={C.card}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#1a2238' }}>
            <p className="text-white font-bold text-sm">Edit Article</p>
          </div>
          <div className="p-5 space-y-4">
            {saveError && (
              <div className="rounded-xl px-4 py-3 text-sm" style={C.danger}>{saveError}</div>
            )}

            <FieldInput label="Title" value={draft.title} onChange={v => setDraft(d => d && ({ ...d, title: v }))} />

            <div>
              <FieldInput label="Slug" value={draft.slug} onChange={v => setDraft(d => d && ({ ...d, slug: v }))} />
              {draft.slug !== article.slug && (
                <p className="text-xs mt-1.5" style={{ color: '#f59e0b' }}>
                  ⚠ Changing the slug breaks existing links — only change if you know what you&apos;re doing
                </p>
              )}
            </div>

            <FieldInput label="Excerpt" value={draft.excerpt ?? ''} onChange={v => setDraft(d => d && ({ ...d, excerpt: v }))} multiline rows={3} />
            <FieldInput label="Author" value={draft.author_name ?? ''} onChange={v => setDraft(d => d && ({ ...d, author_name: v }))} />

            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Category</p>
              <div className="grid grid-cols-3 gap-2">
                {KNOWN_CATEGORIES.map(cat => (
                  <button key={cat.slug}
                    onClick={() => setDraft(d => d && ({ ...d, category: cat.slug, category_title: cat.label }))}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-left"
                    style={draft.category === cat.slug ? C.active : C.idle}>
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
                    <button key={s} onClick={() => setDraft(d => d && ({ ...d, status: s }))}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize"
                      style={draft.status === s ? (s === 'published' ? C.success : C.active) : C.idle}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Difficulty</p>
                <div className="flex gap-2">
                  {DIFFICULTIES.map(dKey => {
                    const s = DIFF_STYLE[dKey]
                    return (
                      <button key={dKey} onClick={() => setDraft(d => d && ({ ...d, difficulty: dKey }))}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize"
                        style={draft.difficulty === dKey ? { background: s.bg, color: s.color, border: `1px solid ${s.border}` } : C.idle}>
                        {dKey}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Exam Body</p>
              <div className="flex gap-2 flex-wrap">
                {EXAM_BODIES.map(b => {
                  const active = (draft.exam_body ?? []).includes(b)
                  return (
                    <button key={b}
                      onClick={() => setDraft(d => {
                        if (!d) return d
                        const current = d.exam_body ?? []
                        const next = current.includes(b) ? current.filter(x => x !== b) : [...current, b]
                        return { ...d, exam_body: next }
                      })}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase"
                      style={active ? C.active : C.idle}>
                      {b}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Show On Sites</p>
              <div className="flex gap-2">
                {SITE_CODES.map(site => {
                  const active = (draft.show_on_sites ?? []).includes(site.code)
                  return (
                    <button key={site.code}
                      onClick={() => setDraft(d => {
                        if (!d) return d
                        const current = d.show_on_sites ?? []
                        const next = current.includes(site.code) ? current.filter(x => x !== site.code) : [...current, site.code]
                        return { ...d, show_on_sites: next }
                      })}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                      style={active ? C.active : C.idle}>
                      {site.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#475569' }}>SEO Title</p>
                <p className="text-xs" style={{ color: (draft.seo_title ?? '').length > 60 ? '#f59e0b' : '#334155' }}>
                  {(draft.seo_title ?? '').length} / 60
                </p>
              </div>
              <input type="text" value={draft.seo_title ?? ''} onChange={e => setDraft(d => d && ({ ...d, seo_title: e.target.value }))}
                className="w-full px-3 py-2 text-sm focus:outline-none" style={C.input} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#475569' }}>SEO Description</p>
                <p className="text-xs" style={{ color: (draft.seo_description ?? '').length > 160 ? '#f59e0b' : '#334155' }}>
                  {(draft.seo_description ?? '').length} / 160
                </p>
              </div>
              <textarea rows={2} value={draft.seo_description ?? ''} onChange={e => setDraft(d => d && ({ ...d, seo_description: e.target.value }))}
                className="w-full px-3 py-2 text-sm resize-none focus:outline-none" style={C.input} />
            </div>

            <FieldInput label="Featured Image URL" value={draft.featured_image_url ?? ''} onChange={v => setDraft(d => d && ({ ...d, featured_image_url: v }))} />

            <div>
              <div className="rounded-xl px-4 py-3 mb-3 flex gap-2" style={C.warning}>
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <p className="text-xs">You are editing raw HTML. Be careful not to break the document structure.</p>
              </div>
              <FieldInput label="Content (raw HTML)" value={draft.content} onChange={v => setDraft(d => d && ({ ...d, content: v }))} multiline rows={20} />
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
        </div>
      )}

      {/* ── Content preview (always visible) ── */}
      <div className="rounded-2xl border overflow-hidden" style={C.card}>
        <button
          onClick={() => setShowContent(v => !v)}
          className="w-full px-5 py-4 border-b flex items-center justify-between"
          style={{ borderColor: '#1a2238' }}>
          <p className="text-white font-bold text-sm">Content</p>
          <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#475569' }}>
            {showContent ? 'Hide Content' : 'Show Content'}
            {showContent ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>
        <div className="p-5">
          {showContent ? (
            <div
              className="text-sm leading-relaxed max-w-prose"
              style={{ color: '#94a3b8' }}
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          ) : (
            <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>
              {stripHtml(article.content).slice(0, 300)}
              {stripHtml(article.content).length > 300 ? '…' : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
