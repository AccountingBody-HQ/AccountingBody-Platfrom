import { describe, expect, it } from 'vitest'
import { compilePrompt, isCompiled, validateBrief } from '@/lib/content-engine'
import { briefFor, defaultLevelOf, eticpaOf, needsValidAsAt, parseChoices, subjectOf, topicOf } from './brief'
import { ETICPA_ROW, NOTE_ROW, TAX_ROW, noteOf } from './fixtures/notes'
import { WORDING } from './wording'

const NOTE = noteOf(NOTE_ROW)

describe('defaults from the note', () => {
  it('picks the level from the ETICPA level', () => {
    expect(defaultLevelOf({ eticpaLevel: 'level-1' })).toBe('eticpa-atq')
    expect(defaultLevelOf({ eticpaLevel: 'level-2' })).toBe('eticpa-atq')
    expect(defaultLevelOf({ eticpaLevel: 'level-3' })).toBe('eticpa-cpa')
    expect(defaultLevelOf({ eticpaLevel: null })).toBe('acca')
  })

  it('takes the subject from the category, else from its title', () => {
    expect(subjectOf({ category: 'taxation', categoryTitle: 'Whatever' })).toBe('taxation')
    expect(subjectOf({ category: 'not-a-key', categoryTitle: 'Audit and Assurance' })).toBe('audit-assurance')
    expect(subjectOf({ category: 'not-a-key', categoryTitle: '' })).toBe('general')
    expect(needsValidAsAt(noteOf(TAX_ROW))).toBe(true)
    expect(needsValidAsAt(NOTE)).toBe(false)
  })

  it('cuts a long title at the last space before 300 characters', () => {
    const long = 'word '.repeat(100).trim()
    const topic = topicOf(long)
    expect(topic.length).toBeLessThanOrEqual(300)
    expect(long.startsWith(topic)).toBe(true)
    expect(topic.endsWith('word')).toBe(true)
    expect(topicOf('  Short  ')).toBe('Short')
  })

  it('keeps an ETICPA pair only when it is an open module of the engine', () => {
    expect(eticpaOf({ eticpaLevel: 'level-1', eticpaModule: 'introduction-to-accounting' })).toEqual({ level: 'level-1', module: 'introduction-to-accounting' })
    expect(eticpaOf({ eticpaLevel: 'level-1', eticpaModule: 'business-skills' })).toBeNull()
    expect(eticpaOf({ eticpaLevel: 'level-1', eticpaModule: null })).toBeNull()
  })
})

describe('briefFor', () => {
  it('builds a valid practice-set brief from the whole note', () => {
    const made = briefFor(NOTE, { level: 'aat', questionCount: 20 })
    if (!made.ok) throw new Error(made.message)
    expect(made.brief).toEqual({
      contentType: 'practice-question-set',
      topic: NOTE.title,
      level: 'aat',
      subject: 'financial-accounting',
      jurisdiction: 'uk-ifrs',
      source: { contentId: NOTE.contentId, title: NOTE.title, slug: NOTE.slug, html: NOTE.html },
      questionCount: 20,
    })
    expect(validateBrief(made.brief).findings).toEqual([])
    expect(isCompiled(compilePrompt(made.brief))).toBe(true)
  })

  it('ignores a date for a note that is not about tax', () => {
    const made = briefFor(NOTE, { level: 'aat', questionCount: 10, validAsAt: '2026-04-06' })
    expect(made.ok && made.brief.validAsAt).toBe(undefined)
  })

  it('needs a real date for a tax note', () => {
    const tax = noteOf(TAX_ROW)
    expect(briefFor(tax, { level: 'aat', questionCount: 10 })).toEqual({ ok: false, message: WORDING.validAsAtNeeded })
    expect(briefFor(tax, { level: 'aat', questionCount: 10, validAsAt: '2026-02-30' })).toEqual({ ok: false, message: WORDING.validAsAtNeeded })
    const made = briefFor(tax, { level: 'aat', questionCount: 10, validAsAt: '2026-04-06' })
    expect(made.ok && made.brief.validAsAt).toBe('2026-04-06')
    expect(made.ok && made.brief.subject).toBe('taxation')
  })

  it('writes an ETICPA note for Ethiopia with its open module', () => {
    const made = briefFor(noteOf(ETICPA_ROW), { level: 'eticpa-atq', questionCount: 10 })
    if (!made.ok) throw new Error(made.message)
    expect(made.brief.jurisdiction).toBe('ethiopia')
    expect(made.brief.eticpa).toEqual({ level: 'level-1', module: 'introduction-to-accounting' })
  })

  it('leaves out an ETICPA module the engine does not have, still for Ethiopia', () => {
    const made = briefFor({ ...noteOf(ETICPA_ROW), eticpaModule: 'business-skills' }, { level: 'eticpa-atq', questionCount: 10 })
    if (!made.ok) throw new Error(made.message)
    expect(made.brief.jurisdiction).toBe('ethiopia')
    expect('eticpa' in made.brief).toBe(false)
  })

  it('says something went wrong when the engine refuses the brief', () => {
    expect(briefFor({ ...NOTE, html: '   ' }, { level: 'aat', questionCount: 10 })).toEqual({ ok: false, message: WORDING.somethingWrong })
  })
})

describe('parseChoices', () => {
  it('reads the level, the count (10 or 20) and the optional date', () => {
    expect(parseChoices({ level: 'cima', questionCount: 10 })).toEqual({ level: 'cima', questionCount: 10 })
    expect(parseChoices({ level: 'cima', questionCount: 20, validAsAt: '2026-04-06' })).toEqual({ level: 'cima', questionCount: 20, validAsAt: '2026-04-06' })
  })

  it('refuses anything else', () => {
    for (const body of [null, 'x', [], {}, { level: 'x', questionCount: 10 }, { level: 'cima', questionCount: 15 }, { level: 'cima', questionCount: '10' }, { level: 'cima', questionCount: 10, validAsAt: 5 }]) {
      expect(parseChoices(body)).toBeNull()
    }
  })
})
