/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/ab-press-builder.ts
// Accounting Body Press — shared course builder
// Extracted from app/api/roodber8/ab-press/generate/route.ts (Phase 4A) so
// generate/route.ts and export-word/route.ts no longer each define their own
// copy of buildCourse()/fetchQuestions(). This is the more complete version
// (carries publicationWarnings per article, used by the generate route's
// buildFidelity() report); export-word/route.ts simply never reads that
// field.
import { createClient } from "@supabase/supabase-js"
import { getCourseBySlug } from "@/lib/coursesNew"
import { htmlToBlocks } from "@/lib/html-to-blocks"
import { filterForPublication, getPublicationWarnings } from "@/lib/publication-filter"

export interface BuildStats {
  mcqFailed: string[]
  mcqNotFound: string[]
}

/** Service-role Supabase client used by the AB Press build pipeline. */
export function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

const supabase = createSupabaseClient()

// ── Fetch questions for an article via mcq_url ───────────────────────────────
export async function fetchQuestions(mcqUrl: string, stats: BuildStats): Promise<any[]> {
  try {
    const parts = mcqUrl.split("/")
    const practiceSlug = parts[parts.length - 1]
    if (!practiceSlug) return []

    const { data: qSet } = await supabase
      .from("question_sets")
      .select("id")
      .eq("slug", practiceSlug)
      .maybeSingle()

    if (!qSet) { stats.mcqNotFound.push(practiceSlug); return [] }

    const { data: questions } = await supabase
      .from("questions")
      .select("question_text, option_a, option_b, option_c, option_d, correct_index, explanation")
      .eq("set_id", qSet.id)
      .order("question_order", { ascending: true })

    return (questions ?? []).map((q) => ({
      questionText:  q.question_text,
      options:       [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean),
      correctIndex:  q.correct_index,
      explanation:   q.explanation ?? "",
    }))
  } catch {
    const parts = mcqUrl.split("/")
    stats.mcqFailed.push(parts[parts.length - 1] ?? mcqUrl)
    return []
  }
}

// ── Build course in BookTemplate shape ───────────────────────────────────────
export async function buildCourse(slug: string, stats: BuildStats) {
  const course = await getCourseBySlug(slug, true)
  if (!course) throw new Error("Course not found")

  // Fetch full article content (including HTML body and mcq_url)
  const allArticleIds = course.chapters
    .flatMap((ch) => ch.lessons.flatMap((l) => l.articles.map((a) => a.id)))

  const { data: articleRows } = await supabase
    .from("articles")
    .select("id, content, mcq_url")
    .in("id", allArticleIds)

  const articleMap = new Map((articleRows ?? []).map((a) => [a.id, a]))

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
              if (row?.mcq_url) {
                quizQuestions = await fetchQuestions(row.mcq_url, stats)
              }
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
