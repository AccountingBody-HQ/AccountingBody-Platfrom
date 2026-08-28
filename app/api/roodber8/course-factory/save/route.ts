// app/api/roodber8/course-factory/save/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
// Receives course payload from Course Factory and writes to Supabase
// Replaces Sanity mutations API — Session 35

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SITE_CODE_MAP } from '@/lib/site-codes'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

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
  const expectedHash = await sha256Hex(secret)
  return token === expectedHash
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title, slug, description, level, status, isFeatured, showOnSites, chapters, canonical } = body

  if (!title || !slug) {
    return NextResponse.json({ error: 'Title and slug are required' }, { status: 400 })
  }

  const resolvedCanonical: string = (canonical as string | undefined) ?? 'accountingbody'
  const platform = SITE_CODE_MAP[resolvedCanonical] ?? 'ab'

  try {
    // Step 1 — Upsert course
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .upsert({
        title,
        slug,
        description:      description ?? '',
        level:            level ?? 'beginner',
        status:           status ?? 'draft',
        is_featured:      isFeatured ?? false,
        show_on_sites:    showOnSites ?? ['accountingbody'],
        canonical_owner:  resolvedCanonical,
        platform,
        updated_at:       new Date().toISOString(),
      }, { onConflict: 'slug' })
      .select('id')
      .single()

    if (courseError) return NextResponse.json({ error: courseError.message }, { status: 500 })

    try {
      // Step 2 — Delete existing chapters (CASCADE removes lessons + lesson_articles)
      const { error: deleteError } = await supabase
        .from('course_chapters')
        .delete()
        .eq('course_id', course.id)

      if (deleteError) throw deleteError

      // Step 3 — Insert chapters, lessons, and lesson-article links
      for (let ci = 0; ci < chapters.length; ci++) {
        const chapter = chapters[ci]

        const { data: ch, error: chError } = await supabase
          .from('course_chapters')
          .insert({
            course_id:     course.id,
            chapter_title: chapter.chapterTitle,
            chapter_order: ci + 1,
          })
          .select('id')
          .single()

        if (chError) throw chError

        for (let li = 0; li < chapter.lessonRefs.length; li++) {
          const lessonRef  = chapter.lessonRefs[li]
          const lessonSlug = `${slug}-ch${ci + 1}-l${li + 1}`

          const { data: lesson, error: lessonError } = await supabase
            .from('course_lessons')
            .insert({
              chapter_id:   ch.id,
              course_id:    course.id,
              title:        lessonRef.title,
              slug:         lessonSlug,
              lesson_order: li + 1,
            })
            .select('id')
            .single()

          if (lessonError) throw lessonError

          // Step 4 — Link articles to lesson
          for (let ai = 0; ai < lessonRef.articleIds.length; ai++) {
            const articleId = lessonRef.articleIds[ai]

            // articleIds are Supabase UUIDs (a.id from the fetch-article route)
            const { error: linkError } = await supabase
              .from('course_lesson_articles')
              .insert({
                lesson_id:    lesson.id,
                article_id:   articleId,
                article_order: ai + 1,
              })

            if (linkError) throw linkError
          }
        }
      }

      return NextResponse.json({ success: true, id: course.id })

    } catch (err: any) {
      console.error('course-factory/save: insert failed, rolling back:', err)
      const { error: rollbackError } = await supabase
        .from('courses')
        .delete()
        .eq('slug', slug)
      if (rollbackError) console.error('course-factory/save: rollback delete failed:', rollbackError)
      return NextResponse.json(
        { error: 'Course save failed mid-write. Partial data has been rolled back. Please try again.' },
        { status: 500 }
      )
    }

  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 })
  }
}
