import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getLessonBySlug, getCourses, formatMinutes } from '@/lib/courses'
import VideoPlayer from '@/components/course/VideoPlayer'
import QuizRenderer from '@/components/course/QuizRenderer'
import LessonActions from './_components/LessonActions'

interface Props {
  params: { slug: string; lessonSlug: string }
}

function extractVideoEmbed(url?: string): string | null {
  if (!url) return null
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`
  const vi = url.match(/vimeo\.com\/(\d+)/)
  if (vi) return `https://player.vimeo.com/video/${vi[1]}?dnt=1`
  return null
}

export async function generateStaticParams() {
  try {
    const courses = await getCourses()
    return courses.flatMap(c =>
      (c.lessons ?? []).map(l => ({
        slug: c.slug.current,
        lessonSlug: l.slug?.current ?? '',
      })).filter(p => p.lessonSlug !== '')
    )
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: Props) {
  const data = await getLessonBySlug(params.slug, params.lessonSlug)
  if (!data) return {}
  return {
    title: `${data.lesson.title} — ${data.course.title} | AccountingBody`,
    description: `Lesson ${data.lesson.lessonNumber} of the ${data.course.title} course.`,
  }
}

export default async function LessonPage({ params }: Props) {
  const data = await getLessonBySlug(params.slug, params.lessonSlug)
  if (!data) notFound()

  const { course, lesson, prevLesson, nextLesson } = data

  return (
    <div className="min-h-screen bg-slate-50">

      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="container-site py-3 flex items-center justify-between gap-4">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 min-w-0">
            <Link href="/study/courses" className="hover:text-navy-700 transition-colors shrink-0">Courses</Link>
            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
            </svg>
            <Link href={`/study/courses/${course.slug.current}`} className="hover:text-navy-700 truncate max-w-[160px] transition-colors">
              {course.title}
            </Link>
            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
            </svg>
            <span className="text-slate-600 truncate">Lesson {lesson.lessonNumber}</span>
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            {prevLesson && (
              <Link
                href={`/study/courses/${course.slug.current}/lessons/${prevLesson.slug.current}`}
                className="h-8 px-3 flex items-center gap-1 text-xs font-medium rounded-lg border border-slate-300 text-slate-700 hover:border-navy-950 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18"/>
                </svg>
                Prev
              </Link>
            )}
            {nextLesson && (
              <Link
                href={`/study/courses/${course.slug.current}/lessons/${nextLesson.slug.current}`}
                className="h-8 px-3 flex items-center gap-1 text-xs font-medium rounded-lg bg-navy-950 text-white hover:bg-navy-900 transition-colors"
              >
                Next
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                </svg>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="container-site py-10">
        <div className="max-w-3xl mx-auto space-y-10">

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Lesson {lesson.lessonNumber}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                  <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2"/>
                </svg>
                {formatMinutes(lesson.estimatedTime)}
              </span>
            </div>
            <h1 className="font-display text-3xl text-navy-950 leading-tight" style={{ letterSpacing: '-0.02em' }}>
              {lesson.title}
            </h1>
          </div>

          {lesson.videoUrl && (
            <div>
              <h2 className="font-display text-lg text-navy-950 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-navy-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="1.75" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                  <path strokeLinecap="round" strokeWidth="1.75" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Video lesson
              </h2>
              <VideoPlayer url={lesson.videoUrl} title={lesson.title} />
            </div>
          )}

          {lesson.audioUrl && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-display text-lg text-navy-950 mb-4">Audio lesson</h2>
              {lesson.audioUrl.includes('spotify.com') || lesson.audioUrl.includes('anchor.fm') ? (
                <iframe
                  src={lesson.audioUrl}
                  className="w-full rounded-lg"
                  height="152"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                />
              ) : (
                <audio controls className="w-full" src={lesson.audioUrl}>
                  Your browser does not support audio playback.
                </audio>
              )}
            </div>
          )}

          {lesson.articles.length > 0 && (
            <div>
              <h2 className="font-display text-lg text-navy-950 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-navy-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="1.75" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                Study notes for this lesson
              </h2>
              <div className="space-y-4">
                {lesson.articles.map(art => {
                  const embedUrl = extractVideoEmbed(art.videoUrl)
                  return (
                    <div key={art._id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      {embedUrl && (
                        <div className="aspect-video bg-navy-950">
                          <iframe
                            src={embedUrl}
                            title={art.title}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            loading="lazy"
                          />
                        </div>
                      )}
                      <div className="p-5">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          {art.examBody && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded text-white ${
                              art.examBody === 'ACCA' ? 'bg-[#004B8D]' :
                              art.examBody === 'CIMA' ? 'bg-[#0081C6]' :
                              art.examBody === 'AAT'  ? 'bg-[#00857A]' :
                              'bg-navy-950'
                            }`}>{art.examBody}</span>
                          )}
                          {art.category && (
                            <span className="text-xs text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                              {art.category}
                            </span>
                          )}
                        </div>
                        <h3 className="font-display text-navy-950 leading-snug mb-2">{art.title}</h3>
                        {art.excerpt && (
                          <p className="text-sm text-slate-500 leading-relaxed mb-4">{art.excerpt}</p>
                        )}
                        <div className="flex items-center justify-between">
                          {art.readTime && (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                                <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2"/>
                              </svg>
                              {art.readTime} min read
                            </span>
                          )}
                          <Link
                            href={`/articles/${art.slug.current}`}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy-700 hover:text-gold-500 transition-colors"
                          >
                            Read further
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                            </svg>
                          </Link>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {lesson.quizQuestions && lesson.quizQuestions.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="font-display text-lg text-navy-950 mb-1 flex items-center gap-2">
                <svg className="w-5 h-5 text-navy-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="1.75" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Check your understanding
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                {lesson.quizQuestions.length} question{lesson.quizQuestions.length !== 1 ? 's' : ''} — select your answers then submit to see your score.
              </p>
              <QuizRenderer questions={lesson.quizQuestions} />
            </div>
          )}

          {lesson.externalQuizUrl && (
            <div className="flex items-center gap-4 bg-navy-50 border border-navy-200 rounded-xl p-5">
              <div className="w-10 h-10 rounded-xl bg-navy-950 flex items-center justify-center text-white shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="1.75" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-navy-950 text-sm">More practice questions</p>
                <p className="text-xs text-slate-500 mt-0.5">Additional exam-standard questions on this topic in our question bank.</p>
              </div>
              <a
                href={lesson.externalQuizUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors"
              >
                Practice now
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
              </a>
            </div>
          )}

          <LessonActions
            courseSlug={course.slug.current}
            lessonSlug={lesson.slug.current}
            prevHref={prevLesson ? `/study/courses/${course.slug.current}/lessons/${prevLesson.slug.current}` : null}
            nextHref={nextLesson ? `/study/courses/${course.slug.current}/lessons/${nextLesson.slug.current}` : null}
            prevTitle={prevLesson?.title ?? null}
            nextTitle={nextLesson?.title ?? null}
            courseHref={`/study/courses/${course.slug.current}`}
            isLastLesson={!nextLesson}
          />

        </div>
      </div>
    </div>
  )
}
