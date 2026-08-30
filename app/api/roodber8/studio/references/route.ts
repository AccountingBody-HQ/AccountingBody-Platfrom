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

  const { data, error } = await supabase
    .from('studio_references')
    .select('id, label, url, category, display_order')
    .order('display_order', { ascending: true })

  if (error)
    return NextResponse.json({ error: 'Failed to fetch references' }, { status: 500 })

  if ((data ?? []).length > 0)
    return NextResponse.json({ references: data })

  // Table is empty — seed default reference sources
  const defaults = [
    { label: 'BBC Business',          url: 'https://www.bbc.com/news/business',                                              category: 'news',         display_order: 1 },
    { label: 'Bloomberg',             url: 'https://www.bloomberg.com/business',                                             category: 'news',         display_order: 2 },
    { label: 'The Economist',         url: 'https://www.economist.com/finance-and-economics',                                category: 'news',         display_order: 3 },
    { label: 'Financial Times',       url: 'https://www.ft.com',                                                             category: 'news',         display_order: 4 },
    { label: 'ACCA Global',           url: 'https://www.accaglobal.com/gb/en/member/member/accounting-business/2025.html',   category: 'professional', display_order: 5 },
    { label: 'ICAEW Insights',        url: 'https://www.icaew.com/insights',                                                 category: 'professional', display_order: 6 },
    { label: 'CIMA',                  url: 'https://www.cimaglobal.com/News/',                                               category: 'professional', display_order: 7 },
    { label: 'Harvard Business Review', url: 'https://hbr.org/topic/finance',                                               category: 'academic',     display_order: 8 },
    { label: 'McKinsey Insights',     url: 'https://www.mckinsey.com/featured-insights',                                     category: 'academic',     display_order: 9 },
  ]

  const { data: seeded, error: seedError } = await supabase
    .from('studio_references')
    .insert(defaults)
    .select('id, label, url, category, display_order')

  if (seedError)
    return NextResponse.json({ references: [] })

  return NextResponse.json({ references: seeded ?? [] })
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req)))
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body: unknown = await req.json()
  const { label, url, category } = (body ?? {}) as { label?: string; url?: string; category?: string }

  if (!label || !label.trim() || !url || !url.trim())
    return NextResponse.json({ error: 'label and url are required' }, { status: 400 })
  if (!url.trim().toLowerCase().startsWith('http'))
    return NextResponse.json({ error: 'url must start with http' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { count } = await supabase
    .from('studio_references')
    .select('*', { count: 'exact', head: true })

  const { data, error } = await supabase
    .from('studio_references')
    .insert({
      label: label.trim(),
      url: url.trim(),
      category: category?.trim() || 'news',
      display_order: count ?? 0,
    })
    .select('id, label, url, category, display_order')
    .single()

  if (error || !data)
    return NextResponse.json({ error: 'Failed to create reference' }, { status: 500 })

  return NextResponse.json({ reference: data })
}

export async function DELETE(req: NextRequest) {
  if (!(await isAuthenticated(req)))
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id)
    return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { error } = await supabase
    .from('studio_references')
    .delete()
    .eq('id', id)

  if (error)
    return NextResponse.json({ error: 'Failed to delete reference' }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
