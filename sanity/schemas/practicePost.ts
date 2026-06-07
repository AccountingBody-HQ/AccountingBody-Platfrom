import { defineField, defineType } from 'sanity'
import { quizQuestionField, scenarioCasesField } from './_quizFields'
export default defineType({
  name: 'practicePost', title: 'Practice Post', type: 'document',
  groups: [{ name: 'content', title: 'Content' }, { name: 'quiz', title: 'Quiz' }, { name: 'seo', title: 'SEO' }, { name: 'multisite', title: 'Multi-Site' }, { name: 'abcm', title: 'ABCM Metadata' }],
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string', group: 'content', validation: (Rule) => Rule.required() }),
    defineField({ name: 'slug', title: 'Slug', type: 'slug', group: 'content', options: { source: 'title', maxLength: 200 }, validation: (Rule) => Rule.required() }),
    defineField({ name: 'excerpt', title: 'Excerpt', type: 'text', rows: 3, group: 'content' }),
    defineField({ name: 'featuredImage', title: 'Featured Image', type: 'image', group: 'content', options: { hotspot: true }, fields: [defineField({ name: 'alt', title: 'Alt Text', type: 'string' })] }),
    defineField({ name: 'publishedAt', title: 'Published At', type: 'datetime', group: 'content' }),
    defineField({ name: 'difficulty', title: 'Difficulty', type: 'string', group: 'content', options: { list: [{ title: 'Beginner', value: 'beginner' }, { title: 'Intermediate', value: 'intermediate' }, { title: 'Advanced', value: 'advanced' }], layout: 'radio' } }),
    defineField({ name: 'framework', title: 'Framework', type: 'string', group: 'content' }),
    defineField({ name: 'topic', title: 'Topic', type: 'string', group: 'content', description: 'e.g. Financial Accounting, Management Accounting, Taxation' }),
    defineField({ name: 'examBody', title: 'Exam Bodies', type: 'array', group: 'content', of: [{ type: 'string' }], options: { list: [{ title: 'ACCA', value: 'acca' }, { title: 'CIMA', value: 'cima' }, { title: 'ICAEW', value: 'icaew' }, { title: 'AAT', value: 'aat' }, { title: 'ETICPA / CPA', value: 'eticpa-cpa' }, { title: 'ETICPA / ATQ', value: 'eticpa-atq' }], layout: 'grid' } }),
    defineField({ name: 'questionType', title: 'Question Type', type: 'string', group: 'content', options: { list: [{ title: 'Multiple Choice', value: 'multiple-choice' }, { title: 'Writing', value: 'writing' }, { title: 'Scenario', value: 'scenario' }, { title: 'Mixed', value: 'mixed' }] } }),
    defineField({ name: 'categories', title: 'Categories', type: 'array', group: 'content', of: [{ type: 'reference', to: [{ type: 'category' }] }] }),
    defineField({ name: 'tags', title: 'Tags', type: 'array', group: 'content', of: [{ type: 'string' }], options: { layout: 'tags' } }),
    scenarioCasesField,
    quizQuestionField,
    defineField({ name: 'seoTitle', title: 'SEO Title', type: 'string', group: 'seo', validation: (Rule) => Rule.max(60) }),
    defineField({ name: 'seoDescription', title: 'SEO Description', type: 'text', rows: 2, group: 'seo', validation: (Rule) => Rule.max(160) }),
    defineField({ name: 'wpId', title: 'WordPress Post ID', type: 'string', group: 'multisite', description: 'Original WordPress post ID — used for book publishing and content tracing.' }),
    defineField({ name: 'contentId', title: 'Content ID', type: 'string', group: 'multisite', description: 'AI-generated content ID — format AB-QZ-00001. Do not set on migrated WordPress content.' }),
    defineField({ name: 'canonicalOwner', title: 'Canonical Owner', type: 'string', group: 'multisite', options: { list: [{ title: 'AccountingBody', value: 'accountingbody' }, { title: 'HRLake', value: 'hrlake' }, { title: 'EthioTax', value: 'ethiotax' }], layout: 'radio' }, validation: (Rule) => Rule.required() }),
    defineField({ name: 'showOnSites', title: 'Show On Sites', type: 'array', group: 'multisite', of: [{ type: 'string' }], options: { list: [{ title: 'AccountingBody', value: 'accountingbody' }, { title: 'HRLake', value: 'hrlake' }, { title: 'EthioTax', value: 'ethiotax' }], layout: 'grid' } }),
    defineField({ name: 'eticpaLevel', title: 'ETICPA Level', type: 'string', group: 'abcm', description: 'Which ATQ level does this practice post belong to?', options: { list: [{ title: 'Level 1 — Foundation Technician', value: 'level-1' }, { title: 'Level 2 — Advanced Technician', value: 'level-2' }], layout: 'radio' } }),
    defineField({ name: 'eticpaModule', title: 'ETICPA Module', type: 'string', group: 'abcm', description: 'Which module does this practice post belong to?', options: { list: [{ title: 'Introduction to Accounting', value: 'introduction-to-accounting' }, { title: 'Cost Accounting', value: 'cost-accounting' }, { title: 'Business Skills', value: 'business-skills' }, { title: 'Ethiopian Business Law', value: 'ethiopian-business-law' }, { title: 'Financial Accounting', value: 'financial-accounting' }, { title: 'Management Accounting', value: 'management-accounting' }, { title: 'Assurance, Controls & Ethics', value: 'assurance-controls-ethics' }, { title: 'Ethiopian Taxation', value: 'ethiopian-taxation' }, { title: 'Ethiopian Public Sector Accounting', value: 'ethiopian-public-sector-accounting' }], layout: 'radio' } }),
  ],
  preview: {
    select: { title: 'title', difficulty: 'difficulty', examBody: 'examBody', media: 'featuredImage' },
    prepare({ title, difficulty, examBody, media }: any) { return { title, subtitle: [examBody, difficulty].filter(Boolean).join(' · '), media } },
  },
})
