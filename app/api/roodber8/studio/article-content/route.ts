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

  const id = req.nextUrl.searchParams.get('id')?.trim().toUpperCase()
  if (!id || !id.startsWith('AB-ART-'))
    return NextResponse.json({ error: 'Invalid Article ID' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data, error } = await supabase
    .from('articles')
    .select('title, content, category_title, exam_body, difficulty, excerpt, slug, content_id')
    .eq('content_id', id)
    .maybeSingle()

  if (error || !data)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ article: data })
}
