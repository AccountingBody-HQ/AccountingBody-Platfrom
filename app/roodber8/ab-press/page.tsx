'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react'

const BOOK_TYPES = [
  { value: 'combined', label: 'Combined', desc: 'Study notes + practice questions per chapter' },
  { value: 'study',    label: 'Study Text',    desc: 'Study notes only - no practice questions' },
  { value: 'practice', label: 'Practice Kit',  desc: 'Practice questions + answer key only' },
]
const EDITIONS = ['2025/26 Edition', '2026/27 Edition', '2027/28 Edition']

export default function AbPressPage() {
  const [courses,     setCourses]     = useState([] as any[])
  const [platform,    setPlatform]    = useState('accountingbody')
  const [slug,        setSlug]        = useState('')
  const [bookType,    setBookType]    = useState('study')
  const [edition,     setEdition]     = useState('2026/27 Edition')
  const [subtitle,    setSubtitle]    = useState('')
  const [preview,     setPreview]     = useState(null as any)
  const [loading,     setLoading]     = useState(false)
  const [generating,  setGenerating]  = useState(false)
  const [error,       setError]       = useState('')
  const [genError,    setGenError]    = useState('')
  const [downloadUrl,    setDownloadUrl]    = useState('')
  const [wordUrl,        setWordUrl]        = useState('')
  const [exportingWord,  setExportingWord]  = useState(false)
  const [wordError,      setWordError]      = useState('')

  useEffect(() => {
    setCourses([])
    setSlug('')
    setPreview(null)
    setDownloadUrl('')
    fetch(
      'https://4rllejq1.api.sanity.io/v2023-05-03/data/query/production?query=' +
      encodeURIComponent('*[_type=="course" && "' + platform + '" in showOnSites && (status == "published" || !defined(status))]{_id, title, slug}')
    )
      .then(r => r.json())
      .then(d => setCourses(d.result || []))
      .catch(() => setCourses([]))
  }, [platform])

  const handleCourseSelect = (e: any) => {
    const selected = courses.find((c: any) => c.slug.current === e.target.value)
    setSlug(e.target.value)
    if (selected) setSubtitle(selected.title)
    setPreview(null); setDownloadUrl(''); setError(''); setGenError('')
  }

  const handlePreview = async () => {
    if (!slug.trim()) { setError('Select a course first'); return }
    setLoading(true); setError(''); setPreview(null); setDownloadUrl(''); setGenError('')
    try {
      const res  = await fetch('/api/roodber8/ab-press/preview?slug=' + encodeURIComponent(slug.trim()))
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

  const handleExportWord = async () => {
    if (!preview) return
    setExportingWord(true); setWordError(''); setWordUrl('')
    try {
      const res = await fetch('/api/roodber8/ab-press/export-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slug.trim(), bookType, edition, subtitle }),
      })
      if (!res.ok) {
        const data = await res.json()
        setWordError(data.error || 'Word export failed')
        return
      }
      const blob = await res.blob()
      setWordUrl(URL.createObjectURL(blob))
    } catch {
      setWordError('Network error - Word export failed')
    } finally {
      setExportingWord(false)
    }
  }

  const handleGenerate = async () => {
    if (!preview) return
    setGenerating(true); setGenError(''); setDownloadUrl('')
    try {
      const res = await fetch('/api/roodber8/ab-press/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slug.trim(), bookType, edition, subtitle }),
      })
      if (!res.ok) {
        const data = await res.json()
        setGenError(data.error || 'Generation failed')
        return
      }
      const blob = await res.blob()
      setDownloadUrl(URL.createObjectURL(blob))
    } catch {
      setGenError('Network error - generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const course = preview?.course
  const stats  = preview?.stats

  return (
    <div className="min-h-screen bg-[#0C1A3D] text-white p-6 md:p-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Accounting Body Press</h1>
        <p className="text-slate-400 text-sm mt-1">Generate KDP-ready study books from published courses</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl">

        {/* ── Left column ── */}
        <div className="space-y-6">

          {/* Step 1 - Course */}
          <div className="bg-[#081428] rounded-xl p-6 border border-slate-700">
            <h2 className="text-sm font-semibold text-[#D4A017] uppercase tracking-wide mb-4">Step 1 — Select Course</h2>
            <label className="block text-xs text-slate-400 mb-1">Platform</label>
            <select
              value={platform}
              onChange={e => setPlatform(e.target.value)}
              className="w-full bg-[#0C1A3D] border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#D4A017] mb-3"
            >
              <option value="accountingbody">AccountingBody</option>
              <option value="ethiotax">EthioTax</option>
            </select>
            <label className="block text-xs text-slate-400 mb-1">Published Course</label>
            <select
              value={slug}
              onChange={handleCourseSelect}
              disabled={generating}
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
              disabled={loading || !slug || generating}
              className="mt-4 w-full bg-[#D4A017] hover:bg-yellow-500 disabled:opacity-50 text-[#0C1A3D] font-semibold text-sm py-2 rounded-lg transition-colors"
            >
              {loading ? 'Loading...' : 'Load Course Preview'}
            </button>
          </div>

          {/* Step 2 - Book Type */}
          <div className="bg-[#081428] rounded-xl p-6 border border-slate-700">
            <h2 className="text-sm font-semibold text-[#D4A017] uppercase tracking-wide mb-4">Step 2 — Book Type</h2>
            <div className="space-y-2">
              {BOOK_TYPES.map(bt => (
                <label
                  key={bt.value}
                  className={"flex items-start gap-3 p-3 rounded-lg border cursor-pointer " +
                    (bookType === bt.value ? "border-[#D4A017] bg-[#0C1A3D]" : "border-slate-700")}
                >
                  <input
                    type="radio" name="bookType" value={bt.value}
                    checked={bookType === bt.value}
                    onChange={() => setBookType(bt.value)}
                    disabled={generating}
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

          {/* Step 3 - Metadata */}
          <div className="bg-[#081428] rounded-xl p-6 border border-slate-700">
            <h2 className="text-sm font-semibold text-[#D4A017] uppercase tracking-wide mb-4">Step 3 — Book Metadata</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Book Title</label>
                <input
                  type="text" value={subtitle}
                  onChange={e => setSubtitle(e.target.value)}
                  disabled={generating}
                  placeholder="e.g. Financial Accounting"
                  className="w-full bg-[#0C1A3D] border border-slate-600 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#D4A017] disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Edition</label>
                <select
                  value={edition}
                  onChange={e => setEdition(e.target.value)}
                  disabled={generating}
                  className="w-full bg-[#0C1A3D] border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#D4A017] disabled:opacity-50"
                >
                  {EDITIONS.map(ed => <option key={ed} value={ed}>{ed}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Publisher</label>
                <input
                  type="text" value="Accounting Body Press" readOnly
                  className="w-full bg-[#0C1A3D] border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-400 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

        </div>

        {/* ── Right column ── */}
        <div className="space-y-6">

          {/* Course Preview */}
          <div className="bg-[#081428] rounded-xl p-6 border border-slate-700 min-h-[200px]">
            <h2 className="text-sm font-semibold text-[#D4A017] uppercase tracking-wide mb-4">Course Preview</h2>
            {!preview && !loading
              ? <p className="text-slate-500 text-sm">Select a course and click Load Course Preview</p>
              : null}
            {loading ? <p className="text-slate-400 text-sm">Fetching from Sanity...</p> : null}
            {course ? (
              <div className="space-y-4">
                <div>
                  <p className="text-white font-semibold text-lg">{course.title}</p>
                  <p className="text-slate-400 text-xs mt-1">{course.categoryTitle} - {course.level}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { val: stats.chapterCount,  label: 'Chapters'     },
                    { val: stats.lessonCount,   label: 'Lessons'      },
                    { val: stats.articleCount,  label: 'Study Notes'  },
                    { val: stats.questionCount, label: 'Practice Qs'  },
                  ].map(({ val, label }) => (
                    <div key={label} className="bg-[#0C1A3D] rounded-lg p-3 border border-slate-700">
                      <p className="text-2xl font-bold text-[#D4A017]">{val}</p>
                      <p className="text-xs text-slate-400">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {course.chapters.map((ch: any, i: number) => (
                    <div key={ch._key} className="bg-[#0C1A3D] rounded-lg px-3 py-2 border border-slate-700">
                      <p className="text-xs font-medium text-white">Ch {i + 1}: {ch.chapterTitle}</p>
                      <p className="text-xs text-slate-500">{ch.lessons?.length || 0} lessons</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Step 4 - Generate */}
          {preview ? (
            <div className="bg-[#081428] rounded-xl p-6 border border-slate-700">
              <h2 className="text-sm font-semibold text-[#D4A017] uppercase tracking-wide mb-2">Step 4 — Generate Book</h2>
              <p className="text-slate-400 text-xs mb-4">Generates a KDP-ready ZIP: interior.pdf + cover.pdf + metadata.txt</p>
              <div className="bg-[#0C1A3D] rounded-lg p-3 border border-slate-700 text-xs text-slate-300 mb-4 space-y-1">
                <p><span className="text-slate-500">Title: </span>{subtitle}</p>
                <p><span className="text-slate-500">Type: </span>{BOOK_TYPES.find(b => b.value === bookType)?.label}</p>
                <p><span className="text-slate-500">Edition: </span>{edition}</p>
                <p><span className="text-slate-500">Publisher: </span>Accounting Body Press</p>
              </div>
              {genError ? <p className="text-red-400 text-xs mb-3">{genError}</p> : null}
              {downloadUrl ? (
                <a
                  href={downloadUrl}
                  download={slug + "-" + bookType + ".zip"}
                  className="block w-full text-center bg-green-600 hover:bg-green-500 text-white font-semibold text-sm py-3 rounded-lg transition-colors"
                >
                  Download ZIP — Ready for KDP Upload
                </a>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="w-full bg-[#D4A017] hover:bg-yellow-500 disabled:opacity-50 text-[#0C1A3D] font-semibold text-sm py-3 rounded-lg transition-colors"
                >
                  {generating ? 'Generating PDF — please wait...' : 'Generate Book'}
                </button>
              )}
              {wordError ? <p className="text-red-400 text-xs mt-2">{wordError}</p> : null}
              {wordUrl ? (
                <a
                  href={wordUrl}
                  download={slug + "-" + bookType + ".docx"}
                  className="block w-full text-center bg-blue-700 hover:bg-blue-600 text-white font-semibold text-sm py-2 rounded-lg transition-colors mt-2"
                >
                  Download Word Doc (.docx)
                </a>
              ) : (
                <button
                  onClick={handleExportWord}
                  disabled={exportingWord || generating}
                  className="w-full bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white font-semibold text-sm py-2 rounded-lg transition-colors mt-2"
                >
                  {exportingWord ? 'Exporting Word...' : 'Export as Word (.docx)'}
                </button>
              )}
            </div>
          ) : null}

        </div>
      </div>
    </div>
  )
}
