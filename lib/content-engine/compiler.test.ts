import { describe, expect, it } from 'vitest'
import { compilePrompt, compileReviewerPrompt, isCompiled, promptVersionFor } from './compiler'
import { BLUEPRINTS } from './blueprints/index'
import {
  ARTICLE_BRIEF,
  EXPLAINER_BRIEF,
  FIXTURE_BRIEFS,
  QUESTION_SET_BRIEF,
  SOURCE,
  SUBJECT_OVERVIEW_BRIEF,
  TAX_GUIDE_BRIEF,
} from './fixtures/briefs'
import { BODY_NAME_RULE, findBodyNames } from './packs/body-names'
import { LEVEL_PACKS } from './packs/levels'
import { PACKS_FINGERPRINT } from './packs/index'
import { OPTION_REFERENCES } from './packs/assessment'
import type { Brief, CompiledPrompt } from './types'

function compiled(brief: unknown): CompiledPrompt {
  const result = compilePrompt(brief)
  if (!isCompiled(result)) throw new Error(result.findings.map(f => f.message).join(' '))
  return result
}

const HEADINGS = ['ROLE', 'TASK', 'SOURCE NOTE', 'RELATED NOTES', 'AVOID', 'STRUCTURE', 'BLOCKS', 'RULES', 'SELF-CHECK', 'OUTPUT']

describe('compilePrompt', () => {
  it('compiles every fixture brief with the ten headings in the fixed order', () => {
    for (const [, brief] of FIXTURE_BRIEFS) {
      const c = compiled(brief)
      const positions = HEADINGS.map(h => c.text.indexOf(`\n\n${h}\n`) >= 0 ? c.text.indexOf(`\n\n${h}\n`) : c.text.indexOf(`${h}\n`))
      for (let i = 1; i < positions.length; i++) expect(positions[i], HEADINGS[i]).toBeGreaterThan(positions[i - 1])
      expect(c.text.startsWith('ROLE\n')).toBe(true)
    }
  })

  it('gives a 16-hex prompt id and a versioned prompt version', () => {
    const c = compiled(ARTICLE_BRIEF)
    expect(c.promptId).toMatch(/^[0-9a-f]{16}$/)
    expect(c.promptVersion).toBe(`article@1.0.0/engine@1.0.0/packs@${PACKS_FINGERPRINT}`)
    expect(c.promptVersion).toBe(promptVersionFor(BLUEPRINTS.article))
    expect(c.blueprintId).toBe('article')
    expect(c.preset).toBeUndefined()
    expect(compiled(TAX_GUIDE_BRIEF).preset).toBe('tax-guide')
  })

  it('is deterministic: the same brief gives the same id and byte-identical text', () => {
    const one = compiled(ARTICLE_BRIEF)
    const two = compiled(JSON.parse(JSON.stringify(ARTICLE_BRIEF)))
    expect(two.promptId).toBe(one.promptId)
    expect(two.text).toBe(one.text)
    const reordered = Object.fromEntries(Object.entries(ARTICLE_BRIEF).reverse())
    expect(compiled(reordered).promptId).toBe(one.promptId)
  })

  it('any change to the brief changes the id', () => {
    const base = compiled(ARTICLE_BRIEF).promptId
    const changes: Partial<Brief>[] = [
      { topic: ARTICLE_BRIEF.topic + '!' },
      { difficulty: 'advanced' },
      { level: 'icaew' },
      { avoidTitles: [] },
      { source: { ...SOURCE, html: SOURCE.html + '<p>One more word.</p>' } },
    ]
    for (const change of changes) expect(compiled({ ...ARTICLE_BRIEF, ...change }).promptId).not.toBe(base)
  })

  it('puts the id and version in the text, in the output template', () => {
    for (const [, brief] of FIXTURE_BRIEFS) {
      const c = compiled(brief)
      expect(c.text).toContain(`"promptId": "${c.promptId}",`)
      expect(c.text).toContain(`"promptVersion": "${c.promptVersion}",`)
      expect(c.text).toContain('"engine": "ab-content-engine",')
      expect(c.text).toContain(`"blueprint": "${c.blueprintId}",`)
      expect(c.text).toContain(`"contentType": "${brief.contentType}",`)
      expect(c.text).toContain('Return ONLY the JSON object. No markdown fences, no text before or after it. promptId and promptVersion must be returned exactly as given.')
    }
  })

  it('the output template carries the payload for each blueprint', () => {
    const article = compiled(ARTICLE_BRIEF)
    for (const id of article.expected.sectionIds) expect(article.text).toContain(`{ "id": "${id}", "blocks": [ <blocks> ] }`)
    expect(article.text).toContain('"document": {')

    const set = compiled(QUESTION_SET_BRIEF)
    expect(set.expected.questionCount).toBe(10)
    expect(set.text).toContain('"questionSet": {')
    expect(set.text).toContain('10 questions in all, q1 to q10')
    expect(set.text).toContain(OPTION_REFERENCES)
    expect(set.text).toContain('"writingModelAnswer": null,')

    const explainer = compiled(EXPLAINER_BRIEF)
    expect(explainer.text).toContain('"explainer": {')
    expect(explainer.text).toContain(EXPLAINER_BRIEF.question!.questionText)
    expect(explainer.expected.sectionIds).toEqual([])

    const { questionCount: _n, ...defaultCount } = QUESTION_SET_BRIEF
    void _n
    expect(compiled(defaultCount).expected.questionCount).toBe(20)
  })

  it('keeps the whole source note: every section, every word, nothing cut', () => {
    const c = compiled(ARTICLE_BRIEF)
    expect(c.source).not.toBeNull()
    for (const s of c.source!.sections) {
      expect(c.text).toContain(`[${s.id}] ${s.heading}\n${s.text}`)
    }
    const words: string[] = []
    for (let i = 0; i < 5000; i++) words.push(`term${i}`)
    const long = compiled({ ...ARTICLE_BRIEF, source: { ...SOURCE, html: `<h2>Long</h2><p>${words.join(' ')}</p>` } })
    expect(long.text).toContain(words.join(' '))
    const { source: _s, ...noSource } = ARTICLE_BRIEF
    void _s
    expect(compiled(noSource).text).toContain('No source note: write from the topic.')
    expect(compiled(noSource).source).toBeNull()
  })

  it('lists related notes as the only internal links, and the titles to avoid', () => {
    const c = compiled(SUBJECT_OVERVIEW_BRIEF)
    expect(c.text).toContain('- Invented note one: /study/invented-note-one')
    expect(c.text).toContain('[related-notes] Related notes (required: the brief lists related notes)')
    expect(c.text).toContain('{ "id": "related-notes", "blocks": [ <blocks> ] }')
    expect(compiled(ARTICLE_BRIEF).text).toContain('- Accruals explained simply')
    expect(compiled(ARTICLE_BRIEF).text).toContain('None: do not write any internal path.')
  })

  it('states the validAsAt rule from the brief', () => {
    expect(compiled(TAX_GUIDE_BRIEF).text).toContain('"validAsAt" must be "2026-04-06"')
    expect(compiled(TAX_GUIDE_BRIEF).text).toContain('"validAsAt": "2026-04-06",')
    expect(compiled(ARTICLE_BRIEF).text).toContain('"validAsAt" must be null.')
  })

  it('names no professional body outside the internal level calibration and the body-name rule', () => {
    for (const [, brief] of FIXTURE_BRIEFS) {
      const c = compiled(brief)
      const pack = LEVEL_PACKS[brief.level]
      const outside = c.text.split(pack.depth).join('').split(pack.questionCalibration).join('').split(BODY_NAME_RULE).join('')
      expect(findBodyNames(outside), brief.contentType).toEqual([])
      expect(c.text).toContain(BODY_NAME_RULE)
    }
  })

  it('refuses an invalid brief with its findings and never throws', () => {
    const result = compilePrompt({ ...ARTICLE_BRIEF, level: 'nope' })
    expect(isCompiled(result)).toBe(false)
    expect('findings' in result && result.findings[0].check).toBe('brief.fields')
    for (const junk of [null, undefined, 1, 'x', [], {}, { contentType: 'article' }]) {
      expect(() => compilePrompt(junk)).not.toThrow()
      expect(isCompiled(compilePrompt(junk))).toBe(false)
    }
  })
})

describe('compileReviewerPrompt', () => {
  it('sends the reviewer rules, the source and the answer, and asks for findings only', () => {
    const answer = '{"engine":"ab-content-engine"}'
    const result = compileReviewerPrompt(ARTICLE_BRIEF, answer)
    if (!isCompiled(result)) throw new Error('not compiled')
    expect(result.text.startsWith('ROLE\nYOU ARE THE CONTENT REVIEWER FOR ACCOUNTINGBODY.')).toBe(true)
    expect(result.text).toContain(`CONTENT TO REVIEW\n${answer}`)
    expect(result.text).toContain('[s1] Why accruals matter')
    expect(result.text).toContain('Return ONLY the findings JSON object')
    expect(result.promptVersion).toBe(`reviewer@1.0.0/${promptVersionFor(BLUEPRINTS.article)}`)
  })

  it('is deterministic and its id depends on the answer', () => {
    const a = compileReviewerPrompt(ARTICLE_BRIEF, '{"a":1}')
    const b = compileReviewerPrompt(ARTICLE_BRIEF, '{"a":1}')
    const c = compileReviewerPrompt(ARTICLE_BRIEF, '{"a":2}')
    if (!isCompiled(a) || !isCompiled(b) || !isCompiled(c)) throw new Error('not compiled')
    expect(a.promptId).toBe(b.promptId)
    expect(a.text).toBe(b.text)
    expect(c.promptId).not.toBe(a.promptId)
    expect(a.promptId).not.toBe(compiled(ARTICLE_BRIEF).promptId)
  })

  it('refuses an invalid brief', () => {
    expect(isCompiled(compileReviewerPrompt({}, '{}'))).toBe(false)
  })
})
