import { describe, expect, it } from 'vitest'
import { LEVEL_IDS } from '../types'
import { LEVEL_PACKS } from './levels'

describe('level packs', () => {
  it('has one pack per level, keyed by its own id', () => {
    expect(Object.keys(LEVEL_PACKS).sort()).toEqual([...LEVEL_IDS].sort())
    for (const id of LEVEL_IDS) expect(LEVEL_PACKS[id].id).toBe(id)
  })

  it('every pack has an internal label, a depth text and a question calibration text', () => {
    for (const id of LEVEL_IDS) {
      const pack = LEVEL_PACKS[id]
      expect(pack.internalLabel.length).toBeGreaterThan(2)
      expect(pack.depth.length).toBeGreaterThan(500)
      expect(pack.questionCalibration.length).toBeGreaterThan(200)
      expect(pack.depth).toBe(pack.depth.trim())
      expect(pack.questionCalibration).toBe(pack.questionCalibration.trim())
    }
  })

  it('renders the tier map as lines for the four bodies that have one', () => {
    for (const id of ['acca', 'cima', 'icaew', 'aat'] as const) {
      const text = LEVEL_PACKS[id].questionCalibration
      expect(text).toContain('EXAM TIERS (internal):')
      expect(text).toMatch(/^- beginner: /m)
      expect(text).toMatch(/^- intermediate: /m)
      expect(text).toMatch(/^- advanced: /m)
    }
  })

  it('keeps the owner text that the ETICPA name stays out of published output', () => {
    expect(LEVEL_PACKS['eticpa-cpa'].depth).toContain('Never mention ETiCPA or ETICPA by name in published output')
    expect(LEVEL_PACKS['eticpa-atq'].depth).toContain('Never mention ETiCPA or ETICPA by name in published output')
  })
})
