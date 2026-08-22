import { NextRequest, NextResponse } from "next/server"
import { ProxyAgent } from "undici"

export const dynamic = "force-dynamic"

const CAREERJET_ENDPOINT = "https://search.api.careerjet.net/v4/query"

const BASE_KEYWORDS =
  'accountant OR auditor OR bookkeeper OR "finance manager" OR "financial analyst" OR "financial controller" OR "management accountant" OR payroll OR "tax manager" OR "tax accountant" OR treasury OR comptroller OR "accounts payable" OR "accounts receivable" OR CFO OR "chief financial officer" OR "credit analyst" OR "credit controller" OR "finance director" OR "investment analyst" OR "fund accountant" OR "cost accountant" OR ACCA OR CIMA OR ACA OR CPA OR actuary OR insolvency OR "revenue accountant" OR "finance business partner"'

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
  const role = searchParams.get("role")?.trim() ?? ""
  const keywords = role ? `${BASE_KEYWORDS} ${role}` : BASE_KEYWORDS
  const location = searchParams.get("location")?.trim() ?? ""
  const page = searchParams.get("page") ?? "1"
  const pageSize = searchParams.get("pagesize") ?? "20"
  const sort = searchParams.get("sort")?.trim() ?? ""
  const contractType = searchParams.get("contract_type")?.trim() ?? ""
  const workHours = searchParams.get("work_hours")?.trim() ?? ""

  console.log("FIXIE_URL set:", Boolean(process.env.FIXIE_URL))

  const apiKey = process.env.NEXT_PUBLIC_CAREERJET_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "Careerjet API key not configured" },
      { status: 500, headers: NO_CACHE_HEADERS }
    )
  }

  const userIp = getClientIp(req)
  const userAgent = req.headers.get("user-agent") ?? ""

  const params = new URLSearchParams({
    locale_code: "en_GB",
    keywords,
    page,
    page_size: pageSize,
    user_ip: userIp,
    user_agent: userAgent,
  })
  if (location) {
    params.set("location", location)
  }
  if (sort) {
    params.set("sort", sort)
  }
  if (contractType) {
    params.set("contract_type", contractType)
  }
  if (workHours) {
    params.set("work_hours", workHours)
  }

  const authHeader = `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`

  const requestUrl = `${CAREERJET_ENDPOINT}?${params.toString()}`

  try {
    console.log("Careerjet request URL:", requestUrl)

    const res = await fetch(requestUrl, {
      headers: {
        Accept: "application/json",
        Authorization: authHeader,
        Referer: "https://accountingbody.com/jobs/listings",
      },
      // @ts-expect-error - `dispatcher` is a Node/undici fetch extension not in the DOM fetch types
      dispatcher: proxyDispatcher,
    })

    console.log("Careerjet response status:", res.status)

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

    return NextResponse.json(
      {
        jobs: Array.isArray(data.jobs) ? data.jobs : [],
        total: typeof data.hits === "number" ? data.hits : 0,
        pages: typeof data.pages === "number" ? data.pages : 1,
        hits: typeof data.hits === "number" ? data.hits : 0,
      },
      { headers: NO_CACHE_HEADERS }
    )
  } catch (err) {
    console.error("Careerjet API request failed", err)
    return NextResponse.json(
      { error: "Careerjet request failed" },
      { status: 502, headers: NO_CACHE_HEADERS }
    )
  }
}
