import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vitest'
import { normalise, validateNormalisedBundle } from '@/lib/question-normaliser'
import { compilePrompt } from './compiler'
import { FIXTURE_BRIEFS, QUESTION_SET_BRIEF } from './fixtures/briefs'
import { ARTICLE, EXPLAINER, INVALID_FIXTURES, QUESTIONS, TAX, mustCompile } from './fixtures/invalid'
import { documentOutput, explainerOutput, prose, questionSetOutput } from './fixtures/outputs'
import { NOT_CHECKED_ANSWERS, NOT_CHECKED_EXPLANATION_PARTS, NOT_CHECKED_FACTS, runGate } from './gate'
import { LETTER_REFERENCE_PATTERNS } from './packs/assessment'
import { CHECK_ORDER, type CompiledPrompt, type EngineOutput } from './types'

function validFor(compiled: CompiledPrompt): EngineOutput {
  if (compiled.blueprintId === 'practice-question-set') return questionSetOutput(compiled)
  if (compiled.blueprintId === 'question-explainer') return explainerOutput(compiled)
  return documentOutput(compiled)
}

describe('valid fixtures', () => {
  for (const [label, brief] of FIXTURE_BRIEFS) {
    it(`${label}: scores 100 with no findings`, () => {
      const compiled = mustCompile(brief)
      const output = validFor(compiled)
      const card = runGate(output, compiled)
      expect(card.findings).toEqual([])
      expect(card.score).toBe(100)
      expect(card.ok).toBe(true)
      expect(card.output).toEqual(output)
      expect(card.notChecked).toContain(NOT_CHECKED_FACTS)
    })

    it(`${label}: the pasted JSON text scores the same as the object`, () => {
      const compiled = mustCompile(brief)
      const output = validFor(compiled)
      const fromText = runGate(JSON.stringify(output, null, 2), compiled)
      expect(fromText.findings).toEqual([])
      expect(fromText.score).toBe(100)
      expect(fromText.output).toEqual(output)
    })
  }

  it('never rewrites: the object handed in is returned unchanged and not mutated', () => {
    const output = documentOutput(ARTICLE)
    const before = JSON.stringify(output)
    const card = runGate(output, ARTICLE)
    expect(card.output).toBe(output)
    expect(JSON.stringify(output)).toBe(before)
  })

  it('reports stats', () => {
    const doc = runGate(documentOutput(ARTICLE), ARTICLE)
    expect(doc.stats.sections).toBe(8)
    expect(doc.stats.words).toBeGreaterThanOrEqual(1200)
    expect(doc.stats.words).toBeLessThanOrEqual(1800)
    expect(doc.stats.blocks).toBeGreaterThan(8)
    expect(doc.stats.questions).toBe(0)
    const set = runGate(questionSetOutput(QUESTIONS), QUESTIONS)
    expect(set.stats.questions).toBe(10)
    expect(set.stats.sections).toBe(0)
  })

  it('lists what is not checked', () => {
    expect(runGate(documentOutput(ARTICLE), ARTICLE).notChecked).toEqual([NOT_CHECKED_FACTS])
    expect(runGate(questionSetOutput(QUESTIONS), QUESTIONS).notChecked).toEqual([NOT_CHECKED_FACTS, NOT_CHECKED_ANSWERS, NOT_CHECKED_EXPLANATION_PARTS])
    expect(NOT_CHECKED_FACTS).toBe('Facts and figures are not checked (owner decision D335); please review them.')
    expect(NOT_CHECKED_ANSWERS).toBe('Whether each correct answer is right is not checked; please review it.')
  })
})

describe('one invalid fixture per check', () => {
  const gateChecks = CHECK_ORDER.filter(c => c !== 'brief.fields')

  it('there is a fixture for every gate check id', () => {
    expect(INVALID_FIXTURES.map(f => f.check).sort()).toEqual([...gateChecks].sort())
  })

  for (const fixture of INVALID_FIXTURES) {
    it(`${fixture.check}: triggers exactly that check`, () => {
      const card = runGate(fixture.raw, fixture.compiled)
      const checks = Array.from(new Set(card.findings.map(f => f.check)))
      expect(checks).toEqual([fixture.check])
      expect(card.findings.every(f => f.severity === fixture.severity)).toBe(true)
      for (const f of card.findings) {
        expect(f.message.length).toBeGreaterThan(10)
        expect(f.message).toMatch(/[.]$/)
      }
      if (fixture.severity === 'error') {
        expect(card.ok).toBe(false)
        expect(card.score).toBeLessThanOrEqual(80)
      } else if (fixture.severity === 'warning') {
        expect(card.ok).toBe(true)
        expect(card.score).toBe(100 - 5 * card.findings.length)
      } else {
        expect(card.score).toBe(100)
      }
    })
  }

  it('brief.fields is reported by the compiler, before the gate', () => {
    const result = compilePrompt({ ...QUESTION_SET_BRIEF, questionCount: 99 })
    expect('findings' in result && result.findings.map(f => f.check)).toEqual(['brief.fields'])
  })

  it('names the place in plain English', () => {
    const fixture = INVALID_FIXTURES.find(f => f.check === 'q.options')!
    const [finding] = runGate(fixture.raw, fixture.compiled).findings
    expect(finding.message).toBe('Question 1: two options are the same.')
    const names = INVALID_FIXTURES.find(f => f.check === 'body.names')!
    expect(runGate(names.raw, names.compiled).findings[0].message).toBe('Section 1, block 1: names "ACCA"; write for the level instead of naming a body.')
    const prompt = INVALID_FIXTURES.find(f => f.check === 'envelope.prompt')!
    expect(runGate(prompt.raw, prompt.compiled).findings[0].message).toBe('This answer was made from a different prompt.')
  })

  it('keeps the shape-passing answer as output, and none when the shape fails', () => {
    const names = INVALID_FIXTURES.find(f => f.check === 'body.names')!
    expect(runGate(names.raw, names.compiled).output).toEqual(names.raw)
    const shape = INVALID_FIXTURES.find(f => f.check === 'blocks.shape')!
    expect(runGate(shape.raw, shape.compiled).output).toBeNull()
  })
})

describe('more gate rules', () => {
  it('scores 100 - 20 per error - 5 per warning, never below 0', () => {
    const output = questionSetOutput(QUESTIONS)
    output.questionSet.questions.forEach(q => { q.caseId = 'x' as unknown as null })
    const card = runGate(output, QUESTIONS)
    expect(card.findings.filter(f => f.severity === 'error')).toHaveLength(10)
    expect(card.score).toBe(0)
  })

  it('orders findings by check, then by place (question 2 before question 10)', () => {
    const output = questionSetOutput(QUESTIONS)
    output.questionSet.questions[9].sourceSection = 's9'
    output.questionSet.questions[1].sourceSection = 's9'
    output.questionSet.questions[4].caseId = 'x' as unknown as null
    const card = runGate(output, QUESTIONS)
    expect(card.findings.map(f => `${f.check}@${f.path}`)).toEqual([
      'q.shape@questionSet.questions[4].caseId',
      'q.source@questionSet.questions[1].sourceSection',
      'q.source@questionSet.questions[9].sourceSection',
    ])
  })

  it('warns on nearly identical question texts', () => {
    const output = questionSetOutput(QUESTIONS)
    output.questionSet.questions[1].questionText = output.questionSet.questions[0].questionText.replace('Which entry', 'Which one entry')
    const card = runGate(output, QUESTIONS)
    expect(card.findings.map(f => `${f.check}:${f.severity}`)).toEqual(['q.dupStem:warning'])
  })

  it('warns on a short summary, too few key terms and a web link', () => {
    const output = documentOutput(ARTICLE)
    output.summary = 'Too short.'
    output.keyTerms = ['one']
    const card = runGate(output, ARTICLE)
    expect(card.findings.map(f => `${f.check}:${f.severity}`)).toEqual(['envelope.fields:warning', 'envelope.fields:warning'])
    const linked = documentOutput(ARTICLE)
    const p = linked.document.sections[0].blocks.find(b => b.type === 'paragraph')
    if (p && p.type === 'paragraph') p.text += ' Read https://example.org today.'
    expect(runGate(linked, ARTICLE).findings.map(f => `${f.check}:${f.severity}`)).toEqual(['links.internal:warning'])
  })

  it('accepts links to the related notes and requires the related-notes section when they are given', () => {
    const overview = mustCompile(FIXTURE_BRIEFS.find(([l]) => l === 'subject-overview')![1])
    const ok = documentOutput(overview)
    expect(runGate(ok, overview).findings).toEqual([])
    const missing = documentOutput(overview)
    missing.document.sections = missing.document.sections.filter(s => s.id !== 'related-notes')
    expect(runGate(missing, overview).findings.map(f => f.check)).toEqual(['structure.sections'])
  })

  it('reports sections out of order, unknown and duplicated', () => {
    const output = documentOutput(ARTICLE)
    const [a, b, ...rest] = output.document.sections
    output.document.sections = [b, a, ...rest, { id: 'extra', blocks: [] }, { ...rest[0] }]
    const messages = runGate(output, ARTICLE).findings.filter(f => f.check === 'structure.sections').map(f => f.message)
    expect(messages).toEqual([
      'The sections are not in the required order.',
      'Section 9: "extra" is not a section of this content type.',
      'Section 10: the section "key-principles" appears twice.',
    ])
  })

  it('needs validAsAt equal to the brief, and null when the brief has none', () => {
    const wrong = documentOutput(TAX)
    wrong.validAsAt = '2025-04-06'
    expect(runGate(wrong, TAX).findings.map(f => f.check)).toEqual(['tax.validAsAt'])
    const bad = documentOutput(TAX)
    bad.validAsAt = '6 April 2026'
    expect(runGate(bad, TAX).findings.map(f => f.message)).toEqual(['validAsAt must be a real date written YYYY-MM-DD.'])
    const extra = documentOutput(ARTICLE)
    extra.validAsAt = '2026-04-06'
    expect(runGate(extra, ARTICLE).findings.map(f => f.message)).toEqual(['validAsAt must be null: the brief gives no date.'])
  })

  it('an explainer outside 400 to 900 words but within the margin is a warning', () => {
    expect(runGate(explainerOutput(EXPLAINER, 380), EXPLAINER).findings.map(f => `${f.check}:${f.severity}`)).toEqual(['words.total:warning'])
    expect(runGate(explainerOutput(EXPLAINER, 1200), EXPLAINER).findings.map(f => `${f.check}:${f.severity}`)).toEqual(['words.total:error'])
  })
})

describe('never throws on junk', () => {
  const cyclic: Record<string, unknown> = { engine: 'ab-content-engine' }
  cyclic.self = cyclic
  cyclic.document = cyclic
  const cyclicBlocks: Record<string, unknown> = { type: 'paragraph' }
  cyclicBlocks.text = cyclicBlocks
  let deep: unknown = 'end'
  for (let i = 0; i < 20000; i++) deep = [deep]
  let deepObject: unknown = {}
  for (let i = 0; i < 5000; i++) deepObject = { document: deepObject }
  const valid = documentOutput(ARTICLE)
  const JUNK: unknown[] = [
    null, undefined, 0, -1, NaN, Infinity, true, false, '', ' ', '{}', '[]', 'null', '"text"', '{"engine":', '}{', '{{{{', ']]]]',
    'x'.repeat(2 * 1024 * 1024),
    '{'.repeat(200000),
    '{"a":' + '['.repeat(50000) + ']'.repeat(50000) + '}',
    '```json\n```',
    [], [1, 2, 3], [valid], {}, { engine: 1 }, cyclic,
    { ...valid, document: cyclicBlocks },
    { ...valid, document: { sections: [{ id: 'introduction', blocks: [cyclicBlocks] }] } },
    { ...valid, document: { sections: 'many' } },
    { ...valid, document: { sections: [null, 1, 'x', []] } },
    { ...valid, keyTerms: cyclic, sourceSectionsCovered: cyclic },
    deep, deepObject,
    new Date(0), /regex/, () => 1, Symbol('s'),
    Object.create(null),
  ]

  it('feeds 40 kinds of junk to every blueprint and always gets a scorecard', () => {
    expect(JUNK).toHaveLength(40)
    for (const compiled of [ARTICLE, QUESTIONS, EXPLAINER, TAX]) {
      for (const junk of JUNK) {
        let card
        expect(() => { card = runGate(junk, compiled) }).not.toThrow()
        expect(card).toBeDefined()
        expect(typeof card!.score).toBe('number')
        expect(Array.isArray(card!.findings)).toBe(true)
      }
    }
  })

  it('never throws even when the compiled prompt itself is junk', () => {
    expect(() => runGate('{}', {} as CompiledPrompt)).not.toThrow()
    expect(runGate('{}', {} as CompiledPrompt).ok).toBe(false)
  })
})

describe('speed', () => {
  it('checks a 25-question set in under 50 ms', () => {
    const compiled = mustCompile({ ...QUESTION_SET_BRIEF, questionCount: 25 })
    const output = questionSetOutput(compiled)
    const text = JSON.stringify(output)
    runGate(text, compiled)
    const started = performance.now()
    const card = runGate(text, compiled)
    const elapsed = performance.now() - started
    expect(card.findings).toEqual([])
    expect(elapsed).toBeLessThan(50)
  })
})

describe('compatibility with the site question normaliser', () => {
  it('normalise accepts a valid fixture set with no warnings, and the publish check finds nothing', () => {
    const output = questionSetOutput(QUESTIONS)
    const result = normalise(output.questionSet)
    expect(result.warnings).toEqual([])
    expect(result.bundle.questions).toHaveLength(10)
    result.bundle.questions.forEach((q, i) => {
      const source = output.questionSet.questions[i]
      expect(q.questionText).toBe(source.questionText)
      expect(q.options).toEqual(source.options)
      expect(q.correctIndex).toBe(source.correctIndex)
      expect(q.explanation).toBe(source.explanation)
      expect(q.type).toBe('multiple-choice')
    })
    expect(validateNormalisedBundle(result.bundle)).toEqual([])
  })
})

describe('letter-reference pattern parity', () => {
  const MATCHING: [string, number][] = [
    ['Option B is wrong because it reverses the entry.', 1],
    ['The answer (c) uses the wrong period.', 2],
    ['Choice d) ignores the reversal.', 3],
    ['The first option forgets the accrual.', 4],
    ['Options a and b both treat the cost as a prepayment.', 5],
    ['The last answer records nothing at all.', 4],
  ]
  const CLEAN = [
    'The correct answer is the depreciation charge of £4,000.',
    'Recording the cost as a prepayment reverses the direction of the entry.',
    'The option to defer the payment does not change the period of the cost.',
    'A business that waits for the invoice understates its liabilities.',
    'The answer depends on when the service was used, not when it was paid.',
    'Choosing between the two treatments needs the dates in the scenario.',
  ]

  it('flags each sample with the expected pattern', () => {
    for (const [text, pattern] of MATCHING) {
      expect(LETTER_REFERENCE_PATTERNS[pattern - 1].test(text), text).toBe(true)
    }
  })

  it('does not flag the clean samples', () => {
    for (const text of CLEAN) {
      expect(LETTER_REFERENCE_PATTERNS.some(p => p.test(text)), text).toBe(false)
    }
  })

  it('the gate reports a letter reference in an explanation with its pattern number', () => {
    const output = questionSetOutput(QUESTIONS)
    output.questionSet.questions[2].explanation = output.questionSet.questions[2].explanation.replace('Remember:', 'The first option forgets the accrual. Remember:')
    const [finding] = runGate(output, QUESTIONS).findings
    expect(finding.message).toBe('Question 3: the explanation refers to an option by its letter or position (pattern P4).')
  })

  it('the fixture prose itself never matches a pattern', () => {
    expect(LETTER_REFERENCE_PATTERNS.some(p => p.test(prose(400)))).toBe(false)
  })
})
