import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { createClient } from "@supabase/supabase-js"
import { generateReferenceNumber, generateProfileToken } from "@/lib/profileUtils"

export async function POST(req: NextRequest) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { id, status, email, name, platform } = await req.json()
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)
    const isET = platform === "et"
    const platformName = isET ? "EthioTax" : "Accounting Body"
    const brandColor = isET ? "#1A4731" : "#0C1A3D"
    const baseUrl = isET ? "https://ethiotax.com" : "https://accountingbody.com"
    const baseDomain = isET ? "ethiotax.com" : "accountingbody.com"
    const firstName = (name ?? "").split(" ")[0]

    const footer = `<div style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;"><p style="color:#94a3b8;font-size:12px;margin:0;">${platformName} &mdash; Expert accounting &amp; finance recruitment. <a href="${baseUrl}" style="color:#94a3b8;">${baseDomain}</a></p></div>`

    if (status === "active") {
      // Generate reference number and profile token only on approval
      const referenceNumber = generateReferenceNumber(platform, "C")
      const profileToken = generateProfileToken()

      const { error: updateError } = await supabase
        .from("job_seeker_registrations")
        .update({ reference_number: referenceNumber, update_token: profileToken })
        .eq("id", id)

      if (updateError) {
        console.error('notify-candidate: token update failed:', updateError)
        return NextResponse.json(
          { error: 'Failed to save candidate token — email not sent', detail: updateError.message },
          { status: 500 }
        )
      }

      const manageUrl = baseUrl + "/jobs/find-work/manage?token=" + profileToken

      await resend.emails.send({
        from: `${platformName} <noreply@accountingbody.com>`,
        to:   email,
        subject: `Your candidate profile is active \u2014 ${platformName}`,
        html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;"><div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;"><div style="background:${brandColor};padding:32px 40px;"><p style="color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">${platformName} \u2014 Candidate Update</p><h1 style="color:#fff;font-size:24px;margin:0;line-height:1.3;">Your profile has been approved.</h1></div><div style="padding:32px 40px;"><p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">Dear ${firstName},</p><p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">We are pleased to confirm that your candidate profile has been reviewed and approved. Your profile is now active in our system.</p><p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">We will contact you directly when a role that matches your profile becomes available. You do not need to do anything further at this stage.</p><p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">Your details will never be shared with any employer without your prior knowledge.</p><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin-bottom:24px;"><p style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 4px;">Your Reference Number</p><p style="color:#1e293b;font-size:18px;font-weight:700;margin:0 0 4px;">${referenceNumber}</p><p style="color:#94a3b8;font-size:12px;margin:0;">Quote this reference in all correspondence with us.</p></div><a href="${manageUrl}" style="display:block;background:${brandColor};color:#fff;font-weight:700;font-size:14px;padding:14px 24px;border-radius:8px;text-decoration:none;text-align:center;margin-bottom:12px;">Manage my profile \u2192</a><p style="color:#94a3b8;font-size:12px;text-align:center;margin:0;">Use this link anytime to update your details. Keep this email safe.</p></div>${footer}</div></body></html>`,
      })
    } else if (status === "rejected") {
      await resend.emails.send({
        from: `${platformName} <noreply@accountingbody.com>`,
        to:   email,
        subject: `Your candidate registration \u2014 ${platformName}`,
        html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;"><div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;"><div style="background:${brandColor};padding:32px 40px;"><p style="color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">${platformName} \u2014 Candidate Update</p><h1 style="color:#fff;font-size:24px;margin:0;line-height:1.3;">Thank you for your registration.</h1></div><div style="padding:32px 40px;"><p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">Dear ${firstName},</p><p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">Thank you for registering with ${platformName}. After carefully reviewing your profile, we are unable to proceed with your registration at this time.</p><p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">This may be because your profile does not currently match the roles we are actively filling. We encourage you to reapply in the future if your circumstances change.</p><p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 0;">We wish you well in your career search.</p></div>${footer}</div></body></html>`,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("notify-candidate error:", err)
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}
