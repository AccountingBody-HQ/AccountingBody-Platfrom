import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export interface CourseArticle {
  id:         string
  title:      string
  slug:       string
  excerpt?:   string
  readTime?:  number
  contentId?: string
  wpId?:      string
  content?:   string
}

export interface CourseLesson {
  id:               string
  title:            string
  slug:             string
  lessonOrder:      number
  estimatedTime?:   number
  videoUrl?:        string
  audioUrl?:        string
  externalQuizUrl?: string
  articles:         CourseArticle[]
}

export interface CourseChapter {
  id:           string
  title:        string
  chapterOrder: number
  lessons:      CourseLesson[]
}

export interface Course {
  id:               string
  title:            string
  slug:             string
  description?:     string
  metaDescription?: string
  level?:           string
  status:           string
  isFeatured:       boolean
  showOnSites:      string[]
  canonicalOwner:   string
  chapters:         CourseChapter[]
}

export interface CourseSummary {
  id:             string
  title:          string
  slug:           string
  description?:   string
  level?:         string
  status:         string
  isFeatured:     boolean
  showOnSites:    string[]
  canonicalOwner: string
  chapterCount:   number
  lessonCount:    number
}

interface RawCourseListRow {
  id:              string
  title:           string
  slug:            string
  description:     string | null
  level:           string | null
  status:          string
  is_featured:     boolean
  show_on_sites:   string[]
  canonical_owner: string
  course_chapters: { id: string; course_lessons: { id: string }[] | null }[] | null
}

interface RawArticleRow {
  id:         string
  title:      string
  slug:       string
  excerpt:    string | null
  read_time:  number | null
  content_id: string | null
  wp_id:      string | null
}

interface RawLessonRow {
  id:                 string
  title:              string
  slug:               string
  lesson_order:       number
  estimated_time:     number | null
  video_url:          string | null
  audio_url:          string | null
  external_quiz_url:  string | null
  course_lesson_articles: { article_order: number; articles: RawArticleRow | null }[] | null
}

interface RawChapterRow {
  id:              string
  chapter_title:   string
  chapter_order:   number
  course_lessons:  RawLessonRow[] | null
}

interface RawCourseRow {
  id:              string
  title:           string
  slug:            string
  description:     string | null
  level:           string | null
  status:          string
  is_featured:     boolean
  show_on_sites:   string[]
  canonical_owner: string
  course_chapters: RawChapterRow[] | null
}

export async function getPublishedCourses(site?: string): Promise<CourseSummary[]> {
  let query = supabase
    .from('courses')
    .select(`
      id, title, slug, description, level, status, is_featured,
      show_on_sites, canonical_owner,
      course_chapters (
        id,
        course_lessons ( id )
      )
    `)
    .eq('status', 'published')
    .order('title', { ascending: true })

  if (site) {
    query = query.contains('show_on_sites', [site])
  }

  const { data, error } = await query
  if (error || !data) return []

  return (data as unknown as RawCourseListRow[]).map(c => ({
    id:             c.id,
    title:          c.title,
    slug:           c.slug,
    description:    c.description ?? undefined,
    level:          c.level ?? undefined,
    status:         c.status,
    isFeatured:     c.is_featured,
    showOnSites:    c.show_on_sites,
    canonicalOwner: c.canonical_owner,
    chapterCount:   (c.course_chapters ?? []).length,
    lessonCount:    (c.course_chapters ?? []).reduce(
      (sum, ch) => sum + (ch.course_lessons ?? []).length, 0
    ),
  }))
}

export async function getCourseBySlug(slug: string): Promise<Course | null> {
  const { data, error } = await supabase
    .from('courses')
    .select(`
      id, title, slug, description, level, status, is_featured,
      show_on_sites, canonical_owner,
      course_chapters (
        id, chapter_title, chapter_order,
        course_lessons (
          id, title, slug, lesson_order,
          estimated_time, video_url, audio_url, external_quiz_url,
          course_lesson_articles (
            article_order,
            articles (
              id, title, slug, excerpt, read_time, content_id, wp_id
            )
          )
        )
      )
    `)
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (error || !data) return null

  const courseRow = data as unknown as RawCourseRow

  const chapters: CourseChapter[] = (courseRow.course_chapters ?? [])
    .sort((a, b) => a.chapter_order - b.chapter_order)
    .map(ch => ({
      id:           ch.id,
      title:        ch.chapter_title,
      chapterOrder: ch.chapter_order,
      lessons: (ch.course_lessons ?? [])
        .sort((a, b) => a.lesson_order - b.lesson_order)
        .map(l => ({
          id:              l.id,
          title:           l.title,
          slug:            l.slug,
          lessonOrder:     l.lesson_order,
          estimatedTime:   l.estimated_time ?? undefined,
          videoUrl:        l.video_url ?? undefined,
          audioUrl:        l.audio_url ?? undefined,
          externalQuizUrl: l.external_quiz_url ?? undefined,
          articles: (l.course_lesson_articles ?? [])
            .sort((a, b) => a.article_order - b.article_order)
            .map(la => la.articles)
            .filter((a): a is RawArticleRow => a !== null)
            .map(a => ({
              id:        a.id,
              title:     a.title,
              slug:      a.slug,
              excerpt:   a.excerpt ?? undefined,
              readTime:  a.read_time ?? undefined,
              contentId: a.content_id ?? undefined,
              wpId:      a.wp_id ?? undefined,
            })),
        })),
    }))

  return {
    id:              courseRow.id,
    title:           courseRow.title,
    slug:            courseRow.slug,
    description:     courseRow.description ?? undefined,
    metaDescription: courseRow.description ?? undefined,
    level:           courseRow.level ?? undefined,
    status:          courseRow.status,
    isFeatured:      courseRow.is_featured,
    showOnSites:     courseRow.show_on_sites,
    canonicalOwner:  courseRow.canonical_owner,
    chapters,
  }
}

export async function getLessonData(courseSlug: string, lessonSlug: string): Promise<{
  course: Course
  lesson: CourseLesson
  prevLesson: { slug: string; title: string; courseSlug: string } | null
  nextLesson: { slug: string; title: string; courseSlug: string } | null
} | null> {
  const course = await getCourseBySlug(courseSlug)
  if (!course) return null

  const allLessons = course.chapters.flatMap(ch => ch.lessons)
  const lessonIndex = allLessons.findIndex(l => l.slug === lessonSlug)
  if (lessonIndex === -1) return null

  const lesson = allLessons[lessonIndex]

  // Fetch full article content for lesson reading
  const articlesWithContent: CourseArticle[] = await Promise.all(
    lesson.articles.map(async a => {
      const { data } = await supabase
        .from('articles')
        .select('id, title, slug, excerpt, content, read_time, content_id, wp_id')
        .eq('slug', a.slug)
        .single()
      if (!data) return a
      return {
        id:        data.id,
        title:     data.title,
        slug:      data.slug,
        excerpt:   data.excerpt,
        content:   data.content,
        readTime:  data.read_time,
        contentId: data.content_id,
        wpId:      data.wp_id,
      }
    })
  )

  const lessonWithContent: CourseLesson = { ...lesson, articles: articlesWithContent }

  const prevLesson = lessonIndex > 0
    ? { slug: allLessons[lessonIndex - 1].slug, title: allLessons[lessonIndex - 1].title, courseSlug }
    : null
  const nextLesson = lessonIndex < allLessons.length - 1
    ? { slug: allLessons[lessonIndex + 1].slug, title: allLessons[lessonIndex + 1].title, courseSlug }
    : null

  return { course, lesson: lessonWithContent, prevLesson, nextLesson }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
// (Pure presentation helpers, unrelated to the Sanity→Supabase data-layer swap —
// restored here since existing pages still import them from this module.)

export function levelBadge(level?: string) {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    beginner:     { bg: 'bg-teal-50',    text: 'text-teal-700',   border: 'border-teal-200'  },
    intermediate: { bg: 'bg-gold-50',    text: 'text-gold-700',   border: 'border-gold-200'  },
    advanced:     { bg: 'bg-crimson-50', text: 'text-crimson-700',border: 'border-crimson-200'},
  }
  return map[level?.toLowerCase() ?? ''] ?? { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' }
}

export function capitalize(str?: string) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}
