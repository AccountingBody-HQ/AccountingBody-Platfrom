import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseTotal, summariseResults } from './resultsSummary'

const PAGE_SIZE = 24

describe('parseTotal', () => {
  it('keeps a number as is', () => {
    expect(parseTotal(13254)).toBe(13254)
    expect(parseTotal(0)).toBe(0)
  })

  it('reads null as a total that is not known', () => {
    expect(parseTotal(null)).toBeNull()
  })

  it('reads a missing or non-number total as 0, as the screen always has', () => {
    expect(parseTotal(undefined)).toBe(0)
    expect(parseTotal('12')).toBe(0)
    expect(parseTotal({})).toBe(0)
  })
})

describe('summariseResults with a known total', () => {
  it('first page of many', () => {
    expect(summariseResults({ page: 1, pageSize: PAGE_SIZE, rowsLength: 24, total: 13254 })).toEqual({
      headline: `${(13254).toLocaleString()} jobs found`,
      detail: `Showing 1–24 of ${(13254).toLocaleString()}`,
      pager: { kind: 'numbered', total: 13254, totalPages: 553 },
    })
  })

  it('middle page', () => {
    const s = summariseResults({ page: 3, pageSize: PAGE_SIZE, rowsLength: 24, total: 100 })
    expect(s.headline).toBe('100 jobs found')
    expect(s.detail).toBe('Showing 49–72 of 100')
    expect(s.pager).toEqual({ kind: 'numbered', total: 100, totalPages: 5 })
  })

  it('last page, partly filled', () => {
    const s = summariseResults({ page: 5, pageSize: PAGE_SIZE, rowsLength: 4, total: 100 })
    expect(s.detail).toBe('Showing 97–100 of 100')
    expect(s.pager).toEqual({ kind: 'numbered', total: 100, totalPages: 5 })
  })

  it('last page, exactly full', () => {
    const s = summariseResults({ page: 2, pageSize: PAGE_SIZE, rowsLength: 24, total: 48 })
    expect(s.detail).toBe('Showing 25–48 of 48')
    expect(s.pager).toEqual({ kind: 'numbered', total: 48, totalPages: 2 })
  })

  it('one job uses the singular', () => {
    const s = summariseResults({ page: 1, pageSize: PAGE_SIZE, rowsLength: 1, total: 1 })
    expect(s.headline).toBe('1 job found')
    expect(s.detail).toBe('Showing 1–1 of 1')
    expect(s.pager).toEqual({ kind: 'numbered', total: 1, totalPages: 1 })
  })

  it('no jobs keeps the long-standing 0–0 range and one page', () => {
    const s = summariseResults({ page: 1, pageSize: PAGE_SIZE, rowsLength: 0, total: 0 })
    expect(s.headline).toBe('0 jobs found')
    expect(s.detail).toBe('Showing 0–0 of 0')
    expect(s.pager).toEqual({ kind: 'numbered', total: 0, totalPages: 1 })
  })
})

describe('summariseResults when the total is not available', () => {
  it('jobs still show with a range that needs no total', () => {
    const s = summariseResults({ page: 1, pageSize: PAGE_SIZE, rowsLength: 24, total: null })
    expect(s.headline).toBe('Showing 1–24')
    expect(s.detail).toBeNull()
  })

  it('never shows a count of 0 for a page that has jobs', () => {
    const s = summariseResults({ page: 1, pageSize: PAGE_SIZE, rowsLength: 24, total: null })
    expect(s.headline).not.toMatch(/\b0\b/)
    expect(s.headline).not.toMatch(/found/)
  })

  it('paging works without a total: first full page offers Next only', () => {
    const s = summariseResults({ page: 1, pageSize: PAGE_SIZE, rowsLength: 24, total: null })
    expect(s.pager).toEqual({ kind: 'prevNext', prevPage: null, nextPage: 2 })
  })

  it('paging works without a total: middle full page offers both', () => {
    const s = summariseResults({ page: 3, pageSize: PAGE_SIZE, rowsLength: 24, total: null })
    expect(s.headline).toBe('Showing 49–72')
    expect(s.pager).toEqual({ kind: 'prevNext', prevPage: 2, nextPage: 4 })
  })

  it('paging works without a total: a partly filled page offers Previous only', () => {
    const s = summariseResults({ page: 5, pageSize: PAGE_SIZE, rowsLength: 4, total: null })
    expect(s.headline).toBe('Showing 97–100')
    expect(s.pager).toEqual({ kind: 'prevNext', prevPage: 4, nextPage: null })
  })

  it('a single partly filled first page offers neither', () => {
    const s = summariseResults({ page: 1, pageSize: PAGE_SIZE, rowsLength: 7, total: null })
    expect(s.headline).toBe('Showing 1–7')
    expect(s.pager).toEqual({ kind: 'prevNext', prevPage: null, nextPage: null })
  })

  it('an empty page shows 0–0 and still offers Previous', () => {
    const s = summariseResults({ page: 3, pageSize: PAGE_SIZE, rowsLength: 0, total: null })
    expect(s.headline).toBe('Showing 0–0')
    expect(s.pager).toEqual({ kind: 'prevNext', prevPage: 2, nextPage: null })
  })
})

// No DOM test library in this repo, so this reads the screen's source to
// check it takes its wording and pager choice from the helper above.
describe('jobs list screen uses the results summary', () => {
  const source = readFileSync(join(process.cwd(), 'app/jobs/listings/JobListingsClient.tsx'), 'utf8')

  it('reads the total through parseTotal and builds the summary from it', () => {
    expect(source).toContain("import { parseTotal, summariseResults } from './resultsSummary'")
    expect(source).toContain('setTotal(parseTotal(data.total))')
    expect(source).toMatch(/summariseResults\(\{ page: displayedPage, pageSize: PAGE_SIZE, rowsLength: jobs\.length, total \}\)/)
  })

  it('renders the headline, the optional detail line and the chosen pager', () => {
    expect(source).toContain('{summary.headline}')
    expect(source).toContain('summary.detail !== null')
    expect(source).toContain("summary.pager.kind === 'numbered'")
    expect(source).toContain('<PrevNextPagination')
  })

  it('has no second copy of the count wording', () => {
    expect(source).not.toMatch(/job\{total === 1/)
    expect(source).not.toMatch(/of \{total\.toLocaleString\(\)\}/)
  })
})

describe('Previous/Next walk with no total (speed job, 11 Nov 2026)', () => {
  it('Next moves 1 -> 2 -> 3 while pages come back full, and Previous walks back to 1', () => {
    const at = (page: number) => summariseResults({ page, pageSize: PAGE_SIZE, rowsLength: 24, total: null })
    expect([1, 2, 3].map(p => at(p).pager)).toEqual([
      { kind: 'prevNext', prevPage: null, nextPage: 2 },
      { kind: 'prevNext', prevPage: 1, nextPage: 3 },
      { kind: 'prevNext', prevPage: 2, nextPage: 4 },
    ])
    expect([1, 2, 3].map(p => at(p).headline)).toEqual(['Showing 1–24', 'Showing 25–48', 'Showing 49–72'])
  })
})
