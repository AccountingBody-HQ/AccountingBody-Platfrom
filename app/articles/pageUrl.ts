// The page number in /articles?page=n, both ways. Framework-free, so the
// server page and the client pagination wrapper use the same rules.

// Anything that is not a whole number from 1 up (missing, repeated, text,
// zero, negative, decimal) is page 1. A number above the last page is left
// as it is: the page answers not-found for it.
export function parseArticlesPage(value: string | string[] | undefined): number {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : 1
}

export function articlesPageHref(page: number): string {
  return page > 1 ? `/articles?page=${page}` : '/articles'
}
