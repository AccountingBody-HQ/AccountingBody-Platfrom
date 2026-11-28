import { describe, expect, it } from 'vitest'
import { isIsoDate, validateBrief } from './brief'
import { ARTICLE_BRIEF, EXPLAINER_BRIEF, FIXTURE_BRIEFS, QUESTION_SET_BRIEF, SOURCE, TAX_GUIDE_BRIEF } from './fixtures/briefs'

const errorsOf = (value: unknown) => validateBrief(value).findings.map(f => f.path)

describe('validateBrief', () => {
  it('accepts every fixture brief, unchanged', () => {
    for (const [, brief] of FIXTURE_BRIEFS) {
      const result = validateBrief(brief)
      expect(result.findings).toEqual([])
      expect(result.brief).toBe(brief)
    }
  })

  it('refuses a non-object and lists every problem at once', () => {
    expect(validateBrief(null).brief).toBeNull()
    expect(errorsOf({})).toEqual(['brief.contentType', 'brief.topic', 'brief.level', 'brief.subject', 'brief.jurisdiction'])
  })

  it('refuses unknown fields and unknown values', () => {
    expect(errorsOf({ ...ARTICLE_BRIEF, colour: 'red' })).toEqual(['brief.colour'])
    expect(errorsOf({ ...ARTICLE_BRIEF, level: 'cpa' })).toEqual(['brief.level'])
    expect(errorsOf({ ...ARTICLE_BRIEF, difficulty: 'hard' })).toEqual(['brief.difficulty'])
    expect(errorsOf({ ...ARTICLE_BRIEF, topic: '   ' })).toEqual(['brief.topic'])
  })

  it('needs a real YYYY-MM-DD date for tax and accepts it anywhere', () => {
    const { validAsAt: _ignored, ...noDate } = TAX_GUIDE_BRIEF
    void _ignored
    expect(errorsOf(noDate)).toEqual(['brief.validAsAt'])
    expect(errorsOf({ ...TAX_GUIDE_BRIEF, validAsAt: '2026-02-30' })).toEqual(['brief.validAsAt'])
    expect(errorsOf({ ...ARTICLE_BRIEF, subject: 'taxation' })).toEqual(['brief.validAsAt'])
    expect(errorsOf({ ...ARTICLE_BRIEF, validAsAt: '2026-04-06' })).toEqual([])
  })

  it('takes a question count only for a question set, 10 to 25', () => {
    expect(errorsOf({ ...ARTICLE_BRIEF, questionCount: 12 })).toEqual(['brief.questionCount'])
    expect(errorsOf({ ...QUESTION_SET_BRIEF, questionCount: 9 })).toEqual(['brief.questionCount'])
    expect(errorsOf({ ...QUESTION_SET_BRIEF, questionCount: 26 })).toEqual(['brief.questionCount'])
    expect(errorsOf({ ...QUESTION_SET_BRIEF, questionCount: 12.5 })).toEqual(['brief.questionCount'])
    expect(errorsOf({ ...QUESTION_SET_BRIEF, questionCount: 25 })).toEqual([])
  })

  it('needs a source for a question set and a question for an explainer', () => {
    const { source: _s, ...noSource } = QUESTION_SET_BRIEF
    void _s
    expect(errorsOf(noSource)).toEqual(['brief.source'])
    const { question: _q, ...noQuestion } = EXPLAINER_BRIEF
    void _q
    expect(errorsOf(noQuestion)).toEqual(['brief.question'])
    expect(errorsOf({ ...ARTICLE_BRIEF, question: EXPLAINER_BRIEF.question })).toEqual(['brief.question'])
    expect(errorsOf({ ...EXPLAINER_BRIEF, question: { ...EXPLAINER_BRIEF.question, correctIndex: 4 } })).toEqual(['brief.question'])
    expect(errorsOf({ ...EXPLAINER_BRIEF, question: { ...EXPLAINER_BRIEF.question, options: ['a', 'b', 'c'] } })).toEqual(['brief.question'])
  })

  it('checks the ETICPA level and module against the open modules', () => {
    expect(errorsOf({ ...ARTICLE_BRIEF, eticpa: { level: 'level-2', module: 'financial-accounting' } })).toEqual([])
    expect(errorsOf({ ...ARTICLE_BRIEF, eticpa: { level: 'level-1', module: 'financial-accounting' } })).toEqual(['brief.eticpa'])
    expect(errorsOf({ ...ARTICLE_BRIEF, eticpa: { level: 'level-3', module: 'anything' } })).toEqual(['brief.eticpa'])
    expect(errorsOf({ ...ARTICLE_BRIEF, eticpa: { level: 'level-9', module: 'x' } })).toEqual(['brief.eticpa'])
  })

  it('checks the source and related notes shapes', () => {
    expect(errorsOf({ ...ARTICLE_BRIEF, source: { ...SOURCE, html: '' } })).toEqual(['brief.source'])
    expect(errorsOf({ ...ARTICLE_BRIEF, source: { ...SOURCE, extra: 1 } })).toEqual(['brief.source'])
    expect(errorsOf({ ...ARTICLE_BRIEF, relatedNotes: [{ title: 'T', slug: 's', path: 'study/x' }] })).toEqual(['brief.relatedNotes'])
    expect(errorsOf({ ...ARTICLE_BRIEF, avoidTitles: [1] })).toEqual(['brief.avoidTitles'])
  })

  it('keeps a guide to its preset subject', () => {
    expect(errorsOf({ ...TAX_GUIDE_BRIEF, subject: 'financial-accounting' })).toEqual(['brief.subject'])
  })

  it('writes plain-English messages', () => {
    const [finding] = validateBrief({ ...QUESTION_SET_BRIEF, questionCount: 3 }).findings
    expect(finding).toEqual({ check: 'brief.fields', severity: 'error', message: 'The question count must be a whole number from 10 to 25.', path: 'brief.questionCount' })
  })
})

describe('isIsoDate', () => {
  it('accepts real dates only', () => {
    expect(isIsoDate('2028-02-29')).toBe(true)
    expect(isIsoDate('2026-02-29')).toBe(false)
    expect(isIsoDate('2100-02-29')).toBe(false)
    expect(isIsoDate('2026-13-01')).toBe(false)
    expect(isIsoDate('26-04-06')).toBe(false)
    expect(isIsoDate(20260406)).toBe(false)
  })
})
