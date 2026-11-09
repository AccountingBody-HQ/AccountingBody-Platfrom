// Decision logic for middleware.ts. Everything here works from plain inputs and
// returns a plain answer: middleware.ts reads the request and environment, then
// turns the answer into a response. This file stays free of request-scoped
// imports because it runs in the edge middleware as well as on the server.

const MAX_DECODE_PASSES = 5

export const ADMIN_SESSION_COOKIE = 'admin_token'
export const ADMIN_SESSION_LIFETIME_SECONDS = 12 * 60 * 60

const SESSION_VERSION = 'v1'
const SESSION_PATTERN = /^v1\.(\d{10})\.(\d{10})\.([0-9a-f]{32})\.([0-9a-f]{64})$/
const MIN_SESSION_SECRET_LENGTH = 32
const SESSION_ID_BYTES = 16
const ADMIN_SECRET_LABEL = 'admin-session-binding:v1:'

// The one answer to an admin API request without a valid session. Middleware
// and the route handlers both send it.
export const ADMIN_SIGNED_OUT_BODY = { error: 'Signed out' }
export const ADMIN_SIGNED_OUT_INIT = { status: 401, headers: { 'Cache-Control': 'no-store' } }

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
  adminSessionSecret: string | undefined
  adminSecret: string | undefined
  headers: Headers
}

export type RequestDecision =
  | { action: 'redirect-home' }
  | { action: 'redirect-permanent'; pathname: string }
  | { action: 'redirect-admin-login'; pathname: string }
  | { action: 'admin-api-signed-out' }
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

// An admin address that reads as an API route at any layer. An address that
// cannot be decoded is judged as written.
export function isAdminApiAddress(pathname: string, adminPath: string): boolean {
  const layers = readAddressLayers(pathname) ?? [pathname]
  return [...layers, ...layers.map(tidyPathname)].some((path) => isAdminApiPath(path, adminPath))
}

// Compares every character, so the time taken does not depend on where two
// values of the same length differ.
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

function isUsableSessionSecret(sessionSecret: string | undefined): sessionSecret is string {
  return (sessionSecret?.length ?? 0) >= MIN_SESSION_SECRET_LENGTH
}

function importSessionKey(sessionSecret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(sessionSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

// What the signature covers: the visible claims and a fingerprint of the admin
// password. The fingerprint is signed but never placed in the cookie, so a new
// admin password ends every session.
async function sessionSignedBytes(claims: string, adminSecret: string) {
  const fingerprint = await sha256Hex(ADMIN_SECRET_LABEL + adminSecret)
  return new TextEncoder().encode(claims + '\n' + fingerprint)
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string) {
  return Uint8Array.from(hex.match(/../g) ?? [], pair => parseInt(pair, 16))
}

// Returns null when the two secrets are not set up, so no session is issued.
export async function createAdminSession(
  sessionSecret: string | undefined,
  adminSecret: string | undefined,
): Promise<string | null> {
  if (!adminSecret || !isUsableSessionSecret(sessionSecret)) return null
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAt = issuedAt + ADMIN_SESSION_LIFETIME_SECONDS
  const id = bytesToHex(crypto.getRandomValues(new Uint8Array(SESSION_ID_BYTES)))
  const claims = `${SESSION_VERSION}.${issuedAt}.${expiresAt}.${id}`
  const signature = await crypto.subtle.sign(
    'HMAC',
    await importSessionKey(sessionSecret),
    await sessionSignedBytes(claims, adminSecret),
  )
  return `${claims}.${bytesToHex(new Uint8Array(signature))}`
}

// The one session check, used by middleware, requireAdmin() and every admin API
// route. A value is accepted only if it has the session format, has not expired
// and carries a signature made with the current secrets.
export async function isAdminSessionValid(
  token: string | undefined,
  sessionSecret: string | undefined,
  adminSecret: string | undefined,
): Promise<boolean> {
  if (!token || !adminSecret || !isUsableSessionSecret(sessionSecret)) return false

  const match = SESSION_PATTERN.exec(token)
  if (!match) return false
  const [, issuedAt, expiresAt, id, signature] = match

  const lifetime = Number(expiresAt) - Number(issuedAt)
  if (lifetime <= 0 || lifetime > ADMIN_SESSION_LIFETIME_SECONDS) return false
  if (Math.floor(Date.now() / 1000) >= Number(expiresAt)) return false

  return crypto.subtle.verify(
    'HMAC',
    await importSessionKey(sessionSecret),
    hexToBytes(signature),
    await sessionSignedBytes(`${SESSION_VERSION}.${issuedAt}.${expiresAt}.${id}`, adminSecret),
  )
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
  const { pathname, adminPath, adminToken, adminSessionSecret, adminSecret, headers } = facts

  if (isRetiredAccountPath(pathname)) {
    return { action: 'redirect-home' }
  }

  const redirectTarget = findStaticRedirect(pathname)
  if (redirectTarget) {
    return { action: 'redirect-permanent', pathname: redirectTarget }
  }

  if (isAdminAddress(pathname, adminPath)) {
    const authenticated = await isAdminSessionValid(adminToken, adminSessionSecret, adminSecret)
    if (!authenticated) {
      if (isAdminApiAddress(pathname, adminPath)) {
        return { action: 'admin-api-signed-out' }
      }
      return { action: 'redirect-admin-login', pathname: "/" + adminPath + "-login" }
    }
  }

  return { action: 'continue', platform: resolvePlatform(headers) }
}
