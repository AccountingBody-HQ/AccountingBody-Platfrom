import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import { randomUUID } from "crypto"

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)
    const resend = new Resend(process.env.RESEND_API_KEY)
    const body = await req.json()

    if (body._h) return NextResponse.json({ error: "Invalid submission" }, { status: 400 })

    const required = ["company_name", "contact_name", "contact_email", "role_title", "contract_type", "location", "role_description"]
    for (const field of required) {
      if (!body[field]?.trim()) {
        return NextResponse.json({ error: "Missing required field: " + field }, { status: 400 })
      }
    }

    const platform = body.platform ?? "ab"
    const isET = platform === "et"
    const platformName = isET ? "EthioTax" : "Accounting Body"
    const brandColor = isET ? "#1A4731" : "#0C1A3D"
    const baseUrl = isET ? "https://ethiotax.com" : "https://accountingbody.com"
    const baseDomain = isET ? "ethiotax.com" : "accountingbody.com"
    const firstName = body.contact_name.trim().split(" ")[0]
    const confirmToken = randomUUID()

    const { error: dbError } = await supabase
      .from("employer_briefs")
      .insert({
        platform,
        company_name:     body.company_name.trim(),
        contact_name:     body.contact_name.trim(),
        contact_email:    body.contact_email.trim().toLowerCase(),
        contact_phone:    body.contact_phone?.trim() || null,
        role_title:       body.role_title.trim(),
        contract_type:    body.contract_type,
        location:         body.location.trim(),
        salary_budget:    body.salary_budget?.trim() || null,
        start_date:       body.start_date?.trim() || null,
        jurisdiction:     body.jurisdiction || null,
        role_description: body.role_description.trim(),
        must_haves:       body.must_haves?.trim() || null,
        nice_to_haves:    body.nice_to_haves?.trim() || null,
        status:           "pending_confirmation",
        admin_notes:      confirmToken,
      })

    if (dbError) {
      console.error("Supabase error:", dbError)
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    const confirmUrl = baseUrl + "/api/recruitment/confirm-brief?token=" + confirmToken + "&action=confirm"
    const editUrl    = baseUrl + "/jobs/hire-talent?edit=" + confirmToken
    const cancelUrl  = baseUrl + "/api/recruitment/confirm-brief?token=" + confirmToken + "&action=cancel"

    const footer = "<div style=\"background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;\"><p style=\"color:#94a3b8;font-size:12px;margin:0;\">" + platformName + " - Expert accounting and finance recruitment. <a href=\"" + baseUrl + "\" style=\"color:#94a3b8;\">" + baseDomain + "</a></p></div>"

    const briefTable = "<table style=\"width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;\"><tr style=\"background:#f8fafc;\"><td style=\"padding:10px 12px;color:#64748b;font-weight:600;width:140px;\">Role</td><td style=\"padding:10px 12px;color:#1e293b;font-weight:700;\">" + body.role_title + "</td></tr><tr><td style=\"padding:10px 12px;color:#64748b;font-weight:600;\">Company</td><td style=\"padding:10px 12px;color:#1e293b;\">" + body.company_name + "</td></tr><tr style=\"background:#f8fafc;\"><td style=\"padding:10px 12px;color:#64748b;font-weight:600;\">Type</td><td style=\"padding:10px 12px;color:#1e293b;\">" + body.contract_type + "</td></tr><tr><td style=\"padding:10px 12px;color:#64748b;font-weight:600;\">Location</td><td style=\"padding:10px 12px;color:#1e293b;\">" + body.location + "</td></tr>" + (body.salary_budget ? "<tr style=\"background:#f8fafc;\"><td style=\"padding:10px 12px;color:#64748b;font-weight:600;\">Budget</td><td style=\"padding:10px 12px;color:#1e293b;\">" + body.salary_budget + "</td></tr>" : "") + (body.start_date ? "<tr><td style=\"padding:10px 12px;color:#64748b;font-weight:600;\">Start Date</td><td style=\"padding:10px 12px;color:#1e293b;\">" + body.start_date + "</td></tr>" : "") + "</table><div style=\"background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin-bottom:24px;\"><p style=\"color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 8px;\">Role Description</p><p style=\"color:#1e293b;font-size:14px;line-height:1.7;margin:0;\">" + body.role_description + "</p></div>" + (body.must_haves ? "<div style=\"background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin-bottom:24px;\"><p style=\"color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 8px;\">Must-Haves</p><p style=\"color:#1e293b;font-size:14px;line-height:1.7;margin:0;\">" + body.must_haves + "</p></div>" : "")

    await resend.emails.send({
      from: platformName + " <noreply@accountingbody.com>",
      to:   body.contact_email.trim(),
      subject: "Please confirm your hiring brief - " + platformName,
      html: "<!DOCTYPE html><html><body style=\"margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;\"><div style=\"max-width:620px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;\"><div style=\"background:" + brandColor + ";padding:32px 40px;\"><p style=\"color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;\">" + platformName + " - Recruitment</p><h1 style=\"color:#fff;font-size:24px;margin:0;line-height:1.3;\">Please confirm your hiring brief.</h1></div><div style=\"padding:32px 40px;\"><p style=\"color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;\">Dear " + firstName + ",</p><p style=\"color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;\">Thank you for submitting your hiring brief. Please review the details below and confirm, edit, or cancel.</p>" + briefTable + "<div style=\"display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;\"><a href=\"" + confirmUrl + "\" style=\"display:inline-block;background:" + brandColor + ";color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;margin-bottom:8px;\">Confirm my brief</a><a href=\"" + editUrl + "\" style=\"display:inline-block;background:#f1f5f9;color:#1e293b;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;margin-bottom:8px;\">Edit my brief</a><a href=\"" + cancelUrl + "\" style=\"display:inline-block;background:#fee2e2;color:#991b1b;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;margin-bottom:8px;\">Cancel</a></div><p style=\"color:#94a3b8;font-size:13px;margin-top:24px;\">This link expires in 7 days. If you did not submit this brief, you can ignore this email.</p></div>" + footer + "</div></body></html>",
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("employer-brief error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
