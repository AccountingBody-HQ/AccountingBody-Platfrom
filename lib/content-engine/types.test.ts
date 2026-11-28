import { describe, expect, it } from 'vitest'
import {
  BLOCK_TYPES,
  BLUEPRINT_IDS,
  CHECK_ORDER,
  CONTENT_TYPES,
  DIFFICULTIES,
  JURISDICTIONS,
  LEVEL_IDS,
  SUBJECT_KEYS,
} from './types'

const unique = (list: readonly string[]) => new Set(list).size === list.length

describe('engine value lists', () => {
  it('has the 13 content types', () => {
    expect(CONTENT_TYPES).toHaveLength(13)
    expect(unique(CONTENT_TYPES)).toBe(true)
  })

  it('has the 7 blueprints', () => {
    expect(BLUEPRINT_IDS).toEqual([
      'article', 'study-note', 'exam-technique-guide', 'practice-question-set',
      'question-explainer', 'subject-overview', 'topic-guide',
    ])
  })

  it('has the 13 block types', () => {
    expect(BLOCK_TYPES).toHaveLength(13)
    expect(unique(BLOCK_TYPES)).toBe(true)
  })

  it('has the 6 levels, 11 subject keys, 2 jurisdictions and 3 difficulties', () => {
    expect(LEVEL_IDS).toEqual(['acca', 'cima', 'icaew', 'aat', 'eticpa-cpa', 'eticpa-atq'])
    expect(SUBJECT_KEYS).toHaveLength(11)
    expect(SUBJECT_KEYS[SUBJECT_KEYS.length - 1]).toBe('general')
    expect(JURISDICTIONS).toEqual(['uk-ifrs', 'ethiopia'])
    expect(DIFFICULTIES).toEqual(['beginner', 'intermediate', 'advanced'])
  })

  it('lists every check id once, with the parse checks before the content checks', () => {
    expect(unique(CHECK_ORDER)).toBe(true)
    expect(CHECK_ORDER.indexOf('parse.json')).toBeLessThan(CHECK_ORDER.indexOf('envelope.engine'))
    expect(CHECK_ORDER.indexOf('style.forbidden')).toBeLessThan(CHECK_ORDER.indexOf('q.count'))
    expect(CHECK_ORDER).toHaveLength(30)
  })
})
