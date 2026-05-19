// app/api/roodber8/course-factory/load-course/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@sanity/client'

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '4rllejq1',
  dataset:   process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
  apiVersion: '2024-01-01',
  token:      process.env.SANITY_API_TOKEN,
  useCdn:     false,
})

// GET /api/roodber8/course-factory/load-course
// ?action=list  → returns all courses (id, title, slug, status)
// ?action=load&slug=xxx → returns full course structure with articles

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (action === 'list') {
    const courses = await client.fetch(
      `*[_type == "course" && !(_id in path("drafts.**"))] | order(title asc) {
        _id, title, slug, status, level,
        "chapterCount": count(chapters)
      }`
    )
    return NextResponse.json({ courses })
  }

  if (action === 'load') {
    const slug = searchParams.get('slug')
    if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

    const course = await client.fetch(
      `*[_type == "course" && slug.current == $slug][0] {
        _id, title, slug, description, level, status, isFeatured,
        chapters[] {
          _key, chapterTitle, chapterOrder,
          lessons[]-> {
            _id, title, slug,
            linkedArticles[]-> {
              _id, title, slug, excerpt, contentId, wpId
            }
          }
        }
      }`,
      { slug }
    )

    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    return NextResponse.json({ course })
  }

  return NextResponse.json({ error: 'action required' }, { status: 400 })
}
