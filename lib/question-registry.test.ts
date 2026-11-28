import { describe, expect, it } from 'vitest'
import { REGISTRY_INVALID, eticpaColumnsOf, parseRegistry } from './question-registry'

const VALID = {
  promptId: '0123456789abcdef',
  promptVersion: 'practice-question-set@1.0.0/engine@1.0.0/packs@0123456789abcdef',
  model: 'claude-sonnet-4-6',
  qualityScore: 100,
}

describe('parseRegistry', () => {
  it('has the agreed refusal text', () => {
    expect(REGISTRY_INVALID).toBe('Nothing was published. The quality record of this set is not valid.')
  })

  it('treats a missing record as none (a publish without a record works as before)', () => {
    expect(parseRegistry(undefined)).toEqual({ ok: true, columns: null })
    expect(parseRegistry(null)).toEqual({ ok: true, columns: null })
  })

  it('turns a valid record into the four columns', () => {
    expect(parseRegistry(VALID)).toEqual({
      ok: true,
      columns: { prompt_id: VALID.promptId, prompt_version: VALID.promptVersion, model: VALID.model, quality_score: 100 },
    })
    expect(parseRegistry({ ...VALID, model: 'outside-ai', qualityScore: 0 }).ok).toBe(true)
  })

  it('writes exactly the four columns of migration 0033', () => {
    const r = parseRegistry(VALID)
    if (!r.ok || !r.columns) throw new Error('not parsed')
    expect(Object.keys(r.columns).sort()).toEqual(['model', 'prompt_id', 'prompt_version', 'quality_score'])
  })

  it('refuses anything else', () => {
    const bad: unknown[] = [
      1, 'x', [], {}, { ...VALID, extra: 1 }, { promptId: VALID.promptId },
      { ...VALID, promptId: '0123456789ABCDEF' }, { ...VALID, promptId: '0123456789abcde' }, { ...VALID, promptId: 5 },
      { ...VALID, promptVersion: '' }, { ...VALID, promptVersion: 'x'.repeat(201) }, { ...VALID, promptVersion: 'with space' },
      { ...VALID, promptVersion: 'café' },
      { ...VALID, model: '' }, { ...VALID, model: 'Claude' }, { ...VALID, model: '-x' }, { ...VALID, model: 'a'.repeat(101) },
      { ...VALID, qualityScore: -1 }, { ...VALID, qualityScore: 101 }, { ...VALID, qualityScore: 99.5 }, { ...VALID, qualityScore: '100' },
    ]
    for (const value of bad) expect(parseRegistry(value)).toEqual({ ok: false, error: REGISTRY_INVALID })
  })

  it('accepts the edges of the database rules (16 hex; 1–200 characters; 1–100 characters; 0–100)', () => {
    expect(parseRegistry({ ...VALID, promptVersion: 'x' }).ok).toBe(true)
    expect(parseRegistry({ ...VALID, promptVersion: 'x'.repeat(200) }).ok).toBe(true)
    expect(parseRegistry({ ...VALID, model: 'a' }).ok).toBe(true)
    expect(parseRegistry({ ...VALID, model: 'a'.repeat(100) }).ok).toBe(true)
  })
})

describe('eticpaColumnsOf', () => {
  it('copies both parts, trimmed', () => {
    expect(eticpaColumnsOf({ eticpa_level: ' level-1 ', eticpa_module: 'cost-accounting' }))
      .toEqual({ eticpa_level: 'level-1', eticpa_module: 'cost-accounting' })
  })

  it('never gives one without the other', () => {
    expect(eticpaColumnsOf({ eticpa_level: 'level-1', eticpa_module: null })).toEqual({})
    expect(eticpaColumnsOf({ eticpa_level: null, eticpa_module: 'cost-accounting' })).toEqual({})
    expect(eticpaColumnsOf({})).toEqual({})
  })

  it('refuses values outside the address pattern', () => {
    expect(eticpaColumnsOf({ eticpa_level: 'Level 1', eticpa_module: 'x' })).toEqual({})
    expect(eticpaColumnsOf({ eticpa_level: 'level-1', eticpa_module: 'a'.repeat(101) })).toEqual({})
    expect(eticpaColumnsOf({ eticpa_level: 1, eticpa_module: 'x' })).toEqual({})
    expect(eticpaColumnsOf({ eticpa_level: '  ', eticpa_module: 'x' })).toEqual({})
  })
})
