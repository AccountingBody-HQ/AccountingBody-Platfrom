// Server-side check of the Cloudflare Turnstile token a public form sends
// with each submission. One request to Cloudflare, with its own time limit,
// and no retry. The answer is a simple ok / not ok; the route decides what
// the visitor sees.
//
// Each site has its own secret key, chosen the same way as the site key the
// form's widget uses: the EthioTax site uses TURNSTILE_SECRET_KEY and every
// other request uses TURNSTILE_SECRET_KEY_AB.
//
// Log lines are fixed text: never the token, the secret, the visitor's email
// address or IP address, or Cloudflare's reply.

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export const SITEVERIFY_TIME_LIMIT_MS = 5000

export type HumanCheckReason = 'missing' | 'not-confirmed' | 'unreadable' | 'unavailable'

export type HumanCheckResult = { ok: true } | { ok: false; reason: HumanCheckReason }

function failed(label: string, reason: HumanCheckReason): HumanCheckResult {
  try {
    console.warn(`person check: ${label} ${reason}`)
  } catch {
    // Logging must never change the answer.
  }
  return { ok: false, reason }
}

export async function verifyHumanCheck(
  token: unknown,
  ip: string,
  isEthioTax: boolean,
  label: string,
): Promise<HumanCheckResult> {
  if (typeof token !== 'string' || !token) return failed(label, 'missing')
  const secret = isEthioTax ? process.env.TURNSTILE_SECRET_KEY : process.env.TURNSTILE_SECRET_KEY_AB
  if (!secret) return failed(label, 'unavailable')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SITEVERIFY_TIME_LIMIT_MS)
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        response: token,
        remoteip: ip,
      }),
      signal: controller.signal,
    })
    let data: unknown
    try {
      data = await res.json()
    } catch {
      return failed(label, controller.signal.aborted ? 'unavailable' : 'unreadable')
    }
    if (typeof data !== 'object' || data === null) return failed(label, 'unreadable')
    if ((data as { success?: unknown }).success !== true) return failed(label, 'not-confirmed')
    return { ok: true }
  } catch {
    return failed(label, 'unavailable')
  } finally {
    clearTimeout(timer)
  }
}
