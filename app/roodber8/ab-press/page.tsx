'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react'
import { adminFetch, type AdminResponse } from '@/lib/admin-fetch'
// The font check every AB Press book shares (owner decision D349).
import { fontsEmbedded } from '@/lib/ab-press-pdf-checks'

const BOOK_TYPES = [
  { value: 'combined', label: 'Combined', desc: 'Study notes + practice questions per chapter' },
  { value: 'study',    label: 'Study Text',    desc: 'Study notes only - no practice questions' },
  { value: 'practice', label: 'Practice Kit',  desc: 'Practice questions + answer key only' },
]
const EDITIONS = ['2025/26 Edition', '2026/27 Edition', '2027/28 Edition']
const PREVIEW_COUNT_FAILED = 'Question count unavailable (the practice questions could not be read).'
const HEALTH_FAILED = 'Content check unavailable (the articles could not be read).'
const HISTORY_FAILED = 'Publication history unavailable (it could not be read).'
const COURSES_FAILED = 'Could not load the course list. Please reload the page.'
const COURSE_CHANGED = 'The course has changed since the preview was loaded, so nothing was made. Please load the preview again.'
const ANSWERS_DIFFER = (n: number) => `The questions and answers of chapter ${n} do not match, so nothing was made. Please try again in a minute.`
const TIMED_OUT = 'The book took too long to make, so nothing was made. Please try again in a minute.'
const REPORT_ITEMS = (n: number) => `The check report (preflight-report.txt) lists ${n} item(s) to look at. Please read it before uploading to KDP.`
// The font of the page numbers, embedded in the book as KDP asks (owner decision D346).
const PAGE_NUMBER_FONT = '/fonts/LiberationSans-Regular.ttf'
const FONT_FAILED = 'Page number font failed'
// A KDP paperback (6 x 9 in, black ink) has 24 to 828 pages, so a longer book
// made chapter by chapter is made as volumes (owner decision D346).
const KDP_MIN_PAGES = 24
const KDP_MAX_PAGES = 828
const FRONT_PAGES = 3
const CHAPTER_TOO_LONG = (n: number) => `Chapter ${n} is longer than KDP allows for one book (828 pages), so nothing was made.`
const REPORT_ITEMS_VOLUMES = (n: number, k: number) => `The check reports (volume-1-preflight-report.txt to volume-${n}-preflight-report.txt) list ${k} item(s) to look at. Please read them before uploading to KDP.`
const SPLITTING = (n: number) => `Splitting into ${n} volumes...`
const VOLUME_TITLE = (title: string, x: number, n: number) => `${title} — Volume ${x} of ${n}`

// The message for a failed request: TIMED_OUT when the platform stopped it for
// time, else the message as given.
function bookError(res: AdminResponse, message: string): string {
  const timedOut = res.status === 504 || `${res.error} ${message}`.includes('FUNCTION_INVOCATION_TIMEOUT')
  return timedOut ? TIMED_OUT : message
}

function formatGeneratedAt(iso: string): string {
  const d = new Date(iso)
  const day   = d.getDate()
  const month = d.toLocaleString('en-GB', { month: 'short' })
  const year  = d.getFullYear()
  const hh    = String(d.getHours()).padStart(2, '0')
  const mm    = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${month} ${year}, ${hh}:${mm}`
}

const BOOK_TYPE_LABELS: Record<string, string> = {
  combined: 'Study Text and Practice Kit',
  study:    'Study Text',
  practice: 'Practice Kit',
}

// ── Client-side ZIP + metadata helpers for the chapter-by-chapter flow ────────
// Ported from app/api/roodber8/ab-press/generate/route.ts — pure functions,
// no server dependencies. buildZip is rewritten against Uint8Array/DataView
// instead of Node's Buffer (unavailable in the browser) but produces a
// byte-identical ZIP format.
// For a volume of a longer book (owner decision D349), its number and the
// chapter indexes it holds: the chapters line and upload steps 4 and 5 name
// that volume. Without it the file is as before.
function buildMetadata(subtitle: string, bookType: string, edition: string, course: any, volume?: { x: number; chapters: number[] }): string {
  const total = (course.chapters || []).length
  const first = volume ? volume.chapters[0] + 1 : 0
  const last = volume ? volume.chapters[volume.chapters.length - 1] + 1 : 0
  const file = (name: string) => (volume ? `volume-${volume.x}-${name}` : name)
  const lines = [
    'ACCOUNTING BODY PRESS - BOOK METADATA',
    '=====================================',
    '',
    `Title: ${subtitle}`,
    `Type: ${BOOK_TYPE_LABELS[bookType] || bookType}`,
    `Author: Accounting Body Editorial Team`,
    `Publisher: Accounting Body Press`,
    `Edition: ${edition}`,
    `Year: ${new Date().getFullYear()}`,
    `Language: English`,
    `Trim Size: 6 x 9 inches`,
    `Interior: Black and White`,
    `Paper: White`,
    '',
    'COURSE INFO',
    '-----------',
    `Course: ${course.title}`,
    `Level: ${course.level || 'Not specified'}`,
    `Category: ${course.categoryTitle || 'Not specified'}`,
    !volume ? `Chapters: ${total}` : first === last ? `Chapter: ${first} of ${total}` : `Chapters: ${first}–${last} of ${total}`,
    '',
    'KDP UPLOAD INSTRUCTIONS',
    '-----------------------',
    '1. Log in to kdp.amazon.com',
    '2. Create new paperback title',
    '3. Enter metadata from above',
    `4. Upload ${file('interior.pdf')} as manuscript`,
    `5. Upload ${file('cover.pdf')} as cover`,
    '6. Choose 6x9 trim size, black and white interior',
    '7. Set price and territories',
    '8. Submit for review',
    '',
    `Generated: ${new Date().toISOString()}`,
    'Generated by: Accounting Body Press Publishing System',
  ]
  return lines.join('\n')
}

// The check report of a book made chapter by chapter: the sentences of the
// other books' check reports (lib/ab-press-builder.ts runs on the server only).
function buildCheckReport(missingSets: string[], noAnswerSets: string[], missingOptionSets: string[], unpublishedSlugs: string[]): string {
  const unpublished = Array.from(new Set(unpublishedSlugs))
  return [
    'AB Press check report (book made chapter by chapter)',
    '',
    missingSets.length > 0
      ? `[WARN] ${missingSets.length} linked practice set(s) not found or not live: ${missingSets.join(', ')}`
      : '[PASS] All linked practice sets found',
    noAnswerSets.length > 0
      ? `[WARN] ${noAnswerSets.length} question(s) with no stored answer (printed as –) in set(s): ${Array.from(new Set(noAnswerSets)).join(', ')}`
      : '[PASS] Every printed question has a stored answer',
    missingOptionSets.length > 0
      ? `[WARN] ${missingOptionSets.length} question(s) whose answer points to a missing option (printed as –) in set(s): ${Array.from(new Set(missingOptionSets)).join(', ')}`
      : '[PASS] Every printed answer points to a printed option',
    unpublished.length > 0
      ? `[WARN] ${unpublished.length} unpublished article(s) printed: ${unpublished.join(', ')}`
      : '[PASS] Every printed article is published',
  ].join('\n')
}

// How many lines of a check report ask for a look.
function countReportItems(report: string): number {
  return report.split('\n').filter(line => line.startsWith('[WARN]') || line.startsWith('[FAIL]')).length
}

// The volumes of a book made chapter by chapter (owner decision D346), as the
// chapter indexes of each: runs of consecutive chapters, in order. A volume has
// its 3 front pages, its chapters and their answers, at most `limit` pages.
// The fewest volumes come first; then the page ceiling is lowered as far as it
// can be without another volume, so the volumes are as even as the chapters
// allow. A short last volume joins the one before when that still fits.
// tooLong is the number of a chapter that, with its answers, fits no volume.
function planVolumes(chapterPages: number[], answerPages: number[], limit = KDP_MAX_PAGES): { volumes: number[][] } | { tooLong: number } {
  const cost = chapterPages.map((pages, i) => pages + (answerPages[i] ?? 0))
  const tooLong = cost.findIndex(pages => FRONT_PAGES + pages > limit)
  if (tooLong >= 0) return { tooLong: tooLong + 1 }
  const split = (ceiling: number) => {
    const volumes: number[][] = []
    let size = Infinity
    cost.forEach((pages, i) => {
      if (size + pages > ceiling) { volumes.push([]); size = FRONT_PAGES }
      volumes[volumes.length - 1].push(i)
      size += pages
    })
    return volumes
  }
  const fewest = split(limit).length
  let low = FRONT_PAGES + Math.max(0, ...cost)
  let high = limit
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (split(middle).length <= fewest) high = middle
    else low = middle + 1
  }
  const volumes = split(low)
  const pagesOf = (volume: number[]) => FRONT_PAGES + volume.reduce((sum, i) => sum + cost[i], 0)
  if (volumes.length > 1) {
    const last = volumes[volumes.length - 1]
    const before = volumes[volumes.length - 2]
    if (pagesOf(last) < KDP_MIN_PAGES && pagesOf(before) + pagesOf(last) - FRONT_PAGES <= limit) {
      volumes.pop()
      before.push(...last)
    }
  }
  return { volumes }
}

// The KDP checks of the server's check report (buildPreflight in the generate
// route), with its sentences, for one book or volume made chapter by chapter.
async function kdpLines(interior: Uint8Array, cover: Uint8Array, pageCount: number): Promise<string[]> {
  const line = (pass: boolean, name: string, detail: string) => (pass ? '[PASS] ' : '[FAIL] ') + name + ' - ' + detail
  const embedded = (await fontsEmbedded(interior)) && (await fontsEmbedded(cover))
  const pagesOk = pageCount >= KDP_MIN_PAGES && pageCount <= KDP_MAX_PAGES
  const spineIn   = Math.max(pageCount * 0.002252, 0.5)
  const expectedW = (6.125 * 2 + spineIn) * 72
  const expectedH = 9.25 * 72
  let coverW = 0
  let coverH = 0
  try {
    const { PDFDocument } = await import('pdf-lib')
    const box = (await PDFDocument.load(cover)).getPage(0).getMediaBox()
    coverW = box.width
    coverH = box.height
  } catch {
    // An unreadable cover measures 0 x 0, as on the server.
  }
  const coverOk   = Math.abs(coverW - expectedW) < 1 && Math.abs(coverH - expectedH) < 1
  return [
    line(embedded, 'Fonts embedded', embedded ? 'Liberation Sans embedded in interior and cover' : 'Non-embedded font detected - KDP may reject'),
    line(pagesOk, 'Page count', pageCount + ' pages (KDP limit 24-828)'),
    line(coverOk, 'Cover dimensions', coverW.toFixed(2) + ' x ' + coverH.toFixed(2) + ' pts (expected ' + expectedW.toFixed(2) + ' x ' + expectedH.toFixed(2) + ', spine ' + spineIn.toFixed(3) + 'in)'),
  ]
}

// The same for the check report in a ZIP made by the server, whose files are
// stored one after the other, not compressed. 0 when it cannot be read.
async function countZipReportItems(zip: Blob): Promise<number> {
  try {
    const bytes = new Uint8Array(await zip.arrayBuffer())
    const view = new DataView(bytes.buffer)
    const text = (start: number, length: number) => new TextDecoder().decode(bytes.subarray(start, start + length))
    for (let at = 0; view.getUint32(at, true) === 0x04034b50;) {
      const size = view.getUint32(at + 18, true)
      const nameLength = view.getUint16(at + 26, true)
      const data = at + 30 + nameLength + view.getUint16(at + 28, true)
      if (text(at + 30, nameLength) === 'preflight-report.txt') return countReportItems(text(data, size))
      at = data + size
    }
    return 0
  } catch {
    return 0
  }
}

function u32le(n: number): Uint8Array {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n, true)
  return b
}
function u16le(n: number): Uint8Array {
  const b = new Uint8Array(2)
  new DataView(b.buffer).setUint16(0, n, true)
  return b
}
function crc32(buf: Uint8Array): number {
  const t: number[] = []
  for (let i = 0; i < 256; i++) { let c = i; for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) { out.set(c, offset); offset += c.length }
  return out
}
function buildZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  const nameEncoder = new TextEncoder()
  for (const f of files) {
    const name = nameEncoder.encode(f.name)
    const crc  = crc32(f.data)
    const size = f.data.length
    const local = concatBytes([
      Uint8Array.from([0x50, 0x4b, 0x03, 0x04]), u16le(20), u16le(0), u16le(0), u16le(0), u16le(0),
      u32le(crc), u32le(size), u32le(size), u16le(name.length), u16le(0), name, f.data,
    ])
    locals.push(local)
    centrals.push(concatBytes([
      Uint8Array.from([0x50, 0x4b, 0x01, 0x02]), u16le(20), u16le(20), u16le(0), u16le(0), u16le(0), u16le(0),
      u32le(crc), u32le(size), u32le(size), u16le(name.length), u16le(0), u16le(0), u16le(0), u16le(0),
      u32le(0), u32le(offset), name,
    ]))
    offset += local.length
  }
  const cd = concatBytes(centrals)
  const eocd = concatBytes([
    Uint8Array.from([0x50, 0x4b, 0x05, 0x06]), u16le(0), u16le(0), u16le(files.length), u16le(files.length),
    u32le(cd.length), u32le(offset), u16le(0),
  ])
  return concatBytes([...locals, cd, eocd])
}

export default function AbPressPage() {
  const [courses,     setCourses]     = useState([] as any[])
  const [slug,        setSlug]        = useState('')
  const [bookType,    setBookType]    = useState('study')
  const [edition,     setEdition]     = useState('2026/27 Edition')
  const [subtitle,    setSubtitle]    = useState('')
  const [preview,     setPreview]     = useState(null as any)
  const [health,      setHealth]      = useState(null as any)
  const [history,     setHistory]     = useState(null as any)
  const [showEmptyList,   setShowEmptyList]   = useState(false)
  const [showWebWarnings, setShowWebWarnings] = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [generating,  setGenerating]  = useState(false)
  const [generationPhase,    setGenerationPhase]    = useState('')
  const [generationProgress, setGenerationProgress] = useState(null as { current: number, total: number } | null)
  const [error,       setError]       = useState('')
  const [genError,    setGenError]    = useState('')
  const [downloadUrl,    setDownloadUrl]    = useState('')
  const [reportItems,    setReportItems]    = useState(0)
  const [reportVolumes,  setReportVolumes]  = useState(1)
  const [wordUrl,        setWordUrl]        = useState('')
  const [exportingWord,  setExportingWord]  = useState(false)
  const [wordError,      setWordError]      = useState('')
  const [showHistory,    setShowHistory]    = useState(false)

  useEffect(() => {
    setCourses([])
    setSlug('')
    setPreview(null)
    setHealth(null)
    setShowEmptyList(false)
    setShowWebWarnings(false)
    setDownloadUrl('')
    adminFetch('/api/roodber8/course-factory/load-course?action=list')
      .then(async r => {
        const d = await r.json()
        if (!r.ok || !Array.isArray(d?.courses)) { setCourses([]); setError(bookError(r, COURSES_FAILED)); return }
        setCourses(d.courses)
      })
      .catch(() => { setCourses([]); setError(COURSES_FAILED) })
  }, [])

  // A file that was made belongs to the choices it was made with.
  const clearMade = () => {
    setDownloadUrl(''); setReportItems(0); setReportVolumes(1); setGenError(''); setWordUrl(''); setWordError('')
  }

  const handleCourseSelect = (e: any) => {
    const selected = courses.find((c: any) => c.slug === e.target.value)
    setSlug(e.target.value)
    if (selected) setSubtitle(selected.title)
    setPreview(null); setHealth(null); setHistory(null); setShowEmptyList(false); setShowWebWarnings(false)
    setError(''); clearMade()
  }

  const handlePreview = async () => {
    if (!slug.trim()) { setError('Select a course first'); return }
    setLoading(true); setError(''); setPreview(null); setHealth(null); setHistory(null)
    setShowEmptyList(false); setShowWebWarnings(false)
    clearMade()
    try {
      const res  = await adminFetch('/api/roodber8/ab-press/preview?slug=' + encodeURIComponent(slug.trim()))
      const data = await res.json()
      if (!res.ok) { setError(bookError(res, data.error || 'Preview failed')); return }
      setPreview(data)
      setHealth(data.health ?? null)
      setHistory(data.history ?? [])
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
      const res = await adminFetch('/api/roodber8/ab-press/export-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slug.trim(), bookType, edition, subtitle }),
      }, { expect: 'file' })
      if (!res.ok) {
        const data = await res.json()
        setWordError(bookError(res, data.error || 'Word export failed'))
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

  // Small courses (<= 50 articles): unchanged single-request path — the
  // existing generate/route.ts renders the whole book in one call.
  const handleGenerateSmall = async () => {
    if (!preview) return
    setGenerating(true); setGenError(''); setDownloadUrl('')
    try {
      const res = await adminFetch('/api/roodber8/ab-press/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slug.trim(), bookType, edition, subtitle }),
      }, { expect: 'file' })
      if (!res.ok) {
        const data = await res.json()
        setGenError(bookError(res, data.error || 'Generation failed'))
        return
      }
      const blob = await res.blob()
      setReportItems(await countZipReportItems(blob))
      setDownloadUrl(URL.createObjectURL(blob))
    } catch {
      setGenError('Network error - generation failed')
    } finally {
      setGenerating(false)
    }
  }

  // Large courses (> 50 articles): chapter-by-chapter orchestration.
  // Each chapter is rendered by its own short-lived serverless call
  // (generate-chapter, maxDuration 300 s), avoiding the single 300s call
  // that was timing out on large courses. Frontmatter (title + copyright +
  // TOC) is rendered last, once every chapter's real page count is known,
  // so the TOC gets exact page numbers. All PDFs are merged client-side
  // with pdf-lib and the ZIP is built client-side too.
  const handleGenerateLarge = async () => {
    if (!preview) return
    setGenerating(true); setGenError(''); setDownloadUrl('')
    setGenerationPhase('Fetching chapter data...')
    setGenerationProgress(null)

    try {
      const chapterCount = preview.course.chapters.length
      const chapterPdfs: Uint8Array[] = []
      const chapterPageCounts: number[] = []
      const chapterQuestionOffsets: number[] = []
      const chapterQuestionCounts: number[] = []
      // What each chapter reports, so each volume reports its own chapters.
      const missingSetsOf: string[][] = []
      const noAnswerSetsOf: string[][] = []
      const missingOptionSetsOf: string[][] = []
      const unpublishedOf: string[][] = []
      let questionNumberOffset = 0

      // Every part must come from the course as the preview showed it. A part
      // or a preview without a key does not count as the same.
      const sameCourse = (data: any) => !!preview.courseKey && data.courseKey === preview.courseKey

      // 1. Render each chapter
      for (let i = 0; i < chapterCount; i++) {
        setGenerationPhase(`Rendering chapter ${i + 1} of ${chapterCount}...`)
        setGenerationProgress({ current: i + 1, total: chapterCount })

        chapterQuestionOffsets.push(questionNumberOffset)

        const res = await adminFetch('/api/roodber8/ab-press/generate-chapter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: slug.trim(), bookType, edition, subtitle,
            chapterIndex: i, questionNumberOffset
          })
        })
        const data = await res.json()
        if (!res.ok || data.error) throw new Error(bookError(res, data.error || 'Chapter render failed'))
        if (data.chapterCount !== chapterCount || !sameCourse(data)) throw new Error(COURSE_CHANGED)

        const pdfBytes = Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0))
        chapterPdfs.push(pdfBytes)
        chapterPageCounts.push(data.pageCount)
        chapterQuestionCounts.push(data.questionCount)
        missingSetsOf.push([...data.missingSets])
        noAnswerSetsOf.push([...data.noAnswerSets])
        missingOptionSetsOf.push([...data.missingOptionSets])
        unpublishedOf.push([...data.unpublished])
        questionNumberOffset += data.questionCount ?? 0
      }

      // 2. Render answers section chapter by chapter if needed. Each call is
      // scoped to one chapter (same pattern as generate-chapter above) so a
      // large course's full answer key doesn't blow the 300 s render budget in
      // one request; a chapter with no questions comes back with pdf: null
      // and is skipped from the merge.
      const answerPdfOf: (Uint8Array | null)[] = chapterPdfs.map(() => null)
      const answerPageCounts: number[] = chapterPdfs.map(() => 0)
      if (bookType === 'combined' || bookType === 'practice') {
        for (let i = 0; i < chapterCount; i++) {
          setGenerationPhase(`Rendering answers ${i + 1} of ${chapterCount}...`)
          const res = await adminFetch('/api/roodber8/ab-press/generate-answers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slug: slug.trim(), bookType, edition, subtitle,
              chapterIndex: i, questionNumberOffset: chapterQuestionOffsets[i]
            })
          })
          const data = await res.json()
          if (!res.ok || data.error) throw new Error(bookError(res, data.error || `Answers chapter ${i + 1} failed`))
          if (data.chapterCount !== chapterCount || !sameCourse(data)) throw new Error(COURSE_CHANGED)
          if (data.questionCount !== chapterQuestionCounts[i]) throw new Error(ANSWERS_DIFFER(i + 1))
          if (data.pdf) {
            answerPdfOf[i] = Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0))
            answerPageCounts[i] = data.pageCount ?? 0
          }
        }
      }

      // Volumes (owner decision D346): a book of 828 pages or fewer is one
      // volume and is made as before; a longer one is made as several, each
      // with its own front pages, interior, cover, metadata and check report.
      const plan = planVolumes(chapterPageCounts, answerPageCounts)
      if ('tooLong' in plan) throw new Error(CHAPTER_TOO_LONG(plan.tooLong))
      const volumes = plan.volumes.length > 1 ? plan.volumes : [chapterPdfs.map((_, i) => i)]
      if (volumes.length > 1) setGenerationPhase(SPLITTING(volumes.length))
      const zipFiles: { name: string; data: Uint8Array }[] = []
      let reportItemCount = 0

      // The font of the page numbers, fetched once for every volume (D346).
      const fontRes = await adminFetch(PAGE_NUMBER_FONT, undefined, { expect: 'file' })
      if (!fontRes.ok) throw new Error(bookError(fontRes, (await fontRes.json()).error || FONT_FAILED))
      const fontBytes = new Uint8Array(await (await fontRes.blob()).arrayBuffer())

      // Steps 3 to 7 run once per volume. They keep their former indent so
      // that only what changed shows.
      for (let v = 0; v < volumes.length; v++) {
      const volumeChapters = volumes[v]
      const volume = volumes.length > 1 ? { x: v + 1, n: volumes.length } : null
      const fileName = (name: string) => (volume ? `volume-${volume.x}-${name}` : name)
      const answerChapterPdfs = volumeChapters.map(i => answerPdfOf[i]).filter((pdf): pdf is Uint8Array => pdf !== null)

      // 3. Compute chapter page starts (cumulative, offset by 3 frontmatter pages),
      // counted from 1 inside the volume
      const chapterPageStarts: number[] = []
      let pageAcc = 4 // pages 1-3 = frontmatter, chapter 1 starts on page 4
      for (const count of volumeChapters.map(i => chapterPageCounts[i])) {
        chapterPageStarts.push(pageAcc)
        pageAcc += count
      }
      const answersPageStart = pageAcc // the answers come right after the last chapter
      const totalInteriorPages = pageAcc + answerChapterPdfs.length
      const noAnswersPart = bookType !== 'study' && answerChapterPdfs.length === 0

      // 4. Render frontmatter (title + copyright + TOC with real page numbers)
      setGenerationPhase('Rendering frontmatter and TOC...')
      const fmRes = await adminFetch('/api/roodber8/ab-press/generate-frontmatter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slug.trim(), bookType, edition, subtitle,
          chapterPageStarts, totalPages: totalInteriorPages, answersPageStart,
          // Sent only for a book without answers.
          ...(noAnswersPart ? { hasAnswers: false } : {}),
          // Sent only for a book of several volumes.
          ...(volume ? { volume, chapters: volumeChapters } : {})
        })
      })
      const fmData = await fmRes.json()
      if (!fmRes.ok || fmData.error) throw new Error(bookError(fmRes, fmData.error || 'Frontmatter render failed'))
      if (!sameCourse(fmData)) throw new Error(COURSE_CHANGED)
      const frontmatterPdf = Uint8Array.from(atob(fmData.pdf), c => c.charCodeAt(0))

      // 5. Merge all PDFs using pdf-lib (client-side)
      setGenerationPhase('Merging PDF pages...')
      const { PDFDocument, rgb } = await import('pdf-lib')
      const fontkit = (await import('@pdf-lib/fontkit')).default
      const mergedDoc = await PDFDocument.create()
      mergedDoc.registerFontkit(fontkit)

      const allPdfs = [frontmatterPdf, ...volumeChapters.map(i => chapterPdfs[i]), ...answerChapterPdfs]

      for (const pdfBytes of allPdfs) {
        const srcDoc = await PDFDocument.load(pdfBytes)
        const pages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices())
        pages.forEach((p: any) => mergedDoc.addPage(p))
      }

      // Draw page numbers on every page after frontmatter using pdf-lib.
      // ChapterTemplate cannot use react-pdf's render() callback for page
      // numbers because each chapter renders as its own PDF starting at
      // page 1 — after pdf-lib merges them the embedded numbers would be
      // wrong. Instead we draw the correct sequential page number here,
      // after the merge, when the final page index is known.
      // Frontmatter = pages 1-3 (title, copyright, TOC) — no page number.
      // Pages 4+ get their sequential number at bottom-right, matching
      // the Practice Kit's s.pageNum position (MO=36pt, y=18pt, 8pt grey),
      // in Liberation Sans embedded as a subset (owner decision D346).
      const pageFont = await mergedDoc.embedFont(fontBytes, { subset: true })
      const FRONTMATTER_PAGES = 3
      for (let i = FRONTMATTER_PAGES; i < mergedDoc.getPageCount(); i++) {
        const pdfPage = mergedDoc.getPage(i)
        const { width } = pdfPage.getSize()
        pdfPage.drawText(String(i + 1), {
          x: width - 36,
          y: 18,
          size: 8,
          font: pageFont,
          color: rgb(0.6, 0.6, 0.6),
        })
      }
      const mergedBytes = await mergedDoc.save()
      const interiorPdf = new Uint8Array(mergedBytes)

      // 6. Render cover
      setGenerationPhase('Rendering cover...')
      const coverRes = await adminFetch('/api/roodber8/ab-press/generate-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slug.trim(), bookType, edition, subtitle,
          pageCount: mergedDoc.getPageCount(),
          // Sent only for a book of several volumes.
          ...(volume ? { volume } : {})
        })
      })
      const coverData = await coverRes.json()
      if (!coverRes.ok || coverData.error) throw new Error(bookError(coverRes, coverData.error || 'Cover render failed'))
      const coverPdf = Uint8Array.from(atob(coverData.pdf), c => c.charCodeAt(0))

      // 7. The files of the volume, for the ZIP
      const ofVolume = (lists: string[][]) => volumeChapters.flatMap(i => lists[i])
      // The check report, then the server's KDP checks (owner decision D346).
      const checkReport = [
        buildCheckReport(ofVolume(missingSetsOf), ofVolume(noAnswerSetsOf), ofVolume(missingOptionSetsOf), ofVolume(unpublishedOf)),
        ...(await kdpLines(interiorPdf, coverPdf, mergedDoc.getPageCount())),
      ].join('\n')
      const title = subtitle || preview.course.title
      zipFiles.push(
        { name: fileName('interior.pdf'), data: interiorPdf },
        { name: fileName('cover.pdf'),    data: coverPdf },
        { name: fileName('metadata.txt'), data: new TextEncoder().encode(buildMetadata(volume ? VOLUME_TITLE(title, volume.x, volume.n) : title, bookType, edition, preview.course, volume ? { x: volume.x, chapters: volumeChapters } : undefined)) },
        { name: fileName('preflight-report.txt'), data: new TextEncoder().encode(checkReport) },
      )
      reportItemCount += countReportItems(checkReport)
      }

      // Build ZIP client-side
      setGenerationPhase('Building ZIP...')
      const zipBytes = buildZip(zipFiles)
      const blob = new Blob([zipBytes as any], { type: 'application/zip' })
      setReportItems(reportItemCount)
      setReportVolumes(volumes.length)
      setDownloadUrl(URL.createObjectURL(blob))

    } catch (err: any) {
      setGenError(err.message || 'Generation failed')
    } finally {
      setGenerating(false)
      setGenerationPhase('')
      setGenerationProgress(null)
    }
  }

  // Practice Kit: dedicated single-render route (generate-pq) — topic-organised,
  // exact page numbers, no study-note bodies to push it over the timeout.
  const handleGeneratePQ = async () => {
    setGenerating(true); setGenError(''); setDownloadUrl('')
    setGenerationPhase('Generating Practice Kit...')
    try {
      const res = await adminFetch('/api/roodber8/ab-press/generate-pq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slug.trim(), edition, subtitle })
      }, { expect: 'file' })
      if (!res.ok) {
        const data = await res.json()
        setGenError(bookError(res, data.error || 'Generation failed'))
        return
      }
      const blob = await res.blob()
      setReportItems(await countZipReportItems(blob))
      setDownloadUrl(URL.createObjectURL(blob))
    } catch {
      setGenError('Network error — generation failed')
    } finally {
      setGenerating(false)
      setGenerationPhase('')
    }
  }

  // Dispatcher: Practice Kit always uses the dedicated PQ route; courses
  // <= 50 articles keep the original single-request path unchanged; larger
  // combined/study courses use the chapter-by-chapter flow.
  const handleGenerate = () => {
    if (bookType === 'practice') {
      handleGeneratePQ()
      return
    }
    if (!preview) return
    const articleCount = preview.stats?.articleCount ?? 0
    if (articleCount > 50) {
      handleGenerateLarge()
    } else {
      handleGenerateSmall()
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
            <h2 className="text-sm font-semibold text-[#C9982A] uppercase tracking-wide mb-4">Step 1 — Select Course</h2>

            <label className="block text-xs text-slate-400 mb-1">Published Course</label>
            <select
              value={slug}
              onChange={handleCourseSelect}
              disabled={generating || loading || exportingWord}
              className="w-full bg-[#0C1A3D] border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#C9982A] disabled:opacity-50"
            >
              <option value="">-- Select a course --</option>
              {courses.map((c: any) => (
                <option key={c._id} value={c.slug}>{c.title} ({c.slug})</option>
              ))}
            </select>
            {error ? <p className="text-red-400 text-xs mt-2">{error}</p> : null}
            <button
              onClick={handlePreview}
              disabled={loading || !slug || generating}
              className="mt-4 w-full bg-[#C9982A] hover:bg-yellow-500 disabled:opacity-50 text-[#0C1A3D] font-semibold text-sm py-2 rounded-lg transition-colors"
            >
              {loading ? 'Loading...' : 'Load Course Preview'}
            </button>
          </div>

          {/* Step 2 - Book Type */}
          <div className="bg-[#081428] rounded-xl p-6 border border-slate-700">
            <h2 className="text-sm font-semibold text-[#C9982A] uppercase tracking-wide mb-4">Step 2 — Book Type</h2>
            <div className="space-y-2">
              {BOOK_TYPES.map(bt => (
                <label
                  key={bt.value}
                  className={"flex items-start gap-3 p-3 rounded-lg border cursor-pointer " +
                    (bookType === bt.value ? "border-[#C9982A] bg-[#0C1A3D]" : "border-slate-700")}
                >
                  <input
                    type="radio" name="bookType" value={bt.value}
                    checked={bookType === bt.value}
                    onChange={() => { setBookType(bt.value); clearMade() }}
                    disabled={generating || exportingWord}
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
            <h2 className="text-sm font-semibold text-[#C9982A] uppercase tracking-wide mb-4">Step 3 — Book Metadata</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Book Title</label>
                <input
                  type="text" value={subtitle}
                  onChange={e => { setSubtitle(e.target.value); clearMade() }}
                  disabled={generating || exportingWord}
                  placeholder="e.g. Financial Accounting"
                  className="w-full bg-[#0C1A3D] border border-slate-600 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#C9982A] disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Edition</label>
                <select
                  value={edition}
                  onChange={e => { setEdition(e.target.value); clearMade() }}
                  disabled={generating || exportingWord}
                  className="w-full bg-[#0C1A3D] border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#C9982A] disabled:opacity-50"
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
            <h2 className="text-sm font-semibold text-[#C9982A] uppercase tracking-wide mb-4">Course Preview</h2>
            {!preview && !loading
              ? <p className="text-slate-500 text-sm">Select a course and click Load Course Preview</p>
              : null}
            {loading ? <p className="text-slate-400 text-sm">Loading course...</p> : null}
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
                    { val: stats.questionCountError ? '—' : stats.questionCount, label: 'Practice Qs' },
                  ].map(({ val, label }) => (
                    <div key={label} className="bg-[#0C1A3D] rounded-lg p-3 border border-slate-700">
                      <p className="text-2xl font-bold text-[#C9982A]">{val}</p>
                      <p className="text-xs text-slate-400">{label}</p>
                    </div>
                  ))}
                </div>
                {stats.questionCountError ? <p className="text-red-400 text-xs mt-2">{PREVIEW_COUNT_FAILED}</p> : null}
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

          {/* Content Health */}
          {health ? (
            <div className="bg-[#081428] rounded-xl p-6 border border-slate-700">
              <h2 className="text-sm font-semibold text-[#C9982A] uppercase tracking-wide mb-4">Content Health</h2>

              {health.unavailable ? <p className="text-red-400 text-xs mb-3">{HEALTH_FAILED}</p> : <div
                className="flex items-center gap-2 rounded-lg px-4 py-3 mb-4 text-sm font-medium"
                style={
                  health.verdict === 'ready'
                    ? { backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }
                    : health.verdict === 'warnings'
                    ? { backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }
                    : { backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }
                }
              >
                {health.verdict === 'ready' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-6" />
                  </svg>
                ) : health.verdict === 'warnings' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <path d="M12 9v4" /><path d="M12 17h.01" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
                  </svg>
                )}
                <span>
                  {health.verdict === 'ready'
                    ? 'Content ready for publication'
                    : health.verdict === 'warnings'
                    ? 'Web elements removed — review below'
                    : `${health.emptyArticles} article(s) need attention before publishing`}
                </span>
              </div>}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  { val: health.emptyArticles,           label: 'Empty Articles',    alert: health.emptyArticles > 0 },
                  { val: health.articlesWithWebElements, label: 'Web Cleaned' },
                  { val: health.totalWebElementsRemoved, label: 'Elements Removed' },
                  { val: health.mcqLinked,               label: 'Practice Links' },
                ].map(({ val, label, alert }) => (
                  <div key={label} className="bg-[#0C1A3D] rounded-lg p-3 border border-slate-700">
                    <p className={"text-2xl font-bold " + (alert ? "text-red-400" : "text-[#C9982A]")}>{health.unavailable ? '—' : val}</p>
                    <p className="text-xs text-slate-400">{label}</p>
                  </div>
                ))}
              </div>

              {health.emptyList && health.emptyList.length > 0 ? (
                <div className="mb-4">
                  <button
                    onClick={() => setShowEmptyList(!showEmptyList)}
                    className="text-xs font-medium text-red-400 hover:text-red-300"
                  >
                    {showEmptyList ? 'Hide' : `Show empty articles (${health.emptyList.length})`}
                  </button>
                  {showEmptyList ? (
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {health.emptyList.map((title: string, i: number) => (
                        <div
                          key={i}
                          className="rounded-lg px-3 py-2 text-xs text-red-300"
                          style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                        >
                          {title}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {health.webWarningDetails && health.webWarningDetails.length > 0 ? (
                <div className="mb-4">
                  <button
                    onClick={() => setShowWebWarnings(!showWebWarnings)}
                    className="text-xs font-medium text-[#f59e0b] hover:text-yellow-400"
                  >
                    {showWebWarnings ? 'Hide' : `Show cleaned content (${health.webWarningDetails.length})`}
                  </button>
                  {showWebWarnings ? (
                    <div className="mt-2 space-y-2 max-h-52 overflow-y-auto">
                      {health.webWarningDetails.map((item: { title: string; warnings: string[] }, i: number) => (
                        <div
                          key={i}
                          className="rounded-lg px-3 py-2 text-xs"
                          style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)' }}
                        >
                          <p className="text-amber-300 font-medium mb-1">{item.title}</p>
                          <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                            {item.warnings.map((w: string, wi: number) => <li key={wi}>{w}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <p className="text-slate-500 text-xs">
                Web elements are automatically removed before printing.
                Empty articles print as &quot;Study notes not yet available.&quot;
              </p>
            </div>
          ) : null}

          {/* Step 4 - Generate */}
          {preview ? (
            <div className="bg-[#081428] rounded-xl p-6 border border-slate-700">
              <h2 className="text-sm font-semibold text-[#C9982A] uppercase tracking-wide mb-2">Step 4 — Generate Book</h2>
              <p className="text-slate-400 text-xs mb-4">Generates a KDP-ready ZIP: interior.pdf + cover.pdf + metadata.txt</p>
              <div className="bg-[#0C1A3D] rounded-lg p-3 border border-slate-700 text-xs text-slate-300 mb-4 space-y-1">
                <p><span className="text-slate-500">Title: </span>{subtitle}</p>
                <p><span className="text-slate-500">Type: </span>{BOOK_TYPES.find(b => b.value === bookType)?.label}</p>
                <p><span className="text-slate-500">Edition: </span>{edition}</p>
                <p><span className="text-slate-500">Publisher: </span>Accounting Body Press</p>
              </div>
              {generating && generationPhase ? (
                <div className="bg-[#0C1A3D] rounded-lg p-3 border border-slate-700 mb-3">
                  <p className="text-xs text-[#C9982A]">{generationPhase}</p>
                  {generationProgress ? (
                    <p className="text-xs text-slate-500 mt-1">
                      Chapter {generationProgress.current} of {generationProgress.total}
                    </p>
                  ) : null}
                </div>
              ) : null}
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
                  className="w-full bg-[#C9982A] hover:bg-yellow-500 disabled:opacity-50 text-[#0C1A3D] font-semibold text-sm py-3 rounded-lg transition-colors"
                >
                  {generating ? 'Generating PDF — please wait...' : 'Generate Book'}
                </button>
              )}
              {downloadUrl && reportItems > 0 ? <p className="text-red-400 text-xs mt-2">{reportVolumes > 1 ? REPORT_ITEMS_VOLUMES(reportVolumes, reportItems) : REPORT_ITEMS(reportItems)}</p> : null}
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

          {/* Publication History — collapsible accordion */}
          {history !== null ? (
            <div className="bg-[#081428] rounded-xl border border-slate-700">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between px-6 py-4 text-left"
              >
                <h2 className="text-sm font-semibold text-[#C9982A] uppercase tracking-wide">Publication History</h2>
                <div className="flex items-center gap-3">
                  {preview?.historyError && !showHistory ? (
                    <span className="text-slate-400 text-xs">{HISTORY_FAILED}</span>
                  ) : history.length > 0 && !showHistory ? (
                    <span className="text-slate-400 text-xs">
                      {history.length} publication{history.length !== 1 ? 's' : ''} — last: {formatGeneratedAt(history[0].generatedAt)}
                    </span>
                  ) : null}
                  <span className="text-slate-400 text-xs">{showHistory ? '▲' : '▼'}</span>
                </div>
              </button>
              {showHistory ? (
                <div className="px-6 pb-6">
                  {preview?.historyError ? (
                    <p className="text-red-400 text-xs">{HISTORY_FAILED}</p>
                  ) : history.length === 0 ? (
                    <p className="text-slate-500 text-sm">No books generated yet for this course.</p>
                  ) : (
                    <div>
                      {history.slice(0, 5).map((h: any) => (
                        <div key={h.id} className="bg-[#0C1A3D] border border-slate-700 rounded-lg p-3 mb-2">
                          <div className="flex items-center justify-between">
                            <p className="text-white text-sm font-medium">
                              {BOOK_TYPES.find(b => b.value === h.bookType)?.label || h.bookType}
                            </p>
                            <p className="text-slate-400 text-xs">{h.edition}</p>
                          </div>
                          <p className="text-slate-400 text-xs mt-1">
                            {h.subtitle && h.subtitle.length > 50 ? h.subtitle.slice(0, 50) + '…' : h.subtitle}
                          </p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-slate-300 text-xs">{h.pageCount ?? '—'} pages</span>
                            <span
                              className="px-2 py-0.5 rounded text-xs font-medium"
                              style={
                                h.kdpReady
                                  ? { backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }
                                  : { backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }
                              }
                            >
                              {h.kdpReady ? 'KDP Ready' : 'Not Ready'}
                            </span>
                            <span className="text-slate-500 text-xs">{formatGeneratedAt(h.generatedAt)}</span>
                          </div>
                          {h.contentHash ? (
                            <p className="text-slate-600 text-xs font-mono mt-1">{String(h.contentHash).slice(0, 12)}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

        </div>
      </div>
    </div>
  )
}
