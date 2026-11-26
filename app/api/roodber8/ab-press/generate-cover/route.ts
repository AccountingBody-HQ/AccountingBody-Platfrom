// app/api/roodber8/ab-press/generate-cover/route.ts
// Accounting Body Press - KDP Cover PDF Generation API
// Renders the full wrap cover (front + spine + back) once the total
// interior page count is known (needed for spine width), as the final
// step of the client-orchestrated chapter-by-chapter generation flow.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { isAuthenticated, signedOutResponse } from "@/lib/admin-auth"
import { reportServerError } from "@/lib/report-error"
import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"
import { FullCoverTemplate } from "@/components/book/FullCoverTemplate"

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
    const { bookType, edition, subtitle, pageCount, volume } = body
    if (!bookType) return NextResponse.json({ error: "bookType is required" }, { status: 400 })
    if (typeof pageCount !== "number") {
      return NextResponse.json({ error: "pageCount is required" }, { status: 400 })
    }
    if (volume !== undefined && !isVolume(volume)) return NextResponse.json({ error: "volume is invalid" }, { status: 400 })

    const pdfBuffer = await renderToBuffer(
      React.createElement(FullCoverTemplate, {
        subtitle: subtitle || "",
        bookType,
        edition:  edition || "2026/27 Edition",
        pageCount,
        ...(volume !== undefined ? { volume: { x: volume.x, n: volume.n } } : {}),
      }) as any
    )

    return NextResponse.json({ pdf: pdfBuffer.toString("base64") })
  } catch (err: unknown) {
    console.error("ab-press/generate-cover: failed:", err)
    reportServerError("admin book cover failed", err, { area: "admin" })
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
