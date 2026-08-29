// app/api/roodber8/ab-press/generate-chapter/route.ts
// Accounting Body Press - Single Chapter PDF Generation API
// Renders exactly one chapter (~20 articles), so large courses can be
// generated as N short serverless calls instead of one 300s-timing-out
// call. The client (app/roodber8/ab-press/page.tsx) orchestrates one call
// per chapter, then merges the resulting PDFs with pdf-lib.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"
import { ChapterTemplate } from "@/components/book/ChapterTemplate"
import { getCourseBySlug } from "@/lib/coursesNew"
import { htmlToBlocks } from "@/lib/html-to-blocks"
import { createSupabaseClient } from "@/lib/ab-press-builder"

export const maxDuration = 60

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
    const { slug, bookType, edition, subtitle, chapterIndex, questionNumberOffset } = body
    if (!slug)     return NextResponse.json({ error: "slug is required" },     { status: 400 })
    if (!bookType) return NextResponse.json({ error: "bookType is required" }, { status: 400 })
    if (typeof chapterIndex !== "number") {
      return NextResponse.json({ error: "chapterIndex is required" }, { status: 400 })
    }

    const rawCourse = await getCourseBySlug(slug, true)
    if (!rawCourse) return NextResponse.json({ error: "Course not found" }, { status: 404 })

    const targetChapter = rawCourse.chapters[chapterIndex]
    if (!targetChapter) return NextResponse.json({ error: "Chapter index out of range" }, { status: 400 })

    const supabase = createSupabaseClient()

    // Fetch content for just this chapter's articles (same bulk SELECT
    // shape as lib/ab-press-builder.ts's buildCourse(), scoped to one chapter).
    const chapterArticleIds = targetChapter.lessons.flatMap((l: any) => l.articles.map((a: any) => a.id))
    const { data: articleRows } = await supabase
      .from("articles")
      .select("id, content, mcq_url")
      .in("id", chapterArticleIds)
    const articleMap = new Map((articleRows ?? []).map((a: any) => [a.id, a]))

    // Bulk-fetch quiz questions for this chapter only — same 2-query batch
    // pattern as buildCourse() (1 query for matching question_sets by slug,
    // 1 query for all their questions), scoped to this chapter's mcq_urls.
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

    let chapterQuestionCount = 0
    const lessons = targetChapter.lessons.map((l: any) => {
      const linkedArticles = l.articles.map((a: any) => {
        const row = articleMap.get(a.id)
        const rawContent = row?.content ?? ""
        const bodyBlocks = htmlToBlocks(rawContent, true)
        let quizQuestions: any[] = []
        if (row?.mcq_url) {
          const practiceSlug = row.mcq_url.split("/").filter(Boolean).pop() ?? ""
          const setId = slugToSetId.get(practiceSlug)
          if (setId) quizQuestions = setIdToQuestions.get(setId) ?? []
        }
        chapterQuestionCount += quizQuestions.length
        return {
          _id:     a.id,
          title:   a.title,
          slug:    a.slug,
          excerpt: a.excerpt ?? "",
          body:    bodyBlocks,
          quizQuestions,
        }
      })
      return { _id: l.id, title: l.title, slug: l.slug, linkedArticles }
    })

    const builtChapter = {
      _key:         targetChapter.id,
      chapterTitle: targetChapter.title,
      chapterOrder: targetChapter.chapterOrder,
      lessons,
    }

    // Sparse array so ChapterTemplate's course.chapters[chapterIndex]
    // indexing yields the correct real chapter number for display.
    const course: any = { chapters: [] }
    course.chapters[chapterIndex] = builtChapter

    const pdfBuffer = await renderToBuffer(
      React.createElement(ChapterTemplate, {
        course,
        chapterIndex,
        bookType,
        edition:  edition  || "2026/27 Edition",
        subtitle: subtitle || rawCourse.title,
        questionNumberOffset: questionNumberOffset ?? 0,
      }) as any
    )

    const pdfStr = pdfBuffer.toString("binary")
    const pageMatches = pdfStr.match(/\/Type\s*\/Page[^s]/g)
    const pageCount = pageMatches ? pageMatches.length : 1

    return NextResponse.json({
      pdf: pdfBuffer.toString("base64"),
      pageCount,
      chapterIndex,
      questionCount: chapterQuestionCount,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
