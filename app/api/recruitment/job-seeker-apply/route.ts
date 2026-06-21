import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

function generateToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export async function POST(req: NextRequest) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const body = await req.json()

    if (body._h) return NextResponse.json({ error: "Invalid submission" }, { status: 400 })

    const required = ["full_name", "email", "location_city", "professional_role", "qualification", "years_experience", "employment_status", "biography"]
    for (const field of required) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    const platform = body.platform ?? "ab"
    const isET = platform === "et"
    const platformName = isET ? "EthioTax" : "Accounting Body"
    const brandColor = isET ? "#1A4731" : "#0C1A3D"
    const baseUrl = isET ? "https://ethiotax.com" : "https://accountingbody.com"
    const token = generateToken()

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
        data_consent:       body.data_consent ?? false,
        status:             "pending_verification",
        verification_token: token,
      })

    if (dbError) {
      console.error("Supabase insert error:", dbError)
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    const verifyUrl = `${baseUrl}/api/recruitment/verify-email?token=${token}`
    const firstName = body.full_name.trim().split(" ")[0]

    await resend.emails.send({
      from: `${platformName} <noreply@accountingbody.com>`,
      to:   body.email.trim(),
      subject: `Verify your email address — ${platformName}`,
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:${brandColor};padding:32px 40px;">
      <p style="color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">${platformName} — Candidate Registration</p>
      <h1 style="color:#fff;font-size:24px;margin:0;line-height:1.3;">Confirm your email address.</h1>
    </div>
    <div style="padding:32px 40px;">
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">Thank you for registering, ${firstName}.</p>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 28px;">Please verify your email address by clicking the button below. Once verified, your profile will be reviewed by our team within 5 working days. We will contact you only when a suitable role becomes available.</p>
      <a href="${verifyUrl}" style="display:inline-block;background:${brandColor};color:#fff;font-weight:700;font-size:14px;padding:14px 28px;border-radius:8px;text-decoration:none;">Verify my email address &rarr;</a>
      <p style="color:#94a3b8;font-size:13px;margin-top:32px;">If you did not register with ${platformName}, you can safely ignore this email.</p>
    </div>
    <div style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">${platformName} | info@accountingbody.com</p>
    </div>
  </div>
</body>
</html>`,
    })

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error("Job seeker apply error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
