/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/ab-press-builder.ts
// Accounting Body Press — shared course builder
// Extracted from app/api/roodber8/ab-press/generate/route.ts (Phase 4A) so
// generate/route.ts and export-word/route.ts no longer each define their own
// copy of buildCourse(). This is the more complete version
// (carries publicationWarnings per article, used by the generate route's
// buildFidelity() report); export-word/route.ts simply never reads that
// field.
import { createHash } from "node:crypto"
import { getCourseBySlug } from "@/lib/coursesNew"
import { htmlToBlocks } from "@/lib/html-to-blocks"
import { filterForPublication, getPublicationWarnings } from "@/lib/publication-filter"
import { getServerSupabase } from "@/lib/supabase-server"

export interface BuildStats {
  mcqFailed: string[]
  mcqNotFound: string[]
  // Ids of the course's articles that are not published.
  unpublished: string[]
}

/** What the admin sees when the practice questions could not be read. */
export const READ_FAILED = "Could not read the practice questions, so nothing was made. Please try again in a minute."

/** What the admin sees when the articles could not be read. */
export const ARTICLES_READ_FAILED = "Could not read the articles, so nothing was made. Please try again in a minute."

/** What the admin sees when a course has no articles at all. */
export const EMPTY_COURSE = "No articles were found for this course, so nothing was made. Please check the course and try again in a minute."

/** True when the whole course has no articles. */
export function isEmptyCourse(course: { chapters: { lessons: { articles: unknown[] }[] }[] }): boolean {
  return course.chapters.every((ch) => ch.lessons.every((l) => l.articles.length === 0))
}

/** A short key of the course's chapters and their articles, in order. Two reads
 *  of a course give the same key only when these are the same. */
export function courseKey(course: { chapters: { id: string; chapterOrder: number; lessons: { articles: { id: string }[] }[] }[] }): string {
  const structure = course.chapters.map((ch) => [ch.id, ch.chapterOrder, ch.lessons.flatMap((l) => l.articles.map((a) => a.id))])
  return createHash("sha256").update(JSON.stringify(structure)).digest("hex").slice(0, 12)
}

/** True when the stored answer is one of the four options. */
export function hasAnswer(correctIndex: unknown): boolean {
  return [0, 1, 2, 3].includes(correctIndex as number)
}

// ── Lines of the check reports ───────────────────────────────────────────────
/** For the set slugs of the printed questions without an answer, one for each. */
export function noAnswerLine(setSlugs: string[]): string {
  return setSlugs.length > 0
    ? `[WARN] ${setSlugs.length} question(s) with no stored answer (printed as –) in set(s): ${Array.from(new Set(setSlugs)).join(", ")}`
    : "[PASS] Every printed question has a stored answer"
}

/** For the slugs of the printed articles that are not published. */
export function unpublishedLine(articleSlugs: string[]): string {
  const slugs = Array.from(new Set(articleSlugs))
  return slugs.length > 0
    ? `[WARN] ${slugs.length} unpublished article(s) printed: ${slugs.join(", ")}`
    : "[PASS] Every printed article is published"
}

/** Service-role Supabase client used by AB Press (the admin time limit). */
export function createSupabaseClient() {
  return getServerSupabase("admin")
}

// ── Reads ────────────────────────────────────────────────────────────────────
const PAGE_ROWS = 1000 // one request never asks for more rows than this
const IN_CHUNK = 100 // values per .in() list

// A failed read: the fixed message for the admin. The database's short code
// goes with it for the problem report, and its whole answer (cause) for the
// server log only.
function readFailed(message: string, what: string, cause: { code?: unknown }): Error {
  const failed = new Error(message) as Error & { code?: string; what?: string; cause?: unknown }
  if (typeof cause.code === "string" && /^[A-Za-z0-9_.-]{1,40}$/.test(cause.code)) failed.code = cause.code
  failed.what = what
  failed.cause = cause
  return failed
}

interface PagedQuery {
  range(from: number, to: number): PromiseLike<{ data: unknown; error: { code?: unknown } | null; count: number | null }>
}

// Every row for a list of values, in chunks of 100 values and in pages. The
// query asks for the exact total and ends with .order("id"), so pages neither
// overlap nor skip. The next page starts after the rows RECEIVED (a database
// setting may send fewer than asked for) until the total is in. Anything else
// than all rows is thrown, never returned.
async function readAll(
  what: string,
  message: string,
  values: string[],
  query: (chunk: string[]) => PagedQuery,
): Promise<any[]> {
  const rows: any[] = []
  for (let start = 0; start < values.length; start += IN_CHUNK) {
    const chunk = values.slice(start, start + IN_CHUNK)
    let received = 0
    let total = 0
    do {
      const { data, error, count } = await query(chunk).range(received, received + PAGE_ROWS - 1)
      if (error) throw readFailed(message, what, error)
      if (!Array.isArray(data)) throw readFailed(message, what, { code: "NO_DATA" })
      if (count === null || !Number.isInteger(count)) throw readFailed(message, what, { code: "NO_TOTAL" })
      if (received > 0 && count !== total) throw readFailed(message, what, { code: "TOTAL_CHANGED" })
      if (data.length === 0 && received < count) throw readFailed(message, what, { code: "EMPTY_PAGE" })
      rows.push(...data)
      received += data.length
      total = count
    } while (received < total)
  }
  return rows
}

/** The articles with these ids; every one of them, or an error. */
export async function readBookArticles(ids: string[], columns: string): Promise<any[]> {
  const supabase = createSupabaseClient()
  const wanted = Array.from(new Set(ids))
  const rows = await readAll("articles", ARTICLES_READ_FAILED, wanted, (chunk) =>
    supabase.from("articles").select(columns, { count: "exact" }).in("id", chunk).order("id", { ascending: true }))
  const found = new Set(rows.map((row) => row.id))
  if (wanted.some((id) => !found.has(id))) throw readFailed(ARTICLES_READ_FAILED, "articles", { code: "ROWS_MISSING" })
  return rows
}

/** The set slug in an article's practice link, or "". */
export function practiceSlug(link: string | null | undefined): string {
  return (link ?? "").split("/").filter(Boolean).pop() ?? ""
}

function practiceSlugs(links: (string | null | undefined)[]): string[] {
  return Array.from(new Set(links.map(practiceSlug).filter(Boolean)))
}

/** Slug to id of the live sets named by these practice links (any site). */
export async function readLiveSets(links: (string | null | undefined)[]): Promise<Map<string, string>> {
  const supabase = createSupabaseClient()
  const rows = await readAll("sets", READ_FAILED, practiceSlugs(links), (chunk) =>
    supabase.from("question_sets").select("id, slug", { count: "exact" }).in("slug", chunk).eq("status", "published").order("id", { ascending: true }))
  return new Map<string, string>(rows.map((row) => [row.slug, row.id]))
}

// Only blanks at the end are left out, so every option keeps its letter.
function bookOptions(row: any): string[] {
  const options: string[] = [row.option_a, row.option_b, row.option_c, row.option_d].map((option) => option ?? "")
  while (options.length > 0 && options[options.length - 1].trim() === "") options.pop()
  return options
}

/** Slug to questions, in print order, of the live sets named by these links. */
export async function readBookQuestions(links: (string | null | undefined)[]): Promise<Map<string, any[]>> {
  const supabase = createSupabaseClient()
  const sets = await readLiveSets(links)
  const rows = await readAll("questions", READ_FAILED, Array.from(sets.values()), (chunk) =>
    supabase
      .from("questions")
      .select("set_id, question_text, option_a, option_b, option_c, option_d, correct_index, explanation", { count: "exact" })
      .in("set_id", chunk)
      .order("question_order", { ascending: true })
      .order("id", { ascending: true }))
  const bySet = new Map<string, any[]>()
  for (const row of rows) {
    const list = bySet.get(row.set_id) ?? []
    list.push({
      questionText:  row.question_text,
      options:       bookOptions(row),
      correctIndex:  row.correct_index,
      explanation:   row.explanation ?? "",
    })
    bySet.set(row.set_id, list)
  }
  return new Map(Array.from(sets).map(([slug, id]) => [slug, bySet.get(id) ?? []]))
}

/** How many questions these sets have: a true count, whatever the row limit. */
export async function countQuestions(setIds: string[]): Promise<number> {
  const supabase = createSupabaseClient()
  let counted = 0
  for (let start = 0; start < setIds.length; start += IN_CHUNK) {
    const { count, error } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true })
      .in("set_id", setIds.slice(start, start + IN_CHUNK))
    if (error || count === null || !Number.isInteger(count)) throw readFailed(READ_FAILED, "count", error ?? { code: "NO_TOTAL" })
    counted += count
  }
  return counted
}

// ── Build course in BookTemplate shape ───────────────────────────────────────
export async function buildCourse(slug: string, stats: BuildStats) {
  const course = await getCourseBySlug(slug, true)
  if (!course) throw new Error("Course not found")
  if (isEmptyCourse(course)) throw new Error(EMPTY_COURSE)

  // Fetch full article content (including HTML body and mcq_url)
  const allArticleIds = course.chapters
    .flatMap((ch) => ch.lessons.flatMap((l) => l.articles.map((a) => a.id)))
  const articleRows = await readBookArticles(allArticleIds, "id, content, mcq_url, status")
  const articleMap = new Map(articleRows.map((a) => [a.id, a]))
  for (const a of articleRows) if (a.status !== "published") stats.unpublished.push(a.id)

  // All quiz questions of the book, read together.
  const slugToQuestions = await readBookQuestions(articleRows.map((a) => a.mcq_url))

  const chapters = await Promise.all(
    course.chapters.map(async (ch) => {
      const lessons = await Promise.all(
        ch.lessons.map(async (l) => {
          const linkedArticles = await Promise.all(
            l.articles.map(async (a) => {
              const row = articleMap.get(a.id)
              const rawContent = row?.content ?? ""
              const pubWarnings = getPublicationWarnings(rawContent, filterForPublication(rawContent))
              const body = htmlToBlocks(rawContent, true)
              let quizQuestions: any[] = []
              const setSlug = practiceSlug(row?.mcq_url)
              const questions = slugToQuestions.get(setSlug)
              if (questions) quizQuestions = questions
              else if (setSlug) stats.mcqNotFound.push(setSlug)
              return {
                _id:          a.id,
                title:        a.title,
                slug:         a.slug,
                excerpt:      a.excerpt ?? "",
                mcqUrl:       row?.mcq_url ?? "",
                body,
                quizQuestions,
                publicationWarnings: pubWarnings,
              }
            })
          )
          return { _id: l.id, title: l.title, slug: l.slug, linkedArticles }
        })
      )
      return {
        _key:         ch.id,
        chapterTitle: ch.title,
        chapterOrder: ch.chapterOrder,
        lessons,
      }
    })
  )

  return {
    _id:          course.id,
    title:        course.title,
    slug:         course.slug,
    description:  course.description ?? "",
    level:        course.level ?? "",
    categoryTitle: "",
    chapters,
  }
}
