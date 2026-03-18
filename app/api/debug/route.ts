import { NextResponse } from 'next/server'

export async function GET() {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
  const token     = process.env.SANITY_API_READ_TOKEN

  const query = encodeURIComponent('*[_type == "article" && slug.current == "test"][0]{_id,title}')
  const url   = `https://${projectId}.api.sanity.io/v2023-05-03/data/query/${dataset}?query=${query}`

  try {
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const data = await res.json()
    return NextResponse.json({
      projectId,
      dataset,
      hasToken: !!token,
      tokenStart: token?.slice(0, 10),
      status: res.status,
      result: data,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) })
  }
}
