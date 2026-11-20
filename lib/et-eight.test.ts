import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// ET-8 (follow-ups of ET-7): a missing study article, article, job or question set keeps the
// "Page Not Found" tab title after the page loads (its generateMetadata returns that title instead of
// nothing), and the decorative quote marks on the EthioTax home testimonials are hidden from screen readers.

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')

// The body of a page's generateMetadata function, up to the next top-level declaration.
const metadataBody = (src: string) => {
  const start = src.indexOf('export async function generateMetadata')
  if (start < 0) throw new Error('no generateMetadata')
  const rest = src.slice(start)
  const end = rest.search(/\n(?:export |const |function |async function )/)
  return end < 0 ? rest : rest.slice(0, end)
}
const count = (s: string, needle: string) => s.split(needle).length - 1

const NOT_FOUND_RETURN = "return { title: 'Page Not Found' }"

// File, expected number of not-found returns, and the found-item title line that must stay unchanged.
const PAGES: Array<[string, number, string]> = [
  ['app/study/[category]/[slug]/page.tsx', 2, '    title:       article.title,'],
  ['app/articles/[slug]/page.tsx', 2, '    title:       `${metaTitle} | ${brand}`,'],
  ['app/jobs/[slug]/page.tsx', 1, '  const title = `${job.title} at ${job.company_name}`'],
  ['app/practice-questions/[slug]/page.tsx', 1, '    title:       `${qset.title} | ${name} Practice Questions`,'],
]

describe('ET-8 H1: missing items keep the not-found title', () => {
  for (const [file, n, foundTitle] of PAGES) {
    const body = metadataBody(read(file))

    it(`${file}: generateMetadata never returns an empty object`, () => {
      expect(body).not.toMatch(/return\s*\{\s*\}/)
    })

    it(`${file}: every missing-item branch returns the shared not-found title (${n})`, () => {
      expect(count(body, NOT_FOUND_RETURN)).toBe(n)
    })

    it(`${file}: the not-found title carries no brand suffix (the root template adds it)`, () => {
      expect(body).not.toMatch(/title:\s*['`"]Page Not Found\s*\|/)
    })

    it(`${file}: the found-item title is unchanged`, () => {
      expect(body).toContain(foundTitle)
    })
  }

  it('the literal matches the existing not-found pages', () => {
    expect(read('app/not-found.tsx')).toContain("title: 'Page Not Found'")
    expect(read('app/[slug]/page.tsx')).toContain("{ title: 'Page Not Found' }")
  })
})

describe('ET-8 H2: decorative testimonial quote marks are hidden from screen readers', () => {
  const home = read('app/page.tsx')
  const QUOTE_LINE =
    '          <div className="text-4xl font-display leading-none mb-3 opacity-40" style={{ color: \'#1A4731\' }} translate="no" aria-hidden="true">&ldquo;</div>'

  it('the EthioTax testimonial quote mark carries aria-hidden="true" with its look unchanged', () => {
    expect(count(home, QUOTE_LINE + '\n')).toBe(1)
  })

  it('no unhidden copy of that quote mark remains', () => {
    expect(home).not.toContain('translate="no">&ldquo;</div>')
  })

  it('the testimonial text itself stays readable', () => {
    expect(home).toContain('<p className="text-gray-700 text-sm leading-relaxed mb-6 flex-1">{t.quote}</p>')
  })
})
