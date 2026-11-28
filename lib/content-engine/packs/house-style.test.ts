import { describe, expect, it } from 'vitest'
import {
  DIFFICULTY_GUIDE,
  FORBIDDEN_PHRASES,
  FORBIDDEN_PHRASE_LIST,
  INSIGHT_DENSITY,
  ORIGINALITY_AND_LEGAL,
  QUALITY_SELF_CHECK,
  TECHNICAL_ACCURACY,
  VOICE,
} from './house-style'
import { findBodyNames } from './body-names'

const TEXTS = { VOICE, TECHNICAL_ACCURACY, ORIGINALITY_AND_LEGAL, FORBIDDEN_PHRASES, INSIGHT_DENSITY, QUALITY_SELF_CHECK }

describe('house style pack', () => {
  it('every text is non-empty and trimmed', () => {
    for (const text of Object.values(TEXTS)) {
      expect(text.length).toBeGreaterThan(100)
      expect(text).toBe(text.trim())
    }
  })

  it('names no professional body (the body-name rule is referred to instead)', () => {
    for (const text of Object.values(TEXTS)) expect(findBodyNames(text)).toEqual([])
    expect(ORIGINALITY_AND_LEGAL).toContain('Follow the body-name rule')
  })

  it('keeps no markdown or code-format instruction', () => {
    for (const text of Object.values(TEXTS)) {
      expect(text).not.toMatch(/backtick|markdown|code block|---AI_/i)
    }
  })

  it('reads the gate phrase list from the banned opening, filler and structural phrases only', () => {
    expect(FORBIDDEN_PHRASE_LIST).toContain("In today's fast-paced world")
    expect(FORBIDDEN_PHRASE_LIST).toContain('It is worth noting that')
    expect(FORBIDDEN_PHRASE_LIST).toContain('If you found this useful')
    expect(FORBIDDEN_PHRASE_LIST).not.toContain('various')
    expect(FORBIDDEN_PHRASE_LIST).not.toContain('significant')
    expect(FORBIDDEN_PHRASE_LIST).toHaveLength(28)
    for (const phrase of FORBIDDEN_PHRASE_LIST) {
      expect(phrase).not.toMatch(/\.\.\.$/)
      expect(phrase).toBe(phrase.trim())
    }
  })

  it('has a difficulty guide for each difficulty', () => {
    expect(Object.keys(DIFFICULTY_GUIDE).sort()).toEqual(['advanced', 'beginner', 'intermediate'])
    for (const text of Object.values(DIFFICULTY_GUIDE)) expect(text.length).toBeGreaterThan(50)
  })

  it('the self-check is numbered 1 to 11 and refers to its last question', () => {
    const numbers = QUALITY_SELF_CHECK.match(/^\d+\./gm) ?? []
    expect(numbers.map(n => Number(n.slice(0, -1)))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(QUALITY_SELF_CHECK).toContain('If the answer to question 11')
  })
})
