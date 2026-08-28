/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Trash2, Plus, ChevronDown, ChevronUp,
  ArrowUp, ArrowDown, AlertTriangle, Loader2, BookOpen,
  ExternalLink, Search, X, CheckCircle2,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface ArticleLink {
  id: string; title: string; slug: string
  excerpt?: string; read_time?: number; article_order: number
}
interface LessonRow {
  id: string; title: string; slug: string; lesson_order: number
  articles: ArticleLink[]
}
interface ChapterRow {
  id: string; chapter_title: string; chapter_order: number
  lessons: LessonRow[]
}
interface CourseData {
  id: string; title: string; slug: string; description: string
  level: string; status: string; is_featured: boolean
  show_on_sites: string[]; canonical_owner: string
}

interface ArticleSearchResult {
  id: string; title: string; slug: string
  excerpt?: string; category_title?: string; read_time?: number
}

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

const LEVELS = ['beginner', 'intermediate', 'advanced']
const STATUSES = ['draft', 'published', 'archived']
const SHOW_ON_SITES_OPTIONS = [{ code: 'ab', label: 'AB' }, { code: 'et', label: 'ET' }]
const CANONICAL_OPTIONS = [{ value: 'accountingbody', label: 'AB' }, { value: 'ethiotax', label: 'ET' }]

// ── Small helpers ─────────────────────────────────────────────────────────────

function SaveStatus({ saving, saved, error }: { saving?: boolean; saved?: boolean; error?: string }) {
  if (saving) return <Loader2 size={12} className="animate-spin" style={{ color: '#D4A017' }} />
  if (error) return <span className="text-xs" style={{ color: '#ef4444' }}>{error}</span>
  if (saved) return <span className="text-xs font-semibold" style={{ color: '#10b981' }}>✓ Saved</span>
  return null
}

function FieldInput({
  label, value, onChange, onBlur, multiline = false, rows = 3, status,
}: {
  label: string; value: string; onChange: (v: string) => void; onBlur?: () => void
  multiline?: boolean; rows?: number; status?: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#475569' }}>{label}</p>
        {status}
      </div>
      {multiline ? (
        <textarea
          rows={rows}
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          className="w-full px-3 py-2 text-sm resize-none focus:outline-none"
          style={C.input}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          className="w-full px-3 py-2 text-sm focus:outline-none"
          style={C.input}
        />
      )}
    </div>
  )
}

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

// ── Article search panel ──────────────────────────────────────────────────────

function ArticleSearchPanel({ onSelect }: { onSelect: (article: ArticleSearchResult) => void }) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<ArticleSearchResult[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/roodber8/articles/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(data.articles ?? [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <Search size={13} style={{ color: '#475569' }} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search articles to add..."
          className="bg-transparent text-white text-sm flex-1 focus:outline-none placeholder-slate-600"
        />
        {searching && <Loader2 size={13} className="animate-spin" style={{ color: '#D4A017' }} />}
      </div>

      {query.trim() && !searching && results.length === 0 && (
        <p className="text-xs mt-2 px-1" style={{ color: '#475569' }}>No results.</p>
      )}

      {results.length > 0 && (
        <div className="mt-2 rounded-xl border overflow-hidden" style={{ borderColor: '#1f2937' }}>
          {results.map(a => (
            <button
              key={a.id}
              onClick={() => { onSelect(a); setQuery(''); setResults([]) }}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left border-b last:border-0 hover:bg-white/[0.03] transition-colors"
              style={{ borderColor: '#1f2937' }}
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{a.title}</p>
                <p className="text-xs truncate" style={{ color: '#475569' }}>
                  {a.category_title ?? ''}{a.category_title && a.read_time ? ' · ' : ''}{a.read_time ? `${a.read_time} min` : ''}
                </p>
              </div>
              <Plus size={13} style={{ color: '#D4A017' }} className="shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Chapter card ───────────────────────────────────────────────────────────────

function ChapterCard({
  chapter, index, totalChapters,
  onMoveChapter, onDeleteChapter, onTitleChange, onTitleBlurSave,
  onAddLesson, onMoveLesson, onDeleteLesson,
  onLessonTitleChange, onLessonTitleBlurSave,
  onAddArticle, onRemoveArticle, onMoveArticle,
}: {
  chapter: ChapterRow; index: number; totalChapters: number
  onMoveChapter: (dir: -1 | 1) => void
  onDeleteChapter: () => void
  onTitleChange: (title: string) => void
  onTitleBlurSave: (title: string) => void
  onAddLesson: (title: string) => Promise<void>
  onMoveLesson: (lessonId: string, dir: -1 | 1) => void
  onDeleteLesson: (lessonId: string) => void
  onLessonTitleChange: (lessonId: string, title: string) => void
  onLessonTitleBlurSave: (lessonId: string, title: string) => void
  onAddArticle: (lessonId: string, article: ArticleSearchResult) => void
  onRemoveArticle: (lessonId: string, articleId: string) => void
  onMoveArticle: (lessonId: string, articleId: string, dir: -1 | 1) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(new Set())
  const [confirmDeleteLesson, setConfirmDeleteLesson] = useState<string | null>(null)
  const [addLessonOpen, setAddLessonOpen] = useState(false)
  const [newLessonTitle, setNewLessonTitle] = useState('')
  const [addingLesson, setAddingLesson] = useState(false)

  function toggleExpanded(lessonId: string) {
    setExpandedLessons(prev => {
      const next = new Set(prev)
      if (next.has(lessonId)) next.delete(lessonId)
      else next.add(lessonId)
      return next
    })
  }

  async function handleConfirmAddLesson() {
    if (!newLessonTitle.trim()) return
    setAddingLesson(true)
    try {
      await onAddLesson(newLessonTitle.trim())
      setNewLessonTitle('')
      setAddLessonOpen(false)
    } catch {
      // error surfaced via parent's actionError banner
    } finally {
      setAddingLesson(false)
    }
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={C.card}>
      {confirmDelete && (
        <ConfirmModal
          title="Delete this chapter?"
          message={`"${chapter.chapter_title}" and all ${chapter.lessons.length} lesson${chapter.lessons.length !== 1 ? 's' : ''} inside it will be permanently deleted.`}
          onConfirm={() => { onDeleteChapter(); setConfirmDelete(false) }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {confirmDeleteLesson && (
        <ConfirmModal
          title="Delete this lesson?"
          message="This lesson and its article links will be permanently deleted."
          onConfirm={() => { onDeleteLesson(confirmDeleteLesson); setConfirmDeleteLesson(null) }}
          onCancel={() => setConfirmDeleteLesson(null)}
        />
      )}

      {/* Chapter header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ background: '#111827', borderColor: '#1a2238' }}>
        <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ background: '#D4A017', color: '#0C1A3D' }}>
          {index + 1}
        </span>
        <input
          type="text"
          value={chapter.chapter_title}
          onChange={e => onTitleChange(e.target.value)}
          onBlur={e => onTitleBlurSave(e.target.value)}
          className="flex-1 h-8 px-2 text-sm font-semibold focus:outline-none"
          style={C.input}
        />
        <button onClick={() => onMoveChapter(-1)} disabled={index === 0}
          className="p-1 disabled:opacity-20 transition-colors" style={{ color: '#475569' }}>
          <ArrowUp size={14} />
        </button>
        <button onClick={() => onMoveChapter(1)} disabled={index === totalChapters - 1}
          className="p-1 disabled:opacity-20 transition-colors" style={{ color: '#475569' }}>
          <ArrowDown size={14} />
        </button>
        <button onClick={() => setConfirmDelete(true)} className="p-1 transition-colors" style={{ color: '#ef4444' }}>
          <Trash2 size={14} />
        </button>
      </div>

      {/* Lessons */}
      <div className="divide-y" style={{ borderColor: '#1a2238' }}>
        {chapter.lessons.length === 0 ? (
          <p className="text-xs px-4 py-3 italic" style={{ color: '#475569' }}>No lessons yet.</p>
        ) : (
          chapter.lessons.map((lesson, li) => {
            const expanded = expandedLessons.has(lesson.id)
            return (
              <div key={lesson.id} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs w-5 shrink-0" style={{ color: '#475569' }}>{li + 1}.</span>
                  <input
                    type="text"
                    value={lesson.title}
                    onChange={e => onLessonTitleChange(lesson.id, e.target.value)}
                    onBlur={e => onLessonTitleBlurSave(lesson.id, e.target.value)}
                    className="flex-1 h-8 px-2 text-sm focus:outline-none"
                    style={C.input}
                  />
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-lg shrink-0"
                    style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                    {lesson.articles.length} article{lesson.articles.length !== 1 ? 's' : ''}
                  </span>
                  <button onClick={() => onMoveLesson(lesson.id, -1)} disabled={li === 0}
                    className="p-1 disabled:opacity-20 transition-colors" style={{ color: '#475569' }}>
                    <ArrowUp size={13} />
                  </button>
                  <button onClick={() => onMoveLesson(lesson.id, 1)} disabled={li === chapter.lessons.length - 1}
                    className="p-1 disabled:opacity-20 transition-colors" style={{ color: '#475569' }}>
                    <ArrowDown size={13} />
                  </button>
                  <button onClick={() => setConfirmDeleteLesson(lesson.id)} className="p-1 transition-colors" style={{ color: '#ef4444' }}>
                    <X size={14} />
                  </button>
                  <button onClick={() => toggleExpanded(lesson.id)} className="p-1 transition-colors" style={{ color: '#475569' }}>
                    {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>

                {expanded && (
                  <div className="pl-7 mt-2">
                    {lesson.articles.length === 0 ? (
                      <p className="text-xs italic" style={{ color: '#475569' }}>No articles — search below to add</p>
                    ) : (
                      <div className="space-y-1.5">
                        {lesson.articles.map((article, ai) => (
                          <div key={article.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <span className="text-xs flex-1 truncate text-white">{article.title}</span>
                            {article.read_time != null && (
                              <span className="text-xs shrink-0" style={{ color: '#475569' }}>{article.read_time} min</span>
                            )}
                            <button onClick={() => onMoveArticle(lesson.id, article.id, -1)} disabled={ai === 0}
                              className="p-0.5 disabled:opacity-20 transition-colors shrink-0" style={{ color: '#475569' }}>
                              <ArrowUp size={12} />
                            </button>
                            <button onClick={() => onMoveArticle(lesson.id, article.id, 1)} disabled={ai === lesson.articles.length - 1}
                              className="p-0.5 disabled:opacity-20 transition-colors shrink-0" style={{ color: '#475569' }}>
                              <ArrowDown size={12} />
                            </button>
                            <button onClick={() => onRemoveArticle(lesson.id, article.id)}
                              className="p-0.5 transition-colors shrink-0" style={{ color: '#ef4444' }}>
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <ArticleSearchPanel onSelect={article => onAddArticle(lesson.id, article)} />
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Add lesson */}
      <div className="px-4 py-3 border-t" style={{ borderColor: '#1a2238' }}>
        {addLessonOpen ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newLessonTitle}
              onChange={e => setNewLessonTitle(e.target.value)}
              placeholder="Lesson title..."
              className="flex-1 h-9 px-3 text-sm focus:outline-none"
              style={C.input}
              autoFocus
            />
            <button onClick={handleConfirmAddLesson} disabled={addingLesson || !newLessonTitle.trim()}
              className="h-9 px-4 rounded-lg text-xs font-bold disabled:opacity-40"
              style={{ background: '#D4A017', color: '#0C1A3D' }}>
              {addingLesson ? <Loader2 size={13} className="animate-spin" /> : 'Confirm'}
            </button>
            <button onClick={() => { setAddLessonOpen(false); setNewLessonTitle('') }}
              className="h-9 px-4 rounded-lg text-xs font-semibold" style={C.idle}>
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setAddLessonOpen(true)}
            className="text-xs font-bold px-3 py-2 rounded-lg"
            style={{ background: 'rgba(212,160,23,0.08)', border: '1px solid #D4A017', color: '#D4A017' }}>
            + Add Lesson
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CourseEditorPage() {
  const params   = useParams()
  const router   = useRouter()
  const courseId = params.courseId as string

  const [course, setCourse]     = useState<CourseData | null>(null)
  const [chapters, setChapters] = useState<ChapterRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')

  const [titleDraft, setTitleDraft] = useState('')
  const [descDraft, setDescDraft]   = useState('')

  const [metaSaving, setMetaSaving] = useState<Record<string, boolean>>({})
  const [metaSaved, setMetaSaved]   = useState<Record<string, boolean>>({})
  const [metaError, setMetaError]   = useState<Record<string, string>>({})

  const [addingChapter, setAddingChapter] = useState(false)
  const [confirmDeleteCourse, setConfirmDeleteCourse] = useState(false)
  const [deletingCourse, setDeletingCourse] = useState(false)
  const [deleteCourseError, setDeleteCourseError] = useState('')

  const fetchCourse = useCallback(async () => {
    setLoading(true); setLoadError('')
    try {
      const res = await fetch(`/api/roodber8/courses/${courseId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setCourse(data.course)
      setChapters(data.chapters ?? [])
      setTitleDraft(data.course.title)
      setDescDraft(data.course.description ?? '')
    } catch (e: any) {
      setLoadError(e.message)
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => { fetchCourse() }, [fetchCourse])

  useEffect(() => {
    if (actionError) {
      const t = setTimeout(() => setActionError(''), 5000)
      return () => clearTimeout(t)
    }
  }, [actionError])

  async function patchAction(action: string, extra: Record<string, unknown> = {}) {
    const res = await fetch(`/api/roodber8/courses/${courseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }

  // ── Metadata save ──────────────────────────────────────────────────────
  async function saveMetadata(fieldKey: string, patch: Record<string, unknown>) {
    setMetaSaving(s => ({ ...s, [fieldKey]: true }))
    setMetaError(e => ({ ...e, [fieldKey]: '' }))
    try {
      await patchAction('update_metadata', patch)
      setMetaSaved(s => ({ ...s, [fieldKey]: true }))
      setTimeout(() => setMetaSaved(s => ({ ...s, [fieldKey]: false })), 2000)
    } catch (e: any) {
      setMetaError(err => ({ ...err, [fieldKey]: e.message }))
    } finally {
      setMetaSaving(s => ({ ...s, [fieldKey]: false }))
    }
  }

  function updateCourseField(patch: Partial<CourseData>, fieldKey: string) {
    setCourse(c => c ? { ...c, ...patch } : c)
    saveMetadata(fieldKey, patch)
  }

  // ── Chapter handlers ───────────────────────────────────────────────────
  async function handleAddChapter() {
    setAddingChapter(true)
    try {
      const data = await patchAction('add_chapter')
      setChapters(prev => [...prev, { ...data.chapter, lessons: [] }])
    } catch (e: any) {
      setActionError(e.message)
    } finally {
      setAddingChapter(false)
    }
  }

  function updateChapterTitleLocal(chapterId: string, title: string) {
    setChapters(prev => prev.map(ch => ch.id === chapterId ? { ...ch, chapter_title: title } : ch))
  }

  async function saveChapterTitle(chapterId: string, title: string) {
    try {
      await patchAction('update_chapter', { chapterId, chapter_title: title })
    } catch (e: any) {
      setActionError(e.message)
    }
  }

  async function handleMoveChapter(index: number, direction: -1 | 1) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= chapters.length) return
    const reordered = [...chapters]
    ;[reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]]
    setChapters(reordered)
    try {
      await patchAction('reorder_chapters', { orderedIds: reordered.map(ch => ch.id) })
    } catch (e: any) {
      setActionError(e.message)
    }
  }

  async function handleDeleteChapter(chapterId: string) {
    try {
      await patchAction('delete_chapter', { chapterId })
      setChapters(prev => prev.filter(ch => ch.id !== chapterId))
    } catch (e: any) {
      setActionError(e.message)
    }
  }

  // ── Lesson handlers ────────────────────────────────────────────────────
  function updateLessonTitleLocal(chapterId: string, lessonId: string, title: string) {
    setChapters(prev => prev.map(ch => ch.id !== chapterId ? ch : {
      ...ch, lessons: ch.lessons.map(l => l.id === lessonId ? { ...l, title } : l),
    }))
  }

  async function saveLessonTitle(lessonId: string, title: string) {
    try {
      await patchAction('update_lesson', { lessonId, title })
    } catch (e: any) {
      setActionError(e.message)
    }
  }

  async function handleAddLesson(chapterId: string, title: string) {
    const data = await patchAction('add_lesson', { chapterId, title })
    setChapters(prev => prev.map(ch => ch.id === chapterId
      ? { ...ch, lessons: [...ch.lessons, { ...data.lesson, articles: [] }] }
      : ch))
  }

  async function handleDeleteLesson(chapterId: string, lessonId: string) {
    try {
      await patchAction('delete_lesson', { lessonId })
      setChapters(prev => prev.map(ch => ch.id === chapterId
        ? { ...ch, lessons: ch.lessons.filter(l => l.id !== lessonId) }
        : ch))
    } catch (e: any) {
      setActionError(e.message)
    }
  }

  async function handleMoveLesson(chapterId: string, lessonId: string, direction: -1 | 1) {
    const chapter = chapters.find(ch => ch.id === chapterId)
    if (!chapter) return
    const idx = chapter.lessons.findIndex(l => l.id === lessonId)
    const newIdx = idx + direction
    if (idx === -1 || newIdx < 0 || newIdx >= chapter.lessons.length) return
    const lessons = [...chapter.lessons]
    ;[lessons[idx], lessons[newIdx]] = [lessons[newIdx], lessons[idx]]
    setChapters(prev => prev.map(ch => ch.id === chapterId ? { ...ch, lessons } : ch))
    try {
      await patchAction('reorder_lessons', { chapterId, orderedIds: lessons.map(l => l.id) })
    } catch (e: any) {
      setActionError(e.message)
    }
  }

  // ── Article handlers ───────────────────────────────────────────────────
  async function handleAddArticle(chapterId: string, lessonId: string, article: ArticleSearchResult) {
    try {
      await patchAction('add_article', { lessonId, articleId: article.id })
      setChapters(prev => prev.map(ch => ch.id !== chapterId ? ch : {
        ...ch,
        lessons: ch.lessons.map(l => l.id !== lessonId ? l : {
          ...l,
          articles: [...l.articles, {
            id: article.id, title: article.title, slug: article.slug,
            excerpt: article.excerpt, read_time: article.read_time,
            article_order: l.articles.length + 1,
          }],
        }),
      }))
    } catch (e: any) {
      setActionError(e.message)
    }
  }

  async function handleRemoveArticle(chapterId: string, lessonId: string, articleId: string) {
    try {
      await patchAction('remove_article', { lessonId, articleId })
      setChapters(prev => prev.map(ch => ch.id !== chapterId ? ch : {
        ...ch,
        lessons: ch.lessons.map(l => l.id !== lessonId ? l : { ...l, articles: l.articles.filter(a => a.id !== articleId) }),
      }))
    } catch (e: any) {
      setActionError(e.message)
    }
  }

  async function handleMoveArticle(chapterId: string, lessonId: string, articleId: string, direction: -1 | 1) {
    const chapter = chapters.find(ch => ch.id === chapterId)
    const lesson = chapter?.lessons.find(l => l.id === lessonId)
    if (!lesson) return
    const idx = lesson.articles.findIndex(a => a.id === articleId)
    const newIdx = idx + direction
    if (idx === -1 || newIdx < 0 || newIdx >= lesson.articles.length) return
    const articles = [...lesson.articles]
    ;[articles[idx], articles[newIdx]] = [articles[newIdx], articles[idx]]
    setChapters(prev => prev.map(ch => ch.id !== chapterId ? ch : {
      ...ch,
      lessons: ch.lessons.map(l => l.id !== lessonId ? l : { ...l, articles }),
    }))
    try {
      await patchAction('reorder_articles', { lessonId, orderedIds: articles.map(a => a.id) })
    } catch (e: any) {
      setActionError(e.message)
    }
  }

  // ── Delete course ──────────────────────────────────────────────────────
  async function handleDeleteCourse() {
    setDeletingCourse(true); setDeleteCourseError('')
    try {
      const res = await fetch(`/api/roodber8/courses/${courseId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Delete failed')
      router.push('/roodber8/courses')
    } catch (e: any) {
      setDeleteCourseError(e.message)
      setConfirmDeleteCourse(false)
    } finally {
      setDeletingCourse(false)
    }
  }

  // ── Loading / error states ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <Loader2 size={28} className="animate-spin" style={{ color: '#D4A017' }} />
      </div>
    )
  }

  if (loadError || !course) {
    return (
      <div className="p-8">
        <Link href="/roodber8/courses"
          className="flex items-center gap-2 text-sm font-semibold mb-6"
          style={{ color: '#475569' }}>
          <ArrowLeft size={15} /> Back to Courses
        </Link>
        <div className="rounded-2xl p-6" style={C.danger}>
          <p className="font-bold mb-1">Failed to load course</p>
          <p className="text-sm">{loadError || 'Course not found'}</p>
        </div>
      </div>
    )
  }

  // ── Derived values ─────────────────────────────────────────────────────
  const totalLessons = chapters.reduce((sum, ch) => sum + ch.lessons.length, 0)
  const totalArticles = chapters.reduce((sum, ch) => sum + ch.lessons.reduce((s, l) => s + l.articles.length, 0), 0)

  const checks = [
    { label: 'Has title', pass: !!course.title.trim() },
    { label: 'At least 1 chapter', pass: chapters.length > 0 },
    { label: 'All chapters have at least 1 lesson', pass: chapters.length > 0 && chapters.every(ch => ch.lessons.length > 0) },
    { label: 'All lessons have at least 1 article', pass: chapters.length > 0 && chapters.every(ch => ch.lessons.length > 0 && ch.lessons.every(l => l.articles.length > 0)) },
    { label: 'Status is published', pass: course.status === 'published' },
  ]
  const issueCount = checks.filter(c => !c.pass).length

  return (
    <div className="p-8 max-w-6xl">

      {confirmDeleteCourse && (
        <ConfirmModal
          title="Delete this course?"
          message={`"${course.title}" and all ${chapters.length} chapter${chapters.length !== 1 ? 's' : ''} and lesson${totalLessons !== 1 ? 's' : ''} will be permanently deleted.`}
          onConfirm={handleDeleteCourse}
          onCancel={() => setConfirmDeleteCourse(false)}
          loading={deletingCourse}
        />
      )}

      <Link href="/roodber8/courses"
        className="flex items-center gap-2 text-sm font-semibold mb-6 w-fit"
        style={{ color: '#475569' }}>
        <ArrowLeft size={15} /> Back to Courses
      </Link>

      {actionError && (
        <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={C.danger}>{actionError}</div>
      )}

      <div className="flex gap-6 items-start">

        {/* ── Left panel ── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Metadata editor */}
          <div className="rounded-2xl border p-6 space-y-4" style={C.card}>
            <h2 className="text-lg font-bold text-white">Course Details</h2>

            <FieldInput
              label="Title"
              value={titleDraft}
              onChange={setTitleDraft}
              onBlur={() => updateCourseField({ title: titleDraft }, 'title')}
              status={<SaveStatus saving={metaSaving.title} saved={metaSaved.title} error={metaError.title} />}
            />

            <FieldInput
              label="Description"
              value={descDraft}
              onChange={setDescDraft}
              onBlur={() => updateCourseField({ description: descDraft }, 'description')}
              multiline rows={3}
              status={<SaveStatus saving={metaSaving.description} saved={metaSaved.description} error={metaError.description} />}
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#475569' }}>Level</p>
                <SaveStatus saving={metaSaving.level} saved={metaSaved.level} error={metaError.level} />
              </div>
              <div className="flex gap-2">
                {LEVELS.map(l => (
                  <button key={l} onClick={() => updateCourseField({ level: l }, 'level')}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                    style={course.level === l ? C.active : C.idle}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#475569' }}>Status</p>
                <SaveStatus saving={metaSaving.status} saved={metaSaved.status} error={metaError.status} />
              </div>
              <div className="flex gap-2">
                {STATUSES.map(s => (
                  <button key={s} onClick={() => updateCourseField({ status: s }, 'status')}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                    style={course.status === s
                      ? (s === 'published' ? C.success : s === 'draft' ? C.active : C.idle)
                      : C.idle}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={course.is_featured}
                onChange={e => updateCourseField({ is_featured: e.target.checked }, 'is_featured')}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm" style={{ color: '#64748b' }}>Feature this course on the homepage</span>
              <SaveStatus saving={metaSaving.is_featured} saved={metaSaved.is_featured} error={metaError.is_featured} />
            </label>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#475569' }}>Show On Sites</p>
                <SaveStatus saving={metaSaving.show_on_sites} saved={metaSaved.show_on_sites} error={metaError.show_on_sites} />
              </div>
              <div className="flex gap-2">
                {SHOW_ON_SITES_OPTIONS.map(site => (
                  <button key={site.code}
                    onClick={() => {
                      const next = course.show_on_sites.includes(site.code)
                        ? course.show_on_sites.filter(s => s !== site.code)
                        : [...course.show_on_sites, site.code]
                      updateCourseField({ show_on_sites: next }, 'show_on_sites')
                    }}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={course.show_on_sites.includes(site.code) ? C.active : C.idle}>
                    {site.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#475569' }}>Canonical Owner</p>
                <SaveStatus saving={metaSaving.canonical_owner} saved={metaSaved.canonical_owner} error={metaError.canonical_owner} />
              </div>
              <div className="flex gap-2">
                {CANONICAL_OPTIONS.map(opt => (
                  <button key={opt.value}
                    onClick={() => updateCourseField({ canonical_owner: opt.value }, 'canonical_owner')}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={course.canonical_owner === opt.value
                      ? { background: 'rgba(16,185,129,0.12)', border: '1px solid #10b981', color: '#10b981' }
                      : C.idle}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Course structure */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Course Structure</h2>
              <button onClick={handleAddChapter} disabled={addingChapter}
                className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-40"
                style={{ background: '#D4A017', color: '#0C1A3D' }}>
                {addingChapter ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Add Chapter
              </button>
            </div>

            {chapters.length === 0 ? (
              <div className="rounded-2xl border p-10 text-center" style={C.card}>
                <BookOpen size={28} className="mx-auto mb-3" style={{ color: '#1a2238' }} />
                <p className="text-white font-semibold mb-1">No chapters yet</p>
                <p className="text-sm" style={{ color: '#334155' }}>Add your first chapter to start building this course.</p>
              </div>
            ) : (
              chapters.map((chapter, ci) => (
                <ChapterCard
                  key={chapter.id}
                  chapter={chapter}
                  index={ci}
                  totalChapters={chapters.length}
                  onMoveChapter={dir => handleMoveChapter(ci, dir)}
                  onDeleteChapter={() => handleDeleteChapter(chapter.id)}
                  onTitleChange={title => updateChapterTitleLocal(chapter.id, title)}
                  onTitleBlurSave={title => saveChapterTitle(chapter.id, title)}
                  onAddLesson={title => handleAddLesson(chapter.id, title)}
                  onMoveLesson={(lessonId, dir) => handleMoveLesson(chapter.id, lessonId, dir)}
                  onDeleteLesson={lessonId => handleDeleteLesson(chapter.id, lessonId)}
                  onLessonTitleChange={(lessonId, title) => updateLessonTitleLocal(chapter.id, lessonId, title)}
                  onLessonTitleBlurSave={(lessonId, title) => saveLessonTitle(lessonId, title)}
                  onAddArticle={(lessonId, article) => handleAddArticle(chapter.id, lessonId, article)}
                  onRemoveArticle={(lessonId, articleId) => handleRemoveArticle(chapter.id, lessonId, articleId)}
                  onMoveArticle={(lessonId, articleId, dir) => handleMoveArticle(chapter.id, lessonId, articleId, dir)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="w-80 shrink-0 space-y-4" style={{ position: 'sticky', top: '1.5rem' }}>

          {/* Summary */}
          <div className="rounded-2xl border p-5 space-y-3" style={C.card}>
            <h3 className="text-white font-bold text-sm">Course Summary</h3>
            <div className="space-y-1.5 text-sm">
              <p style={{ color: '#64748b' }}>Total chapters: <span className="text-white font-semibold">{chapters.length}</span></p>
              <p style={{ color: '#64748b' }}>Total lessons: <span className="text-white font-semibold">{totalLessons}</span></p>
              <p style={{ color: '#64748b' }}>Total articles: <span className="text-white font-semibold">{totalArticles}</span></p>
            </div>
            <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-lg capitalize"
              style={course.status === 'published' ? C.success : course.status === 'draft' ? C.active : C.idle}>
              {course.status}
            </span>
            <div className="pt-2 space-y-1.5">
              {course.status === 'published' && (
                <a href={`/free-courses/${course.slug}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#2563eb' }}>
                  View live <ExternalLink size={11} />
                </a>
              )}
              <Link href="/roodber8/course-factory"
                className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#D4A017' }}>
                Open in Course Factory
              </Link>
            </div>
          </div>

          {/* Validation */}
          <div className="rounded-2xl border p-5 space-y-3" style={C.card}>
            <h3 className="text-white font-bold text-sm">Course Health</h3>
            <div className="space-y-2">
              {checks.map(c => (
                <div key={c.label} className="flex items-center gap-2 text-xs">
                  {c.pass
                    ? <CheckCircle2 size={14} style={{ color: '#10b981' }} className="shrink-0" />
                    : <AlertTriangle size={14} style={{ color: '#f59e0b' }} className="shrink-0" />}
                  <span style={{ color: c.pass ? '#64748b' : '#f59e0b' }}>{c.label}</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg px-3 py-2 text-xs font-bold text-center"
              style={issueCount === 0 ? C.success : C.warning}>
              {issueCount === 0 ? 'Ready to publish' : `${issueCount} issue${issueCount !== 1 ? 's' : ''} to resolve`}
            </div>
          </div>

          {/* Delete course */}
          <div>
            {deleteCourseError && (
              <div className="rounded-xl px-4 py-3 mb-2 text-sm" style={C.danger}>{deleteCourseError}</div>
            )}
            <button onClick={() => setConfirmDeleteCourse(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold"
              style={C.danger}>
              <Trash2 size={14} /> Delete Course
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
