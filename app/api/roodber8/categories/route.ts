import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '4rllejq1'
    const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET    ?? 'production'
    const token     = (process.env.SANITY_API_TOKEN ?? '').trim()
    const query     = encodeURIComponent(
      "*[_type == \"category\" && \'accountingbody\' in showOnSites && !defined(parentCategory)] | order(title asc) { _id, title, slug }"
    )
    const res = await fetch(
      `https://${projectId}.api.sanity.io/v2021-06-07/data/query/${dataset}?query=${query}`,
      { cache: 'no-store', headers: token ? { Authorization: `Bearer ${token}` } : {} }
    )
    if (!res.ok) return NextResponse.json({ categories: [] })
    const data = await res.json()
    return NextResponse.json({ categories: data.result ?? [] })
  } catch {
    return NextResponse.json({ categories: [] })
  }
}
