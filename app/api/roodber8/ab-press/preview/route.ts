// app/api/roodber8/ab-press/preview/route.ts
// Accounting Body Press — Preview API
// Returns course structure and stats from Supabase
// Replaces Sanity GROQ fetch — Session 35
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated, signedOutResponse } from '@/lib/admin-auth'
import { reportServerError } from '@/lib/report-error'
import { getCourseBySlug } from '@/lib/coursesNew'
import { filterForPublication, getPublicationWarnings } from '@/lib/publication-filter'
import { countQuestions, createSupabaseClient, practiceSlug, readBookArticles, readLiveSets } from '@/lib/ab-press-builder'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return signedOutResponse()
  }
  try {
    const supabase = createSupabaseClient()
    const { searchParams } = new URL(req.url)
    const slug = searchParams.get('slug')
    if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 })

    // adminMode=true so draft courses can be previewed in AB Press
    const course = await getCourseBySlug(slug, true)
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    // Compute stats
    let totalArticles = 0
    let totalQuestions = 0
    let questionCountError = false
    for (const ch of course.chapters) {
      for (const ls of ch.lessons) {
        totalArticles += ls.articles.length
      }
    }

    // Count the questions the book would print, by the book's own rule: each
    // article's practice link (mcq_url) names a set; the set must be live; any
    // site (the book has no site filter). A set linked twice is printed twice.
    const printedIds = course.chapters.flatMap(ch => ch.lessons.flatMap(ls => ls.articles.map(a => a.id)))

    if (printedIds.length > 0) {
      try {
        // Step 1: the articles' practice links
        const linkRows = await readBookArticles(printedIds, 'id, mcq_url')
        const slugByArticle = new Map<string, string>(linkRows.map(r => [r.id, practiceSlug(r.mcq_url)]))

        // Step 2: the live sets with those slugs
        const slugToSetId = await readLiveSets(linkRows.map(r => r.mcq_url))
        const timesPrinted = new Map<string, number>()
        for (const id of printedIds) {
          const setId = slugToSetId.get(slugByArticle.get(id) ?? '')
          if (setId) timesPrinted.set(setId, (timesPrinted.get(setId) ?? 0) + 1)
        }

        // Step 3: one count for all sets printed once, one for twice, and so on
        let counted = 0
        for (const times of Array.from(new Set(Array.from(timesPrinted.values())))) {
          const setIds = Array.from(timesPrinted.keys()).filter(id => timesPrinted.get(id) === times)
          counted += (await countQuestions(setIds)) * times
        }
        totalQuestions = counted
      } catch (err) {
        // The count is unknown, not zero.
        console.error('ab-press/preview: question count read failed:', err)
        reportServerError('admin book preview count failed', err, { area: 'admin' })
        questionCountError = true
      }
    }

    // ── Content health check (Phase 3) ──────────────────────────────────────
    // A second, separate read of the articles, with their content.
    const allArticles = course.chapters.flatMap(ch => ch.lessons.flatMap(ls => ls.articles))
    const allArticleIds = allArticles.map(a => a.id)
    const articleTitleMap = new Map(allArticles.map(a => [a.id, a.title]))

    let healthUnavailable = false
    let emptyArticlesCount = 0
    let articlesWithWebElements = 0
    let totalWebElementsRemoved = 0
    let mcqLinked = 0
    const emptyList: string[] = []
    const webWarningDetails: { title: string; warnings: string[] }[] = []

    if (allArticleIds.length > 0) {
      try {
        for (const row of await readBookArticles(allArticleIds, 'id, content, mcq_url')) {
          const rawContent = row.content ?? ''
          const title = articleTitleMap.get(row.id) ?? row.id

          const strippedLength = rawContent.replace(/<[^>]+>/g, '').trim().length
          if (strippedLength === 0) {
            emptyArticlesCount++
            emptyList.push(title)
          }

          const filtered = filterForPublication(rawContent)
          const warnings = getPublicationWarnings(rawContent, filtered)
          const removalWarnings = warnings.filter((w) => !w.startsWith('Total:'))

          if (removalWarnings.length > 0) {
            articlesWithWebElements++
            totalWebElementsRemoved += removalWarnings.length
            if (webWarningDetails.length < 10) {
              webWarningDetails.push({ title, warnings: removalWarnings })
            }
          }

          if (row.mcq_url) mcqLinked++
        }
      } catch (err) {
        // The content is unknown, not ready.
        console.error('ab-press/preview: article content read failed:', err)
        reportServerError('admin book preview content failed', err, { area: 'admin' })
        healthUnavailable = true
      }
    }

    const verdict: 'ready' | 'warnings' | 'issues' =
      healthUnavailable || emptyArticlesCount > 0 ? 'issues' :
      articlesWithWebElements > 0 ? 'warnings' :
      'ready'

    // ── Publication history (Phase 5) ───────────────────────────────────────
    // Best-effort: a missing/broken book_publications table must never fail
    // the preview request — the screen says that the history is unknown.
    let history: any[] = []
    let historyError = false
    try {
      const { data: historyRows, error: historyFailed } = await supabase
        .from('book_publications')
        .select('id, book_type, edition, subtitle, page_count, article_count, question_count, kdp_ready, preflight_verdict, content_hash, articles_with_web_elements, empty_articles, generated_at')
        .eq('course_slug', slug)
        .eq('platform', 'ab')
        .order('generated_at', { ascending: false })
        .limit(5)
      if (historyFailed || !historyRows) throw historyFailed ?? new Error('no history list')

      history = historyRows.map(r => ({
        id: r.id,
        bookType: r.book_type,
        edition: r.edition,
        subtitle: r.subtitle,
        pageCount: r.page_count,
        articleCount: r.article_count,
        questionCount: r.question_count,
        kdpReady: r.kdp_ready,
        preflightVerdict: r.preflight_verdict,
        contentHash: r.content_hash,
        articlesWithWebElements: r.articles_with_web_elements,
        emptyArticles: r.empty_articles,
        generatedAt: r.generated_at,
      }))
    } catch (err) {
      console.error('ab-press/preview: book_publications history read failed:', err)
      reportServerError('admin book preview history failed', err, { area: 'admin' })
      historyError = true
    }

    // Return in shape the AB Press UI expects
    return NextResponse.json({
      course: {
        title:         course.title,
        slug:          course.slug,
        description:   course.description ?? '',
        level:         course.level ?? '',
        categoryTitle: '',
        chapters:      course.chapters.map(ch => ({
          _key:         ch.id,
          chapterTitle: ch.title,
          chapterOrder: ch.chapterOrder,
          lessons:      ch.lessons.map(l => ({
            _id:            l.id,
            title:          l.title,
            slug:           l.slug,
            linkedArticles: l.articles.map(a => ({
              _id:     a.id,
              title:   a.title,
              slug:    a.slug,
              excerpt: a.excerpt ?? '',
            })),
          })),
        })),
      },
      stats: {
        chapterCount:  course.chapters.length,
        lessonCount:   course.chapters.reduce((a, c) => a + c.lessons.length, 0),
        articleCount:  totalArticles,
        questionCount: totalQuestions,
        questionCountError,
        emptyArticles: emptyArticlesCount,
        articlesWithWebElements,
      },
      health: {
        unavailable: healthUnavailable,
        verdict,
        emptyArticles: emptyArticlesCount,
        articlesWithWebElements,
        totalWebElementsRemoved,
        mcqLinked,
        emptyList,
        webWarningDetails,
      },
      history,
      historyError,
    })
  } catch (err: unknown) {
    console.error('ab-press/preview: failed:', err)
    reportServerError('admin book preview failed', err, { area: 'admin' })
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
