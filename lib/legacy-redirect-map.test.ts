import { describe, it, expect } from 'vitest'
import { LEGACY_RENAMED_SLUGS, LEGACY_RENAMED_SLUG_COUNT } from '@/lib/legacy-redirect-map'
import { LEGACY_SLUG_RE, toStoredSlug } from '@/lib/slug-param'

// lib/legacy-redirect-map.ts: the frozen map of renamed old WordPress slugs.

describe('legacy renamed-slug map', () => {
  it('holds exactly 148 rows', () => {
    expect(LEGACY_RENAMED_SLUG_COUNT).toBe(148)
    expect(LEGACY_RENAMED_SLUGS.size).toBe(LEGACY_RENAMED_SLUG_COUNT)
  })

  it('has every key in the stored slug form', () => {
    for (const key of Array.from(LEGACY_RENAMED_SLUGS.keys())) {
      expect(LEGACY_SLUG_RE.test(key), key).toBe(true)
      expect(toStoredSlug(key), key).toBe(key)
    }
  })

  it('has every target in the stored slug form and never points a key at itself', () => {
    for (const [key, target] of Array.from(LEGACY_RENAMED_SLUGS)) {
      expect(target.slug, key).not.toBe(key)
      expect(toStoredSlug(target.slug), key).toBe(target.slug)
    }
  })

  it('uses only the two kinds, with exactly 10 question-set rows', () => {
    const kinds = Array.from(LEGACY_RENAMED_SLUGS.values()).map((target) => target.kind)
    expect(new Set(kinds)).toEqual(new Set(['article', 'question-set']))
    expect(kinds.filter((kind) => kind === 'question-set')).toHaveLength(10)
  })
})
