'use client'

import { Pagination } from '@/components/Pagination'
import { articlesPageHref } from './pageUrl'

// The same small wrapper as app/practice-questions/PracticeQuestionsPagination.tsx:
// page.tsx (a Server Component) cannot pass <Pagination> a closure, so the
// hrefFor function is made here.
export function ArticlesPagination({ page, totalPages, total }: { page: number; totalPages: number; total: number }) {
  return (
    <Pagination
      page={page}
      totalPages={totalPages}
      total={total}
      navLabel="Articles pages"
      itemLabel="article"
      showContext={false}
      hrefFor={articlesPageHref}
    />
  )
}
