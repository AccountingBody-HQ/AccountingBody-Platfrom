import { defineField, defineArrayMember } from 'sanity'

const quizQuestionObject = defineArrayMember({
  type: 'object',
  name: 'quizQuestion',
  title: 'Quiz Question',
  fields: [
    defineField({ name: 'id', title: 'ID', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({
      name: 'type', title: 'Question Type', type: 'string',
      options: { list: [{ title: 'Multiple Choice', value: 'multiple-choice' }, { title: 'Writing', value: 'writing' }, { title: 'Scenario', value: 'scenario' }], layout: 'radio' },
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: 'questionText', title: 'Question Text', type: 'text', rows: 4, validation: (Rule) => Rule.required() }),
    defineField({ name: 'options', title: 'Answer Options', type: 'array', description: 'Multiple-choice only.', of: [{ type: 'string' }] }),
    defineField({ name: 'correctIndex', title: 'Correct Answer Index', type: 'number', description: 'Zero-based index of the correct option. Multiple-choice only.' }),
    defineField({ name: 'explanation', title: 'Explanation', type: 'text', rows: 4 }),
    defineField({ name: 'writingModelAnswer', title: 'Model Answer', type: 'text', rows: 6, description: 'Writing type only.' }),
    defineField({ name: 'writingExplanation', title: 'Writing Explanation', type: 'text', rows: 4, description: 'Writing type only.' }),
    defineField({ name: 'caseId', title: 'Case ID', type: 'string', description: 'Scenario type only — links to a case exhibit.' }),
    defineField({ name: 'primaryTopic', title: 'Primary Topic', type: 'string' }),
    defineField({ name: 'difficulty', title: 'Difficulty', type: 'string', options: { list: [{ title: 'Beginner', value: 'beginner' }, { title: 'Intermediate', value: 'intermediate' }, { title: 'Advanced', value: 'advanced' }] } }),
    defineField({ name: 'timeTargetMinutes', title: 'Time Target (minutes)', type: 'number' }),
    defineField({ name: 'points', title: 'Points', type: 'number', initialValue: 1 }),
  ],
  preview: {
    select: { id: 'id', type: 'type', text: 'questionText' },
    prepare({ id, type, text }: any) { return { title: `[${id ?? '?'}] ${text ?? 'Untitled question'}`, subtitle: type } },
  },
})

const scenarioCaseObject = defineArrayMember({
  type: 'object',
  name: 'scenarioCase',
  title: 'Scenario Case',
  fields: [
    defineField({ name: 'caseId', title: 'Case ID', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'title', title: 'Case Title', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'exhibitHtml', title: 'Exhibit HTML', type: 'text', rows: 10 }),
  ],
  preview: {
    select: { caseId: 'caseId', title: 'title' },
    prepare({ caseId, title }: any) { return { title: `[${caseId ?? '?'}] ${title ?? 'Untitled case'}` } },
  },
})

export const quizQuestionField = defineField({
  name: 'quizQuestions', title: 'Quiz Questions', type: 'array', group: 'quiz', of: [quizQuestionObject],
})

export const scenarioCasesField = defineField({
  name: 'cases', title: 'Scenario Cases', type: 'array', group: 'quiz',
  description: 'Case exhibits for scenario-type questions.', of: [scenarioCaseObject],
})