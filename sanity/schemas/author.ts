import { defineField, defineType } from 'sanity'
export default defineType({
  name: 'author', title: 'Author', type: 'document',
  fields: [
    defineField({ name: 'name', title: 'Name', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'slug', title: 'Slug', type: 'slug', options: { source: 'name', maxLength: 100 }, validation: (Rule) => Rule.required() }),
    defineField({ name: 'photo', title: 'Photo', type: 'image', options: { hotspot: true }, fields: [defineField({ name: 'alt', title: 'Alt Text', type: 'string' })] }),
    defineField({ name: 'bio', title: 'Bio', type: 'text', rows: 4 }),
    defineField({ name: 'jobTitle', title: 'Job Title', type: 'string' }),
    defineField({ name: 'linkedinUrl', title: 'LinkedIn URL', type: 'url' }),
    defineField({ name: 'websiteUrl', title: 'Website URL', type: 'url' }),
  ],
  preview: { select: { title: 'name', subtitle: 'jobTitle', media: 'photo' } },
})
