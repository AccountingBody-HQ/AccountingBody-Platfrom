import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'course',
  title: 'Course',
  type: 'document',
  groups: [
    { name: 'core',     title: 'Course Details' },
    { name: 'content',  title: 'Chapters & Lessons' },
    { name: 'settings', title: 'Settings & SEO' },
  ],
  fields: [
    // ── Core ──────────────────────────────────────────────────────
    defineField({
      name: 'title',
      title: 'Course Title',
      type: 'string',
      group: 'core',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      group: 'core',
      options: { source: 'title', maxLength: 200 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Course Description',
      type: 'text',
      rows: 5,
      group: 'core',
    }),
    defineField({
      name: 'level',
      title: 'Level',
      type: 'string',
      group: 'core',
      options: {
        list: [
          { title: 'Beginner',     value: 'beginner'     },
          { title: 'Intermediate', value: 'intermediate' },
          { title: 'Advanced',     value: 'advanced'     },
        ],
        layout: 'radio',
      },
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'reference',
      group: 'core',
      to: [{ type: 'category' }],
    }),
    defineField({
      name: 'featuredImage',
      title: 'Course Banner Image',
      type: 'image',
      group: 'core',
      options: { hotspot: true },
      fields: [
        defineField({ name: 'alt', title: 'Alt Text', type: 'string' }),
      ],
    }),

    // ── Chapters & Lessons ────────────────────────────────────────
    defineField({
      name: 'chapters',
      title: 'Chapters',
      type: 'array',
      group: 'content',
      of: [
        {
          type: 'object',
          name: 'chapter',
          title: 'Chapter',
          fields: [
            defineField({
              name: 'chapterTitle',
              title: 'Chapter Title',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'chapterOrder',
              title: 'Chapter Order',
              type: 'number',
            }),
            defineField({
              name: 'lessons',
              title: 'Lessons',
              type: 'array',
              of: [{ type: 'reference', to: [{ type: 'lesson' }] }],
            }),
          ],
          preview: {
            select: { title: 'chapterTitle', lessons: 'lessons' },
            prepare({ title, lessons }: any) {
              return {
                title,
                subtitle: `${Array.isArray(lessons) ? lessons.length : 0} lessons`,
              }
            },
          },
        },
      ],
    }),

    // ── Settings & SEO ────────────────────────────────────────────
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      group: 'settings',
      options: {
        list: [
          { title: 'Draft',     value: 'draft'     },
          { title: 'Published', value: 'published' },
          { title: 'Archived',  value: 'archived'  },
        ],
        layout: 'radio',
      },
      initialValue: 'draft',
    }),
    defineField({
      name: 'isFeatured',
      title: 'Featured Course',
      type: 'boolean',
      group: 'settings',
      description: 'Pin this course to the homepage featured section.',
      initialValue: false,
    }),
    defineField({
      name: 'showOnSites',
      title: 'Show On Sites',
      type: 'array',
      group: 'settings',
      of: [{ type: 'string' }],
      options: {
        list: [
          { title: 'Accounting Body', value: 'accountingbody' },
          { title: 'EthioTax',        value: 'ethiotax'       },
        ],
      },
      initialValue: ['accountingbody'],
    }),
    defineField({
      name: 'courseOrder',
      title: 'Course Order',
      type: 'number',
      group: 'settings',
      description: 'Controls display order on the courses catalogue page.',
    }),
    defineField({
      name: 'metaDescription',
      title: 'Meta Description (SEO)',
      type: 'text',
      rows: 3,
      group: 'settings',
      description: 'If blank, falls back to the course description.',
    }),
  ],

  preview: {
    select: { title: 'title', level: 'level', media: 'featuredImage', status: 'status' },
    prepare({ title, level, media, status }: any) {
      return {
        title,
        subtitle: [level ?? '—', status ?? 'draft'].join(' · '),
        media,
      }
    },
  },
})
