// Admin recycle bin (migrations/0027): a full copy of anything the admin area
// deletes, or a Course Factory save replaces, kept for 90 days.
//
// - Server only. Every helper takes the route's own client
//   (getServerSupabase('admin')); none creates one.
// - Reads are flat (select('*'), one table per query) and checked with
//   checkRead. A failed read means "do not delete".
// - moveToBin writes ONE bin row. A caller deletes only when it returns ok;
//   otherwise it answers BIN_FAILED and changes nothing (fail closed).
// - Logs carry short error codes only, never messages or row data.
// - Labels are public content titles or "<kind> <first 8 of id>"; e-mail
//   addresses are removed from any label.

import type { SupabaseClient } from '@supabase/supabase-js'
import { checkRead } from './db-check'

export type BinKind =
  | 'course'
  | 'course_chapter'
  | 'course_lesson'
  | 'course_lesson_article'
  | 'article'
  | 'question_set'
  | 'question'
  | 'job_provider'
  | 'studio_reference'
  | 'form_entry'

export type BinReason = 'delete' | 'course_save'

type Row = Record<string, unknown>
export type BinPayload = Record<string, unknown[]>

export const BIN_TABLE = 'admin_recycle_bin'
export const LABEL_MAX = 300
export const BIN_FAILED = 'Could not keep a copy in the recycle bin. Nothing was deleted.'
export const DELETE_FAILED = 'Delete failed. Nothing was deleted.'
export const SNAPSHOT_FAILED ='Could not read the item to keep a copy in the recycle bin. Nothing was deleted.'

// The visitor-form tables the actions route may delete from.
export const FORM_TABLES = [
  'help_requests',
  'contact_submissions',
  'firms_applications',
  'email_subscribers',
  'job_seeker_registrations',
  'employer_briefs',
] as const

const PAGE_ROWS = 1000 // one read never asks for more than this many rows
const IN_CHUNK = 100 // ids per .in() list

const EMAIL_RE = /[^\s@<>()[\]"',;:]+@[^\s@<>()[\]"',;:]+\.[A-Za-z]{2,}/g

// A short, safe code for logs: the database code when there is one.
export function errorCode(error: unknown): string {
  const raw = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : ''
  return /^[A-Za-z0-9_]{1,16}$/.test(raw) ? raw : 'unknown'
}

// The bin label: the given title (spaces tidied, e-mail addresses removed,
// at most 300 characters), or "<kind> <first 8 of id>" when that is empty.
export function binLabel(kind: BinKind, sourceId: string | null | undefined, title?: unknown): string {
  const text = (typeof title === 'string' ? title : '')
    .replace(EMAIL_RE, '[e-mail removed]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LABEL_MAX)
    .trim()
  if (text) return text
  const short = String(sourceId ?? '').slice(0, 8)
  return short ? `${kind} ${short}` : kind
}

export function rowCount(payload: BinPayload): number {
  return Object.values(payload).reduce((total, rows) => total + (Array.isArray(rows) ? rows.length : 0), 0)
}

// ── Reads ──────────────────────────────────────────────────────────────────

type Read<T> = { ok: true; data: T } | { ok: false }

async function readOne(supabase: SupabaseClient, table: string, column: string, value: string, label: string): Promise<Read<Row | null>> {
  const read = checkRead(await supabase.from(table).select('*').eq(column, value).maybeSingle(), label)
  if (!read.ok) return { ok: false }
  return { ok: true, data: (read.data as Row | null) ?? null }
}

// Every row whose `column` is one of `values` (and that matches `extra`), in
// chunks of 100 values and pages of 1000 rows, so no row is missed.
async function readAll(
  supabase: SupabaseClient,
  table: string,
  column: string,
  values: string[],
  label: string,
  extra: Record<string, string> = {},
): Promise<Read<Row[]>> {
  const rows: Row[] = []
  for (let start = 0; start < values.length; start += IN_CHUNK) {
    const chunk = values.slice(start, start + IN_CHUNK)
    for (let from = 0; ; from += PAGE_ROWS) {
      let query = supabase.from(table).select('*').in(column, chunk)
      for (const [key, value] of Object.entries(extra)) query = query.eq(key, value)
      const read = checkRead(await query.order('id', { ascending: true }).range(from, from + PAGE_ROWS - 1), label)
      if (!read.ok) return { ok: false }
      const page = (read.data as Row[] | null) ?? []
      rows.push(...page)
      if (page.length < PAGE_ROWS) break
    }
  }
  return { ok: true, data: rows }
}

const idsOf = (rows: Row[]) => rows.map((row) => String(row.id))

// ── Snapshots ──────────────────────────────────────────────────────────────

export type Snapshot =
  | { ok: false }
  | { ok: true; found: false }
  | { ok: true; found: true; row: Row; payload: BinPayload }

const FAILED: Snapshot = { ok: false }
const MISSING: Snapshot = { ok: true, found: false }

export async function snapshotCourseBy(supabase: SupabaseClient, column: 'id' | 'slug', value: string): Promise<Snapshot> {
  const course = await readOne(supabase, 'courses', column, value, 'recycle bin: course')
  if (!course.ok) return FAILED
  if (!course.data) return MISSING
  const chapters = await readAll(supabase, 'course_chapters', 'course_id', [String(course.data.id)], 'recycle bin: course chapters')
  if (!chapters.ok) return FAILED
  const lessons = await readAll(supabase, 'course_lessons', 'chapter_id', idsOf(chapters.data), 'recycle bin: course lessons')
  if (!lessons.ok) return FAILED
  const links = await readAll(supabase, 'course_lesson_articles', 'lesson_id', idsOf(lessons.data), 'recycle bin: lesson articles')
  if (!links.ok) return FAILED
  return {
    ok: true,
    found: true,
    row: course.data,
    payload: {
      courses: [course.data],
      course_chapters: chapters.data,
      course_lessons: lessons.data,
      course_lesson_articles: links.data,
    },
  }
}

export function snapshotCourse(supabase: SupabaseClient, courseId: string): Promise<Snapshot> {
  return snapshotCourseBy(supabase, 'id', courseId)
}

export async function snapshotChapter(supabase: SupabaseClient, chapterId: string): Promise<Snapshot> {
  const chapter = await readOne(supabase, 'course_chapters', 'id', chapterId, 'recycle bin: chapter')
  if (!chapter.ok) return FAILED
  if (!chapter.data) return MISSING
  const lessons = await readAll(supabase, 'course_lessons', 'chapter_id', [chapterId], 'recycle bin: chapter lessons')
  if (!lessons.ok) return FAILED
  const links = await readAll(supabase, 'course_lesson_articles', 'lesson_id', idsOf(lessons.data), 'recycle bin: lesson articles')
  if (!links.ok) return FAILED
  return {
    ok: true,
    found: true,
    row: chapter.data,
    payload: { course_chapters: [chapter.data], course_lessons: lessons.data, course_lesson_articles: links.data },
  }
}

export async function snapshotLesson(supabase: SupabaseClient, lessonId: string): Promise<Snapshot> {
  const lesson = await readOne(supabase, 'course_lessons', 'id', lessonId, 'recycle bin: lesson')
  if (!lesson.ok) return FAILED
  if (!lesson.data) return MISSING
  const links = await readAll(supabase, 'course_lesson_articles', 'lesson_id', [lessonId], 'recycle bin: lesson articles')
  if (!links.ok) return FAILED
  return { ok: true, found: true, row: lesson.data, payload: { course_lessons: [lesson.data], course_lesson_articles: links.data } }
}

// An article and every course link to it (the links go with it).
export async function snapshotArticle(supabase: SupabaseClient, articleId: string): Promise<Snapshot> {
  const article = await readOne(supabase, 'articles', 'id', articleId, 'recycle bin: article')
  if (!article.ok) return FAILED
  if (!article.data) return MISSING
  const links = await readAll(supabase, 'course_lesson_articles', 'article_id', [articleId], 'recycle bin: article links')
  if (!links.ok) return FAILED
  return { ok: true, found: true, row: article.data, payload: { articles: [article.data], course_lesson_articles: links.data } }
}

export async function snapshotQuestionSet(supabase: SupabaseClient, setId: string): Promise<Snapshot> {
  const set = await readOne(supabase, 'question_sets', 'id', setId, 'recycle bin: question set')
  if (!set.ok) return FAILED
  if (!set.data) return MISSING
  const questions = await readAll(supabase, 'questions', 'set_id', [setId], 'recycle bin: questions')
  if (!questions.ok) return FAILED
  const cases = await readAll(supabase, 'question_cases', 'set_id', [setId], 'recycle bin: question cases')
  if (!cases.ok) return FAILED
  return {
    ok: true,
    found: true,
    row: set.data,
    payload: { question_sets: [set.data], questions: questions.data, question_cases: cases.data },
  }
}

// A provider and its run history. provider_errors (run logs) are not kept.
export async function snapshotProvider(supabase: SupabaseClient, slug: string): Promise<Snapshot> {
  const provider = await readOne(supabase, 'job_providers', 'slug', slug, 'recycle bin: provider')
  if (!provider.ok) return FAILED
  if (!provider.data) return MISSING
  const runs = await readAll(supabase, 'provider_runs', 'provider_id', [String(provider.data.id)], 'recycle bin: provider runs')
  if (!runs.ok) return FAILED
  return { ok: true, found: true, row: provider.data, payload: { job_providers: [provider.data], provider_runs: runs.data } }
}

// The rows of one table that match every filter (a single question,
// reference, form entry or lesson-article link).
export async function snapshotRows(supabase: SupabaseClient, table: string, filters: Record<string, string>): Promise<Snapshot> {
  const [first, ...rest] = Object.entries(filters)
  if (!first) return FAILED
  const rows = await readAll(supabase, table, first[0], [first[1]], `recycle bin: ${table}`, Object.fromEntries(rest))
  if (!rows.ok) return FAILED
  if (rows.data.length === 0) return MISSING
  return { ok: true, found: true, row: rows.data[0], payload: { [table]: rows.data } }
}

// ── Writes ─────────────────────────────────────────────────────────────────

export type MoveInput = {
  kind: BinKind
  reason: BinReason
  label: unknown
  sourceTable: string
  sourceId: string | null
  payload: BinPayload
}

export type MoveResult = { ok: true; id: string } | { ok: false; code: string }

export async function moveToBin(supabase: SupabaseClient, input: MoveInput): Promise<MoveResult> {
  let id: string
  try {
    const { data, error } = await supabase
      .from(BIN_TABLE)
      .insert({
        kind: input.kind,
        reason: input.reason,
        label: binLabel(input.kind, input.sourceId, input.label),
        source_table: input.sourceTable,
        source_id: input.sourceId,
        payload: input.payload,
        row_count: rowCount(input.payload),
      })
      .select('id')
      .single()
    if (error) {
      const code = errorCode(error)
      console.error('recycle bin: copy not kept', code)
      return { ok: false, code }
    }
    if (!data?.id) {
      console.error('recycle bin: copy not kept', 'no_id')
      return { ok: false, code: 'no_id' }
    }
    id = String(data.id)
  } catch (error) {
    const code = errorCode(error)
    console.error('recycle bin: copy not kept', code)
    return { ok: false, code }
  }
  await purgeExpired(supabase)
  return { ok: true, id }
}

// Removes expired copies. Best effort: never throws, never blocks the caller's
// answer on a failure.
export async function purgeExpired(supabase: SupabaseClient, now: Date = new Date()): Promise<void> {
  try {
    const { error } = await supabase.from(BIN_TABLE).delete().lt('expires_at', now.toISOString())
    if (error) console.error('recycle bin: expired copies not removed', errorCode(error))
  } catch (error) {
    console.error('recycle bin: expired copies not removed', errorCode(error))
  }
}

// Snapshot → bin copy, in one step for a delete route. ok: the caller may
// now run its delete; otherwise answer { status, error } and delete nothing.
export type KeepResult = { ok: true; binId: string; row: Row; payload: BinPayload } | { ok: false; status: number; error: string }

export async function keepCopyBeforeDelete(
  supabase: SupabaseClient,
  snapshot: Snapshot,
  // sourceId defaults to the copied row's id.
  meta: { kind: BinKind; sourceTable: string; sourceId?: string; label: (row: Row) => unknown; notFound: string },
): Promise<KeepResult> {
  if (!snapshot.ok) return { ok: false, status: 500, error: SNAPSHOT_FAILED }
  if (!snapshot.found) return { ok: false, status: 404, error: meta.notFound }
  const moved = await moveToBin(supabase, {
    kind: meta.kind,
    reason: 'delete',
    label: meta.label(snapshot.row),
    sourceTable: meta.sourceTable,
    sourceId: meta.sourceId ?? (snapshot.row.id === undefined || snapshot.row.id === null ? null : String(snapshot.row.id)),
    payload: snapshot.payload,
  })
  if (!moved.ok) return { ok: false, status: 500, error: BIN_FAILED }
  return { ok: true, binId: moved.id, row: snapshot.row, payload: snapshot.payload }
}

// ── Restore ────────────────────────────────────────────────────────────────

export const RESTORE_MESSAGES: Record<string, string> = {
  '23505': 'Cannot restore: an item with the same address or id already exists. Rename or delete that item first.',
  '23503': 'Cannot restore: something it belongs to no longer exists. Restore that first.',
  P0001: 'Cannot restore: this item has already been restored, or it holds something that cannot be restored here.',
  P0002: 'Cannot restore: this item is no longer in the recycle bin.',
}
export const RESTORE_FAILED = 'Restore failed. Nothing was changed.'

export function restoreMessage(code: string): string {
  return RESTORE_MESSAGES[code] ?? RESTORE_FAILED
}

export type RestoreResult = { ok: true; counts: Record<string, number> } | { ok: false; code: string; message: string }

export async function restoreFromBin(supabase: SupabaseClient, id: string): Promise<RestoreResult> {
  try {
    const { data, error } = await supabase.rpc('admin_recycle_restore', { p_id: id })
    if (error) {
      const code = errorCode(error)
      console.error('recycle bin: restore failed', code)
      return { ok: false, code, message: restoreMessage(code) }
    }
    const counts: Record<string, number> = {}
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      for (const [table, count] of Object.entries(data as Record<string, unknown>)) {
        if (typeof count === 'number') counts[table] = count
      }
    }
    return { ok: true, counts }
  } catch (error) {
    const code = errorCode(error)
    console.error('recycle bin: restore failed', code)
    return { ok: false, code, message: restoreMessage(code) }
  }
}
