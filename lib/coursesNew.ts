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

interface RawArticleRow {
  id:         string
  title:      string
  slug:       string
  excerpt:    string | null
  read_time:  number | null
  content_id: string | null
  wp_id:      string | null
}

interface RawArticleFullRow extends RawArticleRow {
  content: string | null
}

interface RawCourseStageRow {
  id:              string
  title:           string
  slug:            string
  description:     string | null
  level:           string | null
  status:          string
  is_featured:     boolean
  show_on_sites:   string[]
  canonical_owner: string
}

interface RawChapterStageRow {
  id:            string
  chapter_title: string
  chapter_order: number
}

interface RawChapterListRow {
  id:        string
  course_id: string
}

interface RawLessonStageRow {
  id:                string
  title:             string
  slug:              string
  lesson_order:      number
  chapter_id:        string
  estimated_time:    number | null
  video_url:         string | null
  audio_url:         string | null
  external_quiz_url: string | null
}

interface RawLessonListRow {
  id:         string
  chapter_id: string
}

interface RawLessonArticleStageRow {
  lesson_id:     string
  article_order: number
  articles:      RawArticleRow | null
}

interface RawLessonArticleLinkRow {
  lesson_id:     string
  article_order: number
  article_id:    string
}

export async function getPublishedCourses(site?: string): Promise<CourseSummary[]> {
  // Stage 1: fetch courses (flat, no embed)
  let query = supabase
    .from('courses')
    .select('id, title, slug, description, level, status, is_featured, show_on_sites, canonical_owner')
    .eq('status', 'published')
    .order('title', { ascending: true })

  if (site) {
    query = query.contains('show_on_sites', [site])
  }

  const { data: coursesData, error } = await query
  if (error || !coursesData) return []

  const courses = coursesData as unknown as RawCourseStageRow[]
  const courseIds = courses.map(c => c.id)

  const chaptersByCourseId = new Map<string, RawChapterListRow[]>()
  const lessonCountByChapterId = new Map<string, number>()

  if (courseIds.length > 0) {
    // Stage 2: fetch chapters (flat, no embed)
    const { data: chaptersData } = await supabase
      .from('course_chapters')
      .select('id, course_id')
      .in('course_id', courseIds)

    const chapters = (chaptersData as unknown as RawChapterListRow[] | null) ?? []
    for (const ch of chapters) {
      const list = chaptersByCourseId.get(ch.course_id) ?? []
      list.push(ch)
      chaptersByCourseId.set(ch.course_id, list)
    }

    const chapterIds = Array.from(new Set(chapters.map(ch => ch.id)))

    if (chapterIds.length > 0) {
      // Stage 3: fetch lessons (flat, no embed)
      const { data: lessonsData } = await supabase
        .from('course_lessons')
        .select('id, chapter_id')
        .in('chapter_id', chapterIds)

      const lessons = (lessonsData as unknown as RawLessonListRow[] | null) ?? []
      for (const l of lessons) {
        lessonCountByChapterId.set(l.chapter_id, (lessonCountByChapterId.get(l.chapter_id) ?? 0) + 1)
      }
    }
  }

  return courses.map(c => {
    const courseChapters = chaptersByCourseId.get(c.id) ?? []
    return {
      id:             c.id,
      title:          c.title,
      slug:           c.slug,
      description:    c.description ?? undefined,
      level:          c.level ?? undefined,
      status:         c.status,
      isFeatured:     c.is_featured,
      showOnSites:    c.show_on_sites,
      canonicalOwner: c.canonical_owner,
      chapterCount:   courseChapters.length,
      lessonCount:    courseChapters.reduce(
        (sum, ch) => sum + (lessonCountByChapterId.get(ch.id) ?? 0), 0
      ),
    }
  })
}

export async function getCourseBySlug(slug: string, adminMode = false): Promise<Course | null> {
  try {
  // Stage 1: fetch course
  const { data: courseData, error: courseError } = await supabase
    .from('courses')
    .select('id, title, slug, description, level, status, is_featured, show_on_sites, canonical_owner')
    .eq('slug', slug)
    .single()

  if (courseError || !courseData) return null
  if (!adminMode && courseData.status !== 'published') return null

  const course = courseData as unknown as RawCourseStageRow

  // Stage 2: fetch chapters
  const { data: chaptersData } = await supabase
    .from('course_chapters')
    .select('id, chapter_title, chapter_order')
    .eq('course_id', course.id)
    .order('chapter_order', { ascending: true })

  const chapters = (chaptersData as unknown as RawChapterStageRow[] | null) ?? []

  // Stage 3: fetch all lessons for this course
  const { data: lessonsData } = await supabase
    .from('course_lessons')
    .select('id, title, slug, lesson_order, chapter_id, estimated_time, video_url, audio_url, external_quiz_url')
    .eq('course_id', course.id)
    .order('lesson_order', { ascending: true })

  const lessons = (lessonsData as unknown as RawLessonStageRow[] | null) ?? []

  // Stage 4: fetch all lesson-article links for this course's lessons
  const lessonIds = lessons.map(l => l.id)
  let lessonArticles: RawLessonArticleStageRow[] = []

  if (lessonIds.length > 0) {
    // Stage 4a — flat: fetch lesson-article links (no embed)
    const { data: laLinkData } = await supabase
      .from('course_lesson_articles')
      .select('lesson_id, article_order, article_id')
      .in('lesson_id', lessonIds)
      .order('article_order', { ascending: true })

    const links = (laLinkData as unknown as RawLessonArticleLinkRow[] | null) ?? []

    // Stage 4b — flat: fetch article rows by id array
    const linkedArticleIds = Array.from(new Set(links.map(l => l.article_id)))
    let articlesById = new Map<string, RawArticleRow>()

    if (linkedArticleIds.length > 0) {
      const { data: articlesData } = await supabase
        .from('articles')
        .select('id, title, slug, excerpt, read_time, content_id, wp_id')
        .in('id', linkedArticleIds)

      articlesById = new Map(
        ((articlesData as unknown as RawArticleRow[] | null) ?? []).map(a => [a.id, a])
      )
    }

    // JS join — reassemble into the same shape the assembly code below already expects
    lessonArticles = links.map(l => ({
      lesson_id:     l.lesson_id,
      article_order: l.article_order,
      articles:      articlesById.get(l.article_id) ?? null,
    }))
  }

  // Assemble the structure
  const courseChapters: CourseChapter[] = chapters.map(ch => {
    const chapterLessons: CourseLesson[] = lessons
      .filter(l => l.chapter_id === ch.id)
      .sort((a, b) => a.lesson_order - b.lesson_order)
      .map(l => {
        const articles: CourseArticle[] = lessonArticles
          .filter(la => la.lesson_id === l.id)
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
          }))

        return {
          id:              l.id,
          title:           l.title,
          slug:            l.slug,
          lessonOrder:     l.lesson_order,
          estimatedTime:   l.estimated_time ?? undefined,
          videoUrl:        l.video_url ?? undefined,
          audioUrl:        l.audio_url ?? undefined,
          externalQuizUrl: l.external_quiz_url ?? undefined,
          articles,
        }
      })

    return {
      id:           ch.id,
      title:        ch.chapter_title,
      chapterOrder: ch.chapter_order,
      lessons:      chapterLessons,
    }
  })

  return {
    id:              course.id,
    title:           course.title,
    slug:            course.slug,
    description:     course.description ?? undefined,
    metaDescription: course.description ?? undefined,
    level:           course.level ?? undefined,
    status:          course.status,
    isFeatured:      course.is_featured,
    showOnSites:     course.show_on_sites,
    canonicalOwner:  course.canonical_owner,
    chapters:        courseChapters,
  }
  } catch (err) {
    console.error('getCourseBySlug error:', err)
    return null
  }
}

export async function getLessonData(courseSlug: string, lessonSlug: string): Promise<{
  course: Course
  lesson: CourseLesson
  prevLesson: { slug: string; title: string; courseSlug: string } | null
  nextLesson: { slug: string; title: string; courseSlug: string } | null
} | null> {
  try {
  const course = await getCourseBySlug(courseSlug)
  if (!course) return null

  const allLessons = course.chapters.flatMap(ch => ch.lessons)
  const lessonIndex = allLessons.findIndex(l => l.slug === lessonSlug)
  if (lessonIndex === -1) return null

  const lesson = allLessons[lessonIndex]

  // Fetch full article content for lesson reading using article IDs
  const articleIds = lesson.articles.map(a => a.id).filter(Boolean)
  let articlesWithContent: CourseArticle[] = lesson.articles

  if (articleIds.length > 0) {
    const { data: articleData } = await supabase
      .from('articles')
      .select('id, title, slug, excerpt, content, read_time, content_id, wp_id')
      .in('id', articleIds)

    const fullArticles = (articleData as unknown as RawArticleFullRow[] | null) ?? []

    articlesWithContent = lesson.articles.map(a => {
      const full = fullArticles.find(d => d.id === a.id)
      if (!full) return a
      return {
        id:        full.id,
        title:     full.title,
        slug:      full.slug,
        excerpt:   full.excerpt ?? undefined,
        content:   full.content ?? undefined,
        readTime:  full.read_time ?? undefined,
        contentId: full.content_id ?? undefined,
        wpId:      full.wp_id ?? undefined,
      }
    })
  }

  const lessonWithContent: CourseLesson = { ...lesson, articles: articlesWithContent }

  const prevLesson = lessonIndex > 0
    ? { slug: allLessons[lessonIndex - 1].slug, title: allLessons[lessonIndex - 1].title, courseSlug }
    : null
  const nextLesson = lessonIndex < allLessons.length - 1
    ? { slug: allLessons[lessonIndex + 1].slug, title: allLessons[lessonIndex + 1].title, courseSlug }
    : null

  return { course, lesson: lessonWithContent, prevLesson, nextLesson }
  } catch (err) {
    console.error('getLessonData error:', err)
    return null
  }
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
