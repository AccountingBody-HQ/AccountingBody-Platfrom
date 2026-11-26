// app/api/roodber8/ab-press/generate-frontmatter/route.ts
// Accounting Body Press - Title + Copyright + TOC PDF Generation API
// Called LAST in the client orchestration flow, once every chapter's real
// page count is known, so the Table of Contents gets exact page numbers
// without any probe/estimate render pass.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { isAuthenticated, signedOutResponse } from "@/lib/admin-auth"
import { reportServerError } from "@/lib/report-error"
import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"
import { FrontmatterTemplate } from "@/components/book/FrontmatterTemplate"
import { getCourseBySlug } from "@/lib/coursesNew"
import { courseKey, EMPTY_COURSE, isEmptyCourse } from "@/lib/ab-press-builder"

export const maxDuration = 60

// A volume of a book made as several (owner decision D346): whole numbers
// with 1 <= x <= n <= 20.
const isVolume = (v: any) =>
  !!v && typeof v === "object" && Number.isInteger(v.x) && Number.isInteger(v.n) && v.x >= 1 && v.x <= v.n && v.n <= 20

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return signedOutResponse()
  }
  try {
    const body = await req.json()
    const { slug, bookType, edition, subtitle, chapterPageStarts, totalPages, answersPageStart, hasAnswers, volume, chapters } = body
    if (!slug)     return NextResponse.json({ error: "slug is required" },     { status: 400 })
    if (!bookType) return NextResponse.json({ error: "bookType is required" }, { status: 400 })
    if (!Array.isArray(chapterPageStarts)) {
      return NextResponse.json({ error: "chapterPageStarts is required" }, { status: 400 })
    }
    // The front pages of one volume: its chapters, as indexes into the
    // course's chapters, in order. Both are given, or neither.
    if (volume !== undefined && !isVolume(volume)) return NextResponse.json({ error: "volume is invalid" }, { status: 400 })
    if (volume === undefined && chapters !== undefined) return NextResponse.json({ error: "volume is required" }, { status: 400 })
    if (volume !== undefined && chapters === undefined) return NextResponse.json({ error: "chapters is required" }, { status: 400 })
    const chosen: number[] | null = volume === undefined ? null : chapters
    if (chosen && (
      !Array.isArray(chosen) || chosen.length === 0 || chosen.length !== chapterPageStarts.length ||
      !chosen.every((i, at) => Number.isInteger(i) && i >= 0 && (at === 0 || i > chosen[at - 1]))
    )) {
      return NextResponse.json({ error: "chapters is invalid" }, { status: 400 })
    }

    // Only the course/chapter title structure is needed for the TOC —
    // no article content or question fetching here.
    const rawCourse = await getCourseBySlug(slug, true)
    if (!rawCourse) return NextResponse.json({ error: "Course not found" }, { status: 404 })
    if (isEmptyCourse(rawCourse)) return NextResponse.json({ error: EMPTY_COURSE }, { status: 422 })
    if (chosen && chosen[chosen.length - 1] >= rawCourse.chapters.length) {
      return NextResponse.json({ error: "chapters is invalid" }, { status: 400 })
    }

    const course = chosen
      ? {
          // A volume's contents page keeps each chapter's number in the course.
          chapters: chosen.map((i) => ({
            _key:          rawCourse.chapters[i].id,
            chapterTitle:  rawCourse.chapters[i].title,
            chapterNumber: i + 1,
          })),
        }
      : {
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
        answersPageStart: typeof answersPageStart === "number" ? answersPageStart : undefined,
        hasAnswers: hasAnswers === false ? false : undefined,
        ...(volume !== undefined ? { volume: { x: volume.x, n: volume.n } } : {}),
      }) as any
    )

    return NextResponse.json({ pdf: pdfBuffer.toString("base64"), courseKey: courseKey(rawCourse) })
  } catch (err: unknown) {
    console.error("ab-press/generate-frontmatter: failed:", err)
    reportServerError("admin book front pages failed", err, { area: "admin" })
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
