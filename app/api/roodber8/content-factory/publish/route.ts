/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@sanity/client'

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

function makeKey() {
  return Math.random().toString(36).slice(2, 12)
}

function parseInline(text: string): any[] {
  const parts = text.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  const spanList: any[] = []
  for (const part of parts) {
    if (!part) continue
    if (part.startsWith('***') && part.endsWith('***')) {
      spanList.push({ _type: 'span', _key: makeKey(), text: part.slice(3, -3), marks: ['strong', 'em'] })
    } else if (part.startsWith('**') && part.endsWith('**')) {
      spanList.push({ _type: 'span', _key: makeKey(), text: part.slice(2, -2), marks: ['strong'] })
    } else if (part.startsWith('*') && part.endsWith('*')) {
      spanList.push({ _type: 'span', _key: makeKey(), text: part.slice(1, -1), marks: ['em'] })
    } else if (part.startsWith('`') && part.endsWith('`')) {
      spanList.push({ _type: 'span', _key: makeKey(), text: part.slice(1, -1), marks: ['code'] })
    } else {
      spanList.push({ _type: 'span', _key: makeKey(), text: part, marks: [] })
    }
  }
  return spanList.length > 0 ? spanList : [{ _type: 'span', _key: makeKey(), text, marks: [] }]
}

function markdownToBlocks(markdown: string): any[] {
  const lines = markdown.split('\n')
  const blocks: any[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }
    if (line.startsWith('# ')) {
      blocks.push({ _type: 'block', _key: makeKey(), style: 'h1', children: [{ _type: 'span', _key: makeKey(), text: line.slice(2).trim(), marks: [] }], markDefs: [] })
      i++; continue
    }
    if (line.startsWith('## ')) {
      blocks.push({ _type: 'block', _key: makeKey(), style: 'h2', children: [{ _type: 'span', _key: makeKey(), text: line.slice(3).trim(), marks: [] }], markDefs: [] })
      i++; continue
    }
    if (line.startsWith('### ')) {
      blocks.push({ _type: 'block', _key: makeKey(), style: 'h3', children: [{ _type: 'span', _key: makeKey(), text: line.slice(4).trim(), marks: [] }], markDefs: [] })
      i++; continue
    }
    if (line.startsWith('#### ')) {
      blocks.push({ _type: 'block', _key: makeKey(), style: 'h4', children: [{ _type: 'span', _key: makeKey(), text: line.slice(5).trim(), marks: [] }], markDefs: [] })
      i++; continue
    }
    if (line.match(/^[-*+] /)) {
      while (i < lines.length && lines[i].match(/^[-*+] /)) {
        blocks.push({ _type: 'block', _key: makeKey(), style: 'normal', listItem: 'bullet', level: 1, children: parseInline(lines[i].replace(/^[-*+] /, '').trim()), markDefs: [] })
        i++
      }
      continue
    }
    if (line.match(/^\d+\. /)) {
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        blocks.push({ _type: 'block', _key: makeKey(), style: 'normal', listItem: 'number', level: 1, children: parseInline(lines[i].replace(/^\d+\. /, '').trim()), markDefs: [] })
        i++
      }
      continue
    }
    if (line.trim() === '---' || line.trim() === '***') { i++; continue }
    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].match(/^#{1,4} /) &&
      !lines[i].match(/^[-*+] /) &&
      !lines[i].match(/^\d+\. /) &&
      lines[i].trim() !== '---'
    ) {
      paraLines.push(lines[i].trim())
      i++
    }
    if (paraLines.length > 0) {
      blocks.push({ _type: 'block', _key: makeKey(), style: 'normal', children: parseInline(paraLines.join(' ')), markDefs: [] })
    }
  }
  return blocks
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
    const { content, topic, qualification, contentType, difficulty, aiSummary, keyTerms, showOnSites, canonicalOwner, categoryId } = body

    if (!content || !qualification || !contentType || !canonicalOwner || !showOnSites?.length) {
      return NextResponse.json({ error: 'content, qualification, contentType, canonicalOwner and showOnSites are required' }, { status: 400 })
    }

    const token     = (process.env.SANITY_API_TOKEN)?.trim()
    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '4rllejq1'
    const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET    ?? 'production'

    if (!token) {
      return NextResponse.json({ error: 'SANITY_API_TOKEN is not set' }, { status: 500 })
    }

    const client = createClient({
      projectId,
      dataset,
      apiVersion: '2021-06-07',
      token,
      useCdn: false,
    })

    const title       = extractTitle(content, topic)
    const slug        = generateSlug(title)
    const blocks      = markdownToBlocks(content)
    const now         = new Date().toISOString()
    const examBody    = ['acca', 'cima', 'icaew', 'aat']
    const mappedType  = CONTENT_TYPE_MAP[contentType] ?? 'article'
    const mappedDiff  = DIFFICULTY_MAP[difficulty] ?? 'intermediate'
    const keyTermsArr = keyTerms ? keyTerms.split(',').map((t: string) => t.trim()).filter(Boolean) : []

    // showOnSites and canonicalOwner come from the UI as lowercase strings already
    const doc: any = {
      _type:          'article',
      title,
      slug:           { _type: 'slug', current: slug },
      excerpt:        aiSummary ?? '',
      body:           blocks,
      examBody,
      contentType:    mappedType,
      difficulty:     mappedDiff,
      publishedAt:    now,
      showOnSites,
      canonicalOwner,
      aiSummary:      aiSummary ?? '',
      aiKeyTerms:     keyTermsArr,
      aiSearchable:   true,
    }

    // Content ID — query highest existing AB-ART-XXXXX and increment
    const lastContentId = await client.fetch<string | null>(
      '*[_type == "article" && defined(contentId) && contentId match "AB-ART-*"] | order(contentId desc) [0].contentId'
    )
    let nextNum = 1
    if (lastContentId) {
      const match = lastContentId.match(/AB-ART-(\d+)$/)
      if (match) nextNum = parseInt(match[1], 10) + 1
    }
    const contentId = 'AB-ART-' + String(nextNum).padStart(5, '0')
    doc.contentId = contentId

      // Add category reference if selected
      if (categoryId) {
        doc.categories = [{ _type: 'reference', _ref: categoryId, _key: Math.random().toString(36).slice(2,10) }]
      }

    const result = await client.create(doc)

    return NextResponse.json({
      success:        true,
      documentId:     result._id,
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
