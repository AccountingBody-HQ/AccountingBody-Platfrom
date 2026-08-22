import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const CAREERJET_ENDPOINT = "https://www.careerjet.co.uk/partners/api"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const keywords = searchParams.get("keywords") ?? ""
  const location = searchParams.get("location") ?? ""
  const page = searchParams.get("page") ?? "1"
  const pagesize = searchParams.get("pagesize") ?? "20"

  const affid = process.env.NEXT_PUBLIC_CAREERJET_API_KEY
  if (!affid) {
    return NextResponse.json({ error: "Careerjet API key not configured" }, { status: 500 })
  }

  const params = new URLSearchParams({ keywords, location, affid, pagesize, page })

  try {
    const res = await fetch(`${CAREERJET_ENDPOINT}?${params.toString()}`, {
      headers: { Accept: "application/json" },
    })

    if (!res.ok) {
      return NextResponse.json({ error: "Careerjet request failed" }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Careerjet request failed" }, { status: 502 })
  }
}
