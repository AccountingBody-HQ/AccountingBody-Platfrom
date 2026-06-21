import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)
    const resend = new Resend(process.env.RESEND_API_KEY)

    const token = req.nextUrl.searchParams.get("token")
    const action = req.nextUrl.searchParams.get("action")

    if (!token || !action) {
      return NextResponse.redirect("https://accountingbody.com/jobs/hire-talent?brief=invalid")
    }

    const { data, error } = await supabase
      .from("employer_briefs")
      .select("*")
      .eq("admin_notes", token)
      .eq("status", "pending_confirmation")
      .single()

    if (error || !data) {
      return NextResponse.redirect("https://accountingbody.com/jobs/hire-talent?brief=invalid")
    }

    const isET = data.platform === "et"
    const platformName = isET ? "EthioTax" : "Accounting Body"
    const brandColor = isET ? "#1A4731" : "#0C1A3D"
    const baseUrl = isET ? "https://ethiotax.com" : "https://accountingbody.com"
    const baseDomain = isET ? "ethiotax.com" : "accountingbody.com"
    const footer = "<div style=\"background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;\"><p style=\"color:#94a3b8;font-size:12px;margin:0;\">" + platformName + " - Expert accounting and finance recruitment. <a href=\"" + baseUrl + "\" style=\"color:#94a3b8;\">" + baseDomain + "</a></p></div>"

    if (action === "cancel") {
      await supabase.from("employer_briefs").delete().eq("id", data.id)
      return NextResponse.redirect(baseUrl + "/jobs/hire-talent?brief=cancelled")
    }

    if (action === "confirm") {
      await supabase
        .from("employer_briefs")
        .update({ status: "pending", admin_notes: null, reviewed_at: new Date().toISOString() })
        .eq("id", data.id)

      const firstName = data.contact_name.split(" ")[0]

      await resend.emails.send({
        from: platformName + " <noreply@accountingbody.com>",
        to:   data.contact_email,
        subject: "Brief confirmed - we are on it - " + platformName,
        html: "<!DOCTYPE html><html><body style=\"margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;\"><div style=\"max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;\"><div style=\"background:" + brandColor + ";padding:32px 40px;\"><p style=\"color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;\">" + platformName + " - Recruitment</p><h1 style=\"color:#fff;font-size:24px;margin:0;line-height:1.3;\">Brief confirmed. We are on it.</h1></div><div style=\"padding:32px 40px;\"><p style=\"color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;\">Dear " + firstName + ",</p><p style=\"color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;\">Your hiring brief for <strong>" + data.role_title + "</strong> at " + data.company_name + " has been confirmed and is now with our team.</p><p style=\"color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;\">We will be in touch within 2 working days with a Fee Agreement Letter. No search begins until you have approved the fee.</p><p style=\"color:#475569;font-size:15px;line-height:1.7;margin:0 0 0;\">You will only be introduced to candidates we have personally selected and vetted for your requirement.</p></div>" + footer + "</div></body></html>",
      })

      await resend.emails.send({
        from: platformName + " <noreply@accountingbody.com>",
        to:   "info@accountingbody.com",
        subject: "[" + data.platform.toUpperCase() + "] Employer confirmed brief - " + data.role_title + " at " + data.company_name,
        html: "<!DOCTYPE html><html><body style=\"margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;\"><div style=\"max-width:620px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;\"><div style=\"background:" + brandColor + ";padding:32px 40px;\"><p style=\"color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;\">" + platformName + " - Admin</p><h1 style=\"color:#fff;font-size:24px;margin:0;line-height:1.3;\">New employer brief confirmed.</h1></div><div style=\"padding:32px 40px;\"><table style=\"width:100%;border-collapse:collapse;font-size:14px;\"><tr style=\"background:#f8fafc;\"><td style=\"padding:10px 12px;color:#64748b;font-weight:600;width:160px;\">Platform</td><td style=\"padding:10px 12px;color:#1e293b;font-weight:700;\">" + data.platform.toUpperCase() + "</td></tr><tr><td style=\"padding:10px 12px;color:#64748b;font-weight:600;\">Company</td><td style=\"padding:10px 12px;color:#1e293b;font-weight:700;\">" + data.company_name + "</td></tr><tr style=\"background:#f8fafc;\"><td style=\"padding:10px 12px;color:#64748b;font-weight:600;\">Contact</td><td style=\"padding:10px 12px;color:#1e293b;\">" + data.contact_name + " - " + data.contact_email + "</td></tr><tr><td style=\"padding:10px 12px;color:#64748b;font-weight:600;\">Phone</td><td style=\"padding:10px 12px;color:#1e293b;\">" + (data.contact_phone || "Not provided") + "</td></tr><tr style=\"background:#f8fafc;\"><td style=\"padding:10px 12px;color:#64748b;font-weight:600;\">Role</td><td style=\"padding:10px 12px;color:#1e293b;font-weight:700;\">" + data.role_title + "</td></tr><tr><td style=\"padding:10px 12px;color:#64748b;font-weight:600;\">Type</td><td style=\"padding:10px 12px;color:#1e293b;\">" + data.contract_type + "</td></tr><tr style=\"background:#f8fafc;\"><td style=\"padding:10px 12px;color:#64748b;font-weight:600;\">Location</td><td style=\"padding:10px 12px;color:#1e293b;\">" + data.location + "</td></tr><tr><td style=\"padding:10px 12px;color:#64748b;font-weight:600;\">Budget</td><td style=\"padding:10px 12px;color:#1e293b;\">" + (data.salary_budget || "Not specified") + "</td></tr><tr style=\"background:#f8fafc;\"><td style=\"padding:10px 12px;color:#64748b;font-weight:600;\">Start Date</td><td style=\"padding:10px 12px;color:#1e293b;\">" + (data.start_date || "Not specified") + "</td></tr></table><div style=\"margin-top:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;\"><p style=\"color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 8px;\">Role Description</p><p style=\"color:#1e293b;font-size:14px;line-height:1.7;margin:0;\">" + data.role_description + "</p></div><div style=\"margin-top:28px;\"><a href=\"https://accountingbody.com/roodber8/employers\" style=\"display:inline-block;background:" + brandColor + ";color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;\">Review in admin panel</a></div></div>" + footer + "</div></body></html>",
      })

      return NextResponse.redirect(baseUrl + "/jobs/hire-talent?brief=confirmed")
    }

    return NextResponse.redirect(baseUrl + "/jobs/hire-talent?brief=invalid")

  } catch (err) {
    console.error("confirm-brief error:", err)
    return NextResponse.redirect("https://accountingbody.com/jobs/hire-talent?brief=invalid")
  }
}
