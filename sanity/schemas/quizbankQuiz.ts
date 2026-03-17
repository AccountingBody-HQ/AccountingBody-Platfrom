import { defineField, defineType } from 'sanity'
import { quizQuestionField, scenarioCasesField } from './_quizFields'
export default defineType({
  name: 'quizbankQuiz', title: 'QuizBank Quiz', type: 'document',
  groups: [{ name: 'settings', title: 'Quiz Settings' }, { name: 'quiz', title: 'Questions' }],
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string', group: 'settings', validation: (Rule) => Rule.required() }),
    defineField({ name: 'slug', title: 'Slug', type: 'slug', group: 'settings', options: { source: 'title', maxLength: 200 }, validation: (Rule) => Rule.required() }),
    defineField({ name: 'showTimer', title: 'Show Timer', type: 'boolean', group: 'settings', initialValue: true }),
    defineField({ name: 'showMap', title: 'Show Question Map', type: 'boolean', group: 'settings', initialValue: true }),
    defineField({ name: 'theme', title: 'Theme', type: 'string', group: 'settings', options: { list: [{ title: 'Light', value: 'light' }, { title: 'Dark', value: 'dark' }], layout: 'radio' }, initialValue: 'light' }),
    scenarioCasesField,
    quizQuestionField,
  ],
  preview: {
    select: { title: 'title', theme: 'theme', questions: 'quizQuestions' },
    prepare({ title, theme, questions }: any) { const count = Array.isArray(questions) ? questions.length : 0; return { title, subtitle: `${count} question${count !== 1 ? 's' : ''} · ${theme ?? 'light'}` } },
  },
})
