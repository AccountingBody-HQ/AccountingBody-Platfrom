import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { getQuestionSetBySlug } from './db'
import { getJobById, getJobBySlug } from './jobs'
import { getCourseBySlug, getLessonData } from './coursesNew'
import { resetCacheGuard } from './cache-guard'

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))
// Same reasons as lib/db.test.ts: no real React cache() or Next incremental
// cache outside a Next server.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}))

type Result = { data: unknown; error: unknown; status: number }

// A fake client whose answer depends on the table queried. Every chain
// method returns the builder; awaiting it (or calling .single()) gives the
// scripted answer for that table.
function fakeClient(byTable: Record<string, Result>) {
  return {
    from: (table: string) => {
      const answer = () => Promise.resolve(byTable[table] ?? { data: [], error: null, status: 200 })
      const builder: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'order', 'contains']) builder[m] = () => builder
      builder.single = answer
      builder.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => answer().then(res, rej)
      return builder
    },
  }
}
function use(byTable: Record<string, Result>) {
  vi.mocked(createClient).mockReturnValue(fakeClient(byTable) as unknown as ReturnType<typeof createClient>)
}

// How PostgREST and postgrest-js report each case (see the report for the
// source lines): zero rows from .single() is 406 + PGRST116; a gateway
// problem is a 5xx; a network failure or an aborted request is status 0.
const missing: Result = { data: null, error: { code: 'PGRST116', details: 'The result contains 0 rows', message: 'JSON object requested, multiple (or no) rows returned' }, status: 406 }
const failures: Array<[string, Result]> = [
  ['a 503 from the gateway', { data: null, error: { code: '', message: 'Service Unavailable' }, status: 503 }],
  ['a 504 from the gateway', { data: null, error: { code: '', message: 'upstream request timeout' }, status: 504 }],
  ['a network failure (status 0)', { data: null, error: { code: '', message: 'TypeError: fetch failed' }, status: 0 }],
  ['an aborted request (status 0)', { data: null, error: { code: '', message: 'AbortError: This operation was aborted', hint: 'Request was aborted (timeout or manual cancellation)' }, status: 0 }],
  ['a statement time-out', { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' }, status: 500 }],
  ['PGRST116 with a non-406 status', { data: null, error: { code: 'PGRST116', message: 'x' }, status: 500 }],
  ['406 with a different code', { data: null, error: { code: 'PGRST106', message: 'x' }, status: 406 }],
  ['no error and no data', { data: null, error: null, status: 204 }],
]

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  resetCacheGuard()
})

const set = { id: 's1', title: 'Budgeting', slug: 'budgeting', status: 'published' }
const job = { id: '0f8fad5b-d9cb-469f-a165-70867728950e', slug: 'tax-manager', title: 'Tax Manager', status: 'active', platform: ['ab'] }

describe.each([
  ['getQuestionSetBySlug', 'question_sets', set, () => getQuestionSetBySlug('budgeting')],
  ['getJobBySlug', 'jobs', job, () => getJobBySlug('tax-manager')],
  ['getJobById', 'jobs', job, () => getJobById(job.id)],
] as const)('%s', (_name, table, row, run) => {
  it('returns the row when it exists', async () => {
    use({ [table]: { data: row, error: null, status: 200 } })
    expect(await run()).toEqual(row)
  })

  it('returns null when no row matches (406 + PGRST116)', async () => {
    use({ [table]: missing })
    expect(await run()).toBeNull()
  })

  it.each(failures)('throws on %s', async (_label, result) => {
    use({ [table]: result })
    await expect(run()).rejects.toThrow()
  })
})

describe('getJobById — an id that is not a uuid', () => {
  it('returns null, because such an id can match no job', async () => {
    use({ jobs: { data: null, error: { code: '22P02', message: 'invalid input syntax for type uuid: "abc"' }, status: 400 } })
    expect(await getJobById('abc')).toBeNull()
  })

  it('the same code is not treated as missing by the slug readers', async () => {
    const bad = { data: null, error: { code: '22P02', message: 'invalid input syntax' }, status: 400 }
    use({ jobs: bad, question_sets: bad })
    await expect(getJobBySlug('x')).rejects.toThrow()
    await expect(getQuestionSetBySlug('x')).rejects.toThrow()
  })
})

const courseRow = { id: 'c1', title: 'Cost Accounting', slug: 'cost-accounting', description: 'd', level: 'beginner', status: 'published', is_featured: false, show_on_sites: ['ab'], canonical_owner: 'ab' }
const healthyCourse: Record<string, Result> = {
  courses: { data: courseRow, error: null, status: 200 },
  course_chapters: { data: [{ id: 'ch1', chapter_title: 'Basics', chapter_order: 1 }], error: null, status: 200 },
  course_lessons: { data: [{ id: 'l1', title: 'Costs', slug: 'costs', lesson_order: 1, chapter_id: 'ch1', estimated_time: null, video_url: null, audio_url: null, external_quiz_url: null }], error: null, status: 200 },
  course_lesson_articles: { data: [{ lesson_id: 'l1', article_order: 1, article_id: 'a1' }], error: null, status: 200 },
  articles: { data: [{ id: 'a1', title: 'Fixed costs', slug: 'fixed-costs', excerpt: null, read_time: 5, content_id: null, wp_id: null }], error: null, status: 200 },
}
const expectedCourse = {
  id: 'c1', title: 'Cost Accounting', slug: 'cost-accounting', description: 'd', metaDescription: 'd', level: 'beginner',
  status: 'published', isFeatured: false, showOnSites: ['ab'], canonicalOwner: 'ab',
  chapters: [{ id: 'ch1', title: 'Basics', chapterOrder: 1, lessons: [{
    id: 'l1', title: 'Costs', slug: 'costs', lessonOrder: 1, estimatedTime: undefined, videoUrl: undefined, audioUrl: undefined, externalQuizUrl: undefined,
    articles: [{ id: 'a1', title: 'Fixed costs', slug: 'fixed-costs', excerpt: undefined, readTime: 5, contentId: undefined, wpId: undefined }],
  }] }],
}

describe('getCourseBySlug', () => {
  it('returns the assembled course when it exists', async () => {
    use(healthyCourse)
    expect(await getCourseBySlug('cost-accounting')).toEqual(expectedCourse)
  })

  it('returns null when no course matches (406 + PGRST116)', async () => {
    use({ ...healthyCourse, courses: missing })
    expect(await getCourseBySlug('nope')).toBeNull()
  })

  it('returns null for an unpublished course outside admin mode, and the course in admin mode', async () => {
    use({ ...healthyCourse, courses: { data: { ...courseRow, status: 'draft' }, error: null, status: 200 } })
    expect(await getCourseBySlug('cost-accounting')).toBeNull()
    expect(await getCourseBySlug('cost-accounting', true)).toMatchObject({ slug: 'cost-accounting', status: 'draft' })
  })

  it.each(failures)('throws on %s for the course row', async (_label, result) => {
    use({ ...healthyCourse, courses: result })
    await expect(getCourseBySlug('cost-accounting')).rejects.toThrow()
  })

  it.each(['course_chapters', 'course_lessons', 'course_lesson_articles', 'articles'])(
    'throws when the %s query fails, instead of returning a course with parts missing',
    async (table) => {
      use({ ...healthyCourse, [table]: { data: null, error: { code: '', message: 'upstream request timeout' }, status: 504 } })
      await expect(getCourseBySlug('cost-accounting', true)).rejects.toThrow(table)
    }
  )
})

describe('getLessonData', () => {
  it('returns the lesson when the course and lesson exist', async () => {
    use(healthyCourse)
    const data = await getLessonData('cost-accounting', 'costs')
    expect(data?.lesson.slug).toBe('costs')
    expect(data?.course.slug).toBe('cost-accounting')
  })

  it('returns null when the course does not exist or the lesson is not in it', async () => {
    use({ ...healthyCourse, courses: missing })
    expect(await getLessonData('nope', 'costs')).toBeNull()
    use(healthyCourse)
    expect(await getLessonData('cost-accounting', 'no-such-lesson')).toBeNull()
  })

  it('throws when the course cannot be read', async () => {
    use({ ...healthyCourse, courses: failures[1][1] })
    await expect(getLessonData('cost-accounting', 'costs')).rejects.toThrow()
  })
})
