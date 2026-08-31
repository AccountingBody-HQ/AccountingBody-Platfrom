import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>()
function checkRateLimit(ip: string): boolean {
  const now   = Date.now()
  const entry = rateLimitStore.get(ip)
  if (!entry || entry.resetTime < now) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + 60_000 })
    return true
  }
  if (entry.count >= 30) return false
  entry.count++
  return true
}

// Strip characters that are special in PostgREST filter syntax.
// Commas delimit .or() expressions; ( ) . % have syntactic meaning.
// Stripping them from word tokens prevents filter string corruption.
function sanitiseWord(w: string): string {
  return w.replace(/[,().%]/g, '').trim()
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (q.trim().length < 2) {
    return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
  }

  // Sanitise the raw query: lowercase, strip PostgREST special chars,
  // split into individual words, deduplicate, drop empty/single-char tokens.
  const rawSearch = q.trim().toLowerCase()
  const words = Array.from(
    new Set(
      rawSearch
        .split(/\s+/)
        .map(sanitiseWord)
        .filter(w => w.length >= 2)
    )
  )

  // If sanitising stripped everything (e.g. query was only punctuation),
  // return empty rather than sending a malformed or unbounded query.
  if (words.length === 0) {
    return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
  }

  // Build article query.
  // Strategy: chain one .or() per word so ALL words must appear somewhere
  // in title OR excerpt. Each chained .or() is ANDed with the others by
  // Supabase/PostgREST. Each word token is already sanitised so no
  // PostgREST-special characters appear inside the ilike pattern.
  // Fetch 100 candidates so relevance re-ranking has a wide pool —
  // ordering by date before ranking would bury older relevant articles.
  const supabase = getSupabase()
  let articleQuery = supabase
    .from('articles')
    .select('id, title, slug, excerpt, category, exam_body, published_at, created_at')
    .eq('status', 'published')

  for (const word of words) {
    articleQuery = articleQuery.or(
      `title.ilike.%${word}%,excerpt.ilike.%${word}%`
    )
  }
  articleQuery = articleQuery.limit(100)

  // Build PQ query — title match only.
  let pqQuery = supabase
    .from('question_sets')
    .select('id, title, slug, excerpt, difficulty, published_at')
    .eq('status', 'published')

  for (const word of words) {
    pqQuery = pqQuery.ilike('title', `%${word}%`)
  }
  pqQuery = pqQuery
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(20)

  const [articleResults, pqResults] = await Promise.all([
    articleQuery,
    pqQuery,
  ])

  // Relevance scoring — multi-tier (higher = more relevant).
  // Uses sanitised words for word-level checks.
  // Uses rawSearch for exact-phrase check — rawSearch has punctuation
  // stripped only of PostgREST specials; the title/excerpt comparison
  // is done on lowercased strings so minor punctuation differences
  // (parentheses already stripped from rawSearch) won't prevent a match.
  const rawSearchSanitised = sanitiseWord(rawSearch.replace(/\s+/g, ' '))

  function scoreText(title: string, excerpt: string): number {
    const t = title.toLowerCase().replace(/[,().%]/g, '')
    const e = (excerpt ?? '').toLowerCase().replace(/[,().%]/g, '')
    const s = rawSearchSanitised
    // Tier 4: sanitised full phrase appears in sanitised title
    if (t.includes(s)) return 4
    // Tier 3: all sanitised words appear in sanitised title
    if (words.every(w => t.includes(w))) return 3
    // Tier 2: sanitised full phrase appears in sanitised excerpt
    if (e.includes(s)) return 2
    // Tier 1: all sanitised words appear in sanitised excerpt
    if (words.every(w => e.includes(w))) return 1
    return 0
  }

  function scorePQ(title: string): number {
    const t = title.toLowerCase().replace(/[,().%]/g, '')
    const s = rawSearchSanitised
    if (t.includes(s)) return 4
    if (words.every(w => t.includes(w))) return 3
    return 1
  }

  const articles = (articleResults.data ?? []).map(a => ({
    _id:         a.id,
    _type:       'article' as const,
    title:       a.title,
    slug:        a.slug,
    excerpt:     a.excerpt,
    category:    a.category,
    examBody:    a.exam_body,
    publishedAt: a.published_at ?? a.created_at,
    _score:      scoreText(a.title ?? '', a.excerpt ?? ''),
  }))

  const pqs = (pqResults.data ?? []).map(p => ({
    _id:         p.id,
    _type:       'practicePost' as const,
    title:       p.title,
    slug:        p.slug,
    excerpt:     p.excerpt,
    publishedAt: p.published_at,
    _score:      scorePQ(p.title ?? ''),
  }))

  // Sort by score descending.
  // Tie-break: articles before PQs (study content takes priority).
  const combined = [...articles, ...pqs]
  combined.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score
    if (a._type !== b._type) return a._type === 'article' ? -1 : 1
    return 0
  })

  // Remove internal scoring field before returning.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const results = combined.map(({ _score, ...r }) => r)

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
