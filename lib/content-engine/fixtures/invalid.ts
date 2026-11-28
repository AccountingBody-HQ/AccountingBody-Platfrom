// One invalid fixture per check: each starts from a valid answer and breaks
// exactly one rule. Every text is invented.
import { compilePrompt, isCompiled } from '../compiler'
import type { CheckId, CompiledPrompt, DocumentOutput, QuestionSetOutput } from '../types'
import { ARTICLE_BRIEF, EXPLAINER_BRIEF, QUESTION_SET_BRIEF, TAX_GUIDE_BRIEF } from './briefs'
import { documentOutput, explainerOutput, prose, questionSetOutput } from './outputs'

export function mustCompile(brief: unknown): CompiledPrompt {
  const result = compilePrompt(brief)
  if (!isCompiled(result)) throw new Error('fixture brief did not compile')
  return result
}

export const ARTICLE = mustCompile(ARTICLE_BRIEF)
export const TAX = mustCompile(TAX_GUIDE_BRIEF)
export const QUESTIONS = mustCompile(QUESTION_SET_BRIEF)
export const EXPLAINER = mustCompile(EXPLAINER_BRIEF)

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

function article(change: (o: DocumentOutput) => void): DocumentOutput {
  const o = clone(documentOutput(ARTICLE))
  change(o)
  return o
}

function questions(change: (o: QuestionSetOutput) => void): QuestionSetOutput {
  const o = clone(questionSetOutput(QUESTIONS))
  change(o)
  return o
}

function firstParagraph(o: DocumentOutput, sectionId: string): { text: string } {
  const section = o.document.sections.find(s => s.id === sectionId)
  const block = section?.blocks.find(b => b.type === 'paragraph')
  if (!block || block.type !== 'paragraph') throw new Error('fixture has no paragraph')
  return block
}

export interface InvalidFixture {
  check: CheckId
  compiled: CompiledPrompt
  raw: unknown
  severity: 'error' | 'warning' | 'info'
}

export const INVALID_FIXTURES: InvalidFixture[] = [
  { check: 'parse.json', compiled: ARTICLE, severity: 'error', raw: 'Sorry, I cannot help with that.' },
  { check: 'parse.cleaned', compiled: ARTICLE, severity: 'info', raw: '```json\n' + JSON.stringify(documentOutput(ARTICLE)) + '\n```' },
  { check: 'envelope.engine', compiled: ARTICLE, severity: 'error', raw: article(o => { (o as { engine: string }).engine = 'another-engine' }) },
  { check: 'envelope.prompt', compiled: ARTICLE, severity: 'error', raw: article(o => { o.promptId = '0000000000000000' }) },
  { check: 'envelope.blueprint', compiled: ARTICLE, severity: 'error', raw: article(o => { o.contentType = 'study-note' }) },
  { check: 'envelope.fields', compiled: ARTICLE, severity: 'error', raw: article(o => { delete (o as Partial<DocumentOutput>).title }) },
  { check: 'structure.sections', compiled: ARTICLE, severity: 'error', raw: article(o => { o.document.sections = o.document.sections.filter(s => s.id !== 'conclusion') }) },
  { check: 'blocks.shape', compiled: ARTICLE, severity: 'error', raw: article(o => { (o.document.sections[0].blocks as unknown[]).push({ type: 'video', url: 'x' }) }) },
  { check: 'blocks.markup', compiled: ARTICLE, severity: 'error', raw: article(o => { o.document.sections[0].blocks.push({ type: 'key_point', text: 'Use a <b> tag.' }) }) },
  {
    check: 'blocks.journal', compiled: ARTICLE, severity: 'error', raw: article(o => {
      o.document.sections[0].blocks.push({ type: 'journal_entry', title: 'Unbalanced', lines: [{ account: 'Expense', debit: 100, credit: null }, { account: 'Accruals', debit: null, credit: 90 }] })
    }),
  },
  {
    check: 'blocks.required', compiled: ARTICLE, severity: 'error', raw: article(o => {
      const section = o.document.sections.find(s => s.id === 'common-misconceptions')
      if (!section) return
      section.blocks = section.blocks.map(b => (b.type === 'common_mistake' ? { type: 'key_point', text: `${b.mistake} ${b.correction}` } : b))
    }),
  },
  {
    check: 'words.section', compiled: ARTICLE, severity: 'warning', raw: article(o => {
      const conclusion = o.document.sections.find(s => s.id === 'conclusion')
      conclusion?.blocks.push({ type: 'paragraph', text: prose(100, 3) })
    }),
  },
  { check: 'words.total', compiled: EXPLAINER, severity: 'error', raw: explainerOutput(EXPLAINER, 250) },
  { check: 'links.internal', compiled: ARTICLE, severity: 'error', raw: article(o => { const p = firstParagraph(o, 'introduction'); p.text += ' See /study/made-up-page for more.' }) },
  { check: 'body.names', compiled: ARTICLE, severity: 'error', raw: article(o => { const p = firstParagraph(o, 'introduction'); p.text += ' Useful for ACCA students.' }) },
  { check: 'tax.validAsAt', compiled: TAX, severity: 'error', raw: (() => { const o = clone(documentOutput(TAX)); o.validAsAt = null; return o })() },
  { check: 'dup.title', compiled: ARTICLE, severity: 'error', raw: article(o => { o.title = '  Accruals  Explained simply ' }) },
  { check: 'coverage.source', compiled: ARTICLE, severity: 'error', raw: article(o => { o.sourceSectionsCovered = ['s0', 's1', 's2'] }) },
  { check: 'style.forbidden', compiled: ARTICLE, severity: 'warning', raw: article(o => { const p = firstParagraph(o, 'introduction'); p.text += ' It is worth noting that costs vary.' }) },
  { check: 'q.count', compiled: QUESTIONS, severity: 'error', raw: questions(o => { o.questionSet.questions.pop() }) },
  { check: 'q.shape', compiled: QUESTIONS, severity: 'error', raw: questions(o => { (o.questionSet.questions[0] as { caseId: string | null }).caseId = 'case-1' }) },
  { check: 'q.options', compiled: QUESTIONS, severity: 'error', raw: questions(o => { const q = o.questionSet.questions[0]; q.options[3] = q.options[1] }) },
  { check: 'q.banned', compiled: QUESTIONS, severity: 'error', raw: questions(o => { const q = o.questionSet.questions[0]; q.options[3] = 'None of the above.' }) },
  { check: 'q.answer', compiled: QUESTIONS, severity: 'error', raw: questions(o => { o.questionSet.questions[1].correctIndex = 4 }) },
  { check: 'q.balance', compiled: QUESTIONS, severity: 'warning', raw: questions(o => { for (let i = 0; i < 5; i++) o.questionSet.questions[i].correctIndex = 0 }) },
  { check: 'q.letterRefs', compiled: QUESTIONS, severity: 'error', raw: questions(o => { const q = o.questionSet.questions[0]; q.explanation = q.explanation.replace('Remember:', 'Option B is wrong. Remember:') }) },
  { check: 'q.explanation', compiled: QUESTIONS, severity: 'error', raw: questions(o => { const q = o.questionSet.questions[0]; q.explanation = q.explanation.split(' Remember:')[0] + ' That is the rule.' }) },
  { check: 'q.dupStem', compiled: QUESTIONS, severity: 'error', raw: questions(o => { o.questionSet.questions[1].questionText = o.questionSet.questions[0].questionText }) },
  { check: 'q.source', compiled: QUESTIONS, severity: 'error', raw: questions(o => { o.questionSet.questions[0].sourceSection = 's9' }) },
]
