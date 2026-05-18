// app/free-courses/[slug]/learn/[lessonSlug]/page.tsx
// Accounting Body — Premium Course Lesson Player v2

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLessonData, getCourseBySlug, getPublishedCourses } from '@/lib/coursesNew'
import MarkCompleteButton, { LessonStatusDot, CourseProgressBar, ResetProgressButton } from '@/components/course/ProgressTracker'

export async function generateStaticParams() {
  const courses = await getPublishedCourses()
  const params: { slug: string; lessonSlug: string }[] = []
  for (const c of courses) {
    const full = await getCourseBySlug(c.slug.current)
    if (!full) continue
    for (const chapter of full.chapters ?? []) {
      for (const lesson of chapter.lessons ?? []) {
        if (lesson.slug?.current) params.push({ slug: c.slug.current, lessonSlug: lesson.slug.current })
      }
    }
  }
  return params
}

export async function generateMetadata({ params }: { params: { slug: string; lessonSlug: string } }): Promise<Metadata> {
  const data = await getLessonData(params.slug, params.lessonSlug)
  if (!data) return { title: 'Lesson Not Found | Accounting Body' }
  return {
    title: `${data.lesson.title} — ${data.course.title} | Accounting Body`,
    description: data.lesson.linkedArticles?.[0]?.excerpt ?? data.course.description ?? '',
  }
}

export default async function FreeCoursesLessonPage({ params }: { params: { slug: string; lessonSlug: string } }) {
  const data = await getLessonData(params.slug, params.lessonSlug)
  if (!data) notFound()
  const { course, lesson, chapterTitle, prevLesson, nextLesson } = data

  const allLessons: string[] = []
  for (const ch of course.chapters ?? []) {
    for (const l of ch.lessons ?? []) {
      if (l.slug?.current) allLessons.push(l.slug.current)
    }
  }
  const currentIdx   = allLessons.indexOf(params.lessonSlug)
  const totalLessons = allLessons.length
  const pct          = Math.round(((currentIdx + 1) / totalLessons) * 100)

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F0EEE9' }}>

      {/* ── Top Bar ── */}
      <header className="sticky top-16 z-40" style={{ background: '#0C1A3D' }}>
        {/* Gold progress line */}
        <div className="h-[3px] w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <CourseProgressBar courseSlug={course.slug.current} allLessonSlugs={allLessons} />
        </div>
        <div className="flex items-center gap-0" style={{ minHeight: 52 }}>
          {/* Back button */}
          <Link
            href={`/free-courses/${course.slug.current}`}
            className="flex items-center gap-2.5 px-5 py-3 border-r transition-colors h-full"
            style={{ borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:block text-xs font-semibold truncate max-w-[160px]" style={{ color: 'rgba(255,255,255,0.55)' }}>{course.title}</span>
          </Link>

          {/* Lesson title */}
          <div className="flex-1 min-w-0 px-5">
            <p className="text-sm font-semibold truncate" style={{ color: '#fff' }}>{lesson.title}</p>
            <p className="text-xs truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{chapterTitle}</p>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-3 px-5 border-l" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="hidden sm:block text-right">
              <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>Lesson {currentIdx + 1} of {totalLessons}</p>
            </div>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: 'rgba(212,160,23,0.15)', color: '#D4A017', border: '1.5px solid rgba(212,160,23,0.3)' }}
            >
              {pct}%
            </div>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1">

        {/* ── Sidebar ── */}
        <aside
          className="hidden lg:flex flex-col w-72 xl:w-80 shrink-0 sticky overflow-hidden"
          style={{
            top: 'calc(4rem + 55px)',
            maxHeight: 'calc(100vh - 4rem - 55px)',
            background: '#0F2044',
          }}
        >
          {/* Sidebar header */}
          <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Course Content</p>
            <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {course.chapters?.length ?? 0} chapters · {totalLessons} lessons
            </p>
          </div>

          {/* Chapters */}
          <div className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
            {course.chapters?.map((chapter, ci) => (
              <div key={chapter._key} className="mb-1">
                {/* Chapter label */}
                <div className="flex items-center gap-2.5 px-4 py-2.5">
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center text-[0.55rem] font-bold shrink-0"
                    style={{ background: 'rgba(212,160,23,0.2)', color: '#D4A017' }}
                  >
                    {ci + 1}
                  </div>
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.08em] leading-snug" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {chapter.chapterTitle}
                  </p>
                </div>

                {/* Lessons */}
                {chapter.lessons?.map((l, li) => {
                  const isActive = l.slug?.current === params.lessonSlug
                  return (
                    <Link
                      key={l._id}
                      href={`/free-courses/${course.slug.current}/learn/${l.slug.current}`}
                      className="flex items-center gap-3 px-4 py-2.5 transition-all duration-150 group relative"
                      style={{
                        background: isActive ? 'rgba(212,160,23,0.12)' : 'transparent',
                        borderLeft: isActive ? '2px solid #D4A017' : '2px solid transparent',
                      }}
                    >
                      <LessonStatusDot
                        courseSlug={course.slug.current}
                        lessonSlug={l.slug.current}
                        allLessonSlugs={allLessons}
                        isActive={isActive}
                        lessonNumber={li + 1}
                      />
                      <span
                        className="text-sm leading-snug flex-1"
                        style={{
                          color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                          fontWeight: isActive ? 600 : 400,
                        }}
                      >
                        {l.title}
                      </span>
                    </Link>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Sidebar footer */}
          <div className="px-5 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <ResetProgressButton courseSlug={course.slug.current} allLessonSlugs={allLessons} />
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 min-w-0 py-10 px-4 sm:px-8 lg:px-12">
          <div className="max-w-2xl mx-auto">

            {/* Lesson header */}
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="text-[0.6rem] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(212,160,23,0.12)', color: '#B8860B' }}
                >
                  {chapterTitle}
                </span>
                <span className="text-[0.6rem] text-slate-400 font-medium">Lesson {currentIdx + 1} of {totalLessons}</span>
              </div>
              <h1
                className="font-display text-navy-950 leading-[1.08] mb-5"
                style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', letterSpacing: '-0.025em' }}
              >
                {lesson.title}
              </h1>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, #D4A017, transparent)' }} />
              </div>
            </div>

            {/* Video */}
            {lesson.videoUrl && (
              <div className="mb-10 rounded-2xl overflow-hidden shadow-2xl border border-slate-200 aspect-video bg-navy-950">
                <iframe
                  src={lesson.videoUrl.replace('watch?v=', 'embed/')}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}

            {/* Study Notes */}
            {lesson.linkedArticles?.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#0C1A3D' }}>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-display text-navy-950 text-lg leading-none">Study Notes</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{lesson.linkedArticles.length} {lesson.linkedArticles.length === 1 ? 'article' : 'articles'}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {lesson.linkedArticles.map((article, ai) => (
                    <div
                      key={article._id}
                      className="group relative bg-white rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
                      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}
                    >
                      {/* Left accent bar */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1 transition-all duration-200"
                        style={{ background: ai === 0 ? '#D4A017' : '#E2E8F0' }}
                      />
                      <div className="pl-6 pr-5 py-5 flex items-start gap-4">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-sm font-bold transition-all duration-200"
                          style={{ background: '#F8F7F4', color: '#64748B' }}
                        >
                          {ai + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/articles/${article.slug.current}`}
                            target="_blank"
                            className="font-display text-base font-semibold text-navy-950 hover:text-navy-600 transition-colors leading-snug block mb-2"
                          >
                            {article.title}
                          </Link>
                          {article.excerpt && (
                            <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 mb-3">{article.excerpt}</p>
                          )}
                          <Link
                            href={`/articles/${article.slug.current}`}
                            target="_blank"
                            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide transition-colors"
                            style={{ color: '#D4A017' }}
                          >
                            Read article
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                          </Link>
                        </div>
                        <svg className="w-4 h-4 text-slate-300 shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* External quiz */}
            {lesson.externalQuizUrl && (
              <div className="mb-10 p-5 rounded-2xl border" style={{ background: 'rgba(212,160,23,0.06)', borderColor: 'rgba(212,160,23,0.2)' }}>
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#D4A017' }}>
                    <svg className="w-5 h-5 text-navy-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-navy-950 text-sm">Practice Questions</p>
                    <p className="text-xs text-slate-500 mt-0.5">Test your understanding of this topic</p>
                  </div>
                  <Link href={lesson.externalQuizUrl}
                    className="h-10 px-5 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
                    style={{ background: '#0C1A3D', color: '#fff' }}>
                    Practice
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                </div>
              </div>
            )}

            {/* Mark complete card */}
            <div
              className="mb-8 p-6 rounded-2xl border"
              style={{ background: '#fff', borderColor: '#E2E8F0', boxShadow: '0 4px 24px rgba(12,26,61,0.06)' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="font-display text-navy-950 text-lg leading-tight mb-1">Ready to continue?</p>
                  <p className="text-sm text-slate-400">Mark this lesson complete to track your progress.</p>
                </div>
                <div className="shrink-0">
                  <MarkCompleteButton
                    courseSlug={course.slug.current}
                    lessonSlug={params.lessonSlug}
                    allLessonSlugs={allLessons}
                    nextHref={nextLesson ? `/free-courses/${course.slug.current}/learn/${nextLesson.slug}` : undefined}
                  />
                </div>
              </div>
            </div>

            {/* Prev / Next */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
              {prevLesson ? (
                <Link
                  href={`/free-courses/${course.slug.current}/learn/${prevLesson.slug}`}
                  className="flex items-center gap-3 p-4 rounded-2xl border bg-white transition-all duration-200 hover:-translate-y-0.5 group"
                  style={{ borderColor: '#E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200"
                    style={{ background: '#F0EEE9' }}
                  >
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-slate-400 mb-0.5">Previous</p>
                    <p className="text-sm font-semibold text-navy-950 truncate">{prevLesson.title}</p>
                  </div>
                </Link>
              ) : <div />}

              {nextLesson ? (
                <Link
                  href={`/free-courses/${course.slug.current}/learn/${nextLesson.slug}`}
                  className="flex items-center justify-end gap-3 p-4 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 group text-right"
                  style={{ background: '#0C1A3D', borderColor: '#0C1A3D', boxShadow: '0 4px 16px rgba(12,26,61,0.3)' }}
                >
                  <div className="min-w-0">
                    <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] mb-0.5" style={{ color: 'rgba(212,160,23,0.7)' }}>Next Lesson</p>
                    <p className="text-sm font-semibold text-white truncate">{nextLesson.title}</p>
                  </div>
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: '#D4A017' }}
                  >
                    <svg className="w-4 h-4 text-navy-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ) : (
                <Link
                  href={`/free-courses/${course.slug.current}`}
                  className="flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-colors"
                  style={{ borderColor: '#14b4a3', background: 'rgba(20,180,163,0.06)' }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#14b4a3' }}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#0d8f82' }}>Course Complete!</p>
                    <p className="text-xs" style={{ color: '#14b4a3' }}>Back to course overview</p>
                  </div>
                </Link>
              )}
            </div>

            {/* Footer credit */}
            <div className="pt-6 border-t border-slate-200 flex items-center gap-2.5">
              <svg className="w-3.5 h-3.5 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <p className="text-xs text-slate-400">
                Developed by <span className="font-semibold text-slate-500">Accounting Body Editorial Team</span> — written and reviewed by qualified accountants. Always free.
              </p>
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}
