// app/api/roodber8/course-factory/delete-course/route.ts
// Replaces Sanity multi-step delete — Session 35
// CASCADE on course_chapters → course_lessons → course_lesson_articles handles everything

import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated, signedOutResponse } from '@/lib/admin-auth'
import { getServerSupabase } from '@/lib/supabase-server'
import { reportServerError } from '@/lib/report-error'
import { refreshCourseCaches } from '@/lib/course-cache'
import { DELETE_FAILED, errorCode, keepCopyBeforeDelete, snapshotCourseBy } from '@/lib/recycle-bin'

function getSupabase() {
  return getServerSupabase('admin')
}

export async function DELETE(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return signedOutResponse()
  }
  try {
    const supabase = getSupabase()
    const { slug } = await req.json()
    if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

    // A full copy of the course (chapters, lessons, links) goes to the
    // recycle bin first; its lesson count is used for the response.
    const kept = await keepCopyBeforeDelete(supabase, await snapshotCourseBy(supabase, 'slug', String(slug)), {
      kind: 'course',
      sourceTable: 'courses',
      label: (row) => row.title,
      notFound: 'Course not found',
    })
    if (!kept.ok) return NextResponse.json({ error: kept.error }, { status: kept.status })
    const lessonCount = (kept.payload.course_lessons ?? []).length

    // Single delete — CASCADE removes chapters, lessons, and lesson_articles automatically
    const { error: deleteError } = await supabase
      .from('courses')
      .delete()
      .eq('slug', slug)

    if (deleteError) {
      console.error('course-factory/delete-course: delete failed', errorCode(deleteError))
      return NextResponse.json({ error: DELETE_FAILED }, { status: 500 })
    }

    refreshCourseCaches()

    return NextResponse.json({
      success: true,
      deleted: { lessons: lessonCount, courseId: kept.row.id },
      binId: kept.binId,
    })
  } catch (e: unknown) {
    reportServerError('admin course factory delete failed', e, { area: 'admin' })
    const msg = e instanceof Error ? e.message : 'Delete failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
