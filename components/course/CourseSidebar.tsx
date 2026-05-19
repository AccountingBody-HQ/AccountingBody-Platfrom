// components/course/CourseSidebar.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LessonStatusDot, ResetProgressButton, ResetChapterButton } from '@/components/course/ProgressTracker'

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

interface CourseSidebarProps {
  courseSlug: string
  chapters: Chapter[]
  totalLessons: number
  currentLessonSlug: string
  allLessons: string[]
}

export default function CourseSidebar({
  courseSlug,
  chapters,
  totalLessons,
  currentLessonSlug,
  allLessons,
}: CourseSidebarProps) {
  const [openChapters, setOpenChapters] = useState<Record<number, boolean>>(
    Object.fromEntries(chapters.map((_, i) => [i, true]))
  )

  const toggle = (i: number) =>
    setOpenChapters(prev => ({ ...prev, [i]: !prev[i] }))

  return (
    <aside
      className="hidden lg:flex flex-col shrink-0"
      style={{
        width: 'clamp(240px, 24vw, 340px)',
        background: '#081428',
        position: 'sticky',
        top: 'calc(4rem + 56px)',
        maxHeight: 'calc(100vh - 4rem - 56px)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <p className="text-[0.6rem] font-black uppercase tracking-[0.15em] mb-1" style={{ color: '#D4A017' }}>
          Course Content
        </p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {chapters.length} chapters · {totalLessons} lessons
        </p>
      </div>

      {/* Chapter list */}
      <div className="flex-1 overflow-y-auto">
        {chapters.map((chapter, ci) => {
          const isOpen = openChapters[ci] !== false
          const chapterLessonSlugs = chapter.lessons?.map(l => l.slug?.current ?? '') ?? []

          return (
            <div key={chapter._key}>
              {/* Chapter header */}
              <button
                onClick={() => toggle(ci)}
                className="w-full flex items-start gap-2 px-4 py-3 mt-1 text-left transition-opacity hover:opacity-80"
                style={{ background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.05)' }}
              >
                <div
                  className="w-5 h-5 rounded flex items-center justify-center text-[0.55rem] font-black shrink-0 mt-0.5"
                  style={{ background: '#D4A017', color: '#0C1A3D' }}
                >
                  {ci + 1}
                </div>
                <p
                  className="text-[0.65rem] font-black uppercase tracking-[0.1em] leading-snug flex-1 min-w-0 text-left"
                  style={{ color: '#D4A017', overflowWrap: 'break-word', wordBreak: 'break-word' }}
                >
                  {chapter.chapterTitle}
                </p>
                <div className="flex items-center gap-1 shrink-0 ml-1 mt-0.5">
                  <div onClick={e => e.stopPropagation()}>
                    <ResetChapterButton
                      courseSlug={courseSlug}
                      allLessonSlugs={allLessons}
                      chapterLessonSlugs={chapterLessonSlugs}
                    />
                  </div>
                  <svg
                    className="w-3 h-3 transition-transform duration-200 shrink-0"
                    style={{ color: 'rgba(212,160,23,0.5)', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Lessons */}
              {isOpen && (
                <div className="pb-1">
                  {chapter.lessons?.map((l, li) => {
                    const isActive = l.slug?.current === currentLessonSlug
                    return (
                      <Link
                        key={l._id}
                        href={`/free-courses/${courseSlug}/learn/${l.slug.current}`}
                        className="flex items-start gap-3 pl-5 pr-4 py-2.5 transition-all duration-150"
                        style={{
                          background: isActive ? 'rgba(212,160,23,0.1)' : 'transparent',
                          borderLeft: isActive ? '3px solid #D4A017'    : '3px solid transparent',
                        }}
                      >
                        <div className="mt-0.5 shrink-0">
                          <LessonStatusDot
                            courseSlug={courseSlug}
                            lessonSlug={l.slug.current}
                            allLessonSlugs={allLessons}
                            isActive={isActive}
                            lessonNumber={li + 1}
                          />
                        </div>
                        <span
                          className="text-sm leading-snug flex-1 min-w-0"
                          style={{
                            color:        isActive ? '#ffffff' : 'rgba(255,255,255,0.55)',
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
              )}
            </div>
          )
        })}
      </div>

      {/* Footer — Course Reset */}
      <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <span className="text-[0.6rem] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Progress
        </span>
        <ResetProgressButton courseSlug={courseSlug} allLessonSlugs={allLessons} />
      </div>
    </aside>
  )
}
