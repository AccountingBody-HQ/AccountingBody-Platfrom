import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getServerSupabase } from './supabase-server'
import { reportServerError } from './report-error'
import { getPublishedCourses, getPublishedCoursesOrThrow } from './coursesNew'

vi.mock('./supabase-server', () => ({ getServerSupabase: vi.fn() }))
vi.mock('./report-error', () => ({ reportServerError: vi.fn() }))

type Result = { data: unknown; error: unknown; status: number }

// A fake client in the style of lib/featured-articles.test.ts: every chain
// method returns the builder and awaiting it gives the scripted answer for
// that table.
function use(answers: Record<string, Result>) {
  const tables: string[] = []
  const client = {
    from: (table: string) => {
      tables.push(table)
      const builder: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'order', 'contains']) {
        builder[m] = () => builder
      }
      const result = answers[table] ?? { data: null, error: { code: 'TEST' }, status: 500 }
      builder.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej)
      return builder
    },
  }
  vi.mocked(getServerSupabase).mockImplementation((() => client) as unknown as typeof getServerSupabase)
  return { tables }
}

const LABEL = 'free courses read failed'
const SEED = /seed detail|seed-person/
const DB_PROBLEM = { code: 'XX000', message: 'seed detail seed-person@example.com', details: 'seed detail', hint: null }
const FAILED: Result = { data: null, error: DB_PROBLEM, status: 500 }

const COURSES = [
  { id: 'c1', title: 'Bookkeeping', slug: 'bookkeeping', description: 'Seed', level: 'Beginner', status: 'published', is_featured: true, show_on_sites: ['ab'], canonical_owner: 'ab' },
  { id: 'c2', title: 'Tax', slug: 'tax', description: null, level: null, status: 'published', is_featured: false, show_on_sites: ['ab'], canonical_owner: 'ab' },
]
const CHAPTERS = [
  { id: 'h1', course_id: 'c1' },
  { id: 'h2', course_id: 'c1' },
  { id: 'h3', course_id: 'c2' },
]
const LESSONS = [
  { id: 'l1', chapter_id: 'h1' },
  { id: 'l2', chapter_id: 'h1' },
  { id: 'l3', chapter_id: 'h2' },
]
const OK = {
  courses:         { data: COURSES, error: null, status: 200 },
  course_chapters: { data: CHAPTERS, error: null, status: 200 },
  course_lessons:  { data: LESSONS, error: null, status: 200 },
}
const EXPECTED = [
  { id: 'c1', title: 'Bookkeeping', slug: 'bookkeeping', description: 'Seed', level: 'Beginner', status: 'published', isFeatured: true, showOnSites: ['ab'], canonicalOwner: 'ab', chapterCount: 2, lessonCount: 3 },
  { id: 'c2', title: 'Tax', slug: 'tax', description: undefined, level: undefined, status: 'published', isFeatured: false, showOnSites: ['ab'], canonicalOwner: 'ab', chapterCount: 1, lessonCount: 0 },
]

beforeEach(() => {
  vi.mocked(getServerSupabase).mockReset()
  vi.mocked(reportServerError).mockReset()
})

async function thrown(p: Promise<unknown>): Promise<Error & { code?: string }> {
  try {
    await p
  } catch (e) {
    return e as Error & { code?: string }
  }
  throw new Error('expected a throw')
}

describe('getPublishedCoursesOrThrow', () => {
  it('a courses error throws fixed text with the short code only', async () => {
    use({ courses: FAILED })
    const e = await thrown(getPublishedCoursesOrThrow('ab'))
    expect(e.message).toBe('getPublishedCourses: courses query failed (status 500)')
    expect(e.code).toBe('XX000')
    expect(e.message).not.toMatch(SEED)
  })

  it('a course_chapters error throws', async () => {
    use({ ...OK, course_chapters: FAILED })
    const e = await thrown(getPublishedCoursesOrThrow('ab'))
    expect(e.message).toBe('getPublishedCourses: course_chapters query failed (status 500)')
    expect(e.code).toBe('XX000')
    expect(e.message).not.toMatch(SEED)
  })

  it('a course_lessons error throws', async () => {
    use({ ...OK, course_lessons: FAILED })
    const e = await thrown(getPublishedCoursesOrThrow('ab'))
    expect(e.message).toBe('getPublishedCourses: course_lessons query failed (status 500)')
    expect(e.code).toBe('XX000')
    expect(e.message).not.toMatch(SEED)
  })

  it('success returns the course summaries with chapter and lesson counts', async () => {
    const { tables } = use(OK)
    expect(await getPublishedCoursesOrThrow('ab')).toStrictEqual(EXPECTED)
    expect(tables).toEqual(['courses', 'course_chapters', 'course_lessons'])
    expect(reportServerError).not.toHaveBeenCalled()
  })

  it('a genuine empty result is an empty list', async () => {
    use({ courses: { data: [], error: null, status: 200 } })
    expect(await getPublishedCoursesOrThrow('ab')).toStrictEqual([])
    use({ courses: { data: null, error: null, status: 204 } })
    expect(await getPublishedCoursesOrThrow()).toStrictEqual([])
    expect(reportServerError).not.toHaveBeenCalled()
  })
})

describe('getPublishedCourses (build-time fallback)', () => {
  for (const [stage, answers] of [
    ['courses', { courses: FAILED }],
    ['course_chapters', { ...OK, course_chapters: FAILED }],
    ['course_lessons', { ...OK, course_lessons: FAILED }],
  ] as const) {
    it(`a ${stage} error gives an empty list and one report with the fixed label`, async () => {
      use(answers)
      expect(await getPublishedCourses()).toStrictEqual([])
      expect(reportServerError).toHaveBeenCalledTimes(1)
      const [label, error, extra] = vi.mocked(reportServerError).mock.calls[0]
      expect(label).toBe(LABEL)
      expect((error as Error).message).toBe(`getPublishedCourses: ${stage} query failed (status 500)`)
      expect(extra).toEqual({ area: 'public' })
    })
  }

  it('success returns the same summaries and reports nothing', async () => {
    use(OK)
    expect(await getPublishedCourses()).toStrictEqual(EXPECTED)
    expect(reportServerError).not.toHaveBeenCalled()
  })
})
