import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import AutoRefresh from '@/components/roodber8/AutoRefresh'
import { BookOpen, Plus, ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'

const C = {
  card:    { background: '#0d1424', border: '1px solid #1a2238', borderRadius: 16 },
  idle:    { background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#64748b' },
  success: { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' },
}

const DIFF_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  beginner:     { bg: 'rgba(16,185,129,0.08)',  color: '#10b981', border: 'rgba(16,185,129,0.2)'  },
  intermediate: { bg: 'rgba(245,158,11,0.08)',  color: '#f59e0b', border: 'rgba(245,158,11,0.2)'  },
  advanced:     { bg: 'rgba(239,68,68,0.08)',   color: '#ef4444', border: 'rgba(239,68,68,0.2)'   },
}

interface CourseRow {
  id:            string
  title:         string
  slug:          string
  level:         string | null
  status:        string
  show_on_sites: string[] | null
  created_at:    string | null
  chapterCount:  number
  lessonCount:   number
  articleCount:  number
}

interface RawCourseRow {
  id:            string
  title:         string
  slug:          string
  level:         string | null
  status:        string
  show_on_sites: string[] | null
  created_at:    string | null
}

async function getCourses(): Promise<CourseRow[]> {
  noStore()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  // Stage 1 — courses (flat, no embed — Rule 52)
  const { data: coursesData } = await supabase
    .from('courses')
    .select('id, title, slug, level, status, show_on_sites, created_at')
    .order('created_at', { ascending: false })
    .limit(3000)

  const courses = (coursesData ?? []) as RawCourseRow[]
  if (courses.length === 0) return []

  const courseIds = courses.map(c => c.id)

  // Stage 2 — chapters (flat)
  const { data: chaptersData } = await supabase
    .from('course_chapters')
    .select('id, course_id')
    .in('course_id', courseIds)

  const chapters = (chaptersData ?? []) as { id: string; course_id: string }[]
  const chapterCountByCourseId = new Map<string, number>()
  for (const ch of chapters) {
    chapterCountByCourseId.set(ch.course_id, (chapterCountByCourseId.get(ch.course_id) ?? 0) + 1)
  }

  // Stage 3 — lessons (flat)
  const { data: lessonsData } = await supabase
    .from('course_lessons')
    .select('id, course_id')
    .in('course_id', courseIds)

  const lessons = (lessonsData ?? []) as { id: string; course_id: string }[]
  const lessonCountByCourseId = new Map<string, number>()
  const courseIdByLessonId = new Map<string, string>()
  for (const l of lessons) {
    lessonCountByCourseId.set(l.course_id, (lessonCountByCourseId.get(l.course_id) ?? 0) + 1)
    courseIdByLessonId.set(l.id, l.course_id)
  }

  // Stage 4 — lesson-article links (flat)
  const lessonIds = lessons.map(l => l.id)
  const articleCountByCourseId = new Map<string, number>()
  if (lessonIds.length > 0) {
    const { data: linksData } = await supabase
      .from('course_lesson_articles')
      .select('lesson_id')
      .in('lesson_id', lessonIds)

    const links = (linksData ?? []) as { lesson_id: string }[]
    for (const link of links) {
      const courseId = courseIdByLessonId.get(link.lesson_id)
      if (!courseId) continue
      articleCountByCourseId.set(courseId, (articleCountByCourseId.get(courseId) ?? 0) + 1)
    }
  }

  return courses.map(c => ({
    ...c,
    chapterCount: chapterCountByCourseId.get(c.id) ?? 0,
    lessonCount:  lessonCountByCourseId.get(c.id) ?? 0,
    articleCount: articleCountByCourseId.get(c.id) ?? 0,
  }))
}

export default async function CourseLibraryPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const [
    courses,
    { count: totalCourses },
    { count: publishedCount },
    { count: draftCount },
    { count: totalChapters },
    { count: totalLessons },
  ] = await Promise.all([
    getCourses(),
    supabase.from('courses').select('*', { count: 'exact', head: true }),
    supabase.from('courses').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('courses').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
    supabase.from('course_chapters').select('*', { count: 'exact', head: true }),
    supabase.from('course_lessons').select('*', { count: 'exact', head: true }),
  ])

  const STATS = [
    { label: 'Total Courses',  value: totalCourses ?? 0,   color: '#D4A017', bg: 'rgba(212,160,23,0.08)', border: 'rgba(212,160,23,0.2)' },
    { label: 'Published',      value: publishedCount ?? 0, color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
    { label: 'Draft',          value: draftCount ?? 0,     color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
    { label: 'Total Chapters', value: totalChapters ?? 0,  color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
    { label: 'Total Lessons',  value: totalLessons ?? 0,   color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)' },
  ]

  return (
    <div className="p-8">
      <AutoRefresh />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(212,160,23,0.12)' }}>
            <BookOpen size={20} style={{ color: '#D4A017' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Courses</h1>
            <p className="text-sm" style={{ color: '#475569' }}>All structured courses — manage, edit, publish</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/roodber8/course-factory"
            className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl"
            style={{ background: '#D4A017', color: '#0C1A3D' }}>
            <Plus size={15} /> New Course
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        {STATS.map(s => (
          <div key={s.label} className="rounded-2xl border p-5"
            style={{ background: s.bg, borderColor: s.border }}>
            <p className="text-3xl font-black mb-1" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: s.color }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Course list */}
      <div className="rounded-2xl border overflow-hidden" style={C.card}>
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#1a2238' }}>
          <h2 className="text-white font-bold text-sm">All Courses</h2>
          <span className="text-xs font-semibold" style={{ color: '#475569' }}>
            {courses.length} courses
          </span>
        </div>

        {courses.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <BookOpen size={32} style={{ color: '#1a2238' }} className="mx-auto mb-4" />
            <p className="text-white font-semibold mb-2">No courses yet</p>
            <p className="text-sm mb-6" style={{ color: '#334155' }}>Create your first course using the button above.</p>
            <Link href="/roodber8/course-factory"
              className="inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl"
              style={{ background: '#D4A017', color: '#0C1A3D' }}>
              <Plus size={14} /> Create your first course
            </Link>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#1a2238' }}>
            {courses.map(course => {
              const diff = course.level ? DIFF_STYLE[course.level] ?? DIFF_STYLE.intermediate : null
              const sites = course.show_on_sites ?? []
              const statusStyle = course.status === 'published'
                ? C.success
                : course.status === 'draft'
                  ? { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' }
                  : C.idle
              return (
                <div key={course.id} className="px-6 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{course.title || 'Untitled'}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {diff && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded capitalize"
                          style={{ background: diff.bg, color: diff.color, border: `1px solid ${diff.border}` }}>
                          {course.level}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: '#475569' }}>{course.chapterCount} chapters</span>
                      <span className="text-xs" style={{ color: '#475569' }}>{course.lessonCount} lessons</span>
                      <span className="text-xs" style={{ color: '#475569' }}>{course.articleCount} articles</span>
                      <span className="text-xs" style={{ color: '#334155' }}>
                        {course.created_at
                          ? new Date(course.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg capitalize" style={statusStyle}>
                      {course.status}
                    </span>
                    {sites.includes('ab') && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(37,99,235,0.1)', color: '#60a5fa' }}>AB</span>
                    )}
                    {sites.includes('et') && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(212,160,23,0.1)', color: '#D4A017' }}>ET</span>
                    )}
                    <Link href={`/roodber8/courses/${course.id}`}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"
                      style={{ background: 'rgba(212,160,23,0.1)', color: '#D4A017', border: '1px solid rgba(212,160,23,0.2)' }}>
                      Manage
                    </Link>
                    {course.status === 'published' && course.slug && (
                      <a href={`/free-courses/${course.slug}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-medium flex items-center gap-1" style={{ color: '#2563eb' }}>
                        View <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
