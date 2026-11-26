import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TIME_UP_TEXT, announcementAt, examEndAt, momentsPassedAtStart, secondsLeftAt } from './mock-exam-timer'

// ME-1 S4: the exam clock follows the real clock (a slowed background tab
// cannot stretch the exam), and the screen-reader lines come once each, at
// 10, 5 and 1 minute left and at time up.

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-26T12:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('end time and seconds left', () => {
  it('50 questions is 75 minutes; more than 50 is still 75', () => {
    const now = Date.now()
    expect(secondsLeftAt(examEndAt(now, 50), now)).toBe(4500)
    expect(secondsLeftAt(examEndAt(now, 80), now)).toBe(4500)
    expect(secondsLeftAt(examEndAt(now, 10), now)).toBe(900)
  })

  it('a tab whose timer fired late still shows the real time left', () => {
    const end = examEndAt(Date.now(), 50)
    // The tab was in the background: only one tick in 20 minutes.
    vi.advanceTimersByTime(20 * 60 * 1000)
    expect(secondsLeftAt(end, Date.now())).toBe(4500 - 1200)
    vi.advanceTimersByTime(60 * 60 * 1000)
    expect(secondsLeftAt(end, Date.now())).toBe(0)
  })

  it('part seconds round up, so 0 means the time is really up', () => {
    const end = examEndAt(Date.now(), 1)
    vi.advanceTimersByTime(89_001)
    expect(secondsLeftAt(end, Date.now())).toBe(1)
    vi.advanceTimersByTime(999)
    expect(secondsLeftAt(end, Date.now())).toBe(0)
  })
})

describe('timer lines for screen readers', () => {
  // Every line said during an exam, ticking each second of fake time.
  function run(questions: number, stepMs = 1000): string[] {
    const end = examEndAt(Date.now(), questions)
    const said = momentsPassedAtStart(secondsLeftAt(end, Date.now()))
    const lines: string[] = []
    for (;;) {
      vi.advanceTimersByTime(stepMs)
      const left = secondsLeftAt(end, Date.now())
      const line = announcementAt(left, said)
      if (line) lines.push(line)
      if (left <= 0) return lines
    }
  }

  it('a 75-minute exam says exactly the four lines, once each, in order', () => {
    expect(run(50)).toEqual(['10 minutes left.', '5 minutes left.', '1 minute left.', TIME_UP_TEXT])
    expect(TIME_UP_TEXT).toBe('Time is up. Your exam has been submitted.')
  })

  it('a short exam does not say a moment that had passed before it began', () => {
    // 5 questions = 7.5 minutes: no "10 minutes left."
    expect(run(5)).toEqual(['5 minutes left.', '1 minute left.', TIME_UP_TEXT])
  })

  it('a slow background tab says only the latest moment it jumped past', () => {
    // One tick every 7 minutes.
    const lines = run(50, 7 * 60 * 1000)
    expect(lines[lines.length - 1]).toBe(TIME_UP_TEXT)
    expect(new Set(lines).size).toBe(lines.length)
    expect(lines.length).toBeLessThanOrEqual(4)
  })

  it('says nothing above 10 minutes', () => {
    const said = new Set<number>()
    expect(announcementAt(4500, said)).toBeNull()
    expect(announcementAt(601, said)).toBeNull()
    expect(announcementAt(600, said)).toBe('10 minutes left.')
    expect(announcementAt(599, said)).toBeNull()
  })
})
