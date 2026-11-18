import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Heading outline guards (A11-F6). Each public page reads h1 -> h2 -> h3 without a skipped level.
// Levels changed here keep their look: every changed heading carries its own size class, and where the
// base rule's line-height differs between the old and the new tag the old value is pinned in the class list.
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const count = (src: string, re: RegExp) => (src.match(re) || []).length

describe('heading outline', () => {
  it('the footer ends every page with h2 then h3, never h3/h4 (it follows any level)', () => {
    const src = read('components/layout/Footer.tsx')
    expect(count(src, /<h[4-6][\s>]/g)).toBe(0)
    expect(count(src, /<h3[\s>]/g)).toBe(1) // link column titles
    expect(count(src, /<h2[\s>]/g)).toBe(1) // newsletter heading
    expect(src).toMatch(/<h2 className="font-display text-white text-lg leading-\[1\.2\] mb-1\.5">/)
  })

  it('home: hero cards are h2 under the h1, and row/point titles are h3 under their h2', () => {
    const src = read('app/page.tsx')
    expect(count(src, /<h4[\s>]/g)).toBe(0)
    expect(count(src, /<h3 className="font-display text-white text-lg mt-1 leading-snug">/g)).toBe(0)
    expect(count(src, /<h2 className="font-display text-white text-lg mt-1 leading-snug">/g)).toBe(4)
  })

  it('job listings: filter titles are labels (p), not headings, and still name their groups', () => {
    const src = read('app/jobs/listings/JobListingsClient.tsx')
    expect(src).not.toMatch(/<h3 id=\{titleId\}/)
    expect(src).toMatch(/<p id=\{titleId\} className="font-display leading-\[1\.2\] max-w-none /)
    expect(src).toMatch(/aria-labelledby=\{titleId\}/)
  })

  it('card lists directly under the h1 use h2 (free courses, articles, study category)', () => {
    for (const f of ['app/free-courses/page.tsx', 'app/articles/page.tsx', 'app/study/[category]/page.tsx']) {
      expect(count(read(f), /<h3[\s>]/g), f).toBe(0)
    }
    expect(read('app/free-courses/page.tsx')).toMatch(/<h2 className="font-semibold text-navy-950 text-sm leading-\[1\.2\] mb-1">\{w\.title\}<\/h2>/)
  })

  it('search: the server-rendered fallback starts with the page h1 (visually hidden)', () => {
    const src = read('app/search/page.tsx')
    const fallback = src.slice(src.indexOf('<Suspense fallback'), src.indexOf('<SearchInner />'))
    expect(fallback).toMatch(/<h1 className="sr-only">Find what you need<\/h1>/)
  })
})
