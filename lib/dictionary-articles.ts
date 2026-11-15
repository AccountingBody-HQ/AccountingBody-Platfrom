import { getServerSupabase } from '@/lib/supabase-server'

export interface DictionaryArticle {
  id:              string
  title:           string
  slug:            string
  excerpt?:        string
  category?:       string
  category_title?: string
  published_at?:   string
}

// Same small rule as readProblem in lib/db.ts (private there): a real Error
// with fixed text and the database's short code only.
function readProblem(message: string, error: { code?: unknown }): Error & { code?: string } {
  const failed = new Error(message) as Error & { code?: string }
  if (typeof error.code === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(error.code)) failed.code = error.code
  return failed
}

// The published dictionary terms whose title starts with one letter ('#'
// means a digit), A to Z. Returns an empty list only for a genuine empty
// result; any failure is thrown, so the page renders its error page with a 500.
export async function getDictionaryArticlesByLetter(letter: string): Promise<DictionaryArticle[]> {
  const supabase = getServerSupabase('publicRead')
  let query = supabase
    .from('articles')
    .select('id, title, slug, excerpt, category, category_title, published_at')
    .eq('status', 'published')
    .contains('show_on_sites', ['ab'])

  if (letter === '#') {
    const digitFilter = Array.from({ length: 10 }, (_, i) => `title.ilike.${i}%`).join(',')
    query = query.or(digitFilter)
  } else {
    const u = letter.toUpperCase()
    const next = String.fromCharCode(u.charCodeAt(0) + 1)
    query = query.gte('title', u).lt('title', next)
  }

  const { data, error, status } = await query.order('title', { ascending: true }).limit(5000)
  if (error) throw readProblem(`getDictionaryArticlesByLetter: articles query failed (status ${status})`, error)
  if (!data) return []
  return data as DictionaryArticle[]
}

// The published dictionary terms in one category, A to Z. Returns an empty
// list only for a genuine empty result; any failure is thrown, so the page
// renders its error page with a 500.
export async function getDictionaryArticlesByCategory(categorySlug: string): Promise<DictionaryArticle[]> {
  const supabase = getServerSupabase('publicRead')
  const { data, error, status } = await supabase
    .from('articles')
    .select('id, title, slug, excerpt, category, category_title, published_at')
    .eq('status', 'published')
    .contains('show_on_sites', ['ab'])
    .eq('category', categorySlug)
    .order('title', { ascending: true })
    .limit(5000)
  if (error) throw readProblem(`getDictionaryArticlesByCategory: articles query failed (status ${status})`, error)
  if (!data) return []
  return data as DictionaryArticle[]
}
