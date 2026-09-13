import { describe, expect, it } from 'vitest'
import { computePageItems, nextPageTarget, parseJumpToPage, prevPageTarget } from './pagination'

describe('computePageItems', () => {
  it('returns just the one page when there is only one', () => {
    expect(computePageItems(1, 1)).toEqual([1])
  })

  it('returns everything with no ellipsis when the whole range fits the window', () => {
    expect(computePageItems(2, 3)).toEqual([1, 2, 3])
  })

  it('still ellipsis-gaps a far-off last page even with a small totalPages', () => {
    // page 1 of 5: window is 1..3, last page (5) is more than 2 away.
    expect(computePageItems(1, 5)).toEqual([1, 2, 3, 'ellipsis', 5])
  })

  it('windows around the current page near the start, with one trailing ellipsis', () => {
    expect(computePageItems(1, 10)).toEqual([1, 2, 3, 'ellipsis', 10])
  })

  it('windows around the current page near the end, with one leading ellipsis', () => {
    expect(computePageItems(10, 10)).toEqual([1, 'ellipsis', 8, 9, 10])
  })

  it('produces both a leading and trailing ellipsis in the middle of a long range', () => {
    expect(computePageItems(50, 100)).toEqual([1, 'ellipsis', 48, 49, 50, 51, 52, 'ellipsis', 100])
  })

  it('never duplicates a page number that is both in the window and first/last', () => {
    // page 3 of 5: window is 1..5, which already includes both ends.
    expect(computePageItems(3, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('returns nothing for a non-positive totalPages', () => {
    expect(computePageItems(1, 0)).toEqual([])
  })
})

describe('parseJumpToPage', () => {
  it('parses a valid in-range page number', () => {
    expect(parseJumpToPage('5', 10)).toBe(5)
  })

  it('trims surrounding whitespace', () => {
    expect(parseJumpToPage('  7  ', 10)).toBe(7)
  })

  it('clamps an out-of-range positive integer to the last page', () => {
    expect(parseJumpToPage('999', 10)).toBe(10)
  })

  it('clamps zero and negative integers up to page 1', () => {
    expect(parseJumpToPage('0', 10)).toBe(1)
    expect(parseJumpToPage('-5', 10)).toBe(1)
  })

  it('ignores non-numeric input rather than treating it as page 1', () => {
    expect(parseJumpToPage('abc', 10)).toBeNull()
    expect(parseJumpToPage('3.5', 10)).toBeNull()
    expect(parseJumpToPage('', 10)).toBeNull()
    expect(parseJumpToPage('   ', 10)).toBeNull()
  })

  it('never returns a page below 1 even when totalPages is 0', () => {
    expect(parseJumpToPage('5', 0)).toBe(1)
    expect(parseJumpToPage('0', 0)).toBe(1)
  })
})

// These two back the href-builder navigation mode: hrefFor(target) is only
// ever called with a real target, so a null here is what tells <Pagination>
// to render a non-link placeholder instead of an <a> pointing nowhere.
describe('prevPageTarget', () => {
  it('is one page back when not on the first page', () => {
    expect(prevPageTarget(5)).toBe(4)
    expect(prevPageTarget(2)).toBe(1)
  })

  it('is null on the first page', () => {
    expect(prevPageTarget(1)).toBeNull()
  })
})

describe('nextPageTarget', () => {
  it('is one page forward when not on the last page', () => {
    expect(nextPageTarget(1, 10)).toBe(2)
    expect(nextPageTarget(9, 10)).toBe(10)
  })

  it('is null on the last page', () => {
    expect(nextPageTarget(10, 10)).toBeNull()
  })

  it('is null when there is only one page total', () => {
    expect(nextPageTarget(1, 1)).toBeNull()
  })
})
