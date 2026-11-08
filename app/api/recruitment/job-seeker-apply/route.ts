import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"
import { Resend } from "resend"
import { checkEmailSend } from "@/lib/email-check"
import { HUMAN_CHECK_FAILED_TEXT, SERVER_PROBLEM_TEXT } from "@/lib/message-rules"
import { verifyHumanCheck } from "@/lib/turnstile-verify"
import { escapeHtml } from "@/lib/html-escape"
import { reportServerError } from "@/lib/report-error"

function generateToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getServerSupabase("publicWrite")
    const resend = new Resend(process.env.RESEND_API_KEY)
    const body = await req.json()

    // Person check (Cloudflare Turnstile), verified on the server first.
    // Nothing is saved or sent unless it passed. The site is the one the
    // request came through, as for the widget's site key.
    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? ""
    const onSecondSite = req.headers.get("x-et-platform") === "ethiotax"
    const humanCheck = await verifyHumanCheck(body["cf-turnstile-response"], ip, onSecondSite, "job seeker registration")
    if (!humanCheck.ok) {
      return NextResponse.json({ error: HUMAN_CHECK_FAILED_TEXT }, { status: 400 })
    }

    if (body._h) return NextResponse.json({ error: "Invalid submission" }, { status: 400 })

    const required = ["full_name", "email", "location_city", "professional_role", "qualification", "years_experience", "employment_status", "biography"]
    for (const field of required) {
      if (!body[field]?.trim()) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    const platform = body.platform ?? "ab"
    const isET = platform === "et"
    const platformName = isET ? "EthioTax" : "Accounting Body"
    const brandColor = isET ? "#1A4731" : "#0C1A3D"
    const baseUrl = isET ? "https://ethiotax.com" : "https://accountingbody.com"
    const token = generateToken()
    const firstName = body.full_name.trim().split(" ")[0]

    const { error: dbError } = await supabase
      .from("job_seeker_registrations")
      .insert({
        platform,
        full_name:          body.full_name.trim(),
        email:              body.email.trim().toLowerCase(),
        phone:              body.phone?.trim() || null,
        location_city:      body.location_city.trim(),
        location_country:   body.location_country?.trim() || null,
        linkedin_url:       body.linkedin_url?.trim() || null,
        professional_role:  body.professional_role,
        qualification:      body.qualification,
        years_experience:   body.years_experience,
        employment_status:  body.employment_status,
        salary_expectation: body.salary_expectation?.trim() || null,
        role_types:         body.role_types || null,
        jurisdictions:      body.jurisdictions || null,
        languages:          body.languages || null,
        biography:          body.biography.trim(),
        terms_agreed:       body.terms_agreed ?? false,
        pathway:            body.pathway ?? 'direct',
        data_consent:       body.data_consent ?? false,
        status:             "pending_verification",
        verification_token: token,
      })

    if (dbError) {
      console.error("Supabase insert error:", dbError.code || "no-code")
      return NextResponse.json({ error: SERVER_PROBLEM_TEXT }, { status: 500 })
    }

    const verifyUrl = `${baseUrl}/api/recruitment/verify-email?token=${token}`

    const sendResult = await resend.emails.send({
      from: `${platformName} <noreply@accountingbody.com>`,
      to:   body.email.trim(),
      subject: `Verify your email address \u2014 ${platformName}`,
      html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;"><div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;"><div style="background:${brandColor};padding:32px 40px;"><p style="color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">${platformName} \u2014 Candidate Registration</p><h1 style="color:#fff;font-size:24px;margin:0;line-height:1.3;">Confirm your email address.</h1></div><div style="padding:32px 40px;"><p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">Thank you for registering, ${escapeHtml(firstName)}.</p><p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 28px;">Please verify your email address by clicking the button below. Once verified, your profile will be reviewed by our team within 5 working days. We will be in touch only when a suitable role becomes available.</p><a href="${verifyUrl}" style="display:inline-block;background:${brandColor};color:#fff;font-weight:700;font-size:14px;padding:14px 28px;border-radius:8px;text-decoration:none;">Verify my email address &rarr;</a><p style="color:#94a3b8;font-size:13px;margin-top:32px;">If you did not register with ${platformName}, you can safely ignore this email.</p></div><div style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;"><p style="color:#94a3b8;font-size:12px;margin:0;">${platformName} &mdash; Expert accounting &amp; finance recruitment. <a href="${baseUrl}" style="color:#94a3b8;">${baseUrl.replace("https://","")}</a></p></div></div></body></html>`,
    })

    // Without the verification email the visitor cannot finish, so they are
    // asked to try again. The registration saved above in this request is
    // removed first, matched by the token made in this request (plus its
    // email and unverified status), so a second attempt does not leave two.
    if (!checkEmailSend(sendResult, "job seeker verification")) {
      const { error: removeError, count } = await supabase
        .from("job_seeker_registrations")
        .delete({ count: "exact" })
        .eq("verification_token", token)
        .eq("email", body.email.trim().toLowerCase())
        .eq("status", "pending_verification")
      if (removeError || count !== 1) {
        console.error(
          "job seeker apply: unsent registration not removed",
          removeError ? removeError.code || "no-code" : `count ${count}`
        )
      }
      return NextResponse.json({ error: SERVER_PROBLEM_TEXT }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error("Job seeker apply error:", String((err as { code?: unknown } | null)?.code ?? "no-code"))
    reportServerError("job seeker registration failed", err, { area: "public" })
    return NextResponse.json({ error: SERVER_PROBLEM_TEXT }, { status: 500 })
  }
}
