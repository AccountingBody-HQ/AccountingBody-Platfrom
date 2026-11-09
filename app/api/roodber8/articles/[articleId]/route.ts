import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated, signedOutResponse } from '@/lib/admin-auth'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 30

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
    return signedOutResponse()
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
    return signedOutResponse()
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
    return signedOutResponse()
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
