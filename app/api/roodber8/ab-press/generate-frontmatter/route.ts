// app/api/roodber8/ab-press/generate-frontmatter/route.ts
// Accounting Body Press - Title + Copyright + TOC PDF Generation API
// Called LAST in the client orchestration flow, once every chapter's real
// page count is known, so the Table of Contents gets exact page numbers
// without any probe/estimate render pass.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { isAuthenticated, signedOutResponse } from "@/lib/admin-auth"
import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"
import { FrontmatterTemplate } from "@/components/book/FrontmatterTemplate"
import { getCourseBySlug } from "@/lib/coursesNew"

export const maxDuration = 30

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return signedOutResponse()
  }
  try {
    const body = await req.json()
    const { slug, bookType, edition, subtitle, chapterPageStarts, totalPages } = body
    if (!slug)     return NextResponse.json({ error: "slug is required" },     { status: 400 })
    if (!bookType) return NextResponse.json({ error: "bookType is required" }, { status: 400 })
    if (!Array.isArray(chapterPageStarts)) {
      return NextResponse.json({ error: "chapterPageStarts is required" }, { status: 400 })
    }

    // Only the course/chapter title structure is needed for the TOC —
    // no article content or question fetching here.
    const rawCourse = await getCourseBySlug(slug, true)
    if (!rawCourse) return NextResponse.json({ error: "Course not found" }, { status: 404 })

    const course = {
      chapters: rawCourse.chapters.map((ch) => ({
        _key:         ch.id,
        chapterTitle: ch.title,
      })),
    }

    const pdfBuffer = await renderToBuffer(
      React.createElement(FrontmatterTemplate, {
        course,
        bookType,
        edition:  edition  || "2026/27 Edition",
        subtitle: subtitle || rawCourse.title,
        chapterPageStarts,
        totalPages: totalPages ?? 0,
      }) as any
    )

    return NextResponse.json({ pdf: pdfBuffer.toString("base64") })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
