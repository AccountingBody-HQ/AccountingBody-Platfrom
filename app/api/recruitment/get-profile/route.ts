import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)
    const token = req.nextUrl.searchParams.get("token")
    const type = req.nextUrl.searchParams.get("type") // "candidate" or "employer"

    if (!token || !type) {
      return NextResponse.json({ error: "Missing token or type" }, { status: 400 })
    }

    if (type === "candidate") {
      const { data, error } = await supabase
        .from("job_seeker_registrations")
        .select("reference_number, full_name, email, phone, location_city, location_country, linkedin_url, professional_role, qualification, years_experience, employment_status, salary_expectation, role_types, jurisdictions, languages, biography, platform, status")
        .eq("update_token", token)
        .eq("status", "active")
        .single()

      if (error || !data) {
        return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 })
      }

      return NextResponse.json({ data, type: "candidate" })
    }

    if (type === "employer") {
      const { data, error } = await supabase
        .from("employer_briefs")
        .select("reference_number, company_name, contact_name, contact_email, contact_phone, role_title, contract_type, location, salary_budget, start_date, jurisdiction, role_description, must_haves, nice_to_haves, platform, status")
        .eq("update_token", token)
        .eq("status", "pending")
        .single()

      if (error || !data) {
        return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 })
      }

      return NextResponse.json({ data, type: "employer" })
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 })

  } catch (err) {
    console.error("get-profile error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
