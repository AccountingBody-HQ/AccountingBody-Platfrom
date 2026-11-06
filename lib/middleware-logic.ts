// Decision logic for middleware.ts. Everything here works from plain inputs and
// returns a plain answer: middleware.ts reads the request and environment, then
// turns the answer into a response. This file stays free of request-scoped
// imports because it runs in the edge middleware as well as on the server.

const MAX_DECODE_PASSES = 5

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

export function getAdminPath(): string {
  return process.env.ADMIN_PATH ?? "roodber8"
}

export async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

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

// An address read as far as it can be: the address as written, then each layer
// of decoding in turn. Returns null when the first reading fails, or when the
// address has not settled within the pass limit.
export function readAddressLayers(pathname: string): string[] | null {
  const layers = [pathname]
  for (let pass = 0; pass < MAX_DECODE_PASSES; pass++) {
    const current = layers[layers.length - 1]
    let next: string
    try {
      next = decodeURIComponent(current)
    } catch {
      return pass === 0 ? null : layers
    }
    if (next === current) return layers
    layers.push(next)
  }
  return null
}

// One tidy spelling of a path, the way the router reads it: backslashes as
// slashes, repeated slashes collapsed, "." and ".." resolved, no trailing slash.
function tidyPathname(pathname: string): string {
  const segments: string[] = []
  for (const segment of pathname.replace(/\\/g, "/").split("/")) {
    if (segment === "" || segment === ".") continue
    if (segment === "..") segments.pop()
    else segments.push(segment)
  }
  return "/" + segments.join("/")
}

// The tidy spelling of an address at its last readable layer, or null when the
// address cannot be read.
export function normaliseAdminPathname(pathname: string): string | null {
  const layers = readAddressLayers(pathname)
  return layers === null ? null : tidyPathname(layers[layers.length - 1])
}

// An address is checked at every layer it can be read, as written and tidied.
export function isAdminAddress(pathname: string, adminPath: string): boolean {
  const layers = readAddressLayers(pathname)
  if (layers === null) return true
  return [...layers, ...layers.map(tidyPathname)].some(
    (path) => isAdminPagePath(path, adminPath) || isAdminApiPath(path, adminPath),
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

  if (isAdminAddress(pathname, adminPath)) {
    const authenticated = await isAdminSessionValid(adminToken, adminSecret)
    if (!authenticated) {
      return { action: 'redirect-admin-login', pathname: "/" + adminPath + "-login" }
    }
  }

  return { action: 'continue', platform: resolvePlatform(headers) }
}
