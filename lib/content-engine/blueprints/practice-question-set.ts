// Practice question set: multiple-choice questions drawn from a source note,
// in the question shape the site already accepts. From the Studio question
// standard and the question generator.
import type { Blueprint } from '../types'

export const PRACTICE_QUESTION_SET: Blueprint = {
  id: 'practice-question-set',
  version: '1.0.0',
  contentTypes: ['practice-question-set'],
  purpose: 'A set of original, exam-standard multiple-choice questions based on the source note, each testing application rather than recall, with a full teaching explanation.',
  output: 'questionSet',
  sections: [],
  totalWords: { min: 0, max: 0 },
  rules: [
    'Write exactly the number of questions the OUTPUT section asks for, with ids q1, q2, … in order.',
    'Every question is multiple-choice with exactly 4 options and one correct answer; correctIndex is the 0-based position (0, 1, 2 or 3) of the correct option.',
    'Tie every question to one source section: its "sourceSection" is that section id. Cover every source section of 40 words or more.',
    'Every explanation has the five components of the Studio standard (correct answer reasoning, wrong option analysis, underlying concept, standard reference, learning takeaway) and is 120-300 words of prose.',
    'The last sentence of every explanation starts with "Remember:".',
    'writingModelAnswer, writingExplanation and caseId are always null; type is always "multiple-choice".',
  ],
}
