import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// A11-F6 follow-ups: announced error summary, Start Course context on ETICPA modules, one h1 in every
// mock-exam phase, the footer Mock Exams target, focus kept clear of the fixed header.
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const count = (src: string, re: RegExp) => (src.match(re) || []).length
const FORMS = [
  'app/jobs/find-work/FindWorkClient.tsx',
  'app/jobs/hire-talent/HireTalentClient.tsx',
  'app/firms-freelancers/join/page.tsx',
  'app/freelancing-pathways/FreelancingPathwaysClient.tsx',
]

describe('form error summary', () => {
  it('the visible line has no role; one always-mounted alert outside the form flow carries the message', () => {
    const src = read('components/FormErrorSummary.tsx')
    expect(src).toMatch(/<p hidden=\{!show\} className=/)
    expect(count(src, /role="alert"/g)).toBe(1)
    expect(src).toMatch(/createPortal\(\s*<div role="alert" className="sr-only">\{message\}<\/div>,\s*document\.body/)
    // cleared first, then set on a later tick, so a repeated failure is announced again
    expect(src).toMatch(/setMessage\(''\)[\s\S]{0,120}setTimeout\(\(\) => setMessage\(ERROR_SUMMARY_TEXT\)/)
  })

  it('each form counts failed attempts and passes the count to the summary', () => {
    for (const f of FORMS) {
      const src = read(f)
      expect(src, f).toMatch(/<FormErrorSummary show=\{[^}]+\} attempt=\{errorAttempt\}/)
      const fails = count(src, /setFieldErrors\(errors\)/g)
      expect(fails, f).toBeGreaterThan(0)
      expect(count(src, /setErrorAttempt\(n => n \+ 1\)/g), f).toBe(fails)
    }
  })
})

describe('link context and headings', () => {
  it('ETICPA module "Start Course" links carry the module name for screen readers', () => {
    for (const m of ['level-1/cost-accounting', 'level-1/introduction-to-accounting', 'level-2/assurance-controls-ethics', 'level-2/financial-accounting', 'level-2/management-accounting']) {
      const src = read(`app/study/eticpa/atq/${m}/page.tsx`)
      expect(count(src, /Start Course/g), m).toBe(2)
      expect(count(src, /Start Course<span className="sr-only">: \{MODULE\.name\}<\/span>/g), m).toBe(2)
    }
  })

  it('MockExamClient has exactly one h1 in each phase (intro, results, exam)', () => {
    const src = read('components/course/MockExamClient.tsx')
    const intro = src.slice(src.indexOf("if (phase === 'intro') {"), src.indexOf("if (phase === 'results') {"))
    const results = src.slice(src.indexOf("if (phase === 'results') {"), src.indexOf('// ── EXAM ──'))
    expect(intro.length).toBeGreaterThan(100)
    expect(results.length).toBeGreaterThan(100)
    const exam = src.slice(src.indexOf('// ── EXAM ──'))
    for (const part of [intro, results, exam]) expect(count(part, /<h1[\s>]/g)).toBe(1)
    expect(exam).toMatch(/<h1 className="sr-only">\{moduleName\} Mock Exam<\/h1>/)
  })

  it('the footer Mock Exams link points at the hub, not a redirecting address', () => {
    const src = read('components/layout/Footer.tsx')
    expect(src).toMatch(/\{ label: 'Mock Exams',\s+href: '\/mock-exams' \}/)
    expect(src).not.toContain("'/mock-exams/acca'")
  })
})

describe('focus not hidden by the fixed header', () => {
  it('the page scroll keeps a top offset equal to the header height', () => {
    const css = read('app/globals.css')
    expect(css).toMatch(/html \{\s*scroll-padding-top: var\(--nav-height, 64px\);\s*\}/)
  })
})
