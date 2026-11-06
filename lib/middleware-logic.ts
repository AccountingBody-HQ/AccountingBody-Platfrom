import { sha256Hex } from './admin-auth'

// Decision logic for middleware.ts. Everything here works from plain inputs and
// returns a plain answer: middleware.ts reads the request and environment, then
// turns the answer into a response.

const STATIC_REDIRECTS: Record<string, string> = {
  "/course": "/free-courses",
  "/courses": "/free-courses",
  "/accountants-freelancers": "/firms-freelancers",
  "/about-us": "/about",
  "/cookie-policy-uk": "/cookie-policy",
  "/ethiotax.com": "/ethiotax",
}

export type SitePlatform = 'ethiotax' | 'accountingbody'

export type RequestFacts = {
  pathname: string
  adminPath: string
  adminToken: string | undefined
  adminSecret: string | undefined
  headers: Headers
}

export type RequestDecision =
  | { action: 'redirect-home' }
  | { action: 'redirect-permanent'; pathname: string }
  | { action: 'redirect-admin-login'; pathname: string }
  | { action: 'continue'; platform: SitePlatform }

// The account and login system is not in use and is kept for future use only.
export function isRetiredAccountPath(pathname: string): boolean {
  return (
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up') ||
    pathname.startsWith('/dashboard')
  )
}

export function findStaticRedirect(pathname: string): string | undefined {
  const clean = pathname.replace(/\/$/, "")
  return STATIC_REDIRECTS[clean]
}

export function isAdminPagePath(pathname: string, adminPath: string): boolean {
  return pathname.startsWith("/" + adminPath) && pathname !== "/" + adminPath + "-login"
}

export function isAdminApiPath(pathname: string, adminPath: string): boolean {
  return (
    pathname.startsWith("/api/" + adminPath) &&
    pathname !== "/api/" + adminPath + "-auth" &&
    pathname !== "/api/" + adminPath + "-logout"
  )
}

export async function isAdminSessionValid(
  token: string | undefined,
  secret: string | undefined,
): Promise<boolean> {
  if (!token) return false
  if (!secret) return false
  const expected = await sha256Hex(secret)
  if (token.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

export function resolvePlatform(headers: Headers): SitePlatform {
  const forwardedHost = headers.get('x-forwarded-host') ?? ''
  const host = headers.get('host') ?? ''
  const isEthioTax =
    forwardedHost.includes('ethiotax.com') ||
    host.includes('ethiotax.com') ||
    headers.get('x-et-platform') === 'ethiotax'
  return isEthioTax ? 'ethiotax' : 'accountingbody'
}

export async function decideRequest(facts: RequestFacts): Promise<RequestDecision> {
  const { pathname, adminPath, adminToken, adminSecret, headers } = facts

  if (isRetiredAccountPath(pathname)) {
    return { action: 'redirect-home' }
  }

  const redirectTarget = findStaticRedirect(pathname)
  if (redirectTarget) {
    return { action: 'redirect-permanent', pathname: redirectTarget }
  }

  if (isAdminPagePath(pathname, adminPath) || isAdminApiPath(pathname, adminPath)) {
    const authenticated = await isAdminSessionValid(adminToken, adminSecret)
    if (!authenticated) {
      return { action: 'redirect-admin-login', pathname: "/" + adminPath + "-login" }
    }
  }

  return { action: 'continue', platform: resolvePlatform(headers) }
}
