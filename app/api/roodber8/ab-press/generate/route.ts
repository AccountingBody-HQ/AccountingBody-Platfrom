// app/api/roodber8/ab-press/generate/route.ts
// Accounting Body Press - PDF Generation API
// Fetches course from Supabase, converts HTML content to blocks, renders PDFs, returns ZIP
// Replaces Sanity GROQ fetch — Session 35
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"
import { BookTemplate } from "@/components/book/BookTemplate"
import { FullCoverTemplate } from "@/components/book/FullCoverTemplate"
import { getCourseBySlug } from "@/lib/coursesNew"
import { createClient } from "@supabase/supabase-js"

export const maxDuration = 300

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// ── HTML → Portable Text blocks ──────────────────────────────────────────────
// Converts plain HTML (WordPress-stripped) into minimal Portable Text blocks
// so BookTemplate can render without modification.
function htmlToBlocks(html: string): any[] {
  if (!html) return []
  const text = html
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, "\n__H__$1\n")
    .replace(/<li[^>]*>(.*?)<\/li>/gi, "\n__LI__$1")
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "\n$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, i) => {
      if (line.startsWith("__H__")) {
        return {
          _type: "block", _key: `b${i}`, style: "h2", markDefs: [],
          children: [{ _type: "span", text: line.replace("__H__", ""), marks: [] }],
        }
      }
      if (line.startsWith("__LI__")) {
        return {
          _type: "block", _key: `b${i}`, style: "normal", listItem: "bullet", markDefs: [],
          children: [{ _type: "span", text: line.replace("__LI__", ""), marks: [] }],
        }
      }
      return {
        _type: "block", _key: `b${i}`, style: "normal", markDefs: [],
        children: [{ _type: "span", text: line, marks: [] }],
      }
    })
}

// ── Fetch questions for an article via mcq_url ───────────────────────────────
async function fetchQuestions(mcqUrl: string, stats: { mcqFailed: string[]; mcqNotFound: string[] }): Promise<any[]> {
  try {
    const parts = mcqUrl.split("/")
    const practiceSlug = parts[parts.length - 1]
    if (!practiceSlug) return []

    const { data: qSet } = await supabase
      .from("question_sets")
      .select("id")
      .eq("slug", practiceSlug)
      .maybeSingle()

    if (!qSet) { stats.mcqNotFound.push(practiceSlug); return [] }

    const { data: questions } = await supabase
      .from("questions")
      .select("question_text, option_a, option_b, option_c, option_d, correct_index, explanation")
      .eq("set_id", qSet.id)
      .order("question_order", { ascending: true })

    return (questions ?? []).map((q) => ({
      questionText:  q.question_text,
      options:       [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean),
      correctIndex:  q.correct_index,
      explanation:   q.explanation ?? "",
    }))
  } catch {
    const parts = mcqUrl.split("/")
    stats.mcqFailed.push(parts[parts.length - 1] ?? mcqUrl)
    return []
  }
}

// ── Build course in BookTemplate shape ───────────────────────────────────────
async function buildCourse(slug: string, stats: { mcqFailed: string[]; mcqNotFound: string[] }) {
  const course = await getCourseBySlug(slug, true)
  if (!course) throw new Error("Course not found")

  // Fetch full article content (including HTML body and mcq_url)
  const allArticleIds = course.chapters
    .flatMap((ch) => ch.lessons.flatMap((l) => l.articles.map((a) => a.id)))

  const { data: articleRows } = await supabase
    .from("articles")
    .select("id, content, mcq_url")
    .in("id", allArticleIds)

  const articleMap = new Map((articleRows ?? []).map((a) => [a.id, a]))

  const chapters = await Promise.all(
    course.chapters.map(async (ch) => {
      const lessons = await Promise.all(
        ch.lessons.map(async (l) => {
          const linkedArticles = await Promise.all(
            l.articles.map(async (a) => {
              const row = articleMap.get(a.id)
              const body = htmlToBlocks(row?.content ?? "")
              let quizQuestions: any[] = []
              if (row?.mcq_url) {
                quizQuestions = await fetchQuestions(row.mcq_url, stats)
              }
              return {
                _id:          a.id,
                title:        a.title,
                slug:         a.slug,
                excerpt:      a.excerpt ?? "",
                mcqUrl:       row?.mcq_url ?? "",
                body,
                quizQuestions,
              }
            })
          )
          return { _id: l.id, title: l.title, slug: l.slug, linkedArticles }
        })
      )
      return {
        _key:         ch.id,
        chapterTitle: ch.title,
        chapterOrder: ch.chapterOrder,
        lessons,
      }
    })
  )

  return {
    _id:          course.id,
    title:        course.title,
    slug:         course.slug,
    description:  course.description ?? "",
    level:        course.level ?? "",
    categoryTitle: "",
    chapters,
  }
}

const BOOK_TYPE_LABELS: Record<string, string> = {
  combined: "Study Text and Practice Kit",
  study:    "Study Text",
  practice: "Practice Kit",
}

function buildMetadata(subtitle: string, bookType: string, edition: string, course: any): string {
  const lines = [
    "ACCOUNTING BODY PRESS - BOOK METADATA",
    "=====================================",
    "",
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
    "",
    "COURSE INFO",
    "-----------",
    `Course: ${course.title}`,
    `Level: ${course.level || "Not specified"}`,
    `Category: ${course.categoryTitle || "Not specified"}`,
    `Chapters: ${(course.chapters || []).length}`,
    "",
    "KDP UPLOAD INSTRUCTIONS",
    "-----------------------",
    "1. Log in to kdp.amazon.com",
    "2. Create new paperback title",
    "3. Enter metadata from above",
    "4. Upload interior.pdf as manuscript",
    "5. Upload cover.pdf as cover",
    "6. Choose 6x9 trim size, black and white interior",
    "7. Set price and territories",
    "8. Submit for review",
    "",
    `Generated: ${new Date().toISOString()}`,
    "Generated by: Accounting Body Press Publishing System",
  ]
  return lines.join("\n")
}

function buildFidelity(course: any, stats: { mcqFailed: string[]; mcqNotFound: string[] }, bookType: string): string {
  const chapters = course.chapters || []
  let lessons = 0, articles = 0, emptyBodies = 0, questions = 0, mcqLinks = 0
  const emptyList: string[] = []
  for (const ch of chapters) {
    for (const ls of (ch.lessons || [])) {
      lessons++
      for (const art of (ls.linkedArticles || [])) {
        articles++
        const body = art.body || []
        const hasContent = body.some((b: any) =>
          b._type === "block" &&
          ((b.children || []).map((c: any) => c.text || "").join("")).trim().length > 0
        )
        if (!hasContent) { emptyBodies++; emptyList.push(art.title || art._id) }
        if (art.mcqUrl) mcqLinks++
        questions += (art.quizQuestions || []).length
      }
    }
  }
  const showQuestions = bookType === "combined" || bookType === "practice"
  const issues = emptyBodies + stats.mcqFailed.length + stats.mcqNotFound.length
  const lines = [
    "CONTENT FIDELITY AUDIT",
    "======================",
    "",
    "Source inventory (fetched from Supabase):",
    "  Chapters: " + chapters.length,
    "  Lessons: " + lessons,
    "  Articles: " + articles,
    "  Articles with practice links (mcq_url): " + mcqLinks,
    "  Quiz questions fetched: " + questions + (showQuestions ? "" : " (not printed in this book type)"),
    "",
  ]
  if (emptyBodies > 0) {
    lines.push("[WARN] " + emptyBodies + " article(s) with no body content - book prints 'Study notes not yet available':")
    for (const t of emptyList.slice(0, 10)) lines.push("       - " + t)
    if (emptyList.length > 10) lines.push("       ... and " + (emptyList.length - 10) + " more")
  } else {
    lines.push("[PASS] Every article has body content")
  }
  if (stats.mcqNotFound.length > 0) {
    lines.push("[WARN] " + stats.mcqNotFound.length + " linked practice set(s) not found: " + stats.mcqNotFound.join(", "))
  } else {
    lines.push("[PASS] All linked practice sets found")
  }
  if (stats.mcqFailed.length > 0) {
    lines.push("[WARN] " + stats.mcqFailed.length + " practice fetch(es) errored: " + stats.mcqFailed.join(", "))
  } else {
    lines.push("[PASS] No practice fetch errors")
  }
  lines.push("")
  lines.push(issues === 0
    ? "FIDELITY VERDICT: COMPLETE - everything fetched from Supabase is accounted for in this book."
    : "FIDELITY VERDICT: " + issues + " item(s) need review - see [WARN] lines above.")
  return lines.join("\n")
}

function buildPreflight(interiorPdf: Buffer, coverPdf: Buffer, pageCount: number, subtitle: string, bookType: string): string {
  const interiorStr = interiorPdf.toString("binary")
  const coverStr    = coverPdf.toString("binary")
  const checks: { name: string; pass: boolean; detail: string }[] = []
  const hasEmbedded = /\/FontFile2/.test(interiorStr) && /\/FontFile2/.test(coverStr)
  const hasStdHelv  = /\/BaseFont\s*\/Helvetica[^-]/.test(interiorStr) || /\/BaseFont\s*\/Helvetica[^-]/.test(coverStr)
  checks.push({ name: "Fonts embedded", pass: hasEmbedded && !hasStdHelv,
    detail: hasEmbedded && !hasStdHelv ? "Liberation Sans embedded in interior and cover" : "Non-embedded font detected - KDP may reject" })
  const pagesOk = pageCount >= 24 && pageCount <= 828
  checks.push({ name: "Page count", pass: pagesOk, detail: pageCount + " pages (KDP limit 24-828)" })
  const spineIn   = Math.max(pageCount * 0.002252, 0.5)
  const expectedW = (6.125 * 2 + spineIn) * 72
  const expectedH = 9.25 * 72
  const boxMatch  = coverStr.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/)
  const coverW    = boxMatch ? parseFloat(boxMatch[1]) : 0
  const coverH    = boxMatch ? parseFloat(boxMatch[2]) : 0
  const coverOk   = Math.abs(coverW - expectedW) < 1 && Math.abs(coverH - expectedH) < 1
  checks.push({ name: "Cover dimensions", pass: coverOk,
    detail: coverW.toFixed(2) + " x " + coverH.toFixed(2) + " pts (expected " + expectedW.toFixed(2) + " x " + expectedH.toFixed(2) + ", spine " + spineIn.toFixed(3) + "in)" })
  const trimOk = /\/MediaBox\s*\[\s*0\s+0\s+432\s+648\s*\]/.test(interiorStr)
  checks.push({ name: "Interior trim 6x9", pass: trimOk, detail: trimOk ? "432 x 648 pts confirmed" : "Unexpected interior page size" })
  checks.push({ name: "Title metadata", pass: subtitle.trim().length > 0, detail: subtitle || "MISSING" })
  const allPass = checks.every((c) => c.pass)
  const lines = [
    "ACCOUNTING BODY PRESS - KDP PRE-FLIGHT REPORT",
    "=============================================",
    "",
    "Book: " + subtitle + " (" + bookType + ")",
    "Generated: " + new Date().toISOString(),
    "",
    ...checks.map((c) => (c.pass ? "[PASS] " : "[FAIL] ") + c.name + " - " + c.detail),
    "",
    allPass
      ? "VERDICT: KDP-READY - upload interior.pdf and cover.pdf as-is."
      : "VERDICT: NOT READY - resolve [FAIL] items before uploading to KDP.",
  ]
  return lines.join("\n")
}

function u32le(n: number): Buffer { const b = Buffer.alloc(4); b.writeUInt32LE(n, 0); return b }
function u16le(n: number): Buffer { const b = Buffer.alloc(2); b.writeUInt16LE(n, 0); return b }
function crc32(buf: Buffer): number {
  const t: number[] = []
  for (let i = 0; i < 256; i++) { let c = i; for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
function buildZip(files: { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = []; const centrals: Buffer[] = []; let offset = 0
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8"); const crc = crc32(f.data); const size = f.data.length
    const local = Buffer.concat([Buffer.from([0x50,0x4b,0x03,0x04]),u16le(20),u16le(0),u16le(0),u16le(0),u16le(0),u32le(crc),u32le(size),u32le(size),u16le(name.length),u16le(0),name,f.data])
    locals.push(local)
    centrals.push(Buffer.concat([Buffer.from([0x50,0x4b,0x01,0x02]),u16le(20),u16le(20),u16le(0),u16le(0),u16le(0),u16le(0),u32le(crc),u32le(size),u32le(size),u16le(name.length),u16le(0),u16le(0),u16le(0),u16le(0),u32le(0),u32le(offset),name]))
    offset += local.length
  }
  const cd = Buffer.concat(centrals)
  const eocd = Buffer.concat([Buffer.from([0x50,0x4b,0x05,0x06]),u16le(0),u16le(0),u16le(files.length),u16le(files.length),u32le(cd.length),u32le(offset),u16le(0)])
  return Buffer.concat([...locals, cd, eocd])
}

async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get("admin_token")?.value
  if (!token) return false
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const expectedHash = await sha256Hex(secret)
  return token === expectedHash
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { slug, bookType, edition, subtitle } = body
    if (!slug)     return NextResponse.json({ error: "slug is required" },     { status: 400 })
    if (!bookType) return NextResponse.json({ error: "bookType is required" }, { status: 400 })

    const fidelityStats = { mcqFailed: [] as string[], mcqNotFound: [] as string[] }
    const course = await buildCourse(slug, fidelityStats)

    const pageMap: Record<number, number> = {}
    await renderToBuffer(
      React.createElement(BookTemplate, {
        course,
        bookType: bookType as any,
        edition:  edition  || "2026/27 Edition",
        subtitle: subtitle || course.title,
        onChapterPage: (ci: number, page: number) => { pageMap[ci] = page },
      }) as any
    )

    const interiorPdf = await renderToBuffer(
      React.createElement(BookTemplate, {
        course,
        bookType: bookType as any,
        edition:  edition  || "2026/27 Edition",
        subtitle: subtitle || course.title,
        pageMap,
      }) as any
    )

    const interiorStr  = interiorPdf.toString("binary")
    const pageMatches  = interiorStr.match(/\/Type\s*\/Page[^s]/g)
    const pageCount    = pageMatches ? pageMatches.length : 300

    const coverPdf = await renderToBuffer(
      React.createElement(FullCoverTemplate, {
        subtitle:  subtitle || course.title,
        bookType:  bookType as any,
        edition:   edition  || "2026/27 Edition",
        pageCount,
      }) as any
    )

    const metaBuffer      = Buffer.from(buildMetadata(subtitle || course.title, bookType, edition || "2026/27 Edition", course), "utf8")
    const preflightBuffer = Buffer.from(buildPreflight(interiorPdf, coverPdf, pageCount, subtitle || course.title, bookType) + "\n\n" + buildFidelity(course, fidelityStats, bookType), "utf8")

    const zip      = buildZip([
      { name: "interior.pdf",         data: interiorPdf     },
      { name: "cover.pdf",            data: coverPdf        },
      { name: "metadata.txt",         data: metaBuffer      },
      { name: "preflight-report.txt", data: preflightBuffer },
    ])

    return new NextResponse(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type":        "application/zip",
        "Content-Disposition": `attachment; filename="${slug}-${bookType}.zip"`,
        "Content-Length":      String(zip.length),
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
