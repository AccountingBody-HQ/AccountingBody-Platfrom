import { describe, expect, it } from 'vitest'
import { canonicalJson, sha16 } from './canonical'

describe('canonicalJson', () => {
  it('sorts object keys at every depth', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}')
  })

  it('keeps array order and leaves out undefined fields', () => {
    expect(canonicalJson({ list: [3, 1, 2], gone: undefined })).toBe('{"list":[3,1,2]}')
  })

  it('gives the same text for the same value built in a different order', () => {
    const one = { x: 'a', y: [1, { q: 1, p: 2 }] }
    const two = { y: [1, { p: 2, q: 1 }], x: 'a' }
    expect(canonicalJson(one)).toBe(canonicalJson(two))
  })
})

describe('sha16', () => {
  it('is 16 lower-case hex characters', () => {
    expect(sha16('abc')).toMatch(/^[0-9a-f]{16}$/)
  })

  it('is the start of the sha256 of the text', () => {
    expect(sha16('abc')).toBe('ba7816bf8f01cfea')
  })

  it('changes when the text changes', () => {
    expect(sha16('abc')).not.toBe(sha16('abd'))
  })
})
