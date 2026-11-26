import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// PQB-2 S4 (D338): readable small text on /practice-questions. The four
// sidebar labels, the top "Clear filters" link and the empty-state line are
// slate-500 (#64748b, 4.76:1 on white), not slate-400 (#94a3b8, 2.56:1).
const src = readFileSync(join(process.cwd(), 'app/practice-questions/page.tsx'), 'utf8')

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

describe('/practice-questions text contrast', () => {
  it('no text-slate-400 is left in the page', () => {
    expect(src).not.toContain('text-slate-400')
  })

  it.each([
    ['uppercase tracking-widest mb-4">Filter</p>'],
    ['uppercase tracking-widest mb-3">Sort by</p>'],
    ['uppercase tracking-widest mb-3">Difficulty</p>'],
    ['uppercase tracking-widest mb-3 mt-5">Subject</p>'],
  ])('the sidebar label %s is slate-500', (end) => {
    expect(src).toContain(`<p className="text-xs font-semibold text-slate-500 ${end}`)
  })

  it('the top Clear filters link is slate-500 with its hover unchanged', () => {
    expect(src).toContain('<Link href="/practice-questions" className="text-xs text-slate-500 hover:text-navy-950 transition-colors">')
  })

  it('the empty-state line is slate-500', () => {
    expect(src).toContain('<p className="text-slate-500 text-lg">No practice questions found.</p>')
  })

  it('slate-500 passes 4.5:1 on white and slate-400 does not', () => {
    expect(ratio('#64748b', '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(ratio('#94a3b8', '#ffffff')).toBeLessThan(4.5)
  })
})
