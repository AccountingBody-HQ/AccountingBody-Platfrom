import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import MockExamClient from '@/components/course/MockExamClient'
import {
  CONTINUE_TEXT, FLAGGED_TEXT, FLAG_TEXT, NOT_SAVING_TEXT, START_NEW_TEXT, TOPIC_HEADING,
  attemptRecord, flaggedLine, lastResultLine, resultHistoryItem, resumeAttempt, toggleFlag, unfinishedAttemptLine,
} from './mock-exam-progress'
import { MAX_ATTEMPT_MS, addHistory, deviceStorage, lastResult, mockAttemptKey, readAttempt, saveAttempt, type StorageLike, type StoredQuestion } from './practice-store'

;(globalThis as { React?: typeof React }).React = React

// PQB-3 S2 (D351, D347): the mock exam's on-device progress — resume, flags,
// score by topic, last result. Pure flows with a fake storage; the
// component's first render (no storage read yet) is exactly today's markup.

class FakeStorage implements StorageLike {
  map = new Map<string, string>()
  get length() { return this.map.size }
  key(i: number) { return Array.from(this.map.keys())[i] ?? null }
  getItem(k: string) { return this.map.has(k) ? (this.map.get(k) as string) : null }
  setItem(k: string, v: string) { this.map.set(k, v) }
  removeItem(k: string) { this.map.delete(k) }
}
const NOW = Date.UTC(2026, 10, 27, 12, 0, 0)
const q = (topic: string, correctIndex = 0): StoredQuestion => ({ questionText: 'Q', options: ['a', 'b', 'c', 'd'], correctIndex, topic })

describe('wording (exact)', () => {
  it('the new visible texts', () => {
    expect(CONTINUE_TEXT).toBe('Continue my attempt')
    expect(START_NEW_TEXT).toBe('Start a new attempt')
    expect(FLAG_TEXT).toBe('Flag for review')
    expect(FLAGGED_TEXT).toBe('Flagged')
    expect(TOPIC_HEADING).toBe('Your score by topic')
    expect(NOT_SAVING_TEXT).toBe('This device is not saving your progress. You can still finish this exam.')
  })

  it('unfinished attempt line: {m} min {s} s', () => {
    expect(unfinishedAttemptLine(2712)).toBe('You have an unfinished attempt on this device with 45 min 12 s left.')
    expect(unfinishedAttemptLine(59)).toBe('You have an unfinished attempt on this device with 0 min 59 s left.')
    expect(unfinishedAttemptLine(4500)).toBe('You have an unfinished attempt on this device with 75 min 0 s left.')
  })

  it('last result line with the date as d MMMM yyyy', () => {
    expect(lastResultLine({ score: 31, total: 50, pct: 62, at: NOW }, 'UTC')).toBe('Your last result on this device: 31 of 50 (62%) on 27 November 2026.')
  })

  it('flagged line, one and many', () => {
    expect(flaggedLine(1)).toBe('You flagged 1 question for review.')
    expect(flaggedLine(3)).toBe('You flagged 3 questions for review.')
  })
})

describe('flags', () => {
  it('toggleFlag adds and removes, sorted and unique', () => {
    expect(toggleFlag([], 4)).toEqual([4])
    expect(toggleFlag([4], 1)).toEqual([1, 4])
    expect(toggleFlag([1, 4], 4)).toEqual([1])
    expect(toggleFlag([1, 4, 9], 7)).toEqual([1, 4, 7, 9])
  })
})

describe('resume', () => {
  const questions = [q('A'), q('B', 1), q('A', 2)]
  const key = mockAttemptKey('ab', 'test-subject')

  it('returns the saved questions, answers, flags, question and end time, with the seconds left now', () => {
    const s = new FakeStorage()
    const endAt = NOW + 10 * 60_000
    expect(saveAttempt(s, key, attemptRecord(endAt, questions, { 0: 0, 2: 1 }, [1], 2), NOW)).toBe(true)
    // Five minutes away still count.
    const r = resumeAttempt(s, 'ab', 'test-subject', NOW + 5 * 60_000)
    expect(r).toEqual({ questions, answers: { 0: 0, 2: 1 }, flags: [1], current: 2, endAt, secondsLeft: 300 })
  })

  it('a time-passed or broken attempt gives null and is removed; another exam is not read', () => {
    const s = new FakeStorage()
    saveAttempt(s, key, attemptRecord(NOW + 1000, questions, {}, [], 0), NOW)
    expect(resumeAttempt(s, 'ab', 'other', NOW)).toBeNull()
    expect(s.map.has(key)).toBe(true)
    expect(resumeAttempt(s, 'ab', 'test-subject', NOW + 1000)).toBeNull()
    expect(s.map.has(key)).toBe(false)
    s.map.set(key, '{')
    expect(resumeAttempt(s, 'ab', 'test-subject', NOW)).toBeNull()
    expect(s.map.has(key)).toBe(false)
  })

  it('an attempt record of a real exam length passes the store check', () => {
    const s = new FakeStorage()
    const fifty = Array.from({ length: 50 }, (_, i) => q(`T${i % 5}`, i % 4))
    expect(saveAttempt(s, key, attemptRecord(NOW + 50 * 90_000, fifty, {}, [], 0), NOW)).toBe(true)
    expect(readAttempt(s, key, NOW)?.questions).toHaveLength(50)
    expect(NOW + 50 * 90_000).toBeLessThanOrEqual(NOW + MAX_ATTEMPT_MS)
  })
})

describe('result history item', () => {
  it('score, total, %, time and score by topic; lastResult finds it', () => {
    const questions = [q('Tax', 0), q('Audit', 1), q('Tax', 2), q('Audit', 3)]
    const item = resultHistoryItem('level-1', 'test-module', questions, { 0: 0, 1: 0, 2: 2 }, NOW)
    expect(item).toEqual({
      exam: 'level-1:test-module', score: 2, total: 4, pct: 50, at: NOW,
      topics: [{ topic: 'Tax', correct: 2, total: 2 }, { topic: 'Audit', correct: 0, total: 2 }],
    })
    const s = new FakeStorage()
    expect(addHistory(s, item)).toBe(true)
    expect(lastResult(s, 'level-1:test-module')).toEqual(item)
  })

  it('pct is rounded like the results screen', () => {
    const questions = [q('A'), q('A'), q('A')]
    expect(resultHistoryItem('ab', 'x', questions, { 0: 0, 1: 0 }, NOW).pct).toBe(67)
  })
})

describe('deviceStorage', () => {
  it('is null on the server (no window)', () => {
    expect(deviceStorage()).toBeNull()
  })
})

// The intro as rendered on origin/main 548b34d4 (before PQB-3), with test props.
const ICON = '<svg class="w-8 h-8" fill="none" stroke="#C9982A" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>'
const tiles = (c: string) => `<div class="grid grid-cols-3 gap-4 mb-8"><div class="rounded-xl p-4" style="background-color:#f0f7f4"><p class="font-display text-2xl" style="color:${c}">50</p><p class="text-xs text-slate-500 mt-1">Questions</p></div><div class="rounded-xl p-4" style="background-color:#f0f7f4"><p class="font-display text-2xl" style="color:${c}">75</p><p class="text-xs text-slate-500 mt-1">Minutes</p></div><div class="rounded-xl p-4" style="background-color:#f0f7f4"><p class="font-display text-2xl" style="color:${c}">60%</p><p class="text-xs text-slate-500 mt-1">Pass mark</p></div></div>`
const head = (bg: string, name: string) => `<p class="sr-only" aria-live="polite"></p><div class="max-w-2xl mx-auto"><div class="rounded-2xl border border-slate-200 bg-white p-8 md:p-10 text-center"><div class="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center" style="background-color:${bg}">${ICON}</div><h1 class="font-display text-2xl md:text-3xl text-navy-950 mb-3">${name} Mock Exam</h1>`
const INTRO_TEXT = '<p class="text-slate-500 leading-relaxed mb-8">50 questions randomly selected and balanced across all topics. You have 75 minutes. Every attempt gives you a fresh set.</p>'
const start = (c: string) => `<button class="w-full h-12 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50" style="background-color:#C9982A;color:${c}">Start Mock Exam</button>`
const TODAY_AB = head('#0C1A3D', 'Test Subject') + INTRO_TEXT + tiles('#0C1A3D') + start('#0C1A3D') + '<a class="inline-block mt-4 text-sm text-slate-500 hover:text-slate-600 transition-colors" href="/mock-exams">← Back to Mock Exams</a></div></div>'
const TODAY_AB_NOT_OPEN = head('#0C1A3D', 'Test Subject') + '<p class="text-slate-500 leading-relaxed mb-8">This mock exam is not open yet. Questions are being added to this subject.</p><a class="inline-block mt-4 text-sm text-slate-500 hover:text-slate-600 transition-colors" href="/mock-exams">← Back to Mock Exams</a></div></div>'
const TODAY_ET = head('#1A4731', 'Test Module') + INTRO_TEXT + tiles('#1A4731') + start('#1A4731') + '<a class="inline-block mt-4 text-sm text-slate-500 hover:text-slate-600 transition-colors" href="/study/eticpa/atq/level-1/test-module">← Back to module</a></div></div>'

describe('first render (no storage read yet) is exactly today\'s intro', () => {
  const AB = { level: 'ab', module: 'test-subject', moduleName: 'Test Subject', backHref: '/mock-exams', apiPath: '/api/mock-exam' }
  it('AB open', () => {
    expect(renderToStaticMarkup(createElement(MockExamClient, AB))).toBe(TODAY_AB)
  })
  it('AB not open', () => {
    expect(renderToStaticMarkup(createElement(MockExamClient, { ...AB, notOpen: true }))).toBe(TODAY_AB_NOT_OPEN)
  })
  it('ETICPA', () => {
    expect(renderToStaticMarkup(createElement(MockExamClient, { level: 'level-1', module: 'test-module', moduleName: 'Test Module', backHref: '/study/eticpa/atq/level-1/test-module' }))).toBe(TODAY_ET)
  })
})

describe('MockExamClient source rules', () => {
  const src = readFileSync(join(process.cwd(), 'components/course/MockExamClient.tsx'), 'utf8')
  const intro = src.slice(src.indexOf("if (phase === 'intro') {"), src.indexOf("if (phase === 'results') {"))
  const results = src.slice(src.indexOf("if (phase === 'results') {"), src.indexOf('// ── EXAM ──'))
  const exam = src.slice(src.indexOf('// ── EXAM ──'))
  const count = (s: string, sub: string) => s.split(sub).length - 1

  it('storage is read only in an effect after mount, and expired attempts are cleared there', () => {
    const mount = src.slice(src.indexOf('// Storage is read only after mount'), src.indexOf('}, [level, module])'))
    expect(mount).toContain('useEffect(() => {')
    expect(mount).toContain('const store = deviceStorage()')
    expect(mount).toContain('clearExpiredAttempts(store, now)')
    expect(mount).toContain('resumeAttempt(store, level, module, now)')
    expect(mount).toContain('setLast(lastResult(store, mockExamId(level, module)))')
    // No storage call outside the helpers and effects.
    expect(src).not.toContain('localStorage')
    expect(count(src, 'deviceStorage()')).toBe(5)
  })

  it('intro: the unfinished line and two buttons replace Start, both only when the exam is open', () => {
    expect(intro.indexOf('{notOpen ? (')).toBeLessThan(intro.indexOf('{resumable ? (<>'))
    expect(intro).toContain('<p className="text-sm text-slate-500 mb-4">{unfinishedAttemptLine(resumable.secondsLeft)}</p>')
    expect(intro).toMatch(/<button onClick=\{continueAttempt\} disabled=\{loading\}\s+className="w-full h-12 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"\s+style=\{\{ backgroundColor: GOLD, color: GREEN \}\}>\s+\{CONTINUE_TEXT\}/)
    expect(intro).toMatch(/<button onClick=\{startNewAttempt\} disabled=\{loading\}\s+className="w-full h-12 mt-3 rounded-lg text-sm font-semibold border-2 transition-colors disabled:opacity-50"\s+style=\{\{ borderColor: GREEN, color: GREEN \}\}>\s+\{START_NEW_TEXT\}/)
    expect(intro).toContain("{loading ? 'Preparing your exam…' : 'Start Mock Exam'}")
  })

  it('intro: the last result line under the tiles, only when the exam is open', () => {
    const line = '{last && <p className="text-sm text-slate-500 -mt-4 mb-8">{lastResultLine(last)}</p>}'
    expect(intro).toContain(line)
    expect(intro.indexOf("{ v: '60%', l: 'Pass mark' }")).toBeLessThan(intro.indexOf(line))
    expect(intro.indexOf('{notOpen ? (')).toBeLessThan(intro.indexOf(line))
  })

  it('continue restores the saved state and end time; passed warnings are not said', () => {
    const cont = src.slice(src.indexOf('const continueAttempt = () => {'), src.indexOf('const startNewAttempt'))
    for (const line of ['setQuestions(saved.questions)', 'setAnswers(saved.answers)', 'setFlags(saved.flags)', 'setCurrent(saved.current)',
      'endAtRef.current = saved.endAt', 'saidRef.current = momentsPassedAtStart(saved.secondsLeft)', 'setSecondsLeft(saved.secondsLeft)', "setPhase('exam')"]) {
      expect(cont).toContain(line)
    }
    expect(cont).toContain('if (!saved) return')
  })

  it('start a new attempt removes the saved one, then loads normally', () => {
    const fresh = src.slice(src.indexOf('const startNewAttempt = () => {'), src.indexOf('// One save after every answer'))
    expect(fresh.indexOf('removeAttempt(store, mockAttemptKey(level, module))')).toBeGreaterThan(-1)
    expect(fresh.indexOf('removeAttempt(')).toBeLessThan(fresh.indexOf('loadExam()'))
  })

  it('a fresh exam starts clean: no flags, no saving note', () => {
    const load = src.slice(src.indexOf('const loadExam = useCallback'), src.indexOf('}, [level, module, apiPath])'))
    expect(load).toContain('setFlags([])')
    expect(load).toContain('setNotSaving(false)')
    expect(results).toMatch(/<button onClick=\{loadExam\} disabled=\{loading\}/)
  })

  it('exam: one save per answer, flag and move; the first failure shows the note once', () => {
    const save = src.slice(src.indexOf('// One save after every answer'), src.indexOf('// Results: the saved attempt goes'))
    expect(save).toContain("if (phase !== 'exam') return")
    expect(save).toContain('saveAttempt(store, mockAttemptKey(level, module), attemptRecord(endAtRef.current, questions, answers, flags, current), now)')
    expect(save).toContain('if (!saved && now < endAtRef.current) setNotSaving(true)')
    expect(save).toContain('}, [phase, questions, answers, flags, current, level, module])')
    expect(exam).toContain('<p className="text-xs text-slate-500" aria-live="polite">{notSaving && <span className="block -mt-3 mb-6">{NOT_SAVING_TEXT}</span>}</p>')
    // Right under the status bar.
    expect(exam.indexOf('{mins}:{secs')).toBeLessThan(exam.indexOf('{NOT_SAVING_TEXT}'))
    expect(exam.indexOf('{NOT_SAVING_TEXT}')).toBeLessThan(exam.indexOf('{/* Progress */}'))
  })

  it('exam: the flag toggle under the options, pressed state, outline style', () => {
    expect(exam).toMatch(/<button onClick=\{\(\) => setFlags\(f => toggleFlag\(f, current\)\)\} aria-pressed=\{flagged\}\s+className="mt-4 h-10 px-4 rounded-lg text-sm font-semibold border-2 transition-colors"/)
    expect(exam).toContain('{flagged ? FLAGGED_TEXT : FLAG_TEXT}')
    expect(exam.indexOf('role="group"')).toBeLessThan(exam.indexOf('aria-pressed={flagged}'))
    expect(exam.indexOf('aria-pressed={flagged}')).toBeLessThan(exam.indexOf('{/* Controls */}'))
  })

  it('exam: a flagged tile has a visible mark and hidden "Flagged"; a legend under the grid', () => {
    expect(exam).toContain('<span aria-hidden="true" className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white" style={{ backgroundColor: FLAG_GOLD }} />')
    expect(exam).toContain('<span className="sr-only"> {FLAGGED_TEXT}</span>')
    expect(exam).toContain('className="relative w-9 h-9 rounded-lg text-xs font-semibold transition-colors"')
    expect(exam).toMatch(/<p aria-hidden="true" className="mt-3 flex items-center gap-2 text-xs text-slate-500">\s+<span className="inline-block w-3 h-3 rounded-full border-2 border-white" style=\{\{ backgroundColor: FLAG_GOLD \}\} \/>\s+\{FLAGGED_TEXT\}/)
    expect(src).toContain("const FLAG_GOLD = '#88671c'")
  })

  it('results: the attempt is removed and one history item added, guarded', () => {
    const res = src.slice(src.indexOf('// Results: the saved attempt goes'), src.indexOf('const tick = () =>'))
    expect(res).toContain("if (phase !== 'results') return")
    expect(res).toContain('removeAttempt(store, mockAttemptKey(level, module))')
    expect(res).toContain('if (recordedRef.current === endAtRef.current) return')
    expect(res.indexOf('recordedRef.current = endAtRef.current')).toBeLessThan(res.indexOf('addHistory('))
    expect(count(src, 'addHistory(')).toBe(1)
  })

  it('results: score by topic (more than one topic), the flagged line, the Flagged tag', () => {
    expect(results).toContain('{topics.length > 1 && (')
    expect(results).toContain('<h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{TOPIC_HEADING}</h2>')
    for (const th of ['Topic', 'Score', '%']) expect(results).toMatch(new RegExp(`<th className="text-(left|right) px-5 py-2 text-slate-500 font-medium">${th.replace('%', '%')}</th>`))
    expect(results).toContain('{flags.length > 0 && <p className="text-sm text-slate-500 -mt-3 mb-6">{flaggedLine(flags.length)}</p>}')
    expect(results).toContain('{flags.includes(i) && <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border" style={{ borderColor: FLAG_GOLD, color: FLAG_GOLD }}>{FLAGGED_TEXT}</span>}')
    expect(src).toContain("const topics = phase === 'results' ? topicScores(questions, answers) : []")
  })

  it('unchanged: confirm text, timer, notOpen text', () => {
    expect(src).toContain('`You have ${unanswered} unanswered question${unanswered === 1 ? \'\' : \'s\'}. Unanswered questions are marked incorrect. Submit anyway?`')
    expect(src).toContain('This mock exam is not open yet. Questions are being added to this subject.')
    expect(src).toContain('endAtRef.current = examEndAt(now, data.questions.length)')
  })
})
