// Pure, framework-free URL builder for /practice-questions' own filter
// state (difficulty/search/letter/sort/category/page). Pulled out of
// page.tsx (a Server Component) so it can also be used from
// PracticeQuestionsPagination.tsx (a Client Component): a Server Component
// can only pass SERIALIZABLE props to a Client Component, and a closure
// over page.tsx's local variables is not serializable — passing one
// directly across that boundary throws at request time. This function
// takes the filter state as a plain, serializable object instead, so both
// sides can call the exact same logic without a function ever crossing
// the boundary.
export interface PracticeQuestionsFilterState {
  difficulty: string
  search: string
  letter: string
  sort: string
  category: string
  page: number
}

export function buildPracticeQuestionsUrl(
  current: PracticeQuestionsFilterState,
  overrides: Record<string, string | number>,
): string {
  const { difficulty, search, letter, sort, category, page } = current
  const params = new URLSearchParams()
  if (difficulty) params.set('difficulty', difficulty)
  if (search && !letter) params.set('search', search)
  if (letter) params.set('letter', letter)
  if (sort && sort !== 'alpha') params.set('sort', sort)
  if (category) params.set('category', category)
  if (page > 1) params.set('page', String(page))
  Object.entries(overrides).forEach(([k, v]) => {
    if (v === '' || v === 0) params.delete(k)
    else params.set(k, String(v))
  })
  const str = params.toString()
  return `/practice-questions${str ? '?' + str : ''}`
}
