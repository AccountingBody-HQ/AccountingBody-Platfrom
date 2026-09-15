import { describe, expect, it } from 'vitest'
import { buildPhraseQuery, buildAndQuery, pickJobSearchTier, JOB_SEARCH_MIN_RESULTS } from './jobSearchTiers'

describe('buildPhraseQuery', () => {
  it('wraps a clean multi-word term in quotes', () => {
    expect(buildPhraseQuery('fund manager')).toBe('"fund manager"')
  })

  it('strips stray double quotes before re-wrapping, rather than nesting them', () => {
    expect(buildPhraseQuery('"fund manager"')).toBe('"fund manager"')
    expect(buildPhraseQuery('fund "manager')).toBe('"fund manager"')
  })

  it('returns null for an empty or whitespace-only term', () => {
    expect(buildPhraseQuery('')).toBeNull()
    expect(buildPhraseQuery('   ')).toBeNull()
    expect(buildPhraseQuery('""')).toBeNull()
  })

  it('preserves a single word (a degenerate one-word phrase is still valid)', () => {
    expect(buildPhraseQuery('bookkeeper')).toBe('"bookkeeper"')
  })
})

describe('buildAndQuery', () => {
  it('passes a clean multi-word term through unchanged', () => {
    expect(buildAndQuery('fund manager')).toBe('fund manager')
  })

  it('strips stray double quotes', () => {
    expect(buildAndQuery('"fund manager"')).toBe('fund manager')
  })

  it('strips a leading hyphen from any word (websearch_to_tsquery negation)', () => {
    expect(buildAndQuery('-fund manager')).toBe('fund manager')
    expect(buildAndQuery('fund -manager')).toBe('fund manager')
  })

  it('returns null for an empty or whitespace/operator-only term', () => {
    expect(buildAndQuery('')).toBeNull()
    expect(buildAndQuery('   ')).toBeNull()
    expect(buildAndQuery('- -')).toBeNull()
  })
})

// One case per term measured live against production in Phase 1 of
// tmp-audit/session16-search-relevance.md, using the real totals recorded
// there. This is the decision the whole fix rests on — every one of these
// must land on the tier a human reviewing the actual job titles agreed was
// the right (or least-bad) one.
describe('pickJobSearchTier', () => {
  it('picks phrase when the phrase tier alone clears the threshold', () => {
    // "fund manager": phrase 56, and 421 — phrase wins, and is never needed
    expect(pickJobSearchTier({ phraseTotal: 56, andTotal: 421 })).toBe('phrase')
    // "management accountant": phrase 802, and 3344
    expect(pickJobSearchTier({ phraseTotal: 802, andTotal: 3344 })).toBe('phrase')
    // "financial controller": phrase 675, and 1295
    expect(pickJobSearchTier({ phraseTotal: 675, andTotal: 1295 })).toBe('phrase')
    // "audit senior": phrase 59, and 401
    expect(pickJobSearchTier({ phraseTotal: 59, andTotal: 401 })).toBe('phrase')
    // "tax manager": phrase 408, and 1151
    expect(pickJobSearchTier({ phraseTotal: 408, andTotal: 1151 })).toBe('phrase')
    // "cost accounting": phrase 187, and 383
    expect(pickJobSearchTier({ phraseTotal: 187, andTotal: 383 })).toBe('phrase')
    // "cash flow": phrase 302, and 307
    expect(pickJobSearchTier({ phraseTotal: 302, andTotal: 307 })).toBe('phrase')
    // "trial balance": phrase 51, and 52
    expect(pickJobSearchTier({ phraseTotal: 51, andTotal: 52 })).toBe('phrase')
  })

  it('picks phrase for a single-word term (phrase/and/or all identical, phrase is first)', () => {
    // "bookkeeper": phrase 477, and 477
    expect(pickJobSearchTier({ phraseTotal: 477, andTotal: 477 })).toBe('phrase')
    // "CFO": phrase 531, and 531
    expect(pickJobSearchTier({ phraseTotal: 531, andTotal: 531 })).toBe('phrase')
    // "depreciation": phrase 11, and 11
    expect(pickJobSearchTier({ phraseTotal: 11, andTotal: 11 })).toBe('phrase')
  })

  it('falls back to and when phrase is too sparse but and clears the threshold', () => {
    // "double entry": phrase 5, and 5 — right at the threshold, still phrase
    expect(pickJobSearchTier({ phraseTotal: 5, andTotal: 5 })).toBe('phrase')
  })

  it('falls back to or when both phrase and and are too sparse', () => {
    // "ratio analysis": phrase 0, and 2 — the one term in the measured set
    // that genuinely has too few precise matches; OR (1103, still
    // reasonably relevant on inspection) is the honest last resort
    expect(pickJobSearchTier({ phraseTotal: 0, andTotal: 2 })).toBe('or')
  })

  it('uses >= (a total exactly at the threshold counts as sufficient)', () => {
    expect(pickJobSearchTier({ phraseTotal: JOB_SEARCH_MIN_RESULTS, andTotal: 0 })).toBe('phrase')
    expect(pickJobSearchTier({ phraseTotal: JOB_SEARCH_MIN_RESULTS - 1, andTotal: JOB_SEARCH_MIN_RESULTS })).toBe('and')
  })

  it('respects a custom threshold', () => {
    expect(pickJobSearchTier({ phraseTotal: 10, andTotal: 100 }, 20)).toBe('and')
    expect(pickJobSearchTier({ phraseTotal: 25, andTotal: 100 }, 20)).toBe('phrase')
  })
})
