import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"
import { Resend } from "resend"
import { escapeHtml, withoutLineBreaks } from "@/lib/html-escape"
import { changedFields as listChangedFields } from "@/lib/changed-fields"
import { checkRead } from "@/lib/db-check"
import { checkEmailSend } from "@/lib/email-check"
import { SERVER_PROBLEM_TEXT } from "@/lib/message-rules"
import { reportServerError } from "@/lib/report-error"

export async function POST(req: NextRequest) {
  try {
    const supabase = getServerSupabase("publicWrite")
    const resend = new Resend(process.env.RESEND_API_KEY)
    const body = await req.json()
    const { token } = body

    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 })

    // Also reads the editable details, so the changes can be listed from the
    // saved values before they are overwritten.
    const lookup = checkRead(
      await supabase
        .from("job_seeker_registrations")
        .select("id, full_name, email, reference_number, platform, status, phone, location_city, location_country, linkedin_url, employment_status, salary_expectation, role_types, jurisdictions, languages, biography")
        .eq("update_token", token)
        .eq("status", "active")
        .single(),
      "update-candidate lookup",
      { noRowsIsEmpty: true },
    )

    if (!lookup.ok) {
      return NextResponse.json({ error: SERVER_PROBLEM_TEXT }, { status: 500 })
    }
    const existing = lookup.data

    if (!existing) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 })
    }

    const isET = existing.platform === "et"
    const platformName = isET ? "EthioTax" : "Accounting Body"
    const brandColor = isET ? "#1A4731" : "#0C1A3D"
    const baseUrl = isET ? "https://ethiotax.com" : "https://accountingbody.com"
    const baseDomain = isET ? "ethiotax.com" : "accountingbody.com"

    // Only update allowed fields — locked fields are ignored
    const allowedFields: Record<string, unknown> = {}
    if (body.phone !== undefined)              allowedFields.phone = body.phone?.trim() || null
    if (body.location_city !== undefined)      allowedFields.location_city = body.location_city?.trim() || null
    if (body.location_country !== undefined)   allowedFields.location_country = body.location_country?.trim() || null
    if (body.linkedin_url !== undefined)       allowedFields.linkedin_url = body.linkedin_url?.trim() || null
    if (body.employment_status !== undefined)  allowedFields.employment_status = body.employment_status || null
    if (body.salary_expectation !== undefined) allowedFields.salary_expectation = body.salary_expectation?.trim() || null
    if (body.role_types !== undefined)         allowedFields.role_types = body.role_types || null
    if (body.jurisdictions !== undefined)      allowedFields.jurisdictions = body.jurisdictions || null
    if (body.languages !== undefined)          allowedFields.languages = body.languages || null
    if (body.biography !== undefined)          allowedFields.biography = body.biography?.trim() || null

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    // The details this update changes, from the values read above.
    const changedFields = listChangedFields(existing, allowedFields).join(", ")

    const { error: updateError } = await supabase
      .from("job_seeker_registrations")
      .update(allowedFields)
      .eq("id", existing.id)

    if (updateError) {
      console.error("Update error:", updateError.code || "no-code")
      return NextResponse.json({ error: "Update failed" }, { status: 500 })
    }

    const footer = "<div style=\"background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;\"><p style=\"color:#94a3b8;font-size:12px;margin:0;\">" + platformName + " - Expert accounting and finance recruitment. <a href=\"" + baseUrl + "\" style=\"color:#94a3b8;\">" + baseDomain + "</a></p></div>"

    // The team is told only when something changed.
    if (!changedFields) return NextResponse.json({ success: true })

    // The update is saved, so the notification result is logged only.
    const sendResult = await resend.emails.send({
      from: platformName + " <noreply@accountingbody.com>",
      to: "info@accountingbody.com",
      subject: "[" + withoutLineBreaks(existing.platform.toUpperCase()) + "] Candidate profile updated - " + existing.reference_number,
      html: "<!DOCTYPE html><html><body style=\"margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;\"><div style=\"max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;\"><div style=\"background:" + brandColor + ";padding:32px 40px;\"><p style=\"color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;\">" + platformName + " - Admin</p><h1 style=\"color:#fff;font-size:24px;margin:0;line-height:1.3;\">Candidate profile updated.</h1></div><div style=\"padding:32px 40px;\"><p style=\"color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;\"><strong>" + escapeHtml(existing.full_name) + "</strong> (" + existing.reference_number + ") has updated their profile.</p><p style=\"color:#475569;font-size:15px;line-height:1.7;margin:0 0 28px;\">Fields updated: " + changedFields + "</p><a href=\"https://accountingbody.com/roodber8/candidates\" style=\"display:inline-block;background:" + brandColor + ";color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;\">View in admin panel</a></div>" + footer + "</div></body></html>",
    })
    checkEmailSend(sendResult, "update-candidate notification")

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error("update-candidate error:", String((err as { code?: unknown } | null)?.code ?? "no-code"))
    reportServerError("candidate profile update failed", err, { area: "public" })
    return NextResponse.json({ error: SERVER_PROBLEM_TEXT }, { status: 500 })
  }
}
