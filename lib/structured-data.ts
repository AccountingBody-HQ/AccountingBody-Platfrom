// lib/structured-data.ts — the one source of the site's hidden labels
// (JSON-LD, schema.org), rendered by components/StructuredData.tsx.
//
// Rules (owner decisions D348 item 16 and D350):
// - Every value repeats something the page visibly shows, or the page's own
//   canonical address. Callers pass the same values the page renders.
// - Addresses are the page's canonical (lib/canonical.ts), on both brands.
// - The organisation is the brand as shown (lib/brand.ts), with its home
//   address. No logo: the site has no public logo file.
// - No dates are emitted, and there is no FAQPage helper.
import { AB_URL, ET_URL } from '@/lib/canonical'
import { brandName } from '@/lib/brand'

const CONTEXT = 'https://schema.org'

export function brandHomeUrl(isEthioTax: boolean): string {
  return isEthioTax ? ET_URL : AB_URL
}

function organisation(isEthioTax: boolean) {
  return {
    '@type': 'Organization' as const,
    name:    brandName(isEthioTax),
    url:     brandHomeUrl(isEthioTax),
  }
}

export function organizationSchema(isEthioTax: boolean) {
  return { '@context': CONTEXT, ...organisation(isEthioTax) }
}

export function websiteSchema(isEthioTax: boolean) {
  return {
    '@context': CONTEXT,
    '@type':    'WebSite',
    name:        brandName(isEthioTax),
    url:         brandHomeUrl(isEthioTax),
  }
}

// An author name that names a team or an organisation (for example the
// default "Accounting Body Editorial Team", lib/article-normaliser.ts) is an
// Organization; any other name is a Person.
const ORGANISATION_AUTHOR = /\b(team|editorial|editors?|staff|ltd|limited)\b|accounting ?body|ethiotax/i

export function authorType(name: string): 'Organization' | 'Person' {
  return ORGANISATION_AUTHOR.test(name) ? 'Organization' : 'Person'
}

export function articleSchema({
  title,
  description,
  url,
  authorName,
  isEthioTax,
}: {
  title:        string
  description?: string
  url:          string
  authorName?:  string
  isEthioTax:   boolean
}) {
  return {
    '@context':  CONTEXT,
    '@type':     'Article',
    headline:     title,
    ...(description ? { description } : {}),
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    ...(authorName ? { author: { '@type': authorType(authorName), name: authorName } } : {}),
    publisher:    organisation(isEthioTax),
  }
}

export function courseSchema({
  name,
  description,
  url,
  level,
  isEthioTax,
}: {
  name:         string
  description?: string
  url:          string
  level?:       string
  isEthioTax:   boolean
}) {
  return {
    '@context':  CONTEXT,
    '@type':     'Course',
    name,
    ...(description ? { description } : {}),
    url,
    ...(level ? { educationalLevel: level } : {}),
    isAccessibleForFree: true,
    provider:    organisation(isEthioTax),
  }
}

export function itemListSchema(items: { name: string; url: string }[]) {
  return {
    '@context':      CONTEXT,
    '@type':         'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type':   'ListItem',
      position:   index + 1,
      name:       item.name,
      url:        item.url,
    })),
  }
}

export function lessonSchema({
  name,
  url,
  course,
  isEthioTax,
}: {
  name:       string
  url:        string
  course:     { name: string; url: string }
  isEthioTax: boolean
}) {
  return {
    '@context':  CONTEXT,
    '@type':     'LearningResource',
    name,
    url,
    learningResourceType: 'lesson',
    isPartOf:    { '@type': 'Course', name: course.name, url: course.url },
    provider:    organisation(isEthioTax),
  }
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context':      CONTEXT,
    '@type':         'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type':   'ListItem',
      position:   index + 1,
      name:       item.name,
      item:       item.url,
    })),
  }
}

// A practice set: its name and description only — never its questions or
// answers (owner decision D350 E).
export function quizSchema({
  name,
  description,
  url,
  isEthioTax,
}: {
  name:         string
  description?: string
  url:          string
  isEthioTax:   boolean
}) {
  return {
    '@context':       CONTEXT,
    '@type':          'Quiz',
    name,
    ...(description ? { description } : {}),
    url,
    isAccessibleForFree: true,
    provider:          organisation(isEthioTax),
  }
}

export function webPageSchema({
  type,
  name,
  description,
  url,
}: {
  type:         'WebPage' | 'CollectionPage'
  name:         string
  description?: string
  url:          string
}) {
  return {
    '@context': CONTEXT,
    '@type':    type,
    name,
    ...(description ? { description } : {}),
    url,
  }
}

export function definedTermSetSchema({
  name,
  url,
  terms,
}: {
  name:  string
  url:   string
  terms: { name: string; description?: string }[]
}) {
  return {
    '@context':     CONTEXT,
    '@type':        'DefinedTermSet',
    name,
    url,
    hasDefinedTerm: terms.map(term => ({
      '@type': 'DefinedTerm',
      name:     term.name,
      ...(term.description ? { description: term.description } : {}),
    })),
  }
}
