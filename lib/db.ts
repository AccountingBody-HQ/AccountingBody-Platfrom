import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export interface ArticleSummary {
  id:             string
  title:          string
  slug:           string
  excerpt?:       string
  category?:      string
  category_title?: string
  exam_body?:     string[]
  read_time?:     number
  published_at?:  string
  author_name?:   string
}

export interface ArticleFull extends ArticleSummary {
  content:          string
  seo_title?:       string
  seo_description?: string
  mcq_url?:         string
  last_reviewed?:   string
  canonical_owner?: string
  show_on_sites?:   string[]
  wp_id?:           string
  content_id?:      string
}

export interface QuestionSet {
  id:               string
  title:            string
  slug:             string
  excerpt?:         string
  difficulty?:      string
  topic?:           string
  exam_body?:       string[]
  question_type?:   string
  article_slug?:    string
  seo_title?:       string
  seo_description?: string
  published_at?:    string
  question_count?:  number
}

export interface Question {
  id:                   string
  set_id:               string
  question_order:       number
  type:                 string
  question_text:        string
  option_a:             string
  option_b:             string
  option_c:             string
  option_d:             string
  correct_index:        number
  explanation?:         string
  writing_model_answer?: string
  writing_explanation?: string
  case_id?:             string
  primary_topic?:       string
  difficulty?:          string
  time_target_minutes?: number
  points?:              number
}

// ── Articles ──────────────────────────────────────────────────────────────────

export async function getArticleBySlug(slug: string): Promise<ArticleFull | null> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()
  if (error || !data) return null
  return data as ArticleFull
}

export async function getArticlesByCategory(categorySlug: string): Promise<ArticleSummary[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('id, title, slug, excerpt, category, category_title, exam_body, read_time, published_at, author_name')
    .eq('category', categorySlug)
    .eq('status', 'published')
    .contains('show_on_sites', ['ab'])
    .order('title', { ascending: true })
  if (error || !data) return []
  return data as ArticleSummary[]
}

export async function getAllArticleSlugs(): Promise<string[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('slug')
    .eq('status', 'published')
  if (error || !data) return []
  return data.map((r: { slug: string }) => r.slug)
}

export async function getCategoryCounts(): Promise<Record<string, number>> {
  const categories = [
    'financial-accounting', 'financial-management', 'management-accounting',
    'financial-market', 'business-management', 'audit-assurance',
    'taxation', 'economics', 'cryptocurrency', 'tools-templates',
  ]
  const counts: Record<string, number> = {}
  for (const cat of categories) {
    const { count } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('category', cat)
      .eq('status', 'published')
    counts[cat] = count ?? 0
  }
  return counts
}

export async function searchArticles(query: string): Promise<ArticleSummary[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('id, title, slug, excerpt, category, category_title, exam_body, published_at')
    .eq('status', 'published')
    .or(`title.ilike.%${query}%,excerpt.ilike.%${query}%`)
    .order('published_at', { ascending: false })
    .limit(50)
  if (error || !data) return []
  return data as ArticleSummary[]
}

// ── Question Sets ─────────────────────────────────────────────────────────────

export async function getQuestionSetBySlug(slug: string): Promise<QuestionSet | null> {
  const { data, error } = await supabase
    .from('question_sets')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()
  if (error || !data) return null
  return data as QuestionSet
}

export async function getQuestionsBySetId(setId: string): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('set_id', setId)
    .order('question_order', { ascending: true })
  if (error || !data) return []
  return data as Question[]
}

export async function getQuestionSets(params: {
  difficulty?: string
  search?: string
  category?: string
  page?: number
  perPage?: number
  sortBy?: string
}): Promise<{ sets: QuestionSet[]; total: number }> {
  const { difficulty, search, page = 1, perPage = 12, sortBy = 'alpha' } = params
  const start = (page - 1) * perPage
  const end   = start + perPage - 1

  let query = supabase
    .from('question_sets')
    .select('id, title, slug, excerpt, difficulty, topic, exam_body, question_type, published_at', { count: 'exact' })
    .eq('status', 'published')
    .contains('show_on_sites', ['ab'])

  if (difficulty) query = query.eq('difficulty', difficulty)
  if (search)     query = query.ilike('title', `%${search}%`)
  if (sortBy === 'newest') {
    query = query.order('published_at', { ascending: false })
  } else {
    query = query.order('title', { ascending: true })
  }

  query = query.range(start, end)

  const { data, error, count } = await query
  if (error || !data) return { sets: [], total: 0 }
  return { sets: data as QuestionSet[], total: count ?? 0 }
}

export async function getQuestionSetCount(): Promise<number> {
  const { count } = await supabase
    .from('question_sets')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published')
    .contains('show_on_sites', ['ab'])
  return count ?? 0
}
