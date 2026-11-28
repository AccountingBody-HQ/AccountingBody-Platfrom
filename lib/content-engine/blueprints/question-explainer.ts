// Question explainer: a teaching explanation of one given question. From the
// content generator's Practice Question Explainer structure.
import type { Blueprint } from '../types'

export const QUESTION_EXPLAINER: Blueprint = {
  id: 'question-explainer',
  version: '1.0.0',
  contentTypes: ['question-explainer'],
  purpose: 'A detailed explanation of how to approach and answer the given practice question, with the reasoning, the model answer and marking commentary, so a student can answer any question of this type.',
  output: 'explainer',
  sections: [],
  totalWords: { min: 400, max: 900 },
  rules: [
    'Explain the question given in the brief; do not write a new question.',
    'Cover, in this order: what this question type tests and why it appears; how to read and plan the answer; the model answer with full workings (calculation or journal_entry blocks for numbers); why each wrong option is wrong, named by its content; common errors on this question type (common_mistake blocks); practice tips; one key_point that the student should remember.',
    'Use heading blocks (level 2) to separate the parts.',
  ],
}
