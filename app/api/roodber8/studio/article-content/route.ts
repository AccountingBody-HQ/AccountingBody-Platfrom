import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated, signedOutResponse } from '@/lib/admin-auth'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated(req)))
    return signedOutResponse()

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
