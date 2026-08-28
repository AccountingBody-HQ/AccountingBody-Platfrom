// app/api/roodber8/articles/search/route.ts
// Admin-only article search, used by the Course Editor's article picker.

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
