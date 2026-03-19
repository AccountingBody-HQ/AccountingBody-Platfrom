import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  getCourseBySlug, getCourses,
  formatMinutes, levelColour, examBodyColour,
} from '@/lib/courses'
import CourseProgressBar from './_components/CourseProgressBar'

interface Props { params: { slug: string } }

export async function generateStaticParams() {
  try {
    const courses = await getCourses()
    return courses.map(c => ({ slug: c.slug.current }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: Props) {
  const course = await getCourseBySlug(params.slug)
  if (!course) return {}
  return {
    title: `${course.title} | AccountingBody`,
    description: course.description,
  }
}

export default async function CoursePage({ params }: Props) {
  const course = await getCourseBySlug(params.slug)
  if (!course || !course.examBody) notFound()

  const sorted = [...(course.lessons ?? [])].sort((a, b) => a.lessonNumber - b.lessonNumber)
  const lc = levelColour(course.level)
  const accentBg = examBodyColour(course.examBody)
  const totalQuizQuestions = sorted.reduce((sum, l) => sum + (l.quizQuestions?.length ?? 0), 0)

  return (
    <>
      <section className="bg-navy-950 relative overflow-hidden pt-12 pb-16">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
        <div className="container-site relative z-10">
          <nav className="flex items-center gap-2 text-xs text-white/40 mb-8">
            <Link href="/study/courses" className="hover:text-white/70 transition-colors">Courses</Link>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
            </svg>
            <span className="text-white/60">{course.examBody}</span>
          </nav>

          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${accentBg} text-white`}>
                {course.examBody}
              </span>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${lc.bg} ${lc.text} ${lc.border}`}>
                {course.level}
              </span>
            </div>

            <h1 className="font-display text-white mb-4 leading-tight" style={{ letterSpacing: '-0.02em' }}>
              {course.title}
            </h1>

            <p className="text-white/65 text-lg leading-relaxed mb-8 max-w-2xl">
              {course.longDescription ?? course.description}
            </p>

            <div className="flex flex-wrap items-center gap-6 mb-8">
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="1.75" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                </svg>
                {sorted.length} lessons
              </div>
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="1.75" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                {formatMinutes(course.estimatedTime)}
              </div>
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="1.75" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                </svg>
                {totalQuizQuestions} quiz questions
              </div>
            </div>

            <Link
              href={`/study/courses/${course.slug.current}/lessons/${sorted[0].slug.current}`}
              className="inline-flex items-center gap-2 h-12 px-7 rounded-lg font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold text-sm"
            >
              Start course
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <CourseProgressBar courseSlug={course.slug.current} totalLessons={sorted.length} />

      <section className="section bg-slate-50">
        <div className="container-site max-w-3xl">
          <h2 className="font-display text-2xl text-navy-950 mb-8">Course lessons</h2>
          <div className="space-y-3">
            {sorted.map((lesson, i) => (
              <details key={lesson._id} className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                <summary className="flex items-center gap-4 p-5 cursor-pointer select-none list-none hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-navy-50 flex items-center justify-center text-navy-700 text-xs font-bold shrink-0">
                    {lesson.lessonNumber}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-navy-950 text-sm truncate">{lesson.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                          <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2"/>
                        </svg>
                        {formatMinutes(lesson.estimatedTime)}
                      </span>
                      {lesson.videoUrl && (
                        <span className="text-xs text-slate-400">Video</span>
                      )}
                      {lesson.quizQuestions?.length ? (
                        <span className="text-xs text-slate-400">{lesson.quizQuestions.length} questions</span>
                      ) : null}
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                  </svg>
                </summary>

                <div className="px-5 pb-5 pt-0 border-t border-slate-100">
                  {lesson.articles.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Study notes in this lesson</p>
                      {lesson.articles.map(art => (
                        <div key={art._id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                          <svg className="w-4 h-4 text-navy-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                          </svg>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-navy-950 leading-snug">{art.title}</p>
                            {art.readTime && (
                              <p className="text-xs text-slate-400 mt-0.5">{art.readTime} min read</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-3">
                    <Link
                      href={`/study/courses/${course.slug.current}/lessons/${lesson.slug.current}`}
                      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors"
                    >
                      {i === 0 ? 'Start lesson' : 'Go to lesson'}
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                      </svg>
                    </Link>
                    {lesson.externalQuizUrl && (
                      <a
                        href={lesson.externalQuizUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-medium border border-slate-300 text-slate-700 hover:border-navy-950 transition-colors"
                      >
                        Practice questions
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white border-t border-slate-200 py-10">
        <div className="container-site text-center">
          <p className="font-display text-xl text-navy-950 mb-2">Can&apos;t find your qualification?</p>
          <p className="text-slate-500 text-sm mb-6">More courses are added every month. Browse our study notes in the meantime.</p>
          <Link href="/study" className="inline-flex items-center gap-2 h-10 px-6 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors">
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
