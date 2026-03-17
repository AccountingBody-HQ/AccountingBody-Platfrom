import { defineField, defineType } from 'sanity'
import { quizQuestionField } from './_quizFields'
export default defineType({
  name: 'lesson', title: 'Lesson', type: 'document',
  groups: [{ name: 'content', title: 'Content' }, { name: 'media', title: 'Media' }, { name: 'quiz', title: 'Lesson Quiz' }],
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string', group: 'content', validation: (Rule) => Rule.required() }),
    defineField({ name: 'slug', title: 'Slug', type: 'slug', group: 'content', options: { source: 'title', maxLength: 200 }, validation: (Rule) => Rule.required() }),
    defineField({ name: 'parentCourse', title: 'Parent Course', type: 'reference', group: 'content', to: [{ type: 'course' }] }),
    defineField({ name: 'order', title: 'Order', type: 'number', group: 'content' }),
    defineField({ name: 'estimatedTime', title: 'Estimated Time (minutes)', type: 'number', group: 'content' }),
    defineField({ name: 'linkedArticles', title: 'Linked Articles', type: 'array', group: 'content', of: [{ type: 'reference', to: [{ type: 'article' }] }] }),
    defineField({ name: 'videoUrl', title: 'Video URL', type: 'url', group: 'media' }),
    defineField({ name: 'audioUrl', title: 'Audio URL', type: 'url', group: 'media' }),
    defineField({ name: 'externalQuizUrl', title: 'External Quiz URL', type: 'url', group: 'media' }),
    quizQuestionField,
  ],
  preview: {
    select: { title: 'title', course: 'parentCourse.title', order: 'order' },
    prepare({ title, course, order }: any) { return { title, subtitle: [course, order != null ? `#${order}` : null].filter(Boolean).join(' · ') } },
  },
})
