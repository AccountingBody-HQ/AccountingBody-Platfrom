export const dynamic = "force-dynamic"
// force-dynamic alone does NOT stop Next 14.2 caching fetch() calls in route
// handlers (Data Cache, up to 1 year, survives deploys). Do not remove.
export const fetchCache = "force-no-store"

import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { getServerSupabase } from "@/lib/supabase-server"
import { jwtVerify } from "jose"
import { checkEmailSend } from "@/lib/email-check"
import { escapeHtml, withoutLineBreaks } from "@/lib/html-escape"
import { getAdminPath } from "@/lib/middleware-logic"
import { hashConfirmationToken, isConfirmationFresh, isConfirmationTokenShape } from "@/lib/newsletter-tokens"
import { errorCode, newsletterBrand } from "@/lib/newsletter-signup"

type SubscriberRow = {
  id: string
  email: string
  platform: string
  status: string | null
  source: string | null
  last_confirmation_sent_at: string | null
}

const ROW_COLUMNS = "id, email, platform, status, source, last_confirmation_sent_at"

export async function GET(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const supabase = getServerSupabase("publicWrite")

  const token = req.nextUrl.searchParams.get("token")
  const invalid = () => NextResponse.redirect("https://accountingbody.com/?confirmed=invalid")

  if (!token) return invalid()

  // The link holds a random token; the row holds only its hash.
  let found: { data: SubscriberRow | null; error: unknown }
  if (isConfirmationTokenShape(token)) {
    found = await supabase
      .from("email_subscribers")
      .select(ROW_COLUMNS)
      .eq("confirmation_token", hashConfirmationToken(token))
      .maybeSingle()
  } else {
    // Legacy JWT links expire by 4 Dec 2026 — remove this branch in PRIV-2.
    // Links sent before PRIV-1 carry a signed { email, platform } with its
    // own 7-day expiry.
    let email: unknown
    let platform: unknown
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
      const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] })
      email = payload.email
      platform = payload.platform
    } catch {
      return invalid()
    }
    if (typeof email !== "string" || !email || (platform !== "ab" && platform !== "et")) return invalid()
    found = await supabase
      .from("email_subscribers")
      .select(ROW_COLUMNS)
      .eq("email", email)
      .eq("platform", platform)
      .maybeSingle()
  }

  if (found.error) {
    console.error("confirm subscription: lookup failed", errorCode(found.error))
    return NextResponse.redirect("https://accountingbody.com/?confirmed=error")
  }
  const row = found.data
  if (!row) return invalid()

  const platform = row.platform === "et" ? "et" : "ab"
  const brand = newsletterBrand(platform)

  if (row.status === "subscribed") {
    return NextResponse.redirect("https://" + brand.domain + "/?confirmed=already")
  }
  if (isConfirmationTokenShape(token) && !isConfirmationFresh(row.last_confirmation_sent_at, new Date())) {
    return invalid()
  }

  // An update of the row that was found: a link can never create a row. The
  // place the person signed up is kept; 'footer' only when none was recorded.
  const { data: updated, error: updateError } = await supabase
    .from("email_subscribers")
    .update({
      status: "subscribed",
      subscribed_at: new Date().toISOString(),
      unsubscribed_at: null,
      confirmation_token: null,
      source: row.source || "footer",
    })
    .eq("id", row.id)
    .select("id")

  if (updateError || !updated || updated.length !== 1) {
    console.error("confirm subscription: save failed", updateError ? errorCode(updateError) : "no-row")
    return NextResponse.redirect("https://" + brand.domain + "/?confirmed=error")
  }

  const email = row.email

  // The subscription is saved, so a failed team notification is logged and
  // the visitor still sees the confirmed page.
  try {
    const notifyResult = await resend.emails.send({
      from: brand.name + " <noreply@accountingbody.com>",
      to: "info@accountingbody.com",
      subject: "New subscriber - " + withoutLineBreaks(email),
      html: "<!DOCTYPE html><html><body style=\"margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;\"><div style=\"max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;\"><div style=\"background:" + brand.color + ";padding:32px 40px;\"><p style=\"color:#C9982A;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;\">" + brand.name + " - Admin</p><h1 style=\"color:#fff;font-size:24px;margin:0;line-height:1.3;\">New confirmed subscriber.</h1></div><div style=\"padding:32px 40px;\"><p style=\"color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;\"><strong>Email:</strong> " + escapeHtml(email) + "</p><p style=\"color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;\"><strong>Platform:</strong> " + platform.toUpperCase() + "</p><p style=\"color:#475569;font-size:15px;line-height:1.7;margin:0 0 28px;\"><strong>Time:</strong> " + new Date().toUTCString() + "</p><a href=\"https://accountingbody.com/" + getAdminPath() + "\" style=\"display:inline-block;background:#C9982A;color:#0a0f2e;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;\">View subscribers</a></div><div style=\"background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;\"><p style=\"color:#94a3b8;font-size:12px;margin:0;\">" + brand.name + " - Expert accounting and finance services. <a href=\"https://" + brand.domain + "\" style=\"color:#94a3b8;\">" + brand.domain + "</a></p></div></div></body></html>",
    })
    checkEmailSend(notifyResult, "subscription team notification")
  } catch (emailError) {
    console.error("Admin notification error:", emailError)
  }

  return NextResponse.redirect("https://" + brand.domain + "/?confirmed=true")
}
