import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { createClient } from "@supabase/supabase-js"
import { jwtVerify } from "jose"

export async function GET(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const token = req.nextUrl.searchParams.get("token")

  if (!token) {
    return NextResponse.redirect("https://accountingbody.com/?confirmed=invalid")
  }

  let email: string
  let platform: string

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    email = payload.email as string
    platform = payload.platform as string
  } catch {
    return NextResponse.redirect("https://accountingbody.com/?confirmed=invalid")
  }

  const isEthioTax = platform === "et"
  const brand = isEthioTax
    ? { name: "EthioTax", domain: "ethiotax.com", color: "#1A4731" }
    : { name: "Accounting Body", domain: "accountingbody.com", color: "#0C1A3D" }

  const { data: existing } = await supabase
    .from("email_subscribers")
    .select("email, status")
    .eq("email", email)
    .eq("platform", platform)
    .single()

  if (existing?.status === "subscribed") {
    return NextResponse.redirect("https://" + brand.domain + "/?confirmed=already")
  }

  const { error: upsertError } = await supabase
    .from("email_subscribers")
    .upsert(
      { email, platform, status: "subscribed", source: "footer", subscribed_at: new Date().toISOString(), confirmation_token: null },
      { onConflict: "email,platform" }
    )

  if (upsertError) {
    console.error("Confirm subscription error:", upsertError)
    return NextResponse.redirect("https://" + brand.domain + "/?confirmed=error")
  }

  try {
    await resend.emails.send({
      from: brand.name + " <noreply@accountingbody.com>",
      to: "info@accountingbody.com",
      subject: "New subscriber - " + email,
      html: "<!DOCTYPE html><html><body style=\"margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;\"><div style=\"max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;\"><div style=\"background:" + brand.color + ";padding:32px 40px;\"><p style=\"color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;\">" + brand.name + " - Admin</p><h1 style=\"color:#fff;font-size:24px;margin:0;line-height:1.3;\">New confirmed subscriber.</h1></div><div style=\"padding:32px 40px;\"><p style=\"color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;\"><strong>Email:</strong> " + email + "</p><p style=\"color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;\"><strong>Platform:</strong> " + platform.toUpperCase() + "</p><p style=\"color:#475569;font-size:15px;line-height:1.7;margin:0 0 28px;\"><strong>Time:</strong> " + new Date().toUTCString() + "</p><a href=\"https://accountingbody.com/roodber8\" style=\"display:inline-block;background:#D4A017;color:#0a0f2e;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;\">View subscribers</a></div><div style=\"background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;\"><p style=\"color:#94a3b8;font-size:12px;margin:0;\">" + brand.name + " - Expert accounting and finance services. <a href=\"https://" + brand.domain + "\" style=\"color:#94a3b8;\">" + brand.domain + "</a></p></div></div></body></html>",
    })
  } catch (emailError) {
    console.error("Admin notification error:", emailError)
  }

  return NextResponse.redirect("https://" + brand.domain + "/?confirmed=true")
}
