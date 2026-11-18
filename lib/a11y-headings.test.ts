import { execSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
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
    expect(src).toMatch(/<h2 className="font-display text-white text-lg mb-1\.5">/)
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
    expect(read('app/free-courses/page.tsx')).toMatch(/<h2 className="font-semibold text-navy-950 text-sm mb-1">\{w\.title\}<\/h2>/)
  })

  it('every heading whose level changed keeps the exact class list it had before (same look)', () => {
    // A named text size (text-xs/sm/base/lg) sets its own line-height, so the base h2/h3 rule never applies
    // and no extra class is needed. The filter labels became <p>: three classes restore what the h3 base rule
    // gave (display font, 1.2 line-height, no 70ch max-width) because text-[10px] sets the font size only.
    const SAME: Array<[string, string, string, number]> = [
      ['components/layout/Footer.tsx', 'h2', 'font-display text-white text-lg mb-1.5', 1],
      ['components/layout/Footer.tsx', 'h3', 'text-xs font-semibold text-white/70 uppercase tracking-widest mb-4', 1],
      ['app/page.tsx', 'h2', 'font-display text-white text-lg mt-1 leading-snug', 4],
      ['app/page.tsx', 'h3', 'text-sm font-semibold text-navy-950 mb-0.5', 2],
      ['app/page.tsx', 'h3', 'font-semibold text-navy-950 mb-1 text-sm', 1],
      ['app/free-courses/page.tsx', 'h2', 'font-semibold text-navy-950 text-sm mb-1', 1],
      ['app/free-courses/page.tsx', 'h2', 'font-display text-base text-navy-950 leading-snug mb-2 group-hover:text-navy-700 transition-colors flex-1', 1],
      ['app/articles/page.tsx', 'h2', 'text-sm font-semibold text-navy-950 leading-snug group-hover:text-navy-700 transition-colors', 1],
      ['app/study/[category]/page.tsx', 'h2', 'text-sm font-semibold text-navy-950 leading-snug group-hover:text-navy-700 transition-colors', 1],
      ['app/jobs/listings/JobListingsClient.tsx', 'p id={titleId}', 'font-display leading-[1.2] max-w-none text-[10px] font-bold uppercase tracking-widest mb-3 text-slate-400', 1],
    ]
    for (const [f, tag, cls, n] of SAME) {
      expect(read(f).split(`<${tag} className="${cls}"`).length - 1, `${f} <${tag}> ${cls}`).toBe(n)
    }
  })

  it('no heading with a named text size also carries an arbitrary leading-[...] value', () => {
    const adminDirs = readdirSync(join(process.cwd(), 'app')).filter((d) => {
      try { return read(`app/${d}/layout.tsx`).includes('requireAdmin') } catch { return false }
    })
    const isAdmin = (f: string) => adminDirs.some((d) => f.startsWith(`app/${d}/`) || f.startsWith(`app/${d}-`) || f.startsWith(`components/${d}/`))
    const files = execSync('git ls-files -- app components', { encoding: 'utf8' }).split('\n')
      .filter((f) => f.endsWith('.tsx') && !f.includes('.test.') && !f.startsWith('app/api/') && !isAdmin(f))
    expect(files.length).toBeGreaterThan(100)
    const bad: string[] = []
    for (const f of files) {
      const re = /<h[1-6]\b[^>]*?className="([^"]*)"/g
      const src = read(f)
      let m: RegExpExecArray | null
      while ((m = re.exec(src)) !== null) {
        const cls: string[] = m[1].split(/\s+/)
        if (cls.some((c: string) => /^text-(2xs|xs|sm|base|lg|xl|[2-8]xl)$/.test(c)) && cls.some((c: string) => /^leading-\[/.test(c))) bad.push(f)
      }
    }
    expect(bad).toEqual([])
  })

  it('search: the server-rendered fallback starts with the page h1 (visually hidden)', () => {
    const src = read('app/search/page.tsx')
    const fallback = src.slice(src.indexOf('<Suspense fallback'), src.indexOf('<SearchInner />'))
    expect(fallback).toMatch(/<h1 className="sr-only">Find what you need<\/h1>/)
  })
})
