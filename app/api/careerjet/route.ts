import { NextRequest, NextResponse } from "next/server"
import { ProxyAgent } from "undici"

export const dynamic = "force-dynamic"

const CAREERJET_ENDPOINT = "https://www.careerjet.co.uk/partners/api"

const proxyDispatcher = process.env.FIXIE_URL ? new ProxyAgent(process.env.FIXIE_URL) : undefined

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
}

function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0].trim()

  const realIp = req.headers.get("x-real-ip")
  if (realIp) return realIp.trim()

  return "1.0.0.1"
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const keywords = searchParams.get("keywords") ?? ""
  const location = searchParams.get("location") ?? ""
  const page = searchParams.get("page") ?? "1"
  const pagesize = searchParams.get("pagesize") ?? "20"

  console.log("FIXIE_URL set:", Boolean(process.env.FIXIE_URL))

  const affid = process.env.NEXT_PUBLIC_CAREERJET_API_KEY
  if (!affid) {
    return NextResponse.json(
      { error: "Careerjet API key not configured" },
      { status: 500, headers: NO_CACHE_HEADERS }
    )
  }

  const userIp = getClientIp(req)
  const userAgent = req.headers.get("user-agent") ?? ""

  const params = new URLSearchParams({
    keywords,
    location,
    affid,
    pagesize,
    page,
    user_ip: userIp,
    user_agent: userAgent,
  })

  try {
    const res = await fetch(`${CAREERJET_ENDPOINT}?${params.toString()}`, {
      headers: { Accept: "application/json" },
      // @ts-expect-error - `dispatcher` is a Node/undici fetch extension not in the DOM fetch types
      dispatcher: proxyDispatcher,
    })

    const rawBody = await res.text()

    if (!res.ok) {
      console.error("Careerjet API error", res.status, rawBody)
      return NextResponse.json(
        { error: "Careerjet request failed" },
        { status: res.status, headers: NO_CACHE_HEADERS }
      )
    }

    let data
    try {
      data = JSON.parse(rawBody)
    } catch {
      console.error("Careerjet API returned a non-JSON response", rawBody)
      return NextResponse.json(
        { error: "Careerjet request failed" },
        { status: 502, headers: NO_CACHE_HEADERS }
      )
    }

    return NextResponse.json(data, { headers: NO_CACHE_HEADERS })
  } catch (err) {
    console.error("Careerjet API request failed", err)
    console.log("Careerjet fetch error (full object):", err)
    return NextResponse.json(
      { error: "Careerjet request failed" },
      { status: 502, headers: NO_CACHE_HEADERS }
    )
  }
}
