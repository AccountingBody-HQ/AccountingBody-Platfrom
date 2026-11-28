import { describe, expect, it } from 'vitest'
import { compilePrompt, isCompiled, runGate, type CompiledPrompt } from '@/lib/content-engine'
import { questionSetOutput } from '@/lib/content-engine/fixtures/outputs'
import { parseRegistry } from '@/lib/question-registry'
import { briefFor } from './brief'
import { NOTE_ROW, noteOf } from './fixtures/notes'
import { publishPayloadOf, setTitleOf } from './publish'
import { WORDING } from './wording'

const NOTE = noteOf(NOTE_ROW)

function compiled(): CompiledPrompt {
  const made = briefFor(NOTE, { level: 'aat', questionCount: 10 })
  if (!made.ok) throw new Error(made.message)
  const c = compilePrompt(made.brief)
  if (!isCompiled(c)) throw new Error('not compiled')
  return c
}

// The publish route's own address rule, copied into this test only.
function routeSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 200).replace(/^-+|-+$/g, '')
}

describe('publishPayloadOf', () => {
  it('makes the bundle, the note link and the quality record of a ready answer', () => {
    const c = compiled()
    const output = questionSetOutput(c)
    const card = runGate(JSON.stringify(output), c)
    expect(card.ok).toBe(true)
    const made = publishPayloadOf(NOTE, c, card, 'copy')
    if (!made.ok) throw new Error(made.message)
    const { bundle, articleSlug, registry } = made.payload
    expect(bundle.title).toBe(`${NOTE.title} — Practice Questions`)
    expect(setTitleOf(NOTE.title)).toBe(bundle.title)
    expect(bundle.excerpt).toBe(output.summary)
    expect(bundle.topic).toBe(NOTE.title)
    expect(bundle.questions).toHaveLength(10)
    bundle.questions.forEach((q, i) => {
      expect(q.questionText).toBe(output.questionSet.questions[i].questionText)
      expect(q.options).toEqual(output.questionSet.questions[i].options)
      expect(q.correctIndex).toBe(output.questionSet.questions[i].correctIndex)
      expect(q.explanation).toBe(output.questionSet.questions[i].explanation)
    })
    expect(articleSlug).toBe('AB-ART-00042')
    expect(registry).toEqual({ promptId: c.promptId, promptVersion: c.promptVersion, model: 'outside-ai', qualityScore: 100 })
    expect(parseRegistry(registry).ok).toBe(true)
    expect(routeSlug(bundle.title)).toBe('accruals-at-a-small-manufacturer-practice-questions')
  })

  it('records the site model for "Generate here"', () => {
    const c = compiled()
    const card = runGate(questionSetOutput(c), c)
    const made = publishPayloadOf(NOTE, c, card, 'generate')
    expect(made.ok && made.payload.registry.model).toBe('claude-sonnet-4-6')
  })

  it('refuses an answer that is not ready', () => {
    const c = compiled()
    const output = questionSetOutput(c)
    const notReady = runGate({ ...output, promptId: '0000000000000000' }, c)
    expect(notReady.ok).toBe(false)
    expect(publishPayloadOf(NOTE, c, notReady, 'copy')).toEqual({ ok: false, message: WORDING.notPublishable })
    const forced = { ...runGate(output, c), output: null }
    expect(publishPayloadOf(NOTE, c, forced, 'copy')).toEqual({ ok: false, message: WORDING.notPublishable })
  })

  it('refuses when the site normaliser or publish check would not accept the set', () => {
    const c = compiled()
    const output = questionSetOutput(c)
    const card = runGate(output, c)
    const broken = { ...card, output: { ...output, questionSet: { questions: [] } } }
    expect(publishPayloadOf(NOTE, c, broken, 'copy')).toEqual({ ok: false, message: WORDING.notPublishable })
    const q = output.questionSet.questions[0]
    const emptyExplanation = { ...card, output: { ...output, questionSet: { questions: [{ ...q, explanation: '' }] } } }
    expect(publishPayloadOf(NOTE, c, emptyExplanation, 'copy')).toEqual({ ok: false, message: WORDING.notPublishable })
  })
})
