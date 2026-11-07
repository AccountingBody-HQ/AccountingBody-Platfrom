import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"
import { Resend } from "resend"
import { checkEmailSend } from "@/lib/email-check"
import { escapeHtml, withoutLineBreaks } from "@/lib/html-escape"

export async function GET(req: NextRequest) {
  try {
    const supabase = getServerSupabase("publicWrite")
    const resend = new Resend(process.env.RESEND_API_KEY)

    const token = req.nextUrl.searchParams.get("token")
    if (!token) return NextResponse.redirect(new URL("/jobs/find-work?verified=invalid", req.url))

    const { data, error } = await supabase
      .from("job_seeker_registrations")
      .select("*")
      .eq("verification_token", token)
      .single()

    if (error || !data) return NextResponse.redirect(new URL("/jobs/find-work?verified=invalid", req.url))
    if (data.status !== "pending_verification") return NextResponse.redirect(new URL("/jobs/find-work?verified=already", req.url))

    const { error: updateError } = await supabase
      .from("job_seeker_registrations")
      .update({ status: "pending_review", verified_at: new Date().toISOString(), verification_token: null })
      .eq("id", data.id)

    // Not saved: the token still works, so the visitor is asked to try the
    // same link again, and no "confirmed" email goes out.
    if (updateError) {
      console.error("verify email: update failed", updateError.code || "no-code")
      return NextResponse.redirect(new URL("/jobs/find-work?verified=error", req.url))
    }

    const isET = data.platform === "et"
    const platformName = isET ? "EthioTax" : "Accounting Body"
    const brandColor = isET ? "#1A4731" : "#0C1A3D"
    const baseUrl = isET ? "https://ethiotax.com" : "https://accountingbody.com"
    const firstName = data.full_name.split(" ")[0]

    const roleTypes = Array.isArray(data.role_types) ? data.role_types.join(", ") : (data.role_types ?? "Not specified")
    const jurisdictions = Array.isArray(data.jurisdictions) ? data.jurisdictions.join(", ") : (data.jurisdictions ?? "Not specified")
    const languages = Array.isArray(data.languages) ? data.languages.join(", ") : (data.languages ?? "Not specified")

    // The registration is verified, so the two emails below only acknowledge
    // it; a failed send is logged and the visitor still sees success.
    // 1. Branded confirmation email to candidate
    const candidateResult = await resend.emails.send({
      from: `${platformName} <noreply@accountingbody.com>`,
      to:   data.email,
      subject: `Registration confirmed \u2014 ${platformName}`,
      html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;"><div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;"><div style="background:${brandColor};padding:32px 40px;"><p style="color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">${platformName} \u2014 Candidate Registration</p><h1 style="color:#fff;font-size:24px;margin:0;line-height:1.3;">Email confirmed.</h1></div><div style="padding:32px 40px;"><p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">Thank you, ${escapeHtml(firstName)}. Your email address has been verified successfully.</p><p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">Your profile is now with our team for review. We aim to complete all reviews within 5 working days.</p><p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 28px;">We will contact you only when a role that matches your profile becomes available. Your details will never be shared with any employer without your prior knowledge.</p><div style="background:#f0f4ff;border-left:4px solid ${brandColor};padding:16px 20px;border-radius:4px;margin-bottom:28px;"><p style="color:#475569;font-size:14px;margin:0;line-height:1.6;"><strong>What happens next?</strong><br/>Our team reviews your profile &rarr; We match you to suitable roles &rarr; We contact you directly when a match is found.</p></div></div><div style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;"><p style="color:#94a3b8;font-size:12px;margin:0;">${platformName} &mdash; Expert accounting &amp; finance recruitment. <a href="${baseUrl}" style="color:#94a3b8;">${baseUrl.replace("https://","")}</a></p></div></div></body></html>`,
    })
    checkEmailSend(candidateResult, "job seeker verified acknowledgement")

    // 2. Branded admin notification with full candidate details
    const teamResult = await resend.emails.send({
      from: `${platformName} <noreply@accountingbody.com>`,
      to:   "info@accountingbody.com",
      subject: `[${withoutLineBreaks(data.platform.toUpperCase())}] New candidate verified \u2014 ${withoutLineBreaks(data.full_name)} \u2014 ${withoutLineBreaks(data.professional_role)}`,
      html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;"><div style="max-width:620px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;"><div style="background:${brandColor};padding:32px 40px;"><p style="color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">${platformName} \u2014 Admin</p><h1 style="color:#fff;font-size:24px;margin:0;line-height:1.3;">New candidate verified and pending review.</h1></div><div style="padding:32px 40px;"><table style="width:100%;border-collapse:collapse;font-size:14px;"><tr style="background:#f8fafc;"><td style="padding:10px 12px;color:#64748b;font-weight:600;width:160px;">Full Name</td><td style="padding:10px 12px;color:#1e293b;font-weight:700;">${escapeHtml(data.full_name)}</td></tr><tr><td style="padding:10px 12px;color:#64748b;font-weight:600;">Email</td><td style="padding:10px 12px;color:#1e293b;">${escapeHtml(data.email)}</td></tr><tr style="background:#f8fafc;"><td style="padding:10px 12px;color:#64748b;font-weight:600;">Phone</td><td style="padding:10px 12px;color:#1e293b;">${escapeHtml(data.phone ?? "Not provided")}</td></tr><tr><td style="padding:10px 12px;color:#64748b;font-weight:600;">Location</td><td style="padding:10px 12px;color:#1e293b;">${escapeHtml(data.location_city)}${data.location_country ? ", " + escapeHtml(data.location_country) : ""}</td></tr><tr style="background:#f8fafc;"><td style="padding:10px 12px;color:#64748b;font-weight:600;">LinkedIn</td><td style="padding:10px 12px;color:#1e293b;">${data.linkedin_url ? '<a href="' + escapeHtml(data.linkedin_url) + '" style="color:' + brandColor + ';">' + escapeHtml(data.linkedin_url) + '</a>' : "Not provided"}</td></tr><tr><td style="padding:10px 12px;color:#64748b;font-weight:600;">Professional Role</td><td style="padding:10px 12px;color:#1e293b;">${escapeHtml(data.professional_role)}</td></tr><tr style="background:#f8fafc;"><td style="padding:10px 12px;color:#64748b;font-weight:600;">Qualification</td><td style="padding:10px 12px;color:#1e293b;">${escapeHtml(data.qualification)}</td></tr><tr><td style="padding:10px 12px;color:#64748b;font-weight:600;">Experience</td><td style="padding:10px 12px;color:#1e293b;">${escapeHtml(data.years_experience)}</td></tr><tr style="background:#f8fafc;"><td style="padding:10px 12px;color:#64748b;font-weight:600;">Employment Status</td><td style="padding:10px 12px;color:#1e293b;">${escapeHtml(data.employment_status)}</td></tr><tr><td style="padding:10px 12px;color:#64748b;font-weight:600;">Salary Expectation</td><td style="padding:10px 12px;color:#1e293b;">${escapeHtml(data.salary_expectation ?? "Not specified")}</td></tr><tr style="background:#f8fafc;"><td style="padding:10px 12px;color:#64748b;font-weight:600;">Role Types Sought</td><td style="padding:10px 12px;color:#1e293b;">${escapeHtml(roleTypes)}</td></tr><tr><td style="padding:10px 12px;color:#64748b;font-weight:600;">Jurisdictions</td><td style="padding:10px 12px;color:#1e293b;">${escapeHtml(jurisdictions)}</td></tr><tr style="background:#f8fafc;"><td style="padding:10px 12px;color:#64748b;font-weight:600;">Languages</td><td style="padding:10px 12px;color:#1e293b;">${escapeHtml(languages)}</td></tr><tr><td style="padding:10px 12px;color:#64748b;font-weight:600;">Platform</td><td style="padding:10px 12px;color:#1e293b;">${escapeHtml(data.platform.toUpperCase())}</td></tr><tr style="background:#f8fafc;"><td style="padding:10px 12px;color:#64748b;font-weight:600;">Submitted</td><td style="padding:10px 12px;color:#1e293b;">${new Date(data.created_at).toUTCString()}</td></tr></table><div style="margin-top:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;"><p style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 8px;">Professional Biography</p><p style="color:#1e293b;font-size:14px;line-height:1.7;margin:0;">${escapeHtml(data.biography)}</p></div><div style="margin-top:28px;"><a href="https://accountingbody.com/roodber8/candidates" style="display:inline-block;background:${brandColor};color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;">Review in admin panel &rarr;</a></div></div><div style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;"><p style="color:#94a3b8;font-size:12px;margin:0;">${platformName} — Expert accounting &amp; finance recruitment. <a href="${baseUrl}" style="color:#94a3b8;">${baseUrl.replace("https://","")}</a></p></div></div></body></html>`,
    })
    checkEmailSend(teamResult, "job seeker verified team notification")

    return NextResponse.redirect(new URL("/jobs/find-work?verified=true", baseUrl))

  } catch (err) {
    console.error("Verify email error:", err)
    return NextResponse.redirect(new URL("/jobs/find-work?verified=error", req.url))
  }
}
