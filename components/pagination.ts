// Pure page-window / jump-to-page logic for <Pagination>. Framework-free by
// design (same reasoning as urlState.ts) so the ellipsis math and jump
// clamping can be unit-tested without React, Supabase, or any mocking.

export type PageItem = number | 'ellipsis'

// Windows the page numbers shown around `page`: always the first and last
// page, the current page, and up to two pages either side of it. Gaps
// between the kept pages collapse to a single 'ellipsis' marker rather than
// listing every page — the point of the window in the first place.
export function computePageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 0) return []

  const keep = new Set<number>()
  for (let p = page - 2; p <= page + 2; p++) {
    if (p >= 1 && p <= totalPages) keep.add(p)
  }
  keep.add(1)
  keep.add(totalPages)

  const sorted = Array.from(keep).sort((a, b) => a - b)
  const items: PageItem[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) items.push('ellipsis')
    items.push(p)
  })
  return items
}

// Parses the jump-to-page input. Two distinct failure modes, on purpose:
//   - not a clean integer (letters, decimals, empty) -> null, meaning
//     "ignore this, don't navigate" — the caller should leave the current
//     page alone rather than treat garbage input as page 1.
//   - a real integer that's just out of range (0, negative, or past the
//     last page) -> clamped into [1, totalPages], never ignored, and never
//     capable of producing a navigation outside that range.
export function parseJumpToPage(raw: string, totalPages: number): number | null {
  const trimmed = raw.trim()
  if (!/^-?\d+$/.test(trimmed)) return null
  const n = parseInt(trimmed, 10)
  const max = Math.max(totalPages, 1)
  return Math.min(Math.max(n, 1), max)
}

// The target page for Previous/Next, or null at a boundary. Shared by both
// of <Pagination>'s navigation modes: in onChange mode, null drives the
// button's `disabled` attribute; in hrefFor mode, null means there is no
// real destination to link to, so that control renders as a non-link
// placeholder instead of an <a> pointing nowhere.
export function prevPageTarget(page: number): number | null {
  return page > 1 ? page - 1 : null
}

export function nextPageTarget(page: number, totalPages: number): number | null {
  return page < totalPages ? page + 1 : null
}
