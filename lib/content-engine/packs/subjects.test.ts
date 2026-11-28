import { describe, expect, it } from 'vitest'
import { MOCK_EXAM_SUBJECTS } from '@/lib/mock-exam-subjects'
import { SUBJECT_KEYS } from '../types'
import { SUBJECT_PACKS, subjectContext, toSubjectKey } from './subjects'

describe('subject packs', () => {
  it('has a non-empty text for every subject key', () => {
    expect(Object.keys(SUBJECT_PACKS).sort()).toEqual([...SUBJECT_KEYS].sort())
    for (const key of SUBJECT_KEYS) {
      expect(subjectContext(key).length).toBeGreaterThan(100)
      expect(subjectContext(key)).toBe(SUBJECT_PACKS[key])
    }
  })

  it('the first eight keys are the site mock-exam subjects, in the same order', () => {
    expect(SUBJECT_KEYS.slice(0, 8)).toEqual(MOCK_EXAM_SUBJECTS.map(s => s.slug))
  })

  it('puts the content generator text before the question generator text', () => {
    const text = SUBJECT_PACKS['financial-accounting']
    expect(text.indexOf('SUBJECT TECHNICAL STANDARDS — FINANCIAL REPORTING:')).toBe(0)
    expect(text.indexOf('FINANCIAL REPORTING — TECHNICAL STANDARDS:')).toBeGreaterThan(text.indexOf('SUBJECT TECHNICAL STANDARDS — CORPORATE REPORTING:'))
  })

  it('maps the subjects with no text of their own to the general text', () => {
    for (const key of ['financial-market', 'ethics-professional-standards', 'business-law-regulation'] as const) {
      expect(SUBJECT_PACKS[key]).toBe(SUBJECT_PACKS.general)
    }
  })
})

describe('toSubjectKey', () => {
  it('returns a subject key given as itself', () => {
    for (const key of SUBJECT_KEYS) expect(toSubjectKey(key)).toBe(key)
    expect(toSubjectKey('  Taxation  ')).toBe('taxation')
  })

  it('maps the old subject names', () => {
    expect(toSubjectKey('Financial Reporting')).toBe('financial-accounting')
    expect(toSubjectKey('Performance Management')).toBe('management-accounting')
    expect(toSubjectKey('Strategic Business')).toBe('business-management')
    expect(toSubjectKey('Bookkeeping')).toBe('financial-accounting')
    expect(toSubjectKey('Business Economics')).toBe('economics')
    expect(toSubjectKey('Audit and Assurance')).toBe('audit-assurance')
  })

  it('keeps the old keyword rules and their order', () => {
    expect(toSubjectKey('Group accounts')).toBe('financial-accounting')
    expect(toSubjectKey('Advanced tax planning')).toBe('taxation')
    expect(toSubjectKey('Investment appraisal (FM)')).toBe('financial-management')
  })

  it('maps the new ethics, law and market words', () => {
    expect(toSubjectKey('Professional ethics')).toBe('ethics-professional-standards')
    expect(toSubjectKey('Company law')).toBe('business-law-regulation')
    expect(toSubjectKey('Money markets')).toBe('financial-market')
  })

  it('falls back to general and is deterministic', () => {
    expect(toSubjectKey('')).toBe('general')
    expect(toSubjectKey('Something unrelated')).toBe('general')
    expect(toSubjectKey('Something unrelated')).toBe(toSubjectKey('Something unrelated'))
  })
})
