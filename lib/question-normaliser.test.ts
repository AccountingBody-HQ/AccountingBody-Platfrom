import { describe, expect, it } from 'vitest'
import { normalise } from './question-normaliser'

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
