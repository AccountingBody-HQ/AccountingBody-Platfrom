// app/api/roodber8/course-factory/load-course/route.ts
// Replaces Sanity GROQ fetch — Session 35

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCourseBySlug } from '@/lib/coursesNew'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

// GET /api/roodber8/course-factory/load-course
// ?action=list  → returns all courses (id, title, slug, status, level, chapterCount)
// ?action=load&slug=xxx → returns full course structure with chapters, lessons, articles

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

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (action === 'list') {
    const supabase = getSupabase()
    const { data: courses, error } = await supabase
      .from('courses')
      .select('id, title, slug, status, level, course_chapters(id)')
      .order('title', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
