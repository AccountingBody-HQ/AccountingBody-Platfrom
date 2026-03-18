import { defineField, defineType } from 'sanity'

export default defineType({
  name:  'quizbankBlock',
  title: 'QuizBank Quiz',
  type:  'object',
  fields: [
    defineField({
      name:        'quiz',
      title:       'Quiz',
      type:        'reference',
      to:          [{ type: 'quizbankQuiz' }],
      validation:  (Rule) => Rule.required(),
      description: 'Select the QuizBank quiz to embed at this point in the article.',
    }),
  ],
  preview: {
    select: { title: 'quiz.title', theme: 'quiz.theme', count: 'quiz.quizQuestions' },
    prepare({ title, theme, count }: any) {
      const n = Array.isArray(count) ? count.length : 0
      return {
        title:    title ?? 'Quiz (not selected)',
        subtitle: `${n} question${n !== 1 ? 's' : ''} · ${theme ?? 'light'} theme`,
        media: () => null,
      }
    },
  },
})
