// app/api/roodber8/ab-press/preview/route.ts
// Accounting Body Press — Preview API
// Returns course structure and stats from Supabase
// Replaces Sanity GROQ fetch — Session 35
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCourseBySlug } from '@/lib/coursesNew'
import { filterForPublication, getPublicationWarnings } from '@/lib/publication-filter'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

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
  const expectedHash = await sha256Hex(secret)
  return token === expectedHash
}

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(req.url)
    const slug = searchParams.get('slug')
    if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 })

    // adminMode=true so draft courses can be previewed in AB Press
    const course = await getCourseBySlug(slug, true)
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    // Compute stats
    let totalArticles = 0
    let totalQuestions = 0
    for (const ch of course.chapters) {
      for (const ls of ch.lessons) {
        totalArticles += ls.articles.length
      }
    }

    // Count published, AccountingBody-owned question sets linked to this course's articles
    const articleSlugs = Array.from(new Set(
      course.chapters.flatMap(ch => ch.lessons.flatMap(ls => ls.articles.map(a => a.slug).filter(Boolean)))
    ))

    if (articleSlugs.length > 0) {
      try {
        // Step 1: get matching set IDs
        const { data: matchingSets } = await supabase
          .from('question_sets')
          .select('id')
          .in('article_slug', articleSlugs)
          .eq('status', 'published')
          .eq('platform', 'ab')

        if (matchingSets && matchingSets.length > 0) {
          const setIds = matchingSets.map(s => s.id)
          const { count: qCount } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .in('set_id', setIds)
          totalQuestions = qCount ?? 0
        }
      } catch (err) {
        console.error('ab-press/preview: question_sets count query threw:', err)
      }
    }

    // ── Content health check (Phase 3) ──────────────────────────────────────
    // Second, separate Supabase query — same bulk SELECT shape as
    // generate/route.ts buildCourse(), fetched independently of the
    // question_sets count query above.
    const allArticles = course.chapters.flatMap(ch => ch.lessons.flatMap(ls => ls.articles))
    const allArticleIds = allArticles.map(a => a.id)
    const articleTitleMap = new Map(allArticles.map(a => [a.id, a.title]))

    let emptyArticlesCount = 0
    let articlesWithWebElements = 0
    let totalWebElementsRemoved = 0
    let mcqLinked = 0
    const emptyList: string[] = []
    const webWarningDetails: { title: string; warnings: string[] }[] = []

    if (allArticleIds.length > 0) {
      try {
        const { data: contentRows, error: contentError } = await supabase
          .from('articles')
          .select('id, content, mcq_url')
          .in('id', allArticleIds)

        if (contentError) {
          console.error('ab-press/preview: article content query failed:', contentError)
        } else {
          for (const row of (contentRows ?? [])) {
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
        }
      } catch (err) {
        console.error('ab-press/preview: article content query threw:', err)
      }
    }

    const verdict: 'ready' | 'warnings' | 'issues' =
      emptyArticlesCount > 0 ? 'issues' :
      articlesWithWebElements > 0 ? 'warnings' :
      'ready'

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
        emptyArticles: emptyArticlesCount,
        articlesWithWebElements,
      },
      health: {
        verdict,
        emptyArticles: emptyArticlesCount,
        articlesWithWebElements,
        totalWebElementsRemoved,
        mcqLinked,
        emptyList,
        webWarningDetails,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
