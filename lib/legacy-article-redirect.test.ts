import { describe, it, expect, vi, beforeEach } from 'vitest'

// app/[slug]/page.tsx (v2): an old root address /<slug> answers ONE permanent
// (308) redirect to the published article's canonical path; failing that, to
// a published practice-question set; failing that, through the frozen
// renamed-slug map; otherwise 404. A path that is not slug-shaped never reads
// the database, and a reader error reaches the error page (500), never a 404.

const NOT_FOUND = vi.hoisted(() => new Error('NEXT_NOT_FOUND'))
const PERMANENT = vi.hoisted(() => new Error('NEXT_PERMANENT_REDIRECT'))
const TEMPORARY = vi.hoisted(() => new Error('NEXT_TEMPORARY_REDIRECT'))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw NOT_FOUND }),
  permanentRedirect: vi.fn(() => { throw PERMANENT }),
  redirect: vi.fn(() => { throw TEMPORARY }),
}))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
vi.mock('@/lib/db', () => ({
  getArticleBySlug: vi.fn(async () => null),
  getPublicQuestionSetBySlug: vi.fn(async () => null),
  getAllArticleSlugs: vi.fn(async () => []),
}))
vi.mock('next/headers', () => ({
  headers: async () => ({ get: () => null }),
}))
vi.mock('@/lib/canonical', () => ({
  resolveArticleCanonical: () => ({ alternates: {}, openGraph: { url: 'https://example.test/x' } }),
  ownerUrl: (_owner: string, path: string) => `https://example.test${path}`,
  AB_URL: 'https://accountingbody.com',
  ET_URL: 'https://ethiotax.com',
}))

import { notFound, permanentRedirect, redirect } from 'next/navigation'
import { getArticleBySlug, getPublicQuestionSetBySlug } from '@/lib/db'
import LegacyArticleRedirect from '@/app/[slug]/page'
import ArticlesPage, { generateMetadata as articlesMetadata } from '@/app/articles/[slug]/page'
import StudyArticlePage, { generateMetadata as studyMetadata } from '@/app/study/[category]/[slug]/page'

const reader = vi.mocked(getArticleBySlug)
const setReader = vi.mocked(getPublicQuestionSetBySlug)
const visit = (slug: string) => LegacyArticleRedirect({ params: Promise.resolve({ slug }) })
const article = (slug: string) => ({ id: 'a1', title: 'Fixed costs', slug }) as Awaited<ReturnType<typeof getArticleBySlug>>

beforeEach(() => {
  vi.mocked(notFound).mockClear()
  vi.mocked(permanentRedirect).mockClear()
  vi.mocked(redirect).mockClear()
  reader.mockReset()
  reader.mockResolvedValue(null)
  setReader.mockReset()
  setReader.mockResolvedValue(null)
})

describe('old WordPress article address', () => {
  it('redirects permanently to /articles/<slug> when the published article exists', async () => {
    reader.mockResolvedValue(article('fixed-costs'))
    await expect(visit('fixed-costs')).rejects.toBe(PERMANENT)
    expect(reader).toHaveBeenCalledTimes(1)
    expect(reader).toHaveBeenCalledWith('fixed-costs')
    expect(permanentRedirect).toHaveBeenCalledTimes(1)
    expect(permanentRedirect).toHaveBeenCalledWith('/articles/fixed-costs')
    expect(redirect).not.toHaveBeenCalled()
    expect(notFound).not.toHaveBeenCalled()
  })

  it.each(['ias-16', '2024-budget-guide', 'a', 'x'.repeat(200)])('accepts the published slug shape %#', async (slug) => {
    reader.mockResolvedValue(article(slug))
    await expect(visit(slug)).rejects.toBe(PERMANENT)
    expect(reader).toHaveBeenCalledWith(slug)
    expect(permanentRedirect).toHaveBeenCalledWith('/articles/' + slug)
  })

  it('answers 404 for an unknown slug, without redirecting', async () => {
    await expect(visit('this-slug-does-not-exist-zz9')).rejects.toBe(NOT_FOUND)
    expect(reader).toHaveBeenCalledTimes(1)
    expect(notFound).toHaveBeenCalledTimes(1)
    expect(permanentRedirect).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it.each([
    ['wp-login.php'],
    ['favicon.ico'],
    ['xmlrpc.php'],
    ['.env'],
    ['x'.repeat(201)],
    ['%E0%A4%A'],
    ['Fixed-Costs'],
    ['fixed_costs'],
    ['fixed--costs'],
    ['-fixed-costs'],
    ['fixed-costs-'],
    ['fixed%2Fcosts'],
    ['fixed%20costs'],
    [''],
  ])('answers 404 for a path that is not slug-shaped, without reading the database (%#)', async (slug) => {
    reader.mockResolvedValue(article('fixed-costs'))
    await expect(visit(slug)).rejects.toBe(NOT_FOUND)
    expect(reader).not.toHaveBeenCalled()
    expect(permanentRedirect).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('lets a database error reach the error page, without notFound() or a redirect', async () => {
    const dbError = new Error('getArticleBySlug: articles query failed (status 504)')
    reader.mockRejectedValue(dbError)
    await expect(visit('fixed-costs')).rejects.toBe(dbError)
    expect(notFound).not.toHaveBeenCalled()
    expect(permanentRedirect).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('decodes the address to its stored form and redirects to it as stored', async () => {
    reader.mockResolvedValue(article('caf%c3%a9'))
    await expect(visit('caf%25c3%25a9')).rejects.toBe(PERMANENT)
    expect(reader).toHaveBeenCalledWith('caf%c3%a9')
    expect(permanentRedirect).toHaveBeenCalledWith('/articles/caf%c3%a9')
  })

  it('redirects to the slug stored on the article row', async () => {
    reader.mockResolvedValue(article('fixed-costs-explained'))
    await expect(visit('fixed-costs')).rejects.toBe(PERMANENT)
    expect(permanentRedirect).toHaveBeenCalledWith('/articles/fixed-costs-explained')
  })
})

// Version 2: one hop to the canonical page; practice sets; renamed slugs.

type Article = Awaited<ReturnType<typeof getArticleBySlug>>
type QuestionSetRow = Awaited<ReturnType<typeof getPublicQuestionSetBySlug>>
const withCategory = (slug: string, category: string) => ({ id: 'a2', title: 'T', slug, category }) as Article
const questionSet = (slug: string) => ({ id: 's1', title: 'S', slug }) as QuestionSetRow
const articlesOnly = (rows: Article[]) => async (slug: string) => rows.find((row) => row?.slug === slug) ?? null
const setsOnly = (rows: QuestionSetRow[]) => async (slug: string) => rows.find((row) => row?.slug === slug) ?? null

describe('old address v2', () => {
  it('redirects an article with a category to /study/<category>/<slug> in one hop', async () => {
    reader.mockResolvedValue(withCategory('lease-guide', 'IFRS '))
    await expect(visit('lease-guide')).rejects.toBe(PERMANENT)
    expect(permanentRedirect).toHaveBeenCalledTimes(1)
    expect(permanentRedirect).toHaveBeenCalledWith('/study/ifrs/lease-guide')
    expect(setReader).not.toHaveBeenCalled()
  })

  it('redirects an article without a category to /articles/<slug>', async () => {
    reader.mockResolvedValue(withCategory('lease-guide', ''))
    await expect(visit('lease-guide')).rejects.toBe(PERMANENT)
    expect(permanentRedirect).toHaveBeenCalledWith('/articles/lease-guide')
  })

  it('redirects to /practice-questions/<slug> when no article but a published set has the slug', async () => {
    setReader.mockResolvedValue(questionSet('budgeting-practice-questions'))
    await expect(visit('budgeting-practice-questions')).rejects.toBe(PERMANENT)
    expect(reader).toHaveBeenCalledWith('budgeting-practice-questions')
    expect(setReader).toHaveBeenCalledWith('budgeting-practice-questions')
    expect(permanentRedirect).toHaveBeenCalledTimes(1)
    expect(permanentRedirect).toHaveBeenCalledWith('/practice-questions/budgeting-practice-questions')
  })

  it('follows a renamed article slug from the map to the target canonical path', async () => {
    reader.mockImplementation(articlesOnly([withCategory('lease-guide', 'financial-reporting')]))
    await expect(visit('lease-accounting-2')).rejects.toBe(PERMANENT)
    expect(reader).toHaveBeenNthCalledWith(1, 'lease-accounting-2')
    expect(setReader).toHaveBeenCalledWith('lease-accounting-2')
    expect(reader).toHaveBeenNthCalledWith(2, 'lease-guide')
    expect(permanentRedirect).toHaveBeenCalledTimes(1)
    expect(permanentRedirect).toHaveBeenCalledWith('/study/financial-reporting/lease-guide')
  })

  it('follows a renamed question-set slug from the map', async () => {
    const target = 'coding-and-classification-of-accounting-data-practice-questions'
    setReader.mockImplementation(setsOnly([questionSet(target)]))
    await expect(visit('coding-and-classification-of-data-practice-questions')).rejects.toBe(PERMANENT)
    expect(setReader).toHaveBeenLastCalledWith(target)
    expect(permanentRedirect).toHaveBeenCalledWith('/practice-questions/' + target)
  })

  it.each([['lease-accounting-2'], ['coding-and-classification-of-data-practice-questions']])(
    'answers 404 when the map target is not published (%s)', async (old) => {
      await expect(visit(old)).rejects.toBe(NOT_FOUND)
      expect(permanentRedirect).not.toHaveBeenCalled()
      expect(redirect).not.toHaveBeenCalled()
    })

  it('lets a current article win over a map row with the same old slug', async () => {
    reader.mockImplementation(articlesOnly([withCategory('lease', 'ifrs'), withCategory('lease-accounting', 'ifrs')]))
    await expect(visit('lease')).rejects.toBe(PERMANENT)
    expect(reader).toHaveBeenCalledTimes(1)
    expect(permanentRedirect).toHaveBeenCalledWith('/study/ifrs/lease')
  })

  it.each([['beta-β'], ['beta-%CE%B2'], ['beta-%ce%b2'], ['beta-%25ce%25b2']])(
    'reads the %%xx article by its stored slug and redirects to its canonical path (%s)', async (param) => {
      reader.mockImplementation(articlesOnly([withCategory('beta-%ce%b2', 'financial-management')]))
      await expect(visit(param)).rejects.toBe(PERMANENT)
      expect(reader).toHaveBeenCalledWith('beta-%ce%b2')
      expect(permanentRedirect).toHaveBeenCalledWith('/study/financial-management/beta-%ce%b2')
    })

  it('sends the old beta address through the map to the stored %xx slug', async () => {
    reader.mockImplementation(articlesOnly([withCategory('beta-%ce%b2', 'financial-management')]))
    await expect(visit('beta-b')).rejects.toBe(PERMANENT)
    expect(reader).toHaveBeenLastCalledWith('beta-%ce%b2')
    expect(permanentRedirect).toHaveBeenCalledWith('/study/financial-management/beta-%ce%b2')
  })

  it('lets a question-set reader error reach the error page', async () => {
    const dbError = new Error('question_sets query failed (status 504)')
    setReader.mockRejectedValue(dbError)
    await expect(visit('lease-accounting-2')).rejects.toBe(dbError)
    expect(notFound).not.toHaveBeenCalled()
    expect(permanentRedirect).not.toHaveBeenCalled()
  })

  it.each([['fixed%2Fcosts'], ['fixed%20costs'], ['fixed%252Fcosts'], ['%zz'], ['%e0%a4']])(
    'refuses reserved or bad escapes without any read (%s)', async (param) => {
      await expect(visit(param)).rejects.toBe(NOT_FOUND)
      expect(reader).not.toHaveBeenCalled()
      expect(setReader).not.toHaveBeenCalled()
    })
})

describe('article pages read the stored slug', () => {
  const forms = [['beta-β'], ['beta-%CE%B2'], ['beta-%ce%b2'], ['beta-%25ce%25b2']]

  it.each(forms)('/articles/<slug> page and metadata read beta-%%ce%%b2 (%s)', async (slug) => {
    await expect(ArticlesPage({ params: Promise.resolve({ slug }) })).rejects.toBe(NOT_FOUND)
    expect(reader).toHaveBeenLastCalledWith('beta-%ce%b2')
    reader.mockClear()
    await expect(articlesMetadata({ params: Promise.resolve({ slug }) })).resolves.toEqual({ title: 'Page Not Found' })
    expect(reader).toHaveBeenLastCalledWith('beta-%ce%b2')
  })

  it.each(forms)('/study/<category>/<slug> page and metadata read beta-%%ce%%b2 (%s)', async (slug) => {
    const params = Promise.resolve({ category: 'financial-management', slug })
    await expect(StudyArticlePage({ params })).rejects.toBe(NOT_FOUND)
    expect(reader).toHaveBeenLastCalledWith('beta-%ce%b2')
    reader.mockClear()
    await expect(studyMetadata({ params })).resolves.toEqual({ title: 'Page Not Found' })
    expect(reader).toHaveBeenLastCalledWith('beta-%ce%b2')
  })

  it.each([['fixed%2Fcosts'], ['Fixed-Costs'], ['%zz']])('gives a 404 and the not-found metadata without a read (%s)', async (slug) => {
    await expect(ArticlesPage({ params: Promise.resolve({ slug }) })).rejects.toBe(NOT_FOUND)
    await expect(StudyArticlePage({ params: Promise.resolve({ category: 'x', slug }) })).rejects.toBe(NOT_FOUND)
    await expect(articlesMetadata({ params: Promise.resolve({ slug }) })).resolves.toEqual({ title: 'Page Not Found' })
    await expect(studyMetadata({ params: Promise.resolve({ category: 'x', slug }) })).resolves.toEqual({ title: 'Page Not Found' })
    expect(reader).not.toHaveBeenCalled()
  })
})

describe('article pages follow renamed slugs', () => {
  const capitalTarget = withCategory('equity-and-debt-capital', 'acca')

  it('/articles/capital redirects permanently to the target canonical path', async () => {
    reader.mockImplementation(articlesOnly([capitalTarget]))
    await expect(ArticlesPage({ params: Promise.resolve({ slug: 'capital' }) })).rejects.toBe(PERMANENT)
    expect(reader).toHaveBeenNthCalledWith(1, 'capital')
    expect(reader).toHaveBeenNthCalledWith(2, 'equity-and-debt-capital')
    expect(permanentRedirect).toHaveBeenCalledTimes(1)
    expect(permanentRedirect).toHaveBeenCalledWith('/study/acca/equity-and-debt-capital')
    expect(notFound).not.toHaveBeenCalled()
  })

  it('/study/<category>/capital redirects permanently to the same canonical path', async () => {
    reader.mockImplementation(articlesOnly([capitalTarget]))
    await expect(StudyArticlePage({ params: Promise.resolve({ category: 'x', slug: 'capital' }) })).rejects.toBe(PERMANENT)
    expect(permanentRedirect).toHaveBeenCalledTimes(1)
    expect(permanentRedirect).toHaveBeenCalledWith('/study/acca/equity-and-debt-capital')
    expect(notFound).not.toHaveBeenCalled()
  })

  it('follows a renamed question-set slug on both pages', async () => {
    const target = 'coding-and-classification-of-accounting-data-practice-questions'
    setReader.mockImplementation(setsOnly([questionSet(target)]))
    const old = 'coding-and-classification-of-data-practice-questions'
    await expect(ArticlesPage({ params: Promise.resolve({ slug: old }) })).rejects.toBe(PERMANENT)
    await expect(StudyArticlePage({ params: Promise.resolve({ category: 'x', slug: old }) })).rejects.toBe(PERMANENT)
    expect(vi.mocked(permanentRedirect).mock.calls).toEqual([['/practice-questions/' + target], ['/practice-questions/' + target]])
  })

  it('answers 404 for an unknown slug on both pages, with one read each', async () => {
    await expect(ArticlesPage({ params: Promise.resolve({ slug: 'no-such-article-zz' }) })).rejects.toBe(NOT_FOUND)
    await expect(StudyArticlePage({ params: Promise.resolve({ category: 'x', slug: 'no-such-article-zz' }) })).rejects.toBe(NOT_FOUND)
    expect(reader).toHaveBeenCalledTimes(2)
    expect(setReader).not.toHaveBeenCalled()
    expect(permanentRedirect).not.toHaveBeenCalled()
  })

  it('answers 404 when the map target is not published', async () => {
    await expect(ArticlesPage({ params: Promise.resolve({ slug: 'capital' }) })).rejects.toBe(NOT_FOUND)
    await expect(StudyArticlePage({ params: Promise.resolve({ category: 'x', slug: 'capital' }) })).rejects.toBe(NOT_FOUND)
    expect(permanentRedirect).not.toHaveBeenCalled()
  })

  it('lets a current article win: the page renders and no map lookup or redirect happens', async () => {
    // The page files use the classic JSX runtime here, as in
    // lib/course-section-pages.test.ts.
    const React = await vi.importActual<typeof import('react')>('react')
    vi.stubGlobal('React', React)
    reader.mockImplementation(articlesOnly([withCategory('capital', 'acca'), capitalTarget]))
    await expect(ArticlesPage({ params: Promise.resolve({ slug: 'capital' }) })).resolves.toBeTruthy()
    await expect(StudyArticlePage({ params: Promise.resolve({ category: 'acca', slug: 'capital' }) })).resolves.toBeTruthy()
    expect(reader).toHaveBeenCalledTimes(2)
    expect(reader).not.toHaveBeenCalledWith('equity-and-debt-capital')
    expect(permanentRedirect).not.toHaveBeenCalled()
    expect(notFound).not.toHaveBeenCalled()
  })

  it('lets a database error on the map target reach the error page on both pages', async () => {
    const dbError = new Error('getArticleBySlug: articles query failed (status 504)')
    reader.mockImplementation(async (slug: string) => { if (slug === 'capital') return null; throw dbError })
    await expect(ArticlesPage({ params: Promise.resolve({ slug: 'capital' }) })).rejects.toBe(dbError)
    await expect(StudyArticlePage({ params: Promise.resolve({ category: 'x', slug: 'capital' }) })).rejects.toBe(dbError)
    expect(notFound).not.toHaveBeenCalled()
    expect(permanentRedirect).not.toHaveBeenCalled()
  })
})
