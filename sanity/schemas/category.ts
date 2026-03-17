import { defineField, defineType } from 'sanity'
export default defineType({
  name: 'category', title: 'Category', type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'slug', title: 'Slug', type: 'slug', options: { source: 'title', maxLength: 100 }, validation: (Rule) => Rule.required() }),
    defineField({ name: 'description', title: 'Description', type: 'text', rows: 3 }),
    defineField({ name: 'parentCategory', title: 'Parent Category', type: 'reference', to: [{ type: 'category' }], description: 'Leave blank for top-level categories.' }),
    defineField({ name: 'showOnSites', title: 'Show On Sites', type: 'array', of: [{ type: 'string' }], options: { list: [{ title: 'AccountingBody', value: 'accountingbody' }, { title: 'GlobalPayrollExpert', value: 'globalpayrollexpert' }, { title: 'EthioTax', value: 'ethiotax' }], layout: 'grid' } }),
  ],
  preview: {
    select: { title: 'title', parent: 'parentCategory.title' },
    prepare({ title, parent }: any) { return { title, subtitle: parent ? `Parent: ${parent}` : 'Top-level category' } },
  },
})
