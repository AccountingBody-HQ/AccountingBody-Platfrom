import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// A11-F6 guards: quiz answer semantics, template link names, phone drawers, A11-F5 follow-ups.
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const count = (src: string, re: RegExp) => (src.match(re) || []).length

describe('quiz and mock-exam answers', () => {
  it('QuizRenderer: options expose pressed state in a group named by the question; one live region', () => {
    const src = read('components/QuizRenderer.tsx')
    expect(src).toMatch(/role="group"\s+aria-labelledby=\{stemId\}/)
    expect(src).toMatch(/aria-pressed=\{isSelected\}/)
    expect(count(src, /aria-live=/g)).toBe(1)
    expect(src).toMatch(/<textarea[\s\S]{0,80}aria-labelledby=\{stemId\}/)
    // correctness markers exist only after submit (isThisRight / isThisWrong are false before it)
    expect(src).toMatch(/\{isThisRight && <span className="sr-only"> \(correct answer\)<\/span>\}/)
    expect(src).toMatch(/role="alertdialog"/)
  })

  it('MockExamClient: pressed options, current question marked, results focused, review state in text', () => {
    const src = read('components/course/MockExamClient.tsx')
    expect(src).toMatch(/aria-pressed=\{sel\}/)
    expect(src).toMatch(/aria-current=\{i === current \? 'step' : undefined\}/)
    expect(src).toMatch(/ref=\{resultsHeadingRef\} tabIndex=\{-1\}/)
    expect(src).toMatch(/aria-expanded=\{open\}/)
    expect(src).toMatch(/<span className="sr-only">\{correct \? 'Correct: ' : 'Incorrect: '\}<\/span>/)
    // Two polite regions only: the question counter, and the timer lines (ME-1 S4).
    expect(count(src, /aria-live=/g)).toBe(2)
    expect(src).toMatch(/<span className="text-sm font-semibold text-navy-950" aria-live="polite">Question \{current \+ 1\} of/)
    expect(src).toContain('<p className="sr-only" aria-live="polite">{announcement}</p>')
  })

  it('QuizBankRenderer: pressed options, named textarea, Previous/Next keep their names on phones', () => {
    const src = read('components/QuizBankRenderer.tsx')
    expect(src).toMatch(/aria-pressed=\{isSelected\}/)
    expect(src).toMatch(/<textarea[\s\S]{0,80}aria-labelledby=\{stemId\}/)
    expect(count(src, /hidden sm:inline/g)).toBe(0)
    expect(count(src, /sr-only sm:not-sr-only/g)).toBe(2)
  })
})

describe('template link names', () => {
  it('home "View all" links are named with their section heading', () => {
    const src = read('app/page.tsx')
    expect(count(src, /aria-labelledby="home-articles-(?:et|ab)-link home-articles-(?:et|ab)-heading"/g)).toBe(2)
  })

  it('course page "Start Course" carries the course title for screen readers', () => {
    expect(read('app/free-courses/[slug]/page.tsx')).toMatch(/Start Course\s*<span className="sr-only">: \{course\.title\}<\/span>/)
  })
})

describe('phone drawers', () => {
  it('the mobile menu and the filter drawer trap focus while open and are inert while closed', () => {
    const nav = read('components/layout/Navigation.tsx')
    expect(nav).toMatch(/useDialogFocus\(/)
    expect(nav).toMatch(/inert=\{!open\}/)
    const jl = read('app/jobs/listings/JobListingsClient.tsx')
    expect(jl).toMatch(/useDialogFocus\(/)
    expect(jl).toMatch(/inert=\{!drawerOpen\}/)
    expect(jl).toMatch(/role="dialog" aria-modal="true" aria-label="Filters"/)
    expect(read('lib/use-dialog-focus.ts')).toMatch(/e\.key === 'Escape'/)
  })
})

describe('A11-F5 follow-ups', () => {
  it('posted-within radios get an instance-unique group name', () => {
    const src = read('app/jobs/listings/JobListingsClient.tsx')
    expect(src).not.toMatch(/name="posted-within"/)
    expect(src).toMatch(/name=\{postedName\}/)
  })

  it('the unused HeroSearch component is gone', () => {
    expect(existsSync(join(process.cwd(), 'components/HeroSearch.tsx'))).toBe(false)
  })

  it('the four per-field forms show one error summary in an alert', () => {
    const s = read('components/FormErrorSummary.tsx')
    expect(s).toMatch(/role="alert"/)
    expect(s).toContain('Please correct the highlighted fields below.')
    for (const f of ['app/jobs/find-work/FindWorkClient.tsx', 'app/jobs/hire-talent/HireTalentClient.tsx', 'app/firms-freelancers/join/page.tsx', 'app/freelancing-pathways/FreelancingPathwaysClient.tsx']) {
      expect(read(f), f).toMatch(/<FormErrorSummary show=\{/)
    }
  })
})
