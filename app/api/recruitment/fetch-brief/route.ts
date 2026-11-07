import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"
import { checkRead } from "@/lib/db-check"
import { SERVER_PROBLEM_TEXT } from "@/lib/message-rules"
import { reportServerError } from "@/lib/report-error"

export async function GET(req: NextRequest) {
  try {
    const supabase = getServerSupabase("publicRead")
    const token = req.nextUrl.searchParams.get("token")
    if (!token) return NextResponse.json({ error: "No token" }, { status: 400 })

    const lookup = checkRead(
      await supabase
        .from("employer_briefs")
        .select("*")
        .eq("confirmation_token", token)
        .eq("status", "pending_confirmation")
        .single(),
      "fetch-brief lookup",
      { noRowsIsEmpty: true },
    )

    if (!lookup.ok) return NextResponse.json({ error: SERVER_PROBLEM_TEXT }, { status: 500 })
    const data = lookup.data

    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json({ data })
  } catch (err) {
    console.error("fetch-brief error:", err)
    reportServerError("hiring brief lookup failed", err, { area: "public" })
    return NextResponse.json({ error: SERVER_PROBLEM_TEXT }, { status: 500 })
  }
}
