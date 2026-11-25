import { describe, expect, it } from 'vitest'
import {
  ALREADY_HAS_SET_PLAIN,
  ARTICLE_RULE,
  BAD_ADDRESS,
  CASES_SAVE_FAILED,
  CONTENT_ID_FAILED,
  CONTENT_ID_RULE,
  CORRECT_INDEX_RULE,
  EMPTY_ADDRESS,
  LAST_QUESTION,
  LEFT_DRAFT,
  LINK_FAILED,
  MAX_LISTED_PROBLEMS,
  NOT_FOUND,
  NOT_READY_EMPTY,
  PUBLISH_FAILED,
  REASON_TEXT,
  RESTORED_AS_DRAFT,
  RESTORE_CHECK_FAILED,
  SET_CHECK_FAILED,
  SET_READ_FAILED,
  SLUG_LOCKED,
  SLUG_READ_FAILED,
  SLUG_RULE,
  UNLINK_FAILED,
  alreadyHasSetMessage,
  checkPublishBundle,
  checkStoredSet,
  fixThisQuestionMessage,
  notLinkedOtherSetMessage,
  notReadyProblemsMessage,
  numberUnclearMessage,
  publishProblemsMessage,
  slugTakenEditMessage,
  slugTakenMessage,
  storedQuestionReasons,
  violatedRule,
  type PublishProblem,
} from './question-publish-checks'

type Question = Record<string, unknown>

const mcq = (over: Question = {}): Question => ({
  type: 'multiple-choice',
  questionText: 'Which one?',
  options: ['One', 'Two', 'Three', 'Four'],
  correctIndex: 2,
  explanation: 'Because.',
  ...over,
})
const writing = (over: Question = {}): Question => ({
  type: 'writing',
  questionText: 'Discuss.',
  options: [],
  correctIndex: null,
  explanation: null,
  writingModelAnswer: 'A model answer.',
  ...over,
})

const check = (...questions: unknown[]) => checkPublishBundle({ questions })
const reasons = (question: unknown) => {
  const result = check(question)
  return result.ok ? [] : result.problems.map((p) => p.reason)
}

describe('checkPublishBundle', () => {
  it('accepts complete questions of every type', () => {
    expect(check(mcq(), mcq({ type: 'scenario' }), writing())).toEqual({ ok: true })
  })

  it.each([0, 1, 2, 3])('accepts correct answer %s', (correctIndex) => {
    expect(reasons(mcq({ correctIndex }))).toEqual([])
  })

  it('accepts number options', () => {
    expect(reasons(mcq({ options: [0, 10, 20, 30] }))).toEqual([])
  })

  describe.each(['multiple-choice', 'scenario', undefined, 'something-else'])('type %s', (type) => {
    it.each([
      ['no question text', { questionText: undefined }, ['text']],
      ['blank question text', { questionText: '  \n ' }, ['text']],
      ['no options', { options: undefined }, ['four-options']],
      ['options that are not a list', { options: { a: 'One' } }, ['four-options']],
      ['three options', { options: ['One', 'Two', 'Three'] }, ['four-options']],
      ['five options', { options: ['One', 'Two', 'Three', 'Four', 'Five'] }, ['four-options']],
      ['an empty option', { options: ['One', 'Two', 'Three', '   '] }, ['empty-option']],
      ['a null option', { options: ['One', 'Two', 'Three', null] }, ['empty-option']],
      ['an object option', { options: ['One', 'Two', 'Three', { text: 'Four' }] }, ['empty-option']],
      ['two empty options', { options: ['One', 'Two', '', ''] }, ['empty-option']],
      ['a long dash option', { options: ['One', 'Two', 'Three', ' — '] }, ['placeholder-option']],
      ['a short dash option', { options: ['One', 'Two', 'Three', '-'] }, ['placeholder-option']],
      ['an "Option C" option', { options: ['One', 'Two', 'Option C', 'Four'] }, ['placeholder-option']],
      ['an "option  d" option', { options: ['One', 'Two', 'Three', 'option  d'] }, ['placeholder-option']],
      ['two long dash options', { options: ['One', 'Two', '—', '—'] }, ['placeholder-option']],
      ['two equal options', { options: ['One', 'Two', 'Three', 'Two'] }, ['same-options']],
      ['two options equal but for case and spaces', { options: ['One', 'Two', 'Three', ' TWO '] }, ['same-options']],
      ['a number equal to a text option', { options: ['10', 10, '20', '30'] }, ['same-options']],
      ['no correct answer', { correctIndex: null }, ['correct-answer']],
      ['a correct answer below A', { correctIndex: -1 }, ['correct-answer']],
      ['a correct answer past D', { correctIndex: 4 }, ['correct-answer']],
      ['a fractional correct answer', { correctIndex: 1.5 }, ['correct-answer']],
      ['a text correct answer', { correctIndex: '1' }, ['correct-answer']],
      ['no explanation', { explanation: null }, ['explanation']],
      ['a blank explanation', { explanation: ' ' }, ['explanation']],
    ])('refuses %s', (_name, over, expected) => {
      expect(reasons(mcq({ type, ...over }))).toEqual(expected)
    })
  })

  it.each(['Option E', 'Option A is right', 'Options', '-5', '— 5%'])('keeps %j as a real option', (option) => {
    expect(reasons(mcq({ options: ['One', 'Two', 'Three', option] }))).toEqual([])
  })

  it('needs a model answer for writing, and ignores its options, answer and explanation', () => {
    expect(reasons(writing({ options: ['—', '—'], correctIndex: 9 }))).toEqual([])
    expect(reasons(writing({ writingModelAnswer: null }))).toEqual(['model-answer'])
    expect(reasons(writing({ writingModelAnswer: '  ' }))).toEqual(['model-answer'])
    expect(reasons(writing({ questionText: '', writingModelAnswer: '' }))).toEqual(['text', 'model-answer'])
  })

  it.each([[null], ['text'], [undefined]])('refuses an entry that is not a question (%s)', (entry) => {
    expect(reasons(entry)).toEqual(['text', 'four-options', 'correct-answer', 'explanation'])
  })

  it('lists every problem in order, with the question number', () => {
    expect(check(mcq(), mcq({ options: ['', '-', 'Same', 'same'], explanation: '' }), writing({ questionText: '' }))).toEqual({
      ok: false,
      problems: [
        { n: 2, reason: 'empty-option' },
        { n: 2, reason: 'placeholder-option' },
        { n: 2, reason: 'same-options' },
        { n: 2, reason: 'explanation' },
        { n: 3, reason: 'text' },
      ],
    })
  })

  describe('a scenario question and its case', () => {
    const withCases = (caseId: unknown, cases: unknown, type: unknown = 'scenario') => {
      const result = checkPublishBundle({ questions: [mcq({ type, caseId })], cases })
      return result.ok ? [] : result.problems.map((p) => p.reason)
    }
    const one = { caseId: 'case-1', title: 'Case', exhibitHtml: '<p>Facts</p>' }

    it.each<[string, unknown, unknown]>([
      ['its case', 'case-1', [one]],
      ['its case among others', 'case-1', [null, 'text', { ...one, caseId: 'case-2' }, one]],
      ['a number for a name', 7, [{ ...one, caseId: '7' }]],
      ['no case named', undefined, undefined],
      ['a null case', null, [one]],
      ['an empty case', '', []],
    ])('accepts %s', (_name, caseId, cases) => {
      expect(withCases(caseId, cases)).toEqual([])
    })

    it.each<[string, unknown, unknown]>([
      ['no cases', 'case-1', undefined],
      ['cases that are not a list', 'case-1', { ...one }],
      ['an empty list', 'case-1', []],
      ['only another case', 'case-1', [{ ...one, caseId: 'case-2' }]],
      ['a name with other spaces', 'case-1', [{ ...one, caseId: 'case-1 ' }]],
      ['a case with no exhibit', 'case-1', [{ ...one, exhibitHtml: undefined }]],
      ['a case with an empty exhibit', 'case-1', [{ ...one, exhibitHtml: '' }]],
      ['a case with a blank exhibit', 'case-1', [{ ...one, exhibitHtml: ' \n ' }]],
      ['a case with an exhibit that is not text', 'case-1', [{ ...one, exhibitHtml: { html: 'x' } }]],
      ['a case with no name', 'undefined', [{ ...one, caseId: undefined }]],
    ])('refuses %s', (_name, caseId, cases) => {
      expect(withCases(caseId, cases)).toEqual(['missing-case'])
    })

    it('is listed last, with the question number', () => {
      const result = checkPublishBundle({ questions: [mcq(), mcq({ type: 'scenario', caseId: 'case-1', explanation: '' })] })
      expect(result).toEqual({
        ok: false,
        problems: [
          { n: 2, reason: 'explanation' },
          { n: 2, reason: 'missing-case' },
        ],
      })
    })

    it.each(['multiple-choice', 'writing'])('is not asked of a %s question', (type) => {
      expect(withCases('case-1', [], type)).not.toContain('missing-case')
    })
  })

  it('never judges which answer is right', () => {
    const answers = [0, 1, 2, 3].map((correctIndex) => check(mcq({ questionText: '2 + 2 = ?', options: ['1', '2', '3', '4'], correctIndex })))
    expect(answers).toEqual([{ ok: true }, { ok: true }, { ok: true }, { ok: true }])
  })
})

describe('stored questions', () => {
  const row = (over: Question = {}): Question => ({
    type: 'scenario',
    question_text: 'Which one?',
    option_a: 'One',
    option_b: 'Two',
    option_c: 'Three',
    option_d: 'Four',
    correct_index: 0,
    explanation: 'Because.',
    writing_model_answer: null,
    case_id: 'case-1',
    ...over,
  })

  it('has the same rules as a bundle, without the case', () => {
    expect(storedQuestionReasons(row())).toEqual([])
    expect(storedQuestionReasons(row({ question_text: null, option_b: null, option_c: '-', correct_index: null, explanation: '' }))).toEqual([
      'text',
      'empty-option',
      'placeholder-option',
      'correct-answer',
      'explanation',
    ])
    expect(storedQuestionReasons(row({ type: 'writing' }))).toEqual(['model-answer'])
    expect(storedQuestionReasons({})).toEqual(['text', 'empty-option', 'correct-answer', 'explanation'])
  })

  it('a whole set is checked with its cases', () => {
    const cases = [{ case_id: 'case-1', exhibit_html: '<p>Facts</p>' }]
    expect(checkStoredSet([row()], cases)).toEqual({ ok: true })
    expect(checkStoredSet([row({ case_id: null }), row()], [])).toEqual({ ok: false, problems: [{ n: 2, reason: 'missing-case' }] })
  })
})

describe('violatedRule', () => {
  const unique = 'duplicate key value violates unique constraint "question_sets_slug_key"'
  const check = 'new row for relation "questions" violates check constraint "questions_correct_index_range"'

  it('names the rule of a unique or a check violation', () => {
    expect(violatedRule({ code: '23505', message: unique })).toBe(SLUG_RULE)
    expect(violatedRule({ code: '23514', message: check })).toBe(CORRECT_INDEX_RULE)
  })

  it.each([
    [null],
    [undefined],
    [{}],
    [{ message: unique }],
    [{ code: '23505' }],
    [{ code: '23505', message: '' }],
    [{ code: '23503', message: unique }],
    [{ code: 'XX000', message: unique }],
  ])('names nothing for another error (%j)', (error) => {
    expect(violatedRule(error)).toBeNull()
  })

  it('knows the names the database uses', () => {
    expect([SLUG_RULE, CONTENT_ID_RULE, ARTICLE_RULE, CORRECT_INDEX_RULE]).toEqual([
      'question_sets_slug_key',
      'question_sets_content_id_key',
      'question_sets_article_slug_key',
      'questions_correct_index_range',
    ])
  })
})

describe('wording', () => {
  it('has the exact reason texts', () => {
    expect(REASON_TEXT).toEqual({
      'text': 'needs question text',
      'four-options': 'needs four answer options',
      'empty-option': 'has an empty answer option',
      'placeholder-option': 'has a placeholder answer option',
      'same-options': 'has two answer options that are the same',
      'correct-answer': 'needs one correct answer (A, B, C or D)',
      'explanation': 'needs an explanation',
      'model-answer': 'needs a model answer',
      'missing-case': 'refers to a missing case',
    })
  })

  const problems = (count: number): PublishProblem[] => Array.from({ length: count }, (_, i) => ({ n: i + 1, reason: 'explanation' }))

  it('lists one problem', () => {
    expect(publishProblemsMessage([{ n: 3, reason: 'text' }])).toBe(
      'Nothing was published. Please fix these questions first: Q3 needs question text.',
    )
  })

  it('joins problems with semicolons', () => {
    expect(
      publishProblemsMessage([
        { n: 1, reason: 'same-options' },
        { n: 4, reason: 'model-answer' },
      ]),
    ).toBe(
      'Nothing was published. Please fix these questions first: Q1 has two answer options that are the same; Q4 needs a model answer.',
    )
  })

  it('lists all ten of ten problems', () => {
    expect(MAX_LISTED_PROBLEMS).toBe(10)
    const message = publishProblemsMessage(problems(10))
    expect(message.endsWith('; Q10 needs an explanation.')).toBe(true)
    expect(message).not.toContain('more')
  })

  it('lists the first ten of more and counts the rest', () => {
    const message = publishProblemsMessage(problems(13))
    expect(message.endsWith('; Q10 needs an explanation and 3 more.')).toBe(true)
    expect(message).not.toContain('Q11')
  })

  it('has the exact article, address and warning messages', () => {
    expect(NOT_FOUND).toBe('Nothing was published. The linked article was not found. Check the Article ID and try again.')
    expect(alreadyHasSetMessage('Leases quiz')).toBe(
      'Nothing was published. This article already has a practice set: "Leases quiz". Add questions to that set instead.',
    )
    expect(slugTakenMessage('leases-quiz')).toBe(
      'Nothing was published. Another practice set already uses the web address /practice-questions/leases-quiz. Change the title and try again.',
    )
    expect(LINK_FAILED).toBe(
      'Published. But the link from the article to this set could not be saved, so the article does not point to it yet.',
    )
    expect(CASES_SAVE_FAILED).toBe('Could not save the case exhibits. Nothing was published.')
    expect(SET_READ_FAILED).toBe('Could not check for an existing practice set. Nothing was published.')
    expect(SLUG_READ_FAILED).toBe('Could not check the web address. Nothing was published.')
    expect(EMPTY_ADDRESS).toBe(
      'Nothing was published. The title needs at least one letter or number (A–Z or 0–9) so the set can have a web address.',
    )
    expect(LEFT_DRAFT).toBe(
      'Nothing was published. Saving stopped part-way and a hidden draft set was left behind. Delete it in Questions, then publish again.',
    )
    expect(PUBLISH_FAILED).toBe('Could not publish the set. Nothing was published.')
    expect(SLUG_LOCKED).toBe('The web address of a published set cannot be changed.')
    expect(UNLINK_FAILED).toBe(
      "Done. But the article's link to this set could not be removed, so the article may point to a missing page.",
    )
    expect(SET_CHECK_FAILED).toBe('Could not check this set. Nothing was saved.')
  })

  it('has the exact set editor messages', () => {
    expect(fixThisQuestionMessage(['explanation'])).toBe('Nothing was saved. Please fix this question first: needs an explanation.')
    expect(fixThisQuestionMessage(['text', 'model-answer'])).toBe(
      'Nothing was saved. Please fix this question first: needs question text; needs a model answer.',
    )
    expect(NOT_READY_EMPTY).toBe('Nothing was saved. This set has no questions yet, so it cannot go live.')
    expect(notReadyProblemsMessage([{ n: 2, reason: 'missing-case' }])).toBe(
      'Nothing was saved. This set cannot go live yet. Please fix these questions first: Q2 refers to a missing case.',
    )
    expect(notReadyProblemsMessage(problems(13)).endsWith('; Q10 needs an explanation and 3 more.')).toBe(true)
    expect(LAST_QUESTION).toBe(
      'Nothing was deleted. A live set must keep at least one question. Make the set a draft first, or delete the whole set.',
    )
  })

  it('has the exact restore messages', () => {
    expect(RESTORED_AS_DRAFT).toBe('Restored as a draft, because the set is not complete. Fix it in Questions, then make it live.')
    expect(RESTORE_CHECK_FAILED).toBe(
      'Restored. But the set could not be checked or made a draft, so an incomplete set may be live. Check it in Questions.',
    )
  })

  it('has the exact note for a set that is not linked', () => {
    expect(notLinkedOtherSetMessage('Leases basics')).toBe(
      'Done. But the article already links to another practice set ("Leases basics"), so this set is not linked from the article.',
    )
  })

  it('has the exact messages for a write the database refused', () => {
    expect(slugTakenEditMessage('leases-quiz')).toBe(
      'Nothing was saved. Another practice set already uses the web address /practice-questions/leases-quiz.',
    )
    expect(ALREADY_HAS_SET_PLAIN).toBe(
      'Nothing was published. This article already has a practice set. Add questions to that set instead.',
    )
    expect(CONTENT_ID_FAILED).toBe('Could not assign a content ID. Nothing was published.')
  })

  it('has the exact message for an odd web address', () => {
    expect(BAD_ADDRESS).toBe('Nothing was saved. A web address may use only small letters a–z, numbers and single hyphens.')
  })

  it('has the exact importer warning', () => {
    expect(numberUnclearMessage(7)).toBe(
      'Q7: the correct answer is a number, and this paste does not show whether numbers start at 0 or 1. Use a letter (A, B, C or D) instead.',
    )
  })
})
