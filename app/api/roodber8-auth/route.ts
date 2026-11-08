import { NextRequest, NextResponse } from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_LIFETIME_SECONDS,
  constantTimeEqual,
  createAdminSession,
  sha256Hex,
} from "@/lib/middleware-logic"
import { reportServerError } from "@/lib/report-error"

function base32ToBytes(base32: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  let bits = 0
  let value = 0
  const output: number[] = []
  for (const char of base32.toUpperCase().replace(/=+$/, "")) {
    const idx = alphabet.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return new Uint8Array(output)
}

async function generateTOTP(secret: string, counter: number): Promise<string> {
  const keyBytes = base32ToBytes(secret)
  const counterBytes = new Uint8Array(8)
  let c = counter
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = c & 0xff
    c = Math.floor(c / 256)
  }
  const key = await crypto.subtle.importKey(
    "raw", keyBytes.buffer as ArrayBuffer, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, counterBytes.buffer as ArrayBuffer)
  const hmac = new Uint8Array(sig)
  const offset = hmac[hmac.length - 1] & 0x0f
  const code = ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return String(code % 1000000).padStart(6, "0")
}

async function verifyTOTP(token: string, secret: string): Promise<boolean> {
  const counter = Math.floor(Date.now() / 1000 / 30)
  let matched = false
  for (let i = -1; i <= 1; i++) {
    const expected = await generateTOTP(secret, counter + i)
    if (constantTimeEqual(expected, token)) matched = true
  }
  return matched
}

// Every failure gets this same answer, so a caller learns nothing about which
// step failed. The server log carries a fixed message for setup problems.
function accessDenied() {
  return NextResponse.json({ error: "Access denied." }, { status: 401 })
}

// Same answer as any other refusal; the setup problem is logged and reported.
function notSetUp() {
  console.error("Admin sign-in is not set up")
  reportServerError("admin sign-in not set up", new Error("sign-in not set up"), { area: "admin" })
  return accessDenied()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const password: unknown = body?.password
    const totpCode: unknown = body?.totpCode
    if (typeof password !== "string" || typeof totpCode !== "string") {
      return accessDenied()
    }

    const secret = process.env.ADMIN_SECRET
    const totpSecret = process.env.ADMIN_TOTP_SECRET
    if (!secret || !totpSecret) {
      return notSetUp()
    }

    // Both steps always run, so a wrong password and a wrong code take the same path.
    const passwordMatches = constantTimeEqual(await sha256Hex(password), await sha256Hex(secret))
    const codeMatches = await verifyTOTP(totpCode, totpSecret)
    if (!passwordMatches || !codeMatches) {
      return accessDenied()
    }

    const token = await createAdminSession(process.env.ADMIN_SESSION_SECRET, secret)
    if (!token) {
      return notSetUp()
    }

    const response = NextResponse.json({ success: true }, { status: 200 })
    response.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: ADMIN_SESSION_LIFETIME_SECONDS,
      path: "/",
    })
    return response

  } catch (error) {
    console.error("Admin sign-in failed unexpectedly")
    reportServerError("admin sign-in failed", error, { area: "admin" })
    return accessDenied()
  }
}
