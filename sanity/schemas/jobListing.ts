import { defineField, defineType } from 'sanity'
export default defineType({
  name: 'jobListing', title: 'Job Listing', type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Job Title', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'slug', title: 'Slug', type: 'slug', options: { source: 'title', maxLength: 200 }, validation: (Rule) => Rule.required() }),
    defineField({ name: 'company', title: 'Company Name', type: 'string' }),
    defineField({ name: 'location', title: 'Location', type: 'string' }),
    defineField({ name: 'jobType', title: 'Job Type', type: 'string', options: { list: [{ title: 'Full-Time', value: 'full-time' }, { title: 'Part-Time', value: 'part-time' }, { title: 'Contract', value: 'contract' }, { title: 'Freelance', value: 'freelance' }, { title: 'Internship', value: 'internship' }] } }),
    defineField({ name: 'salaryRange', title: 'Salary Range', type: 'string' }),
    defineField({ name: 'description', title: 'Job Description', type: 'array', of: [{ type: 'block' }] }),
    defineField({ name: 'applyUrl', title: 'Apply URL', type: 'url' }),
    defineField({ name: 'publishedAt', title: 'Published At', type: 'datetime' }),
    defineField({ name: 'expiresAt', title: 'Expires At', type: 'datetime' }),
    defineField({ name: 'categories', title: 'Categories', type: 'array', of: [{ type: 'reference', to: [{ type: 'category' }] }] }),
    defineField({ name: 'featuredListing', title: 'Featured Listing', type: 'boolean', initialValue: false }),
  ],
  preview: {
    select: { title: 'title', company: 'company', jobType: 'jobType', featured: 'featuredListing' },
    prepare({ title, company, jobType, featured }: any) { return { title, subtitle: [company, jobType, featured ? '⭐ Featured' : null].filter(Boolean).join(' · ') } },
  },
})
