import { defineField, defineType } from 'sanity'
export default defineType({
  name: 'course', title: 'Course', type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'slug', title: 'Slug', type: 'slug', options: { source: 'title', maxLength: 200 }, validation: (Rule) => Rule.required() }),
    defineField({ name: 'description', title: 'Description', type: 'text', rows: 4 }),
    defineField({ name: 'level', title: 'Level', type: 'string', options: { list: [{ title: 'Beginner', value: 'beginner' }, { title: 'Intermediate', value: 'intermediate' }, { title: 'Advanced', value: 'advanced' }], layout: 'radio' } }),
    defineField({ name: 'category', title: 'Category', type: 'reference', to: [{ type: 'category' }] }),
    defineField({ name: 'thumbnail', title: 'Thumbnail', type: 'image', options: { hotspot: true }, fields: [defineField({ name: 'alt', title: 'Alt Text', type: 'string' })] }),
    defineField({ name: 'courseOrder', title: 'Course Order', type: 'number' }),
    defineField({ name: 'lessons', title: 'Lessons', type: 'array', of: [{ type: 'reference', to: [{ type: 'lesson' }] }] }),
  ],
  preview: {
    select: { title: 'title', level: 'level', media: 'thumbnail', lessons: 'lessons' },
    prepare({ title, level, media, lessons }: any) { return { title, subtitle: `${level ?? '—'} · ${Array.isArray(lessons) ? lessons.length : 0} lessons`, media } },
  },
})
