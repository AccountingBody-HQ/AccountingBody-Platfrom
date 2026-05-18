// components/course/ProgressTracker.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'

const getKey = (courseSlug: string) => `course_progress_${courseSlug}`

export function useProgress(courseSlug: string, allLessonSlugs: string[]) {
  const [completed, setCompleted] = useState<string[]>([])
  const [mounted, setMounted]     = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(getKey(courseSlug))
      if (stored) setCompleted(JSON.parse(stored))
    } catch { /* silent */ }
    setMounted(true)
  }, [courseSlug])

  const markComplete = useCallback((lessonSlug: string) => {
    setCompleted(prev => {
      if (prev.includes(lessonSlug)) return prev
      const next = [...prev, lessonSlug]
      try { localStorage.setItem(getKey(courseSlug), JSON.stringify(next)) } catch { /* silent */ }
      return next
    })
  }, [courseSlug])

  const isComplete  = useCallback((s: string) => completed.includes(s), [completed])
  const progressPct = allLessonSlugs.length > 0
    ? Math.round((completed.filter(s => allLessonSlugs.includes(s)).length / allLessonSlugs.length) * 100)
    : 0

  const resetProgress = useCallback(() => {
    try { localStorage.removeItem(getKey(courseSlug)) } catch { /* silent */ }
    setCompleted([])
  }, [courseSlug])

  return { completed, markComplete, isComplete, progressPct, mounted, resetProgress }
}

interface MarkCompleteButtonProps {
  courseSlug: string; lessonSlug: string; allLessonSlugs: string[]; nextHref?: string
}

export default function MarkCompleteButton({ courseSlug, lessonSlug, allLessonSlugs, nextHref }: MarkCompleteButtonProps) {
  const { isComplete, markComplete, mounted } = useProgress(courseSlug, allLessonSlugs)
  if (!mounted) return null
  const done = isComplete(lessonSlug)

  function handleClick() {
    markComplete(lessonSlug)
    if (nextHref) window.location.href = nextHref
  }

  if (done) {
    return (
      <div className="inline-flex items-center gap-2.5 h-12 px-6 rounded-xl text-sm font-bold" style={{ background: 'rgba(20,180,163,0.12)', color: '#0d8f82', border: '1.5px solid rgba(20,180,163,0.3)' }}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
        </svg>
        Lesson Complete
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-2.5 h-12 px-7 rounded-xl text-sm font-bold transition-all duration-200 hover:-translate-y-0.5"
      style={{ background: 'linear-gradient(135deg, #D4A017 0%, #c49215 100%)', color: '#0C1A3D', boxShadow: '0 4px 16px rgba(212,160,23,0.35)' }}
    >
      Mark as complete
      {nextHref && (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      )}
    </button>
  )
}

interface ResetProgressButtonProps { courseSlug: string; allLessonSlugs: string[] }

export function ResetProgressButton({ courseSlug, allLessonSlugs }: ResetProgressButtonProps) {
  const { resetProgress, mounted, progressPct } = useProgress(courseSlug, allLessonSlugs)
  if (!mounted) return null
  return (
    <button
      onClick={() => { if (progressPct === 0) return; if (window.confirm('Reset your progress for this course?')) { resetProgress(); window.location.reload() } }}
      className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
      style={{ color: progressPct === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.35)', cursor: progressPct === 0 ? 'default' : 'pointer' }}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      Reset progress
    </button>
  )
}

interface LessonStatusProps {
  courseSlug: string; lessonSlug: string; allLessonSlugs: string[]; isActive: boolean; lessonNumber: number
}

export function LessonStatusDot({ courseSlug, lessonSlug, allLessonSlugs, isActive, lessonNumber }: LessonStatusProps) {
  const { isComplete, mounted } = useProgress(courseSlug, allLessonSlugs)
  const done = mounted && isComplete(lessonSlug)

  if (done) {
    return (
      <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: '#14b4a3' }}>
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    )
  }

  return (
    <span
      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[0.6rem] font-bold"
      style={{
        background: isActive ? '#D4A017' : 'rgba(255,255,255,0.08)',
        color:      isActive ? '#0C1A3D' : 'rgba(255,255,255,0.3)',
        border:     isActive ? 'none' : '1px solid rgba(255,255,255,0.1)',
      }}
    >
      {lessonNumber}
    </span>
  )
}

interface CourseProgressBarProps { courseSlug: string; allLessonSlugs: string[] }

export function CourseProgressBar({ courseSlug, allLessonSlugs }: CourseProgressBarProps) {
  const { progressPct, mounted } = useProgress(courseSlug, allLessonSlugs)
  if (!mounted) return null
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-28 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progressPct}%`, background: '#D4A017' }} />
      </div>
      <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>{progressPct}% done</span>
    </div>
  )
}

interface PositionRingProps { current: number; total: number }

export function PositionRing({ current, total }: PositionRingProps) {
  const pct  = total > 0 ? Math.round((current / total) * 100) : 0
  const r    = 16
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <div className="relative w-10 h-10 shrink-0">
      <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle cx="20" cy="20" r={r} fill="none" stroke="#D4A017" strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[0.6rem] font-bold" style={{ color: '#D4A017' }}>
        {pct}%
      </span>
    </div>
  )
}
