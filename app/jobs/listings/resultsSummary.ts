// Pure wording and paging rules for the jobs list results header and pager.
// Framework-free (same approach as urlState.ts and components/pagination.ts)
// so every case can be unit-tested without React or a DOM.
//
// `total` is the number of matching jobs, or null when /api/jobs/direct
// returned the page of rows without it. With a total the screen shows the
// full count and the numbered pager; without one it shows the range on
// screen and a Previous/Next pager, offering Next whenever the page came
// back full.

import { prevPageTarget } from '@/components/pagination'

export interface ResultsSummaryInput {
  page: number
  pageSize: number
  rowsLength: number
  total: number | null
}

export type ResultsPager =
  | { kind: 'numbered'; total: number; totalPages: number }
  | { kind: 'prevNext'; prevPage: number | null; nextPage: number | null }

export interface ResultsSummary {
  /** First line beside the sort control. */
  headline: string
  /** Smaller second line, or null when there is none. */
  detail: string | null
  pager: ResultsPager
}

// The `total` field of a /api/jobs/direct response. A number is used as is,
// null means "not known", and anything else (missing, wrong type) keeps the
// screen's long-standing reading of 0.
export function parseTotal(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value === null) return null
  return 0
}

export function summariseResults({ page, pageSize, rowsLength, total }: ResultsSummaryInput): ResultsSummary {
  if (total === null) {
    const start = rowsLength === 0 ? 0 : (page - 1) * pageSize + 1
    const end = rowsLength === 0 ? 0 : start + rowsLength - 1
    return {
      headline: `Showing ${start}–${end}`,
      detail: null,
      pager: {
        kind: 'prevNext',
        prevPage: prevPageTarget(page),
        nextPage: rowsLength >= pageSize ? page + 1 : null,
      },
    }
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return {
    headline: `${total.toLocaleString()} job${total === 1 ? '' : 's'} found`,
    detail: `Showing ${rangeStart}–${rangeEnd} of ${total.toLocaleString()}`,
    pager: { kind: 'numbered', total, totalPages },
  }
}
