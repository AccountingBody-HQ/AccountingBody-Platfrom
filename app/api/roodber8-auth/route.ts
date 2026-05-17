import { NextRequest, NextResponse } from "next/server"

async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json()

    if (!password) {
      return NextResponse.json({ error: "Password required" }, { status: 400 })
    }

    const secret = process.env.ADMIN_SECRET
    if (!secret) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
    }

    const submittedHash = await sha256Hex(password)
    const expectedHash = await sha256Hex(secret)

    let diff = 0
    if (submittedHash.length === expectedHash.length) {
      for (let i = 0; i < submittedHash.length; i++) {
        diff |= submittedHash.charCodeAt(i) ^ expectedHash.charCodeAt(i)
      }
    } else {
      diff = 1
    }

    if (diff !== 0) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 })
    }

    const token = expectedHash

    const response = NextResponse.json({ success: true }, { status: 200 })
    response.cookies.set("admin_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    })

    return response
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
