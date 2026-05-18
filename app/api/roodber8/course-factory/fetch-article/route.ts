// app/api/roodber8/course-factory/fetch-article/route.ts
// Server-side article fetch by wpId or contentId — uses SANITY_API_TOKEN

import { NextRequest, NextResponse } from 'next/server'

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '4rllejq1'
const DATASET    = process.env.NEXT_PUBLIC_SANITY_DATASET    ?? 'production'
const TOKEN      = process.env.SANITY_API_TOKEN

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')?.trim()
  if (!id) return NextResponse.json({ article: null, error: 'No ID provided' }, { status: 400 })

  const isContentId = id.startsWith('AB-')
  const condition   = isContentId
    ? `contentId == "${id}"`
    : `wpId == "${id}"`

  const query = encodeURIComponent(
    `*[_type == "article" && "accountingbody" in showOnSites && ${condition}][0] {
      _id, title, slug, excerpt, contentId, wpId
    }`
  )

  try {
    const res = await fetch(
      `https://${PROJECT_ID}.api.sanity.io/v2023-05-03/data/query/${DATASET}?query=${query}`,
      {
        headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
        cache: 'no-store',
      }
    )
    if (!res.ok) return NextResponse.json({ article: null, error: 'Sanity fetch failed' }, { status: 500 })
    const data = await res.json()
    return NextResponse.json({ article: data.result ?? null })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ article: null, error: msg }, { status: 500 })
  }
}
