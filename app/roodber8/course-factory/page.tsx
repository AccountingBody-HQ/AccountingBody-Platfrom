// app/roodber8/course-factory/page.tsx
// Accounting Body — Course Factory Admin Page
// Build structured courses from existing Sanity content IDs

'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react'


// ── Types ─────────────────────────────────────────────────────────────────────

interface FetchedArticle {
  _id:    string
  title:  string
  slug:   { current: string }
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

async function saveCourseToSanity(payload: any): Promise<{ success: boolean; id?: string; error?: string }> {
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

  // ── Save to Sanity ───────────────────────────────────────────────────────
  async function handleSave() {
    if (!title.trim()) { setSaveError('Course title is required.'); return }
    if (chapters.every(ch => ch.lessons.length === 0)) {
      setSaveError('Add at least one lesson before saving.'); return
    }
    setSaving(true)
    setSaveError('')
    setSaveMsg('')

    const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    const payload = {
      title:       title.trim(),
      slug,
      description: description.trim(),
      level,
      status,
      isFeatured,
      showOnSites: ['accountingbody'],
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

    const result = await saveCourseToSanity(payload)
    setSaving(false)

    if (result.success) {
      setSaveMsg(`Course saved successfully! Sanity ID: ${result.id}`)
    } else {
      setSaveError(result.error ?? 'Unknown error')
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const totalLessons = chapters.reduce((acc, ch) => acc + ch.lessons.length, 0)

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">

      {/* Header */}
      <div>
        <h1 className="font-display text-2xl text-navy-950 mb-1">Course Factory</h1>
        <p className="text-sm text-slate-500">
          Assemble structured courses from existing content IDs. Courses are saved to Sanity as draft by default.
        </p>
      </div>

      {/* ── Step 1: Metadata ── */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="font-display text-lg text-navy-950 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-navy-950 text-white text-xs font-bold flex items-center justify-center">1</span>
          Course Details
        </h2>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Course Title <span className="text-crimson-500">*</span></label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Financial Accounting Fundamentals"
            className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-navy-950 focus:outline-none focus:ring-2 focus:ring-navy-950"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Brief course overview shown on the catalogue page..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-navy-950 focus:outline-none focus:ring-2 focus:ring-navy-950 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Level</label>
            <select
              value={level}
              onChange={e => setLevel(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-navy-950 focus:outline-none focus:ring-2 focus:ring-navy-950"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-navy-950 focus:outline-none focus:ring-2 focus:ring-navy-950"
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
            className="w-4 h-4 rounded border-slate-300 text-navy-950 focus:ring-navy-950"
          />
          <span className="text-sm text-slate-600">Feature this course on the homepage</span>
        </label>
      </section>

      {/* ── Step 2: Content ID Fetch ── */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="font-display text-lg text-navy-950 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-navy-950 text-white text-xs font-bold flex items-center justify-center">2</span>
          Add Content by ID
        </h2>
        <p className="text-xs text-slate-400">Enter a wpId (e.g. 1999) or contentId (e.g. AB-ART-00001) to fetch an article.</p>

        <div className="flex gap-2">
          <textarea
            value={idInput}
            onChange={e => setIdInput(e.target.value)}
            placeholder="Paste one or multiple IDs separated by commas e.g. 41267, 41273, 41278 or AB-ART-00001, AB-ART-00002"
            rows={3}
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-navy-950 focus:outline-none focus:ring-2 focus:ring-navy-950 resize-none"
          />
          <button
            onClick={handleFetch}
            disabled={fetching || !idInput.trim()}
            className="h-10 px-5 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors disabled:opacity-40 self-start"
          >
            {fetching ? 'Fetching...' : 'Fetch All'}
          </button>
        </div>

        {fetchError && (
          <p className="text-sm text-crimson-600 bg-crimson-50 border border-crimson-200 rounded-lg px-3 py-2">{fetchError}</p>
        )}

        {fetchedArticles.length > 0 && (
          <div className="border border-teal-200 bg-teal-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-teal-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-semibold text-teal-700">{fetchedArticles.length} article{fetchedArticles.length > 1 ? 's' : ''} found</p>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {fetchedArticles.map((a, i) => (
                <div key={a._id} className="flex items-center gap-2">
                  <span className="text-xs text-teal-600 font-bold w-5 shrink-0">{i + 1}.</span>
                  <p className="text-xs text-navy-950 truncate">{a.title}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-teal-200">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Add to Chapter</label>
                <select
                  value={targetChapter}
                  onChange={e => { setTargetChapter(e.target.value); setTargetLesson('new') }}
                  className="w-full h-9 px-2 rounded-lg border border-slate-200 text-sm text-navy-950 focus:outline-none focus:ring-2 focus:ring-navy-950"
                >
                  {chapters.map((ch, ci) => (
                    <option key={ch.id} value={ci}>{ch.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Add to Lesson</label>
                <select
                  value={targetLesson}
                  onChange={e => setTargetLesson(e.target.value)}
                  className="w-full h-9 px-2 rounded-lg border border-slate-200 text-sm text-navy-950 focus:outline-none focus:ring-2 focus:ring-navy-950"
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
              className="w-full h-9 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 transition-colors"
            >
              {targetLesson === 'one-per-chapter' ? `Add ${fetchedArticles.length} Articles as ${fetchedArticles.length} Chapters` : `Add ${fetchedArticles.length} Article${fetchedArticles.length > 1 ? 's' : ''} to Course`}
            </button>
          </div>
        )}
      </section>

      {/* ── Step 3: Chapter & Lesson Structure ── */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-navy-950 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-navy-950 text-white text-xs font-bold flex items-center justify-center">3</span>
            Course Structure
          </h2>
          <span className="text-xs text-slate-400">{chapters.length} chapters · {totalLessons} lessons</span>
        </div>

        <div className="space-y-4">
          {chapters.map((chapter, ci) => (
            <div key={chapter.id} className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Chapter header */}
              <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 border-b border-slate-200">
                <span className="w-6 h-6 rounded bg-navy-950 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {ci + 1}
                </span>
                <input
                  type="text"
                  value={chapter.title}
                  onChange={e => updateChapterTitle(ci, e.target.value)}
                  className="flex-1 h-8 px-2 rounded border border-slate-200 text-sm font-semibold text-navy-950 focus:outline-none focus:ring-2 focus:ring-navy-950"
                />
                <button
                  onClick={() => removeChapter(ci)}
                  className="text-slate-400 hover:text-crimson-500 transition-colors p-1"
                  title="Remove chapter"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Lessons */}
              <div className="divide-y divide-slate-100">
                {chapter.lessons.length === 0 ? (
                  <p className="text-xs text-slate-400 px-4 py-3 italic">No lessons yet — fetch content above and add to this chapter.</p>
                ) : (
                  chapter.lessons.map((lesson, li) => (
                    <div key={lesson.id} className="px-4 py-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-5 shrink-0">{li + 1}.</span>
                        <input
                          type="text"
                          value={lesson.title}
                          onChange={e => updateLessonTitle(ci, li, e.target.value)}
                          className="flex-1 h-8 px-2 rounded border border-slate-100 text-sm text-navy-950 focus:outline-none focus:ring-2 focus:ring-navy-950"
                        />
                        <button onClick={() => moveLessonUp(ci, li)} disabled={li === 0} className="p-1 text-slate-400 hover:text-navy-950 disabled:opacity-20 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button onClick={() => moveLessonDown(ci, li)} disabled={li === chapter.lessons.length - 1} className="p-1 text-slate-400 hover:text-navy-950 disabled:opacity-20 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <button onClick={() => removeLesson(ci, li)} className="p-1 text-slate-400 hover:text-crimson-500 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      {/* Articles in lesson */}
                      {lesson.articles.map((article, ai) => (
                        <div key={article._id} className="flex items-center gap-2 pl-5">
                          <svg className="w-3.5 h-3.5 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-xs text-slate-600 flex-1 truncate">{article.title}</span>
                          <button onClick={() => removeArticle(ci, li, ai)} className="p-0.5 text-slate-300 hover:text-crimson-500 transition-colors shrink-0">
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
          className="w-full h-10 rounded-lg border-2 border-dashed border-slate-300 text-sm font-semibold text-slate-500 hover:border-navy-950 hover:text-navy-950 transition-colors"
        >
          + Add Chapter
        </button>
      </section>

      {/* ── Step 4: Save ── */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="font-display text-lg text-navy-950 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-navy-950 text-white text-xs font-bold flex items-center justify-center">4</span>
          Save Course
        </h2>

        {/* Preview summary */}
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 text-sm space-y-1">
          <p><span className="font-semibold text-navy-950">Title:</span> <span className="text-slate-600">{title || '—'}</span></p>
          <p><span className="font-semibold text-navy-950">Level:</span> <span className="text-slate-600">{level}</span></p>
          <p><span className="font-semibold text-navy-950">Status:</span> <span className="text-slate-600">{status}</span></p>
          <p><span className="font-semibold text-navy-950">Chapters:</span> <span className="text-slate-600">{chapters.length}</span></p>
          <p><span className="font-semibold text-navy-950">Total Lessons:</span> <span className="text-slate-600">{totalLessons}</span></p>
        </div>

        {saveError && (
          <p className="text-sm text-crimson-600 bg-crimson-50 border border-crimson-200 rounded-lg px-3 py-2">{saveError}</p>
        )}
        {saveMsg && (
          <p className="text-sm text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">{saveMsg}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="w-full h-12 rounded-xl text-base font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving to Sanity...' : 'Save Course to Sanity'}
        </button>
      </section>
    </div>
  )
}
