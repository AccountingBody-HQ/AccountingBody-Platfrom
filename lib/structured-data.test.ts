import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import * as ReactModule from 'react'
import { createElement } from 'react'
import * as SD from '@/lib/structured-data'
import StructuredData, { structuredDataJson } from '@/components/StructuredData'

;(globalThis as { React?: unknown }).React = ReactModule

// SEO-1 S1 (owner decisions D348 item 16, D350): the label helpers name the
// brand as shown, use canonical addresses on both brands, carry no logo, no
// unprovable claim, no search action, no dates and no FAQPage.

const AB = { '@type': 'Organization', name: 'Accounting Body', url: 'https://accountingbody.com' }
const ET = { '@type': 'Organization', name: 'EthioTax', url: 'https://ethiotax.com' }

describe('organisation and website, by brand', () => {
  it('Organization: the brand name as shown and its home address, no logo', () => {
    expect(SD.organizationSchema(false)).toEqual({ '@context': 'https://schema.org', ...AB })
    expect(SD.organizationSchema(true)).toEqual({ '@context': 'https://schema.org', ...ET })
  })

  it('WebSite: name and address only — no description claim, no search action', () => {
    expect(SD.websiteSchema(false)).toEqual({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Accounting Body', url: 'https://accountingbody.com' })
    expect(SD.websiteSchema(true)).toEqual({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'EthioTax', url: 'https://ethiotax.com' })
  })
})

describe('article', () => {
  it('exact JSON, Accounting Body, team author is an Organization', () => {
    expect(SD.articleSchema({
      title: 'Deferred tax', description: 'What deferred tax is.', url: 'https://accountingbody.com/study/acca/deferred-tax',
      authorName: 'Accounting Body Editorial Team', isEthioTax: false,
    })).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Deferred tax',
      description: 'What deferred tax is.',
      url: 'https://accountingbody.com/study/acca/deferred-tax',
      mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://accountingbody.com/study/acca/deferred-tax' },
      author: { '@type': 'Organization', name: 'Accounting Body Editorial Team' },
      publisher: AB,
    })
  })

  it('exact JSON, EthioTax, a person author, no description', () => {
    expect(SD.articleSchema({ title: 'VAT', url: 'https://ethiotax.com/articles/vat', authorName: 'Jane Smith', isEthioTax: true })).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'VAT',
      url: 'https://ethiotax.com/articles/vat',
      mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://ethiotax.com/articles/vat' },
      author: { '@type': 'Person', name: 'Jane Smith' },
      publisher: ET,
    })
  })

  it('no author name, no author', () => {
    expect(SD.articleSchema({ title: 't', url: 'https://accountingbody.com/a', isEthioTax: false })).not.toHaveProperty('author')
  })

  it.each([
    ['Accounting Body Editorial Team', 'Organization'],
    ['AccountingBody Team', 'Organization'],
    ['EthioTax Editors', 'Organization'],
    ['Editorial Staff', 'Organization'],
    ['Smith Ltd', 'Organization'],
    ['Jane Smith', 'Person'],
    ['Abebe Kebede', 'Person'],
    ['Steam Engineer', 'Person'],
  ])('author type of %s is %s', (name, type) => {
    expect(SD.authorType(name)).toBe(type)
  })
})

describe('course, lesson, quiz, pages, terms', () => {
  it('Course: free, level as shown, provider by brand, no Offer', () => {
    expect(SD.courseSchema({ name: 'Bookkeeping', description: 'Learn it.', url: 'https://accountingbody.com/free-courses/bk', level: 'Beginner', isEthioTax: false })).toEqual({
      '@context': 'https://schema.org', '@type': 'Course', name: 'Bookkeeping', description: 'Learn it.',
      url: 'https://accountingbody.com/free-courses/bk', educationalLevel: 'Beginner', isAccessibleForFree: true, provider: AB,
    })
    expect(SD.courseSchema({ name: 'Bookkeeping', url: 'https://accountingbody.com/free-courses/bk', isEthioTax: true })).toEqual({
      '@context': 'https://schema.org', '@type': 'Course', name: 'Bookkeeping',
      url: 'https://accountingbody.com/free-courses/bk', isAccessibleForFree: true, provider: ET,
    })
  })

  it('ItemList of courses', () => {
    expect(SD.itemListSchema([{ name: 'A', url: 'https://accountingbody.com/free-courses/a' }, { name: 'B', url: 'https://ethiotax.com/free-courses/b' }])).toEqual({
      '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'A', url: 'https://accountingbody.com/free-courses/a' },
        { '@type': 'ListItem', position: 2, name: 'B', url: 'https://ethiotax.com/free-courses/b' },
      ],
    })
  })

  it('LearningResource: a lesson, part of its Course', () => {
    for (const [et, org] of [[false, AB], [true, ET]] as const) {
      expect(SD.lessonSchema({ name: 'Journals', url: 'https://accountingbody.com/free-courses/bk/learn/journals', course: { name: 'Bookkeeping', url: 'https://accountingbody.com/free-courses/bk' }, isEthioTax: et })).toEqual({
        '@context': 'https://schema.org', '@type': 'LearningResource', name: 'Journals',
        url: 'https://accountingbody.com/free-courses/bk/learn/journals', learningResourceType: 'lesson',
        isPartOf: { '@type': 'Course', name: 'Bookkeeping', url: 'https://accountingbody.com/free-courses/bk' }, provider: org,
      })
    }
  })

  it('Quiz: name, description, url, free, provider — no questions, no answers', () => {
    const q = SD.quizSchema({ name: 'IAS 12 set', description: 'Ten questions.', url: 'https://accountingbody.com/practice-questions/ias-12', isEthioTax: true })
    expect(q).toEqual({
      '@context': 'https://schema.org', '@type': 'Quiz', name: 'IAS 12 set', description: 'Ten questions.',
      url: 'https://accountingbody.com/practice-questions/ias-12', isAccessibleForFree: true, provider: ET,
    })
    expect(JSON.stringify(q)).not.toMatch(/hasPart|Question|acceptedAnswer|suggestedAnswer/)
  })

  it('WebPage / CollectionPage and BreadcrumbList', () => {
    expect(SD.webPageSchema({ type: 'CollectionPage', name: 'Mock Exams', description: 'd', url: 'https://accountingbody.com/mock-exams' })).toEqual({
      '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Mock Exams', description: 'd', url: 'https://accountingbody.com/mock-exams',
    })
    expect(SD.breadcrumbSchema([{ name: 'Home', url: 'https://accountingbody.com/' }, { name: 'Study', url: 'https://accountingbody.com/study' }])).toEqual({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://accountingbody.com/' },
        { '@type': 'ListItem', position: 2, name: 'Study', item: 'https://accountingbody.com/study' },
      ],
    })
  })

  it('DefinedTermSet with its DefinedTerms', () => {
    expect(SD.definedTermSetSchema({ name: 'Terms starting with "A"', url: 'https://accountingbody.com/dictionary', terms: [{ name: 'Accrual', description: 'An expense owed.' }, { name: 'Asset' }] })).toEqual({
      '@context': 'https://schema.org', '@type': 'DefinedTermSet', name: 'Terms starting with "A"', url: 'https://accountingbody.com/dictionary',
      hasDefinedTerm: [{ '@type': 'DefinedTerm', name: 'Accrual', description: 'An expense owed.' }, { '@type': 'DefinedTerm', name: 'Asset' }],
    })
  })
})

describe('what is never emitted', () => {
  const all = [
    SD.organizationSchema(false), SD.websiteSchema(true),
    SD.articleSchema({ title: 't', description: 'd', url: 'https://accountingbody.com/a', authorName: 'x', isEthioTax: false }),
    SD.courseSchema({ name: 'n', url: 'https://accountingbody.com/c', isEthioTax: false }),
    SD.lessonSchema({ name: 'n', url: 'u', course: { name: 'c', url: 'u' }, isEthioTax: false }),
    SD.quizSchema({ name: 'n', url: 'u', isEthioTax: false }),
    SD.webPageSchema({ type: 'WebPage', name: 'n', url: 'u' }),
    SD.definedTermSetSchema({ name: 'n', url: 'u', terms: [{ name: 't' }] }),
    SD.itemListSchema([{ name: 'n', url: 'u' }]), SD.breadcrumbSchema([{ name: 'n', url: 'u' }]),
  ]
  const text = JSON.stringify(all)

  it('no dates, no logo, no offer, no search action, no "leading" claim', () => {
    expect(text).not.toMatch(/date|Date|logo|Offer|SearchAction|potentialAction|leading|logo\.png/)
  })

  it('no FAQPage helper exists', () => {
    expect(Object.keys(SD).some(k => /faq/i.test(k))).toBe(false)
    expect(text).not.toContain('FAQPage')
  })

  it('every address names one of the two real domains, never a hard-coded single host', () => {
    expect(SD.brandHomeUrl(false)).toBe('https://accountingbody.com')
    expect(SD.brandHomeUrl(true)).toBe('https://ethiotax.com')
  })
})

describe('components/StructuredData escapes <', () => {
  it('a </script> in a value cannot close the tag; JSON.parse sees the same string', () => {
    const data = { name: 'a </script><b>x</b> & <' }
    const json = structuredDataJson(data)
    expect(json).not.toContain('<')
    expect(JSON.parse(json)).toEqual(data)
    const html = renderToStaticMarkup(createElement(StructuredData, { data }))
    expect(html).toBe(`<script type="application/ld+json">${json}</script>`)
    expect(html.match(/<\/script>/g)).toHaveLength(1)
  })

  it('an array of labels renders as one script', () => {
    const html = renderToStaticMarkup(createElement(StructuredData, { data: [SD.organizationSchema(false), SD.websiteSchema(false)] }))
    expect(JSON.parse(html.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''))).toEqual([SD.organizationSchema(false), SD.websiteSchema(false)])
  })
})
