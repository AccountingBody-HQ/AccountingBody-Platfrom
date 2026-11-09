import { NextResponse } from "next/server"
import { ADMIN_SESSION_COOKIE } from "@/lib/middleware-logic"

export async function POST() {
  const response = NextResponse.json({ success: true }, { status: 200 })
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  })
  return response
}
