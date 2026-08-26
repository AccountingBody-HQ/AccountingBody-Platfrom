// app/api/roodber8/course-factory/delete-course/route.ts
// Replaces Sanity multi-step delete — Session 35
// CASCADE on course_chapters → course_lessons → course_lesson_articles handles everything

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function DELETE(req: NextRequest) {
  try {
    const { slug } = await req.json()
    if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

    // Get course id and chapter/lesson counts before deleting (for response)
    const { data: course, error: fetchError } = await supabase
      .from('courses')
      .select('id, course_chapters(id, course_lessons(id))')
      .eq('slug', slug)
      .maybeSingle()

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    const lessonCount = (course.course_chapters ?? []).reduce(
      (acc: number, ch: { course_lessons: { id: string }[] }) =>
        acc + (ch.course_lessons?.length ?? 0),
      0
    )

    // Single delete — CASCADE removes chapters, lessons, and lesson_articles automatically
    const { error: deleteError } = await supabase
      .from('courses')
      .delete()
      .eq('slug', slug)

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      deleted: { lessons: lessonCount, courseId: course.id },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Delete failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
