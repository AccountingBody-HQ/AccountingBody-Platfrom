import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated, signedOutResponse } from '@/lib/admin-auth'
import { getServerSupabase } from '@/lib/supabase-server'
import { checkRead } from '@/lib/db-check'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated(req)))
    return signedOutResponse()

  const supabase = getServerSupabase('admin')

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
    return signedOutResponse()

  const body: unknown = await req.json()
  const { label, url, category } = (body ?? {}) as { label?: string; url?: string; category?: string }

  if (!label || !label.trim() || !url || !url.trim())
    return NextResponse.json({ error: 'label and url are required' }, { status: 400 })
  if (!url.trim().toLowerCase().startsWith('http'))
    return NextResponse.json({ error: 'url must start with http' }, { status: 400 })

  const supabase = getServerSupabase('admin')

  // The count sets the new reference's position, so nothing is added unless it was read.
  const counted = checkRead(
    await supabase
      .from('studio_references')
      .select('*', { count: 'exact', head: true }),
    'studio references count',
  )
  if (!counted.ok)
    return NextResponse.json({ error: 'Could not work out the next position. Nothing was added.' }, { status: 500 })

  const { data, error } = await supabase
    .from('studio_references')
    .insert({
      label: label.trim(),
      url: url.trim(),
      category: category?.trim() || 'news',
      display_order: counted.count ?? 0,
    })
    .select('id, label, url, category, display_order')
    .single()

  if (error || !data)
    return NextResponse.json({ error: 'Failed to create reference' }, { status: 500 })

  return NextResponse.json({ reference: data })
}

export async function DELETE(req: NextRequest) {
  if (!(await isAuthenticated(req)))
    return signedOutResponse()

  const id = req.nextUrl.searchParams.get('id')
  if (!id)
    return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const supabase = getServerSupabase('admin')

  const { error } = await supabase
    .from('studio_references')
    .delete()
    .eq('id', id)

  if (error)
    return NextResponse.json({ error: 'Failed to delete reference' }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
