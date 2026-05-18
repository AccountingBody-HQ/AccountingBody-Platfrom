// components/course/ProgressTracker.tsx
// Tracks completed lessons in localStorage — no auth required
// Key format: course_progress_[courseSlug] = ["lessonSlug1", "lessonSlug2", ...]

'use client'

import { useEffect, useState, useCallback } from 'react'

const getKey = (courseSlug: string) => `course_progress_${courseSlug}`

export function useProgress(courseSlug: string, allLessonSlugs: string[]) {
  const [completed, setCompleted] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(getKey(courseSlug))
      if (stored) setCompleted(JSON.parse(stored))
    } catch {
      // localStorage unavailable — silent fail
    }
    setMounted(true)
  }, [courseSlug])

  const markComplete = useCallback((lessonSlug: string) => {
    setCompleted(prev => {
      if (prev.includes(lessonSlug)) return prev
      const next = [...prev, lessonSlug]
      try {
        localStorage.setItem(getKey(courseSlug), JSON.stringify(next))
      } catch {
        // silent fail
      }
      return next
    })
  }, [courseSlug])

  const isComplete = useCallback((lessonSlug: string) => {
    return completed.includes(lessonSlug)
  }, [completed])

  const progressPct = allLessonSlugs.length > 0
    ? Math.round((completed.filter(s => allLessonSlugs.includes(s)).length / allLessonSlugs.length) * 100)
    : 0

  const resetProgress = useCallback(() => {
    try {
      localStorage.removeItem(getKey(courseSlug))
    } catch {
      // silent fail
    }
    setCompleted([])
  }, [courseSlug])

  return { completed, markComplete, isComplete, progressPct, mounted, resetProgress }
}

// ── Mark Complete Button ────────────────────────────────────────────────────

interface MarkCompleteButtonProps {
  courseSlug:  string
  lessonSlug:  string
  allLessonSlugs: string[]
  nextHref?:   string
}

export default function MarkCompleteButton({
  courseSlug,
  lessonSlug,
  allLessonSlugs,
  nextHref,
}: MarkCompleteButtonProps) {
  const { isComplete, markComplete, mounted } = useProgress(courseSlug, allLessonSlugs)

  if (!mounted) return null

  const done = isComplete(lessonSlug)

  function handleClick() {
    markComplete(lessonSlug)
    if (nextHref) {
      window.location.href = nextHref
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={done}
      className={[
        'inline-flex items-center gap-2 h-11 px-6 rounded-lg text-sm font-semibold transition-all',
        done
          ? 'bg-teal-500 text-white cursor-default'
          : 'bg-navy-950 text-white hover:bg-navy-900 cursor-pointer',
      ].join(' ')}
    >
      {done ? (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          Completed
        </>
      ) : (
        <>
          Mark as complete
          {nextHref && (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          )}
        </>
      )}
    </button>
  )
}

// ── Sidebar lesson status dot ───────────────────────────────────────────────

interface LessonStatusProps {
  courseSlug:     string
  lessonSlug:     string
  allLessonSlugs: string[]
  isActive:       boolean
  lessonNumber:   number
}

export function LessonStatusDot({
  courseSlug,
  lessonSlug,
  allLessonSlugs,
  isActive,
  lessonNumber,
}: LessonStatusProps) {
  const { isComplete, mounted } = useProgress(courseSlug, allLessonSlugs)
  const done = mounted && isComplete(lessonSlug)

  if (done) {
    return (
      <span className="w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center shrink-0">
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    )
  }

  return (
    <span className={[
      'w-5 h-5 rounded-full border flex items-center justify-center text-[0.6rem] shrink-0',
      isActive ? 'border-navy-950 bg-navy-950 text-white' : 'border-slate-300 text-slate-400',
    ].join(' ')}>
      {lessonNumber}
    </span>
  )
}

// ── Course progress bar (client) ────────────────────────────────────────────

interface CourseProgressBarProps {
  courseSlug:     string
  allLessonSlugs: string[]
}

export function CourseProgressBar({ courseSlug, allLessonSlugs }: CourseProgressBarProps) {
  const { progressPct, mounted } = useProgress(courseSlug, allLessonSlugs)
  if (!mounted) return null

  return (
    <div className="flex items-center gap-3">
      <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gold-500 rounded-full transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <span className="text-xs text-white/40">{progressPct}%</span>
    </div>
  )
}
