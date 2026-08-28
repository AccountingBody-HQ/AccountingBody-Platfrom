// app/roodber8/course-factory/page.tsx
// Accounting Body — Course Factory Admin Page
// Build structured courses from existing articles

'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react'
import { Factory } from 'lucide-react'
import AutoRefresh from '@/components/roodber8/AutoRefresh'

// ── Style constants ───────────────────────────────────────────────────────────

const C = {
  page:    { background: '#080d1a', minHeight: '100vh' },
  card:    { background: '#0d1424', border: '1px solid #1a2238', borderRadius: 16 },
  input:   { background: '#111827', border: '1px solid #1f2937', borderRadius: 10, color: '#fff' },
  select:  { background: '#111827', border: '1px solid #1f2937', borderRadius: 10, color: '#fff' },
  active:  { background: 'rgba(212,160,23,0.12)', border: '1px solid #D4A017', color: '#fff' },
  idle:    { background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#64748b' },
  danger:  { background: 'rgba(239,68,68,0.08)',  border: '1px solid rgba(239,68,68,0.25)',   color: '#ef4444' },
  success: { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',  color: '#10b981' },
  warning: { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',  color: '#f59e0b' },
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FetchedArticle {
  _id:    string
  title:  string
  slug:   string
  excerpt?: string
  contentId?: string
  wpId?: string
}

interface Lesson {
  id:       string
  title:    string
  articles: FetchedArticle[]
}

interface Chapter {
  id:     string
  title:  string
  lessons: Lesson[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

async function fetchArticleById(id: string): Promise<FetchedArticle | null> {
  try {
    const res = await fetch(`/api/roodber8/course-factory/fetch-article?id=${encodeURIComponent(id.trim())}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.article ?? null
  } catch {
    return null
  }
}

async function fetchArticlesBulk(ids: string[]): Promise<{ found: FetchedArticle[]; missing: string[] }> {
  const missing: string[] = []
  // Fetch in parallel but preserve input order using index
  const results = await Promise.all(ids.map(id => fetchArticleById(id.trim())))
  const found: FetchedArticle[] = []
  results.forEach((article, i) => {
    if (article) {
      found.push(article)
    } else {
      missing.push(ids[i].trim())
    }
  })
  return { found, missing }
}

async function saveCourse(payload: any): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch('/api/roodber8/course-factory/save', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error ?? 'Save failed' }
    return { success: true, id: data.id }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CourseFactoryPage() {
  // Metadata
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [level,       setLevel]       = useState('beginner')
  const [status,      setStatus]      = useState('draft')
  const [isFeatured,  setIsFeatured]  = useState(false)
  const [showOnSites, setShowOnSites] = useState<string[]>(['accountingbody'])
  const [canonical,   setCanonical]   = useState('accountingbody')

  // Content assembly
  const [chapters,    setChapters]    = useState<Chapter[]>([
    { id: uid(), title: 'Chapter 1', lessons: [] },
  ])

  // ID input state
  const [idInput,        setIdInput]        = useState('')
  const [fetching,       setFetching]       = useState(false)
  const [fetchError,     setFetchError]     = useState('')
  const [fetchedArticles, setFetchedArticles] = useState<FetchedArticle[]>([])
  const [targetChapter,  setTargetChapter]  = useState('0')
  const [targetLesson,   setTargetLesson]   = useState('new')

  // Delete state
  const [deleting,   setDeleting]   = useState(false)
  const [deleteMsg,  setDeleteMsg]  = useState('')
  const [deleteError,setDeleteError] = useState('')

  // Load existing course state
  const [courseList,     setCourseList]     = useState<{_id:string;title:string;slug:string;status:string;level:string;chapterCount:number}[]>([])
  const [loadingList,    setLoadingList]    = useState(false)
  const [loadingCourse,  setLoadingCourse]  = useState(false)
  const [loadError,      setLoadError]      = useState('')
  const [loadedSlug,     setLoadedSlug]     = useState('')
  const [showLoadPanel,  setShowLoadPanel]  = useState(false)

  // Save state
  const [saving,     setSaving]     = useState(false)
  const [saveMsg,    setSaveMsg]    = useState('')
  const [saveError,  setSaveError]  = useState('')

  // ── Fetch articles by IDs (bulk) ─────────────────────────────────────────
  async function handleFetch() {
    if (!idInput.trim()) return
    setFetching(true)
    setFetchError('')
    setFetchedArticles([])
    const ids = idInput.split(',').map(s => s.trim()).filter(Boolean)
    const { found, missing } = await fetchArticlesBulk(ids)
    if (found.length === 0) {
      setFetchError(`No articles found for the provided IDs.`)
    } else {
      setFetchedArticles(found)
      if (missing.length > 0) setFetchError(`Found ${found.length} articles. Could not find: ${missing.join(', ')}`)
    }
    setFetching(false)
  }

  // ── Add fetched articles to chapter/lesson (bulk) ────────────────────────
  function handleAddArticles() {
    if (fetchedArticles.length === 0) return

    if (targetLesson === 'one-per-chapter') {
      // Each article becomes its own chapter with one lesson inside
      const newChapters: Chapter[] = fetchedArticles.map((article) => ({
        id:      uid(),
        title:   article.title,
        lessons: [{
          id:       uid(),
          title:    article.title,
          articles: [article],
        }],
      }))
      setChapters(prev => {
        const nonEmpty = prev.filter(ch => ch.lessons.length > 0)
        return [...nonEmpty, ...newChapters]
      })
    } else {
      const chIdx = parseInt(targetChapter)
      setChapters(prev => {
        const next = prev.map((ch, ci) => {
          if (ci !== chIdx) return ch
          if (targetLesson === 'new') {
            const newLesson: Lesson = {
              id:       uid(),
              title:    fetchedArticles.length === 1
                ? fetchedArticles[0].title
                : `Lesson ${ch.lessons.length + 1}`,
              articles: fetchedArticles,
            }
            return { ...ch, lessons: [...ch.lessons, newLesson] }
          }
          const lIdx = parseInt(targetLesson)
          return {
            ...ch,
            lessons: ch.lessons.map((l, li) =>
              li === lIdx
                ? { ...l, articles: [...l.articles, ...fetchedArticles] }
                : l
            ),
          }
        })
        return next
      })
    }

    setFetchedArticles([])
    setIdInput('')
    setFetchError('')
  }

  // ── Chapter controls ─────────────────────────────────────────────────────
  function addChapter() {
    setChapters(prev => [
      ...prev,
      { id: uid(), title: `Chapter ${prev.length + 1}`, lessons: [] },
    ])
  }

  function updateChapterTitle(idx: number, title: string) {
    setChapters(prev => prev.map((ch, i) => i === idx ? { ...ch, title } : ch))
  }

  function removeChapter(idx: number) {
    setChapters(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Lesson controls ──────────────────────────────────────────────────────
  function updateLessonTitle(chIdx: number, lIdx: number, title: string) {
    setChapters(prev => prev.map((ch, ci) =>
      ci !== chIdx ? ch : {
        ...ch,
        lessons: ch.lessons.map((l, li) => li === lIdx ? { ...l, title } : l),
      }
    ))
  }

  function removeLesson(chIdx: number, lIdx: number) {
    setChapters(prev => prev.map((ch, ci) =>
      ci !== chIdx ? ch : { ...ch, lessons: ch.lessons.filter((_, li) => li !== lIdx) }
    ))
  }

  function removeArticle(chIdx: number, lIdx: number, aIdx: number) {
    setChapters(prev => prev.map((ch, ci) =>
      ci !== chIdx ? ch : {
        ...ch,
        lessons: ch.lessons.map((l, li) =>
          li !== lIdx ? l : { ...l, articles: l.articles.filter((_, ai) => ai !== aIdx) }
        ),
      }
    ))
  }

  function moveLessonUp(chIdx: number, lIdx: number) {
    if (lIdx === 0) return
    setChapters(prev => prev.map((ch, ci) => {
      if (ci !== chIdx) return ch
      const lessons = [...ch.lessons]
      ;[lessons[lIdx - 1], lessons[lIdx]] = [lessons[lIdx], lessons[lIdx - 1]]
      return { ...ch, lessons }
    }))
  }

  function moveLessonDown(chIdx: number, lIdx: number) {
    setChapters(prev => prev.map((ch, ci) => {
      if (ci !== chIdx) return ch
      if (lIdx >= ch.lessons.length - 1) return ch
      const lessons = [...ch.lessons]
      ;[lessons[lIdx], lessons[lIdx + 1]] = [lessons[lIdx + 1], lessons[lIdx]]
      return { ...ch, lessons }
    }))
  }

  // ── Delete course + all its lessons ─────────────────────────────────────
  async function handleDeleteCourse() {
    if (!loadedSlug) return
    const confirmed = window.confirm(
      `DELETE "${title}"?

This will permanently delete the course and all its chapters and lessons. This cannot be undone.`
    )
    if (!confirmed) return
    setDeleting(true)
    setDeleteError('')
    setDeleteMsg('')
    try {
      const res = await fetch('/api/roodber8/course-factory/delete-course', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: loadedSlug }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setDeleteError(data.error ?? 'Delete failed')
      } else {
        setDeleteMsg(`Deleted "${title}" and all its chapters and lessons.`)
        // Reset factory to blank state
        setTitle('')
        setDescription('')
        setLevel('beginner')
        setStatus('draft')
        setIsFeatured(false)
        setLoadedSlug('')
        setChapters([{ id: uid(), title: 'Chapter 1', lessons: [] }])
        setCourseList([])
        setShowLoadPanel(false)
      }
    } catch (e: any) {
      setDeleteError(e.message ?? 'Delete failed')
    }
    setDeleting(false)
  }

  // ── Load existing courses list ──────────────────────────────────────────
  async function handleOpenLoadPanel() {
    setShowLoadPanel(true)
    if (courseList.length > 0) return
    setLoadingList(true)
    setLoadError('')
    try {
      const res = await fetch('/api/roodber8/course-factory/load-course?action=list')
      const data = await res.json()
      setCourseList(data.courses ?? [])
    } catch {
      setLoadError('Failed to fetch course list.')
    }
    setLoadingList(false)
  }

  async function handleLoadCourse(slug: string) {
    if (!slug) return
    setLoadingCourse(true)
    setLoadError('')
    try {
      const res = await fetch(`/api/roodber8/course-factory/load-course?action=load&slug=${encodeURIComponent(slug)}`)
      const data = await res.json()
      if (data.error) { setLoadError(data.error); setLoadingCourse(false); return }
      const c = data.course
      setTitle(c.title ?? '')
      setDescription(c.description ?? '')
      setLevel(c.level ?? 'beginner')
      setStatus(c.status ?? 'draft')
      setIsFeatured(c.isFeatured ?? false)
      setLoadedSlug(c.slug ?? '')
      setCanonical(c.canonicalOwner ?? 'accountingbody')
      const rebuilt = (c.chapters ?? []).map((ch: any) => ({
        id:    uid(),
        title: ch.title ?? ch.chapterTitle ?? 'Chapter',
        lessons: (ch.lessons ?? []).map((l: any) => ({
          id:       uid(),
          title:    l.title ?? 'Lesson',
          articles: (l.articles ?? []).map((a: any) => ({
            _id:       a.id ?? a._id,
            title:     a.title,
            slug:      a.slug,
            excerpt:   a.excerpt,
            contentId: a.content_id ?? a.contentId,
            wpId:      a.wp_id ?? a.wpId,
          })),
        })),
      }))
      setChapters(rebuilt.length > 0 ? rebuilt : [{ id: uid(), title: 'Chapter 1', lessons: [] }])
      setShowLoadPanel(false)
    } catch {
      setLoadError('Failed to load course.')
    }
    setLoadingCourse(false)
  }

  // ── Save to Supabase ─────────────────────────────────────────────────────
  async function handleSave() {
    if (!title.trim()) { setSaveError('Course title is required.'); return }
    if (chapters.every(ch => ch.lessons.length === 0)) {
      setSaveError('Add at least one lesson before saving.'); return
    }
    setSaving(true)
    setSaveError('')
    setSaveMsg('')

    const slug = loadedSlug || title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    const payload = {
      title:       title.trim(),
      slug,
      description: description.trim(),
      level,
      status,
      isFeatured,
      showOnSites,
      canonical,
      chapters:    chapters.map((ch, ci) => ({
        _type:        'chapter',
        _key:         ch.id,
        chapterTitle: ch.title,
        chapterOrder: ci + 1,
        lessonRefs:   ch.lessons.map(l => ({
          title:       l.title,
          articleIds:  l.articles.map(a => a._id),
        })),
      })),
    }

    const result = await saveCourse(payload)
    setSaving(false)

    if (result.success) {
      setSaveMsg(`Course saved! ID: ${result.id}`)
    } else {
      setSaveError(result.error ?? 'Unknown error')
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const totalLessons = chapters.reduce((acc, ch) => acc + ch.lessons.length, 0)

  return (
    <div className="p-8 max-w-4xl" style={C.page}>
      <AutoRefresh />

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(212,160,23,0.12)' }}>
          <Factory size={20} style={{ color: '#D4A017' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Course Factory</h1>
          <p className="text-sm" style={{ color: '#475569' }}>
            Assemble structured courses from existing articles. Publish directly to Supabase.
          </p>
        </div>
      </div>

      <div className="space-y-8">

        {/* ── Load Existing Course ── */}
        <section className="rounded-2xl border p-6 space-y-4" style={C.card}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Load Existing Course</h2>
              <p className="text-xs mt-0.5" style={{ color: '#475569' }}>Load a course to edit its structure or add more lessons.</p>
            </div>
            <button
              onClick={handleOpenLoadPanel}
              className="h-9 px-4 rounded-lg text-sm font-semibold"
              style={{ background: '#0C1A3D', color: '#fff', border: '1px solid #D4A017' }}
            >
              {showLoadPanel ? 'Hide' : 'Browse Courses'}
            </button>
          </div>

          {loadedSlug && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={C.success}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Loaded: <strong>{title}</strong> — saving will update this course.
            </div>
          )}

          {showLoadPanel && (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#1a2238' }}>
              {loadingList && (
                <p className="text-sm px-4 py-6 text-center" style={{ color: '#475569' }}>Loading courses...</p>
              )}
              {loadError && (
                <p className="text-sm px-4 py-3" style={{ color: '#ef4444' }}>{loadError}</p>
              )}
              {!loadingList && courseList.length === 0 && (
                <p className="text-sm px-4 py-6 text-center" style={{ color: '#475569' }}>No courses found.</p>
              )}
              {!loadingList && courseList.map(c => (
                <button
                  key={c._id}
                  onClick={() => handleLoadCourse(c.slug)}
                  disabled={loadingCourse}
                  className="w-full flex items-center gap-4 px-4 py-3 border-b last:border-0 hover:bg-white/[0.02] transition-colors text-left disabled:opacity-50"
                  style={{ borderColor: '#1a2238' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{c.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{c.level} · {c.chapterCount ?? 0} chapters · {c.status}</p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
                    style={{
                      background: c.status === 'published' ? 'rgba(16,185,129,0.1)' : 'rgba(212,160,23,0.1)',
                      color:      c.status === 'published' ? '#10b981' : '#D4A017',
                    }}
                  >
                    {c.status}
                  </span>
                  <svg className="w-4 h-4 shrink-0" style={{ color: '#334155' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
              {loadingCourse && (
                <p className="text-sm px-4 py-3 text-center font-semibold text-white">Loading course structure...</p>
              )}
            </div>
          )}
        </section>

        {/* ── Step 1: Metadata ── */}
        <section className="rounded-2xl border p-6 space-y-4" style={C.card}>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center"
              style={{ background: '#D4A017', color: '#0C1A3D' }}>1</span>
            Course Details
          </h2>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#475569' }}>Course Title <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Financial Accounting Fundamentals"
              className="w-full h-10 px-3 text-sm focus:outline-none"
              style={C.input}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#475569' }}>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief course overview shown on the catalogue page..."
              rows={3}
              className="w-full px-3 py-2 text-sm resize-none focus:outline-none"
              style={C.input}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#475569' }}>Level</label>
              <select
                value={level}
                onChange={e => setLevel(e.target.value)}
                className="w-full h-10 px-3 text-sm focus:outline-none"
                style={C.select}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#475569' }}>Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full h-10 px-3 text-sm focus:outline-none"
                style={C.select}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={e => setIsFeatured(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm" style={{ color: '#64748b' }}>Feature this course on the homepage</span>
          </label>
          {/* ── Publish To ── */}
          <div className="pt-2 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#475569' }}>Publish To</p>
            <div className="flex gap-2 flex-wrap">
              {['accountingbody', 'ethiotax', 'hrlake'].map(site => (
                <button
                  key={site}
                  onClick={() => setShowOnSites(prev =>
                    prev.includes(site) ? prev.filter(s => s !== site) : [...prev, site]
                  )}
                  className="rounded-lg px-3 py-2 text-xs font-semibold transition-all border"
                  style={showOnSites.includes(site)
                    ? { background: 'rgba(37,99,235,0.12)', border: '1px solid #2563eb', color: '#fff' }
                    : C.idle}
                >
                  {showOnSites.includes(site) && <span className="mr-1">&#10003;</span>}
                  {site}
                  {site === 'accountingbody' && <span className="ml-2 text-xs" style={{ color: '#D4A017' }}>Required</span>}
                </button>
              ))}
            </div>
            <div className="space-y-1 pt-1">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#475569' }}>Canonical Owner</p>
              <div className="flex gap-2 flex-wrap">
                {['accountingbody', 'ethiotax', 'hrlake'].map(site => (
                  <button
                    key={site}
                    onClick={() => setCanonical(site)}
                    className="rounded-lg px-3 py-2 text-xs font-semibold transition-all border"
                    style={canonical === site
                      ? { background: 'rgba(16,185,129,0.12)', border: '1px solid #10b981', color: '#10b981' }
                      : C.idle}
                  >
                    {canonical === site && <span className="mr-1">&#10003;</span>}
                    {site}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Step 2: Content ID Fetch ── */}
        <section className="rounded-2xl border p-6 space-y-4" style={C.card}>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center"
              style={{ background: '#D4A017', color: '#0C1A3D' }}>2</span>
            Add Content by ID
          </h2>
          <p className="text-xs" style={{ color: '#475569' }}>Enter a wpId (e.g. 1999) or contentId (e.g. AB-ART-00001) to fetch an article.</p>

          <div className="flex gap-2">
            <textarea
              value={idInput}
              onChange={e => setIdInput(e.target.value)}
              placeholder="Paste one or multiple IDs separated by commas e.g. 41267, 41273, 41278 or AB-ART-00001, AB-ART-00002"
              rows={3}
              className="flex-1 px-3 py-2 text-sm resize-none focus:outline-none"
              style={C.input}
            />
            <button
              onClick={handleFetch}
              disabled={fetching || !idInput.trim()}
              className="h-10 px-5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 self-start"
              style={{ background: '#0C1A3D', color: '#fff', border: '1px solid #D4A017' }}
            >
              {fetching ? 'Fetching...' : 'Fetch All'}
            </button>
          </div>

          {fetchError && (
            <p className="text-sm rounded-lg px-3 py-2" style={C.danger}>{fetchError}</p>
          )}

          {fetchedArticles.length > 0 && (
            <div className="rounded-xl p-4 space-y-3" style={C.success}>
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-semibold">{fetchedArticles.length} article{fetchedArticles.length > 1 ? 's' : ''} found</p>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {fetchedArticles.map((a, i) => (
                  <div key={a._id} className="flex items-center gap-2">
                    <span className="text-xs font-bold w-5 shrink-0">{i + 1}.</span>
                    <p className="text-xs text-white truncate">{a.title}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t" style={{ borderColor: 'rgba(16,185,129,0.2)' }}>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#475569' }}>Add to Chapter</label>
                  <select
                    value={targetChapter}
                    onChange={e => { setTargetChapter(e.target.value); setTargetLesson('new') }}
                    className="w-full h-9 px-2 text-sm focus:outline-none"
                    style={C.select}
                  >
                    {chapters.map((ch, ci) => (
                      <option key={ch.id} value={ci}>{ch.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#475569' }}>Add to Lesson</label>
                  <select
                    value={targetLesson}
                    onChange={e => setTargetLesson(e.target.value)}
                    className="w-full h-9 px-2 text-sm focus:outline-none"
                    style={C.select}
                  >
                    <option value="new">+ Create new lesson (all articles)</option>
                    <option value="one-per-chapter">+ One chapter per article</option>
                    {chapters[parseInt(targetChapter)]?.lessons.map((l, li) => (
                      <option key={l.id} value={li}>{l.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleAddArticles}
                className="w-full h-9 rounded-lg text-sm font-semibold transition-colors"
                style={{ background: '#0C1A3D', color: '#fff', border: '1px solid #D4A017' }}
              >
                {targetLesson === 'one-per-chapter' ? `Add ${fetchedArticles.length} Articles as ${fetchedArticles.length} Chapters` : `Add ${fetchedArticles.length} Article${fetchedArticles.length > 1 ? 's' : ''} to Course`}
              </button>
            </div>
          )}
        </section>

        {/* ── Step 3: Chapter & Lesson Structure ── */}
        <section className="rounded-2xl border p-6 space-y-4" style={C.card}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center"
                style={{ background: '#D4A017', color: '#0C1A3D' }}>3</span>
              Course Structure
            </h2>
            <span className="text-xs" style={{ color: '#475569' }}>{chapters.length} chapters · {totalLessons} lessons</span>
          </div>

          <div className="space-y-4">
            {chapters.map((chapter, ci) => (
              <div key={chapter.id} className="rounded-xl border overflow-hidden" style={{ borderColor: '#1a2238' }}>
                {/* Chapter header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ background: '#111827', borderColor: '#1a2238' }}>
                  <span className="w-6 h-6 rounded text-xs font-bold flex items-center justify-center shrink-0"
                    style={{ background: '#D4A017', color: '#0C1A3D' }}>
                    {ci + 1}
                  </span>
                  <input
                    type="text"
                    value={chapter.title}
                    onChange={e => updateChapterTitle(ci, e.target.value)}
                    className="flex-1 h-8 px-2 text-sm font-semibold focus:outline-none"
                    style={C.input}
                  />
                  <button
                    onClick={() => removeChapter(ci)}
                    className="p-1 transition-colors"
                    style={{ color: '#475569' }}
                    title="Remove chapter"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Lessons */}
                <div className="divide-y" style={{ borderColor: '#1a2238' }}>
                  {chapter.lessons.length === 0 ? (
                    <p className="text-xs px-4 py-3 italic" style={{ color: '#475569' }}>No lessons yet — fetch content above and add to this chapter.</p>
                  ) : (
                    chapter.lessons.map((lesson, li) => (
                      <div key={lesson.id} className="px-4 py-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs w-5 shrink-0" style={{ color: '#475569' }}>{li + 1}.</span>
                          <input
                            type="text"
                            value={lesson.title}
                            onChange={e => updateLessonTitle(ci, li, e.target.value)}
                            className="flex-1 h-8 px-2 text-sm focus:outline-none"
                            style={C.input}
                          />
                          <button onClick={() => moveLessonUp(ci, li)} disabled={li === 0} className="p-1 disabled:opacity-20 transition-colors" style={{ color: '#475569' }}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button onClick={() => moveLessonDown(ci, li)} disabled={li === chapter.lessons.length - 1} className="p-1 disabled:opacity-20 transition-colors" style={{ color: '#475569' }}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <button onClick={() => removeLesson(ci, li)} className="p-1 transition-colors" style={{ color: '#475569' }}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        {/* Articles in lesson */}
                        {lesson.articles.map((article, ai) => (
                          <div key={article._id} className="flex items-center gap-2 pl-5">
                            <svg className="w-3.5 h-3.5 shrink-0" style={{ color: '#334155' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-xs flex-1 truncate" style={{ color: '#64748b' }}>{article.title}</span>
                            <button onClick={() => removeArticle(ci, li, ai)} className="p-0.5 transition-colors shrink-0" style={{ color: '#334155' }}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addChapter}
            className="w-full h-10 rounded-lg border-2 border-dashed text-sm font-semibold transition-colors"
            style={{ borderColor: '#1f2937', color: '#475569' }}
          >
            + Add Chapter
          </button>
        </section>

        {/* ── Step 4: Save ── */}
        <section className="rounded-2xl border p-6 space-y-4" style={C.card}>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center"
              style={{ background: '#D4A017', color: '#0C1A3D' }}>4</span>
            Save Course
          </h2>

          {/* Preview summary */}
          <div className="rounded-lg border p-4 text-sm space-y-1" style={{ background: '#111827', borderColor: '#1f2937' }}>
            <p><span className="font-semibold text-white">Title:</span> <span style={{ color: '#64748b' }}>{title || '—'}</span></p>
            <p><span className="font-semibold text-white">Level:</span> <span style={{ color: '#64748b' }}>{level}</span></p>
            <p><span className="font-semibold text-white">Status:</span> <span style={{ color: '#64748b' }}>{status}</span></p>
            <p><span className="font-semibold text-white">Chapters:</span> <span style={{ color: '#64748b' }}>{chapters.length}</span></p>
            <p><span className="font-semibold text-white">Total Lessons:</span> <span style={{ color: '#64748b' }}>{totalLessons}</span></p>
          </div>

          {saveError && (
            <p className="text-sm rounded-lg px-3 py-2" style={C.danger}>{saveError}</p>
          )}
          {saveMsg && (
            <p className="text-sm rounded-lg px-3 py-2" style={C.success}>{saveMsg}</p>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="w-full h-12 rounded-xl text-base font-bold transition-colors disabled:opacity-40"
            style={{ background: '#D4A017', color: '#0C1A3D' }}
          >
            {saving ? 'Saving...' : 'Save Course'}
          </button>

          {/* Delete course — only shown when a course is loaded */}
          {loadedSlug && (
            <div className="pt-4 border-t space-y-3" style={{ borderColor: '#1a2238' }}>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#475569' }}>Danger Zone</p>
                <p className="text-xs" style={{ color: '#475569' }}>
                  Permanently deletes this course and all its chapters and lessons. Cannot be undone.
                </p>
              </div>
              {deleteError && (
                <p className="text-sm rounded-lg px-3 py-2" style={C.danger}>{deleteError}</p>
              )}
              {deleteMsg && (
                <p className="text-sm rounded-lg px-3 py-2" style={C.success}>{deleteMsg}</p>
              )}
              <button
                onClick={handleDeleteCourse}
                disabled={deleting}
                className="w-full h-11 rounded-xl text-sm font-bold transition-colors disabled:opacity-40"
                style={C.danger}
              >
                {deleting ? 'Deleting...' : `Delete "${title}" + all chapters and lessons`}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
