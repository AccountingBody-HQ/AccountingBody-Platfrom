import * as React from 'react'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseListPage, visibleDifficulties } from './practice-list'

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
  counts: vi.fn(),
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
  getPublicQuestionSetDifficultyCounts: db.counts,
  QUESTION_SET_DIFFICULTIES: ['beginner', 'intermediate', 'advanced'],
}))

import { notFound } from 'next/navigation'
import PracticeQuestionsPage from '@/app/practice-questions/page'

type SP = Record<string, string>
const run = (sp: SP = {}) => PracticeQuestionsPage({ searchParams: Promise.resolve(sp) }) as Promise<ReactElement>
const render = async (sp: SP = {}) => renderToStaticMarkup(await run(sp))
const sets = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, title: `Set ${i}`, slug: `set-${i}`, difficulty: 'advanced' }))
const levelLinks = (html: string) => Array.from(html.matchAll(/href="\/practice-questions\?difficulty=(\w+)[^"]*"/g)).map((m) => m[1])

beforeEach(() => {
  vi.mocked(notFound).mockClear()
  db.list.mockReset()
  db.counts.mockReset()
  db.list.mockResolvedValue({ sets: sets(12), total: 181 })
  db.counts.mockResolvedValue({ beginner: 0, intermediate: 9, advanced: 172 })
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
    expect(db.list).toHaveBeenCalledWith({ difficulty: undefined, search: undefined, startsWith: undefined, page: 1, perPage: 12, sortBy: 'alpha' })
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

  it('a failed count shows all three levels, as before', async () => {
    db.counts.mockRejectedValue(new Error('question set difficulty count failed (status 500)'))
    const html = await render()
    expect(levelLinks(html)).toStrictEqual(['beginner', 'intermediate', 'advanced'])
  })

  it('an address with a level that has no sets still works (empty state, no redirect, no 404)', async () => {
    db.list.mockResolvedValue({ sets: [], total: 0 })
    const html = await render({ difficulty: 'beginner' })
    expect(html).toContain('No practice questions found.')
    expect(db.list.mock.calls[0][0].difficulty).toBe('beginner')
    expect(notFound).not.toHaveBeenCalled()
  })

  it('the hidden Subject panel stays hidden', async () => {
    expect(await render()).not.toContain('>Subject<')
  })
})
