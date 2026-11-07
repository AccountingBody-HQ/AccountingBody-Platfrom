import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"

export async function GET(req: NextRequest) {
  try {
    const supabase = getServerSupabase("publicRead")
    const token = req.nextUrl.searchParams.get("token")
    if (!token) return NextResponse.json({ error: "No token" }, { status: 400 })

    const { data, error } = await supabase
      .from("employer_briefs")
      .select("*")
      .eq("confirmation_token", token)
      .eq("status", "pending_confirmation")
      .single()

    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json({ data })
  } catch (err) {
    console.error("fetch-brief error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
