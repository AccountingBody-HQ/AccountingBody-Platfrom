import { describe, it, expect, vi, beforeEach } from 'vitest'

// The five public pages whose item comes from one reader. A missing item
// must call notFound() (404); a database error must reach the error page
// (500), so notFound() must not be called and the error must propagate.

const NOT_FOUND = vi.hoisted(() => new Error('NEXT_NOT_FOUND'))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw NOT_FOUND }),
  redirect: vi.fn(),
}))
vi.mock('next/headers', () => ({
  headers: async () => ({ get: () => null }),
}))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
vi.mock('@/lib/canonical', () => ({
  canonicalMetadata: async () => ({}),
  resolveArticlePath: () => '/x',
}))
vi.mock('@/lib/db', () => ({
  getQuestionSetBySlug: vi.fn(),
  getQuestionsBySetId: vi.fn(async () => []),
  getCasesBySetId: vi.fn(async () => []),
  getArticleBySlug: vi.fn(async () => null),
}))
vi.mock('@/lib/jobs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/jobs')>()),
  getJobBySlug: vi.fn(),
  getJobById: vi.fn(),
  getSimilarJobs: vi.fn(async () => []),
}))
vi.mock('@/lib/coursesNew', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/coursesNew')>()),
  getCourseBySlug: vi.fn(),
  getLessonData: vi.fn(),
  getPublishedCourses: vi.fn(async () => []),
}))

import { notFound } from 'next/navigation'
import { getQuestionSetBySlug } from '@/lib/db'
import { getJobBySlug, getJobById } from '@/lib/jobs'
import { getCourseBySlug, getLessonData } from '@/lib/coursesNew'
import PracticePostPage, { generateMetadata as practiceMetadata } from '@/app/practice-questions/[slug]/page'
import JobDetailPage, { generateMetadata as jobMetadata } from '@/app/jobs/[slug]/page'
import ApplyToJobPage from '@/app/jobs/apply/[id]/page'
import FreeCoursesSlugPage, { generateMetadata as courseMetadata } from '@/app/free-courses/[slug]/page'
import FreeCoursesLessonPage, { generateMetadata as lessonMetadata } from '@/app/free-courses/[slug]/learn/[lessonSlug]/page'

const dbError = new Error('question_sets query failed (status 504): upstream request timeout')

type Case = {
  name: string
  reader: ReturnType<typeof vi.fn>
  page: () => Promise<unknown>
  metadata?: () => Promise<unknown>
}
const cases: Case[] = [
  {
    name: 'practice set',
    reader: vi.mocked(getQuestionSetBySlug),
    page: () => PracticePostPage({ params: Promise.resolve({ slug: 'budgeting' }) }),
    metadata: () => practiceMetadata({ params: Promise.resolve({ slug: 'budgeting' }) }),
  },
  {
    name: 'job',
    reader: vi.mocked(getJobBySlug),
    page: () => JobDetailPage({ params: Promise.resolve({ slug: 'tax-manager' }) }),
    metadata: () => jobMetadata({ params: Promise.resolve({ slug: 'tax-manager' }) }),
  },
  {
    name: 'job apply',
    reader: vi.mocked(getJobById),
    page: () => ApplyToJobPage({ params: Promise.resolve({ id: '0f8fad5b-d9cb-469f-a165-70867728950e' }) }),
  },
  {
    name: 'course',
    reader: vi.mocked(getCourseBySlug),
    page: () => FreeCoursesSlugPage({ params: { slug: 'cost-accounting' } }),
    metadata: () => courseMetadata({ params: { slug: 'cost-accounting' } }),
  },
  {
    name: 'lesson',
    reader: vi.mocked(getLessonData),
    page: () => FreeCoursesLessonPage({ params: { slug: 'cost-accounting', lessonSlug: 'costs' } }),
    metadata: () => lessonMetadata({ params: { slug: 'cost-accounting', lessonSlug: 'costs' } }),
  },
]

beforeEach(() => {
  vi.mocked(notFound).mockClear()
  for (const c of cases) c.reader.mockReset()
})

describe.each(cases)('$name page', ({ reader, page, metadata }) => {
  it('calls notFound() when the item does not exist', async () => {
    reader.mockResolvedValue(null)
    await expect(page()).rejects.toBe(NOT_FOUND)
    expect(notFound).toHaveBeenCalledTimes(1)
  })

  it('lets a database error reach the error page, without calling notFound()', async () => {
    reader.mockRejectedValue(dbError)
    await expect(page()).rejects.toBe(dbError)
    expect(notFound).not.toHaveBeenCalled()
  })

  if (metadata) {
    it('metadata lets a database error through as well', async () => {
      reader.mockRejectedValue(dbError)
      await expect(metadata()).rejects.toBe(dbError)
      expect(notFound).not.toHaveBeenCalled()
    })
  }
})
