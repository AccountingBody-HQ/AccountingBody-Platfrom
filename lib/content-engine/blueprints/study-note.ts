// Study note: taught from first principles. From the content generator's
// Study Note structure.
import type { Blueprint } from '../types'
import { section } from './section'

export const STUDY_NOTE: Blueprint = {
  id: 'study-note',
  version: '1.0.0',
  contentTypes: ['study-note'],
  purpose: 'A precise, well-structured study note that takes a student from unfamiliar to exam-confident on a specific accounting or finance topic. Must be the definitive study resource on this topic — richer than a textbook summary, more practical than a flashcard, more insightful than a revision guide.',
  output: 'document',
  sections: [
    section('topic-overview', 'Topic overview', 'What this topic covers, why it matters in professional practice and in examinations, what level of study it belongs to.', [80, 150], ['paragraph']),
    section('core-concepts', 'Core concepts and definitions', 'Key terms defined precisely in teaching language, never in legislative or standards-body drafting style.', [120, 250], ['definition']),
    section('mechanics', 'The mechanics', 'How it works step by step with clear logical flow, building from foundation to complexity.', [150, 300], ['paragraph']),
    section('worked-example', 'Worked example', 'A full worked example using an invented company with a realistic name, specific invented figures (never round numbers), and a realistic scenario. Show all workings clearly; use a journal entry block for any double entry.', [150, 350], ['worked_example']),
    section('key-pitfalls', 'Key judgements and common pitfalls', 'Where students go wrong, named specifically, and why — not generic cautions.', [120, 250], ['common_mistake']),
    section('exam-technique', 'Exam technique', 'Specific advice for how this topic is typically examined at professional level, what markers look for, how to maximise marks, time management for this topic type. End with a question the student can use to check their understanding.', [100, 200], ['exam_tip', 'check_understanding']),
    section('key-points', 'Key points to remember', 'Points a student can act on immediately before an examination.', [60, 160], ['takeaway']),
  ],
  totalWords: { min: 950, max: 1600 },
  rules: [
    'Teach from first principles: define each term before using it.',
    'Include at least one worked_example block (in the worked example section), at least one check_understanding block and one takeaway block.',
    'The key points takeaway block has 6 or 7 points (a takeaway block holds at most 7).',
  ],
}
