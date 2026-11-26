import { beforeEach, describe, expect, it, vi } from 'vitest'

// W0-1 C6 (D327): on Accounting Body an article reached as
// /study/<eticpa…>/<slug> redirects permanently to /articles/<slug>; on
// EthioTax, and for every other category, the page renders as before.

const NOT_FOUND = vi.hoisted(() => new Error('NEXT_NOT_FOUND'))
const PERMANENT = vi.hoisted(() => new Error('NEXT_PERMANENT_REDIRECT'))
const brand = vi.hoisted(() => ({ ethiotax: false }))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw NOT_FOUND }),
  permanentRedirect: vi.fn(() => { throw PERMANENT }),
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
  headers: async () => ({ get: (name: string) => (name === 'x-et-platform' && brand.ethiotax ? 'ethiotax' : null) }),
}))
vi.mock('@/lib/canonical', () => ({
  resolveArticleCanonical: () => ({ alternates: {}, openGraph: { url: 'https://example.test/x' } }),
  ownerUrl: (_owner: string, path: string) => `https://example.test${path}`,
  AB_URL: 'https://accountingbody.com',
  ET_URL: 'https://ethiotax.com',
}))

import { permanentRedirect } from 'next/navigation'
import { getArticleBySlug } from '@/lib/db'
import StudyArticlePage from '@/app/study/[category]/[slug]/page'
import { studyEticpaRedirect } from './study-eticpa-redirect'

const reader = vi.mocked(getArticleBySlug)
const row = (slug: string) => ({ id: 'a1', title: 'T', slug, category: 'acca' }) as Awaited<ReturnType<typeof getArticleBySlug>>
const visit = (category: string, slug: string) => StudyArticlePage({ params: Promise.resolve({ category, slug }) })

beforeEach(async () => {
  brand.ethiotax = false
  vi.mocked(permanentRedirect).mockClear()
  reader.mockReset()
  reader.mockResolvedValue(null)
  vi.stubGlobal('React', await vi.importActual<typeof import('react')>('react'))
})

describe('studyEticpaRedirect', () => {
  it.each([
    ['ab', 'eticpa-atq', '/articles/lease-guide'],
    ['ab', 'ETICPA-ATQ', '/articles/lease-guide'],
    ['ab', ' eticpa-cpa ', '/articles/lease-guide'],
    ['ab', 'eticpa', '/articles/lease-guide'],
    ['ab', 'acca', null],
    ['ab', 'my-eticpa', null],
    ['ab', '', null],
    ['et', 'eticpa-atq', null],
    ['et', 'eticpa', null],
    ['et', 'acca', null],
  ])('%s, category %j: %s', (site, category, target) => {
    expect(studyEticpaRedirect(site === 'et', category, 'lease-guide')).toBe(target)
  })
})

describe('/study/<category>/<slug>', () => {
  it('Accounting Body: an eticpa category redirects once to the slug stored on the row', async () => {
    reader.mockResolvedValue(row('caf%c3%a9'))
    await expect(visit('eticpa-atq', 'caf%C3%A9')).rejects.toBe(PERMANENT)
    expect(reader).toHaveBeenCalledWith('caf%c3%a9')
    expect(vi.mocked(permanentRedirect).mock.calls).toEqual([['/articles/caf%c3%a9']])
  })

  it('Accounting Body: any other category renders, without a redirect', async () => {
    reader.mockResolvedValue(row('lease-guide'))
    await expect(visit('acca', 'lease-guide')).resolves.toBeTruthy()
    expect(permanentRedirect).not.toHaveBeenCalled()
  })

  it('EthioTax: an eticpa category renders, without a redirect', async () => {
    brand.ethiotax = true
    reader.mockResolvedValue(row('lease-guide'))
    await expect(visit('eticpa-atq', 'lease-guide')).resolves.toBeTruthy()
    expect(permanentRedirect).not.toHaveBeenCalled()
  })

  it('Accounting Body: an unknown article under an eticpa category is still a 404', async () => {
    await expect(visit('eticpa-atq', 'no-such-article-zz')).rejects.toBe(NOT_FOUND)
    expect(permanentRedirect).not.toHaveBeenCalled()
  })
})
