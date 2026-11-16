import { unstable_cache } from 'next/cache'
import { getServerSupabase } from '@/lib/supabase-server'
import { reportServerError } from '@/lib/report-error'
import { guardCachedRead } from '@/lib/cache-guard'

export interface FeaturedArticle {
  id:              string
  title:           string
  slug:            string
  excerpt?:        string
  category?:       string
  category_title?: string
  exam_body?:      string[]
  read_time?:      number
  published_at?:   string
}

// Same small rule as readProblem in lib/db.ts (private there): a real Error
// with fixed text and the database's short code only.
function readProblem(message: string, error: { code?: unknown }): Error & { code?: string } {
  const failed = new Error(message) as Error & { code?: string }
  if (typeof error.code === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(error.code)) failed.code = error.code
  return failed
}

// The query itself. A failure throws, so unstable_cache stores nothing; a
// genuine empty result is an empty list and is stored like any other answer.
async function fetchFeaturedArticles(siteCode: 'ab' | 'et'): Promise<FeaturedArticle[]> {
  const supabase = getServerSupabase('publicRead')
  const { data, error, status } = await supabase
    .from('articles')
    .select('id, title, slug, excerpt, category, category_title, exam_body, read_time, published_at')
    .eq('status', 'published')
    .contains('show_on_sites', [siteCode])
    .order('published_at', { ascending: false })
    .limit(4)
  if (error) throw readProblem(`getFeaturedArticlesForSite: articles query failed (status ${status})`, error)
  if (!data) return []
  return data as FeaturedArticle[]
}

// Cached for an hour per site, as the other public article reads are, so the
// home page does not wait on the database for every visit. A new article can
// take up to an hour to appear here (FINDINGS DU).
const FEATURED_KEY = ['featured-articles', 'published']
const cachedFeaturedArticles = guardCachedRead(FEATURED_KEY, (siteCode: 'ab' | 'et') =>
  unstable_cache(fetchFeaturedArticles, FEATURED_KEY, {
    revalidate: 3600,
    tags: ['articles', `featured-articles:${siteCode}`],
  })(siteCode)
)

// The four newest published articles shown on the home page of one site.
// The home page must keep rendering, so a failed read is reported with a
// fixed label and answers an empty list; it is never thrown. A genuine empty
// result is not a failure and is not reported.
export async function getFeaturedArticlesForSite(siteCode: 'ab' | 'et'): Promise<FeaturedArticle[]> {
  try {
    return await cachedFeaturedArticles(siteCode)
  } catch (error) {
    reportServerError('home featured articles read failed', error, { area: 'public' })
    return []
  }
}
