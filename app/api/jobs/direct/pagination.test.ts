import { describe, it, expect } from 'vitest'
import { parseLimit, parseOffset, DEFAULT_LIMIT, MAX_LIMIT, MAX_OFFSET } from './pagination'

describe('parseLimit', () => {
  it('caps an oversized limit at the maximum', () => {
    expect(parseLimit('100000')).toBe(MAX_LIMIT)
    expect(parseLimit('51')).toBe(50)
    expect(parseLimit('9'.repeat(400))).toBe(MAX_LIMIT)
  })

  it.each(['0', '-5', 'abc', '2.7', '1e3', '', ' 24'])('uses the default for %j', (value) => {
    expect(parseLimit(value)).toBe(DEFAULT_LIMIT)
  })

  it('uses the default when limit is missing', () => {
    expect(parseLimit(null)).toBe(DEFAULT_LIMIT)
  })

  it('leaves normal values unchanged', () => {
    expect(parseLimit('1')).toBe(1)
    expect(parseLimit('24')).toBe(24)
    expect(parseLimit('50')).toBe(50)
  })
})

describe('parseOffset', () => {
  it.each(['-1', 'abc', '2.5', ''])('uses 0 for %j', (value) => {
    expect(parseOffset(value)).toBe(0)
  })

  it('uses 0 when offset is missing', () => {
    expect(parseOffset(null)).toBe(0)
  })

  it('caps an oversized offset at the maximum', () => {
    expect(parseOffset('999999')).toBe(MAX_OFFSET)
    expect(parseOffset('999999')).toBe(100000)
    expect(parseOffset('100001')).toBe(100000)
  })

  it('leaves normal values unchanged', () => {
    expect(parseOffset('0')).toBe(0)
    expect(parseOffset('24')).toBe(24)
    expect(parseOffset('10001')).toBe(10001)
    expect(parseOffset('100000')).toBe(100000)
  })
})
