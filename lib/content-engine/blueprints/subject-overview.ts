// Subject overview: the starting point for a whole subject. From the content
// generator's Subject Overview structure, plus a related-notes section.
import type { Blueprint } from '../types'
import { section } from './section'

export const SUBJECT_OVERVIEW: Blueprint = {
  id: 'subject-overview',
  version: '1.0.0',
  contentTypes: ['subject-overview'],
  purpose: 'A comprehensive, structured overview of an entire accounting or finance subject area. Must function as the definitive starting point for a student or professional beginning structured study of this subject.',
  output: 'document',
  sections: [
    section('subject-introduction', 'Subject introduction', 'What this subject covers, its importance in professional practice, how it fits within the broader accounting and finance profession.', [100, 200], ['paragraph']),
    section('core-topic-areas', 'Core topic areas', 'The main areas within this subject with a substantive description of each, including why each matters.', [150, 300], ['list']),
    section('key-standards', 'Key standards and frameworks', 'The principal standards, frameworks, or regulations that govern this subject area (named by reference, never reproduced).', [100, 250], ['list']),
    section('difficulty-challenges', 'Difficulty and common challenges', 'Where students and professionals typically struggle, why, and what that means for study approach.', [100, 200], ['common_mistake']),
    section('study-approach', 'Study approach', 'Recommended study sequence, how to allocate time, how to balance conceptual understanding with technical application.', [100, 200], ['list']),
    section('priority-topics', 'Priority topics', 'The highest-value areas based on professional practice importance and examination focus.', [80, 200], ['list']),
    section('connections', 'How this subject connects to others', 'The relationships between this subject and adjacent areas in professional accounting and finance.', [80, 200], ['paragraph']),
    section('related-notes', 'Related notes', 'A list of the related notes given in the brief: each item names the note and gives its path exactly as given.', [10, 300], ['list'], true),
  ],
  totalWords: { min: 950, max: 1600 },
  rules: [
    'When the brief lists related notes, the related-notes section is required and lists every one of them, each with its path exactly as given.',
    'Link only to the related notes paths given in the brief; never invent an internal path.',
  ],
}
