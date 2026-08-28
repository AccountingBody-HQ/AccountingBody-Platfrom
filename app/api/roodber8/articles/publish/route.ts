import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SITE_CODE_MAP } from '@/lib/site-codes'
import type { NormalisedArticle } from '@/lib/article-normaliser'

export const runtime = 'nodejs'
export const maxDuration = 60

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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

// ── POST /api/roodber8/articles/publish
// Receives a pre-normalised NormalisedArticle (from the import preview step),
// generates content_id, applies SITE_CODE_MAP, and inserts one row into the
// Supabase articles table. Does NOT re-normalise.
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const bodyRaw: unknown = await req.json()
    const body = isRecord(bodyRaw) ? bodyRaw : {}

    if (!isRecord(body.article)) {
      return NextResponse.json({ error: 'article object is required' }, { status: 400 })
    }
    const articleInput = body.article as unknown as NormalisedArticle

    const title = typeof articleInput.title === 'string' ? articleInput.title.trim() : ''
    if (!title) {
      return NextResponse.json({ error: 'article.title is required' }, { status: 400 })
    }

    const content = typeof articleInput.content === 'string' ? articleInput.content.trim() : ''
    if (!content) {
      return NextResponse.json({ error: 'article.content is required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SECRET_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase environment variables are not set' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const showOnSites = Array.isArray(body.showOnSites)
      ? body.showOnSites.filter((s): s is string => typeof s === 'string')
      : ['accountingbody']
    const canonicalOwner = typeof body.canonicalOwner === 'string' ? body.canonicalOwner : 'accountingbody'

    const showOnSitesCodes = showOnSites.map(s => SITE_CODE_MAP[s] ?? s)
    const platform = SITE_CODE_MAP[canonicalOwner] ?? canonicalOwner

    // Query the highest existing AB-ART-XXXXX content_id and use the next one in sequence
    const { data: lastRow } = await supabase
      .from('articles')
      .select('content_id')
      .like('content_id', 'AB-ART-%')
      .order('content_id', { ascending: false })
      .limit(1)
      .maybeSingle()

    let nextNum = 1
    if (lastRow?.content_id) {
      const match = (lastRow.content_id as string).match(/AB-ART-(\d+)$/)
      if (match) nextNum = parseInt(match[1], 10) + 1
    }
    const contentId = 'AB-ART-' + String(nextNum).padStart(5, '0')

    // Trust the slug the normaliser already generated; only fall back if the
    // caller bypassed /import and posted an article without one.
    const providedSlug = typeof articleInput.slug === 'string' ? articleInput.slug.trim() : ''
    const fallbackSlug = title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 200)
    const initialSlug = providedSlug || fallbackSlug || 'untitled-article'

    const buildRow = (slug: string): Record<string, unknown> => {
      return {
        title,
        slug,
        content,
        excerpt:             articleInput.excerpt ?? null,
        category:            articleInput.category ?? null,
        category_title:      articleInput.category_title ?? null,
        exam_body:           articleInput.exam_body ?? null,
        show_on_sites:       showOnSitesCodes,
        featured_image_url:  articleInput.featured_image_url ?? null,
        seo_title:           articleInput.seo_title ?? null,
        seo_description:     articleInput.seo_description ?? null,
        mcq_url:             articleInput.mcq_url ?? null,
        read_time:           articleInput.read_time ?? null,
        author_name:         articleInput.author_name ?? null,
        last_reviewed:       articleInput.last_reviewed ?? null,
        status:              articleInput.status ?? null,
        platform,
        canonical_owner:     canonicalOwner,
        wp_id:               articleInput.wp_id ?? null,
        content_id:          contentId,
        ai_summary:          articleInput.ai_summary ?? null,
        ai_key_terms:        articleInput.ai_key_terms ?? null,
        ai_searchable:       articleInput.ai_searchable ?? null,
        eticpa_level:        articleInput.eticpa_level ?? null,
        eticpa_module:       articleInput.eticpa_module ?? null,
        eticpa_topic:        articleInput.eticpa_topic ?? null,
        content_type:        articleInput.content_type ?? null,
        difficulty:          articleInput.difficulty ?? null,
        published_at:        articleInput.published_at ?? new Date().toISOString(),
      }
    }

    let { data: inserted, error: insertError } = await supabase
      .from('articles')
      .insert(buildRow(initialSlug))
      .select('id, slug, content_id, title')
      .single()

    // Slug unique-constraint violation — retry once with a random suffix
    if (insertError && insertError.code === '23505' && insertError.message.includes('slug')) {
      const retrySlug = initialSlug + '-' + Math.random().toString(36).slice(2, 6)
      const retry = await supabase
        .from('articles')
        .insert(buildRow(retrySlug))
        .select('id, slug, content_id, title')
        .single()

      inserted = retry.data
      insertError = retry.error

      if (insertError) {
        return NextResponse.json(
          { error: 'Slug conflict — please set a unique slug manually' },
          { status: 409 }
        )
      }
    }

    if (insertError || !inserted) {
      console.error('articles/publish insert error:', insertError)
      return NextResponse.json({ error: insertError?.message ?? 'Failed to insert article' }, { status: 500 })
    }

    return NextResponse.json({
      success:    true,
      documentId: inserted.id,
      contentId:  inserted.content_id,
      title:      inserted.title,
      slug:       inserted.slug,
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
