import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// vitest compiles the page with the classic JSX transform, which reads a
// global React; Next's own build does not need this.
;(globalThis as { React?: typeof React }).React = React

// /articles shows every published article of the site, 50 to a page.

const NOT_FOUND = vi.hoisted(() => new Error('NEXT_NOT_FOUND'))
const H = vi.hoisted(() => ({ map: new Headers() }))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw NOT_FOUND }),
  useRouter: () => ({ push: () => {} }),
}))
vi.mock('next/headers', () => ({ headers: async () => H.map }))
vi.mock('@/lib/articles-list', () => ({ getPublishedArticlesForSite: vi.fn() }))

import { getPublishedArticlesForSite } from '@/lib/articles-list'
import ArticlesPage, { generateMetadata } from '@/app/articles/page'
import { articlesPageHref, parseArticlesPage } from '@/app/articles/pageUrl'

const reader = vi.mocked(getPublishedArticlesForSite)
const article = { id: 'a1', title: 'Accruals', slug: 'accruals', category: 'financial-accounting' }
const props = (page?: string | string[]) => ({ searchParams: Promise.resolve(page === undefined ? {} : { page }) })
const html = async (page?: string | string[]) => renderToStaticMarkup(await ArticlesPage(props(page)))
const canonical = async (page?: string | string[]) => {
  const m = await generateMetadata(props(page))
  return [m.alternates?.canonical, (m.openGraph as { url?: string } | undefined)?.url, m.robots]
}

beforeEach(() => {
  H.map = new Headers()
  reader.mockReset()
  // 2,017 articles: 41 pages, as the real reader answers.
  reader.mockImplementation(async (_site, page) => (page > 41 ? null : { articles: [article], total: 2017, totalPages: 41 }))
})

describe('the page number', () => {
  it.each([undefined, '', 'abc', '0', '-1', '1.5', '2abc', '02', ' 2', '1e2', ['2', '3'], []])('%o is page 1', (value) => {
    expect(parseArticlesPage(value)).toBe(1)
  })
  it.each([['1', 1], ['2', 2], ['41', 41], ['99999', 99999]])('%s is page %i', (value, want) => {
    expect(parseArticlesPage(value)).toBe(want)
  })
  it('page 1 has the plain address, every other page its own', () => {
    expect(articlesPageHref(1)).toBe('/articles')
    expect(articlesPageHref(2)).toBe('/articles?page=2')
  })
})

describe('which page is read', () => {
  it.each([[undefined, 1], ['abc', 1], ['2', 2], ['41', 41]])('?page=%s reads page %i of the Accounting Body list', async (value, want) => {
    await html(value)
    expect(reader.mock.calls).toEqual([['ab', want]])
  })
  it('the EthioTax view reads the EthioTax list and keeps its own words', async () => {
    H.map = new Headers({ 'x-et-platform': 'ethiotax' })
    const out = await html('2')
    expect(reader.mock.calls).toEqual([['et', 2]])
    expect(out).toContain('Latest from EthioTax')
    expect(out).toContain('2,017 articles · Page 2 of 41')
  })
  it.each(['42', '100000', '99999999999999999999999'])('a number above the last page (%s) is not found, page and metadata', async (value) => {
    await expect(ArticlesPage(props(value))).rejects.toBe(NOT_FOUND)
    await expect(generateMetadata(props(value))).rejects.toBe(NOT_FOUND)
  })
  it('a failed read is thrown, never shown as not found', async () => {
    const failed = new Error('getPublishedArticlesForSite: articles query failed (status 504)')
    reader.mockRejectedValue(failed)
    await expect(ArticlesPage(props('2'))).rejects.toBe(failed)
    await expect(generateMetadata(props('2'))).rejects.toBe(failed)
  })
})

describe('what the page shows', () => {
  it('the full total with a thousands separator, the page number, and real page links', async () => {
    const out = await html()
    expect(out).toContain('>2,017 articles · Page 1 of 41</p>')
    expect(out).toContain('<nav aria-label="Articles pages"')
    expect(out).toContain('href="/articles?page=2"')
    expect(out).toContain('href="/articles?page=41"')
    expect(await html('2')).toContain('aria-label="Previous page"')
    expect(await html('2')).toContain('href="/articles"')
  })
  it('the boundary control has a role, so its name is allowed', async () => {
    expect(await html()).toContain('<span role="link" aria-disabled="true" aria-label="Previous page"')
    expect(await html('41')).toContain('<span role="link" aria-disabled="true" aria-label="Next page"')
  })
  it('one page only: no page number and no pagination', async () => {
    reader.mockResolvedValue({ articles: [article], total: 31, totalPages: 1 })
    const out = await html()
    expect(out).toContain('>31 articles</p>')
    expect(out).not.toContain('Articles pages')
  })
  it('a genuine empty site keeps its own message', async () => {
    reader.mockResolvedValue({ articles: [], total: 0, totalPages: 1 })
    expect(await html()).toContain('Articles coming soon')
  })
})

describe('canonical: each page its own, on the owner domain, indexable', () => {
  const AB = 'https://accountingbody.com/articles'
  it.each([[undefined, AB], ['abc', AB], ['1', AB], ['2', `${AB}?page=2`], ['41', `${AB}?page=41`]])('?page=%s', async (value, want) => {
    expect(await canonical(value)).toEqual([want, want, undefined])
    H.map = new Headers({ 'x-et-platform': 'ethiotax', host: 'ethiotax.com' })
    expect(await canonical(value)).toEqual([want, want, undefined])
  })
  it('page 1 metadata reads nothing', async () => {
    await canonical()
    expect(reader).not.toHaveBeenCalled()
  })
})
