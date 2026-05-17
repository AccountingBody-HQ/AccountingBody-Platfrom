import { clerkMiddleware } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const STATIC_REDIRECTS: Record<string, string> = {
  "/course": "/free-courses",
  "/courses": "/free-courses",
  "/mock-exams": "/practice-questions",
  "/accountants-freelancers": "/firms-freelancers",
  "/about-us": "/about",
  "/cookie-policy-uk": "/cookie-policy",
  "/ethiotax.com": "/ethiotax",
  "/study-hub": "/study-hub",
}

async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

async function isAdminAuthenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get("admin_token")?.value
  if (!token) return false
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const expected = await sha256Hex(secret)
  if (token.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { pathname } = req.nextUrl

  const clean = pathname.replace(/\/$/, "")
  if (STATIC_REDIRECTS[clean]) {
    const url = req.nextUrl.clone()
    url.pathname = STATIC_REDIRECTS[clean]
    return NextResponse.redirect(url, 301)
  }

  const adminPath = process.env.ADMIN_PATH ?? "roodber8"
  const isAdminRoute =
    pathname.startsWith("/" + adminPath) && pathname !== "/" + adminPath + "-login"
  const isAdminApi =
    pathname.startsWith("/api/" + adminPath) &&
    pathname !== "/api/" + adminPath + "-auth" &&
    pathname !== "/api/" + adminPath + "-logout"

  if (isAdminRoute || isAdminApi) {
    const authenticated = await isAdminAuthenticated(req)
    if (!authenticated) {
      const loginUrl = req.nextUrl.clone()
      loginUrl.pathname = "/" + adminPath + "-login"
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
