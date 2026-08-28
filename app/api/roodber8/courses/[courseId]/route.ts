// app/api/roodber8/courses/[courseId]/route.ts
// Admin CRUD for a single course — chapters, lessons, and lesson-article links.
// Separate from lib/coursesNew.ts (the public-facing data layer, untouched).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SITE_CODE_MAP } from '@/lib/site-codes'

export const runtime = 'nodejs'
export const maxDuration = 60

async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return false
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const expected = await sha256Hex(secret)
  return token === expected
}

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

// ── Row types ────────────────────────────────────────────────────────────────

interface CourseRow {
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

interface ChapterRow {
  id:            string
  chapter_title: string
  chapter_order: number
}

interface LessonRow {
  id:           string
  title:        string
  slug:         string
  lesson_order: number
  chapter_id:   string
}

interface LessonArticleLinkRow {
  lesson_id:     string
  article_order: number
  article_id:    string
}

interface ArticleRow {
  id:        string
  title:     string
  slug:      string
  excerpt:   string | null
  read_time: number | null
}

// ── GET /api/roodber8/courses/[courseId]
export async function GET(
  req: NextRequest,
  { params }: { params: { courseId: string } }
) {
  if (!(await isAuthenticated(req)))
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { courseId } = params
  const supabase = getClient()

  // Query 1 — course
  const { data: courseData, error: courseError } = await supabase
    .from('courses')
    .select('id, title, slug, description, level, status, is_featured, show_on_sites, canonical_owner')
    .eq('id', courseId)
    .single()

  if (courseError || !courseData)
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })

  const course = courseData as CourseRow

  // Query 2 — chapters (flat)
  const { data: chaptersData } = await supabase
    .from('course_chapters')
    .select('id, chapter_title, chapter_order')
    .eq('course_id', courseId)
    .order('chapter_order', { ascending: true })

  const chapters = (chaptersData ?? []) as ChapterRow[]

  // Query 3 — lessons (flat)
  const { data: lessonsData } = await supabase
    .from('course_lessons')
    .select('id, title, slug, lesson_order, chapter_id')
    .eq('course_id', courseId)
    .order('lesson_order', { ascending: true })

  const lessons = (lessonsData ?? []) as LessonRow[]
  const lessonIds = lessons.map(l => l.id)

  // Query 4a — lesson-article links (flat, no embed — Rule 52)
  let links: LessonArticleLinkRow[] = []
  if (lessonIds.length > 0) {
    const { data: linksData } = await supabase
      .from('course_lesson_articles')
      .select('lesson_id, article_order, article_id')
      .in('lesson_id', lessonIds)
      .order('article_order', { ascending: true })
    links = (linksData ?? []) as LessonArticleLinkRow[]
  }

  // Query 4b — articles by id (flat)
  const articleIds = Array.from(new Set(links.map(l => l.article_id)))
  let articlesById = new Map<string, ArticleRow>()
  if (articleIds.length > 0) {
    const { data: articlesData } = await supabase
      .from('articles')
      .select('id, title, slug, excerpt, read_time')
      .in('id', articleIds)
    articlesById = new Map(((articlesData ?? []) as ArticleRow[]).map(a => [a.id, a]))
  }

  // Assemble
  const resultChapters = chapters.map(ch => {
    const chapterLessons = lessons
      .filter(l => l.chapter_id === ch.id)
      .sort((a, b) => a.lesson_order - b.lesson_order)
      .map(l => {
        const articles = links
          .filter(link => link.lesson_id === l.id)
          .sort((a, b) => a.article_order - b.article_order)
          .map(link => {
            const article = articlesById.get(link.article_id)
            if (!article) return null
            return {
              id:            article.id,
              title:         article.title,
              slug:          article.slug,
              excerpt:       article.excerpt ?? undefined,
              read_time:     article.read_time ?? undefined,
              article_order: link.article_order,
            }
          })
          .filter((a): a is NonNullable<typeof a> => a !== null)

        return {
          id:           l.id,
          title:        l.title,
          slug:         l.slug,
          lesson_order: l.lesson_order,
          articles,
        }
      })

    return {
      id:            ch.id,
      chapter_title: ch.chapter_title,
      chapter_order: ch.chapter_order,
      lessons:       chapterLessons,
    }
  })

  return NextResponse.json({
    course: {
      id:              course.id,
      title:           course.title,
      slug:            course.slug,
      description:     course.description ?? '',
      level:           course.level ?? 'beginner',
      status:          course.status,
      is_featured:     course.is_featured,
      show_on_sites:   course.show_on_sites,
      canonical_owner: course.canonical_owner,
    },
    chapters: resultChapters,
  })
}

// ── PATCH /api/roodber8/courses/[courseId]
// body: { action: string, ...actionFields }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { courseId: string } }
) {
  if (!(await isAuthenticated(req)))
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { courseId } = params
  const supabase = getClient()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const action = body.action as string | undefined

  // ── update_metadata ──────────────────────────────────────────────────────
  if (action === 'update_metadata') {
    const fields = body as Record<string, unknown>
    const ALLOWED = [
      'title', 'slug', 'description', 'level', 'status',
      'is_featured', 'show_on_sites', 'canonical_owner',
    ]
    const sanitised: Record<string, unknown> = {}
    for (const key of ALLOWED) {
      if (key in fields) sanitised[key] = fields[key]
    }
    if (Array.isArray(sanitised.show_on_sites)) {
      sanitised.show_on_sites = (sanitised.show_on_sites as string[])
        .map(s => SITE_CODE_MAP[s] ?? s)
    }
    sanitised.updated_at = new Date().toISOString()

    const { error } = await supabase
      .from('courses')
      .update(sanitised)
      .eq('id', courseId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── update_chapter ───────────────────────────────────────────────────────
  if (action === 'update_chapter') {
    const chapterId = body.chapterId as string
    const chapterTitle = body.chapter_title as string
    if (!chapterId || typeof chapterTitle !== 'string')
      return NextResponse.json({ error: 'chapterId and chapter_title required' }, { status: 400 })

    const { error } = await supabase
      .from('course_chapters')
      .update({ chapter_title: chapterTitle })
      .eq('id', chapterId)
      .eq('course_id', courseId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── add_chapter ──────────────────────────────────────────────────────────
  if (action === 'add_chapter') {
    const { data: maxRow } = await supabase
      .from('course_chapters')
      .select('chapter_order')
      .eq('course_id', courseId)
      .order('chapter_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextOrder = ((maxRow?.chapter_order as number) ?? 0) + 1

    const { data: inserted, error } = await supabase
      .from('course_chapters')
      .insert({ course_id: courseId, chapter_title: 'New Chapter', chapter_order: nextOrder })
      .select('id, chapter_title, chapter_order')
      .single()

    if (error || !inserted) return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })
    return NextResponse.json({ success: true, chapter: inserted })
  }

  // ── delete_chapter ───────────────────────────────────────────────────────
  if (action === 'delete_chapter') {
    const chapterId = body.chapterId as string
    if (!chapterId) return NextResponse.json({ error: 'chapterId required' }, { status: 400 })

    const { data: chapter } = await supabase
      .from('course_chapters')
      .select('id')
      .eq('id', chapterId)
      .eq('course_id', courseId)
      .maybeSingle()

    if (!chapter) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })

    const { error } = await supabase
      .from('course_chapters')
      .delete()
      .eq('id', chapterId)
      .eq('course_id', courseId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── reorder_chapters ─────────────────────────────────────────────────────
  if (action === 'reorder_chapters') {
    const orderedIds = body.orderedIds as string[]
    if (!Array.isArray(orderedIds)) return NextResponse.json({ error: 'orderedIds required' }, { status: 400 })

    const { data: owned } = await supabase
      .from('course_chapters')
      .select('id')
      .eq('course_id', courseId)
      .in('id', orderedIds)

    if (!owned || owned.length !== orderedIds.length)
      return NextResponse.json({ error: 'One or more chapters do not belong to this course' }, { status: 403 })

    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await supabase
        .from('course_chapters')
        .update({ chapter_order: i + 1 })
        .eq('id', orderedIds[i])
        .eq('course_id', courseId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  // ── update_lesson ────────────────────────────────────────────────────────
  if (action === 'update_lesson') {
    const lessonId = body.lessonId as string
    const title = body.title as string
    if (!lessonId || typeof title !== 'string')
      return NextResponse.json({ error: 'lessonId and title required' }, { status: 400 })

    const { error } = await supabase
      .from('course_lessons')
      .update({ title })
      .eq('id', lessonId)
      .eq('course_id', courseId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── add_lesson ───────────────────────────────────────────────────────────
  if (action === 'add_lesson') {
    const chapterId = body.chapterId as string
    const title = (body.title as string | undefined) ?? 'New Lesson'
    if (!chapterId) return NextResponse.json({ error: 'chapterId required' }, { status: 400 })

    const { data: chapter } = await supabase
      .from('course_chapters')
      .select('id, chapter_order')
      .eq('id', chapterId)
      .eq('course_id', courseId)
      .maybeSingle()

    if (!chapter) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })

    const { data: maxRow } = await supabase
      .from('course_lessons')
      .select('lesson_order')
      .eq('chapter_id', chapterId)
      .order('lesson_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextOrder = ((maxRow?.lesson_order as number) ?? 0) + 1
    const randomSuffix = Math.random().toString(36).slice(2, 6)
    const slug = `${courseId}-ch${chapter.chapter_order}-l${nextOrder}-${randomSuffix}`

    const { data: inserted, error } = await supabase
      .from('course_lessons')
      .insert({
        chapter_id:   chapterId,
        course_id:    courseId,
        title,
        slug,
        lesson_order: nextOrder,
      })
      .select('id, title, slug, lesson_order')
      .single()

    if (error || !inserted) return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })
    return NextResponse.json({ success: true, lesson: inserted })
  }

  // ── delete_lesson ────────────────────────────────────────────────────────
  if (action === 'delete_lesson') {
    const lessonId = body.lessonId as string
    if (!lessonId) return NextResponse.json({ error: 'lessonId required' }, { status: 400 })

    const { data: lesson } = await supabase
      .from('course_lessons')
      .select('id')
      .eq('id', lessonId)
      .eq('course_id', courseId)
      .maybeSingle()

    if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

    const { error } = await supabase
      .from('course_lessons')
      .delete()
      .eq('id', lessonId)
      .eq('course_id', courseId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── reorder_lessons ──────────────────────────────────────────────────────
  if (action === 'reorder_lessons') {
    const chapterId = body.chapterId as string
    const orderedIds = body.orderedIds as string[]
    if (!chapterId || !Array.isArray(orderedIds))
      return NextResponse.json({ error: 'chapterId and orderedIds required' }, { status: 400 })

    const { data: chapter } = await supabase
      .from('course_chapters')
      .select('id')
      .eq('id', chapterId)
      .eq('course_id', courseId)
      .maybeSingle()

    if (!chapter) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })

    const { data: owned } = await supabase
      .from('course_lessons')
      .select('id')
      .eq('chapter_id', chapterId)
      .in('id', orderedIds)

    if (!owned || owned.length !== orderedIds.length)
      return NextResponse.json({ error: 'One or more lessons do not belong to this chapter' }, { status: 403 })

    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await supabase
        .from('course_lessons')
        .update({ lesson_order: i + 1 })
        .eq('id', orderedIds[i])
        .eq('chapter_id', chapterId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  // ── add_article ──────────────────────────────────────────────────────────
  if (action === 'add_article') {
    const lessonId = body.lessonId as string
    const articleId = body.articleId as string
    if (!lessonId || !articleId)
      return NextResponse.json({ error: 'lessonId and articleId required' }, { status: 400 })

    const { data: lesson } = await supabase
      .from('course_lessons')
      .select('id')
      .eq('id', lessonId)
      .eq('course_id', courseId)
      .maybeSingle()

    if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

    const { data: maxRow } = await supabase
      .from('course_lesson_articles')
      .select('article_order')
      .eq('lesson_id', lessonId)
      .order('article_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextOrder = ((maxRow?.article_order as number) ?? 0) + 1

    const { error } = await supabase
      .from('course_lesson_articles')
      .insert({ lesson_id: lessonId, article_id: articleId, article_order: nextOrder })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── remove_article ───────────────────────────────────────────────────────
  if (action === 'remove_article') {
    const lessonId = body.lessonId as string
    const articleId = body.articleId as string
    if (!lessonId || !articleId)
      return NextResponse.json({ error: 'lessonId and articleId required' }, { status: 400 })

    const { data: lesson } = await supabase
      .from('course_lessons')
      .select('id')
      .eq('id', lessonId)
      .eq('course_id', courseId)
      .maybeSingle()

    if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

    const { error } = await supabase
      .from('course_lesson_articles')
      .delete()
      .eq('lesson_id', lessonId)
      .eq('article_id', articleId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── reorder_articles ─────────────────────────────────────────────────────
  if (action === 'reorder_articles') {
    const lessonId = body.lessonId as string
    const orderedIds = body.orderedIds as string[]
    if (!lessonId || !Array.isArray(orderedIds))
      return NextResponse.json({ error: 'lessonId and orderedIds required' }, { status: 400 })

    const { data: lesson } = await supabase
      .from('course_lessons')
      .select('id')
      .eq('id', lessonId)
      .eq('course_id', courseId)
      .maybeSingle()

    if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await supabase
        .from('course_lesson_articles')
        .update({ article_order: i + 1 })
        .eq('lesson_id', lessonId)
        .eq('article_id', orderedIds[i])
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// ── DELETE /api/roodber8/courses/[courseId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { courseId: string } }
) {
  if (!(await isAuthenticated(req)))
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { courseId } = params
  const supabase = getClient()

  try {
    // CASCADE removes course_chapters → course_lessons → course_lesson_articles
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', courseId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
