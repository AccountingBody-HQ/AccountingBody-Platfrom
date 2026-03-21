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

export default clerkMiddleware((auth, req: NextRequest) => {
  const { pathname } = req.nextUrl

  // Check static redirects
  const clean = pathname.replace(/\/$/, "")
  if (STATIC_REDIRECTS[clean]) {
    const url = req.nextUrl.clone()
    url.pathname = STATIC_REDIRECTS[clean]
    return NextResponse.redirect(url, 301)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
