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
// ~9,870 browsable jobs on the last recorded count means a last page at
// offset ~9,864. Past this cap the deepest pages would get the page at
// offset 10000 instead: raise it if the browsable count nears 10,000.
export const MAX_OFFSET = 10000

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
