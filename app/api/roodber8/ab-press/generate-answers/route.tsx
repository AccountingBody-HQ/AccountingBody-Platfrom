// app/api/roodber8/ab-press/generate-answers/route.ts
// Accounting Body Press - Answers and Explanations PDF Generation API
// Renders only the "Answers and Explanations" back-of-book section, for
// combined/practice book types. With an optional chapterIndex, renders
// just that chapter's answers (large-course orchestration calls this once
// per chapter, same pattern as generate-chapter, to avoid the 60s timeout
// rendering every chapter's answers in one call would hit); without it,
// renders every chapter in one call (small-course path). Question
// numbering here is continuous across the whole course (a single running
// counter over every chapter in order, continued via questionNumberOffset
// on the per-chapter path) to match ChapterTemplate's questionNumberOffset
// scheme — unlike the single-request BookTemplate.tsx fallback, which
// numbers "Question 1" fresh within each chapter.
//
// No separate AnswersTemplate.tsx component was requested for this route,
// so the render tree is a small local component defined here — the same
// "self-contained, safe to duplicate" pattern used by ChapterTemplate.tsx
// and FrontmatterTemplate.tsx, just not exported for reuse elsewhere.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { Document, Page, Text, View, StyleSheet, Font, renderToBuffer } from "@react-pdf/renderer"
import React from "react"
import { getCourseBySlug } from "@/lib/coursesNew"
import { createSupabaseClient } from "@/lib/ab-press-builder"

export const maxDuration = 60

Font.registerHyphenationCallback((word: string) => [word])
const FONT_BASE = "https://accountingbody.com/fonts"
Font.register({
  family: "BookSans",
  fonts: [
    { src: FONT_BASE + "/LiberationSans-Regular.ttf" },
    { src: FONT_BASE + "/LiberationSans-Italic.ttf", fontStyle: "italic" },
  ],
})
Font.register({
  family: "BookSans-Bold",
  src: FONT_BASE + "/LiberationSans-Bold.ttf",
})

const W = 6 * 72
const H = 9 * 72
const MT = 0.75 * 72
const MB = 0.75 * 72
const MI = 0.75 * 72
const MO = 0.5 * 72

const s = StyleSheet.create({
  page: {
    width: W, height: H,
    paddingTop: MT + 20, paddingBottom: MB,
    paddingLeft: MI, paddingRight: MO,
    fontFamily: "BookSans", backgroundColor: "#ffffff",
  },
  runningHead: {
    position: "absolute", top: 12, right: MO,
    fontSize: 7, color: "#aaaaaa",
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  runningLine: {
    position: "absolute", top: 24, left: MI, right: MO,
    borderBottomWidth: 0.5, borderBottomColor: "#dddddd",
  },
  chapterWrap: { marginBottom: 24 },
  chapterLabel: {
    fontSize: 8, color: "#D4A017", fontFamily: "BookSans-Bold",
    textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6,
  },
  chapterTitle: {
    fontSize: 22, fontFamily: "BookSans-Bold", color: "#0C1A3D",
    marginBottom: 8, lineHeight: 1.2,
  },
  chapterRule: {
    borderBottomWidth: 2, borderBottomColor: "#D4A017", marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 11, fontFamily: "BookSans-Bold", color: "#0C1A3D", marginBottom: 10,
  },
  answerWrap: { marginBottom: 10 },
  answerLabel: {
    fontSize: 9, color: "#D4A017", fontFamily: "BookSans-Bold", marginBottom: 2,
  },
  answerText: { fontSize: 9, color: "#333333", lineHeight: 1.6 },
})

// ── Unicode sanitiser (duplicated from BookTemplate.tsx) ──────────────────────
function sanitise(text: string): string {
  if (!text) return ""
  return text
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-")
    .replace(/\u2212/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/\u2192/g, "->")
    .replace(/\u2190/g, "<-")
    .replace(/\u21D2/g, "=>")
    .replace(/\u00D7/g, "x")
    .replace(/\u00F7/g, "/")
    .replace(/\u2260/g, "!=")
    .replace(/\u2265/g, ">=")
    .replace(/\u2264/g, "<=")
    .replace(/\u00B1/g, "+/-")
    .replace(/\u2022/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/\u200b/g, "")
    .replace(/\u200c/g, "")
    .replace(/\u200d/g, "")
    .replace(/\ufeff/g, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/  +/g, " ")
    .trim()
}

const LETTERS = ["A", "B", "C", "D", "E"]

const EXPLANATION_KEYS = [
  "OVERVIEW:",
  "DATA (INPUTS & ASSUMPTIONS):",
  "METHOD:",
  "SOLUTION (STEP-BY-STEP):",
  "APPLY TO THIS CASE:",
  "KEY TAKEAWAY:",
  "COMMON PITFALL:",
]

function formatExplanation(text: string): React.ReactElement[] {
  const out: React.ReactElement[] = []
  let remaining = text.trim()
  let keyIndex = 0

  while (remaining.length > 0) {
    let nextKeyPos = -1
    for (const key of EXPLANATION_KEYS) {
      const pos = remaining.indexOf(key, 1)
      if (pos > 0 && (nextKeyPos === -1 || pos < nextKeyPos)) {
        nextKeyPos = pos
      }
    }

    let chunk: string
    if (nextKeyPos === -1) {
      chunk = remaining
      remaining = ""
    } else {
      chunk = remaining.slice(0, nextKeyPos)
      remaining = remaining.slice(nextKeyPos)
    }

    chunk = chunk.trim()
    if (!chunk) continue

    const colonPos = chunk.indexOf(":")
    if (colonPos > 0 && colonPos < 40) {
      const label = chunk.slice(0, colonPos).trim()
      const bodyText = chunk.slice(colonPos + 1).trim()
      out.push(
        <View key={keyIndex++} style={{ marginBottom: 4 }} wrap={false}>
          <Text style={{ fontSize: 8, color: "#000000", fontFamily: "BookSans-Bold", marginBottom: 1 }}>{label}</Text>
          {bodyText ? <Text style={{ fontSize: 8.5, color: "#333333", lineHeight: 1.5 }}>{bodyText}</Text> : null}
        </View>
      )
    } else {
      out.push(
        <Text key={keyIndex++} style={{ fontSize: 8.5, color: "#333333", lineHeight: 1.5, marginBottom: 4 }}>{chunk}</Text>
      )
    }
  }
  return out
}

interface AnswersDocProps {
  course:   { chapters: { chapterTitle: string; lessons: { linkedArticles: { quizQuestions: any[] }[] }[] }[] }
  subtitle: string
  // Chapter number (0-based) of course.chapters[0] within the full book —
  // 0 when rendering every chapter, chapterIndex when rendering just one.
  chapterIndexOffset?: number
  // Running question counter to start from, so a single-chapter render
  // continues the same continuous numbering ChapterTemplate produces via
  // questionNumberOffset instead of restarting at 1.
  startNumber?: number
}

function AnswersDocument({ course, subtitle, chapterIndexOffset = 0, startNumber = 0 }: AnswersDocProps) {
  // Single running counter across the whole course — matches the
  // continuous numbering ChapterTemplate produces via questionNumberOffset.
  let n = startNumber

  return (
    <Document
      title={subtitle}
      author="Accounting Body Editorial Team"
      creator="Accounting Body Press"
      producer="Accounting Body Press"
    >
      <Page size={[W, H]} style={s.page}>
        <Text style={s.runningHead} fixed>{sanitise(subtitle)}</Text>
        <View style={s.runningLine} fixed />
        <View style={s.chapterWrap}>
          <Text style={s.chapterLabel}>Answers</Text>
          <Text style={s.chapterTitle}>Answers and Explanations</Text>
          <View style={s.chapterRule} />
        </View>
        {course.chapters.map((ch, ci) => {
          const list: { q: any; num: number }[] = []
          for (const ls of (ch.lessons || [])) {
            for (const art of (ls.linkedArticles || [])) {
              for (const q of (art.quizQuestions || [])) {
                n++
                list.push({ q, num: n })
              }
            }
          }
          if (list.length === 0) return null
          return (
            <View key={ci}>
              <Text style={s.sectionHeader}>Chapter {ci + chapterIndexOffset + 1}: {sanitise(ch.chapterTitle)}</Text>
              {list.map(({ q, num }) => (
                <View key={num} style={s.answerWrap}>
                  <Text style={s.answerLabel}>Q{num}: {LETTERS[q.correctIndex ?? 0]}</Text>
                  {q.explanation ? <View>{formatExplanation(sanitise(q.explanation))}</View> : null}
                </View>
              ))}
            </View>
          )
        })}
      </Page>
    </Document>
  )
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
    const { slug, subtitle, chapterIndex, questionNumberOffset } = body
    if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 })

    const rawCourse = await getCourseBySlug(slug, true)
    if (!rawCourse) return NextResponse.json({ error: "Course not found" }, { status: 404 })

    if (chapterIndex !== undefined && !rawCourse.chapters[chapterIndex]) {
      return NextResponse.json({ error: "Invalid chapterIndex" }, { status: 400 })
    }

    const supabase = createSupabaseClient()

    // Bulk-fetch mcq_url for every article in the course (content not
    // needed here — only quiz questions are rendered on this page).
    const allArticleIds = rawCourse.chapters.flatMap((ch) => ch.lessons.flatMap((l) => l.articles.map((a) => a.id)))
    const { data: articleRows } = await supabase
      .from("articles")
      .select("id, mcq_url")
      .in("id", allArticleIds)
    const mcqUrlById = new Map((articleRows ?? []).map((a: any) => [a.id, a.mcq_url]))

    // Same 2-query bulk batch pattern as lib/ab-press-builder.ts, scoped to
    // the whole course.
    const mcqSlugs = Array.from(new Set(
      (articleRows ?? [])
        .map((a: any) => a.mcq_url)
        .filter(Boolean)
        .map((url: string) => url.split("/").filter(Boolean).pop())
        .filter(Boolean)
    ))

    const slugToSetId = new Map<string, string>()
    const setIdToQuestions = new Map<string, any[]>()

    if (mcqSlugs.length > 0) {
      const { data: allSets } = await supabase
        .from("question_sets")
        .select("id, slug")
        .in("slug", mcqSlugs)

      for (const st of (allSets ?? [])) slugToSetId.set(st.slug, st.id)

      const allSetIds = (allSets ?? []).map((st) => st.id)
      if (allSetIds.length > 0) {
        const { data: allQuestions } = await supabase
          .from("questions")
          .select("set_id, question_text, option_a, option_b, option_c, option_d, correct_index, explanation")
          .in("set_id", allSetIds)
          .order("question_order", { ascending: true })

        for (const q of (allQuestions ?? [])) {
          const arr = setIdToQuestions.get(q.set_id) ?? []
          arr.push({
            questionText:  q.question_text,
            options:       [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean),
            correctIndex:  q.correct_index,
            explanation:   q.explanation ?? "",
          })
          setIdToQuestions.set(q.set_id, arr)
        }
      }
    }

    const course = {
      chapters: rawCourse.chapters.map((ch) => ({
        chapterTitle: ch.title,
        lessons: ch.lessons.map((l) => ({
          linkedArticles: l.articles.map((a) => {
            const mcqUrl = mcqUrlById.get(a.id)
            let quizQuestions: any[] = []
            if (mcqUrl) {
              const practiceSlug = mcqUrl.split("/").filter(Boolean).pop() ?? ""
              const setId = slugToSetId.get(practiceSlug)
              if (setId) quizQuestions = setIdToQuestions.get(setId) ?? []
            }
            return { quizQuestions }
          }),
        })),
      })),
    }

    const chaptersToRender = chapterIndex !== undefined
      ? [course.chapters[chapterIndex]]
      : course.chapters

    const questionCount = chaptersToRender.reduce((sum, ch) =>
      sum + ch.lessons.reduce((s, ls) =>
        s + ls.linkedArticles.reduce((a, art) =>
          a + (art.quizQuestions || []).length, 0), 0), 0)

    if (chapterIndex !== undefined && questionCount === 0) {
      return NextResponse.json({ pdf: null, pageCount: 0, questionCount: 0 })
    }

    const pdfBuffer = await renderToBuffer(
      React.createElement(AnswersDocument, {
        course: { chapters: chaptersToRender },
        subtitle: subtitle || rawCourse.title,
        chapterIndexOffset: chapterIndex ?? 0,
        startNumber: questionNumberOffset ?? 0,
      }) as any
    )

    const pdfStr = pdfBuffer.toString("binary")
    const pageMatches = pdfStr.match(/\/Type\s*\/Page[^s]/g)
    const pageCount = pageMatches ? pageMatches.length : 1

    return NextResponse.json({
      pdf: pdfBuffer.toString("base64"),
      pageCount,
      questionCount,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
