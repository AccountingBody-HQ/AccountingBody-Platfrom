import { describe, expect, it } from 'vitest'
import { findBodyNames } from '../packs/body-names'
import { BLOCK_TYPES, BLUEPRINT_IDS, CONTENT_TYPES, SUBJECT_KEYS } from '../types'
import { BLUEPRINTS, blueprintFor, sectionsFor } from './index'

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

describe('blueprints', () => {
  it('has the seven blueprints, each at version 1.0.0 and keyed by its own id', () => {
    expect(Object.keys(BLUEPRINTS)).toEqual([...BLUEPRINT_IDS])
    for (const id of BLUEPRINT_IDS) {
      expect(BLUEPRINTS[id].id).toBe(id)
      expect(BLUEPRINTS[id].version).toBe('1.0.0')
      expect(BLUEPRINTS[id].purpose.length).toBeGreaterThan(50)
      expect(BLUEPRINTS[id].rules.length).toBeGreaterThan(0)
    }
  })

  it('maps every one of the 13 content types to exactly one blueprint', () => {
    for (const type of CONTENT_TYPES) {
      const owners = BLUEPRINT_IDS.filter(id => BLUEPRINTS[id].contentTypes.indexOf(type) >= 0)
      expect(owners, type).toHaveLength(1)
      expect(blueprintFor(type).blueprint.id).toBe(owners[0])
    }
  })

  it('maps the seven guides to topic-guide with their preset and subject', () => {
    const expected: Record<string, string> = {
      'accounting-guide': 'financial-accounting',
      'management-accounting-guide': 'management-accounting',
      'tax-guide': 'taxation',
      'audit-assurance-guide': 'audit-assurance',
      'financial-management-guide': 'financial-management',
      'ethics-professional-standards-guide': 'ethics-professional-standards',
      'business-law-regulation-guide': 'business-law-regulation',
    }
    for (const [type, subject] of Object.entries(expected)) {
      const choice = blueprintFor(type as (typeof CONTENT_TYPES)[number])
      expect(choice.blueprint.id).toBe('topic-guide')
      expect(choice.preset?.contentType).toBe(type)
      expect(choice.preset?.subject).toBe(subject)
      expect(SUBJECT_KEYS).toContain(choice.preset?.subject)
    }
    expect(blueprintFor('article').preset).toBeUndefined()
  })

  it('uses unique kebab-case section ids, known block types and sane word ranges', () => {
    for (const type of CONTENT_TYPES) {
      const choice = blueprintFor(type)
      const sections = sectionsFor(choice)
      const ids = sections.map(s => s.id)
      expect(new Set(ids).size, type).toBe(ids.length)
      for (const s of sections) {
        expect(s.id, type).toMatch(KEBAB)
        expect(s.minWords, `${type} ${s.id}`).toBeLessThan(s.maxWords)
        expect(s.minWords).toBeGreaterThan(0)
        expect(s.maxWords).toBeLessThanOrEqual(choice.blueprint.totalWords.max)
        for (const b of s.requiredBlockTypes) expect(BLOCK_TYPES).toContain(b)
        expect(s.requiredBlockTypes.length).toBeGreaterThan(0)
      }
      if (choice.blueprint.output === 'document') {
        const required = sections.filter(s => !s.optional)
        const minSum = required.reduce((n, s) => n + s.minWords, 0)
        const maxSum = sections.reduce((n, s) => n + s.maxWords, 0)
        expect(minSum, type).toBeLessThanOrEqual(choice.blueprint.totalWords.max)
        expect(maxSum, type).toBeGreaterThanOrEqual(choice.blueprint.totalWords.min)
        expect(choice.blueprint.totalWords.min).toBeLessThan(choice.blueprint.totalWords.max)
      } else {
        expect(sections).toEqual([])
      }
    }
  })

  it('the study note requires a worked example, a check-your-understanding and a takeaway', () => {
    const blocks = BLUEPRINTS['study-note'].sections.flatMap(s => s.requiredBlockTypes)
    expect(blocks).toContain('worked_example')
    expect(blocks).toContain('check_understanding')
    expect(blocks).toContain('takeaway')
  })

  it('puts a preset\'s extra sections before common-errors', () => {
    const ids = sectionsFor(blueprintFor('tax-guide')).map(s => s.id)
    expect(ids).toEqual([
      'topic-overview', 'core-principles', 'practical-application',
      'key-calculations', 'planning-considerations', 'compliance-obligations', 'professional-caveats',
      'common-errors', 'key-takeaways',
    ])
  })

  it('the subject overview has an optional related-notes section last', () => {
    const sections = BLUEPRINTS['subject-overview'].sections
    expect(sections[sections.length - 1].id).toBe('related-notes')
    expect(sections[sections.length - 1].optional).toBe(true)
    expect(sections.filter(s => s.optional)).toHaveLength(1)
  })

  it('uses document output for five blueprints, questionSet and explainer for the others', () => {
    expect(BLUEPRINTS['practice-question-set'].output).toBe('questionSet')
    expect(BLUEPRINTS['question-explainer'].output).toBe('explainer')
    expect(BLUEPRINTS['question-explainer'].totalWords).toEqual({ min: 400, max: 900 })
    for (const id of ['article', 'study-note', 'exam-technique-guide', 'subject-overview', 'topic-guide'] as const) {
      expect(BLUEPRINTS[id].output).toBe('document')
    }
  })

  it('no blueprint text names a professional body', () => {
    const text = JSON.stringify(BLUEPRINTS)
    expect(findBodyNames(text)).toEqual([])
  })
})
