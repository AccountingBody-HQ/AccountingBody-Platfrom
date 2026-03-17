import { defineField, defineType } from 'sanity'
export default defineType({
  name: 'firmProfile', title: 'Firm Profile', type: 'document',
  fields: [
    defineField({ name: 'name', title: 'Firm Name', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'slug', title: 'Slug', type: 'slug', options: { source: 'name', maxLength: 200 }, validation: (Rule) => Rule.required() }),
    defineField({ name: 'logo', title: 'Logo', type: 'image', options: { hotspot: true }, fields: [defineField({ name: 'alt', title: 'Alt Text', type: 'string' })] }),
    defineField({ name: 'tagline', title: 'Tagline', type: 'string' }),
    defineField({ name: 'description', title: 'Description', type: 'array', of: [{ type: 'block' }] }),
    defineField({ name: 'firmType', title: 'Firm Type', type: 'string', options: { list: [{ title: 'Accounting Firm', value: 'accounting' }, { title: 'Audit Firm', value: 'audit' }, { title: 'Tax Advisory', value: 'tax' }, { title: 'Management Consultancy', value: 'consulting' }, { title: 'Payroll Provider', value: 'payroll' }, { title: 'Other', value: 'other' }] } }),
    defineField({ name: 'size', title: 'Firm Size', type: 'string', options: { list: [{ title: 'Sole Practitioner', value: 'sole' }, { title: 'Small (2–10)', value: 'small' }, { title: 'Medium (11–50)', value: 'medium' }, { title: 'Large (51–200)', value: 'large' }, { title: 'Enterprise (200+)', value: 'enterprise' }] } }),
    defineField({ name: 'websiteUrl', title: 'Website URL', type: 'url' }),
    defineField({ name: 'email', title: 'Contact Email', type: 'string' }),
    defineField({ name: 'phone', title: 'Phone', type: 'string' }),
    defineField({ name: 'address', title: 'Address', type: 'object', fields: [defineField({ name: 'line1', title: 'Line 1', type: 'string' }), defineField({ name: 'city', title: 'City', type: 'string' }), defineField({ name: 'postcode', title: 'Postcode', type: 'string' }), defineField({ name: 'country', title: 'Country', type: 'string' })] }),
    defineField({ name: 'specialisms', title: 'Specialisms', type: 'array', of: [{ type: 'string' }], options: { layout: 'tags' } }),
    defineField({ name: 'qualifications', title: 'Qualifications Supported', type: 'array', of: [{ type: 'string' }], options: { layout: 'tags' } }),
    defineField({ name: 'featuredFirm', title: 'Featured Firm', type: 'boolean', initialValue: false }),
    defineField({ name: 'publishedAt', title: 'Published At', type: 'datetime' }),
  ],
  preview: {
    select: { title: 'name', firmType: 'firmType', city: 'address.city', media: 'logo', featured: 'featuredFirm' },
    prepare({ title, firmType, city, media, featured }: any) { return { title, subtitle: [firmType, city, featured ? '⭐ Featured' : null].filter(Boolean).join(' · '), media } },
  },
})
