import { NextResponse } from "next/server"

export async function POST() {
  const response = NextResponse.json({ success: true }, { status: 200 })
  response.cookies.set("admin_token", "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  })
  return response
}
