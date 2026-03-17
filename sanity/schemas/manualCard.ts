import { defineField, defineType } from 'sanity'
export default defineType({
  name: 'manualCard', title: 'Manual Card', type: 'document',
  description: 'Migrated from the ab_card custom post type in WordPress.',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'linkUrl', title: 'Link URL', type: 'url' }),
    defineField({ name: 'fontAwesomeIcon', title: 'Font Awesome Icon', type: 'string', description: 'e.g. fa-solid fa-book' }),
    defineField({ name: 'pinToTop', title: 'Pin to Top', type: 'boolean', initialValue: false }),
    defineField({ name: 'order', title: 'Display Order', type: 'number' }),
  ],
  preview: {
    select: { title: 'title', icon: 'fontAwesomeIcon', pin: 'pinToTop', order: 'order' },
    prepare({ title, icon, pin, order }: any) { return { title, subtitle: [icon, order != null ? `#${order}` : null, pin ? '📌 Pinned' : null].filter(Boolean).join(' · ') } },
  },
})
