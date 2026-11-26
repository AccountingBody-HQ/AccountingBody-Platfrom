import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// ME-1 S6 (adviser-approved #12, #13): readable small text in the mock exams.
// The topic label is the dark gold #88671c (not #C9982A on white), and the
// grey small text is slate-500, at exactly the lines ME-D1 listed.
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const FILES = [
  'components/course/MockExamClient.tsx',
  'app/mock-exams/page.tsx',
  'app/mock-exams/[category]/page.tsx',
  'app/study/mock-exams/page.tsx',
]

// Each relative luminance and contrast ratio (WCAG 2), to pin the colours.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

describe('mock-exam text contrast', () => {
  it('no grey text-slate-400 text in these files (one icon and one never-shown empty line excepted)', () => {
    const left = FILES.flatMap(f => read(f).split('\n').filter(l => l.includes('text-slate-400')).map(l => `${f}: ${l.trim()}`))
    expect(left).toHaveLength(2)
    // The chevron is an icon, not text.
    expect(left[0]).toMatch(/^components\/course\/MockExamClient\.tsx: <svg className=\{`w-4 h-4 text-slate-400 shrink-0/)
    // The hub's empty line shows only when the subject list is empty (it never is).
    expect(left[1]).toBe('app/mock-exams/page.tsx: <p className="text-slate-400 text-lg">No exam subjects available yet.</p>')
  })

  it('no #C9982A text colour in these files; the topic label is #88671c', () => {
    for (const f of FILES) {
      const src = read(f)
      // Text colour only: a gold background (backgroundColor) is not text.
      expect(src, f).not.toMatch(/[^A-Za-z]color:\s*'#C9982A'/i)
      expect(src, f).not.toMatch(/text-\[#C9982A\]/i)
    }
    const client = read('components/course/MockExamClient.tsx')
    expect(client).toContain(`<p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: '#88671c' }}>{q.topic}</p>`)
    expect(client).not.toContain('style={{ color: GOLD }}>{q.topic}')
  })

  // PQB-1 S2 (PQ-D3 #23; D351): the failed score % is the dark gold too; the
  // ring border (not text) stays GOLD.
  it('the failed score % is #88671c; the ring border stays GOLD', () => {
    const client = read('components/course/MockExamClient.tsx')
    expect(client).toContain(`<span className="font-display text-3xl" style={{ color: passed ? GREEN : '#88671c' }}>{pct}%</span>`)
    expect(client).not.toContain('style={{ color: passed ? GREEN : GOLD }}')
    expect(client).toContain('style={{ borderColor: passed ? GREEN : GOLD }}')
  })

  // PQB-1 S2 (PQ-D3 #24; D351): the ETICPA module breadcrumbs are slate-500.
  it.each([
    'app/study/eticpa/atq/level-1/cost-accounting/mock-exam/page.tsx',
    'app/study/eticpa/atq/level-1/introduction-to-accounting/mock-exam/page.tsx',
    'app/study/eticpa/atq/level-2/assurance-controls-ethics/mock-exam/page.tsx',
    'app/study/eticpa/atq/level-2/financial-accounting/mock-exam/page.tsx',
    'app/study/eticpa/atq/level-2/management-accounting/mock-exam/page.tsx',
  ])('%s: the breadcrumb line is text-slate-500 and no text-slate-400 is left', (f) => {
    const src = read(f)
    expect(src.split('<nav className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">').length - 1).toBe(1)
    expect(src).not.toContain('text-slate-400')
  })

  it('the new colours pass 4.5:1 where the old ones failed', () => {
    expect(ratio('#88671c', '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(ratio('#C9982A', '#ffffff')).toBeLessThan(4.5)
    expect(ratio('#64748b', '#ffffff')).toBeGreaterThanOrEqual(4.5) // slate-500
    expect(ratio('#94a3b8', '#ffffff')).toBeLessThan(4.5) // slate-400
    expect(ratio('#b91c1c', '#fef2f2')).toBeGreaterThanOrEqual(4.5)
    expect(ratio('#dc2626', '#fef2f2')).toBeLessThan(4.5)
  })
})
