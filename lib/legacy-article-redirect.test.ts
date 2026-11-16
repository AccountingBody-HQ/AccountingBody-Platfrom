import { describe, it, expect, vi, beforeEach } from 'vitest'

// app/[slug]/page.tsx: an old WordPress article address /<slug> answers a
// permanent redirect to /articles/<slug> when that published article exists,
// and 404 otherwise. A path that is not slug-shaped never reaches the
// database, and a database error reaches the error page (500), never a 404.

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
}))

import { notFound, permanentRedirect, redirect } from 'next/navigation'
import { getArticleBySlug } from '@/lib/db'
import LegacyArticleRedirect from '@/app/[slug]/page'

const reader = vi.mocked(getArticleBySlug)
const visit = (slug: string) => LegacyArticleRedirect({ params: { slug } })
const article = (slug: string) => ({ id: 'a1', title: 'Fixed costs', slug }) as Awaited<ReturnType<typeof getArticleBySlug>>

beforeEach(() => {
  vi.mocked(notFound).mockClear()
  vi.mocked(permanentRedirect).mockClear()
  vi.mocked(redirect).mockClear()
  reader.mockReset()
  reader.mockResolvedValue(null)
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

  it('decodes the address once and URL-encodes the redirect target', async () => {
    reader.mockResolvedValue(article('caf%c3%a9'))
    await expect(visit('caf%25c3%25a9')).rejects.toBe(PERMANENT)
    expect(reader).toHaveBeenCalledWith('caf%c3%a9')
    expect(permanentRedirect).toHaveBeenCalledWith('/articles/caf%25c3%25a9')
  })

  it('redirects to the slug stored on the article row', async () => {
    reader.mockResolvedValue(article('fixed-costs-explained'))
    await expect(visit('fixed-costs')).rejects.toBe(PERMANENT)
    expect(permanentRedirect).toHaveBeenCalledWith('/articles/fixed-costs-explained')
  })
})
