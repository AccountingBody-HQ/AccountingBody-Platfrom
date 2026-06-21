import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)
    const resend = new Resend(process.env.RESEND_API_KEY)
    const body = await req.json()
    const { token } = body

    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 })

    const { data: existing, error: fetchError } = await supabase
      .from("employer_briefs")
      .select("id, company_name, contact_name, contact_email, reference_number, platform, status")
      .eq("update_token", token)
      .in("status", ["pending", "reviewing"])
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 })
    }

    const isET = existing.platform === "et"
    const platformName = isET ? "EthioTax" : "Accounting Body"
    const brandColor = isET ? "#1A4731" : "#0C1A3D"
    const baseUrl = isET ? "https://ethiotax.com" : "https://accountingbody.com"
    const baseDomain = isET ? "ethiotax.com" : "accountingbody.com"

    // Only update allowed fields — locked fields are ignored
    const allowedFields: Record<string, unknown> = {}
    if (body.contact_phone !== undefined)    allowedFields.contact_phone = body.contact_phone?.trim() || null
    if (body.salary_budget !== undefined)    allowedFields.salary_budget = body.salary_budget?.trim() || null
    if (body.start_date !== undefined)       allowedFields.start_date = body.start_date?.trim() || null
    if (body.jurisdiction !== undefined)     allowedFields.jurisdiction = body.jurisdiction || null
    if (body.role_description !== undefined) allowedFields.role_description = body.role_description?.trim() || null
    if (body.must_haves !== undefined)       allowedFields.must_haves = body.must_haves?.trim() || null
    if (body.nice_to_haves !== undefined)    allowedFields.nice_to_haves = body.nice_to_haves?.trim() || null

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from("employer_briefs")
      .update(allowedFields)
      .eq("id", existing.id)

    if (updateError) {
      console.error("Update error:", updateError)
      return NextResponse.json({ error: "Update failed" }, { status: 500 })
    }

    const footer = "<div style=\"background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;\"><p style=\"color:#94a3b8;font-size:12px;margin:0;\">" + platformName + " - Expert accounting and finance recruitment. <a href=\"" + baseUrl + "\" style=\"color:#94a3b8;\">" + baseDomain + "</a></p></div>"

    // Only report fields that actually changed
    const { data: current2 } = await supabase
      .from("employer_briefs")
      .select("contact_phone, salary_budget, start_date, jurisdiction, role_description, must_haves, nice_to_haves")
      .eq("id", existing.id)
      .single()

    const changedFields = Object.keys(allowedFields).filter(key => {
      const newVal = JSON.stringify(allowedFields[key] ?? null)
      const oldVal = JSON.stringify((current2 as Record<string, unknown>)?.[key] ?? null)
      return newVal !== oldVal
    }).join(", ")

    if (!changedFields) return NextResponse.json({ success: true })

    await resend.emails.send({
      from: platformName + " <noreply@accountingbody.com>",
      to: "info@accountingbody.com",
      subject: "[" + existing.platform.toUpperCase() + "] Employer brief updated - " + existing.reference_number,
      html: "<!DOCTYPE html><html><body style=\"margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;\"><div style=\"max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;\"><div style=\"background:" + brandColor + ";padding:32px 40px;\"><p style=\"color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;\">" + platformName + " - Admin</p><h1 style=\"color:#fff;font-size:24px;margin:0;line-height:1.3;\">Employer brief updated.</h1></div><div style=\"padding:32px 40px;\"><p style=\"color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;\"><strong>" + existing.company_name + "</strong> (" + existing.reference_number + ") has updated their hiring brief.</p><p style=\"color:#475569;font-size:15px;line-height:1.7;margin:0 0 28px;\">Fields updated: " + changedFields + "</p><a href=\"https://accountingbody.com/roodber8/employers\" style=\"display:inline-block;background:" + brandColor + ";color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;\">View in admin panel</a></div>" + footer + "</div></body></html>",
    })

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error("update-employer error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
