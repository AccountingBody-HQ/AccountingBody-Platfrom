import { describe, expect, it } from 'vitest'
import { findBodyNames } from './body-names'
import { REVIEWER_RULES } from './reviewer'

describe('reviewer rules', () => {
  it('asks for findings in the fixed JSON shape', () => {
    expect(REVIEWER_RULES).toContain('{ "findings": [ { "where": string, "problem": string, "suggestion": string } ] }')
  })

  it('never asks for a rewritten text', () => {
    expect(REVIEWER_RULES).toContain('You never rewrite the content and never return a corrected version.')
    expect(REVIEWER_RULES).not.toMatch(/return the complete corrected|return it unchanged|remove and rephrase/i)
  })

  it('names no professional body', () => {
    expect(findBodyNames(REVIEWER_RULES)).toEqual([])
  })
})
