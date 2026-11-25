import { describe, expect, it } from 'vitest'
import { checkPublishBundle, numberUnclearMessage, publishProblemsMessage } from './question-publish-checks'
import { normalise, validateNormalisedBundle } from './question-normaliser'

// The importer's reading of pasted questions. All questions here are made up.

const NOTE = 'Q1: stripped A./B./C./D. prefixes from options'

const question = (over: Record<string, unknown> = {}) => ({
  questionText: 'Which one?',
  options: ['One', 'Two', 'Three', 'Four'],
  correctIndex: 0,
  explanation: 'Because.',
  ...over,
})

function read(over: Record<string, unknown>) {
  const { bundle, changes, warnings } = normalise({ title: 'Test set', questions: [question(over)] })
  return { question: bundle.questions[0], bundle, changes, warnings }
}

function options(list: unknown) {
  const { question: q, changes } = read({ options: list })
  return { options: q.options, noted: changes.includes(NOTE) }
}

describe('option labels', () => {
  it.each([
    ['percentages', ['1.5%', '2.5%', '3.5%', '4.5%']],
    ['one percentage', ['2.5%', 'Nil', 'Ten', 'All of it']],
    ['a number and a word', ['1 year', '2 years', '3 years', '4 years']],
    ['articles', ['A company', 'B company', 'C company', 'D company']],
    ['one article', ['A company', 'A partnership', 'A sole trader', 'A trust']],
    ['lower-case words', ['a company', 'b', 'c', 'd']],
    ['decimals without a unit', ['1.5', '2.5', '3.5', '4.5']],
    ['times', ['1:30', '2:30', '3:30', '4:30']],
    ['digits with no space after the mark', ['1)Cash', '2)Bank', '3)Loan', '4)Equity']],
    ['digits in brackets with no space', ['(1)Cash', '(2)Bank', '(3)Loan', '(4)Equity']],
    ['letter and colon with no space', ['A:Cash', 'B:Bank', 'C:Loan', 'D:Equity']],
    ['square brackets with no space', ['[A]Cash', '[B]Bank', '[C]Loan', '[D]Equity']],
    ['a dash', ['A - Cash', 'B - Bank', 'C - Loan', 'D - Equity']],
    ['brackets that do not match', ['(A] Cash', '(B] Bank', '(C] Loan', '(D] Equity']],
    ['an open bracket only', ['(A. Cash', '(B. Bank', '(C. Loan', '(D. Equity']],
    ['letters and digits mixed', ['A) Cash', '2) Bank', 'C) Loan', '4) Equity']],
    ['marks mixed', ['A) Cash', 'B. Bank', 'C) Loan', 'D) Equity']],
    ['upper and lower case mixed', ['A) Cash', 'b) Bank', 'C) Loan', 'D) Equity']],
    ['three of four', ['A) Cash', 'B) Bank', 'C) Loan', 'Equity']],
    ['labels out of order', ['B) Cash', 'A) Bank', 'C) Loan', 'D) Equity']],
    ['the same label four times', ['A) Cash', 'A) Bank', 'A) Loan', 'A) Equity']],
    ['other numbers', ['5. Cash', '6. Bank', '7. Loan', '8. Equity']],
    ['labels with no text', ['A)', 'B)', 'C)', 'D)']],
    ['one label with no text', ['A) Cash', 'B) Bank', 'C) Loan', 'D) ']],
  ])('leaves %s exactly as written', (_name, list) => {
    expect(options(list)).toEqual({ options: list.map((option) => option.trim()), noted: false })
  })

  const plain = ['Cash', 'Bank', 'Loan', 'Equity']
  const labelled = (label: (letter: string) => string) => plain.map((text, i) => label('ABCD'[i]) + text)

  it.each([
    ['A) x', labelled((l) => `${l}) `)],
    ['A. x', labelled((l) => `${l}. `)],
    ['A: x', labelled((l) => `${l}: `)],
    ['(A) x', labelled((l) => `(${l}) `)],
    ['[A] x', labelled((l) => `[${l}] `)],
    ['(a) x', labelled((l) => `(${l.toLowerCase()}) `)],
    ['a. x', labelled((l) => `${l.toLowerCase()}. `)],
    ['1. x', labelled((l) => `${'ABCD'.indexOf(l) + 1}. `)],
    ['1) x', labelled((l) => `${'ABCD'.indexOf(l) + 1}) `)],
    ['1: x', labelled((l) => `${'ABCD'.indexOf(l) + 1}: `)],
    ['(1) x', labelled((l) => `(${'ABCD'.indexOf(l) + 1}) `)],
    ['[1] x', labelled((l) => `[${'ABCD'.indexOf(l) + 1}] `)],
    ['A)x', labelled((l) => `${l})`)],
    ['A.x', labelled((l) => `${l}.`)],
    ['(A)x', labelled((l) => `(${l})`)],
    ['b)x', labelled((l) => `${l.toLowerCase()})`)],
    ['several spaces', labelled((l) => `  ${l})   `)],
    ['some with and some without a space', ['A)Cash', 'B) Bank', 'C)Loan', 'D) Equity']],
  ])('removes the labels "%s" from all four, and notes it', (_name, list) => {
    expect(options(list)).toEqual({ options: plain, noted: true })
  })

  it('removes one label only, not text that looks like a second one', () => {
    expect(options(['1. 2.5%', '2. 3 years', '3. A company', '4. 4. x']).options).toEqual(['2.5%', '3 years', 'A company', '4. x'])
    expect(options(['A) 1. x', 'B) 2. y', 'C) 3. z', 'D) 4. w']).options).toEqual(['1. x', '2. y', '3. z', '4. w'])
  })

  it('treats options given as objects the same way', () => {
    const asObjects = (list: string[]) => list.map((text) => ({ text }))
    expect(options(asObjects(['1.5%', '2.5%', '3.5%', '4.5%']))).toEqual({ options: ['1.5%', '2.5%', '3.5%', '4.5%'], noted: false })
    expect(options(asObjects(['A) Cash', 'B) Bank', 'C) Loan', 'D) Equity']))).toEqual({ options: plain, noted: true })
    expect(options([{ text: 'A) Cash' }, 'B) Bank', { content: 'C) Loan' }, { value: 'D) Equity' }])).toEqual({ options: plain, noted: true })
    expect(options(asObjects(['A) Cash', 'B) Bank', 'C) Loan', 'Equity'])).noted).toBe(false)
  })

  it('treats one object with lettered or numbered keys the same way', () => {
    expect(options({ a: '1 year', b: '2 years', c: '3 years', d: '4 years' })).toEqual({
      options: ['1 year', '2 years', '3 years', '4 years'],
      noted: false,
    })
    expect(options({ A: 'A) Cash', B: 'B) Bank', C: 'C) Loan', D: 'D) Equity' })).toEqual({ options: plain, noted: true })
    expect(options({ 1: '1.5%', 2: '2.5%', 3: '3.5%', 4: '4.5%' }).options).toEqual(['1.5%', '2.5%', '3.5%', '4.5%'])
  })

  it('keeps numbers, and an empty entry stays empty', () => {
    expect(options([1.5, 2.5, 3.5, 4.5])).toEqual({ options: ['1.5', '2.5', '3.5', '4.5'], noted: false })
    expect(options([0, null, 3, 4])).toEqual({ options: ['0', '', '3', '4'], noted: false })
  })

  it('still pads to four, and looks at the first four of a longer list', () => {
    const short = read({ options: ['A) Cash', 'B) Bank', 'C) Loan'] })
    expect(short.question.options).toEqual(['A) Cash', 'B) Bank', 'C) Loan', ''])
    expect(short.warnings).toContain('Q1: only 3 options found — padded to 4')
    const long = read({ options: ['A) Cash', 'B) Bank', 'C) Loan', 'D) Equity', 'E) None'] })
    expect(long.question.options).toEqual(plain)
    expect(long.warnings).toContain('Q1: 5 options found — trimmed to first 4')
  })
})

describe('the correct answer', () => {
  const list = ['Cash', 'Cash and bank', 'Option premium', 'Adopt a policy']
  const answerOf = (answer: unknown, opts: unknown = list) => read({ options: opts, correctIndex: undefined, answer }).question.correctIndex

  it.each<[unknown, number]>([
    [0, 0],
    ['0', 0],
    [4, 3],
    ['4', 3],
    ['A', 0],
    ['d', 3],
    ['B)', 1],
    ['(c)', 2],
    ['D.', 3],
    [['B'], 1],
    ['Option B', 1],
    ['option c', 2],
    ['Answer: D', 3],
    ['The correct answer is B', 1],
    ['Option B: the second one', 1],
    ['Option B) the second one', 1],
    ['choice A - the first one', 0],
    ['option_b', 1],
    ['ans_d', 3],
    ['Cash', 0],
    ['cash and bank', 1],
    ['B) Cash and bank', 1],
    ['(a) Cash', 0],
    ['Option premium', 2],
    ['Adopt a policy', 3],
    ['Adopt a policy for every class of asset', 3],
    ['premium', 2],
  ])('reads %j', (answer, index) => {
    expect(answerOf(answer)).toBe(index)
  })

  it.each<[unknown]>([
    [undefined],
    [null],
    [''],
    ['   '],
    ['E'],
    ['-1'],
    ['1.5'],
    [['A', 'C']],
    [[0, 2]],
    ['A and C'],
    ['A, C'],
    ['Option A and Option C'],
    ['Option A or C'],
    ['Opt out of the scheme'],
    ['An option can be exercised'],
    ['Answer depends on the facts'],
    ['option_amount'],
    ['None of the above'],
    ['Cash and bank, or Option premium'],
    [{ letter: 'A' }],
  ])('leaves %j unset and says so', (answer) => {
    const result = read({ options: list, correctIndex: undefined, answer })
    expect(result.question.correctIndex).toBeNull()
    expect(result.warnings).toEqual(['Q1: could not work out the correct answer. Set it in the pasted text and paste again.'])
    expect(validateNormalisedBundle(result.bundle)).toEqual(['Q1: correct answer not set'])
  })

  it('does not match an empty option', () => {
    expect(answerOf('Something else', ['Cash', 'Bank', '', ''])).toBeNull()
  })

  it('reads the answer text when the labels were removed, and when they were not', () => {
    expect(answerOf('B) Bank', ['A) Cash', 'B) Bank', 'C) Loan', 'D) Equity'])).toBe(1)
    expect(answerOf('Bank', ['A) Cash', 'B) Bank', 'C) Loan', 'D) Equity'])).toBe(1)
    expect(answerOf('B) Bank', ['A) Cash', 'B) Bank', 'C) Loan', 'Equity'])).toBe(1)
    expect(answerOf('2.5%', ['1.5%', '2.5%', '3.5%', '4.5%'])).toBe(1)
  })

  it('names the question that has no answer, and the publish check refuses it too', () => {
    const { bundle, warnings } = normalise({ title: 'Test set', questions: [question(), question({ correctIndex: undefined, answer: 'E' })] })
    expect(warnings).toEqual(['Q2: could not work out the correct answer. Set it in the pasted text and paste again.'])
    expect(validateNormalisedBundle(bundle)).toEqual(['Q2: correct answer not set'])
    const checked = checkPublishBundle(bundle)
    expect(checked).toEqual({ ok: false, problems: [{ n: 2, reason: 'correct-answer' }] })
    expect(checked.ok ? '' : publishProblemsMessage(checked.problems)).toBe(
      'Nothing was published. Please fix these questions first: Q2 needs one correct answer (A, B, C or D).',
    )
  })

  it('needs no correct answer for a writing question', () => {
    const result = read({ type: 'writing', options: undefined, correctIndex: undefined, writingModelAnswer: 'A model answer.' })
    expect(result.question.correctIndex).toBeNull()
    expect(result.warnings).toEqual([])
    expect(validateNormalisedBundle(result.bundle)).toEqual([])
  })

  it('a complete set is ready, as before', () => {
    const { bundle, warnings } = normalise({ title: 'Test set', questions: [question(), question({ type: 'scenario' })] })
    expect(warnings).toEqual([])
    expect(validateNormalisedBundle(bundle)).toEqual([])
    expect(checkPublishBundle(bundle)).toEqual({ ok: true })
  })
})

describe('one key, one meaning', () => {
  const only = (over: Record<string, unknown>) => read({ questionText: undefined, ...over })

  it('"stem" alone is the question text, and no case', () => {
    const { question: q, bundle, changes } = only({ stem: 'Which one?' })
    expect(q).toMatchObject({ questionText: 'Which one?', caseId: null })
    expect(bundle.cases).toEqual([])
    expect(changes.join()).not.toContain('exhibit')
  })

  it.each(['exhibit', 'case_text', 'context', 'passage', 'scenario', 'vignette'])('"stem" with "%s" is a question and a case', (key) => {
    const { question: q, bundle } = only({ stem: 'Which one?', [key]: 'The facts.' })
    expect(q).toMatchObject({ questionText: 'Which one?', caseId: 'case-inline-1' })
    expect(bundle.cases).toEqual([{ caseId: 'case-inline-1', title: 'Case 1', exhibitHtml: 'The facts.' }])
  })

  it('a case key with another question key is a case, as before', () => {
    const { question: q, bundle } = read({ context: 'The facts.' })
    expect(q).toMatchObject({ questionText: 'Which one?', caseId: 'case-inline-1' })
    expect(bundle.cases).toMatchObject([{ exhibitHtml: 'The facts.' }])
  })

  it('a case key alone is not a question', () => {
    expect(() => only({ context: 'The facts.' })).toThrow('No valid questions could be extracted')
  })

  it('"stem" beside the key that holds the question is a case, and an empty one is not read', () => {
    expect(read({ stem: 'The facts.' })).toMatchObject({
      question: { questionText: 'Which one?', caseId: 'case-inline-1' },
      bundle: { cases: [{ exhibitHtml: 'The facts.' }] },
    })
    expect(only({ question: null, stem: 'Which one?' }).bundle.cases).toEqual([])
  })

  it('is decided for each question on its own', () => {
    const { bundle } = normalise([question({ questionText: undefined, stem: 'First?' }), question({ stem: 'The facts.' })])
    expect(bundle.questions.map((q) => [q.questionText, q.caseId])).toEqual([
      ['First?', null],
      ['Which one?', 'case-inline-1'],
    ])
  })

  it('"stem" in the list of cases is the exhibit of that case', () => {
    const { bundle } = normalise({ title: 'Test set', cases: [{ caseId: 'c1', stem: 'The facts.' }], questions: [question({ type: 'scenario', caseId: 'c1' })] })
    expect(bundle.cases).toMatchObject([{ caseId: 'c1', exhibitHtml: 'The facts.' }])
    expect(checkPublishBundle(bundle)).toEqual({ ok: true })
  })

  it('a key that gave the answer is not the explanation as well', () => {
    const without = { correctIndex: undefined, explanation: undefined }
    expect(read({ ...without, solution: 'B' }).question).toMatchObject({ correctIndex: 1, explanation: null })
    expect(read({ ...without, solution: 'B', rationale: 'Why.' }).question).toMatchObject({ correctIndex: 1, explanation: 'Why.' })
    expect(read({ ...without, answer: 'B', solution: 'Why.' }).question).toMatchObject({ correctIndex: 1, explanation: 'Why.' })
    expect(read({ ...without, solution: 'Look at the facts.' }).question).toMatchObject({ correctIndex: null, explanation: 'Look at the facts.' })
  })
})

describe('numbered answers: one rule for the whole paste', () => {
  // One question per answer; an answer may come with its own options or type.
  const paste = (...answers: unknown[]) => {
    const questions = answers.map((answer) =>
      question({ correctIndex: undefined, ...(typeof answer === 'object' && answer !== null && !Array.isArray(answer) ? answer : { answer }) }),
    )
    const { bundle, changes, warnings } = normalise({ title: 'Test set', questions })
    return { read: bundle.questions.map((q) => q.correctIndex), changes, warnings, ready: validateNormalisedBundle(bundle).length === 0 }
  }
  const FROM_0 = 'answers numbered from 0'
  const FROM_1 = 'answers numbered from 1'
  const UNSET = (n: number) => `Q${n}: could not work out the correct answer. Set it in the pasted text and paste again.`

  it('counts from 0 when there is a 0 and no 4', () => {
    const result = paste(0, 1, 2, 3)
    expect(result).toMatchObject({ read: [0, 1, 2, 3], warnings: [], ready: true })
    expect(result.changes).toEqual([FROM_0])
  })

  it('counts from 1 when there is a 4 and no 0', () => {
    const result = paste(1, 2, 3, 4)
    expect(result).toMatchObject({ read: [0, 1, 2, 3], warnings: [], ready: true })
    expect(result.changes).toEqual([FROM_1])
  })

  it('reads digits given as text the same way', () => {
    expect(paste('2', ' 0 ', '3')).toMatchObject({ read: [2, 0, 3], changes: [FROM_0] })
    expect(paste('2', 4, '3', ['1'])).toMatchObject({ read: [1, 3, 2, 0], changes: [FROM_1] })
  })

  it.each([
    ['only 1 to 3', [1, 2, 3]],
    ['only 1 to 3, as text', ['1', '2', '3']],
    ['one number', [2]],
    ['both 0 and 4', [0, 1, 4]],
    ['a number past the options', [5]],
    ['a number past the options, as text', ['5']],
    ['a 0 and a number past the options', [0, 7]],
    ['a 4 and a number past the options', [4, 5]],
    ['a negative number', [0, -1]],
    ['a fraction', [0, 1.5]],
  ])('leaves every number unset with %s', (_name, answers) => {
    const result = paste(...answers)
    expect(result.read).toEqual(answers.map(() => null))
    expect(result.warnings).toEqual(answers.map((_, i) => numberUnclearMessage(i + 1)))
    expect(result.changes).toEqual([])
    expect(result.ready).toBe(false)
  })

  it('leaves letters and full text alone', () => {
    expect(paste('A', 'D', 'Option B', 'Three')).toMatchObject({ read: [0, 3, 1, 2], warnings: [], ready: true })
    expect(paste('A', 'D').changes.join()).not.toContain('numbered')
  })

  it('reads letters and numbers in one paste, each by its own rule', () => {
    expect(paste('B', 0, 'Two', 2)).toMatchObject({ read: [1, 0, 1, 2], warnings: [] })
    expect(paste('B', 4, 'Two', 2)).toMatchObject({ read: [1, 3, 1, 1], warnings: [] })
    expect(paste('B', 2, 'Two', 3)).toMatchObject({
      read: [1, null, 1, null],
      warnings: [numberUnclearMessage(2), numberUnclearMessage(4)],
      ready: false,
    })
    expect(paste('E', 2).warnings).toEqual([UNSET(1), numberUnclearMessage(2)])
  })

  it('takes no rule from a question without options to choose from', () => {
    expect(paste(2, { type: 'writing', answer: 0, writingModelAnswer: 'Text.' })).toMatchObject({ read: [null, null] })
    expect(paste(2, { type: 'writing', answer: 99, writingModelAnswer: 'Text.' }, 0)).toMatchObject({ read: [2, null, 0] })
    expect(paste(2, { questionText: '', answer: 0 }).read).toEqual([null])
  })

  it('a number that is one option\'s text is that option, not a position', () => {
    const options = ['100', '1000', '200', '300']
    expect(paste({ options, answer: 200 })).toMatchObject({ read: [2], warnings: [] })
    expect(paste({ options, answer: '1000' }, 0, 3)).toMatchObject({ read: [1, 0, 3], warnings: [] })
    expect(paste({ options: ['1.5', '2.5', '3.5', '4.5'], answer: 2.5 })).toMatchObject({ read: [1], warnings: [] })
  })

  it('a number that may be a text or a position shows no rule, and is set only when both agree', () => {
    const options = ['2', '3', '4', '5']
    expect(paste({ options, answer: 4 }, 2)).toMatchObject({ read: [null, null], changes: [] })
    expect(paste({ options, answer: 2 }, 0)).toMatchObject({ read: [null, 0], warnings: [UNSET(1)] })
    expect(paste({ options, answer: 4 }, 0)).toMatchObject({ read: [null, 0], warnings: [UNSET(1)] })
    expect(paste({ options: ['1', '2', '3', '4'], answer: 3 }, 4)).toMatchObject({ read: [2, 3], warnings: [] })
    expect(paste({ options: ['0', '1', '2', '3'], answer: 3 }, 0)).toMatchObject({ read: [3, 0], warnings: [] })
  })

  it('a 4 from five options shows no rule', () => {
    const five = { options: ['One', 'Two', 'Three', 'Four', 'Five'], answer: 4 }
    expect(paste(five, 2).read).toEqual([null, null])
    expect(paste({ ...five, options: { a: 'One', b: 'Two', c: 'Three', d: 'Four', e: 'Five' } }, 2).read).toEqual([null, null])
  })

  it('is the same for a plain list, and for several sets in one paste', () => {
    const q = (answer: unknown) => question({ correctIndex: undefined, answer })
    const answers = (raw: unknown) => normalise(raw).bundle.questions.map((x) => x.correctIndex)
    expect(answers([q(0), q(2)])).toEqual([0, 2])
    expect(answers(JSON.stringify([q(4), q(2)]))).toEqual([3, 1])
    expect(answers([{ questions: [q(2)] }, { questions: [q(4)] }])).toEqual([1, 3])
  })
})
