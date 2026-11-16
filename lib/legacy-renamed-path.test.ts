import { describe, it, expect, vi, beforeEach } from 'vitest'

// resolveLegacyRenamedPath: an old renamed slug from the frozen map gives the
// target's current page, or null. Reader errors are not caught.

vi.mock('@/lib/db', () => ({
  getArticleBySlug: vi.fn(async () => null),
  getPublicQuestionSetBySlug: vi.fn(async () => null),
}))

import { getArticleBySlug, getPublicQuestionSetBySlug } from '@/lib/db'
import { resolveLegacyRenamedPath } from './legacy-renamed-path'

type Article = Awaited<ReturnType<typeof getArticleBySlug>>
type QuestionSetRow = Awaited<ReturnType<typeof getPublicQuestionSetBySlug>>
const reader = vi.mocked(getArticleBySlug)
const setReader = vi.mocked(getPublicQuestionSetBySlug)

beforeEach(() => {
  reader.mockReset()
  reader.mockResolvedValue(null)
  setReader.mockReset()
  setReader.mockResolvedValue(null)
})

describe('resolveLegacyRenamedPath', () => {
  it('gives the canonical path of a found article target', async () => {
    reader.mockResolvedValue({ id: 'a', title: 'T', slug: 'equity-and-debt-capital', category: 'acca' } as Article)
    await expect(resolveLegacyRenamedPath('capital')).resolves.toBe('/study/acca/equity-and-debt-capital')
    expect(reader).toHaveBeenCalledWith('equity-and-debt-capital')
    expect(setReader).not.toHaveBeenCalled()
  })

  it('gives /articles/<slug> for a found article target without a category', async () => {
    reader.mockResolvedValue({ id: 'a', title: 'T', slug: 'bond-guide', category: '' } as Article)
    await expect(resolveLegacyRenamedPath('bond')).resolves.toBe('/articles/bond-guide')
  })

  it('gives null when the article target is missing', async () => {
    await expect(resolveLegacyRenamedPath('capital')).resolves.toBeNull()
    expect(setReader).not.toHaveBeenCalled()
  })

  it('gives /practice-questions/<slug> for a found question-set target', async () => {
    const target = 'coding-and-classification-of-accounting-data-practice-questions'
    setReader.mockResolvedValue({ id: 's', title: 'S', slug: target } as QuestionSetRow)
    await expect(resolveLegacyRenamedPath('coding-and-classification-of-data-practice-questions')).resolves.toBe('/practice-questions/' + target)
    expect(setReader).toHaveBeenCalledWith(target)
    expect(reader).not.toHaveBeenCalled()
  })

  it('gives null when the question-set target is missing', async () => {
    await expect(resolveLegacyRenamedPath('coding-and-classification-of-data-practice-questions')).resolves.toBeNull()
  })

  it('gives null for a slug not in the map, without any read', async () => {
    await expect(resolveLegacyRenamedPath('no-such-article-zz')).resolves.toBeNull()
    expect(reader).not.toHaveBeenCalled()
    expect(setReader).not.toHaveBeenCalled()
  })

  it('rethrows a reader error', async () => {
    const dbError = new Error('read failed')
    reader.mockRejectedValue(dbError)
    await expect(resolveLegacyRenamedPath('capital')).rejects.toBe(dbError)
    setReader.mockRejectedValue(dbError)
    await expect(resolveLegacyRenamedPath('coding-and-classification-of-data-practice-questions')).rejects.toBe(dbError)
  })
})
