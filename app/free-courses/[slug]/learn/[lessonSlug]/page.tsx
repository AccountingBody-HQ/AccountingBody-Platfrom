// app/free-courses/[slug]/learn/[lessonSlug]/page.tsx
// Accounting Body — Premium Course Lesson Player

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

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F8F7F4' }}>

      {/* ── Premium Top Bar ── */}
      <header className="bg-navy-950 sticky top-16 z-30 shadow-lg">
        {/* Full-width progress line at very top */}
        <div className="h-0.5 w-full bg-white/10">
          <CourseProgressBar courseSlug={course.slug.current} allLessonSlugs={allLessons} />
        </div>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          {/* Back to course */}
          <Link
            href={`/free-courses/${course.slug.current}`}
            className="shrink-0 flex items-center gap-2 text-white/50 hover:text-white transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-white/8 group-hover:bg-white/15 flex items-center justify-center transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </div>
            <span className="hidden md:block text-sm font-medium truncate max-w-[200px]">{course.title}</span>
          </Link>

          {/* Divider */}
          <div className="hidden md:block w-px h-5 bg-white/15" />

          {/* Current lesson info */}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate leading-tight">{lesson.title}</p>
            <p className="text-white/40 text-xs mt-0.5 truncate">{chapterTitle}</p>
          </div>

          {/* Progress info */}
          <div className="shrink-0 flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end gap-1">
              <span className="text-xs text-white/40 font-medium">{currentIdx + 1} of {totalLessons} lessons</span>
              <CourseProgressBar courseSlug={course.slug.current} allLessonSlugs={allLessons} />
            </div>
            <div className="w-9 h-9 rounded-full bg-white/8 border border-white/15 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-white/70">{Math.round(((currentIdx + 1) / totalLessons) * 100)}%</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Layout ── */}
      <div className="flex flex-1 max-w-[1400px] mx-auto w-full">

        {/* ── Premium Sidebar ── */}
        <aside className="hidden lg:flex flex-col w-80 shrink-0 bg-white border-r border-slate-200 sticky top-[calc(4rem+49px)] self-start max-h-[calc(100vh-4rem-49px)] overflow-hidden shadow-sm">
          {/* Sidebar header */}
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
            <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-[0.1em] mb-0.5">Course Content</p>
            <p className="text-xs text-slate-500 font-medium">{course.chapters?.length ?? 0} chapters · {totalLessons} lessons</p>
          </div>

          {/* Chapters list */}
          <div className="flex-1 overflow-y-auto">
            {course.chapters?.map((chapter, ci) => (
              <div key={chapter._key} className="border-b border-slate-100 last:border-0">
                {/* Chapter header */}
                <div className="flex items-center gap-3 px-5 py-3 bg-slate-50/50">
                  <div className="w-6 h-6 rounded-md bg-navy-950 text-white text-[0.6rem] font-bold flex items-center justify-center shrink-0">
                    {ci + 1}
                  </div>
                  <p className="text-xs font-bold text-navy-950 leading-snug uppercase tracking-wide">{chapter.chapterTitle}</p>
                </div>
                {/* Lessons */}
                <div>
                  {chapter.lessons?.map((l, li) => {
                    const isActive = l.slug?.current === params.lessonSlug
                    return (
                      <Link
                        key={l._id}
                        href={`/free-courses/${course.slug.current}/learn/${l.slug.current}`}
                        className={[
                          'group flex items-center gap-3 px-5 py-3 text-sm transition-all duration-150 border-l-2',
                          isActive
                            ? 'border-gold-500 bg-gold-50 text-navy-950'
                            : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-navy-950 hover:border-slate-300',
                        ].join(' ')}
                      >
                        <LessonStatusDot
                          courseSlug={course.slug.current}
                          lessonSlug={l.slug.current}
                          allLessonSlugs={allLessons}
                          isActive={isActive}
                          lessonNumber={li + 1}
                        />
                        <span className={['leading-snug flex-1 text-sm', isActive ? 'font-semibold' : ''].join(' ')}>{l.title}</span>
                        {isActive && (
                          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-gold-500" />
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar footer */}
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
            <ResetProgressButton courseSlug={course.slug.current} allLessonSlugs={allLessons} />
          </div>
        </aside>

        {/* ── Lesson Content ── */}
        <main className="flex-1 min-w-0">
          <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10">

            {/* Lesson header */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[0.65rem] font-bold text-gold-600 uppercase tracking-[0.1em]">{chapterTitle}</span>
                <span className="text-slate-300">·</span>
                <span className="text-[0.65rem] font-medium text-slate-400">Lesson {currentIdx + 1} of {totalLessons}</span>
              </div>
              <h1 className="font-display text-navy-950 text-3xl md:text-4xl leading-tight mb-3" style={{ letterSpacing: '-0.02em' }}>
                {lesson.title}
              </h1>
              <div className="h-px bg-gradient-to-r from-gold-500/40 to-transparent" />
            </div>

            {/* Video */}
            {lesson.videoUrl && (
              <div className="mb-10 rounded-2xl overflow-hidden shadow-xl border border-slate-200 aspect-video bg-navy-950">
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
                  <div className="w-8 h-8 rounded-lg bg-navy-950 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-display text-lg text-navy-950 leading-none">Study Notes</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{lesson.linkedArticles.length} {lesson.linkedArticles.length === 1 ? 'article' : 'articles'} in this lesson</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {lesson.linkedArticles.map((article, ai) => (
                    <div
                      key={article._id}
                      className="group bg-white rounded-2xl border border-slate-200 hover:border-navy-200 hover:shadow-lg transition-all duration-200 overflow-hidden"
                    >
                      <div className="h-0.5 bg-gradient-to-r from-navy-950/20 to-transparent group-hover:from-gold-500/60 transition-all duration-200" />
                      <div className="p-5 flex items-start gap-4">
                        {/* Number badge */}
                        <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-navy-950 flex items-center justify-center shrink-0 mt-0.5 transition-colors duration-200">
                          <span className="text-sm font-bold text-slate-500 group-hover:text-white transition-colors duration-200">{ai + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/articles/${article.slug.current}`}
                            target="_blank"
                            className="font-display text-base text-navy-950 hover:text-navy-700 transition-colors leading-snug block mb-2"
                          >
                            {article.title}
                          </Link>
                          {article.excerpt && (
                            <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 mb-3">{article.excerpt}</p>
                          )}
                          <Link
                            href={`/articles/${article.slug.current}`}
                            target="_blank"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy-700 hover:text-gold-600 transition-colors"
                          >
                            Read full article
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                          </Link>
                        </div>
                        {/* External link icon */}
                        <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-400 shrink-0 mt-1 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="mb-10 p-5 rounded-2xl bg-gradient-to-r from-gold-50 to-amber-50 border border-gold-200">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gold-500 flex items-center justify-center shrink-0 shadow-sm">
                    <svg className="w-6 h-6 text-navy-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-navy-950 text-sm">Practice Questions</p>
                    <p className="text-xs text-slate-500 mt-0.5">Test your understanding of this topic</p>
                  </div>
                  <Link
                    href={lesson.externalQuizUrl}
                    className="inline-flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-semibold bg-navy-950 text-white hover:bg-navy-800 transition-colors shadow-sm"
                  >
                    Practice now
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                </div>
              </div>
            )}

            {/* Mark complete */}
            <div className="mb-8 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-navy-950 text-sm mb-0.5">Finished this lesson?</p>
                  <p className="text-xs text-slate-400">Mark it complete and move to the next one.</p>
                </div>
                <MarkCompleteButton
                  courseSlug={course.slug.current}
                  lessonSlug={params.lessonSlug}
                  allLessonSlugs={allLessons}
                  nextHref={nextLesson ? `/free-courses/${course.slug.current}/learn/${nextLesson.slug}` : undefined}
                />
              </div>
            </div>

            {/* Prev / Next navigation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {prevLesson ? (
                <Link
                  href={`/free-courses/${course.slug.current}/learn/${prevLesson.slug}`}
                  className="flex items-center gap-3 p-4 rounded-2xl border border-slate-200 bg-white hover:border-navy-300 hover:shadow-md transition-all duration-200 group"
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-navy-950 flex items-center justify-center shrink-0 transition-colors duration-200">
                    <svg className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Previous</p>
                    <p className="text-sm font-semibold text-navy-950 truncate">{prevLesson.title}</p>
                  </div>
                </Link>
              ) : <div />}

              {nextLesson ? (
                <Link
                  href={`/free-courses/${course.slug.current}/learn/${nextLesson.slug}`}
                  className="flex items-center justify-end gap-3 p-4 rounded-2xl border border-slate-200 bg-white hover:border-navy-300 hover:shadow-md transition-all duration-200 group text-right"
                >
                  <div className="min-w-0">
                    <p className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Next Lesson</p>
                    <p className="text-sm font-semibold text-navy-950 truncate">{nextLesson.title}</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-navy-950 group-hover:bg-gold-500 flex items-center justify-center shrink-0 transition-colors duration-200">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ) : (
                <Link
                  href={`/free-courses/${course.slug.current}`}
                  className="flex items-center justify-center gap-3 p-4 rounded-2xl border-2 border-teal-400 bg-teal-50 hover:bg-teal-100 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-xl bg-teal-500 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-teal-700">Course Complete!</p>
                    <p className="text-xs text-teal-600">Back to course overview</p>
                  </div>
                </Link>
              )}
            </div>

            {/* Editorial credit */}
            <div className="mt-10 pt-6 border-t border-slate-200 flex items-center gap-3 text-xs text-slate-400">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Developed by <strong className="text-slate-500">Accounting Body Editorial Team</strong> — written and reviewed by qualified accountants.</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
