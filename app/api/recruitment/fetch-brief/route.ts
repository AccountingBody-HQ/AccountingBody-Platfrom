import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)
    const token = req.nextUrl.searchParams.get("token")
    if (!token) return NextResponse.json({ error: "No token" }, { status: 400 })

    const { data, error } = await supabase
      .from("employer_briefs")
      .select("*")
      .eq("admin_notes", token)
      .eq("status", "pending_confirmation")
      .single()

    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json({ data })
  } catch (err) {
    console.error("fetch-brief error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
