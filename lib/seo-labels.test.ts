import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// SEO-1 S2 (owner decisions D348 item 16, D350): hidden labels on the
// learning pages. Each page is rendered on a fake network (no database) on
// both brands; every label text must appear in the page's visible text (the
// "match what is visible" rule), addresses are the page's canonical, no
// date and no FAQPage is emitted, and practice-set labels carry no question
// or answer.

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const H = vi.hoisted(() => ({ map: new Map<string, string>() }))
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => H.map.get(k.toLowerCase()) ?? null }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], has: () => false }),
}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }),
  redirect: vi.fn((to: string) => { throw new Error(`NEXT_REDIRECT ${to}`) }),
  permanentRedirect: vi.fn((to: string) => { throw new Error(`NEXT_REDIRECT ${to}`) }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

const D = vi.hoisted(() => ({
  article: {
    id: 'a1', slug: 'deferred-tax-basics', title: 'Deferred Tax Basics', excerpt: 'How temporary differences create deferred tax.',
    category: 'taxation', category_title: 'Tax', exam_body: ['acca', 'cima', 'icaew', 'aat'], author_name: 'Accounting Body Editorial Team',
    content: '<p>Body</p>', read_time: 6, published_at: '2026-01-02T00:00:00Z', last_reviewed: null, mcq_url: null,
    canonical_owner: null, show_on_sites: ['ab', 'et'], status: 'published',
  } as Record<string, unknown>,
  course: {
    id: 'c1', title: 'Bookkeeping Foundations', slug: 'bookkeeping-foundations', description: 'Double entry from first principles.',
    level: 'beginner', status: 'published', isFeatured: false, showOnSites: ['ab', 'et'], canonicalOwner: 'accountingbody',
    chapters: [{ id: 'ch1', title: 'Getting Started', chapterOrder: 1, lessons: [
      { id: 'l1', title: 'What a Journal Is', slug: 'what-a-journal-is', lessonOrder: 1, articles: [] },
      { id: 'l2', title: 'Posting to the Ledger', slug: 'posting-to-the-ledger', lessonOrder: 2, articles: [] },
    ] }],
  } as Record<string, unknown>,
  set: { id: 's1', slug: 'ias-12-quick-check', title: 'IAS 12 Quick Check', excerpt: 'Ten quick questions on income taxes.', difficulty: 'intermediate', question_type: 'multiple-choice', article_slug: null } as Record<string, unknown>,
  questions: [{ id: 'q1', type: 'multiple-choice', question_text: 'QTEXT-SECRET-1', option_a: 'OPT-A-SECRET', option_b: 'OPT-B-SECRET', option_c: null, option_d: null, correct_index: 0, explanation: 'EXPL-SECRET' }] as unknown[],
  terms: [
    { id: 't1', title: 'Accrual', slug: 'accrual', excerpt: 'An expense incurred but not yet paid.', category: 'financial-accounting', category_title: 'Financial Accounting' },
    { id: 't2', title: 'Amortisation', slug: 'amortisation', excerpt: '', category: 'financial-accounting', category_title: 'Financial Accounting' },
  ] as unknown[],
}))

vi.mock('@/lib/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db')>()),
  getArticleBySlug: vi.fn(async () => D.article),
  getAllArticleSlugs: vi.fn(async () => []),
  getPublicQuestionSetBySlug: vi.fn(async () => D.set),
  getPublicQuestionsBySetId: vi.fn(async () => D.questions),
  getPublicCasesBySetId: vi.fn(async () => []),
}))
vi.mock('@/lib/coursesNew', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/coursesNew')>()
  return {
    ...real,
    getPublicCourseBySlug: vi.fn(async () => D.course),
    getPublicLessonData: vi.fn(async () => {
      const lessons = (D.course.chapters as Array<{ lessons: unknown[] }>)[0].lessons as Array<Record<string, unknown>>
      return { course: D.course, lesson: lessons[0], prevLesson: null, nextLesson: lessons[1] }
    }),
    getPublishedCoursesOrThrow: vi.fn(async () => [{ ...D.course, chapterCount: 1, lessonCount: 2 }]),
    getPublishedCourses: vi.fn(async () => []),
  }
})
vi.mock('@/lib/dictionary-articles', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/dictionary-articles')>()),
  getDictionaryArticlesByLetter: vi.fn(async () => D.terms),
  getDictionaryArticlesByCategory: vi.fn(async () => D.terms),
}))
vi.mock('@/lib/legacy-renamed-path', () => ({ resolveLegacyRenamedPath: vi.fn(async () => null) }))

import * as ReactModule from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
;(globalThis as { React?: unknown }).React = ReactModule

type Json = Record<string, unknown>
type View = 'ab' | 'et'

function setView(view: View) {
  H.map.clear()
  if (view === 'et') H.map.set('x-et-platform', 'ethiotax')
}

function decode(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
}

async function render(load: () => Promise<{ default: (p: never) => unknown }>, props: Json) {
  const Page = (await load()).default as unknown as (p: Json) => Promise<ReactModule.ReactElement>
  const html = renderToStaticMarkup(await Page(props))
  const labels = Array.from(html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)).map(m => {
    expect(m[1]).not.toContain('<')
    const parsed = JSON.parse(m[1]) as Json | Json[]
    return Array.isArray(parsed) ? parsed : [parsed]
  }).flat()
  const visible = decode(html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ')
  return { html, labels, visible }
}

const SKIP_KEYS = new Set(['@context', '@type', '@id', 'url', 'item', 'learningResourceType', 'provider', 'publisher'])

function texts(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach(v => texts(v, out))
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) if (!SKIP_KEYS.has(k)) texts(v, out)
  }
  return out
}

function urls(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach(v => urls(v, out))
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if ((k === 'url' || k === 'item' || k === '@id') && typeof v === 'string') out.push(v)
      else urls(v, out)
    }
  }
  return out
}

function checkCommon(labels: Json[], visible: string, view: View) {
  expect(labels.length).toBeGreaterThan(0)
  for (const t of texts(labels)) expect(visible, `label text not visible: ${t}`).toContain(t)
  for (const u of urls(labels)) expect(u).toMatch(/^https:\/\/(accountingbody|ethiotax)\.com(\/|$)/)
  const all = JSON.stringify(labels)
  expect(all).not.toMatch(/date|Date|FAQPage|logo|Offer|SearchAction/)
  for (const org of labels.map(l => (l.provider ?? l.publisher) as Json | undefined).filter(Boolean)) {
    expect(org).toEqual(view === 'et'
      ? { '@type': 'Organization', name: 'EthioTax', url: 'https://ethiotax.com' }
      : { '@type': 'Organization', name: 'Accounting Body', url: 'https://accountingbody.com' })
  }
}

const types = (labels: Json[]) => labels.map(l => l['@type'])

beforeEach(() => setView('ab'))

describe.each(['ab', 'et'] as const)('%s view', (view) => {
  beforeEach(() => setView(view))

  it('study article: Article + BreadcrumbList, canonical address, team author', async () => {
    const { labels, visible } = await render(() => import('@/app/study/[category]/[slug]/page'), { params: Promise.resolve({ category: 'acca', slug: 'deferred-tax-basics' }) })
    expect(types(labels)).toEqual(['Article', 'BreadcrumbList'])
    checkCommon(labels, visible, view)
    expect(labels[0]).toMatchObject({ headline: 'Deferred Tax Basics', description: 'How temporary differences create deferred tax.', url: 'https://accountingbody.com/study/taxation/deferred-tax-basics', author: { '@type': 'Organization', name: 'Accounting Body Editorial Team' } })
    expect((labels[1].itemListElement as Json[]).map(i => [i.name, i.item])).toEqual([
      ['Home', view === 'et' ? 'https://ethiotax.com/' : 'https://accountingbody.com/'],
      ['Study', 'https://accountingbody.com/study'],
      ['ACCA', 'https://accountingbody.com/study/acca'],
      ['Deferred Tax Basics', 'https://accountingbody.com/study/taxation/deferred-tax-basics'],
    ])
  })

  it('/articles article: Article (no description: the excerpt is not shown) + BreadcrumbList', async () => {
    const { labels, visible } = await render(() => import('@/app/articles/[slug]/page'), { params: Promise.resolve({ slug: 'deferred-tax-basics' }) })
    expect(types(labels)).toEqual(['Article', 'BreadcrumbList'])
    checkCommon(labels, visible, view)
    expect(labels[0]).not.toHaveProperty('description')
    expect((labels[1].itemListElement as Json[]).map(i => i.name)).toEqual(['Home', 'Articles', 'Deferred Tax Basics'])
  })

  it('course page: Course, free, level as shown', async () => {
    const { labels, visible } = await render(() => import('@/app/free-courses/[slug]/page'), { params: Promise.resolve({ slug: 'bookkeeping-foundations' }) })
    expect(types(labels)).toEqual(['Course'])
    checkCommon(labels, visible, view)
    expect(labels[0]).toMatchObject({ name: 'Bookkeeping Foundations', description: 'Double entry from first principles.', educationalLevel: 'Beginner', isAccessibleForFree: true, url: 'https://accountingbody.com/free-courses/bookkeeping-foundations' })
    expect(visible).toContain('Free')
  })

  it('free-courses list: ItemList of the listed courses', async () => {
    const { labels, visible } = await render(() => import('@/app/free-courses/page'), { searchParams: Promise.resolve({}) })
    expect(types(labels)).toEqual(['ItemList'])
    checkCommon(labels, visible, view)
    expect(labels[0].itemListElement).toEqual([{ '@type': 'ListItem', position: 1, name: 'Bookkeeping Foundations', url: 'https://accountingbody.com/free-courses/bookkeeping-foundations' }])
  })

  it('lesson: LearningResource, part of its Course', async () => {
    const { labels, visible } = await render(() => import('@/app/free-courses/[slug]/learn/[lessonSlug]/page'), { params: Promise.resolve({ slug: 'bookkeeping-foundations', lessonSlug: 'what-a-journal-is' }) })
    expect(types(labels)).toEqual(['LearningResource'])
    checkCommon(labels, visible, view)
    expect(labels[0]).toMatchObject({
      name: 'What a Journal Is', url: 'https://accountingbody.com/free-courses/bookkeeping-foundations/learn/what-a-journal-is',
      isPartOf: { '@type': 'Course', name: 'Bookkeeping Foundations', url: 'https://accountingbody.com/free-courses/bookkeeping-foundations' },
    })
  })

  it('practice set: Quiz with name and description only — no question, option, answer or explanation', async () => {
    const { labels, visible } = await render(() => import('@/app/practice-questions/[slug]/page'), { params: Promise.resolve({ slug: 'ias-12-quick-check' }) })
    expect(types(labels)).toEqual(['Quiz'])
    checkCommon(labels, visible, view)
    expect(Object.keys(labels[0]).sort()).toEqual(['@context', '@type', 'description', 'isAccessibleForFree', 'name', 'provider', 'url'])
    expect(JSON.stringify(labels)).not.toMatch(/SECRET/)
  })

  it('dictionary letter page: DefinedTermSet of the listed terms; none on the letter-less page', async () => {
    const { labels, visible } = await render(() => import('@/app/dictionary/page'), { searchParams: Promise.resolve({ letter: 'a' }) })
    expect(types(labels)).toEqual(['DefinedTermSet'])
    checkCommon(labels, visible, view)
    expect(labels[0]).toEqual({
      '@context': 'https://schema.org', '@type': 'DefinedTermSet', name: 'Terms starting with "A"', url: 'https://accountingbody.com/dictionary',
      hasDefinedTerm: [{ '@type': 'DefinedTerm', name: 'Accrual', description: 'An expense incurred but not yet paid.' }, { '@type': 'DefinedTerm', name: 'Amortisation' }],
    })
    const plain = await render(() => import('@/app/dictionary/page'), { searchParams: Promise.resolve({}) })
    expect(plain.labels).toEqual([])
  })
})

describe('mock exam pages (Accounting Body only; EthioTax redirects)', () => {
  it('hub: CollectionPage + BreadcrumbList', async () => {
    const { labels, visible } = await render(() => import('@/app/mock-exams/page'), {})
    expect(types(labels)).toEqual(['CollectionPage', 'BreadcrumbList'])
    checkCommon(labels, visible, 'ab')
    expect((labels[1].itemListElement as Json[]).map(i => i.name)).toEqual(['Home', 'Study', 'Mock Exams'])
  })

  it('category: WebPage + BreadcrumbList', async () => {
    const { labels, visible } = await render(() => import('@/app/mock-exams/[category]/page'), { params: Promise.resolve({ category: 'taxation' }) })
    expect(types(labels)).toEqual(['WebPage', 'BreadcrumbList'])
    checkCommon(labels, visible, 'ab')
    expect(labels[0]).toEqual({ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Tax', url: 'https://accountingbody.com/mock-exams/taxation' })
  })

  it('EthioTax still redirects before any label', async () => {
    setView('et')
    const Page = (await import('@/app/mock-exams/page')).default as unknown as () => Promise<unknown>
    await expect(Page()).rejects.toThrow('NEXT_REDIRECT /study/mock-exams')
  })
})

describe('the visible-text check itself', () => {
  it('fails when a label holds text the page does not show, or a date', () => {
    expect(() => checkCommon([{ '@type': 'Article', headline: 'Not on the page' }], 'Some other words', 'ab')).toThrow()
    expect(() => checkCommon([{ '@type': 'Article', headline: 'Shown', datePublished: '2026-01-01' }], 'Shown 2026-01-01', 'ab')).toThrow()
    expect(() => checkCommon([{ '@type': 'Article', headline: 'Shown' }], 'Shown', 'ab')).not.toThrow()
  })
})

describe('layout: Organization + WebSite once, by brand', () => {
  it('the root layout renders both labels once, with the request brand', () => {
    const src = read('app/layout.tsx')
    expect(src.split('<StructuredData ').length - 1).toBe(1)
    expect(src).toContain('<StructuredData data={[organizationSchema(isEthioTax), websiteSchema(isEthioTax)]} />')
  })

  it('no page passes FAQ data, and no page reads the database for a label', () => {
    const files = ['app/study/[category]/[slug]/page.tsx', 'app/articles/[slug]/page.tsx', 'app/free-courses/page.tsx', 'app/free-courses/[slug]/page.tsx',
      'app/free-courses/[slug]/learn/[lessonSlug]/page.tsx', 'app/practice-questions/[slug]/page.tsx', 'app/mock-exams/page.tsx', 'app/mock-exams/[category]/page.tsx', 'app/dictionary/page.tsx', 'app/layout.tsx']
    for (const f of files) {
      const src = read(f)
      expect(src, f).toContain('<StructuredData ')
      expect(src, f).not.toMatch(/faq/i)
    }
  })
})
