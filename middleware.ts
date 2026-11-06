import { clerkMiddleware } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { ADMIN_SESSION_COOKIE, decideRequest, getAdminPath } from "./lib/middleware-logic"

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { pathname } = req.nextUrl

  const adminPath = getAdminPath()
  const decision = await decideRequest({
    pathname,
    adminPath,
    adminToken: req.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    adminSessionSecret: process.env.ADMIN_SESSION_SECRET,
    adminSecret: process.env.ADMIN_SECRET,
    headers: req.headers,
  })

  if (decision.action === "redirect-home") {
    return NextResponse.redirect(new URL('/', req.url))
  }

  if (decision.action === "redirect-permanent") {
    const url = req.nextUrl.clone()
    url.pathname = decision.pathname
    return NextResponse.redirect(url, 301)
  }

  if (decision.action === "redirect-admin-login") {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = decision.pathname
    return NextResponse.redirect(loginUrl)
  }

  const requestHeaders = new Headers(req.headers)
  if (decision.platform === 'ethiotax') {
    requestHeaders.set('x-et-platform', 'ethiotax')
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.cookies.set('x-et-platform', decision.platform, {
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
  })
  return response
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|txt)).*)",
    "/(api|trpc)(.*)",
  ],
}
