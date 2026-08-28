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
  created_at?:      string
  question_count?:  number
}

export interface Question {
  id:                   string
  set_id:               string
  question_order:       number
  type:                 string
  question_text:        string
  option_a:             string | null
  option_b:             string | null
  option_c:             string | null
  option_d:             string | null
  correct_index:        number | null
  explanation?:         string
  writing_model_answer?: string | null
  writing_explanation?: string | null
  case_id?:             string | null
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
    .contains('show_on_sites', ['ab'])
    .single()
  if (error || !data) return null
  return data as ArticleFull
}

const QUALIFICATION_SLUGS = ['acca', 'cima', 'aat', 'icaew', 'eticpa', 'eticpa-atq', 'eticpa-cpa']

export async function getArticlesByCategory(categorySlug: string): Promise<ArticleSummary[]> {
  const isQualification = QUALIFICATION_SLUGS.includes(categorySlug.toLowerCase())
  let query = supabase
    .from('articles')
    .select('id, title, slug, excerpt, category, category_title, exam_body, read_time, published_at, author_name')
    .eq('status', 'published')
    .contains('show_on_sites', ['ab'])
    .order('title', { ascending: true })

  if (isQualification) {
    query = query.contains('exam_body', [categorySlug.toLowerCase()])
  } else {
    query = query.eq('category', categorySlug)
  }

  const { data, error } = await query.limit(3000)
  if (error || !data) return []
  return data as ArticleSummary[]
}

export async function getAllArticleSlugs(): Promise<string[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('slug')
    .eq('status', 'published')
    .contains('show_on_sites', ['ab'])
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
      .contains('show_on_sites', ['ab'])
    counts[cat] = count ?? 0
  }
  return counts
}

export async function searchArticles(query: string): Promise<ArticleSummary[]> {
  const safeQuery = query.replace(/[,()]/g, '')
  if (!safeQuery) return []
  const { data, error } = await supabase
    .from('articles')
    .select('id, title, slug, excerpt, category, category_title, exam_body, published_at')
    .eq('status', 'published')
    .contains('show_on_sites', ['ab'])
    .or(`title.ilike.%${safeQuery}%,excerpt.ilike.%${safeQuery}%`)
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

export interface QuestionCase {
  id:           string
  set_id:       string
  case_id:      string
  title:        string
  exhibit_html: string
  created_at:   string
}

export async function getCasesBySetId(setId: string): Promise<QuestionCase[]> {
  const { data, error } = await supabase
    .from('question_cases')
    .select('*')
    .eq('set_id', setId)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data as QuestionCase[]
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

export async function getETICPAModuleArticles(level: string, module: string): Promise<ArticleSummary[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('id, title, slug, excerpt, category, category_title, exam_body, read_time, published_at, author_name')
    .eq('status', 'published')
    .eq('eticpa_level', level)
    .eq('eticpa_module', module)
    .order('title', { ascending: true })
    .limit(5000)
  if (error || !data) return []
  return data as ArticleSummary[]
}

// ── Admin: Question Sets (roodber8) ─────────────────────────────────────────

export async function getAllQuestionSetsForAdmin(): Promise<QuestionSet[]> {
  const { data: setsData, error: setsError } = await supabase
    .from('question_sets')
    .select('id, title, slug, difficulty, topic, exam_body, question_type, created_at')
    .order('created_at', { ascending: false })

  if (setsError || !setsData) return []

  const setIds = (setsData as QuestionSet[]).map(s => s.id)
  const countsBySetId = new Map<string, number>()

  if (setIds.length > 0) {
    const { data: questionsData, error: questionsError } = await supabase
      .from('questions')
      .select('id, set_id')
      .in('set_id', setIds)

    if (questionsError) return []

    for (const q of (questionsData as { id: string; set_id: string }[] | null) ?? []) {
      countsBySetId.set(q.set_id, (countsBySetId.get(q.set_id) ?? 0) + 1)
    }
  }

  return (setsData as QuestionSet[]).map(s => ({
    ...s,
    question_count: countsBySetId.get(s.id) ?? 0,
  }))
}
