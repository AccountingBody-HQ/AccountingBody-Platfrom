import { describe, expect, it } from 'vitest'
import {
  ANSWER_BALANCE,
  BANNED_OPTIONS,
  DISTRACTOR_LIBRARY,
  EXPLANATION_STANDARDS,
  LETTER_REFERENCE_PATTERNS,
  OPTION_REFERENCES,
  SCENARIO_ENGINEERING,
  STUDIO_QUESTION_STANDARD,
} from './assessment'
import { findBodyNames } from './body-names'

const TEXTS = { DISTRACTOR_LIBRARY, EXPLANATION_STANDARDS, SCENARIO_ENGINEERING, STUDIO_QUESTION_STANDARD, ANSWER_BALANCE, OPTION_REFERENCES }

describe('assessment pack', () => {
  it('every text is non-empty and names no professional body', () => {
    for (const text of Object.values(TEXTS)) {
      expect(text.trim().length).toBeGreaterThan(50)
      expect(findBodyNames(text)).toEqual([])
    }
  })

  it('keeps the option-reference sentence exactly', () => {
    expect(OPTION_REFERENCES).toBe('Refer to every option by its content, never by its letter or position (the site shuffles options).')
  })

  it('the Studio standard has no fixed question count, no JSON template and no import step', () => {
    expect(STUDIO_QUESTION_STANDARD).not.toMatch(/exactly 25|q1 through q25|"questions"|AFTER IMPORTING|Linked Article ID/)
    expect(STUDIO_QUESTION_STANDARD).toContain('COMPONENT 5 — LEARNING TAKEAWAY')
    expect(STUDIO_QUESTION_STANDARD).toContain('Minimum explanation length: 120 words. Maximum: 300 words.')
  })

  it('the explanation template names wrong options by content, not by letter', () => {
    for (const pattern of LETTER_REFERENCE_PATTERNS) {
      expect(pattern.test(EXPLANATION_STANDARDS)).toBe(false)
    }
  })

  it('keeps the five letter-reference patterns exactly (parity with the live repair count)', () => {
    expect(LETTER_REFERENCE_PATTERNS.map(p => `/${p.source}/${p.flags}`)).toEqual([
      '/\\b(option|answer|choice)\\s*\\(?[a-d]\\)?(\\b|[.,:;)])/i',
      '/\\(([a-d])\\)\\s/i',
      '/\\b([a-d])\\)\\s/i',
      '/\\b(first|second|third|fourth|last|final)\\s+(option|answer|choice)/i',
      '/\\boptions?\\s+[a-d]\\s+(and|or)\\s+[a-d]\\b/i',
    ])
  })

  it('lists the nine banned options in lower case', () => {
    expect(BANNED_OPTIONS).toHaveLength(9)
    for (const option of BANNED_OPTIONS) expect(option).toBe(option.toLowerCase().trim())
  })
})
