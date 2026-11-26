// lib/mock-exam-timer.ts — the mock-exam clock (components/course/MockExamClient.tsx).
//
// The exam keeps its end time and works out the seconds left from the real
// clock on every tick, so a browser that slows timers in a background tab
// cannot make the exam longer. Screen-reader users hear a short line at 10,
// 5 and 1 minute left and when time is up, once each.

export const SECONDS_PER_QUESTION = 90

/** The end time of an exam of `questions` questions started at `now`. */
export function examEndAt(now: number, questions: number): number {
  return now + Math.min(questions, 50) * SECONDS_PER_QUESTION * 1000
}

/** Whole seconds left at `now`, never below 0. */
export function secondsLeftAt(endAt: number, now: number): number {
  return Math.max(0, Math.ceil((endAt - now) / 1000))
}

export const TIME_UP_TEXT = 'Time is up. Your exam has been submitted.'

// Ascending, so the first one reached is the one to say.
const MOMENTS: readonly [number, string][] = [
  [0, TIME_UP_TEXT],
  [60, '1 minute left.'],
  [300, '5 minutes left.'],
  [600, '10 minutes left.'],
]

/** The moments already past when an exam of this length starts: never said. */
export function momentsPassedAtStart(totalSeconds: number): Set<number> {
  return new Set(MOMENTS.map(([at]) => at).filter(at => at >= totalSeconds && at > 0))
}

/**
 * The line to say at `seconds` left, or null. `said` holds the moments
 * already said (or passed at the start) and is updated: a moment is said
 * once, and when a slow tick jumps past several, only the latest is said.
 */
export function announcementAt(seconds: number, said: Set<number>): string | null {
  const due = MOMENTS.find(([at]) => seconds <= at)
  if (!due || said.has(due[0])) return null
  for (const [at] of MOMENTS) if (at >= due[0]) said.add(at)
  return due[1]
}
