import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as React from 'react'

// vitest compiles the page with the classic JSX transform, which reads a
// global React; Next's own build does not need this.
;(globalThis as { React?: typeof React }).React = React

// /study/<category>: a category that is in neither known list and has no
// published articles must call notFound() (404). A known category keeps its
// empty state, any category with articles keeps working, and a database error
// must reach the error page (500), so notFound() must not be called then.

const NOT_FOUND = vi.hoisted(() => new Error('NEXT_NOT_FOUND'))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw NOT_FOUND }),
  redirect: vi.fn(),
}))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
vi.mock('@/lib/canonical', () => ({
  canonicalMetadata: async () => ({}),
}))
vi.mock('@/lib/db', () => ({
  getArticlesByCategory: vi.fn(async () => []),
}))

import { notFound } from 'next/navigation'
import { getArticlesByCategory } from '@/lib/db'
import CategoryPage, { generateMetadata } from '@/app/study/[category]/page'

const reader = vi.mocked(getArticlesByCategory)
const dbError = new Error('getArticlesByCategory: articles query failed (status 504)')

const oneArticle = [{
  id: 'a1', title: 'Accruals', slug: 'accruals', excerpt: null, category: 'zz-unlisted',
  category_title: null, exam_body: null, read_time: null, published_at: null, author_name: null,
}] as unknown as Awaited<ReturnType<typeof getArticlesByCategory>>

const callers = [
  { name: 'page', call: (category: string) => CategoryPage({ params: Promise.resolve({ category }), searchParams: Promise.resolve({}) }) },
  { name: 'generateMetadata', call: (category: string) => generateMetadata({ params: Promise.resolve({ category }), searchParams: Promise.resolve({}) }) },
]

beforeEach(() => {
  vi.mocked(notFound).mockClear()
  reader.mockReset()
  reader.mockResolvedValue([])
})

describe.each(callers)('/study/<category> $name', ({ call }) => {
  it('(a) unknown category with 0 articles calls notFound once', async () => {
    await expect(call('zz-not-a-category')).rejects.toBe(NOT_FOUND)
    expect(notFound).toHaveBeenCalledTimes(1)
  })

  it('(b) known exam body with 0 articles keeps the empty state', async () => {
    await expect(call('acca')).resolves.toBeDefined()
    expect(notFound).not.toHaveBeenCalled()
  })

  it('(c) known subject with 0 articles keeps the empty state', async () => {
    await expect(call('mock-exams')).resolves.toBeDefined()
    expect(notFound).not.toHaveBeenCalled()
  })

  it('(d) unknown category with 1 article keeps working', async () => {
    reader.mockResolvedValue(oneArticle)
    await expect(call('zz-unlisted')).resolves.toBeDefined()
    expect(notFound).not.toHaveBeenCalled()
  })

  it('(e) upper-case known category with 0 articles keeps the empty state', async () => {
    await expect(call('ACCA')).resolves.toBeDefined()
    expect(notFound).not.toHaveBeenCalled()
  })

  it('(f) an object prototype key is not a known category', async () => {
    await expect(call('constructor')).rejects.toBe(NOT_FOUND)
    expect(notFound).toHaveBeenCalledTimes(1)
  })

  it('(g) a database error propagates and notFound is not called', async () => {
    reader.mockRejectedValue(dbError)
    await expect(call('zz-not-a-category')).rejects.toBe(dbError)
    expect(notFound).not.toHaveBeenCalled()
  })
})
