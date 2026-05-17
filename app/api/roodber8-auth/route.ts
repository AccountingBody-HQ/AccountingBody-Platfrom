import { NextRequest, NextResponse } from "next/server"

async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

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
  for (let i = -1; i <= 1; i++) {
    const expected = await generateTOTP(secret, counter + i)
    if (expected === token) return true
  }
  return false
}

export async function POST(req: NextRequest) {
  try {
    const { password, totpCode } = await req.json()

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

    const totpSecret = process.env.ADMIN_TOTP_SECRET
    if (!totpSecret) {
      return NextResponse.json({ error: "2FA not configured" }, { status: 500 })
    }

    if (!totpCode || String(totpCode).length !== 6) {
      return NextResponse.json({ error: "2FA code required" }, { status: 400 })
    }

    const isValid = await verifyTOTP(String(totpCode), totpSecret)

    if (!isValid) {
      return NextResponse.json({ error: "Invalid 2FA code" }, { status: 401 })
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

  } catch (err) {
    console.error("Auth error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
