import * as React from 'react'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseListPage, pickSubject, visibleDifficulties, visibleSubjects } from './practice-list'

// The page's components use the classic JSX transform under vitest (as in lib/et-ten.test.ts).
;(globalThis as { React?: typeof React }).React = React

// PQB-1 S1 (PQ-D3 #18-#21; D351): the /practice-questions list page. The page
// number is a whole number of 1 or more (else 1); a page after the last one is
// the site's normal 404; the letter is passed as a starts-with filter; the
// level filter shows only levels with live sets, or all three if the count
// cannot be read. Nothing else on the page changes.

const NOT_FOUND = vi.hoisted(() => new Error('NEXT_NOT_FOUND'))
const db = vi.hoisted(() => ({
  list: vi.fn(),
  filters: vi.fn(),
  report: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw NOT_FOUND }),
  redirect: vi.fn(),
  usePathname: () => '/practice-questions',
  useRouter: () => ({ push: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/headers', () => ({
  headers: async () => ({ get: () => null }),
}))
vi.mock('@/lib/db', () => ({
  getPublicQuestionSets: db.list,
  getPublicPracticeFilters: db.filters,
  QUESTION_SET_DIFFICULTIES: ['beginner', 'intermediate', 'advanced'],
}))
vi.mock('@/lib/report-error', () => ({ reportServerError: db.report }))

import { notFound } from 'next/navigation'
import PracticeQuestionsPage from '@/app/practice-questions/page'

type SP = Record<string, string>
const run = (sp: SP = {}) => PracticeQuestionsPage({ searchParams: Promise.resolve(sp) }) as Promise<ReactElement>
const render = async (sp: SP = {}) => renderToStaticMarkup(await run(sp))
const sets = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, title: `Set ${i}`, slug: `set-${i}`, difficulty: 'advanced' }))
const levelLinks = (html: string) => Array.from(html.matchAll(/href="\/practice-questions\?difficulty=(\w+)[^"]*"/g)).map((m) => m[1])

// Today's facts (PQ-D3): levels 0 / 9 / 172; subjects FA 75, FM 18, MA 68, AA 20, the other four 0.
const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`)
const FACTS = {
  difficultyCounts: { beginner: 0, intermediate: 9, advanced: 172 },
  subjectSetIds: {
    'financial-accounting': ids('fa', 75), 'financial-management': ids('fm', 18), 'management-accounting': ids('ma', 68),
    'financial-market': [], 'business-management': [], 'audit-assurance': ids('aa', 20), taxation: [], economics: [],
  },
}

beforeEach(() => {
  vi.mocked(notFound).mockClear()
  db.list.mockReset()
  db.filters.mockReset()
  db.report.mockReset()
  db.list.mockResolvedValue({ sets: sets(12), total: 181 })
  db.filters.mockResolvedValue(FACTS)
})

describe('parseListPage: a whole number of 1 or more, anything else is 1', () => {
  it.each([
    ['1', 1], ['2', 2], ['16', 16], ['99', 99], ['007', 7],
    ['abc', 1], ['1.5', 1], ['-2', 1], ['', 1], ['0', 1], ['00', 1], [' 3', 1], ['3 ', 1], ['+3', 1], ['1e3', 1], ['0x10', 1],
    ['99999999999999999999', 1],
  ])('%j → %d', (raw, page) => {
    expect(parseListPage(raw)).toBe(page)
  })
  it.each([[undefined], [null], [['2', '3']], [3]])('a non-string value (%j) → 1', (raw) => {
    expect(parseListPage(raw)).toBe(1)
  })
})

describe('visibleDifficulties', () => {
  const LEVELS = ['beginner', 'intermediate', 'advanced'] as const
  it('only levels with at least one set, in order', () => {
    expect(visibleDifficulties(LEVELS, { beginner: 0, intermediate: 9, advanced: 172 })).toStrictEqual(['intermediate', 'advanced'])
    expect(visibleDifficulties(LEVELS, { advanced: 1 })).toStrictEqual(['advanced'])
    expect(visibleDifficulties(LEVELS, { beginner: 1, intermediate: 1, advanced: 1 })).toStrictEqual([...LEVELS])
    expect(visibleDifficulties(LEVELS, {})).toStrictEqual([])
  })
  it('no counts (a failed read) → every level', () => {
    expect(visibleDifficulties(LEVELS, null)).toStrictEqual([...LEVELS])
  })
})

describe('the page', () => {
  it('page 1: 12 sets, the read asks for page 1 with no letter', async () => {
    const html = await render()
    expect(html.match(/href="\/practice-questions\/set-\d+"/g)).toHaveLength(12)
    expect(db.list).toHaveBeenCalledWith({ difficulty: undefined, search: undefined, startsWith: undefined, category: undefined, page: 1, perPage: 12, sortBy: 'alpha' })
    expect(notFound).not.toHaveBeenCalled()
  })

  it.each(['abc', '1.5', '-2', ''])('?page=%j reads page 1', async (p) => {
    await run({ page: p })
    expect(db.list.mock.calls[0][0].page).toBe(1)
    expect(notFound).not.toHaveBeenCalled()
  })

  it('the last page (16 of 181 sets) is a page', async () => {
    db.list.mockResolvedValue({ sets: sets(1), total: 181 })
    await expect(run({ page: '16' })).resolves.toBeTruthy()
    expect(notFound).not.toHaveBeenCalled()
  })

  it.each(['17', '99'])('?page=%s (after the last page) calls notFound()', async (p) => {
    db.list.mockResolvedValue({ sets: [], total: 181 })
    await expect(run({ page: p })).rejects.toBe(NOT_FOUND)
    expect(notFound).toHaveBeenCalledTimes(1)
  })

  it('a filter with no sets keeps the empty state on any page (no 404)', async () => {
    db.list.mockResolvedValue({ sets: [], total: 0 })
    const html = await render({ difficulty: 'beginner', page: '5' })
    expect(notFound).not.toHaveBeenCalled()
    expect(html).toContain('No practice questions found.')
    expect(html).toContain('0 question sets')
  })

  it('a read failure still reaches the error page (no 404)', async () => {
    db.list.mockRejectedValue(new Error('getQuestionSets: question_sets query failed (status 500)'))
    await expect(run({ page: '99' })).rejects.toThrow('status 500')
    expect(notFound).not.toHaveBeenCalled()
  })

  it('the letter goes to startsWith (not search) and wins over a search; the result line is unchanged', async () => {
    db.list.mockResolvedValue({ sets: sets(3), total: 3 })
    const html = await render({ letter: 'Q', search: 'cost' })
    expect(db.list.mock.calls[0][0]).toMatchObject({ startsWith: 'Q', search: undefined })
    expect(html).toContain('3 question sets<span class="ml-1 font-medium text-navy-950">starting with Q</span>')
  })

  it('a search alone stays a search', async () => {
    await run({ search: 'cost' })
    expect(db.list.mock.calls[0][0]).toMatchObject({ search: 'cost', startsWith: undefined })
  })

  it('the level filter shows only levels with sets', async () => {
    const html = await render()
    expect(levelLinks(html)).toStrictEqual(['intermediate', 'advanced'])
    expect(html).toContain('>All levels<')
    expect(html).not.toContain('>Beginner<')
    expect(html).toContain('>Intermediate<')
    expect(html).toContain('>Advanced<')
  })

  it('a failed filters read is reported once and shows all three levels and no Subject panel, as before', async () => {
    const problem = new Error('mock exam pool: practice-filters question_sets read failed')
    db.filters.mockRejectedValue(problem)
    const html = await render({ category: 'financial-accounting' })
    expect(levelLinks(html)).toStrictEqual(['beginner', 'intermediate', 'advanced'])
    expect(db.report).toHaveBeenCalledTimes(1)
    expect(db.report).toHaveBeenCalledWith('practice filters read failed', problem, { area: 'public' })
    expect(html).not.toContain('>Subject<')
    expect(html).not.toContain('category=')
    expect(db.list.mock.calls[0][0].category).toBeUndefined()
  })

  it('a good filters read reports nothing', async () => {
    await render()
    expect(db.report).not.toHaveBeenCalled()
  })

  it('an address with a level that has no sets still works (empty state, no redirect, no 404)', async () => {
    db.list.mockResolvedValue({ sets: [], total: 0 })
    const html = await render({ difficulty: 'beginner' })
    expect(html).toContain('No practice questions found.')
    expect(db.list.mock.calls[0][0].difficulty).toBe('beginner')
    expect(notFound).not.toHaveBeenCalled()
  })

})

// PQB-2 S2 (D351; PQ-D3 item 6, row 17): the Subject filter.
const subjectLinks = (html: string) => {
  const panel = html.slice(html.indexOf('>Subject</p>'), html.indexOf('</aside>'))
  return Array.from(panel.matchAll(/<a [^>]*>([^<]+)<\/a>/g)).map((m) => m[1])
}
const resultLine = (html: string) => {
  const m = html.match(/<p class="text-sm text-slate-500">(.*?)<\/p>/)
  return m ? m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null
}

describe('pickSubject and visibleSubjects', () => {
  const SUBJECTS = [
    { slug: 'financial-accounting', title: 'Financial Accounting', category: 'financial-accounting' },
    { slug: 'taxation', title: 'Tax', category: 'taxation' },
    { slug: 'audit-assurance', title: 'Audit and Assurance', category: 'audit-assurance' },
  ]
  it.each([
    ['financial-accounting', 'financial-accounting'],
    ['taxation', 'taxation'],
    ['not-a-subject', undefined],
    ['', undefined],
    ['Financial-Accounting', undefined],
    ['FINANCIAL-ACCOUNTING', undefined],
    [' financial-accounting', undefined],
    [undefined, undefined],
    [['financial-accounting'], undefined],
  ] as Array<[unknown, string | undefined]>)('%j → %j', (raw, slug) => {
    expect(pickSubject(SUBJECTS, raw)?.slug).toBe(slug)
  })
  it('only subjects with at least one set, in the given order, as slug and title', () => {
    expect(visibleSubjects(SUBJECTS, { 'audit-assurance': ['a'], 'financial-accounting': ['b', 'c'], taxation: [] })).toStrictEqual([
      { slug: 'financial-accounting', title: 'Financial Accounting' },
      { slug: 'audit-assurance', title: 'Audit and Assurance' },
    ])
    expect(visibleSubjects(SUBJECTS, {})).toStrictEqual([])
  })
})

describe('the page: Subject filter', () => {
  it('the panel shows All subjects and only subjects with sets, in the hub order', async () => {
    expect(subjectLinks(await render())).toStrictEqual(['All subjects', 'Financial Accounting', 'Financial Management', 'Management Accounting', 'Audit and Assurance'])
  })

  it('the levels come from the same read: All levels, Intermediate, Advanced', async () => {
    const html = await render()
    expect(levelLinks(html)).toStrictEqual(['intermediate', 'advanced'])
    expect(db.filters).toHaveBeenCalledTimes(1)
  })

  it('a known subject is passed to the read, kept in links, the hidden input and the result line', async () => {
    db.list.mockResolvedValue({ sets: sets(12), total: 75 })
    const html = await render({ category: 'financial-accounting' })
    expect(db.list.mock.calls[0][0]).toMatchObject({ category: 'financial-accounting', page: 1 })
    expect(resultLine(html)).toBe('75 question sets · Financial Accounting')
    expect(html).toContain('<input type="hidden" name="category" value="financial-accounting"/>')
    const hrefs = Array.from(html.matchAll(/href="(\/practice-questions\?[^"]+)"/g)).map((m) => m[1]).filter((h) => /difficulty=intermediate|letter=F|page=2/.test(h))
    expect(hrefs).toStrictEqual([
      '/practice-questions?category=financial-accounting&amp;difficulty=intermediate&amp;page=1',
      '/practice-questions?category=financial-accounting&amp;letter=F&amp;page=1',
      '/practice-questions?category=financial-accounting&amp;page=2',
      '/practice-questions?category=financial-accounting&amp;page=2',
    ])
    expect(html).toContain('>Clear filters</a>')
  })

  it('subject and level: the result line keeps the level part after the subject', async () => {
    db.list.mockResolvedValue({ sets: sets(9), total: 9 })
    const html = await render({ category: 'financial-accounting', difficulty: 'intermediate' })
    expect(resultLine(html)).toBe('9 question sets · Financial Accounting · intermediate')
  })

  it.each(['not-a-subject', 'Financial-Accounting', ''])('an unknown or empty subject (%j) is ignored: full list, not in links, no hidden input', async (category) => {
    const html = await render({ category })
    expect(db.list.mock.calls[0][0].category).toBeUndefined()
    // Only the Subject panel's own options link to a subject.
    const outsidePanel = html.slice(0, html.indexOf('>Subject</p>')) + html.slice(html.indexOf('</aside>'))
    expect(outsidePanel).not.toContain('category=')
    expect(subjectLinks(html)).toHaveLength(5)
    expect(html).not.toContain('name="category"')
    expect(resultLine(html)).toBe('181 question sets')
    expect(notFound).not.toHaveBeenCalled()
  })

  it('a known subject with no sets shows the empty state (no 404, no redirect)', async () => {
    db.list.mockResolvedValue({ sets: [], total: 0 })
    const html = await render({ category: 'taxation' })
    expect(db.list.mock.calls[0][0].category).toBe('taxation')
    expect(html).toContain('No practice questions found.')
    expect(resultLine(html)).toBe('0 question sets · Tax')
    expect(notFound).not.toHaveBeenCalled()
  })

  it('a page after the last one of a subject is the 404', async () => {
    db.list.mockResolvedValue({ sets: [], total: 75 })
    await expect(run({ category: 'financial-accounting', page: '8' })).rejects.toBe(NOT_FOUND)
  })

  it('no subject: no hidden input, and the top Clear filters link is not shown', async () => {
    const html = await render()
    expect(html).not.toContain('name="category"')
    expect(html).not.toContain('>Clear filters</a>')
  })
})
