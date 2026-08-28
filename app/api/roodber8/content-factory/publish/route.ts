/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { marked } from 'marked'

export const runtime = 'nodejs'
export const maxDuration = 60

const CONTENT_TYPE_MAP: Record<string, string> = {
  'Study Note':                 'article',
  'Article':                    'article',
  'Exam Technique Guide':       'guide',
  'Practice Question Explainer':'article',
  'Subject Overview':           'guide',
}

const DIFFICULTY_MAP: Record<string, string> = {
  Foundation: 'beginner', Intermediate: 'intermediate', Advanced: 'advanced'
}

// UI sends full site names; Supabase's show_on_sites/platform columns use short codes (only 'ab' has prior precedent)
const SITE_CODE_MAP: Record<string, string> = {
  accountingbody: 'ab',
  hrlake:         'hr',
  ethiotax:       'et',
}

marked.setOptions({
  gfm:    true,
  breaks: false,
})

function markdownToHtml(markdown: string): string {
  return marked.parse(markdown, { async: false })
}

function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 200)
}

function extractTitle(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : fallback
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { content, topic, subject, qualification, contentType, difficulty, aiSummary, keyTerms, showOnSites, canonicalOwner, categoryId, categoryTitle, eticpaTopic } = body

    if (!content || !qualification || !contentType || !canonicalOwner || !showOnSites?.length) {
      return NextResponse.json({ error: 'content, qualification, contentType, canonicalOwner and showOnSites are required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SECRET_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase environment variables are not set' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const title = extractTitle(content, topic)
    const slug  = generateSlug(title)
    const html  = markdownToHtml(content)
    const now   = new Date().toISOString()

    const EXAM_BODY_MAP: Record<string, string[]> = {
      'ACCA':         ['acca'],
      'CIMA':         ['cima'],
      'ICAEW':        ['icaew'],
      'AAT':          ['aat'],
      'ETICPA / CPA': ['eticpa-cpa'],
      'ETICPA / ATQ': ['eticpa-atq'],
    }
    const examBody = EXAM_BODY_MAP[qualification] ?? ['acca', 'cima', 'icaew', 'aat']

    // Auto-derive ETICPA level and module from subject
    const ETICPA_SUBJECT_MAP: Record<string, { level: string; module: string }> = {
      'Introduction to Accounting (Level 1)':         { level: 'level-1', module: 'introduction-to-accounting' },
      'Cost Accounting (Level 1)':                    { level: 'level-1', module: 'cost-accounting' },
      'Business Skills (Level 1)':                    { level: 'level-1', module: 'business-skills' },
      'Ethiopian Business Law (Level 1)':             { level: 'level-1', module: 'ethiopian-business-law' },
      'Financial Accounting (Level 2)':               { level: 'level-2', module: 'financial-accounting' },
      'Management Accounting (Level 2)':              { level: 'level-2', module: 'management-accounting' },
      'Assurance Controls and Ethics (Level 2)':      { level: 'level-2', module: 'assurance-controls-ethics' },
      'Ethiopian Taxation (Level 2)':                 { level: 'level-2', module: 'ethiopian-taxation' },
      'Ethiopian Public Sector Accounting (Level 2)': { level: 'level-2', module: 'ethiopian-public-sector-accounting' },
    }
    const eticpaMapping = qualification === 'ETICPA / ATQ' ? ETICPA_SUBJECT_MAP[subject] ?? null : null
    const mappedType  = CONTENT_TYPE_MAP[contentType] ?? 'article'
    const mappedDiff  = DIFFICULTY_MAP[difficulty] ?? 'intermediate'
    const keyTermsArr = keyTerms ? keyTerms.split(',').map((t: string) => t.trim()).filter(Boolean) : []

    const showOnSitesCodes = (showOnSites as string[]).map(s => SITE_CODE_MAP[s] ?? s)
    const platform = SITE_CODE_MAP[canonicalOwner] ?? canonicalOwner

    // Content ID — query highest existing AB-ART-XXXXX and increment
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

    const row: any = {
      title,
      slug,
      content:          html,
      excerpt:          aiSummary ?? '',
      category:         categoryId ?? null,
      category_title:   categoryTitle ?? null,
      exam_body:        examBody,
      show_on_sites:    showOnSitesCodes,
      canonical_owner:  canonicalOwner,
      seo_title:        title.length <= 60 ? title : title.slice(0, 60).replace(/\s+\S*$/, '...'),
      seo_description:  (aiSummary ?? '').length <= 160 ? (aiSummary ?? '') : (aiSummary ?? '').slice(0, 160).replace(/\s+\S*$/, '...'),
      status:           'published',
      platform,
      content_id:       contentId,
      author_name:      'accountingbody.com',
      published_at:     now,
      content_type:     mappedType,
      difficulty:       mappedDiff,
      ai_summary:       aiSummary ?? '',
      ai_key_terms:     keyTermsArr,
      ai_searchable:    true,
      ...(eticpaMapping ? {
        eticpa_level:  eticpaMapping.level,
        eticpa_module: eticpaMapping.module,
        eticpa_topic:  eticpaTopic ?? topic ?? '',
      } : {}),
    }

    const { data: inserted, error } = await supabase
      .from('articles')
      .insert(row)
      .select('id')
      .single()

    if (error || !inserted) {
      console.error('content-factory/publish insert error:', error)
      return NextResponse.json({ error: error?.message ?? 'Failed to insert article' }, { status: 500 })
    }

    return NextResponse.json({
      success:        true,
      documentId:     inserted.id,
      contentId,
      title,
      slug,
      showOnSites,
      canonicalOwner,
    })

  } catch (err: any) {
    console.error('content-factory/publish error:', err)
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}
