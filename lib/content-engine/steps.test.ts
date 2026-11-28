import { describe, expect, it } from 'vitest'
import { sha16 } from './canonical'
import { compilePrompt, isCompiled } from './compiler'
import { FIXTURE_BRIEFS, QUESTION_SET_BRIEF } from './fixtures/briefs'
import { questionSetOutput } from './fixtures/outputs'
import { runGate } from './gate'
import { earlierQuestionsOf, mergeStepAnswers, planSteps, STEP_SIZE, stepPromptText, type EarlierQuestion } from './steps'
import type { CompiledPrompt, QuestionSetOutput } from './types'

function compiled(count: number): CompiledPrompt {
  const c = compilePrompt({ ...QUESTION_SET_BRIEF, questionCount: count })
  if (!isCompiled(c)) throw new Error('not compiled')
  return c
}

describe('planSteps', () => {
  it('uses steps of ten', () => {
    expect(STEP_SIZE).toBe(10)
  })

  it('plans one, two or three steps', () => {
    expect(planSteps(1)).toEqual([{ index: 0, total: 1, from: 1, to: 1 }])
    expect(planSteps(10)).toEqual([{ index: 0, total: 1, from: 1, to: 10 }])
    expect(planSteps(11)).toEqual([{ index: 0, total: 2, from: 1, to: 10 }, { index: 1, total: 2, from: 11, to: 11 }])
    expect(planSteps(20)).toEqual([{ index: 0, total: 2, from: 1, to: 10 }, { index: 1, total: 2, from: 11, to: 20 }])
    expect(planSteps(21)).toEqual([
      { index: 0, total: 3, from: 1, to: 10 },
      { index: 1, total: 3, from: 11, to: 20 },
      { index: 2, total: 3, from: 21, to: 21 },
    ])
    expect(planSteps(25).map(s => [s.from, s.to])).toEqual([[1, 10], [11, 20], [21, 25]])
  })

  it('plans nothing outside 1 to 25 or for a fraction', () => {
    for (const n of [0, 26, 2.5, -1, Number.NaN, Infinity]) expect(planSteps(n)).toEqual([])
  })
})

describe('stepPromptText', () => {
  it('sends exactly the compiled prompt for a one-step set (the same prompt both doors)', () => {
    const c = compiled(10)
    expect(stepPromptText(c, planSteps(10)[0], [])).toBe(c.text)
  })

  it('adds the exact step block for step 2 of 2 with ten earlier questions', () => {
    const c = compiled(20)
    const earlier: EarlierQuestion[] = Array.from({ length: 10 }, (_, i) => ({
      id: `q${i + 1}`,
      questionText: `Invented question ${i + 1}`,
      correctIndex: [0, 1, 2, 3, 0, 1, 2, 3, 0, 0][i],
    }))
    const text = stepPromptText(c, planSteps(20)[1], earlier)
    const block = [
      'STEP 2 OF 2 (the site asks for this set in 2 steps; everything above still applies to the whole set).',
      '- Return the complete JSON exactly as the OUTPUT section says, with every envelope field, but put ONLY questions q11 to q20 in "questionSet" (ids exactly q11 to q20, in order).',
      '- The whole set has 20 questions; balance the correct answer positions across the whole set. Earlier steps used: A 4, B 2, C 2, D 2.',
      '- Do not repeat or overlap any question already written in an earlier step:',
      ...earlier.map(q => `  - [${q.id}] ${q.questionText}`),
    ].join('\n')
    expect(text).toBe(c.text + '\n\n' + block)
  })

  it('says there is no earlier question on the first of several steps', () => {
    const c = compiled(20)
    const text = stepPromptText(c, planSteps(20)[0], [])
    expect(text.endsWith('Earlier steps used: A 0, B 0, C 0, D 0.\n- Do not repeat or overlap any question already written in an earlier step:\n  - (none: this is the first step)')).toBe(true)
    expect(text).toContain('put ONLY questions q1 to q10 in "questionSet"')
  })

  it('folds whitespace and cuts each earlier question at 300 characters', () => {
    const c = compiled(20)
    const long = '  Line one\n\n\tline   two ' + 'x'.repeat(400)
    const text = stepPromptText(c, planSteps(20)[1], [{ id: 'q1', questionText: long, correctIndex: 2 }])
    const line = text.split('\n').find(l => l.startsWith('  - [q1] '))
    expect(line).toBe('  - [q1] ' + ('Line one line two ' + 'x'.repeat(400)).slice(0, 300))
  })
})

describe('earlierQuestionsOf', () => {
  it('reads id, question text and answer position', () => {
    const value = { questionSet: { questions: [{ id: 'q1', questionText: 'A?', correctIndex: 3, options: [] }] } }
    expect(earlierQuestionsOf(value)).toEqual([{ id: 'q1', questionText: 'A?', correctIndex: 3 }])
  })

  it('skips anything else and never throws', () => {
    const junk: unknown[] = [null, undefined, 1, 'x', [], {}, { questionSet: null }, { questionSet: { questions: 'x' } }]
    for (const v of junk) expect(earlierQuestionsOf(v)).toEqual([])
    const mixed = {
      questionSet: {
        questions: [
          null, 'q', { id: 1, questionText: 'A', correctIndex: 0 }, { id: 'q2', questionText: '  ', correctIndex: 0 },
          { id: 'q3', questionText: 'B', correctIndex: 4 }, { id: 'q4', questionText: 'C', correctIndex: 1.5 },
          { id: 'q5', questionText: 'D', correctIndex: 1 },
        ],
      },
    }
    expect(earlierQuestionsOf(mixed)).toEqual([{ id: 'q5', questionText: 'D', correctIndex: 1 }])
  })
})

function halves(): { whole: QuestionSetOutput; first: QuestionSetOutput; second: QuestionSetOutput; c: CompiledPrompt } {
  const c = compiled(20)
  const whole = questionSetOutput(c)
  const qs = whole.questionSet.questions
  return {
    c,
    whole,
    first: { ...whole, questionSet: { questions: qs.slice(0, 10) } },
    second: { ...whole, title: 'Another title', questionSet: { questions: qs.slice(10) } },
  }
}

describe('mergeStepAnswers', () => {
  it('has a problem when there is no answer', () => {
    expect(mergeStepAnswers([])).toEqual({ value: null, problems: ['There is no answer.'] })
  })

  it('returns one answer unchanged, the same object', () => {
    const one = { anything: 1 }
    const merged = mergeStepAnswers([one])
    expect(merged.value).toBe(one)
    expect(merged.problems).toEqual([])
  })

  it('joins two halves: the first envelope, twenty questions in order, the same question objects', () => {
    const { first, second } = halves()
    const before = JSON.stringify([first, second])
    const merged = mergeStepAnswers([first, second])
    expect(merged.problems).toEqual([])
    const value = merged.value as QuestionSetOutput
    expect(value).not.toBe(first)
    expect(value.title).toBe(first.title)
    expect(value.promptId).toBe(first.promptId)
    expect(Object.keys(value).filter(k => k !== 'questionSet')).toEqual(Object.keys(first).filter(k => k !== 'questionSet'))
    expect(value.questionSet.questions.map(q => q.id)).toEqual(Array.from({ length: 20 }, (_, i) => `q${i + 1}`))
    value.questionSet.questions.forEach((q, i) => expect(q).toBe(i < 10 ? first.questionSet.questions[i] : second.questionSet.questions[i - 10]))
    expect(JSON.stringify([first, second])).toBe(before)
  })

  it('names the step whose answer has no question list', () => {
    const { first } = halves()
    expect(mergeStepAnswers([first, { questionSet: {} }])).toEqual({ value: null, problems: ['Step 2: the answer has no question list.'] })
    expect(mergeStepAnswers([null, 'x'])).toEqual({
      value: null,
      problems: ['Step 1: the answer has no question list.', 'Step 2: the answer has no question list.'],
    })
  })

  it('the merged halves of a valid set pass the gate with 100', () => {
    const { first, second, c } = halves()
    const card = runGate(mergeStepAnswers([first, second]).value, c)
    expect(card.ok).toBe(true)
    expect(card.score).toBe(100)
    expect(card.stats.questions).toBe(20)
  })
})

describe('compiled prompts are unchanged by this batch', () => {
  // Fingerprints of the E1b fixture briefs' compiled prompts (ENGINE_VERSION 1.0.0).
  const EXPECTED: Record<string, string> = {
    'article': 'c29117ccbb83c2e2/0b953150d09efa7d',
    'exam-technique-guide': 'b6e83be6cc6187d8/250287a901a397f6',
    'practice-question-set': '9be19f4be26f55f2/620bbfbbf413b2b8',
    'question-explainer': 'b596a33fd0c1d61d/e9261a67cacc6f0a',
    'study-note': '1d06576f82efa0a9/34f33246f59e3884',
    'subject-overview': '5e6dd146ef6b37de/689ab74876513020',
    'topic-guide': 'a0f245a0a33818e3/6783a3d110d44b47',
    'topic-guide (tax-guide)': '12b4cf00afa7937e/6fe3b1387180d89a',
  }
  it('compiles every fixture brief to the same text and id', () => {
    const got: Record<string, string> = {}
    for (const [name, brief] of FIXTURE_BRIEFS) {
      const c = compilePrompt(brief)
      if (!isCompiled(c)) throw new Error(`${name} not compiled`)
      got[name] = `${c.promptId}/${sha16(c.text)}`
    }
    expect(got).toEqual(EXPECTED)
  })
})
