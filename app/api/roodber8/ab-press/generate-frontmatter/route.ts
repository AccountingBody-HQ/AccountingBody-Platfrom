// app/api/roodber8/ab-press/generate-frontmatter/route.ts
// Accounting Body Press - Title + Copyright + TOC PDF Generation API
// Called LAST in the client orchestration flow, once every chapter's real
// page count is known, so the Table of Contents gets exact page numbers
// without any probe/estimate render pass.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"
import { FrontmatterTemplate } from "@/components/book/FrontmatterTemplate"
import { getCourseBySlug } from "@/lib/coursesNew"

export const maxDuration = 30

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
