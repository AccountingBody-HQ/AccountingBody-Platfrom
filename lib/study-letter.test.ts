import { describe, it, expect } from 'vitest'
import { OTHER_KEY, OTHER_PARAM, groupAlphabetically, pickLetter, letterHref } from './study-letter'

const AVAILABLE = ['A', 'C', 'X', OTHER_KEY]

describe('pickLetter', () => {
  it('returns a valid letter that has articles', () => {
    expect(pickLetter('C', AVAILABLE)).toBe('C')
  })
  it('accepts a lowercase letter', () => {
    expect(pickLetter('c', AVAILABLE)).toBe('C')
  })
  it('trims whitespace', () => {
    expect(pickLetter('  x ', AVAILABLE)).toBe('X')
  })
  it("maps 'other' to the other group", () => {
    expect(pickLetter('other', AVAILABLE)).toBe(OTHER_KEY)
    expect(pickLetter('OTHER', AVAILABLE)).toBe(OTHER_KEY)
    expect(OTHER_PARAM).toBe('other')
  })
  it('falls back to the default for invalid values', () => {
    expect(pickLetter('zz', AVAILABLE)).toBe('A')
    expect(pickLetter('1', AVAILABLE)).toBe('A')
    expect(pickLetter('', AVAILABLE)).toBe('A')
    expect(pickLetter(['C', 'X'], AVAILABLE)).toBe('A')
    expect(pickLetter(undefined, AVAILABLE)).toBe('A')
  })
  it('falls back to the default for a letter with no articles', () => {
    expect(pickLetter('B', AVAILABLE)).toBe('A')
  })
  it("falls back for 'other' when there is no other group", () => {
    expect(pickLetter('other', ['B', 'D'])).toBe('B')
  })
  it('uses the first letter with articles as the default', () => {
    expect(pickLetter(undefined, ['D', 'M'])).toBe('D')
  })
  it('returns an empty string when nothing is available', () => {
    expect(pickLetter('A', [])).toBe('')
    expect(pickLetter(undefined, [])).toBe('')
  })
})

describe('groupAlphabetically', () => {
  const items = [
    { title: 'beta one' },
    { title: '1st item' },
    { title: 'Alpha' },
    { title: 'Bravo' },
    { title: '"Quoted"' },
    { title: 'apple' },
    { title: 'Élan' },
    { title: 'beta two' },
  ]
  const groups = groupAlphabetically(items)

  it('groups by uppercased first letter, A to Z, with other last', () => {
    expect(groups.map(g => g.letter)).toEqual(['A', 'B', OTHER_KEY])
  })
  it('puts titles not starting with A–Z in the other group', () => {
    const other = groups.find(g => g.letter === OTHER_KEY)!
    expect(other.articles.map(a => a.title)).toEqual(['1st item', '"Quoted"', 'Élan'])
  })
  it('keeps every item', () => {
    expect(groups.reduce((n, g) => n + g.articles.length, 0)).toBe(items.length)
  })
  it('keeps the order inside a group', () => {
    const b = groups.find(g => g.letter === 'B')!
    expect(b.articles.map(a => a.title)).toEqual(['beta one', 'Bravo', 'beta two'])
    const a = groups.find(g => g.letter === 'A')!
    expect(a.articles.map(x => x.title)).toEqual(['Alpha', 'apple'])
  })
  it('returns no groups for no items', () => {
    expect(groupAlphabetically([])).toEqual([])
  })
})

describe('letterHref', () => {
  it('uses the plain address for the default letter', () => {
    expect(letterHref('acca', 'A', 'A')).toBe('/study/acca')
  })
  it('adds the letter for other letters', () => {
    expect(letterHref('acca', 'C', 'A')).toBe('/study/acca?letter=C')
  })
  it("uses 'other' for the other group", () => {
    expect(letterHref('acca', OTHER_KEY, 'A')).toBe('/study/acca?letter=other')
  })
})
