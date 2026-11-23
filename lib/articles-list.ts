import { unstable_cache } from 'next/cache'
import { getServerSupabase } from '@/lib/supabase-server'
import { guardCachedRead } from '@/lib/cache-guard'

export interface ArticleSummary {
  id:            string
  title:         string
  slug:          string
  excerpt?:      string
  category?:     string
  published_at?: string
}

// Same small rule as readProblem in lib/db.ts (private there): a real Error
// with fixed text and the database's short code only.
function readProblem(message: string, error: { code?: unknown }): Error & { code?: string } {
  const failed = new Error(message) as Error & { code?: string }
  if (typeof error.code === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(error.code)) failed.code = error.code
  return failed
}

export const ARTICLES_PAGE_SIZE = 50

interface ArticlesPageRead {
  articles: ArticleSummary[]
  // The number of published articles of the site; read with page 1 only.
  total: number
}

export interface ArticlesPage extends ArticlesPageRead {
  totalPages: number
}

const EMPTY_PAGE_CODE = 'EMPTY_PAGE'

// Newest first; articles with the same date keep one fixed order (id), so no
// article is shown twice or skipped between two pages. Only page 1 asks for
// the total, with the same filter. Every answer that is not a real one is
// thrown, so it is never cached: a database error, no data, no total, or no
// rows on a page after the first.
async function fetchPublishedArticlesForSite(siteCode: 'ab' | 'et', page: number): Promise<ArticlesPageRead> {
  const supabase = getServerSupabase('publicRead')
  const from = (page - 1) * ARTICLES_PAGE_SIZE
  const { data, error, status, count } = await supabase
    .from('articles')
    .select('id, title, slug, excerpt, category, published_at', page === 1 ? { count: 'exact' } : undefined)
    .eq('status', 'published')
    .contains('show_on_sites', [siteCode])
    .order('published_at', { ascending: false })
    .order('id', { ascending: true })
    .range(from, from + ARTICLES_PAGE_SIZE - 1)
  if (error) throw readProblem(`getPublishedArticlesForSite: articles query failed (status ${status})`, error)
  if (!data) throw new Error('getPublishedArticlesForSite: empty response')
  const articles = data as ArticleSummary[]
  if (page === 1) {
    if (typeof count !== 'number') throw new Error('getPublishedArticlesForSite: no total')
    return { articles, total: count }
  }
  if (articles.length === 0) throw readProblem('getPublishedArticlesForSite: empty page', { code: EMPTY_PAGE_CODE })
  return { articles, total: 0 }
}

// Cached for an hour per site and page (the key is the key parts plus both
// arguments), as the other public article reads are, so the /articles page
// does not wait on the database for every visit. A new article can take up
// to an hour to appear here (FINDINGS DU).
const ARTICLES_LIST_KEY = ['published-articles-for-site']
const cachedPublishedArticles = guardCachedRead(ARTICLES_LIST_KEY, (siteCode: 'ab' | 'et', page: number) =>
  unstable_cache(fetchPublishedArticlesForSite, ARTICLES_LIST_KEY, {
    revalidate: 3600,
    tags: ['articles', `articles-list:${siteCode}`],
  })(siteCode, page)
)

// One page of the published articles shown on the /articles page of one
// site, newest first, or null when there is no such page. The last page is
// worked out from page 1's total before page n is read, so a number above it
// never reaches the database. Any failure is thrown, so the page renders its
// error page with a 500.
export async function getPublishedArticlesForSite(siteCode: 'ab' | 'et', page: number): Promise<ArticlesPage | null> {
  const first = await cachedPublishedArticles(siteCode, 1)
  const total = first.total
  const totalPages = Math.max(1, Math.ceil(total / ARTICLES_PAGE_SIZE))
  if (page > totalPages) return null
  if (page === 1) return { articles: first.articles, total, totalPages }
  try {
    const { articles } = await cachedPublishedArticles(siteCode, page)
    return { articles, total, totalPages }
  } catch (error) {
    // The list became shorter than the cached total says: no such page now.
    if ((error as { code?: unknown }).code === EMPTY_PAGE_CODE) return null
    throw error
  }
}
