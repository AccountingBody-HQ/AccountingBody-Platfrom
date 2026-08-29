// app/api/roodber8/ab-press/generate-cover/route.ts
// Accounting Body Press - KDP Cover PDF Generation API
// Renders the full wrap cover (front + spine + back) once the total
// interior page count is known (needed for spine width), as the final
// step of the client-orchestrated chapter-by-chapter generation flow.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"
import { FullCoverTemplate } from "@/components/book/FullCoverTemplate"

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
    const { bookType, edition, subtitle, pageCount } = body
    if (!bookType) return NextResponse.json({ error: "bookType is required" }, { status: 400 })
    if (typeof pageCount !== "number") {
      return NextResponse.json({ error: "pageCount is required" }, { status: 400 })
    }

    const pdfBuffer = await renderToBuffer(
      React.createElement(FullCoverTemplate, {
        subtitle: subtitle || "",
        bookType,
        edition:  edition || "2026/27 Edition",
        pageCount,
      }) as any
    )

    return NextResponse.json({ pdf: pdfBuffer.toString("base64") })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
