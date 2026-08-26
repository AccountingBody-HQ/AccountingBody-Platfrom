// app/api/roodber8/course-factory/save/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
// Receives course payload from Course Factory and writes to Supabase
// Replaces Sanity mutations API — Session 35

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(req: NextRequest) {
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
        canonical_owner:  showOnSites?.[0] ?? 'accountingbody',
        platform:         'ab',
        updated_at:       new Date().toISOString(),
      }, { onConflict: 'slug' })
      .select('id')
      .single()

    if (courseError) return NextResponse.json({ error: courseError.message }, { status: 500 })

    // Step 2 — Delete existing chapters (CASCADE removes lessons + lesson_articles)
    const { error: deleteError } = await supabase
      .from('course_chapters')
      .delete()
      .eq('course_id', course.id)

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

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

      if (chError) return NextResponse.json({ error: chError.message }, { status: 500 })

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

        if (lessonError) return NextResponse.json({ error: lessonError.message }, { status: 500 })

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

          if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 })
        }
      }
    }

    return NextResponse.json({ success: true, id: course.id })

  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 })
  }
}
