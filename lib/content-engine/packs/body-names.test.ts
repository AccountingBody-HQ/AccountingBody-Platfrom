import { describe, expect, it } from 'vitest'
import { BODY_NAMES, BODY_NAME_RULE, findBodyNames } from './body-names'

describe('body names', () => {
  it('lists the four bodies and their full names', () => {
    expect(BODY_NAMES).toHaveLength(8)
    expect(BODY_NAMES.slice(0, 4)).toEqual(['ACCA', 'CIMA', 'ICAEW', 'AAT'])
  })

  it('the rule sentence is exact', () => {
    expect(BODY_NAME_RULE).toBe('Never name ACCA, CIMA, ICAEW or AAT (or their full names) in the content; write for the level described, not for a named body.')
  })

  it('matches acronyms as whole words, case-sensitively', () => {
    expect(findBodyNames('Study for ACCA exams.')).toEqual(['ACCA'])
    expect(findBodyNames('(CIMA)')).toEqual(['CIMA'])
    expect(findBodyNames('acca students')).toEqual([])
    expect(findBodyNames('ACCAS')).toEqual([])
    expect(findBodyNames('MAAT and AATX')).toEqual([])
  })

  it('matches full names in any case and across line breaks', () => {
    expect(findBodyNames('the association of chartered certified accountants')).toEqual(['Association of Chartered Certified Accountants'])
    expect(findBodyNames('Institute of Chartered Accountants\nin England and Wales')).toEqual(['Institute of Chartered Accountants in England and Wales'])
  })

  it('allows ETICPA and the Ethiopian institute', () => {
    expect(findBodyNames('ETICPA level 2 and the Institute of Certified Public Accountants of Ethiopia')).toEqual([])
  })

  it('finds every name once, in list order', () => {
    expect(findBodyNames('AAT then ACCA then ACCA')).toEqual(['ACCA', 'AAT'])
  })
})
