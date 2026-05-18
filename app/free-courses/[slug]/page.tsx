// app/free-courses/[slug]/page.tsx
// Serves the course landing page at /free-courses/[slug]

import { getCourseBySlug, getPublishedCourses, levelBadge, capitalize } from '@/lib/coursesNew'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

export async function generateStaticParams() {
  const courses = await getPublishedCourses()
  return courses.map(c => ({ slug: c.slug.current }))
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const course = await getCourseBySlug(params.slug)
  if (!course) return { title: 'Course Not Found | Accounting Body' }
  return {
    title: `${course.title} | Accounting Body`,
    description: course.metaDescription ?? course.description ?? '',
  }
}

export default async function FreeCoursesSlugPage({ params }: { params: { slug: string } }) {
  const course = await getCourseBySlug(params.slug)
  if (!course) notFound()

  const badge       = levelBadge(course.level)
  const firstLesson = course.chapters?.[0]?.lessons?.[0]
  const totalLessons = course.chapters?.reduce((acc, ch) => acc + (ch.lessons?.length ?? 0), 0) ?? 0

  return (
    <>
      {/* Hero */}
      <section className="bg-navy-950 py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`, backgroundSize: '60px 60px' }} />
        <div className="container-site relative z-10">
          <nav className="flex items-center gap-2 text-xs text-white/40 mb-6">
            <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
            <span>/</span>
            <Link href="/free-courses" className="hover:text-white/70 transition-colors">Courses</Link>
            <span>/</span>
            <span className="text-white/60 truncate max-w-[200px]">{course.title}</span>
          </nav>
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {course.level && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
                  {capitalize(course.level)}
                </span>
              )}
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-teal-500 text-white uppercase tracking-wide">Free</span>
            </div>
            <h1 className="font-display text-white text-3xl md:text-4xl leading-tight mb-4">{course.title}</h1>
            {course.description && <p className="text-white/65 text-lg leading-relaxed mb-6">{course.description}</p>}
            <div className="flex flex-wrap items-center gap-5 text-sm text-white/50 mb-8">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                {course.chapterCount} chapters
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                {totalLessons} lessons
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              {firstLesson ? (
                <Link href={`/free-courses/${course.slug.current}/learn/${firstLesson.slug.current}`}
                  className="sm:flex-1 inline-flex items-center justify-center gap-2 h-13 px-7 rounded-lg text-base font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold">
                  Start Course
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </Link>
              ) : (
                <span className="sm:flex-1 inline-flex items-center justify-center h-13 px-7 rounded-lg text-base font-semibold bg-white/10 text-white/40 cursor-not-allowed">Coming Soon</span>
              )}
              <Link href="/free-courses"
                className="sm:flex-1 inline-flex items-center justify-center h-13 px-7 rounded-lg text-base font-medium text-white border border-white/25 hover:bg-white/10 transition-all">
                All Courses
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Curriculum */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-3xl">
            <span className="eyebrow mb-3 block">Course Curriculum</span>
            <h2 className="section-title mb-8">What you will study</h2>
            <div className="space-y-4">
              {course.chapters?.map((chapter, ci) => (
                <div key={chapter._key} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100 bg-slate-50">
                    <div className="w-8 h-8 rounded-lg bg-navy-950 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-white">{ci + 1}</span>
                    </div>
                    <div>
                      <h3 className="font-display text-navy-950 text-base">{chapter.chapterTitle}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{chapter.lessons?.length ?? 0} lessons</p>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {chapter.lessons?.map((lesson, li) => (
                      <div key={lesson._id} className="flex items-center gap-4 px-5 py-3.5">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                          <span className="text-xs text-slate-500 font-medium">{li + 1}</span>
                        </div>
                        <p className="text-sm font-medium text-navy-950 flex-1 truncate">{lesson.title}</p>
                        <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {firstLesson && (
              <div className="mt-8">
                <Link href={`/free-courses/${course.slug.current}/learn/${firstLesson.slug.current}`}
                  className="inline-flex items-center gap-2 h-12 px-8 rounded-lg text-base font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors">
                  Start Learning
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Credit */}
      <section className="section bg-white border-t border-slate-200">
        <div className="container-site">
          <div className="max-w-3xl">
            <div className="flex items-center gap-4 p-6 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-12 h-12 rounded-xl bg-navy-950 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Developed by</p>
                <p className="font-display text-navy-950 text-lg">Accounting Body Editorial Team</p>
                <p className="text-sm text-slate-500 mt-0.5">Written and reviewed by qualified accountants. Always free.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
