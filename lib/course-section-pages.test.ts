import { describe, it, expect, vi, beforeEach } from 'vitest'
import React, { isValidElement, type ReactNode } from 'react'

// The five ETICPA module pages show a course section when the course can be
// read. If the read fails, the page still renders, without that section.
// The lesson pages' build-time list skips a course whose read fails.

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (name: string) => (name === 'x-et-platform' ? 'ethiotax' : null) }),
}))
vi.mock('@/lib/canonical', () => ({
  canonicalMetadata: async () => ({}),
  resolveArticlePath: () => '/x',
}))
vi.mock('@/lib/db', () => ({
  getETICPAModuleArticles: vi.fn(async () => []),
}))
vi.mock('@/lib/coursesNew', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/coursesNew')>()),
  getCourseBySlug: vi.fn(),
  getLessonData: vi.fn(),
  getPublishedCourses: vi.fn(async () => []),
}))

import { getCourseBySlug, getPublishedCourses, type Course } from '@/lib/coursesNew'
import CostAccountingPage from '@/app/study/eticpa/atq/level-1/cost-accounting/page'
import IntroductionToAccountingPage from '@/app/study/eticpa/atq/level-1/introduction-to-accounting/page'
import AssuranceControlsEthicsPage from '@/app/study/eticpa/atq/level-2/assurance-controls-ethics/page'
import FinancialAccountingPage from '@/app/study/eticpa/atq/level-2/financial-accounting/page'
import ManagementAccountingPage from '@/app/study/eticpa/atq/level-2/management-accounting/page'
import { generateStaticParams } from '@/app/free-courses/[slug]/learn/[lessonSlug]/page'

vi.stubGlobal('React', React)

const MARKER = 'Chapter title for this test'

function course(slug: string, lessonSlugs: string[]): Course {
  return {
    id: `id-${slug}`,
    title: `Course ${slug}`,
    slug,
    status: 'published',
    isFeatured: false,
    showOnSites: [],
    canonicalOwner: 'ab',
    chapters: [
      {
        id: 'ch-1',
        title: MARKER,
        chapterOrder: 1,
        lessons: lessonSlugs.map((lessonSlug, index) => ({
          id: `l-${index}`,
          title: `Lesson ${lessonSlug}`,
          slug: lessonSlug,
          lessonOrder: index + 1,
          articles: [],
        })),
      },
    ],
  }
}

// Collects every string in an element tree (page components return plain
// elements; nested components are not rendered, which is enough here
// because the course section is written inline in each page).
function texts(node: ReactNode, out: string[] = []): string[] {
  if (typeof node === 'string' || typeof node === 'number') out.push(String(node))
  else if (Array.isArray(node)) for (const child of node) texts(child, out)
  else if (isValidElement(node)) texts((node.props as { children?: ReactNode }).children, out)
  return out
}

const pages: [string, () => Promise<ReactNode>][] = [
  ['cost accounting', CostAccountingPage],
  ['introduction to accounting', IntroductionToAccountingPage],
  ['assurance, controls and ethics', AssuranceControlsEthicsPage],
  ['financial accounting', FinancialAccountingPage],
  ['management accounting', ManagementAccountingPage],
]

beforeEach(() => {
  vi.mocked(getCourseBySlug).mockReset()
  vi.mocked(getPublishedCourses).mockReset()
})

describe.each(pages)('ETICPA %s module page', (_name, Page) => {
  it('shows the course section when the course is found', async () => {
    vi.mocked(getCourseBySlug).mockResolvedValue(course('module', ['one']))
    expect(texts(await Page())).toContain(MARKER)
  })

  it('renders without the course section when the course does not exist', async () => {
    vi.mocked(getCourseBySlug).mockResolvedValue(null)
    const tree = await Page()
    expect(tree).toBeTruthy()
    expect(texts(tree)).not.toContain(MARKER)
  })

  it('renders without the course section when the course read fails', async () => {
    vi.mocked(getCourseBySlug).mockRejectedValue(new Error('courses query failed (status 0)'))
    const tree = await Page()
    expect(tree).toBeTruthy()
    expect(texts(tree)).not.toContain(MARKER)
  })
})

describe('lesson pages build-time list', () => {
  it('lists every lesson of every course that can be read', async () => {
    vi.mocked(getPublishedCourses).mockResolvedValue([{ slug: 'a' }, { slug: 'b' }] as never)
    vi.mocked(getCourseBySlug).mockImplementation(async (slug) => course(slug, [`${slug}-1`, `${slug}-2`]))
    expect(await generateStaticParams()).toEqual([
      { slug: 'a', lessonSlug: 'a-1' },
      { slug: 'a', lessonSlug: 'a-2' },
      { slug: 'b', lessonSlug: 'b-1' },
      { slug: 'b', lessonSlug: 'b-2' },
    ])
  })

  it('skips a course that no longer exists', async () => {
    vi.mocked(getPublishedCourses).mockResolvedValue([{ slug: 'a' }, { slug: 'b' }] as never)
    vi.mocked(getCourseBySlug).mockImplementation(async (slug) => (slug === 'a' ? null : course(slug, ['b-1'])))
    expect(await generateStaticParams()).toEqual([{ slug: 'b', lessonSlug: 'b-1' }])
  })

  it('skips a course whose read fails and keeps the others', async () => {
    vi.mocked(getPublishedCourses).mockResolvedValue([{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }] as never)
    vi.mocked(getCourseBySlug).mockImplementation(async (slug) => {
      if (slug === 'b') throw new Error('course_lessons query failed')
      return course(slug, [`${slug}-1`])
    })
    expect(await generateStaticParams()).toEqual([
      { slug: 'a', lessonSlug: 'a-1' },
      { slug: 'c', lessonSlug: 'c-1' },
    ])
  })
})
