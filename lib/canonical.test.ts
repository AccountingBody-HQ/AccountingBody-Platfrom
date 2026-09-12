import { describe, it, expect } from 'vitest'
import { resolveArticleCanonicalUrl } from './canonical'

// resolveArticleCanonicalUrl is pure and synchronous — it never calls
// headers() itself (only getSiteUrl()/resolveArticleCanonical do, which
// this file doesn't exercise), so importing next/headers at the top of
// lib/canonical.ts doesn't get in the way here: the import binding is
// never invoked, only referenced.

const AB = 'https://accountingbody.com'

describe('resolveArticleCanonicalUrl', () => {
  it('uses /study/{category}/{slug} when category is a non-empty string', () => {
    const url = resolveArticleCanonicalUrl(
      { slug: 'j-curve-guide', category: 'economics', canonical_owner: 'accountingbody', show_on_sites: ['ab'] },
      AB
    )
    expect(url).toBe(`${AB}/study/economics/j-curve-guide`)
  })

  it('lowercases and trims category before building the path', () => {
    const url = resolveArticleCanonicalUrl(
      { slug: 'some-article', category: '  Financial-Accounting  ', canonical_owner: undefined, show_on_sites: [] },
      AB
    )
    expect(url).toBe(`${AB}/study/financial-accounting/some-article`)
  })

  it('falls back to /articles/{slug} when category is absent', () => {
    const url = resolveArticleCanonicalUrl(
      { slug: 'no-category-article', category: undefined, canonical_owner: undefined, show_on_sites: [] },
      AB
    )
    expect(url).toBe(`${AB}/articles/no-category-article`)
  })

  it('falls back to /articles/{slug} when category is an empty or whitespace-only string', () => {
    const url = resolveArticleCanonicalUrl(
      { slug: 'blank-category-article', category: '   ', canonical_owner: undefined, show_on_sites: [] },
      AB
    )
    expect(url).toBe(`${AB}/articles/blank-category-article`)
  })
})
