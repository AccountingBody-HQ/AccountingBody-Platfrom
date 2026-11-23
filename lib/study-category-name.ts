// The readable name of a /study/<category> address, for labels only (never for an address).
// Qualification addresses stay in capitals (ACCA, ETICPA-ATQ); a subject takes the article's own
// subject title when the address is that article's subject, otherwise its words with a capital each.

const QUALIFICATIONS = ['acca', 'cima', 'aat', 'icaew', 'eticpa', 'eticpa-atq', 'eticpa-cpa']

const isSlug = (text: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text)
const titleCase = (slug: string) =>
  slug.split('-').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

export function studyCategoryName(
  category: string,
  article: { category?: string | null; category_title?: string | null },
): string {
  const slug = category.toLowerCase().trim()
  if (QUALIFICATIONS.includes(slug)) return slug.toUpperCase()
  const title = article.category_title?.trim()
  if (title && !isSlug(title) && article.category?.toLowerCase().trim() === slug) return title
  return titleCase(slug)
}
