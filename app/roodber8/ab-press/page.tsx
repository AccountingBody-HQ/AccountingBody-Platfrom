'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'

const BOOK_TYPES = [
  { value: 'combined', label: 'Combined', desc: 'Study notes + practice questions per chapter' },
  { value: 'study', label: 'Study Text', desc: 'Study notes only' },
  { value: 'practice', label: 'Practice Kit', desc: 'Practice questions + answer key only' },
]

const EDITIONS = ['2025/26 Edition', '2026/27 Edition', '2027/28 Edition']

export default function AbPressPage() {
  const [slug, setSlug] = useState('')
  const [bookType, setBookType] = useState('combined')
  const [edition, setEdition] = useState('2026/27 Edition')
  const [subtitle, setSubtitle] = useState('')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [genError, setGenError] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')

  const handlePreview = async () => {
    if (!slug.trim()) { setError('Enter a course slug'); return }
    setLoading(true)
    setError('')
    setPreview(null)
    setDownloadUrl('')
    setGenError('')
    try {
      const res = await fetch('/api/roodber8/ab-press/preview?slug=' + encodeURIComponent(slug.trim()))
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Preview failed'); return }
      setPreview(data)
      if (!subtitle) setSubtitle(data.course.title || '')
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    if (!preview) return
    setGenerating(true)
    setGenError('')
    setDownloadUrl('')
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
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
    } catch {
      setGenError('Network error')
    } finally {
      setGenerating(false)
    }
  }

  const course = preview ? (preview as any).course : null
  const stats = preview ? (preview as any).stats : null

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
            <label className="block text-xs text-slate-400 mb-1">Course Slug</label>
            <input
              type="text"
              value={slug}
              onChange={e => setSlug(e.target.value)}
              placeholder="e.g. bookkeeping-essentials"
              className="w-full bg-[#0C1A3D] border border-slate-600 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#D4A017]"
            />
            <p className="text-xs text-slate-500 mt-2">Find the slug in Sanity Studio or the Course Factory</p>
            {error ? <p className="text-red-400 text-xs mt-2">{error}</p> : null}
            <button
              onClick={handlePreview}
              disabled={loading}
              className="mt-4 w-full bg-[#D4A017] hover:bg-yellow-500 disabled:opacity-50 text-[#0C1A3D] font-semibold text-sm py-2 rounded-lg transition-colors"
            >
              {loading ? 'Loading...' : 'Load Course Preview'}
            </button>
          </div>

          <div className="bg-[#081428] rounded-xl p-6 border border-slate-700">
            <h2 className="text-sm font-semibold text-[#D4A017] uppercase tracking-wide mb-4">Step 2 - Book Type</h2>
            <div className="space-y-2">
              {BOOK_TYPES.map(bt => (
                <label key={bt.value} className={'flex items-start gap-3 p-3 rounded-lg border cursor-pointer ' + (bookType === bt.value ? 'border-[#D4A017] bg-[#0C1A3D]' : 'border-slate-700')}>
                  <input
                    type="radio"
                    name="bookType"
                    value={bt.value}
                    checked={bookType === bt.value}
                    onChange={() => setBookType(bt.value)}
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
                  placeholder="e.g. Financial Accounting"
                  className="w-full bg-[#0C1A3D] border border-slate-600 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#D4A017]"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Edition</label>
                <select
                  value={edition}
                  onChange={e => setEdition(e.target.value)}
                  className="w-full bg-[#0C1A3D] border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#D4A017]"
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
            {!preview && !loading ? <p className="text-slate-500 text-sm">Load a course to see its content breakdown</p> : null}
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
              <p className="text-slate-400 text-xs mb-4">Generates a KDP-ready ZIP: interior.pdf + cover.pdf + metadata.txt</p>
              <div className="bg-[#0C1A3D] rounded-lg p-3 border border-slate-700 text-xs text-slate-300 mb-4 space-y-1">
                <p><span className="text-slate-500">Title: </span>{subtitle}</p>
                <p><span className="text-slate-500">Edition: </span>{edition}</p>
                <p><span className="text-slate-500">Publisher: </span>Accounting Body Press</p>
              </div>
              {genError ? <p className="text-red-400 text-xs mb-3">{genError}</p> : null}
              {downloadUrl ? (
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
                  disabled={generating}
                  className="w-full bg-[#D4A017] hover:bg-yellow-500 disabled:opacity-50 text-[#0C1A3D] font-semibold text-sm py-3 rounded-lg transition-colors"
                >
                  {generating ? 'Generating... please wait' : 'Generate Book'}
                </button>
              )}
            </div>
          ) : null}

        </div>
      </div>
    </div>
  )
}
