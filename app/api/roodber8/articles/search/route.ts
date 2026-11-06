// app/api/roodber8/articles/search/route.ts
// Admin-only article search, used by the Course Editor's article picker.

import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/admin-auth'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated(req)))
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q) return NextResponse.json({ articles: [] })

  const safeQ = q.replace(/[,()%]/g, '')
  if (!safeQ) return NextResponse.json({ articles: [] })

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )

    const { data, error } = await supabase
      .from('articles')
      .select('id, title, slug, excerpt, category_title, read_time')
      .ilike('title', `%${safeQ}%`)
      .order('title', { ascending: true })
      .limit(8)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ articles: data ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
