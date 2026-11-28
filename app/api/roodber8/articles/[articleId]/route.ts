import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated, signedOutResponse } from '@/lib/admin-auth'
import { getServerSupabase } from '@/lib/supabase-server'
import { DELETE_FAILED, errorCode, keepCopyBeforeDelete, snapshotArticle } from '@/lib/recycle-bin'
import { checkRead } from '@/lib/db-check'
import { refreshArticleCaches } from '@/lib/article-cache'
import { refreshCourseCaches } from '@/lib/course-cache'
import {
  NOTE_CHECK_FAILED,
  NOTE_DELETE_CHECK_FAILED,
  NOTE_HAS_SET,
  NOTE_SLUG_HAS_SET,
  NOTE_SLUG_LOCKED,
  isNoteAddressLocked,
  noteHasPracticeSet,
} from '@/lib/note-guards'

export const runtime = 'nodejs'
export const maxDuration = 30

function getClient() {
  return getServerSupabase('admin')
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

  // The note as it is now. A change of address needs it, so a failed read
  // stops that. Otherwise it only names the caches to refresh (the broad tag
  // covers every note).
  const before = checkRead(
    await supabase.from('articles').select('slug, status').eq('id', articleId).maybeSingle(),
    'articles/[articleId]: note before update',
  )
  const statusGiven = 'status' in sanitised
  if (!before.ok && 'slug' in sanitised)
    return NextResponse.json({ error: NOTE_CHECK_FAILED }, { status: 500 })
  if (before.ok && !before.data)
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  const old = before.ok ? before.data : null

  // A published note's address never changes, and nor does the address of a
  // note that a practice set links to (lib/note-guards.ts).
  if ('slug' in sanitised && old && sanitised.slug !== old.slug) {
    if (isNoteAddressLocked(old.status, sanitised.status, statusGiven))
      return NextResponse.json({ error: NOTE_SLUG_LOCKED }, { status: 400 })
    const hasSet = await noteHasPracticeSet(supabase, old.slug, 'articles/[articleId]: practice set before address change')
    if (hasSet === null) return NextResponse.json({ error: NOTE_CHECK_FAILED }, { status: 500 })
    if (hasSet) return NextResponse.json({ error: NOTE_SLUG_HAS_SET }, { status: 400 })
  }

  const { error } = await supabase
    .from('articles')
    .update(sanitised)
    .eq('id', articleId)
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // A change of status or sites can change the practice list and the linked
  // set's page as well.
  refreshArticleCaches({
    slugs: [old?.slug, typeof sanitised.slug === 'string' ? sanitised.slug : null],
    practiceSets: statusGiven || 'show_on_sites' in sanitised,
  })

  return NextResponse.json({ success: true })
}

// ── DELETE /api/roodber8/articles/[articleId]
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  if (!(await isAuthenticated(req))) {
    return signedOutResponse()
  }

  const { articleId } = await params
  const supabase = getClient()

  // A note that a practice set links to is never deleted: the set would point
  // at a missing note (lib/note-guards.ts). A failed check deletes nothing.
  const found = checkRead(
    await supabase.from('articles').select('slug').eq('id', articleId).maybeSingle(),
    'articles/[articleId]: note before delete',
  )
  if (!found.ok) return NextResponse.json({ error: NOTE_DELETE_CHECK_FAILED }, { status: 500 })
  if (!found.data) return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  const slug = found.data.slug as string | null
  if (slug) {
    const hasSet = await noteHasPracticeSet(supabase, slug, 'articles/[articleId]: practice set before delete')
    if (hasSet === null) return NextResponse.json({ error: NOTE_DELETE_CHECK_FAILED }, { status: 500 })
    if (hasSet) return NextResponse.json({ error: NOTE_HAS_SET }, { status: 409 })
  }

  // A copy of the article and its course links goes to the recycle bin first.
  const kept = await keepCopyBeforeDelete(supabase, await snapshotArticle(supabase, articleId), {
    kind: 'article',
    sourceTable: 'articles',
    sourceId: articleId,
    label: (row) => row.title,
    notFound: 'Article not found',
  })
  if (!kept.ok) return NextResponse.json({ error: kept.error }, { status: kept.status })

  const { error } = await supabase
    .from('articles')
    .delete()
    .eq('id', articleId)

  if (error) {
    console.error('articles DELETE failed', errorCode(error))
    return NextResponse.json({ error: DELETE_FAILED }, { status: 500 })
  }

  // Its course lesson links went with it, so the course pages are refreshed too.
  refreshArticleCaches({ slugs: [slug] })
  refreshCourseCaches()

  return NextResponse.json({ success: true, binId: kept.binId })
}
