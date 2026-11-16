import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getServerSupabase } from './supabase-server'
import { resetCacheGuard, BACKOFF_MS, HOLD_MS } from './cache-guard'
import {
  getPublishedCoursesCached, getPublicCourseBySlug, getPublicLessonData,
  getCourseBySlug, getPublishedCourses,
} from './coursesNew'
import { getPublicQuestionSetBySlug, getPublicQuestionsBySetId, getPublicCasesBySetId } from './db'

// The cached public reads for the course list, course, lesson and
// question-set pages. unstable_cache is a pass-through that records its key
// parts, options, arguments and the promise the cached function returned, so
// a test can tell whether the cached function itself rejected (Next stores
// nothing in that case). The fake client answers per table, using the
// filters a query sent, so different slugs and ids get different rows.

vi.mock('./supabase-server', () => ({ getServerSupabase: vi.fn() }))
vi.mock('./report-error', () => ({ reportServerError: vi.fn() }))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
const cacheCalls = vi.hoisted(() => [] as Array<{ keyParts: string[]; options: unknown; args: unknown[]; result: Promise<unknown> }>)
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>, keyParts: string[], options: unknown) =>
    (...args: unknown[]) => {
      const result = fn(...args)
      cacheCalls.push({ keyParts, options, args, result })
      return result
    },
}))

type Result = { data: unknown; error: unknown; status: number }
type Filters = Record<string, unknown>

const FAILED: Result = { data: null, error: { code: 'XX000', message: 'seed detail' }, status: 504 }
const NO_ROW: Result = { data: null, error: { code: 'PGRST116', message: 'no rows' }, status: 406 }
const rows = (data: unknown): Result => ({ data, error: null, status: 200 })

// Healthy answers, built from the query's own filters.
function healthy(table: string, f: Filters): Result {
  switch (table) {
    case 'courses':
      if (typeof f['eq:slug'] === 'string') {
        const slug = f['eq:slug'] as string
        if (slug === 'missing') return NO_ROW
        return rows({ id: `id-${slug}`, title: `Course ${slug}`, slug, description: null, level: null, status: slug === 'draft' ? 'draft' : 'published', is_featured: false, show_on_sites: ['ab'], canonical_owner: 'ab' })
      }
      {
        const site = (f['contains:show_on_sites'] as string[] | undefined)?.[0] ?? 'all'
        if (site === 'none') return rows([])
        return rows([{ id: `list-${site}`, title: `List ${site}`, slug: `list-${site}`, description: null, level: null, status: 'published', is_featured: false, show_on_sites: [site], canonical_owner: 'ab' }])
      }
    case 'course_chapters':
      if (f['eq:course_id']) return rows([{ id: `ch-${f['eq:course_id']}`, chapter_title: 'Chapter', chapter_order: 1 }])
      return rows((f['in:course_id'] as string[]).map(id => ({ id: `ch-${id}`, course_id: id })))
    case 'course_lessons':
      if (f['eq:course_id']) {
        const ch = `ch-${f['eq:course_id']}`
        return rows([
          { id: 'l1', title: 'Costs', slug: 'costs', lesson_order: 1, chapter_id: ch, estimated_time: null, video_url: null, audio_url: null, external_quiz_url: null },
          { id: 'l2', title: 'Revenue', slug: 'revenue', lesson_order: 2, chapter_id: ch, estimated_time: null, video_url: null, audio_url: null, external_quiz_url: null },
        ])
      }
      return rows((f['in:chapter_id'] as string[]).map(id => ({ id: `ls-${id}`, chapter_id: id })))
    case 'course_lesson_articles':
      return rows([{ lesson_id: 'l1', article_order: 1, article_id: 'a1' }, { lesson_id: 'l2', article_order: 1, article_id: 'a2' }])
    case 'articles':
      return rows((f['in:id'] as string[]).map(id => ({ id, title: `Article ${id}`, slug: `article-${id}`, excerpt: null, content: `<p>${id}</p>`, category: null, read_time: null, content_id: null, wp_id: null })))
    case 'question_sets': {
      const slug = f['eq:slug'] as string
      if (slug === 'missing') return NO_ROW
      return rows({ id: `id-${slug}`, slug, title: `Set ${slug}`, status: 'published' })
    }
    case 'questions': {
      const setId = f['eq:set_id'] as string
      return rows(setId === 'empty' ? [] : [{ id: `q-${setId}`, set_id: setId }])
    }
    case 'question_cases': {
      const setId = f['eq:set_id'] as string
      return rows(setId === 'empty' ? [] : [{ id: `k-${setId}`, set_id: setId }])
    }
  }
  return FAILED
}

let failing = new Set<string>()
let queries: string[] = []

function fakeClient() {
  return {
    from: (table: string) => {
      const f: Filters = {}
      const settle = () => {
        queries.push(table)
        return Promise.resolve(failing.has(table) ? FAILED : healthy(table, f))
      }
      const builder: Record<string, unknown> = {}
      builder.select = () => builder
      builder.order = () => builder
      for (const m of ['eq', 'in', 'contains']) {
        builder[m] = (column: string, value: unknown) => { f[`${m}:${column}`] = value; return builder }
      }
      builder.single = settle
      builder.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => settle().then(res, rej)
      return builder
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  vi.mocked(getServerSupabase).mockImplementation((() => fakeClient()) as unknown as typeof getServerSupabase)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  cacheCalls.length = 0
  queries = []
  failing = new Set()
  resetCacheGuard()
})

afterEach(() => {
  resetCacheGuard()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

type Reader = {
  name: string
  // Two different items (slugs, ids or sites).
  runA: () => Promise<unknown>
  runB: () => Promise<unknown>
  argsA: unknown[]
  keyParts: string[]
  tags: string[]
  // A recognisable part of item A's and item B's value.
  matchA: unknown
  matchB: unknown
  failTable: string
  failText: string
  notFound: () => Promise<unknown>
  notFoundValue: null | []
}

const readers: Reader[] = [
  {
    name: 'getPublishedCoursesCached',
    runA: () => getPublishedCoursesCached('ab'), runB: () => getPublishedCoursesCached('et'), argsA: ['ab'],
    keyParts: ['published-courses'], tags: ['courses'],
    matchA: [{ slug: 'list-ab', chapterCount: 1, lessonCount: 1 }], matchB: [{ slug: 'list-et' }],
    failTable: 'course_lessons', failText: 'getPublishedCourses: course_lessons query failed (status 504)',
    notFound: () => getPublishedCoursesCached('none'), notFoundValue: [],
  },
  {
    name: 'getPublicCourseBySlug',
    runA: () => getPublicCourseBySlug('alpha'), runB: () => getPublicCourseBySlug('beta'), argsA: ['alpha'],
    keyParts: ['public-course-by-slug'], tags: ['courses', 'course:alpha'],
    matchA: { slug: 'alpha', chapters: [{ lessons: [{ slug: 'costs' }, { slug: 'revenue' }] }] }, matchB: { slug: 'beta' },
    failTable: 'course_chapters', failText: 'getCourseBySlug: course_chapters query failed',
    notFound: () => getPublicCourseBySlug('missing'), notFoundValue: null,
  },
  {
    name: 'getPublicLessonData',
    runA: () => getPublicLessonData('alpha', 'costs'), runB: () => getPublicLessonData('alpha', 'revenue'), argsA: ['alpha', 'costs'],
    keyParts: ['public-lesson-data'], tags: ['courses', 'course:alpha'],
    matchA: { course: { slug: 'alpha' }, lesson: { slug: 'costs', articles: [{ id: 'a1', content: '<p>a1</p>' }] }, nextLesson: { slug: 'revenue' } },
    matchB: { lesson: { slug: 'revenue', articles: [{ id: 'a2' }] }, prevLesson: { slug: 'costs' } },
    failTable: 'course_lesson_articles', failText: 'getCourseBySlug: course_lesson_articles query failed',
    notFound: () => getPublicLessonData('alpha', 'no-such-lesson'), notFoundValue: null,
  },
  {
    name: 'getPublicQuestionSetBySlug',
    runA: () => getPublicQuestionSetBySlug('budgeting'), runB: () => getPublicQuestionSetBySlug('costing'), argsA: ['budgeting'],
    keyParts: ['public-question-set-by-slug'], tags: ['question-sets', 'question-set:budgeting'],
    matchA: { id: 'id-budgeting', slug: 'budgeting' }, matchB: { id: 'id-costing', slug: 'costing' },
    failTable: 'question_sets', failText: 'getQuestionSetBySlug: question_sets query failed (status 504)',
    notFound: () => getPublicQuestionSetBySlug('missing'), notFoundValue: null,
  },
  {
    name: 'getPublicQuestionsBySetId',
    runA: () => getPublicQuestionsBySetId('s1'), runB: () => getPublicQuestionsBySetId('s2'), argsA: ['s1'],
    keyParts: ['public-questions-by-set'], tags: ['question-sets', 'question-set-id:s1'],
    matchA: [{ id: 'q-s1' }], matchB: [{ id: 'q-s2' }],
    failTable: 'questions', failText: 'getQuestionsBySetId: questions query failed (status 504)',
    notFound: () => getPublicQuestionsBySetId('empty'), notFoundValue: [],
  },
  {
    name: 'getPublicCasesBySetId',
    runA: () => getPublicCasesBySetId('s1'), runB: () => getPublicCasesBySetId('s2'), argsA: ['s1'],
    keyParts: ['public-cases-by-set'], tags: ['question-sets', 'question-set-id:s1'],
    matchA: [{ id: 'k-s1' }], matchB: [{ id: 'k-s2' }],
    failTable: 'question_cases', failText: 'getCasesBySetId: question_cases query failed (status 504)',
    notFound: () => getPublicCasesBySetId('empty'), notFoundValue: [],
  },
]

describe.each(readers)('$name (cached public read)', (r) => {
  it('uses its own key parts, an hour, and its tags', async () => {
    await r.runA()
    expect(cacheCalls).toHaveLength(1)
    expect(cacheCalls[0].keyParts).toEqual(r.keyParts)
    expect(cacheCalls[0].args).toEqual(r.argsA)
    expect(cacheCalls[0].options).toEqual({ revalidate: 3600, tags: r.tags })
  })

  it('returns the healthy value, and reads the database once within the hold', async () => {
    expect(await r.runA()).toMatchObject(r.matchA as object)
    const reads = queries.length
    expect(await r.runA()).toMatchObject(r.matchA as object)
    expect(queries.length).toBe(reads)
    vi.advanceTimersByTime(HOLD_MS)
    await r.runA()
    expect(queries.length).toBe(reads * 2)
  })

  it('two different items never share an entry', async () => {
    expect(await r.runA()).toMatchObject(r.matchA as object)
    expect(await r.runB()).toMatchObject(r.matchB as object)
    expect(cacheCalls).toHaveLength(2)
    expect(cacheCalls[0].args).not.toEqual(cacheCalls[1].args)
    expect(await r.runA()).toMatchObject(r.matchA as object)
  })

  it('a failure throws the original error text, is never stored, and is not served later as a value', async () => {
    failing.add(r.failTable)
    await expect(r.runA()).rejects.toThrow(r.failText)
    // The cached function itself rejected, so unstable_cache stores nothing.
    await expect(cacheCalls[0].result).rejects.toThrow(r.failText)
    // During the pause the same error is thrown again, never a value.
    vi.advanceTimersByTime(BACKOFF_MS - 1)
    await expect(r.runA()).rejects.toThrow(r.failText)
    // After the pause, a healthy database gives the real value.
    failing.clear()
    vi.advanceTimersByTime(1)
    expect(await r.runA()).toMatchObject(r.matchA as object)
  })

  it('a genuine not-found is returned (and is a stored value, not a failure)', async () => {
    expect(await r.notFound()).toEqual(r.notFoundValue)
    await expect(cacheCalls[0].result).resolves.toEqual(r.notFoundValue)
  })
})

describe('existing exports stay uncached', () => {
  it('getCourseBySlug in admin mode never calls unstable_cache and sees an unpublished course', async () => {
    expect(await getCourseBySlug('draft', true)).toMatchObject({ slug: 'draft', status: 'draft' })
    expect(await getCourseBySlug('alpha', true)).toMatchObject({ slug: 'alpha' })
    expect(cacheCalls).toHaveLength(0)
  })

  it('getCourseBySlug in public mode (called directly) never calls unstable_cache', async () => {
    expect(await getCourseBySlug('alpha')).toMatchObject({ slug: 'alpha' })
    expect(cacheCalls).toHaveLength(0)
  })

  it('the public cached course hides an unpublished course', async () => {
    expect(await getPublicCourseBySlug('draft')).toBeNull()
  })

  it('getPublishedCourses (build-time fallback) never calls unstable_cache', async () => {
    expect(await getPublishedCourses('ab')).toMatchObject([{ slug: 'list-ab' }])
    failing.add('courses')
    expect(await getPublishedCourses('ab')).toEqual([])
    expect(cacheCalls).toHaveLength(0)
  })
})
