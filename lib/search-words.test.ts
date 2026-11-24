import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sanitiseWord, searchWords } from './search-words'

// W0-1 C1: the article, question-set and course search splits a query on
// spaces and hyphens, so "cash-flow" finds what "cash flow" finds.

describe('searchWords', () => {
  it.each([
    ['cash-flow', ['cash', 'flow']],
    ['cash flow', ['cash', 'flow']],
    ['inventory-valuation statement', ['inventory', 'valuation', 'statement']],
    ['e-commerce', ['commerce']],
    ['IAS 16', ['ias', '16']],
    ['IAS-16', ['ias', '16']],
    [' -- ', []],
    ['', []],
    ['(cash),flow%', ['cashflow']],
    ['(cash), flow%', ['cash', 'flow']],
    ['Cash-flow cash  FLOW', ['cash', 'flow']],
    ['flow - cash', ['flow', 'cash']],
    // A short code whose pieces are all one character stays whole.
    ['W-2 form', ['w-2', 'form']],
    ['a b', []],
    ['-(-', []],
  ])('%j gives %j', (q, words) => {
    expect(searchWords(q)).toEqual(words)
  })

  it('cleans the characters PostgREST filters treat as syntax, as before', () => {
    expect(sanitiseWord('(a,b).c%')).toBe('abc')
  })
})

describe('the search route', () => {
  const route = readFileSync(join(process.cwd(), 'app/api/search/route.ts'), 'utf8')

  it('takes its words from searchWords and has no word splitting of its own', () => {
    expect(route).toContain("import { sanitiseWord, searchWords } from '@/lib/search-words'")
    expect(route).toContain('const words = searchWords(q)')
    expect(route).not.toContain('.split(/\\s+/)')
    expect(route).not.toContain('function sanitiseWord')
  })

  it('still hands the job search the raw query', () => {
    expect(route).toContain('fetchJobsForSearch(rawSearch')
    expect(route).toContain('const rawSearch = q.trim().toLowerCase()')
  })
})
