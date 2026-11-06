// app/api/roodber8/course-factory/fetch-article/route.ts
// Fetches a single article by wpId, contentId, or slug from Supabase
// Replaces Sanity GROQ fetch — Session 35

import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated, signedOutResponse } from '@/lib/admin-auth'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return signedOutResponse()
  }
  const id = req.nextUrl.searchParams.get('id')?.trim()
  if (!id) return NextResponse.json({ article: null, error: 'No ID provided' }, { status: 400 })

  const isContentId = id.startsWith('AB-')
  const isSlug      = !isContentId && !id.startsWith('wp-') && isNaN(Number(id))

  const supabase = getSupabase()
  const query = supabase
    .from('articles')
    .select('id, title, slug, excerpt, content_id, wp_id')

  const { data, error } = isContentId
    ? await query.eq('content_id', id).maybeSingle()
    : isSlug
    ? await query.eq('slug', id).maybeSingle()
    : await query.eq('wp_id', id).maybeSingle()

  if (error) {
    return NextResponse.json({ article: null, error: error.message }, { status: 500 })
  }

  // Return in same shape as Sanity version so course factory UI needs no changes
  const article = data ? {
    _id:       data.id,
    title:     data.title,
    slug:      data.slug,
    excerpt:   data.excerpt,
    contentId: data.content_id,
    wpId:      data.wp_id,
  } : null

  return NextResponse.json({ article })
}
