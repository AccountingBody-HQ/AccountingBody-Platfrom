import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SECRET_KEY
    if (!supabaseUrl || !supabaseKey) return NextResponse.json({ categories: [] })

    const { searchParams } = new URL(req.url)
    const platform = searchParams.get('platform') ?? 'ab'

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data, error } = await supabase
      .from('articles')
      .select('category, category_title')
      .eq('status', 'published')
      .eq('platform', platform)
      .not('category', 'is', null)
      .neq('category', '')
      .limit(5000)

    if (error || !data) return NextResponse.json({ categories: [] })

    const seen = new Map<string, string>()
    for (const row of data as { category: string; category_title: string | null }[]) {
      if (!seen.has(row.category)) {
        seen.set(row.category, row.category_title || row.category)
      }
    }
    const categories = Array.from(seen, ([slug, title]) => ({ slug, title }))
      .sort((a, b) => a.title.localeCompare(b.title))

    return NextResponse.json({ categories })
  } catch {
    return NextResponse.json({ categories: [] })
  }
}
