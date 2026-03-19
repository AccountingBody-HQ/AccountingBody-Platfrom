// app/study/courses/page.tsx
// Course catalogue — all courses organised by qualification

import Link from 'next/link'
import { getCourses, formatMinutes, levelColour, examBodyColour } from '@/lib/courses'
import type { Course } from '@/lib/courses'

export const metadata = {
  title:       'Free Accounting Courses | AccountingBody',
  description: 'Structured courses for ACCA, CIMA, AAT, and ICAEW — with study notes, videos, and practice quizzes.',
}

// Group courses by exam body, then sort within each group
function groupByExamBody(courses: Course[]): Record<string, Course[]> {
  const order = ['ACCA', 'CIMA', 'AAT', 'ICAEW', 'ATT', 'CTA']
  const map: Record<string, Course[]> = {}
  for (const c of courses) {
    if (!c.examBody || !c.slug?.current) continue
    if (!map[c.examBody]) map[c.examBody] = []
    map[c.examBody].push(c)
  }
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => a.courseOrder - b.courseOrder)
  }
  // Return in the desired order
  const result: Record<string, Course[]> = {}
  for (const body of order) {
    if (map[body]) result[body] = map[body]
  }
  for (const body of Object.keys(map)) {
    if (!result[body]) result[body] = map[body]
  }
  return result
}

function CourseCard({ course }: { course: Course }) {
  const lc      = levelColour(course.level)
  const accentBg = examBodyColour(course.examBody)

  return (
    <Link
      href={`/study/courses/${course.slug.current}`}
      className="group flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Top accent bar */}
      <div className={`h-1 ${accentBg}`} />

      <div className="flex flex-col flex-1 p-5">
        {/* Level badge */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${lc.bg} ${lc.text} ${lc.border}`}>
            {course.level}
          </span>
          {course.tags?.slice(0, 1).map(tag => (
            <span key={tag} className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{tag}</span>
          ))}
        </div>

        {/* Title */}
        <h3 className="font-display text-navy-950 leading-snug mb-2 group-hover:text-navy-700 transition-colors">
          {course.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 mb-4 flex-1">
          {course.description}
        </p>

        {/* Footer meta */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              {(course.lessons ?? []).length} lessons
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2"/>
              </svg>
              {formatMinutes(course.estimatedTime)}
            </span>
          </div>
          <span className="flex items-center gap-1 text-xs font-semibold text-navy-700 group-hover:gap-2 transition-all">
            Start
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
            </svg>
          </span>
        </div>
      </div>
    </Link>
  )
}

export default async function CoursesPage() {
  const courses = await getCourses()
  const grouped = groupByExamBody(courses)

  return (
    <>
      {/* ── Hero ── */}
      <section className="bg-navy-950 py-16 md:py-24 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[60%] opacity-25"
          style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }}
        />

        <div className="container-site relative z-10">
          <div className="max-w-2xl">
            <span className="eyebrow text-gold-400 mb-4 block">Free Courses</span>
            <h1 className="font-display text-white mb-4 leading-tight" style={{ letterSpacing: '-0.025em' }}>
              Structured courses for every qualification
            </h1>
            <p className="text-white/65 text-lg leading-relaxed">
              Video lessons, linked study notes, and practice quizzes — all mapped
              to official exam syllabuses. Track your progress as you go.
            </p>
          </div>
        </div>
      </section>

      {/* ── Courses by qualification ── */}
      <section className="section bg-slate-50">
        <div className="container-site space-y-16">
          {Object.entries(grouped).map(([body, bodyCourses]) => (
            <div key={body}>
              {/* Qualification header */}
              <div className="flex items-center gap-4 mb-8">
                <div className={`w-10 h-10 rounded-xl ${examBodyColour(body)} flex items-center justify-center text-white text-xs font-bold`}>
                  {body}
                </div>
                <div>
                  <h2 className="font-display text-2xl text-navy-950">{body} Courses</h2>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {bodyCourses.length} course{bodyCourses.length !== 1 ? 's' : ''} available
                  </p>
                </div>
              </div>

              {/* Course cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {bodyCourses.map(c => (
                  <CourseCard key={c._id} course={c} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="bg-white border-t border-slate-200 py-10">
        <div className="container-site text-center">
          <p className="font-display text-xl text-navy-950 mb-2">Can&apos;t find your qualification?</p>
          <p className="text-slate-500 text-sm mb-6">
            More courses are being added every month. Browse our study notes library in the meantime.
          </p>
          <Link
            href="/study"
            className="inline-flex items-center gap-2 h-10 px-6 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors"
          >
            Browse all study notes
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
            </svg>
          </Link>
        </div>
      </section>
    </>
  )
}