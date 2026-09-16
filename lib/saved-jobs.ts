// Pure helpers for the saved-jobs feature. Zero React, zero Supabase, zero
// Next.js imports — same reason as lib/subscribe-dedup.ts and
// app/jobs/listings/countryOptions.ts: a lib file that imports 'react' (like
// lib/jobs.ts does, for cache()) needs a vitest shim to test; staying pure
// here means lib/saved-jobs.test.ts needs none.

export const SAVED_JOBS_COOKIE = 'ab_vid'
export const SAVED_JOBS_MAX_AGE_SECONDS = 604800 // 7 days
export const SAVED_JOBS_LIMIT = 200
export const SAVED_JOBS_RETENTION_DAYS = 7
export const LAST_SEEN_THROTTLE_MS = 3_600_000 // 1 hour

// Version-4-aware: every uuid this feature ever compares against
// (crypto.randomUUID() for visitor ids, Postgres gen_random_uuid() for job
// and saved_jobs ids) is RFC4122 v4, so this rejects a malformed or
// forged-looking cookie/body value up front rather than passing it through
// to a query.
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4_RE.test(value)
}

export function parseJobIdBody(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null
  const jobId = (body as Record<string, unknown>).jobId
  return isValidUuid(jobId) ? jobId : null
}

export function parseImportBody(body: unknown): string[] | null {
  if (typeof body !== 'object' || body === null) return null
  const jobIds = (body as Record<string, unknown>).jobIds
  if (!Array.isArray(jobIds)) return null
  const deduped = Array.from(new Set(jobIds.filter(isValidUuid)))
  return deduped.slice(0, SAVED_JOBS_LIMIT)
}

export function savedJobsCookieOptions() {
  return {
    httpOnly: true as const,
    secure: true as const,
    sameSite: 'lax' as const,
    path: '/' as const,
    maxAge: SAVED_JOBS_MAX_AGE_SECONDS,
  }
}

// Mirrors the exact "still browsable" filter used by getBrowsableJobsCount
// and getActiveDirectJobs's count-only path in lib/jobs.ts: status must be
// 'active' (the daily expire-jobs cron may not have caught up yet, or may
// have already flipped it) AND either no expiry or an expiry still in the
// future.
export function isJobAvailable(job: { status: string; expires_at: string | null }, now: Date): boolean {
  if (job.status !== 'active') return false
  if (job.expires_at === null) return true
  return new Date(job.expires_at).getTime() > now.getTime()
}

// In-memory, per-instance, best-effort rate limiter — same shape as
// app/api/search/route.ts's checkRateLimit. On serverless this resets
// whenever a fresh instance is spun up and is never shared across
// instances; it blunts casual abuse, it is not an exact global limit.
// `now` is injectable so tests can exercise window behaviour without real
// timers.
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 30
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export function checkSavedJobsRateLimit(key: string, now: number = Date.now()): boolean {
  const entry = rateLimitStore.get(key)
  if (!entry || entry.resetTime < now) {
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

// Parses the legacy localStorage-saved-jobs value (a JSON array of job
// uuid strings) into a de-duplicated list of valid ids, or [] for anything
// malformed/empty/absent. The caller (app/jobs/saved/useSavedJobs.ts) owns
// reading the raw string from localStorage and knows the key name — this
// stays pure so it can be unit-tested without a DOM.
export function parseStoredSavedJobIds(raw: string | null): string[] {
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return Array.from(new Set(parsed.filter(isValidUuid)))
}

// Maps a saved-jobs API error status to the plain-English copy the UI shows
// after an optimistic save/unsave is rejected or fails outright (status 0 —
// no HTTP response at all, e.g. a network error).
export function savedJobsErrorMessage(status: number): string {
  if (status === 409) return `You can save up to ${SAVED_JOBS_LIMIT} jobs. Remove one to save another.`
  if (status === 429) return 'Too many changes at once. Please wait a moment and try again.'
  if (status === 404) return 'This job is no longer available to save.'
  return "We couldn't update your saved jobs. Please try again."
}
