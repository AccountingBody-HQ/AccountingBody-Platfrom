import { defineField, defineType } from 'sanity'
export default defineType({
  name: 'page', title: 'Page', type: 'document',
  groups: [{ name: 'content', title: 'Content' }, { name: 'seo', title: 'SEO' }],
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string', group: 'content', validation: (Rule) => Rule.required() }),
    defineField({ name: 'slug', title: 'Slug', type: 'slug', group: 'content', options: { source: 'title', maxLength: 200 }, validation: (Rule) => Rule.required() }),
    defineField({ name: 'body', title: 'Body', type: 'array', group: 'content', of: [{ type: 'block' }, { type: 'image', options: { hotspot: true }, fields: [defineField({ name: 'alt', title: 'Alt Text', type: 'string' })] }] }),
    defineField({ name: 'showOnSites', title: 'Show On Sites', type: 'array', group: 'content', of: [{ type: 'string' }], options: { list: [{ title: 'AccountingBody', value: 'accountingbody' }, { title: 'GlobalPayrollExpert', value: 'globalpayrollexpert' }, { title: 'EthioTax', value: 'ethiotax' }], layout: 'grid' } }),
    defineField({ name: 'seoTitle', title: 'SEO Title', type: 'string', group: 'seo', validation: (Rule) => Rule.max(60) }),
    defineField({ name: 'seoDescription', title: 'SEO Description', type: 'text', rows: 2, group: 'seo', validation: (Rule) => Rule.max(160) }),
  ],
  preview: { select: { title: 'title', slug: 'slug.current' }, prepare({ title, slug }: any) { return { title, subtitle: `/${slug ?? ''}` } } },
})
