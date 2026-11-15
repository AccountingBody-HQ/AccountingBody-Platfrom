import { getServerSupabase } from '@/lib/supabase-server'
import { reportServerError } from '@/lib/report-error'

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

// The four newest published articles shown on the home page of one site.
// The home page must keep rendering, so a failed read is reported with a
// fixed label and answers an empty list; it is never thrown. A genuine empty
// result is not a failure and is not reported.
export async function getFeaturedArticlesForSite(siteCode: 'ab' | 'et'): Promise<FeaturedArticle[]> {
  try {
    const supabase = getServerSupabase('publicRead')
    const { data, error } = await supabase
      .from('articles')
      .select('id, title, slug, excerpt, category, category_title, exam_body, read_time, published_at')
      .eq('status', 'published')
      .contains('show_on_sites', [siteCode])
      .order('published_at', { ascending: false })
      .limit(4)
    if (error) {
      reportServerError('home featured articles read failed', error, { area: 'public' })
      return []
    }
    if (!data) return []
    return data as FeaturedArticle[]
  } catch (error) {
    reportServerError('home featured articles read failed', error, { area: 'public' })
    return []
  }
}
