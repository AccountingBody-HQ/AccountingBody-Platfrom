/**
 * Universal fetch wrapper with exponential backoff retry.
 *
 * Retries on:
 * - Network errors (timeout, connection refused, DNS failure)
 * - HTTP 429 Too Many Requests — respects Retry-After header when present
 * - HTTP 500, 502, 503, 504 — transient server errors
 *
 * Does NOT retry on:
 * - HTTP 400, 401, 403, 404 — client errors, retrying won't help
 * - HTTP 200–399 — success
 *
 * A fresh AbortController/timeout is created for each attempt — a fired
 * AbortSignal cannot be reused across retries without every subsequent
 * attempt aborting immediately.
 *
 * @param url     Full URL string to fetch
 * @param options Standard RequestInit options (signal is managed internally, so it is excluded here)
 * @param maxRetries  Number of retry attempts after initial failure (default: 3)
 * @param baseDelayMs Initial delay in ms, doubles each retry (default: 1000)
 * @param timeoutMs   Per-attempt timeout in ms (default: 15000)
 */
export async function fetchWithRetry(
  url: string,
  options: Omit<RequestInit, 'signal'>,
  maxRetries = 3,
  baseDelayMs = 1000,
  timeoutMs = 15000
): Promise<Response> {
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(url, { ...options, signal: controller.signal })
      clearTimeout(timeoutId)

      // Success range — return immediately
      if (res.status >= 200 && res.status < 300) return res

      // Rate limited — respect Retry-After if present, otherwise exponential backoff
      if (res.status === 429) {
        if (attempt >= maxRetries) return res // Return 429 on final attempt
        const retryAfter = res.headers.get('Retry-After')
        const waitMs = retryAfter && /^\d+$/.test(retryAfter)
          ? parseInt(retryAfter, 10) * 1000
          : baseDelayMs * Math.pow(2, attempt)
        await sleep(Math.min(waitMs, 60_000)) // Cap at 60s
        continue
      }

      // Transient server errors — retry
      if (res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504) {
        if (attempt >= maxRetries) return res // Return the error on final attempt
        await sleep(baseDelayMs * Math.pow(2, attempt))
        continue
      }

      // All other status codes (4xx except 429) — do not retry, return as-is
      return res

    } catch (err: unknown) {
      // Network-level error (timeout, connection refused, DNS failure)
      clearTimeout(timeoutId)
      lastError = err
      if (attempt >= maxRetries) break
      await sleep(baseDelayMs * Math.pow(2, attempt))
    }
  }

  throw lastError ?? new Error(`fetchWithRetry: all ${maxRetries + 1} attempts failed for ${url}`)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
