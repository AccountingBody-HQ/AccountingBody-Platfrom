import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { getLessonData } from './coursesNew'

// getLessonData reads the table `articles` twice: first inside
// getCourseBySlug (the short list) and then itself (the full text). These
// tests cover the second read: a failed read throws a fixed-text problem
// instead of returning a lesson without its text.

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))

type Result = { data: unknown; error: unknown; status?: number }
type Call = { table: string; select: string; filters: Array<[string, string, unknown]> }

const FULL_SELECT = 'id, title, slug, excerpt, content, category, read_time, content_id, wp_id'
const SHORT_SELECT = 'id, title, slug, excerpt, read_time, content_id, wp_id'

let calls: Call[] = []

// A fake client that records every read. Each table gives its scripted
// answer, except `articles`, which is answered by call order: the first read
// (the short list) is always healthy and only the second read (the full
// text) gets the answer under test.
function fakeClient(byTable: Record<string, Result>, secondArticlesRead: Result) {
  let articleReads = 0
  return {
    from: (table: string) => {
      const call: Call = { table, select: '', filters: [] }
      calls.push(call)
      let result: Result = byTable[table] ?? { data: [], error: null, status: 200 }
      if (table === 'articles') {
        articleReads += 1
        if (articleReads > 1) result = secondArticlesRead
      }
      const answer = () => Promise.resolve(result)
      const builder: Record<string, unknown> = {}
      builder.select = (columns: string) => {
        call.select = columns
        return builder
      }
      for (const method of ['eq', 'in', 'order', 'contains']) {
        builder[method] = (column: string, value: unknown) => {
          call.filters.push([method, column, value])
          return builder
        }
      }
      builder.single = answer
      builder.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => answer().then(res, rej)
      return builder
    },
  }
}

function use(secondArticlesRead: Result, overrides: Record<string, Result> = {}) {
  calls = []
  vi.mocked(createClient).mockReturnValue(
    fakeClient({ ...healthyCourse, ...overrides }, secondArticlesRead) as unknown as ReturnType<typeof createClient>
  )
}

const articleReads = () => calls.filter((call) => call.table === 'articles')

// Distinctive values, so a leak into a thrown message is easy to see.
const COURSE_SLUG = 'zq-course-slug-7731'
const LESSON_SLUG = 'zq-lesson-slug-9942'
const DB_PROBLEM = {
  code: 'XX000',
  message: 'seed database message kx41',
  details: 'seed database detail kx42',
  hint: 'seed database hint kx43',
}

const lessonRow = (id: string, title: string, slug: string, order: number) => ({
  id, title, slug, lesson_order: order, chapter_id: 'ch1', estimated_time: null, video_url: null, audio_url: null, external_quiz_url: null,
})

const healthyCourse: Record<string, Result> = {
  courses: { data: { id: 'c1', title: 'Cost Accounting', slug: COURSE_SLUG, description: 'd', level: 'beginner', status: 'published', is_featured: false, show_on_sites: ['ab'], canonical_owner: 'ab' }, error: null, status: 200 },
  course_chapters: { data: [{ id: 'ch1', chapter_title: 'Basics', chapter_order: 1 }], error: null, status: 200 },
  course_lessons: {
    data: [
      lessonRow('l1', 'Before', 'before-lesson', 1),
      lessonRow('l2', 'Costs', LESSON_SLUG, 2),
      lessonRow('l3', 'After', 'after-lesson', 3),
      lessonRow('l4', 'Empty', 'empty-lesson', 4),
    ],
    error: null,
    status: 200,
  },
  course_lesson_articles: {
    data: [
      { lesson_id: 'l2', article_order: 1, article_id: 'a1' },
      { lesson_id: 'l2', article_order: 2, article_id: 'a2' },
      { lesson_id: 'l3', article_order: 1, article_id: 'a3' },
    ],
    error: null,
    status: 200,
  },
  // The first (short) articles read.
  articles: {
    data: [
      { id: 'a1', title: 'Fixed costs', slug: 'fixed-costs', excerpt: 'Short one', read_time: 5, content_id: 'AB-1', wp_id: null },
      { id: 'a2', title: 'Variable costs', slug: 'variable-costs', excerpt: null, read_time: null, content_id: null, wp_id: '77' },
      { id: 'a3', title: 'Other', slug: 'other', excerpt: null, read_time: null, content_id: null, wp_id: null },
    ],
    error: null,
    status: 200,
  },
}

const shortA1 = { id: 'a1', title: 'Fixed costs', slug: 'fixed-costs', excerpt: 'Short one', readTime: 5, contentId: 'AB-1', wpId: undefined }
const shortA2 = { id: 'a2', title: 'Variable costs', slug: 'variable-costs', excerpt: undefined, readTime: undefined, contentId: undefined, wpId: '77' }

const fullRowA1 = { id: 'a1', title: 'Fixed costs (full)', slug: 'fixed-costs', excerpt: 'Full one', content: '<p>Fixed text</p>', category: 'costing', read_time: 6, content_id: 'AB-1', wp_id: '41' }
const fullRowA2 = { id: 'a2', title: 'Variable costs', slug: 'variable-costs', excerpt: null, content: null, category: null, read_time: null, content_id: null, wp_id: null }

const fullA1 = { id: 'a1', title: 'Fixed costs (full)', slug: 'fixed-costs', excerpt: 'Full one', content: '<p>Fixed text</p>', category: 'costing', readTime: 6, contentId: 'AB-1', wpId: '41' }
const fullA2 = { id: 'a2', title: 'Variable costs', slug: 'variable-costs', excerpt: undefined, content: undefined, category: undefined, readTime: undefined, contentId: undefined, wpId: undefined }

const healthySecond: Result = { data: [fullRowA1, fullRowA2], error: null, status: 200 }
const failedSecond = (error: unknown, data: unknown = null): Result => ({ data, error, status: 500 })

const FIXED_TEXT = 'getLessonData: articles query failed'

async function thrownBy(run: () => Promise<unknown>): Promise<(Error & { code?: unknown }) | undefined> {
  try {
    await run()
  } catch (err) {
    return err as Error & { code?: unknown }
  }
  return undefined
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('getLessonData — a healthy article text read', () => {
  it('gives each article its full fields, mapped as before', async () => {
    use(healthySecond)
    const data = await getLessonData(COURSE_SLUG, LESSON_SLUG)
    expect(data?.lesson.articles).toStrictEqual([fullA1, fullA2])
    expect(data?.lesson).toMatchObject({ id: 'l2', title: 'Costs', slug: LESSON_SLUG, lessonOrder: 2 })
    expect(data?.course.slug).toBe(COURSE_SLUG)
  })

  it('leaves the course itself with the short articles and the neighbours unchanged', async () => {
    use(healthySecond)
    const data = await getLessonData(COURSE_SLUG, LESSON_SLUG)
    expect(data?.course.chapters[0].lessons[1].articles).toStrictEqual([shortA1, shortA2])
    expect(data?.prevLesson).toStrictEqual({ slug: 'before-lesson', title: 'Before', courseSlug: COURSE_SLUG })
    expect(data?.nextLesson).toStrictEqual({ slug: 'after-lesson', title: 'After', courseSlug: COURSE_SLUG })
    expect(Object.keys(data ?? {}).sort()).toStrictEqual(['course', 'lesson', 'nextLesson', 'prevLesson'])
  })

  it('no previous lesson for the first lesson and no next lesson for the last', async () => {
    use(healthySecond)
    const first = await getLessonData(COURSE_SLUG, 'before-lesson')
    expect(first?.prevLesson).toBeNull()
    expect(first?.nextLesson).toStrictEqual({ slug: LESSON_SLUG, title: 'Costs', courseSlug: COURSE_SLUG })
    use(healthySecond)
    const last = await getLessonData(COURSE_SLUG, 'empty-lesson')
    expect(last?.prevLesson).toStrictEqual({ slug: 'after-lesson', title: 'After', courseSlug: COURSE_SLUG })
    expect(last?.nextLesson).toBeNull()
  })

  it('no rows and no error: resolves, and the articles keep their short form', async () => {
    use({ data: null, error: null, status: 200 })
    const data = await getLessonData(COURSE_SLUG, LESSON_SLUG)
    expect(data?.lesson.articles).toStrictEqual([shortA1, shortA2])
    expect(articleReads()).toHaveLength(2)
  })

  it('an empty list and no error: resolves, and the articles keep their short form', async () => {
    use({ data: [], error: null, status: 200 })
    const data = await getLessonData(COURSE_SLUG, LESSON_SLUG)
    expect(data?.lesson.articles).toStrictEqual([shortA1, shortA2])
  })

  it('an article missing from the result keeps its short form; the others are full', async () => {
    use({ data: [fullRowA1], error: null, status: 200 })
    const data = await getLessonData(COURSE_SLUG, LESSON_SLUG)
    expect(data?.lesson.articles).toStrictEqual([fullA1, shortA2])
  })

  it('a lesson with no articles makes no second read and resolves', async () => {
    // Even a failing answer is never seen, because the read is not made.
    use(failedSecond(DB_PROBLEM))
    const data = await getLessonData(COURSE_SLUG, 'empty-lesson')
    expect(data?.lesson.articles).toStrictEqual([])
    expect(data?.lesson.slug).toBe('empty-lesson')
    expect(articleReads()).toHaveLength(1)
    expect(articleReads()[0].select).toBe(SHORT_SELECT)
  })
})

describe('getLessonData — the article text read itself', () => {
  it('reads the same table, columns and ids as before', async () => {
    use(healthySecond)
    await getLessonData(COURSE_SLUG, LESSON_SLUG)
    const reads = articleReads()
    expect(reads).toHaveLength(2)
    expect(reads[0].select).toBe(SHORT_SELECT)
    expect(reads[1]).toStrictEqual({
      table: 'articles',
      select: FULL_SELECT,
      filters: [['in', 'id', ['a1', 'a2']]],
    })
  })

  it('is the last read made', async () => {
    use(healthySecond)
    await getLessonData(COURSE_SLUG, LESSON_SLUG)
    expect(calls.map((call) => call.table)).toStrictEqual([
      'courses', 'course_chapters', 'course_lessons', 'course_lesson_articles', 'articles', 'articles',
    ])
  })
})

describe('getLessonData — a failed article text read', () => {
  it('rejects with an Error whose message is exactly the fixed text', async () => {
    use(failedSecond(DB_PROBLEM))
    const thrown = await thrownBy(() => getLessonData(COURSE_SLUG, LESSON_SLUG))
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe(FIXED_TEXT)
    expect(articleReads()).toHaveLength(2)
  })

  it('still throws when rows arrive together with the error', async () => {
    use(failedSecond(DB_PROBLEM, [fullRowA1, fullRowA2]))
    const thrown = await thrownBy(() => getLessonData(COURSE_SLUG, LESSON_SLUG))
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe(FIXED_TEXT)
  })

  it.each([
    ['a gateway time-out', { code: '', message: 'upstream request timeout' }],
    ['a network failure', { code: '', message: 'TypeError: fetch failed' }],
    ['a statement time-out', { code: '57014', message: 'canceling statement due to statement timeout' }],
    ['an error with no fields', {}],
  ])('throws the fixed text on %s', async (_label, error) => {
    use(failedSecond(error))
    await expect(getLessonData(COURSE_SLUG, LESSON_SLUG)).rejects.toThrow(FIXED_TEXT)
  })

  it('keeps the database short code when it looks like a code', async () => {
    use(failedSecond(DB_PROBLEM))
    expect((await thrownBy(() => getLessonData(COURSE_SLUG, LESSON_SLUG)))?.code).toBe('XX000')
    use(failedSecond({ ...DB_PROBLEM, code: 'PGRST301' }))
    expect((await thrownBy(() => getLessonData(COURSE_SLUG, LESSON_SLUG)))?.code).toBe('PGRST301')
  })

  it.each([
    ['text that is not a code', 'seed person@example.com'],
    ['an empty string', ''],
    ['a very long string', 'A'.repeat(41)],
    ['a number', 57014],
    ['nothing', undefined],
  ])('drops the code when it is %s', async (_label, code) => {
    use(failedSecond({ ...DB_PROBLEM, code }))
    const thrown = await thrownBy(() => getLessonData(COURSE_SLUG, LESSON_SLUG))
    expect(thrown?.message).toBe(FIXED_TEXT)
    expect(thrown?.code).toBeUndefined()
    expect(Object.prototype.hasOwnProperty.call(thrown, 'code')).toBe(false)
  })

  it('the thrown message holds no database text and neither slug', async () => {
    use(failedSecond(DB_PROBLEM))
    const thrown = await thrownBy(() => getLessonData(COURSE_SLUG, LESSON_SLUG))
    const message = thrown?.message ?? ''
    expect(message).not.toBe('')
    for (const secret of [DB_PROBLEM.message, DB_PROBLEM.details, DB_PROBLEM.hint, 'kx41', 'kx42', 'kx43', 'seed database', COURSE_SLUG, LESSON_SLUG, '7731', '9942', 'zq-']) {
      expect(message).not.toContain(secret)
    }
  })

  it('the thrown problem carries nothing but its message and code', async () => {
    use(failedSecond(DB_PROBLEM))
    const thrown = await thrownBy(() => getLessonData(COURSE_SLUG, LESSON_SLUG))
    expect(Object.keys(thrown ?? {})).toStrictEqual(['code'])
    expect(thrown).not.toBe(DB_PROBLEM)
  })

  it('is passed on through the existing log line, once', async () => {
    use(failedSecond(DB_PROBLEM))
    const thrown = await thrownBy(() => getLessonData(COURSE_SLUG, LESSON_SLUG))
    const logged = vi.mocked(console.error).mock.calls
    expect(logged).toHaveLength(1)
    expect(logged[0][0]).toBe('getLessonData error:')
    expect(logged[0][1]).toBe(thrown)
  })
})

describe('getLessonData — not found still means null', () => {
  it('an unknown course gives null and makes no article read', async () => {
    use(failedSecond(DB_PROBLEM), {
      courses: { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, status: 406 },
    })
    expect(await getLessonData('no-such-course', LESSON_SLUG)).toBeNull()
    expect(articleReads()).toHaveLength(0)
  })

  it('an unknown lesson gives null and makes no second article read', async () => {
    use(failedSecond(DB_PROBLEM))
    expect(await getLessonData(COURSE_SLUG, 'no-such-lesson')).toBeNull()
    expect(articleReads()).toHaveLength(1)
    expect(articleReads()[0].select).toBe(SHORT_SELECT)
  })
})
