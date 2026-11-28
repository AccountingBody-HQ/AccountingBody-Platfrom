// app/api/roodber8/course-factory/save/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
// Receives course payload from Course Factory and writes to Supabase
// Replaces Sanity mutations API — Session 35
//
// Two modes (BP-1, D311):
// - create: refuses a web address (slug) that is already used; inserts a new
//   course. It never overwrites an existing course.
// - update: edits the loaded course by its id and never changes its address.
//   Before any write it keeps a full copy in the recycle bin. Lessons that were
//   loaded keep their id, address, time and media fields; new lessons get a
//   free address. All reads and checks happen before the first write.

import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isAuthenticated, signedOutResponse } from '@/lib/admin-auth'
import { getServerSupabase } from '@/lib/supabase-server'
import { SITE_CODE_MAP } from '@/lib/site-codes'
import { checkRead } from '@/lib/db-check'
import { reportServerError } from '@/lib/report-error'
import { refreshCourseCaches } from '@/lib/course-cache'
import { errorCode, moveToBin, snapshotCourse } from '@/lib/recycle-bin'

function getSupabase() {
  return getServerSupabase('admin')
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SAVE_MESSAGES = {
  readFailed: 'Could not read the current course. Nothing was changed.',
  exists: 'A course with this web address already exists. Load that course to edit it, or change the title.',
  slugChanged: 'The course address changed since it was loaded. Reload the course.',
  notFound: 'This course no longer exists. Reload the course list.',
  unknownLesson: 'A lesson in this save does not belong to this course. Reload the course.',
  duplicateLesson: 'The same lesson appears twice in this save. Reload the course.',
  binFailed: 'Could not keep a copy of the current course in the recycle bin. Nothing was changed.',
  updateFailed: 'Could not save the course details. Nothing was changed.',
  createFailed: 'Could not create the course. Nothing was saved.',
  createRolledBack: 'Course save failed mid-write. Partial data has been rolled back. Please try again.',
  createNotRolledBack:
    'Course save failed mid-write and the partial course could not be rolled back. Load it and delete it, then try again.',
  restored:
    'Course update failed — your original content has been restored. Please try again. The copy saved in the recycle bin can also restore it.',
  restoreFailed:
    'Course update failed and automatic restore was unsuccessful. The copy saved in the recycle bin can also restore it: delete this course, then restore the copy on the Recycle bin page.',
} as const

function fail(error: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status })
}

type LessonRef = { title: string; articleIds: string[]; lessonId?: string }
type ChapterIn = { chapterTitle: string; lessonRefs: LessonRef[] }
type Row = Record<string, any>

// Where each lesson of the payload goes: a kept lesson's saved row, or the
// address chosen for a new lesson.
type LessonPlan = { kept: Row | null; slug: string }

// The fields a save writes to the course row (the address is never changed here).
const COURSE_FIELDS = [
  'title', 'description', 'level', 'status', 'is_featured', 'show_on_sites', 'canonical_owner', 'platform', 'updated_at',
] as const

function validChapters(chapters: unknown): chapters is ChapterIn[] {
  return (
    Array.isArray(chapters) &&
    chapters.every(
      (ch: any) =>
        ch &&
        Array.isArray(ch.lessonRefs) &&
        ch.lessonRefs.every((l: any) => l && Array.isArray(l.articleIds)),
    )
  )
}

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`)

// Every lesson address that starts with "<course-slug>-ch" (one read, in pages).
async function takenLessonSlugs(supabase: SupabaseClient, slug: string): Promise<Set<string> | null> {
  const taken = new Set<string>()
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const read = checkRead(
      await supabase
        .from('course_lessons')
        .select('slug')
        .like('slug', `${escapeLike(slug)}-ch%`)
        .order('slug', { ascending: true })
        .range(from, from + PAGE - 1),
      'course-factory/save: lesson addresses',
    )
    if (!read.ok) return null
    const rows = (read.data as { slug: string }[] | null) ?? []
    for (const row of rows) taken.add(row.slug)
    if (rows.length < PAGE) return taken
  }
}

// Kept lessons keep their own address; a new lesson gets
// "<course-slug>-ch<n>-l<m>", or that with -2, -3 … when it is taken.
function planLessons(chapters: ChapterIn[], slug: string, kept: Map<string, Row>, taken: Set<string>): LessonPlan[][] {
  const used = new Set<string>(taken)
  kept.forEach((row) => used.add(String(row.slug)))
  return chapters.map((chapter, ci) =>
    chapter.lessonRefs.map((ref, li) => {
      const keptRow = ref.lessonId ? kept.get(ref.lessonId) ?? null : null
      if (keptRow) return { kept: keptRow, slug: String(keptRow.slug) }
      const base = `${slug}-ch${ci + 1}-l${li + 1}`
      let candidate = base
      for (let n = 2; used.has(candidate); n++) candidate = `${base}-${n}`
      used.add(candidate)
      return { kept: null, slug: candidate }
    }),
  )
}

// Inserts chapters, lessons and lesson-article links. Throws on the first error.
async function writeStructure(supabase: SupabaseClient, courseId: string, chapters: ChapterIn[], plan: LessonPlan[][]) {
  for (let ci = 0; ci < chapters.length; ci++) {
    const chapter = chapters[ci]

    const { data: ch, error: chError } = await supabase
      .from('course_chapters')
      .insert({
        course_id:     courseId,
        chapter_title: chapter.chapterTitle,
        chapter_order: ci + 1,
      })
      .select('id')
      .single()

    if (chError) throw chError

    for (let li = 0; li < chapter.lessonRefs.length; li++) {
      const lessonRef = chapter.lessonRefs[li]
      const { kept, slug: lessonSlug } = plan[ci][li]

      const lessonRow: Row = {
        chapter_id:   ch.id,
        course_id:    courseId,
        title:        lessonRef.title,
        slug:         lessonSlug,
        lesson_order: li + 1,
      }
      if (kept) {
        // A loaded lesson keeps its id, address, time and media fields.
        lessonRow.id = kept.id
        lessonRow.created_at = kept.created_at
        lessonRow.estimated_time = kept.estimated_time ?? null
        lessonRow.video_url = kept.video_url ?? null
        lessonRow.audio_url = kept.audio_url ?? null
        lessonRow.external_quiz_url = kept.external_quiz_url ?? null
      }

      const { data: lesson, error: lessonError } = await supabase
        .from('course_lessons')
        .insert(lessonRow)
        .select('id')
        .single()

      if (lessonError) throw lessonError

      // Link articles to lesson
      for (let ai = 0; ai < lessonRef.articleIds.length; ai++) {
        // articleIds are Supabase UUIDs (a.id from the fetch-article route)
        const { error: linkError } = await supabase
          .from('course_lesson_articles')
          .insert({
            lesson_id:     lesson.id,
            article_id:    lessonRef.articleIds[ai],
            article_order: ai + 1,
          })

        if (linkError) throw linkError
      }
    }
  }
}

async function createCourse(supabase: SupabaseClient, slug: string, fields: Row, chapters: ChapterIn[]) {
  const existingRead = checkRead(
    await supabase.from('courses').select('id').eq('slug', slug).maybeSingle(),
    'course-factory/save: existing course',
  )
  if (!existingRead.ok) return fail(SAVE_MESSAGES.readFailed, 500)
  if (existingRead.data) return fail(SAVE_MESSAGES.exists, 409)

  const taken = await takenLessonSlugs(supabase, slug)
  if (!taken) return fail(SAVE_MESSAGES.readFailed, 500)
  const plan = planLessons(chapters, slug, new Map(), taken)

  const { data: course, error: courseError } = await supabase
    .from('courses')
    .insert({ slug, ...fields })
    .select('id')
    .single()
  if (courseError || !course) {
    const code = errorCode(courseError)
    if (code === '23505') return fail(SAVE_MESSAGES.exists, 409)
    console.error('course-factory/save: course insert failed', code)
    return fail(SAVE_MESSAGES.createFailed, 500)
  }

  try {
    await writeStructure(supabase, course.id, chapters, plan)
    return NextResponse.json({ success: true, id: course.id })
  } catch (err) {
    console.error('course-factory/save: insert failed, rolling back', errorCode(err))
    // The new course row (and with it any chapters and lessons) is removed.
    const { error: rollbackError } = await supabase.from('courses').delete().eq('id', course.id)
    if (rollbackError) {
      console.error('course-factory/save: rollback delete failed', errorCode(rollbackError))
      return fail(SAVE_MESSAGES.createNotRolledBack, 500)
    }
    return fail(SAVE_MESSAGES.createRolledBack, 500)
  }
}

async function updateCourse(supabase: SupabaseClient, courseId: string, slug: string, fields: Row, chapters: ChapterIn[]) {
  // ── Every read and check happens before the first write ──
  const snapshot = await snapshotCourse(supabase, courseId)
  if (!snapshot.ok) return fail(SAVE_MESSAGES.readFailed, 500)
  if (!snapshot.found) return fail(SAVE_MESSAGES.notFound, 404)
  const before = snapshot.row
  if (before.slug !== slug) return fail(SAVE_MESSAGES.slugChanged, 409)

  const kept = new Map<string, Row>()
  for (const row of snapshot.payload.course_lessons as Row[]) kept.set(String(row.id), row)
  for (const chapter of chapters) {
    for (const ref of chapter.lessonRefs) {
      if (ref.lessonId && !kept.has(ref.lessonId)) return fail(SAVE_MESSAGES.unknownLesson, 400)
    }
  }

  const hasNewLessons = chapters.some((ch) => ch.lessonRefs.some((ref) => !ref.lessonId))
  const taken = hasNewLessons ? await takenLessonSlugs(supabase, slug) : new Set<string>()
  if (!taken) return fail(SAVE_MESSAGES.readFailed, 500)
  const plan = planLessons(chapters, slug, kept, taken)

  // ── A full copy goes to the recycle bin before anything changes ──
  const minute = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const moved = await moveToBin(supabase, {
    kind: 'course',
    reason: 'course_save',
    label: `${typeof before.title === 'string' ? before.title : ''} (before save ${minute} UTC)`,
    sourceTable: 'courses',
    sourceId: courseId,
    payload: snapshot.payload,
  })
  if (!moved.ok) return fail(SAVE_MESSAGES.binFailed, 500)

  // ── Step 1: the course row, by id (its address never changes here) ──
  const { error: courseError } = await supabase.from('courses').update(fields).eq('id', courseId).select('id').single()
  if (courseError) {
    console.error('course-factory/save: course update failed', errorCode(courseError))
    return fail(SAVE_MESSAGES.updateFailed, 500, { binId: moved.id })
  }

  try {
    // ── Step 2: delete the old structure (CASCADE removes lessons + links) ──
    const { error: deleteError } = await supabase.from('course_chapters').delete().eq('course_id', courseId)
    if (deleteError) throw deleteError

    // ── Step 3: write the new structure ──
    await writeStructure(supabase, courseId, chapters, plan)
    return NextResponse.json({ success: true, id: courseId, binId: moved.id })
  } catch (err) {
    // Put the course back as it was: its own fields first, then the structure
    // with the original ids. Clear any partial structure first.
    console.error('course-factory/save: mid-write failure on update, restoring', errorCode(err))
    try {
      const previous: Row = {}
      for (const key of COURSE_FIELDS) previous[key] = before[key]
      const { error: fieldsError } = await supabase.from('courses').update(previous).eq('id', courseId)
      if (fieldsError) throw fieldsError

      const { error: clearError } = await supabase.from('course_chapters').delete().eq('course_id', courseId)
      if (clearError) throw clearError

      for (const table of ['course_chapters', 'course_lessons', 'course_lesson_articles'] as const) {
        const rows = snapshot.payload[table] ?? []
        if (rows.length === 0) continue
        const { error: restoreError } = await supabase.from(table).insert(rows)
        if (restoreError) throw restoreError
      }
      return fail(SAVE_MESSAGES.restored, 500, { binId: moved.id })
    } catch (restoreErr) {
      console.error('course-factory/save: restore from snapshot failed', errorCode(restoreErr))
      return fail(SAVE_MESSAGES.restoreFailed, 500, { restoreFailed: true, binId: moved.id })
    }
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return signedOutResponse()
  }
  let body: any
  try {
    body = await req.json()
  } catch (error) {
    reportServerError('admin course save request unreadable', error, { area: 'admin' })
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { mode, courseId, title, slug, description, level, status, isFeatured, showOnSites, chapters, canonical } = body ?? {}

  if (!title || !slug) {
    return NextResponse.json({ error: 'Title and slug are required' }, { status: 400 })
  }
  if (mode !== 'create' && mode !== 'update') {
    return fail('Save mode is missing. Reload Course Factory and try again.', 400)
  }
  if (mode === 'update' && (typeof courseId !== 'string' || !UUID_RE.test(courseId))) {
    return fail('The course id is missing or not valid. Reload the course.', 400)
  }
  if (!validChapters(chapters)) {
    return fail('The chapters and lessons could not be read. Nothing was changed.', 400)
  }
  const lessonIds = chapters.flatMap((ch) => ch.lessonRefs.map((ref) => ref.lessonId)).filter((id) => id !== undefined && id !== null && id !== '')
  if (lessonIds.some((id) => typeof id !== 'string' || !UUID_RE.test(id))) {
    return fail('A lesson id is not valid. Reload the course.', 400)
  }
  if (new Set(lessonIds).size !== lessonIds.length) return fail(SAVE_MESSAGES.duplicateLesson, 400)
  if (mode === 'create' && lessonIds.length > 0) {
    return fail('A new course cannot reuse lessons of another course. Start a new course, or load the course to edit it.', 400)
  }

  const resolvedCanonical: string = (canonical as string | undefined) ?? 'accountingbody'
  const platform = SITE_CODE_MAP[resolvedCanonical] ?? 'ab'
  const sites: string[] = Array.isArray(showOnSites) ? showOnSites : ['accountingbody']

  const fields: Row = {
    title,
    description:     description ?? '',
    level:           level ?? 'beginner',
    status:          status ?? 'draft',
    is_featured:     isFeatured ?? false,
    show_on_sites:   sites.map((s: string) => SITE_CODE_MAP[s] ?? s),
    canonical_owner: resolvedCanonical,
    platform,
    updated_at:      new Date().toISOString(),
  }

  try {
    const supabase = getSupabase()
    const saved = mode === 'create'
      ? await createCourse(supabase, String(slug), fields, chapters)
      : await updateCourse(supabase, courseId, String(slug), fields, chapters)
    // Only a save that worked refreshes the course pages (lib/course-cache.ts).
    if (saved.ok) refreshCourseCaches()
    return saved
  } catch (e: any) {
    reportServerError('admin course save failed', e, { area: 'admin' })
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 })
  }
}
