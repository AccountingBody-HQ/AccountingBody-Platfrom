// lib/coursesNew.ts
// Types and Sanity fetch functions for the new chapter-based course system

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '4rllejq1'
const DATASET    = process.env.NEXT_PUBLIC_SANITY_DATASET    ?? 'production'
const BASE_URL   = `https://${PROJECT_ID}.api.sanity.io/v2023-05-03/data/query/${DATASET}`

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CourseArticle {
  _id:    string
  title:  string
  slug:   { current: string }
  excerpt?: string
  readTime?: number
}

export interface CourseLesson {
  _id:          string
  title:        string
  slug:         { current: string }
  order?:       number
  estimatedTime?: number
  videoUrl?:    string
  audioUrl?:    string
  externalQuizUrl?: string
  linkedArticles: CourseArticle[]
}

export interface CourseChapter {
  _key:         string
  chapterTitle: string
  chapterOrder?: number
  lessons:      CourseLesson[]
}

export interface CourseListItem {
  _id:          string
  title:        string
  slug:         { current: string }
  description?: string
  level?:       string
  categoryTitle?: string
  featuredImage?: { asset: { url: string }; alt?: string }
  isFeatured?:  boolean
  courseOrder?: number
  chapterCount: number
  lessonCount:  number
}

export interface CourseFull extends CourseListItem {
  chapters:        CourseChapter[]
  metaDescription?: string
  showOnSites?:    string[]
  status?:         string
}

// ── Sanity fetch — catalogue ──────────────────────────────────────────────────

export async function getPublishedCourses(): Promise<CourseListItem[]> {
  try {
    const query = encodeURIComponent(`
      *[_type == "course" && (status == "published" || !defined(status)) && "accountingbody" in showOnSites]
      | order(courseOrder asc) {
        _id, title, slug, description, level, isFeatured, courseOrder,
        "categoryTitle": category->title,
        featuredImage { asset->{ url }, alt },
        "chapterCount": count(chapters),
        "lessonCount":  count(chapters[].lessons[])
      }
    `)
    const res = await fetch(`${BASE_URL}?query=${query}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.result ?? []
  } catch {
    return []
  }
}

// ── Sanity fetch — single course with full chapters ───────────────────────────

export async function getCourseBySlug(slug: string): Promise<CourseFull | null> {
  try {
    const query = encodeURIComponent(`
      *[_type == "course" && slug.current == "${slug}" && (status == "published" || !defined(status))][0] {
        _id, title, slug, description, level, isFeatured,
        courseOrder, metaDescription, showOnSites, status,
        "categoryTitle": category->title,
        featuredImage { asset->{ url }, alt },
        "chapterCount": count(chapters),
        "lessonCount":  count(chapters[].lessons[]),
        "chapters": chapters[] {
          _key, chapterTitle, chapterOrder,
          "lessons": lessons[defined(@->._id) && !(@->_id in path("drafts.**"))]-> {
            _id, title, slug, order, estimatedTime,
            videoUrl, audioUrl, externalQuizUrl,
            "linkedArticles": linkedArticles[defined(@->._id)]-> {
              _id, title, slug, excerpt, readTime
            }
          }
        }
      }
    `)
    const res = await fetch(`${BASE_URL}?query=${query}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.result ?? null
  } catch {
    return null
  }
}

// ── Sanity fetch — single lesson ──────────────────────────────────────────────

export async function getLessonData(courseSlug: string, lessonSlug: string): Promise<{
  course: CourseFull
  lesson: CourseLesson
  chapterTitle: string
  prevLesson: { slug: string; title: string } | null
  nextLesson: { slug: string; title: string } | null
} | null> {
  const course = await getCourseBySlug(courseSlug)
  if (!course) return null

  // Flatten all lessons in order
  const flat: { lesson: CourseLesson; chapterTitle: string }[] = []
  for (const chapter of course.chapters ?? []) {
    for (const lesson of chapter.lessons ?? []) {
      flat.push({ lesson, chapterTitle: chapter.chapterTitle })
    }
  }

  const idx = flat.findIndex(f => f.lesson.slug?.current === lessonSlug)
  if (idx === -1) return null

  return {
    course,
    lesson:       flat[idx].lesson,
    chapterTitle: flat[idx].chapterTitle,
    prevLesson:   idx > 0
      ? { slug: flat[idx - 1].lesson.slug.current, title: flat[idx - 1].lesson.title }
      : null,
    nextLesson:   idx < flat.length - 1
      ? { slug: flat[idx + 1].lesson.slug.current, title: flat[idx + 1].lesson.title }
      : null,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
