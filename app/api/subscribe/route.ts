import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { getServerSupabase } from "@/lib/supabase-server"
import { errorCode, personCheckRefusal, startNewsletterSignup } from "@/lib/newsletter-signup"
import { CONFIRMATION_EMAIL_FAILED_TEXT, SERVER_PROBLEM_TEXT } from "@/lib/message-rules"
import { verifyHumanCheck } from "@/lib/turnstile-verify"
import { reportServerError } from "@/lib/report-error"

// This route fails CLOSED on a bad person-check result: no subscription is
// created, and the visitor is told why (answers shared with /api/unsubscribe,
// see personCheckRefusal).

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const body = await req.json()
    const { email, _h } = body
    const turnstileToken = typeof body["cf-turnstile-response"] === "string" ? body["cf-turnstile-response"] : ""
    const isET = req.headers.get("x-et-platform") === "ethiotax"

    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? ""

    // The person check comes first, so a failing check gets the same answer
    // whatever else was sent.
    const turnstileResult = await verifyHumanCheck(turnstileToken, ip, isET, "subscribe")
    if (!turnstileResult.ok) {
      const refusal = personCheckRefusal(turnstileResult.reason)
      const reason = refusal.reason
      reportServerError("subscribe person check refused", new Error("person check refused"), { area: "public", code: reason })
      return NextResponse.json(refusal.body, { status: refusal.status })
    }

    if (_h) return NextResponse.json({ success: true })

    const BLOCKED = [
      "mailinator.com", "guerrillamail.com", "trashmail.com", "tempmail.com",
      "yopmail.com", "sharklasers.com", "dispostable.com", "maildrop.cc", "hardfer.com",
      // SMS-to-email gateways
      "tmomail.net", "tmomail.com", "txt.att.net", "mms.att.net",
      "vtext.com", "messaging.sprintpcs.com", "email.uscc.net", "vmobl.com",
    ]
    const emailDomain = email?.split("@")[1]?.toLowerCase() ?? ""
    if (BLOCKED.includes(emailDomain)) return NextResponse.json({ success: true })

    if (!email || !email.includes("@")) return NextResponse.json({ error: "Invalid email." }, { status: 400 })

    // The shared double opt-in (lib/newsletter-signup.ts): an already
    // subscribed row is never downgraded, a confirmation sent within the hour
    // is not sent again, a failed lookup or send records nothing.
    const signup = await startNewsletterSignup({
      supabase: getServerSupabase("publicWrite"),
      resend,
      email,
      platform: isET ? "et" : "ab",
      source: "footer",
    })
    if (signup.kind === "server-error") {
      return NextResponse.json({ error: SERVER_PROBLEM_TEXT }, { status: 500 })
    }
    if (signup.kind === "already-sent") {
      return NextResponse.json({
        success: true,
        alreadySent: true,
        message: "We already sent you a confirmation link. Check your inbox and your spam folder. If it hasn't arrived, try again in an hour.",
      })
    }
    if (signup.kind === "send-failed") {
      return NextResponse.json({ error: CONFIRMATION_EMAIL_FAILED_TEXT }, { status: 502 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Subscribe error:", errorCode(error))
    reportServerError("subscribe failed", error, { area: "public" })
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}
