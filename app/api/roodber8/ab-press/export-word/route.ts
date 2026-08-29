// app/api/roodber8/ab-press/export-word/route.ts
// Accounting Body Press - Word Document Export
// Fetches course from Supabase, converts HTML to blocks, generates .docx
// Replaces Sanity GROQ fetch — Session 35
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, PageBreak, convertInchesToTwip,
} from "docx"
import { buildCourse, BuildStats } from "@/lib/ab-press-builder"

// ── Text cleaner ─────────────────────────────────────────────────────────────
function clean(text: string): string {
  if (!text) return ""
  return text
    .replace(/\u2013/g, "-").replace(/\u2014/g, "-").replace(/\u2212/g, "-")
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...").replace(/\u00a0/g, " ")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/[\r\n]+/g, " ").replace(/  +/g, " ").trim()
}

function hasContent(text: string): boolean { return clean(text).length > 0 }

function spansToRuns(children: any[]): TextRun[] {
  if (!children || children.length === 0) return []
  const runs: TextRun[] = []
  children.forEach((c: any, i: number) => {
    const text = clean(c.text || "")
    if (!text) return
    const marks: string[] = c.marks || []
    const isBold   = marks.includes("strong")
    const isItalic = marks.includes("em")
    if (i > 0 && runs.length > 0) {
      const prev = clean(children[i - 1].text || "")
      const lastChar  = prev[prev.length - 1] || ""
      const firstChar = text[0]
      if (lastChar && lastChar !== " " && firstChar && firstChar !== " " &&
          !".,;:!?)]}%".includes(firstChar)) {
        runs.push(new TextRun(" "))
      }
    }
    runs.push(new TextRun({ text, bold: isBold, italics: isItalic }))
  })
  return runs
}

function blocksToParagraphs(blocks: any[]): Paragraph[] {
  if (!blocks || !Array.isArray(blocks)) return []
  const paragraphs: Paragraph[] = []
  let listBuf: any[] = []
  let numCounter = 0

  function flushList() {
    if (listBuf.length === 0) return
    listBuf.forEach(item => {
      const rawText = (item.children || []).map((c: any) => c.text || "").join("")
      if (!hasContent(rawText)) return
      const runs = spansToRuns(item.children || [])
      if (item.listItem === "number") {
        numCounter++
        paragraphs.push(new Paragraph({ children: [new TextRun(`${numCounter}. `), ...runs], indent: { left: convertInchesToTwip(0.25) }, spacing: { after: 80 } }))
      } else {
        paragraphs.push(new Paragraph({ children: [new TextRun("•  "), ...runs], indent: { left: convertInchesToTwip(0.25) }, spacing: { after: 80 } }))
      }
    })
    listBuf = []
    numCounter = 0
  }

  blocks.forEach(b => {
    if (b._type !== "block") return
    const children = b.children || []
    const rawText = children.map((c: any) => c.text || "").join("")
    if (!hasContent(rawText)) { flushList(); return }
    if (b.listItem) { listBuf.push(b); return }
    flushList()
    const style = b.style || "normal"
    const runs  = spansToRuns(children)
    if (style === "h1") {
      paragraphs.push(new Paragraph({ children: runs, heading: HeadingLevel.HEADING_2, spacing: { after: 120 } }))
    } else if (style === "h2") {
      paragraphs.push(new Paragraph({ children: runs, heading: HeadingLevel.HEADING_3, spacing: { after: 100 } }))
    } else if (style === "h3" || style === "h4" || style === "h5") {
      paragraphs.push(new Paragraph({ children: runs, heading: HeadingLevel.HEADING_4, spacing: { after: 80 } }))
    } else if (style === "blockquote") {
      paragraphs.push(new Paragraph({ children: runs, indent: { left: convertInchesToTwip(0.5) }, spacing: { after: 120 } }))
    } else {
      paragraphs.push(new Paragraph({ children: runs, spacing: { after: 120 } }))
    }
  })
  flushList()
  return paragraphs
}

const LETTERS = ["A", "B", "C", "D", "E"]

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
    const body       = await req.json()
    const { slug, bookType, edition, subtitle } = body
    if (!slug)     return NextResponse.json({ error: "slug is required" },     { status: 400 })
    if (!bookType) return NextResponse.json({ error: "bookType is required" }, { status: 400 })

    const buildStats: BuildStats = { mcqFailed: [], mcqNotFound: [] }
    const course    = await buildCourse(slug, buildStats)
    const showNotes = bookType === "combined" || bookType === "study"
    const showQs    = bookType === "combined" || bookType === "practice"
    const title     = subtitle || course.title
    const year      = new Date().getFullYear()

    const allParagraphs: Paragraph[] = []

    allParagraphs.push(
      new Paragraph({ children: [new TextRun({ text: "Accounting Body Press", size: 20, color: "888888" })], alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: clean(title), bold: true, size: 52, color: "0C1A3D" })], heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 160 } }),
      new Paragraph({ children: [new TextRun({ text: edition, size: 22, color: "666666" })], alignment: AlignmentType.CENTER, spacing: { after: 160 } }),
      new Paragraph({ children: [new PageBreak()] }),
    )

    allParagraphs.push(
      new Paragraph({ children: [new TextRun({ text: `Copyright ${year} Accounting Body Press. All rights reserved.`, size: 18, color: "666666" })], spacing: { after: 80 } }),
      new Paragraph({ children: [new TextRun({ text: "Written by the Accounting Body Editorial Team.", size: 18, color: "666666" })], spacing: { after: 80 } }),
      new Paragraph({ children: [new TextRun({ text: "Accounting Body is an independent study platform and is not affiliated with, endorsed by, or connected to ACCA, CIMA, ICAEW, or AAT.", size: 18, color: "666666" })], spacing: { after: 80 } }),
      new Paragraph({ children: [new PageBreak()] }),
    )

    ;(course.chapters || []).forEach((ch: any, ci: number) => {
      allParagraphs.push(
        new Paragraph({ children: [new TextRun({ text: `Chapter ${ci + 1}`, size: 20, color: "D4A017", bold: true })], spacing: { after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: clean(ch.chapterTitle), bold: true, size: 48, color: "0C1A3D" })], heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }),
      )
      ;(ch.lessons || []).forEach((ls: any) => {
        allParagraphs.push(
          new Paragraph({ children: [new TextRun({ text: clean(ls.title), bold: true, size: 28, color: "0C1A3D" })], heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } }),
        )
        ;(ls.linkedArticles || []).forEach((art: any) => {
          if (showNotes) {
            allParagraphs.push(
              new Paragraph({ children: [new TextRun({ text: clean(art.title), bold: true, size: 22, color: "0C1A3D" })], heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 80 } }),
            )
            if (art.body && art.body.length > 0) {
              allParagraphs.push(...blocksToParagraphs(art.body))
            } else {
              allParagraphs.push(new Paragraph({ children: [new TextRun({ text: "Study notes not yet available.", italics: true, color: "999999" })], spacing: { after: 80 } }))
            }
          }
          if (showQs && art.quizQuestions && art.quizQuestions.length > 0) {
            allParagraphs.push(
              new Paragraph({ children: [new TextRun({ text: "Practice Questions", bold: true, size: 24, color: "0C1A3D" })], spacing: { before: 240, after: 120 } }),
            )
            art.quizQuestions.forEach((q: any, qi: number) => {
              allParagraphs.push(
                new Paragraph({ children: [new TextRun({ text: `Question ${qi + 1}`, bold: true, color: "D4A017", size: 18 })], spacing: { after: 60 } }),
                new Paragraph({ children: [new TextRun({ text: clean(q.questionText) })], spacing: { after: 80 } }),
              )
              ;(q.options || []).forEach((opt: any, oi: number) => {
                allParagraphs.push(new Paragraph({ children: [new TextRun(`${LETTERS[oi]}.  ${clean(opt)}`)], indent: { left: convertInchesToTwip(0.25) }, spacing: { after: 60 } }))
              })
            })
            allParagraphs.push(
              new Paragraph({ children: [new TextRun({ text: "Answer Key", bold: true, size: 24, color: "0C1A3D" })], spacing: { before: 160, after: 80 } }),
            )
            art.quizQuestions.forEach((q: any, qi: number) => {
              allParagraphs.push(
                new Paragraph({ children: [new TextRun({ text: `Q${qi + 1}: ${LETTERS[q.correctIndex ?? 0]}`, bold: true, color: "D4A017" })], spacing: { after: 40 } }),
              )
              if (q.explanation) {
                allParagraphs.push(new Paragraph({ children: [new TextRun(clean(q.explanation))], indent: { left: convertInchesToTwip(0.25) }, spacing: { after: 80 } }))
              }
            })
          }
        })
      })
      allParagraphs.push(new Paragraph({ children: [new PageBreak()] }))
    })

    const doc = new Document({
      title: clean(title),
      description: `${edition} - Accounting Body Press`,
      creator: "Accounting Body Press",
      sections: [{
        properties: {
          page: {
            margin: {
              top:    convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left:   convertInchesToTwip(1.25),
              right:  convertInchesToTwip(1),
            },
          },
        },
        children: allParagraphs,
      }],
    })

    const buffer   = await Packer.toBuffer(doc)
    const filename = `${slug}-${bookType}.docx`

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length":      String(buffer.length),
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
