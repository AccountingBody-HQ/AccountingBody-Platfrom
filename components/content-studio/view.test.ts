import { describe, expect, it } from 'vitest'
import { WORDING } from '@/lib/content-studio/wording'
import {
  bodies,
  canCheck,
  canMake,
  canPublish,
  cardLines,
  choicesOf,
  clearOnChange,
  errorOf,
  foundLine,
  jsonPost,
  londonToday,
  planUrl,
  publishedOf,
  type CheckResult,
  type MakeState,
  type NoteInfo,
} from './view'

const NOTE: NoteInfo = {
  contentId: 'AB-ART-00042', title: 'Invented note', subjectTitle: 'Financial Accounting', moduleLabel: 'Accounting Body',
  defaultLevel: 'acca', needsValidAsAt: false, setTitle: null, setMessage: null,
}
const PAYLOAD = {
  bundle: { title: 't', slug: 's', excerpt: 'e', difficulty: 'intermediate', questionType: 'multiple-choice', topic: 't', tags: [], cases: [], questions: [] },
  articleSlug: 'AB-ART-00042',
  registry: { promptId: '0123456789abcdef', promptVersion: 'v', model: 'outside-ai', qualityScore: 100 },
}
const RESULT: CheckResult = {
  card: { ok: true, score: 100, problems: [], warnings: [], notChecked: ['a'] },
  preview: [],
  publish: PAYLOAD,
  publishProblem: null,
}

function state(over: Partial<MakeState> = {}): MakeState {
  return { note: NOTE, busy: false, answer: 'x', result: RESULT, checked: { door: 'copy', answer: 'x' }, ...over }
}

describe('state rules', () => {
  it('opens the make steps only for a found note without a set', () => {
    expect(canMake(NOTE)).toBe(true)
    expect(canMake(null)).toBe(false)
    expect(canMake({ ...NOTE, setTitle: 'S', setMessage: 'Has a set' })).toBe(false)
  })

  it('checks only when open and not busy', () => {
    expect(canCheck(state())).toBe(true)
    expect(canCheck(state({ busy: true }))).toBe(false)
    expect(canCheck(state({ note: null }))).toBe(false)
  })

  it('publishes only the last ready check, while its answer is unchanged', () => {
    expect(canPublish(state())).toBe(true)
    expect(canPublish(state({ answer: 'x changed' }))).toBe(false)
    expect(canPublish(state({ busy: true }))).toBe(false)
    expect(canPublish(state({ result: { ...RESULT, publish: null } }))).toBe(false)
    expect(canPublish(state({ result: null }))).toBe(false)
    expect(canPublish(state({ checked: null }))).toBe(false)
    expect(canPublish(state({ checked: { door: 'generate', parts: ['a'] }, answer: '' }))).toBe(true)
    expect(canPublish(state({ note: { ...NOTE, setMessage: 'Has a set' } }))).toBe(false)
  })

  it('clears the prompt, the answers, the result, the notes and the publish payload on any change', () => {
    expect(clearOnChange()).toEqual({
      prompt: null, answer: '', result: null, checked: null, reviewNotes: null, reviewPaste: '', message: null, published: null,
    })
  })
})

describe('display', () => {
  it('writes the found line', () => {
    expect(foundLine(NOTE)).toBe('Found: Invented note · Financial Accounting · Accounting Body')
  })

  it('splits a scorecard for display', () => {
    expect(cardLines({ ok: false, score: 80, problems: [{ message: 'P1', path: 'x' }, { message: 'P2' }], warnings: [{ message: 'W' }], notChecked: ['N'] })).toEqual({
      score: 'Quality score: 80/100',
      verdict: WORDING.notReady,
      problemsTitle: 'Problems (2)',
      problems: ['P1', 'P2'],
      warningsTitle: 'Warnings (1)',
      warnings: ['W'],
      notChecked: ['N'],
    })
    expect(cardLines(RESULT.card).verdict).toBe(WORDING.ready)
  })

  it('gives today in London as YYYY-MM-DD', () => {
    expect(londonToday(new Date('2026-06-30T23:30:00Z'))).toBe('2026-07-01')
    expect(londonToday(new Date('2026-12-31T23:30:00Z'))).toBe('2026-12-31')
    expect(londonToday(new Date('2026-03-29T00:30:00Z'))).toBe('2026-03-29')
  })

  it('builds the plan addresses', () => {
    expect(planUrl('/api/x/content-studio')).toBe('/api/x/content-studio/plan')
    expect(planUrl('/api/x/content-studio', 2, 20)).toBe('/api/x/content-studio/plan?group=2&offset=20')
  })
})

describe('request bodies', () => {
  it('sends the date only for a tax note', () => {
    expect(choicesOf(NOTE, 'aat', 20, '2026-04-06')).toEqual({ noteId: 'AB-ART-00042', level: 'aat', questionCount: 20 })
    expect(choicesOf({ ...NOTE, needsValidAsAt: true }, 'aat', 10, '2026-04-06')).toEqual({ noteId: 'AB-ART-00042', level: 'aat', questionCount: 10, validAsAt: '2026-04-06' })
  })

  it('has the exact shapes the server reads', () => {
    const c = choicesOf(NOTE, 'aat', 20, '')
    expect(bodies.find('AB-ART-1')).toEqual({ mode: 'find', noteId: 'AB-ART-1' })
    expect(bodies.prompt(c)).toEqual({ mode: 'questions', ...c })
    expect(bodies.checkCopy(c, 'a')).toEqual({ mode: 'questions', ...c, door: 'copy', answer: 'a' })
    expect(bodies.checkGenerate(c, ['a', 'b'])).toEqual({ mode: 'questions', ...c, door: 'generate', parts: ['a', 'b'] })
    expect(bodies.generateStep(c, 1, ['a'])).toEqual({ kind: 'questions', ...c, step: 1, earlier: ['a'] })
    expect(bodies.reviewPrompt(c, { door: 'copy', answer: 'a' })).toEqual({ mode: 'review', ...c, answer: 'a' })
    expect(bodies.reviewGenerate(c, { door: 'generate', parts: ['a', 'b'] })).toEqual({ kind: 'review', ...c, parts: ['a', 'b'] })
    expect(bodies.reviewCheck('r')).toEqual({ mode: 'review', reviewAnswer: 'r' })
    expect(bodies.publish(PAYLOAD)).toEqual({ bundle: PAYLOAD.bundle, articleSlug: 'AB-ART-00042', registry: PAYLOAD.registry })
    expect(Object.keys(bodies.publish(PAYLOAD))).toEqual(['bundle', 'articleSlug', 'registry'])
  })

  it('posts JSON', () => {
    expect(jsonPost({ a: 1 })).toEqual({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"a":1}' })
  })
})

describe('reading answers', () => {
  it('reads the publish route answer', () => {
    expect(publishedOf({ success: true, contentId: 'AB-QZ-00183', questionCount: 20 })).toEqual({ contentId: 'AB-QZ-00183', questionCount: 20, linkWarning: null })
    expect(publishedOf({ contentId: 'AB-QZ-1', questionCount: 10, linkWarning: 'W' })?.linkWarning).toBe('W')
    expect(publishedOf({ error: 'x' })).toBeNull()
    expect(publishedOf(null)).toBeNull()
  })

  it('takes the server error text or the fallback', () => {
    expect(errorOf({ error: 'E' }, 'F')).toBe('E')
    expect(errorOf({ error: '' }, 'F')).toBe('F')
    expect(errorOf('x', 'F')).toBe('F')
  })
})
