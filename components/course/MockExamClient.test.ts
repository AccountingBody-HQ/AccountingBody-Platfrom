import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// ME-1 S4: the exam screen — the clock follows its end time, one polite
// live region speaks only the timer lines, a failed fresh exam is shown on
// the results screen, the fresh-exam button waits while loading, the AB
// results link names the hub, and the next attempt starts with no review
// open. Source checks, in the style of lib/a11y-followups.test.ts.
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const count = (src: string, re: RegExp) => (src.match(re) || []).length
const src = read('components/course/MockExamClient.tsx')
const results = src.slice(src.indexOf("if (phase === 'results') {"), src.indexOf('// ── EXAM ──'))
const exam = src.slice(src.indexOf('// ── EXAM ──'))
const loadExam = src.slice(src.indexOf('const loadExam = useCallback'), src.indexOf('}, [level, module, apiPath])'))

describe('exam clock', () => {
  it('keeps an end time and works out the seconds left on each tick', () => {
    expect(loadExam).toMatch(/endAtRef\.current = examEndAt\(now, data\.questions\.length\)/)
    expect(src).toMatch(/const left = secondsLeftAt\(endAtRef\.current, Date\.now\(\)\)/)
    // No counting down by one per tick any more.
    expect(src).not.toMatch(/setSecondsLeft\(s => s - 1\)/)
    expect(src).toMatch(/setInterval\(tick, 1000\)/)
    expect(src).toMatch(/\}, \[phase\]\)/)
  })

  it('submits at time up', () => {
    expect(src).toMatch(/if \(left <= 0\) \{[\s\S]{0,120}setPhase\('results'\)/)
  })
})

describe('timer lines for screen readers', () => {
  it('one sr-only polite region, shown in every phase, holding only the timer line', () => {
    expect(src).toContain('const timerLive = <p className="sr-only" aria-live="polite">{announcement}</p>')
    expect(count(src, /\{timerLive\}/g)).toBe(3)
    // The announcement is only ever a timer line or empty.
    const sets = Array.from(src.matchAll(/setAnnouncement\(([^)]*)\)/g)).map(m => m[1])
    expect(new Set(sets)).toEqual(new Set(["''", 'line', 'TIME_UP_TEXT']))
  })

  it('the moments already past at the start are never said', () => {
    expect(loadExam).toMatch(/saidRef\.current = momentsPassedAtStart\(total\)/)
    expect(loadExam).toMatch(/setAnnouncement\(''\)/)
  })
})

describe('results screen', () => {
  it('shows the error in the same box as the intro, with the existing texts only', () => {
    const box = '{error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">{error}</p>}'
    expect(count(src, new RegExp(box.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toBe(2)
    expect(results).toContain(box)
    const texts = Array.from(src.matchAll(/setError\(([^)]*)\)/g)).map(m => m[1])
    expect(texts).toEqual(["''", "data.error || 'No questions available yet.'", "'Could not load the exam. Please try again.'"])
  })

  it('"Take a fresh exam" is disabled while loading and says "Preparing your exam…"', () => {
    expect(results).toMatch(/<button onClick=\{loadExam\} disabled=\{loading\}[^>]*>\{loading \? 'Preparing your exam…' : 'Take a fresh exam'\}<\/button>/)
  })

  it('the AB results link says "Back to Mock Exams"; ETICPA keeps "Back to module"', () => {
    expect(results).toContain('{backHref === "/mock-exams" ? "Back to Mock Exams" : "Back to module"}</Link>')
    expect(results).not.toMatch(/>Back to module<\/Link>/)
  })

  it('a new attempt starts with no answer review open', () => {
    expect(loadExam).toMatch(/setReviewIdx\(null\)/)
  })
})

describe('low-time colour', () => {
  it('the low-time red is #b91c1c (4.5:1 or better on #fef2f2)', () => {
    expect(exam).toContain("color: secondsLeft < 300 ? '#b91c1c' : GREEN")
    expect(src).not.toContain('#dc2626')
  })
})
