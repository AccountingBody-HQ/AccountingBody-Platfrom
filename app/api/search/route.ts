import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

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

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (q.trim().length < 2) return NextResponse.json([])

  const search = q.trim().toLowerCase()

  // Split query into meaningful words (≥2 chars, deduplicated)
  const words = Array.from(
    new Set(search.split(/\s+/).filter(w => w.length >= 2))
  )

  // Build article query: chain one .ilike per word so ALL words must
  // appear somewhere in title OR excerpt. Each chained .ilike is ANDed.
  // This correctly handles punctuation between words in the title.
  let articleQuery = supabase
    .from('articles')
    .select('id, title, slug, excerpt, category, exam_body, published_at, created_at')
    .eq('status', 'published')

  if (words.length === 1) {
    // Single word: standard OR across title and excerpt
    articleQuery = articleQuery.or(
      `title.ilike.%${words[0]}%,excerpt.ilike.%${words[0]}%`
    )
  } else {
    // Multiple words: each word must appear in title OR excerpt.
    // Chain .or() calls — each is ANDed with the others.
    for (const word of words) {
      articleQuery = articleQuery.or(
        `title.ilike.%${word}%,excerpt.ilike.%${word}%`
      )
    }
  }

  // Fetch more than the display limit so relevance re-ranking has
  // enough candidates. 100 gives good coverage without excessive load.
  articleQuery = articleQuery.limit(100)

  // PQ query: title match only (excerpts are auto-generated and less useful)
  let pqQuery = supabase
    .from('question_sets')
    .select('id, title, slug, excerpt, difficulty, published_at')
    .eq('status', 'published')

  if (words.length === 1) {
    pqQuery = pqQuery.ilike('title', `%${words[0]}%`)
  } else {
    for (const word of words) {
      pqQuery = pqQuery.ilike('title', `%${word}%`)
    }
  }
  pqQuery = pqQuery
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(20)

  const [articleResults, pqResults] = await Promise.all([
    articleQuery,
    pqQuery,
  ])

  // Relevance scoring — multi-tier:
  // 4: exact full phrase match in title
  // 3: all query words appear in title
  // 2: exact full phrase match in excerpt
  // 1: all query words appear in excerpt
  // 0: fallback (shouldn't reach given filter above)
  function scoreArticle(title: string, excerpt: string): number {
    const t = title.toLowerCase()
    const e = (excerpt ?? '').toLowerCase()
    if (t.includes(search)) return 4
    if (words.every(w => t.includes(w))) return 3
    if (e.includes(search)) return 2
    if (words.every(w => e.includes(w))) return 1
    return 0
  }

  function scorePQ(title: string): number {
    const t = title.toLowerCase()
    if (t.includes(search)) return 4
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
    _score:      scoreArticle(a.title ?? '', a.excerpt ?? ''),
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

  // Sort by score descending; within same score, articles before PQs
  const combined = [...articles, ...pqs]
  combined.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score
    // Tie-break: articles before PQs, then by date
    if (a._type !== b._type) return a._type === 'article' ? -1 : 1
    return 0
  })

  // Strip internal _score before returning
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const results = combined.map(({ _score, ...r }) => r)

  return NextResponse.json(results)
}
