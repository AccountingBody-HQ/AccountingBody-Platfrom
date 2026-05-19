// components/course/MobileNavDrawer.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LessonStatusDot, CourseProgressBar } from '@/components/course/ProgressTracker'

interface Lesson {
  _id: string
  title: string
  slug: { current: string }
}

interface Chapter {
  _key: string
  chapterTitle: string
  lessons: Lesson[]
}

interface MobileNavDrawerProps {
  courseSlug: string
  chapters: Chapter[]
  totalLessons: number
  currentLessonSlug: string
  allLessons: string[]
  prevLesson?: { slug: string; title: string } | null
  nextLesson?: { slug: string; title: string } | null
}

export default function MobileNavDrawer({
  courseSlug,
  chapters,
  totalLessons,
  currentLessonSlug,
  allLessons,
  prevLesson,
  nextLesson,
}: MobileNavDrawerProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Fixed bottom bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
        style={{
          background: '#0C1A3D',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3">

          {/* Prev */}
          {prevLesson ? (
            <Link
              href={`/free-courses/${courseSlug}/learn/${prevLesson.slug}`}
              title={prevLesson.title}
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-95"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <svg className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.7)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          ) : (
            <div className="w-11 h-11 shrink-0" />
          )}

          {/* Course contents button */}
          <button
            onClick={() => setOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-bold transition-all active:scale-95"
            style={{ background: 'rgba(212,160,23,0.15)', color: '#D4A017', border: '1px solid rgba(212,160,23,0.3)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            Course Contents
          </button>

          {/* Next */}
          {nextLesson ? (
            <Link
              href={`/free-courses/${courseSlug}/learn/${nextLesson.slug}`}
              title={nextLesson.title}
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-95"
              style={{ background: '#D4A017', boxShadow: '0 4px 12px rgba(212,160,23,0.4)' }}
            >
              <svg className="w-4 h-4" style={{ color: '#0C1A3D' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ) : (
            <div className="w-11 h-11 shrink-0" />
          )}
        </div>
      </div>

      {/* Bottom sheet drawer */}
      {open && (
        <div className="fixed inset-0 z-[60] lg:hidden flex flex-col justify-end">

          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.65)' }}
            onClick={() => setOpen(false)}
          />

          {/* Sheet */}
          <div
            className="relative rounded-t-2xl flex flex-col"
            style={{ background: '#081428', maxHeight: '82vh' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
            </div>

            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div>
                <p className="text-[0.6rem] font-black uppercase tracking-[0.15em]" style={{ color: '#D4A017' }}>
                  Course Content
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {chapters.length} chapters · {totalLessons} lessons
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.07)' }}
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Progress bar */}
            <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              <CourseProgressBar courseSlug={courseSlug} allLessonSlugs={allLessons} />
            </div>

            {/* Chapter + lesson list */}
            <div className="overflow-y-auto flex-1" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
              {chapters.map((chapter, ci) => (
                <div key={chapter._key}>
                  <div
                    className="flex items-start gap-2 px-4 py-2.5 mt-1"
                    style={{ background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center text-[0.55rem] font-black shrink-0 mt-0.5"
                      style={{ background: '#D4A017', color: '#0C1A3D' }}
                    >
                      {ci + 1}
                    </div>
                    <p
                      className="text-[0.65rem] font-black uppercase tracking-[0.1em] leading-snug flex-1 min-w-0"
                      style={{ color: '#D4A017', overflowWrap: 'break-word', wordBreak: 'break-word' }}
                    >
                      {chapter.chapterTitle}
                    </p>
                  </div>

                  <div>
                    {chapter.lessons?.map((l, li) => {
                      const isActive = l.slug?.current === currentLessonSlug
                      return (
                        <Link
                          key={l._id}
                          href={`/free-courses/${courseSlug}/learn/${l.slug.current}`}
                          onClick={() => setOpen(false)}
                          className="flex items-start gap-3 pl-5 pr-4 py-3 transition-all"
                          style={{
                            background: isActive ? 'rgba(212,160,23,0.1)' : 'transparent',
                            borderLeft: isActive ? '3px solid #D4A017'    : '3px solid transparent',
                          }}
                        >
                          <div className="mt-0.5 shrink-0">
                            <LessonStatusDot
                              courseSlug={courseSlug}
                              lessonSlug={l.slug?.current ?? ''}
                              allLessonSlugs={allLessons}
                              isActive={isActive}
                              lessonNumber={li + 1}
                            />
                          </div>
                          <span
                            className="text-sm leading-snug flex-1 min-w-0"
                            style={{
                              color:        isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                              fontWeight:   isActive ? 700 : 400,
                              overflowWrap: 'break-word',
                              wordBreak:    'break-word',
                            }}
                          >
                            {l.title}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
