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
    .eq('active', true)
    .order('display_order', { ascending: true })

  if (error)
    return NextResponse.json({ error: 'Failed to fetch references' }, { status: 500 })

  return NextResponse.json({ references: data ?? [] })
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
      active: true,
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
