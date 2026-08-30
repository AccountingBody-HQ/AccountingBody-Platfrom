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

  const isEt = req.headers.get('x-et-platform') === 'ethiotax'
  const siteCode = isEt ? 'et' : 'ab'

  const [articleResults, pqResults] = await Promise.all([
    supabase
      .from('articles')
      .select('id, title, slug, excerpt, category, exam_body, published_at, created_at')
      .eq('status', 'published')
      .contains('show_on_sites', [siteCode])
      .or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(40),
    supabase
      .from('question_sets')
      .select('id, title, slug, excerpt, difficulty, published_at')
      .eq('status', 'published')
      .contains('show_on_sites', [siteCode])
      .ilike('title', `%${search}%`)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(20),
  ])

  const articles = (articleResults.data ?? []).map(a => ({
    _id:        a.id,
    _type:      'article' as const,
    title:      a.title,
    slug:       a.slug,
    excerpt:    a.excerpt,
    category:   a.category,
    examBody:   a.exam_body,
    publishedAt: a.published_at ?? a.created_at,
  }))

  const pqs = (pqResults.data ?? []).map(p => ({
    _id:        p.id,
    _type:      'practicePost' as const,
    title:      p.title,
    slug:       p.slug,
    excerpt:    p.excerpt,
    publishedAt: p.published_at,
  }))

  const results = [...articles, ...pqs].sort((a, b) => {
    const scoreA = a.title?.toLowerCase().includes(search) ? 2 : 1
    const scoreB = b.title?.toLowerCase().includes(search) ? 2 : 1
    return scoreB - scoreA
  })

  return NextResponse.json(results)
}
