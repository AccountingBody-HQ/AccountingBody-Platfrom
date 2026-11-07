import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { SignJWT } from "jose"
import { getServerSupabase } from "@/lib/supabase-server"
import * as Sentry from "@sentry/nextjs"
import { shouldSendConfirmationEmail } from "@/lib/subscribe-dedup"
import { checkRead } from "@/lib/db-check"
import { checkEmailSend } from "@/lib/email-check"
import { CONFIRMATION_EMAIL_FAILED_TEXT, SERVER_PROBLEM_TEXT } from "@/lib/message-rules"
import { verifyHumanCheck, type HumanCheckReason } from "@/lib/turnstile-verify"

// This route fails CLOSED on a bad person-check result: no subscription is
// created, and the visitor is told why. "unreachable" covers a network
// failure or no answer in time from Cloudflare, an unreadable reply, and a
// missing/misconfigured secret — none of them is something the visitor did
// wrong, so they all get the same user-facing copy.
type SubscribeCheckReason = "missing_token" | "invalid_token" | "unreachable"

const SUBSCRIBE_CHECK_REASON: Record<HumanCheckReason, SubscribeCheckReason> = {
  missing: "missing_token",
  "not-confirmed": "invalid_token",
  unreadable: "unreachable",
  unavailable: "unreachable",
}

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const body = await req.json()
    const { email, _h } = body
    const turnstileToken = typeof body["cf-turnstile-response"] === "string" ? body["cf-turnstile-response"] : ""
    const isET = req.headers.get("x-et-platform") === "ethiotax"
    const brand = isET
      ? { name: "EthioTax", domain: "ethiotax.com", color: "#1A4731" }
      : { name: "Accounting Body", domain: "accountingbody.com", color: "#0C1A3D" }

    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? ""

    // The person check comes first, so a failing check gets the same answer
    // whatever else was sent.
    const turnstileResult = await verifyHumanCheck(turnstileToken, ip, isET, "subscribe")
    if (!turnstileResult.ok) {
      const platform = isET ? "et" : "ab"
      const reason = SUBSCRIBE_CHECK_REASON[turnstileResult.reason]
      Sentry.captureMessage("[subscribe] Turnstile verification failed", {
        level: "warning",
        tags: { platform, reason },
      })
      const unreachable = reason === "unreachable"
      return NextResponse.json(
        {
          error: unreachable
            ? "We couldn't verify your request right now. Please try again in a moment."
            : "We couldn't verify your request. If you're using an ad blocker or privacy extension, please disable it for this page and try again.",
          code: unreachable ? "turnstile_unreachable" : "turnstile_failed",
        },
        { status: unreachable ? 503 : 400 }
      )
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

    const normalisedEmail = email.toLowerCase().trim()
    const platform = isET ? "et" : "ab"

    // A confirmed subscriber resubmitting gets a fresh confirmation email
    // and no dedup window applies, and — because the pending-row upsert
    // below sits inside the same `!== "subscribed"` branch as this check —
    // nothing ever writes to email_subscribers for this case, so an
    // already-subscribed row can never be downgraded to 'pending' by this
    // route. If the lookup itself fails, nothing is sent: without it the
    // route cannot tell whether a confirmation was sent recently.
    const supabase = getServerSupabase("publicWrite")
    const lookup = checkRead(
      await supabase
        .from("email_subscribers")
        .select("status, last_confirmation_sent_at")
        .eq("email", normalisedEmail)
        .eq("platform", platform)
        .maybeSingle(),
      "subscribe: existing subscriber"
    )
    if (!lookup.ok) {
      return NextResponse.json({ error: SERVER_PROBLEM_TEXT }, { status: 500 })
    }
    const existing = lookup.data

    const alreadySubscribed = existing?.status === "subscribed"

    if (!alreadySubscribed) {
      const lastSentAt = existing?.last_confirmation_sent_at ? new Date(existing.last_confirmation_sent_at) : null
      if (!shouldSendConfirmationEmail({ lastSentAt, now: new Date() })) {
        return NextResponse.json({
          success: true,
          alreadySent: true,
          message: "We already sent you a confirmation link. Check your inbox and your spam folder. If it hasn't arrived, try again in an hour.",
        })
      }
    }

    const jwtSecret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const token = await new SignJWT({ email: normalisedEmail, platform })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .setIssuedAt()
      .sign(jwtSecret)

    const confirmUrl = "https://" + brand.domain + "/api/confirm-subscription?token=" + token

    const sendResult = await resend.emails.send({
      from: brand.name + " <noreply@accountingbody.com>",
      to: email,
      subject: "Confirm your subscription - " + brand.name,
      html: "<!DOCTYPE html><html><body style=\"margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;\"><div style=\"max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;\"><div style=\"background:" + brand.color + ";padding:32px 40px;\"><p style=\"color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;\">" + brand.name + "</p><h1 style=\"color:#fff;font-size:24px;margin:0;line-height:1.3;\">Confirm your subscription.</h1></div><div style=\"padding:32px 40px;\"><p style=\"color:#475569;font-size:15px;line-height:1.7;margin:0 0 28px;\">One last step - click below to confirm your subscription. No spam. Unsubscribe any time.</p><a href=\"" + confirmUrl + "\" style=\"display:inline-block;background:#D4A017;color:#0a0f2e;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;\">Confirm subscription</a><p style=\"color:#94a3b8;font-size:13px;margin-top:32px;\">This link expires in 7 days. If you did not sign up, ignore this email.</p></div><div style=\"background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;\"><p style=\"color:#94a3b8;font-size:12px;margin:0;\">" + brand.name + " - Expert accounting and finance services. <a href=\"https://" + brand.domain + "\" style=\"color:#94a3b8;\">" + brand.domain + "</a></p></div></div></body></html>",
    })

    // Resend reports a failed send in its result rather than by throwing, so
    // the result is checked here. On failure nothing is recorded: a failed
    // send must never lock a real person out of retrying for an hour having
    // received nothing.
    if (!checkEmailSend(sendResult, "subscribe confirmation")) {
      return NextResponse.json({ error: CONFIRMATION_EMAIL_FAILED_TEXT }, { status: 502 })
    }

    // Only recorded once Resend has confirmed the send. Never reached when
    // alreadySubscribed, so this can never downgrade a 'subscribed' row to
    // 'pending'.
    if (!alreadySubscribed) {
      const { error: upsertError } = await supabase
        .from("email_subscribers")
        .upsert(
          { email: normalisedEmail, platform, status: "pending", last_confirmation_sent_at: new Date().toISOString() },
          { onConflict: "email,platform" }
        )
      if (upsertError) console.error("Subscribe: failed to record pending row (non-fatal):", upsertError.message)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Subscribe error:", error)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}
