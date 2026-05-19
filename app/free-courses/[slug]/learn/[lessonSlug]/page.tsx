// app/free-courses/[slug]/learn/[lessonSlug]/page.tsx
// Accounting Body — Lesson Player v4

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLessonData, getCourseBySlug, getPublishedCourses } from '@/lib/coursesNew'
import MarkCompleteButton, { CourseProgressBar, ResetLessonButton, ResetChapterInlineButton } from '@/components/course/ProgressTracker'
import CourseSidebar from '@/components/course/CourseSidebar'
import MobileNavDrawer from '@/components/course/MobileNavDrawer'
import ArticleBody from '@/components/course/ArticleBody'

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
  const isLastLesson = !nextLesson

  const currentChapter = course.chapters?.find((ch: { lessons?: { slug?: { current: string } }[] }) =>
    ch.lessons?.some((l: { slug?: { current: string } }) => l.slug?.current === params.lessonSlug)
  )
  const currentChapterLessonSlugs = currentChapter?.lessons?.map((l: { slug?: { current: string } }) => l.slug?.current ?? '') ?? []

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh', background: '#EDE9E3' }}>

      {/* TOP BAR */}
      <header
        className="sticky top-16 z-40 border-b"
        style={{ background: '#0C1A3D', borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-stretch" style={{ minHeight: 56 }}>

          {/* Back to course */}
          <Link
            href={`/free-courses/${course.slug.current}`}
            className="flex items-center gap-2 pl-4 pr-5 border-r shrink-0 transition-all hover:opacity-75"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <svg className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.5)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
              </svg>
            </div>
            <span className="hidden md:block text-xs font-semibold" style={{ overflowWrap: "break-word", wordBreak: "break-word", maxWidth: "220px", color: 'rgba(255,255,255,0.4)' }}>
              {course.title}
            </span>
          </Link>

          {/* Lesson title + chapter */}
          <div className="flex-1 flex items-center px-5 min-w-0">
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight text-white" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{lesson.title}</p>
              <p className="text-[0.65rem] font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {chapterTitle} · Lesson {currentIdx + 1} of {totalLessons}
              </p>
            </div>
          </div>

          {/* Prev / Next in top bar */}
          <div className="hidden md:flex items-center gap-1 px-3 border-l shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            {prevLesson ? (
              <Link
                href={`/free-courses/${course.slug.current}/learn/${prevLesson.slug}`}
                title={`Previous: ${prevLesson.title}`}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/10"
              >
                <svg className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.55)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
            ) : (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center opacity-20 cursor-not-allowed">
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                </svg>
              </div>
            )}
            {nextLesson ? (
              <Link
                href={`/free-courses/${course.slug.current}/learn/${nextLesson.slug}`}
                title={`Next: ${nextLesson.title}`}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/10"
              >
                <svg className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.55)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ) : (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center opacity-20 cursor-not-allowed">
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            )}
          </div>

          {/* Single progress indicator */}
          <div className="flex items-center px-5 border-l shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="hidden sm:block">
              <CourseProgressBar courseSlug={course.slug.current} allLessonSlugs={allLessons} />
            </div>
          </div>
        </div>
      </header>

      {/* BODY */}
      <div className="flex flex-1">

        {/* Collapsible sidebar (desktop) */}
        <CourseSidebar
          courseSlug={course.slug.current}
          chapters={course.chapters ?? []}
          totalLessons={totalLessons}
          currentLessonSlug={params.lessonSlug}
          allLessons={allLessons}
        />

        {/* LESSON CONTENT */}
        <main className="flex-1 min-w-0 py-10 px-5 sm:px-8 lg:px-12 pb-28 lg:pb-12">
          <div style={{ maxWidth: 900, margin: '0 auto' }}>

            {/* Lesson heading */}
            <div className="mb-12">
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span
                  className="text-[0.65rem] font-black uppercase tracking-[0.1em] px-3 py-1.5 rounded-full"
                  style={{ background: 'rgba(12,26,61,0.08)', color: '#0C1A3D' }}
                >
                  {chapterTitle}
                </span>
                <span className="text-[0.65rem] font-semibold" style={{ color: '#94A3B8' }}>
                  Lesson {currentIdx + 1} of {totalLessons}
                </span>
              </div>
              <h1
                className="font-display text-navy-950 mb-5"
                style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', lineHeight: 1.08, letterSpacing: '-0.03em' }}
              >
                {lesson.title}
              </h1>
              <div style={{
                height: 3,
                maxWidth: 180,
                borderRadius: 3,
                background: 'linear-gradient(to right, #D4A017 0%, rgba(212,160,23,0.3) 60%, transparent 100%)',
              }} />
            </div>

            {/* Video */}
            {lesson.videoUrl && (
              <div className="mb-10 rounded-3xl overflow-hidden border" style={{ boxShadow: '0 20px 60px rgba(12,26,61,0.15)', borderColor: 'rgba(0,0,0,0.06)' }}>
                <div style={{ aspectRatio: '16/9', background: '#0C1A3D' }}>
                  <iframe
                    src={lesson.videoUrl.replace('watch?v=', 'embed/')}
                    style={{ width: '100%', height: '100%' }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            {/* Study Notes */}
            {lesson.linkedArticles?.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#0C1A3D' }}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-display text-navy-950 text-xl leading-none">Study Notes</h2>
                    <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                      {lesson.linkedArticles.length} {lesson.linkedArticles.length === 1 ? 'article' : 'articles'} in this lesson
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {lesson.linkedArticles.map((// eslint-disable-next-line @typescript-eslint/no-explicit-any
                    article: { _id: string; title: string; slug: { current: string }; excerpt?: string; body?: any[]; mcqUrl?: string }, ai: number) => (
                    <div
                      key={article._id}
                      className="group relative bg-white rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
                      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
                    >
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1.5"
                        style={{ background: ai === 0 ? 'linear-gradient(to bottom, #D4A017, #c49215)' : '#E2E8F0' }}
                      />
                      {/* Card top row — badge + title + link icon */}
                      <div className="pl-8 pr-6 pt-6 pb-4 flex items-start gap-5">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-sm font-black transition-all duration-200 group-hover:scale-105"
                          style={{ background: ai === 0 ? 'rgba(212,160,23,0.1)' : '#F8F7F4', color: ai === 0 ? '#B8860B' : '#94A3B8' }}
                        >
                          {ai + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3
                            className="font-display text-navy-950 leading-snug mb-2"
                            style={{ fontSize: '1.05rem', fontWeight: 600 }}
                          >
                            {article.title}
                          </h3>
                          <Link
                            href={`/articles/${article.slug.current}`}
                            target="_blank"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold transition-all hover:opacity-70"
                            style={{ color: '#94A3B8' }}
                          >
                            View original article
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </Link>
                        </div>
                      </div>

                      {/* Article body — full card width for good mobile reading */}
                      <div className="px-6 pb-4">
                        {article.body && article.body.length > 0 ? (
                          <ArticleBody body={article.body} />
                        ) : article.excerpt ? (
                          <p className="text-sm" style={{ color: '#64748B', lineHeight: 1.75 }}>
                            {article.excerpt}
                          </p>
                        ) : null}
                      </div>

                      {/* Practice questions button — only if mcqUrl exists */}
                      {article.mcqUrl && (
                        <div className="px-6 pb-6">
                          <Link
                            href={article.mcqUrl}
                            target="_blank"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:-translate-y-0.5"
                            style={{ background: 'rgba(212,160,23,0.1)', color: '#B8860B', border: '1.5px solid rgba(212,160,23,0.25)' }}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Practice Questions
                          </Link>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* External quiz */}
            {lesson.externalQuizUrl && (
              <div className="mb-10 p-5 rounded-2xl" style={{ background: 'rgba(212,160,23,0.07)', border: '1.5px solid rgba(212,160,23,0.2)' }}>
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#D4A017' }}>
                    <svg className="w-5 h-5" style={{ color: '#0C1A3D' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-navy-950 text-sm">Practice Questions</p>
                    <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Test your understanding before moving on</p>
                  </div>
                  <Link
                    href={lesson.externalQuizUrl}
                    className="h-10 px-5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all hover:-translate-y-0.5"
                    style={{ background: '#0C1A3D', color: '#fff', boxShadow: '0 4px 12px rgba(12,26,61,0.25)' }}
                  >
                    Practice
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                </div>
              </div>
            )}

            {/* Reset Lesson — above the card, only shows when lesson is complete */}
            <div className="mb-3 flex justify-end">
              <ResetLessonButton
                courseSlug={course.slug.current}
                lessonSlug={params.lessonSlug}
                allLessonSlugs={allLessons}
              />
            </div>

            {/* Mark Complete Card */}
            <div className="mb-3 rounded-3xl overflow-hidden" style={{ boxShadow: '0 8px 40px rgba(12,26,61,0.12)' }}>
              <div
                className="px-8 py-7 flex flex-col sm:flex-row sm:items-center gap-5"
                style={{ background: 'linear-gradient(135deg, #0C1A3D 0%, #162756 50%, #0e2048 100%)' }}
              >
                <div className="flex-1">
                  <p className="font-display text-white mb-1.5" style={{ fontSize: '1.35rem', lineHeight: 1.15 }}>
                    Ready to continue?
                  </p>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {isLastLesson
                      ? 'Mark this lesson complete to finish the course.'
                      : 'Mark this lesson complete and move to the next.'}
                  </p>
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

            {/* Chapter Reset — below the card */}
            <div className="mb-10 flex justify-end">
              <ResetChapterInlineButton
                courseSlug={course.slug.current}
                allLessonSlugs={allLessons}
                chapterLessonSlugs={currentChapterLessonSlugs}
              />
            </div>

            {/* Prev / Next cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-12">
              {prevLesson ? (
                <Link
                  href={`/free-courses/${course.slug.current}/learn/${prevLesson.slug}`}
                  className="flex items-center gap-3 p-5 rounded-2xl bg-white border border-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg group"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#F0EEE9' }}>
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[0.6rem] font-black uppercase tracking-[0.12em] mb-1" style={{ color: '#94A3B8' }}>Previous</p>
                    <p className="text-sm font-bold text-navy-950 leading-snug">{prevLesson.title}</p>
                  </div>
                </Link>
              ) : <div />}

              {nextLesson ? (
                <Link
                  href={`/free-courses/${course.slug.current}/learn/${nextLesson.slug}`}
                  className="flex items-center justify-end gap-3 p-5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl group text-right"
                  style={{ background: 'linear-gradient(135deg, #0C1A3D 0%, #162756 100%)', boxShadow: '0 4px 20px rgba(12,26,61,0.25)' }}
                >
                  <div className="min-w-0">
                    <p className="text-[0.6rem] font-black uppercase tracking-[0.12em] mb-1" style={{ color: 'rgba(212,160,23,0.6)' }}>Next Lesson</p>
                    <p className="text-sm font-bold text-white leading-snug">{nextLesson.title}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#D4A017', boxShadow: '0 4px 12px rgba(212,160,23,0.4)' }}>
                    <svg className="w-4 h-4" style={{ color: '#0C1A3D' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ) : (
                <Link
                  href={`/free-courses/${course.slug.current}`}
                  className="flex items-center justify-center gap-3 p-5 rounded-2xl border-2 transition-all hover:-translate-y-0.5 hover:shadow-lg"
                  style={{ borderColor: '#14b4a3', background: 'rgba(20,180,163,0.07)' }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#14b4a3' }}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-black" style={{ color: '#0d8f82' }}>Course Complete!</p>
                    <p className="text-xs font-medium" style={{ color: '#14b4a3' }}>View course overview</p>
                  </div>
                </Link>
              )}
            </div>

            {/* Footer credit */}
            <div className="flex items-center gap-2 pt-6 border-t border-slate-200">
              <svg className="w-3.5 h-3.5 shrink-0 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <p className="text-xs text-slate-400">
                Developed by <strong className="text-slate-500">Accounting Body Editorial Team</strong> · Written and reviewed by qualified accountants · Always free
              </p>
            </div>

          </div>
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION */}
      <MobileNavDrawer
        courseSlug={course.slug.current}
        chapters={course.chapters ?? []}
        totalLessons={totalLessons}
        currentLessonSlug={params.lessonSlug}
        allLessons={allLessons}
        prevLesson={prevLesson}
        nextLesson={nextLesson}
      />

    </div>
  )
}
