import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 30

async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return false
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const expected = await sha256Hex(secret)
  return token === expected
}

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

// Only these keys may be written via PATCH — everything else is silently dropped
const ALLOWED_FIELDS = [
  'title', 'slug', 'content', 'excerpt', 'category', 'category_title',
  'exam_body', 'show_on_sites', 'featured_image_url', 'seo_title',
  'seo_description', 'mcq_url', 'read_time', 'author_name',
  'last_reviewed', 'status', 'canonical_owner', 'ai_summary',
  'ai_key_terms', 'ai_searchable', 'eticpa_level', 'eticpa_module',
  'eticpa_topic', 'content_type', 'difficulty',
]

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

type RouteParams = { params: Promise<{ articleId: string }> }

// ── GET /api/roodber8/articles/[articleId]
// Load one article for the editor.
export async function GET(req: NextRequest, { params }: RouteParams) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { articleId } = await params
  const supabase = getClient()

  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('id', articleId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }

  return NextResponse.json({ article: data })
}

// ── PATCH /api/roodber8/articles/[articleId]
// body: { fields: Record<string, unknown> } — field-whitelisted update.
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { articleId } = await params
  const body: unknown = await req.json()
  const fields = isRecord(body) ? body.fields : undefined

  if (!isRecord(fields)) {
    return NextResponse.json({ error: 'fields object is required' }, { status: 400 })
  }

  const sanitised: Record<string, unknown> = {}
  for (const key of ALLOWED_FIELDS) {
    if (key in fields) sanitised[key] = fields[key]
  }
  sanitised.updated_at = new Date().toISOString()

  const supabase = getClient()
  const { error } = await supabase
    .from('articles')
    .update(sanitised)
    .eq('id', articleId)
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// ── DELETE /api/roodber8/articles/[articleId]
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { articleId } = await params
  const supabase = getClient()

  const { error } = await supabase
    .from('articles')
    .delete()
    .eq('id', articleId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
