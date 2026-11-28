import { describe, expect, it } from 'vitest'
import { ETICPA_MOCK_MODULES } from '@/lib/mock-exam-subjects'
import { JURISDICTIONS } from '../types'
import { ETICPA_LEVELS, ETICPA_MODULES, JURISDICTION_PACKS } from './jurisdictions'

describe('jurisdiction packs', () => {
  it('has a rules text for each jurisdiction', () => {
    expect(Object.keys(JURISDICTION_PACKS).sort()).toEqual([...JURISDICTIONS].sort())
    for (const j of JURISDICTIONS) expect(JURISDICTION_PACKS[j].length).toBeGreaterThan(100)
  })

  it('states rules only: no rate, percentage or year of its own', () => {
    for (const j of JURISDICTIONS) {
      expect(JURISDICTION_PACKS[j]).not.toMatch(/\d/)
    }
  })

  it('ties tax figures to the brief date and forbids invented figures', () => {
    for (const j of JURISDICTIONS) {
      expect(JURISDICTION_PACKS[j]).toContain('"valid as at" date in the brief')
    }
    expect(JURISDICTION_PACKS.ethiopia).toContain('NEVER invent a rate, threshold, proclamation number or date.')
  })

  it('keeps the same ETICPA modules as the site, in the same order and spelling', () => {
    expect(ETICPA_MODULES).toEqual(ETICPA_MOCK_MODULES)
  })

  it('lists three ETICPA levels, and only levels 1 and 2 have open modules', () => {
    expect(ETICPA_LEVELS).toEqual(['level-1', 'level-2', 'level-3'])
    expect(ETICPA_MODULES.some(m => m.level === 'level-3')).toBe(false)
  })
})
