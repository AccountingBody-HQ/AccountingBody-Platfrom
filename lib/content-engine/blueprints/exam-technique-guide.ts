// Exam technique guide. From the content generator's Exam Technique Guide
// structure.
import type { Blueprint } from '../types'
import { section } from './section'

export const EXAM_TECHNIQUE_GUIDE: Blueprint = {
  id: 'exam-technique-guide',
  version: '1.0.0',
  contentTypes: ['exam-technique-guide'],
  purpose: 'A practical, specific guide to maximising marks on a particular type of professional accounting examination or question. Must go beyond generic advice into the specific mechanics of how professional examinations reward and penalise candidates.',
  output: 'document',
  sections: [
    section('examination-in-context', 'The examination in context', 'What the examiner is testing at this level, what the paper structure demands, how time should be allocated across the paper.', [100, 200], ['paragraph']),
    section('what-markers-look-for', 'What markers actually look for', 'Specific marking criteria at professional level, how marks are allocated, opportunities candidates miss, what distinguishes a pass from a distinction.', [120, 250], ['paragraph']),
    section('question-approach', 'Question approach', 'A step-by-step method for approaching questions at this level, with a worked example demonstrating the approach on an invented scenario.', [150, 300], ['worked_example']),
    section('time-management', 'Time management strategy', 'Specific time allocation, what to do when stuck, when to move on and return, what to do in the final ten minutes.', [100, 200], ['list']),
    section('common-mistakes', 'Common mistakes that cost marks', 'Specific, named errors candidates make — not generic cautions. Each mistake must name the error precisely and explain why it costs marks.', [120, 250], ['common_mistake']),
    section('passing-vs-excelling', 'The difference between passing and excelling', 'What specifically separates a marginal pass from a strong pass at this level — concrete and actionable.', [100, 200], ['paragraph']),
    section('final-checklist', 'Final examination checklist', '8-10 actionable points to apply in the examination room.', [60, 180], ['list']),
  ],
  totalWords: { min: 950, max: 1600 },
  rules: [
    'Write for the level described; never name an examining body or a paper code.',
    'The final checklist is one list block with 8-10 items.',
  ],
}
