import { describe, it, expect } from 'vitest'
import { toStoredSlug, LEGACY_SLUG_RE } from '@/lib/slug-param'

// lib/slug-param.ts: a slug route parameter, in whatever form Next.js hands
// it over, becomes the stored slug form (lowercase %xx escapes), or null when
// it is not a slug, so the caller can refuse it before any database read.

describe('toStoredSlug', () => {
  it.each([
    ['lease-guide', 'lease-guide'],
    ['ias-16', 'ias-16'],
    ['beta-β', 'beta-%ce%b2'],
    ['beta-%CE%B2', 'beta-%ce%b2'],
    ['beta-%ce%b2', 'beta-%ce%b2'],
    ['beta-%25ce%25b2', 'beta-%ce%b2'],
    ['caf%25c3%25a9', 'caf%c3%a9'],
    ['café', 'caf%c3%a9'],
  ])('%s → %s', (param, stored) => {
    expect(toStoredSlug(param)).toBe(stored)
  })

  it.each([
    ['fixed%2Fcosts'],
    ['fixed%2fcosts'],
    ['fixed%20costs'],
    ['fixed%252Fcosts'],
    ['fixed/costs'],
    ['fixed costs'],
    ['%zz'],
    ['%e0%a4'],
    ['%E0%A4%A'],
    ['Lease'],
    ['BETA-%CE%92'],
    ['fixed_costs'],
    ['wp-login.php'],
    ['fixed--costs'],
    ['-fixed'],
    ['fixed-'],
    ['100%25'],
    [''],
  ])('%s → null', (param) => {
    expect(toStoredSlug(param)).toBeNull()
  })

  it('decodes at most twice', () => {
    expect(toStoredSlug('beta-%2525ce%2525b2')).toBeNull()
  })

  it('always returns a value of the stored slug shape', () => {
    for (const param of ['lease-guide', 'beta-β', 'beta-%CE%B2', 'beta-%25ce%25b2', 'caf%25c3%25a9']) {
      const stored = toStoredSlug(param)
      expect(stored).not.toBeNull()
      expect(LEGACY_SLUG_RE.test(stored as string)).toBe(true)
    }
  })
})
