// app/free-courses/[slug]/learn/[lessonSlug]/page.tsx
// Course lesson player under /free-courses canonical URL

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
        if (lesson.slug?.current) {
          params.push({ slug: c.slug.current, lessonSlug: lesson.slug.current })
        }
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
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Top bar */}
      <header className="bg-navy-950 border-b border-white/10 sticky top-16 z-30">
        <div className="container-site py-3 flex items-center gap-4">
          <Link href={`/free-courses/${course.slug.current}`}
            className="shrink-0 flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline truncate max-w-[180px]">{course.title}</span>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{lesson.title}</p>
            <p className="text-white/40 text-xs mt-0.5 truncate">{chapterTitle}</p>
          </div>
          <div className="shrink-0 flex items-center gap-3">
            <div className="hidden sm:block">
              <CourseProgressBar courseSlug={course.slug.current} allLessonSlugs={allLessons} />
            </div>
            <span className="text-xs text-white/40 bg-white/10 px-2 py-1 rounded-lg">
              {currentIdx + 1} / {totalLessons}
            </span>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 container-site gap-0 py-0">

        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-72 shrink-0 border-r border-slate-200 bg-white min-h-[calc(100vh-128px)] sticky top-32 self-start max-h-[calc(100vh-128px)] overflow-y-auto">
          <div className="p-4 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Course Content</p>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {course.chapters?.map((chapter, ci) => (
              <div key={chapter._key} className="mb-1">
                <div className="flex items-center gap-2 px-4 py-2.5">
                  <span className="w-5 h-5 rounded bg-navy-950 text-white text-[0.6rem] font-bold flex items-center justify-center shrink-0">{ci + 1}</span>
                  <p className="text-xs font-semibold text-navy-950 leading-snug">{chapter.chapterTitle}</p>
                </div>
                {chapter.lessons?.map((l, li) => {
                  const isActive = l.slug?.current === params.lessonSlug
                  return (
                    <Link key={l._id}
                      href={`/free-courses/${course.slug.current}/learn/${l.slug.current}`}
                      className={['flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                        isActive ? 'bg-navy-50 border-r-2 border-navy-950 text-navy-950 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-navy-950',
                      ].join(' ')}>
                      <LessonStatusDot courseSlug={course.slug.current} lessonSlug={l.slug.current} allLessonSlugs={allLessons} isActive={isActive} lessonNumber={li + 1} />
                      <span className="leading-snug">{l.title}</span>
                    </Link>
                  )
                })}
              </div>
            ))}
          </div>
        </aside>

        {/* Lesson content */}
        <main className="flex-1 min-w-0 py-8 lg:px-10">
          <div className="mb-6">
            <p className="text-xs font-semibold text-gold-600 uppercase tracking-widest mb-1">{chapterTitle}</p>
            <h1 className="font-display text-navy-950 text-2xl md:text-3xl leading-tight">{lesson.title}</h1>
          </div>

          {lesson.videoUrl && (
            <div className="mb-8 rounded-xl overflow-hidden border border-slate-200 shadow-sm aspect-video bg-navy-950">
              <iframe src={lesson.videoUrl.replace('watch?v=', 'embed/')} className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          )}

          {lesson.linkedArticles?.length > 0 && (
            <div className="mb-8">
              <h2 className="font-display text-xl text-navy-950 mb-4">Study Notes</h2>
              <div className="space-y-4">
                {lesson.linkedArticles.map((article, ai) => (
                  <div key={article._id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-lg bg-navy-50 border border-navy-100 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-navy-700">{ai + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link href={`/articles/${article.slug.current}`} target="_blank"
                          className="font-display text-navy-950 hover:text-navy-700 transition-colors leading-snug block mb-1">
                          {article.title}
                        </Link>
                        {article.excerpt && <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">{article.excerpt}</p>}
                        <Link href={`/articles/${article.slug.current}`} target="_blank"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-navy-700 hover:text-gold-500 transition-colors mt-2">
                          Read full article
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mark complete + reset */}
          <div className="mt-8 flex items-center gap-4">
            <MarkCompleteButton
              courseSlug={course.slug.current}
              lessonSlug={params.lessonSlug}
              allLessonSlugs={allLessons}
              nextHref={nextLesson ? `/free-courses/${course.slug.current}/learn/${nextLesson.slug}` : undefined}
            />
            <ResetProgressButton courseSlug={course.slug.current} allLessonSlugs={allLessons} />
          </div>

          {/* Prev / Next */}
          <div className="mt-6 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-stretch gap-3">
            {prevLesson ? (
              <Link href={`/free-courses/${course.slug.current}/learn/${prevLesson.slug}`}
                className="flex-1 flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:border-navy-950 hover:shadow-md transition-all group">
                <svg className="w-5 h-5 text-slate-400 group-hover:text-navy-950 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 mb-0.5">Previous</p>
                  <p className="text-sm font-semibold text-navy-950 truncate">{prevLesson.title}</p>
                </div>
              </Link>
            ) : <div className="flex-1" />}
            {nextLesson ? (
              <Link href={`/free-courses/${course.slug.current}/learn/${nextLesson.slug}`}
                className="flex-1 flex items-center justify-end gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:border-navy-950 hover:shadow-md transition-all group text-right">
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 mb-0.5">Next</p>
                  <p className="text-sm font-semibold text-navy-950 truncate">{nextLesson.title}</p>
                </div>
                <svg className="w-5 h-5 text-slate-400 group-hover:text-navy-950 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              </Link>
            ) : (
              <Link href={`/free-courses/${course.slug.current}`}
                className="flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-teal-500 bg-teal-50 hover:bg-teal-100 transition-colors">
                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-sm font-semibold text-teal-700">Course Complete — Back to Overview</span>
              </Link>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
