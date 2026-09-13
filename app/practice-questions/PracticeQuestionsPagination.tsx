'use client'

import { Pagination } from '@/components/Pagination'
import { buildPracticeQuestionsUrl, type PracticeQuestionsFilterState } from './buildUrl'

// page.tsx (a Server Component) cannot pass <Pagination> a `hrefFor`
// closure directly — a function isn't serializable across the server/
// client boundary, and doing so throws at request time (see the comment
// in components/Pagination.tsx). This is the small Client Component that
// closes that gap: it receives the current filter state as plain,
// serializable data, and builds the `hrefFor` closure itself, entirely on
// the client side, before handing it to <Pagination>.
export function PracticeQuestionsPagination({
  page,
  totalPages,
  total,
  filters,
}: {
  page: number
  totalPages: number
  total: number
  filters: PracticeQuestionsFilterState
}) {
  return (
    <Pagination
      page={page}
      totalPages={totalPages}
      total={total}
      navLabel="Practice question sets pages"
      itemLabel="question set"
      hrefFor={p => buildPracticeQuestionsUrl(filters, { page: p })}
    />
  )
}
