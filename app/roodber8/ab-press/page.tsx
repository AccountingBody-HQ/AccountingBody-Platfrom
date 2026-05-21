'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react'

const BOOK_TYPES = [
  { value: 'combined', label: 'Combined', desc: 'Study notes + practice questions per chapter (Kaplan-style)' },
  { value: 'study', label: 'Study Text', desc: 'Study notes only - no practice questions' },
  { value: 'practice', label: 'Practice Kit', desc: 'Practice questions + answer key only' },
]

const EDITIONS = ['2025/26 Edition', '2026/27 Edition', '2027/28 Edition']

export default function AbPressPage() {
  const [courses, setCourses] = useState([] as any[])
  const [slug, setSlug] = useState('')
  const [bookType, setBookType] = useState('combined')
  const [edition, setEdition] = useState('2026/27 Edition')
  const [subtitle, setSubtitle] = useState('')
  const [preview, setPreview] = useState(null as any)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')

  // AI reformatting progress
  const [phase, setPhase] = useState<'idle' | 'reformatting' | 'generating' | 'done' | 'error'>('idle')
  const [progressCurrent, setProgressCurrent] = useState(0)
  const [progressTotal, setProgressTotal] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [genError, setGenError] = useState('')

  useEffect(() => {
    fetch('https://4rllejq1.api.sanity.io/v2023-05-03/data/query/production?query=' + encodeURIComponent('*[_type=="course" && "accountingbody" in showOnSites && (status == "published" || !defined(status))]{_id, title, slug}'))
      .then(r => r.json())
      .then(d => setCourses(d.result || []))
      .catch(() => setCourses([]))
  }, [])

  const handleCourseSelect = (e: any) => {
    const selected = courses.find((c: any) => c.slug.current === e.target.value)
    setSlug(e.target.value)
    if (selected) setSubtitle(selected.title)
    setPreview(null)
    setDownloadUrl('')
    setError('')
    setGenError('')
    setPhase('idle')
  }

  const handlePreview = async () => {
    if (!slug.trim()) { setError('Select a course first'); return }
    setLoading(true)
    setError('')
    setPreview(null)
    setDownloadUrl('')
    setGenError('')
    setPhase('idle')
    try {
      const res = await fetch('/api/roodber8/ab-press/preview?slug=' + encodeURIComponent(slug.trim()))
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Preview failed'); return }
      setPreview(data)
      if (!subtitle) setSubtitle(data.course?.title || '')
    } catch {
      setError('Network error - could not load preview')
    } finally {
      setLoading(false)
    }
  }

  // Collect all articles from course structure
  function collectArticles(course: any): { chapterIdx: number; lessonIdx: number; articleIdx: number; article: any }[] {
    const items: { chapterIdx: number; lessonIdx: number; articleIdx: number; article: any }[] = []
    ;(course.chapters || []).forEach((ch: any, ci: number) => {
      ;(ch.lessons || []).forEach((ls: any, li: number) => {
        ;(ls.linkedArticles || []).forEach((art: any, ai: number) => {
          items.push({ chapterIdx: ci, lessonIdx: li, articleIdx: ai, article: art })
        })
      })
    })
    return items
  }

  const handleGenerate = async () => {
    if (!preview) return
    setGenError('')
    setDownloadUrl('')
    setPhase('reformatting')
    setProgressCurrent(0)

    // Deep clone course so we can mutate article bodies
    const course = JSON.parse(JSON.stringify(preview.course))
    const articles = collectArticles(course)
    setProgressTotal(articles.length)

    // Step 1 - Reformat each article via AI one at a time
    let reformatFailed = 0
    for (let i = 0; i < articles.length; i++) {
      const { chapterIdx, lessonIdx, articleIdx, article } = articles[i]
      setProgressCurrent(i + 1)
      setProgressLabel(`Reformatting: ${article.title}`)
      try {
        const res = await fetch('/api/roodber8/ab-press/reformat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: article.title, blocks: article.body }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.blocks && data.blocks.length > 0) {
            course.chapters[chapterIdx].lessons[lessonIdx].linkedArticles[articleIdx].body = data.blocks
          }
        } else {
          reformatFailed++
        }
      } catch {
        reformatFailed++
      }
      // 15 second pause between articles to respect rate limits
      if (i < articles.length - 1) {
        for (let s = 15; s > 0; s--) {
          setProgressLabel(`Reformatting: ${article.title} — next in ${s}s`)
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }

    // Step 2 - Generate PDF with cleaned content
    setPhase('generating')
    setProgressLabel('Generating PDF — please wait...')

    try {
      const res = await fetch('/api/roodber8/ab-press/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slug.trim(),
          bookType,
          edition,
          subtitle,
          course,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setGenError(data.error || 'Generation failed')
        setPhase('error')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
      setPhase('done')
      if (reformatFailed > 0) {
        setProgressLabel(`Done — ${reformatFailed} article(s) used original formatting due to errors`)
      } else {
        setProgressLabel('All articles reformatted and PDF generated successfully')
      }
    } catch {
      setGenError('Network error - PDF generation failed')
      setPhase('error')
    }
  }

  const course = preview?.course
  const stats = preview?.stats

  const isProcessing = phase === 'reformatting' || phase === 'generating'

  return (
    <div className="min-h-screen bg-[#0C1A3D] text-white p-6 md:p-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Accounting Body Press</h1>
        <p className="text-slate-400 text-sm mt-1">Generate KDP-ready study books from published courses</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl">

        <div className="space-y-6">

          <div className="bg-[#081428] rounded-xl p-6 border border-slate-700">
            <h2 className="text-sm font-semibold text-[#D4A017] uppercase tracking-wide mb-4">Step 1 - Select Course</h2>
            <label className="block text-xs text-slate-400 mb-1">Published Course</label>
            <select
              value={slug}
              onChange={handleCourseSelect}
              disabled={isProcessing}
              className="w-full bg-[#0C1A3D] border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#D4A017] disabled:opacity-50"
            >
              <option value="">-- Select a course --</option>
              {courses.map((c: any) => (
                <option key={c._id} value={c.slug.current}>{c.title} ({c.slug.current})</option>
              ))}
            </select>
            {error ? <p className="text-red-400 text-xs mt-2">{error}</p> : null}
            <button
              onClick={handlePreview}
              disabled={loading || !slug || isProcessing}
              className="mt-4 w-full bg-[#D4A017] hover:bg-yellow-500 disabled:opacity-50 text-[#0C1A3D] font-semibold text-sm py-2 rounded-lg transition-colors"
            >
              {loading ? 'Loading...' : 'Load Course Preview'}
            </button>
          </div>

          <div className="bg-[#081428] rounded-xl p-6 border border-slate-700">
            <h2 className="text-sm font-semibold text-[#D4A017] uppercase tracking-wide mb-4">Step 2 - Book Type</h2>
            <div className="space-y-2">
              {BOOK_TYPES.map(bt => (
                <label key={bt.value} className={"flex items-start gap-3 p-3 rounded-lg border cursor-pointer " + (bookType === bt.value ? "border-[#D4A017] bg-[#0C1A3D]" : "border-slate-700")}>
                  <input
                    type="radio"
                    name="bookType"
                    value={bt.value}
                    checked={bookType === bt.value}
                    onChange={() => setBookType(bt.value)}
                    disabled={isProcessing}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">{bt.label}</p>
                    <p className="text-xs text-slate-400">{bt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-[#081428] rounded-xl p-6 border border-slate-700">
            <h2 className="text-sm font-semibold text-[#D4A017] uppercase tracking-wide mb-4">Step 3 - Book Metadata</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Book Title</label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={e => setSubtitle(e.target.value)}
                  disabled={isProcessing}
                  placeholder="e.g. Financial Accounting"
                  className="w-full bg-[#0C1A3D] border border-slate-600 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#D4A017] disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Edition</label>
                <select
                  value={edition}
                  onChange={e => setEdition(e.target.value)}
                  disabled={isProcessing}
                  className="w-full bg-[#0C1A3D] border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#D4A017] disabled:opacity-50"
                >
                  {EDITIONS.map(ed => <option key={ed} value={ed}>{ed}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Publisher</label>
                <input
                  type="text"
                  value="Accounting Body Press"
                  readOnly
                  className="w-full bg-[#0C1A3D] border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-400 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

        </div>

        <div className="space-y-6">

          <div className="bg-[#081428] rounded-xl p-6 border border-slate-700 min-h-[200px]">
            <h2 className="text-sm font-semibold text-[#D4A017] uppercase tracking-wide mb-4">Course Preview</h2>
            {!preview && !loading ? <p className="text-slate-500 text-sm">Select a course and click Load Course Preview</p> : null}
            {loading ? <p className="text-slate-400 text-sm">Fetching from Sanity...</p> : null}
            {course ? (
              <div className="space-y-4">
                <div>
                  <p className="text-white font-semibold text-lg">{course.title}</p>
                  <p className="text-slate-400 text-xs mt-1">{course.categoryTitle} - {course.level}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#0C1A3D] rounded-lg p-3 border border-slate-700">
                    <p className="text-2xl font-bold text-[#D4A017]">{stats.chapterCount}</p>
                    <p className="text-xs text-slate-400">Chapters</p>
                  </div>
                  <div className="bg-[#0C1A3D] rounded-lg p-3 border border-slate-700">
                    <p className="text-2xl font-bold text-[#D4A017]">{stats.lessonCount}</p>
                    <p className="text-xs text-slate-400">Lessons</p>
                  </div>
                  <div className="bg-[#0C1A3D] rounded-lg p-3 border border-slate-700">
                    <p className="text-2xl font-bold text-[#D4A017]">{stats.articleCount}</p>
                    <p className="text-xs text-slate-400">Study Notes</p>
                  </div>
                  <div className="bg-[#0C1A3D] rounded-lg p-3 border border-slate-700">
                    <p className="text-2xl font-bold text-[#D4A017]">{stats.questionCount}</p>
                    <p className="text-xs text-slate-400">Practice Qs</p>
                  </div>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {course.chapters.map((ch: any, i: number) => (
                    <div key={ch._key} className="bg-[#0C1A3D] rounded-lg px-3 py-2 border border-slate-700">
                      <p className="text-xs font-medium text-white">Ch {i + 1}: {ch.chapterTitle}</p>
                      <p className="text-xs text-slate-500">{ch.lessons ? ch.lessons.length : 0} lessons</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {preview ? (
            <div className="bg-[#081428] rounded-xl p-6 border border-slate-700">
              <h2 className="text-sm font-semibold text-[#D4A017] uppercase tracking-wide mb-2">Step 4 - Generate Book</h2>
              <p className="text-slate-400 text-xs mb-4">AI reformats each article for print quality, then generates a KDP-ready ZIP</p>

              <div className="bg-[#0C1A3D] rounded-lg p-3 border border-slate-700 text-xs text-slate-300 mb-4 space-y-1">
                <p><span className="text-slate-500">Title: </span>{subtitle}</p>
                <p><span className="text-slate-500">Edition: </span>{edition}</p>
                <p><span className="text-slate-500">Publisher: </span>Accounting Body Press</p>
                <p><span className="text-slate-500">Articles to reformat: </span>{stats?.articleCount || 0}</p>
                <p><span className="text-slate-500">Est. time: </span>~{Math.ceil(((stats?.articleCount || 0) * 18) / 60)} minutes</p>
              </div>

              {/* Progress panel */}
              {phase !== 'idle' && (
                <div className={"rounded-lg p-4 mb-4 border " + (phase === 'done' ? "border-green-600 bg-green-900/20" : phase === 'error' ? "border-red-600 bg-red-900/20" : "border-[#D4A017] bg-[#0C1A3D]")}>
                  {phase === 'reformatting' && (
                    <>
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-xs font-semibold text-[#D4A017] uppercase tracking-wide">AI Reformatting</p>
                        <p className="text-xs text-slate-400">{progressCurrent} / {progressTotal}</p>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-1.5 mb-3">
                        <div
                          className="bg-[#D4A017] h-1.5 rounded-full transition-all duration-500"
                          style={{ width: progressTotal > 0 ? (progressCurrent / progressTotal * 100) + '%' : '0%' }}
                        />
                      </div>
                      <p className="text-xs text-slate-300 truncate">{progressLabel}</p>
                      <p className="text-xs text-slate-500 mt-1">Keep this tab open and active</p>
                    </>
                  )}
                  {phase === 'generating' && (
                    <p className="text-xs text-[#D4A017]">Generating PDF... please wait</p>
                  )}
                  {phase === 'done' && (
                    <p className="text-xs text-green-400">{progressLabel}</p>
                  )}
                  {phase === 'error' && (
                    <p className="text-xs text-red-400">{genError}</p>
                  )}
                </div>
              )}

              {phase === 'done' && downloadUrl ? (
                <a
                  href={downloadUrl}
                  download={slug + '-' + bookType + '.zip'}
                  className="block w-full text-center bg-green-600 hover:bg-green-500 text-white font-semibold text-sm py-3 rounded-lg transition-colors"
                >
                  Download ZIP - Ready for KDP Upload
                </a>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={isProcessing}
                  className="w-full bg-[#D4A017] hover:bg-yellow-500 disabled:opacity-50 text-[#0C1A3D] font-semibold text-sm py-3 rounded-lg transition-colors"
                >
                  {isProcessing ? 'Processing — do not close this tab' : 'Reformat & Generate Book'}
                </button>
              )}
            </div>
          ) : null}

        </div>
      </div>
    </div>
  )
}
