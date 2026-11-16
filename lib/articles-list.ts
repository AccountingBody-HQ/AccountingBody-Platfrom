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

async function fetchPublishedArticlesForSite(siteCode: 'ab' | 'et'): Promise<ArticleSummary[]> {
  const supabase = getServerSupabase('publicRead')
  const { data, error, status } = await supabase
    .from('articles')
    .select('id, title, slug, excerpt, category, published_at')
    .eq('status', 'published')
    .contains('show_on_sites', [siteCode])
    .order('published_at', { ascending: false })
    .limit(100)
  if (error) throw readProblem(`getPublishedArticlesForSite: articles query failed (status ${status})`, error)
  if (!data) return []
  return data as ArticleSummary[]
}

// Cached for an hour per site, as the other public article reads are, so the
// /articles page does not wait on the database for every visit. A new article
// can take up to an hour to appear here (FINDINGS DU).
const ARTICLES_LIST_KEY = ['published-articles-for-site']
const cachedPublishedArticles = guardCachedRead(ARTICLES_LIST_KEY, (siteCode: 'ab' | 'et') =>
  unstable_cache(fetchPublishedArticlesForSite, ARTICLES_LIST_KEY, {
    revalidate: 3600,
    tags: ['articles', `articles-list:${siteCode}`],
  })(siteCode)
)

// The published articles shown on the /articles page of one site, newest
// first. Returns an empty list only for a genuine empty result; any failure
// is thrown, so the page renders its error page with a 500.
export async function getPublishedArticlesForSite(siteCode: 'ab' | 'et'): Promise<ArticleSummary[]> {
  return cachedPublishedArticles(siteCode)
}
