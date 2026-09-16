import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { SignJWT } from "jose"
import { createClient } from "@supabase/supabase-js"
import * as Sentry from "@sentry/nextjs"
import { shouldSendConfirmationEmail } from "@/lib/subscribe-dedup"

// Unlike help-request/firms-application/contact, this route fails CLOSED on
// a bad Turnstile result: no subscription is created. That means the caller
// must be able to tell success from failure, so this returns a reason
// instead of a bare boolean. "unreachable" covers both a network failure
// talking to Cloudflare and a missing/misconfigured secret — neither is
// something the visitor did wrong, so both get the same user-facing copy.
type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: "missing_token" | "invalid_token" | "unreachable" }

async function verifyTurnstile(token: string, ip: string, isET: boolean): Promise<TurnstileResult> {
  if (!token) return { ok: false, reason: "missing_token" }
  const secret = isET ? process.env.TURNSTILE_SECRET_KEY : process.env.TURNSTILE_SECRET_KEY_AB
  if (!secret) return { ok: false, reason: "unreachable" }
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    })
    const data = await res.json()
    return data.success === true ? { ok: true } : { ok: false, reason: "invalid_token" }
  } catch {
    return { ok: false, reason: "unreachable" }
  }
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

    if (_h) return NextResponse.json({ success: true })

    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? ""

    const turnstileResult = await verifyTurnstile(turnstileToken, ip, isET)
    if (!turnstileResult.ok) {
      const platform = isET ? "et" : "ab"
      Sentry.captureMessage("[subscribe] Turnstile verification failed", {
        level: "warning",
        tags: { platform, reason: turnstileResult.reason },
      })
      const unreachable = turnstileResult.reason === "unreachable"
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

    // A confirmed subscriber resubmitting keeps today's behaviour exactly:
    // no DB lookup result gates it, no dedup window applies, and — because
    // the pending-row upsert below sits inside the same `!== "subscribed"`
    // branch as this check — nothing ever writes to email_subscribers for
    // this case, so an already-subscribed row can never be downgraded to
    // 'pending' by this route.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    const { data: existing } = await supabase
      .from("email_subscribers")
      .select("status, last_confirmation_sent_at")
      .eq("email", normalisedEmail)
      .eq("platform", platform)
      .maybeSingle()

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

    await resend.emails.send({
      from: brand.name + " <noreply@accountingbody.com>",
      to: email,
      subject: "Confirm your subscription - " + brand.name,
      html: "<!DOCTYPE html><html><body style=\"margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;\"><div style=\"max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;\"><div style=\"background:" + brand.color + ";padding:32px 40px;\"><p style=\"color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;\">" + brand.name + "</p><h1 style=\"color:#fff;font-size:24px;margin:0;line-height:1.3;\">Confirm your subscription.</h1></div><div style=\"padding:32px 40px;\"><p style=\"color:#475569;font-size:15px;line-height:1.7;margin:0 0 28px;\">One last step - click below to confirm your subscription. No spam. Unsubscribe any time.</p><a href=\"" + confirmUrl + "\" style=\"display:inline-block;background:#D4A017;color:#0a0f2e;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;\">Confirm subscription</a><p style=\"color:#94a3b8;font-size:13px;margin-top:32px;\">This link expires in 7 days. If you did not sign up, ignore this email.</p></div><div style=\"background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;\"><p style=\"color:#94a3b8;font-size:12px;margin:0;\">" + brand.name + " - Expert accounting and finance services. <a href=\"https://" + brand.domain + "\" style=\"color:#94a3b8;\">" + brand.domain + "</a></p></div></div></body></html>",
    })

    // Only recorded once Resend has confirmed the send succeeded (it would
    // have thrown above otherwise, skipping straight to the catch block) —
    // a failed send must never lock a real person out of retrying for an
    // hour having received nothing. Never reached when alreadySubscribed,
    // so this can never downgrade a 'subscribed' row to 'pending'.
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
