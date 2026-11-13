// app/api/roodber8/course-factory/load-course/route.ts
// Replaces Sanity GROQ fetch — Session 35

import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated, signedOutResponse } from '@/lib/admin-auth'
import { getServerSupabase } from '@/lib/supabase-server'
import { getCourseBySlug } from '@/lib/coursesNew'

function getSupabase() {
  return getServerSupabase('admin')
}

// The short code of a database problem, for log lines.
function shortCode(v: { code?: unknown }): string {
  return typeof v.code === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(v.code) ? v.code : 'no-code'
}

// GET /api/roodber8/course-factory/load-course
// ?action=list  → returns all courses (id, title, slug, status, level, chapterCount)
// ?action=load&slug=xxx → returns full course structure with chapters, lessons, articles

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return signedOutResponse()
  }
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (action === 'list') {
    const supabase = getSupabase()
    const { data: courses, error } = await supabase
      .from('courses')
      .select('id, title, slug, status, level, course_chapters(id)')
      .order('title', { ascending: true })

    if (error) {
      console.error('admin course list failed', shortCode(error))
      return NextResponse.json({ error: 'Course list failed' }, { status: 500 })
    }

    const formatted = (courses ?? []).map(c => ({
      _id:          c.id,
      title:        c.title,
      slug:         c.slug,
      status:       c.status,
      level:        c.level,
      chapterCount: Array.isArray(c.course_chapters) ? c.course_chapters.length : 0,
    }))

    return NextResponse.json({ courses: formatted })
  }

  if (action === 'load') {
    const slug = searchParams.get('slug')
    if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

    const course = await getCourseBySlug(slug, true)
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    return NextResponse.json({ course })
  }

  return NextResponse.json({ error: 'action required' }, { status: 400 })
}
