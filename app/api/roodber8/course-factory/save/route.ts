// app/api/roodber8/course-factory/save/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
// Receives course payload from Course Factory and writes to Sanity

import { NextRequest, NextResponse } from 'next/server'

const SANITY_PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '4rllejq1'
const SANITY_DATASET    = process.env.NEXT_PUBLIC_SANITY_DATASET    ?? 'production'
const SANITY_API_TOKEN  = process.env.SANITY_API_TOKEN

export async function POST(req: NextRequest) {
  if (!SANITY_API_TOKEN) {
    return NextResponse.json({ error: 'Sanity API token not configured' }, { status: 500 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title, slug, description, level, status, isFeatured, showOnSites, chapters } = body

  if (!title || !slug) {
    return NextResponse.json({ error: 'Title and slug are required' }, { status: 400 })
  }

  try {
    // First create lesson documents for each lesson in each chapter
    const mutations: any[] = []
    const chapterDocs: any[] = []

    for (let ci = 0; ci < chapters.length; ci++) {
      const chapter = chapters[ci]
      const lessonRefs: any[] = []

      for (let li = 0; li < chapter.lessonRefs.length; li++) {
        const lessonRef  = chapter.lessonRefs[li]
        const lessonId   = `lesson-${slug}-ch${ci + 1}-l${li + 1}`

        // Build lesson document
        const lessonDoc: any = {
          _id:          lessonId,
          _type:        'lesson',
          title:        lessonRef.title,
          slug:         { _type: 'slug', current: `${slug}-ch${ci + 1}-l${li + 1}` },
          order:        li + 1,
          parentCourse: { _type: 'reference', _ref: `course-${slug}` },
          linkedArticles: lessonRef.articleIds.map((id: string) => ({
            _type: 'reference',
            _ref:  id,
            _key:  id,
          })),
        }

        mutations.push({ createOrReplace: lessonDoc })
        lessonRefs.push({ _type: 'reference', _ref: lessonId, _key: lessonId })
      }

      chapterDocs.push({
        _type:        'chapter',
        _key:         chapter._key,
        chapterTitle: chapter.chapterTitle,
        chapterOrder: chapter.chapterOrder,
        lessons:      lessonRefs,
      })
    }

    // Build course document
    const courseDoc: any = {
      _id:         `course-${slug}`,
      _type:       'course',
      title,
      slug:        { _type: 'slug', current: slug },
      description: description ?? '',
      level:       level ?? 'beginner',
      status:      status ?? 'draft',
      isFeatured:  isFeatured ?? false,
      showOnSites: showOnSites ?? ['accountingbody'],
      chapters:    chapterDocs,
    }

    mutations.push({ createOrReplace: courseDoc })

    // Send to Sanity mutations API
    const res = await fetch(
      `https://${SANITY_PROJECT_ID}.api.sanity.io/v2023-05-03/data/mutate/${SANITY_DATASET}`,
      {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${SANITY_API_TOKEN}`,
        },
        body: JSON.stringify({ mutations }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `Sanity error: ${err}` }, { status: 500 })
    }

    const result = await res.json()
    return NextResponse.json({ success: true, id: `course-${slug}`, result })

  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 })
  }
}
