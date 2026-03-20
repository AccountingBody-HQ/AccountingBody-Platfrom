// lib/structured-data.ts
const BASE_URL = 'https://accountingbody.com'
const LOGO_URL = `${BASE_URL}/logo.png`
const ORG_NAME = 'AccountingBody'

const organisation = {
  '@type': 'Organization' as const,
  name:    ORG_NAME,
  url:     BASE_URL,
  logo: {
    '@type': 'ImageObject',
    url:     LOGO_URL,
  },
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type':    'WebSite',
    name:        ORG_NAME,
    url:         BASE_URL,
    description: "The UK's leading accounting education platform.",
    potentialAction: {
      '@type':  'SearchAction',
      target: {
        '@type':      'EntryPoint',
        urlTemplate: `${BASE_URL}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function articleSchema({
  title,
  description,
  url,
  datePublished,
  dateModified,
  authorName = ORG_NAME,
  imageUrl,
}: {
  title:         string
  description:   string
  url:           string
  datePublished: string
  dateModified?: string
  authorName?:   string
  imageUrl?:     string
}) {
  return {
    '@context':  'https://schema.org',
    '@type':     'Article',
    headline:     title,
    description,
    url,
    datePublished,
    dateModified:  dateModified ?? datePublished,
    author: {
      '@type': 'Person',
      name:     authorName,
    },
    publisher:     organisation,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id':    url,
    },
    ...(imageUrl && {
      image: { '@type': 'ImageObject', url: imageUrl },
    }),
  }
}

export function courseSchema({
  name,
  description,
  url,
  courseCode,
  isFree = true,
}: {
  name:         string
  description:  string
  url:          string
  courseCode?:  string
  isFree?:      boolean
}) {
  return {
    '@context':  'https://schema.org',
    '@type':     'Course',
    name,
    description,
    url,
    courseCode,
    provider:    organisation,
    offers: {
      '@type':       'Offer',
      price:          isFree ? '0' : undefined,
      priceCurrency: 'GBP',
      availability:  'https://schema.org/InStock',
      category:       isFree ? 'free' : 'paid',
    },
  }
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context':      'https://schema.org',
    '@type':         'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type':   'ListItem',
      position:   index + 1,
      name:       item.name,
      item:       item.url,
    })),
  }
}

export function faqSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@context':  'https://schema.org',
    '@type':     'FAQPage',
    mainEntity:   faqs.map(faq => ({
      '@type': 'Question',
      name:     faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text:     faq.answer,
      },
    })),
  }
}

export function quizSchema({
  name,
  description,
  url,
  educationalLevel,
}: {
  name:              string
  description:       string
  url:               string
  educationalLevel?: string
}) {
  return {
    '@context':       'https://schema.org',
    '@type':          'Quiz',
    name,
    description,
    url,
    educationalLevel,
    provider:          organisation,
  }
}