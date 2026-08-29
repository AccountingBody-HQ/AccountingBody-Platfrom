import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { SignJWT } from "jose"

async function verifyTurnstile(token: string, ip: string, isET: boolean): Promise<boolean> {
  if (!token) return false
  const secret = isET ? process.env.TURNSTILE_SECRET_KEY : process.env.TURNSTILE_SECRET_KEY_AB
  if (!secret) return false
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, response: token, remoteip: ip }),
  })
  const data = await res.json()
  return data.success === true
}

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const body = await req.json()
    const { email, _h } = body
    const turnstileToken = body["cf-turnstile-response"] ?? ""
    const isET = req.headers.get("x-et-platform") === "ethiotax"
    console.log("x-et-platform header:", req.headers.get("x-et-platform"), "isET:", isET)
    const brand = isET
      ? { name: "EthioTax", domain: "ethiotax.com", color: "#1A4731" }
      : { name: "Accounting Body", domain: "accountingbody.com", color: "#0C1A3D" }

    if (_h) return NextResponse.json({ success: true })

    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? ""

    // Turnstile is mandatory
    if (!turnstileToken) return NextResponse.json({ success: true })
    const valid = await verifyTurnstile(turnstileToken, ip, isET)
    if (!valid) return NextResponse.json({ success: true })

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

    const jwtSecret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const platform = isET ? "et" : "ab"
    const token = await new SignJWT({ email: email.toLowerCase().trim(), platform })
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Subscribe error:", error)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}
