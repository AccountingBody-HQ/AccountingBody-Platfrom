// Page-size and offset parsing for /api/jobs/direct. Kept out of route.ts
// because Next rejects non-HTTP named exports from a route file, and these
// need to be importable by tests.
//
// Both values are clamped before they reach the cache key or the ranked
// search RPC, so a request like ?limit=100000 can neither create an
// oversized cache entry (Vercel's data cache caps entries at 2 MB) nor ask
// the database for a huge page.

export const DEFAULT_LIMIT = 24
// JobListingsClient always asks for 24 (its PAGE_SIZE); nothing else calls
// this route.
export const MAX_LIMIT = 50
// Generous on purpose: search_jobs_ranked ranks every matching row before
// LIMIT/OFFSET, so a large offset adds almost no database cost (an
// oversized limit was the real risk, capped above). 100,000 is well past
// public.jobs's ~22,500 rows, so the client's uncapped pagination keeps
// working on its deepest pages.
export const MAX_OFFSET = 100000

// Whole non-negative integers only. "2.7", "-5", "1e3", "abc" and "" are
// all rejected. An oversized digit string is still valid and clamps below.
function parseWholeNumber(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined
  return Number(value)
}

export function parseLimit(value: string | null): number {
  const n = parseWholeNumber(value)
  if (n === undefined || n < 1) return DEFAULT_LIMIT
  return Math.min(n, MAX_LIMIT)
}

export function parseOffset(value: string | null): number {
  const n = parseWholeNumber(value)
  if (n === undefined) return 0
  return Math.min(n, MAX_OFFSET)
}
