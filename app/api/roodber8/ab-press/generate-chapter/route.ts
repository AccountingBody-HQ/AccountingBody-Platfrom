// app/api/roodber8/ab-press/generate-chapter/route.ts
// Accounting Body Press - Single Chapter PDF Generation API
// Renders exactly one chapter (~20 articles), so large courses can be
// generated as N short serverless calls instead of one 300s-timing-out
// call. The client (app/roodber8/ab-press/page.tsx) orchestrates one call
// per chapter, then merges the resulting PDFs with pdf-lib.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { isAuthenticated, signedOutResponse } from "@/lib/admin-auth"
import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"
import { ChapterTemplate } from "@/components/book/ChapterTemplate"
import { getCourseBySlug } from "@/lib/coursesNew"
import { htmlToBlocks } from "@/lib/html-to-blocks"
import { practiceSlug, readBookArticles, readBookQuestions } from "@/lib/ab-press-builder"

export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return signedOutResponse()
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

    // Content and quiz questions for just this chapter's articles.
    const chapterArticleIds = targetChapter.lessons.flatMap((l: any) => l.articles.map((a: any) => a.id))
    const articleRows = await readBookArticles(chapterArticleIds, "id, content, mcq_url")
    const articleMap = new Map(articleRows.map((a: any) => [a.id, a]))
    const slugToQuestions = await readBookQuestions(articleRows.map((a: any) => a.mcq_url))

    let chapterQuestionCount = 0
    const lessons = targetChapter.lessons.map((l: any) => {
      const linkedArticles = l.articles.map((a: any) => {
        const row = articleMap.get(a.id)
        const rawContent = row?.content ?? ""
        const bodyBlocks = htmlToBlocks(rawContent, true)
        const quizQuestions = slugToQuestions.get(practiceSlug(row?.mcq_url)) ?? []
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
    console.error("ab-press/generate-chapter: failed:", err)
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
