// Fixture briefs: one per blueprint, plus the tax-guide preset. Every topic,
// company and source note here is invented for tests.
import type { Brief } from '../types'

export const SOURCE_HTML = [
  '<p>Hollin Brook Pottery makes glazed tiles in a single workshop.</p>',
  '<h2>Why accruals matter</h2>',
  '<p>An accrual records a cost in the period in which the business used the goods or the service, even when the supplier has not yet sent an invoice. Without it the profit for the period is overstated and the liabilities in the statement of financial position are understated, so the accounts no longer show what the business owes.</p>',
  '<h2>Estimating the amount</h2>',
  '<p>The amount is usually estimated from a meter reading, a contract rate or the pattern of earlier invoices. The estimate should be reasonable and supported by evidence that a reviewer could follow. When the invoice later arrives, any difference between the estimate and the invoice is a change in estimate for the new period.</p>',
  '<ul><li>Meter readings at the year end</li><li>Contract rates for services</li></ul>',
  '<h2>Reversing the accrual</h2>',
  '<p>At the start of the next period the accrual is reversed, so that the invoice can be posted in the normal way without counting the cost twice. A business that forgets the reversal reports the same cost in two periods, which depresses the second period profit by the full amount of the original accrual.</p>',
].join('\n')

export const SOURCE = {
  contentId: 'fixture-source-1',
  title: 'Accruals at a small manufacturer',
  slug: 'accruals-at-a-small-manufacturer',
  html: SOURCE_HTML,
}

export const ARTICLE_BRIEF: Brief = {
  contentType: 'article',
  topic: 'Accrued expenses at a small manufacturer',
  level: 'aat',
  subject: 'financial-accounting',
  jurisdiction: 'uk-ifrs',
  difficulty: 'intermediate',
  source: SOURCE,
  avoidTitles: ['Accruals explained simply'],
}

export const STUDY_NOTE_BRIEF: Brief = {
  contentType: 'study-note',
  topic: 'Recording and reversing accruals',
  level: 'acca',
  subject: 'financial-accounting',
  jurisdiction: 'uk-ifrs',
  difficulty: 'beginner',
  source: SOURCE,
}

export const EXAM_TECHNIQUE_BRIEF: Brief = {
  contentType: 'exam-technique-guide',
  topic: 'Answering variance analysis questions under time pressure',
  level: 'cima',
  subject: 'management-accounting',
  jurisdiction: 'uk-ifrs',
  difficulty: 'intermediate',
}

export const QUESTION_SET_BRIEF: Brief = {
  contentType: 'practice-question-set',
  topic: 'Accruals at a small manufacturer',
  level: 'aat',
  subject: 'financial-accounting',
  jurisdiction: 'uk-ifrs',
  difficulty: 'intermediate',
  source: SOURCE,
  questionCount: 10,
}

export const EXPLAINER_BRIEF: Brief = {
  contentType: 'question-explainer',
  topic: 'An accrual for an unbilled electricity charge',
  level: 'aat',
  subject: 'financial-accounting',
  jurisdiction: 'uk-ifrs',
  difficulty: 'beginner',
  question: {
    questionText: 'Hollin Brook Pottery used electricity costing £2,317 in its final month, but the invoice arrives after the year end. What entry records this at the year end?',
    options: [
      'Debit electricity expense £2,317 and credit accruals £2,317',
      'Debit accruals £2,317 and credit electricity expense £2,317',
      'Debit prepayments £2,317 and credit electricity expense £2,317',
      'No entry until the invoice arrives',
    ],
    correctIndex: 0,
    explanation: 'The cost belongs to the year in which the electricity was used.',
  },
}

export const SUBJECT_OVERVIEW_BRIEF: Brief = {
  contentType: 'subject-overview',
  topic: 'Introduction to accounting for small Ethiopian businesses',
  level: 'eticpa-atq',
  subject: 'financial-accounting',
  jurisdiction: 'ethiopia',
  difficulty: 'beginner',
  eticpa: { level: 'level-1', module: 'introduction-to-accounting' },
  relatedNotes: [
    { title: 'Invented note one', slug: 'invented-note-one', path: '/study/invented-note-one' },
    { title: 'Invented note two', slug: 'invented-note-two', path: '/study/invented-note-two' },
  ],
}

export const ACCOUNTING_GUIDE_BRIEF: Brief = {
  contentType: 'accounting-guide',
  topic: 'Accruals and the matching of costs to periods',
  level: 'icaew',
  subject: 'financial-accounting',
  jurisdiction: 'uk-ifrs',
  difficulty: 'advanced',
  source: SOURCE,
}

export const TAX_GUIDE_BRIEF: Brief = {
  contentType: 'tax-guide',
  topic: 'Timing of deductions for accrued expenses',
  level: 'icaew',
  subject: 'taxation',
  jurisdiction: 'uk-ifrs',
  difficulty: 'intermediate',
  validAsAt: '2026-04-06',
}

/** One brief per blueprint, then the tax-guide preset. */
export const FIXTURE_BRIEFS: readonly [string, Brief][] = [
  ['article', ARTICLE_BRIEF],
  ['study-note', STUDY_NOTE_BRIEF],
  ['exam-technique-guide', EXAM_TECHNIQUE_BRIEF],
  ['practice-question-set', QUESTION_SET_BRIEF],
  ['question-explainer', EXPLAINER_BRIEF],
  ['subject-overview', SUBJECT_OVERVIEW_BRIEF],
  ['topic-guide', ACCOUNTING_GUIDE_BRIEF],
  ['topic-guide (tax-guide)', TAX_GUIDE_BRIEF],
]
