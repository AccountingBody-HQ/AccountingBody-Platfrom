import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return false
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const expected = await sha256Hex(secret)
  return token === expected
}

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated(req)))
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data: linkedSlugsData } = await supabase
    .from('question_sets')
    .select('article_slug')
    .not('article_slug', 'is', null)

  const linkedSlugs = new Set<string>(
    (linkedSlugsData ?? []).map(r => r.article_slug as string)
  )

  const { data: candidates, error } = await supabase
    .from('articles')
    .select('id, title, slug, content_id, category, category_title, exam_body, difficulty, read_time, excerpt, content, created_at')
    .eq('status', 'published')
    .contains('show_on_sites', ['ab'])
    .order('read_time', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(40)

  if (error)
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 })

  const unlinked = (candidates ?? []).filter(a => a.slug && !linkedSlugs.has(a.slug))
  const selected = unlinked.slice(0, 4)

  const articles = selected.map(a => ({
    id: a.id,
    title: a.title,
    slug: a.slug,
    content_id: a.content_id,
    category: a.category,
    category_title: a.category_title,
    exam_body: a.exam_body,
    difficulty: a.difficulty,
    read_time: a.read_time,
    excerpt: a.excerpt,
    content_preview: (a.content ?? '').slice(0, 3000),
  }))

  return NextResponse.json({ articles })
}
