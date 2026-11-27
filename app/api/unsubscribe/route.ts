export const dynamic = "force-dynamic"
// force-dynamic alone does NOT stop Next caching fetch() calls in route
// handlers. Do not remove.
export const fetchCache = "force-no-store"

import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { getServerSupabase } from "@/lib/supabase-server"
import { errorCode, personCheckRefusal } from "@/lib/newsletter-signup"
import { requestUnsubscribeLink, unsubscribeByToken } from "@/lib/newsletter-unsubscribe"
import { SERVER_PROBLEM_TEXT } from "@/lib/message-rules"
import { verifyHumanCheck } from "@/lib/turnstile-verify"
import { reportServerError } from "@/lib/report-error"

// POST only. There is no GET handler, so a link scanner opening an address
// can never unsubscribe anyone.
//
// - With a token (JSON { token } from the /unsubscribe page, or the token in
//   the address with the form body List-Unsubscribe=One-Click from a mail
//   program, RFC 8058): the signed link is the proof, so there is no person
//   check. Answer { success: true }, or { error: 'invalid-link' } (400).
// - Without a token (JSON { email, cf-turnstile-response }): person check
//   first, then the answer is always { success: true }, whether or not the
//   address is on the list (see lib/newsletter-unsubscribe.ts).
export async function POST(req: NextRequest) {
  try {
    const isET = req.headers.get("x-et-platform") === "ethiotax"
    const contentType = req.headers.get("content-type") ?? ""

    let body: Record<string, unknown> = {}
    let token: unknown
    if (contentType.includes("application/json")) {
      const parsed: unknown = await req.json()
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Record<string, unknown>
      token = body.token
    } else {
      const form = new URLSearchParams(await req.text())
      if (form.get("List-Unsubscribe") !== "One-Click") {
        return NextResponse.json({ error: "invalid-link" }, { status: 400 })
      }
      token = req.nextUrl.searchParams.get("token") ?? ""
    }

    if (token !== undefined && token !== "") {
      const result = await unsubscribeByToken(getServerSupabase("publicWrite"), token)
      if (result.kind === "invalid") return NextResponse.json({ error: "invalid-link" }, { status: 400 })
      if (result.kind === "server-error") return NextResponse.json({ error: SERVER_PROBLEM_TEXT }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? ""
    const humanCheck = await verifyHumanCheck(body["cf-turnstile-response"], ip, isET, "unsubscribe")
    if (!humanCheck.ok) {
      const refusal = personCheckRefusal(humanCheck.reason)
      return NextResponse.json(refusal.body, { status: refusal.status })
    }

    const email = body.email
    if (typeof email === "string" && email.includes("@") && email.length <= 320) {
      await requestUnsubscribeLink({
        supabase: getServerSupabase("publicWrite"),
        resend: new Resend(process.env.RESEND_API_KEY),
        email,
        platform: isET ? "et" : "ab",
        ip,
      })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("unsubscribe: failed", errorCode(error))
    reportServerError("unsubscribe failed", error, { area: "public" })
    return NextResponse.json({ error: SERVER_PROBLEM_TEXT }, { status: 500 })
  }
}
