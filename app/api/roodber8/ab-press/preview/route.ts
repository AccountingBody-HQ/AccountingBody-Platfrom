// app/api/roodber8/ab-press/preview/route.ts
// Accounting Body Press — Preview API
// Fetches full course content including article bodies and practice questions
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '4rllejq1'
const DATASET    = process.env.NEXT_PUBLIC_SANITY_DATASET    ?? 'production'
const BASE_URL   = `https://${PROJECT_ID}.api.sanity.io/v2023-05-03/data/query/${DATASET}`

async function sanityFetch(query: string) {
  const res = await fetch(`${BASE_URL}?query=${encodeURIComponent(query)}`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Sanity fetch failed: ${res.status}`)
  const data = await res.json()
  return data.result
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const slug = searchParams.get('slug')
    if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 })

    // Step 1: Fetch course with chapters, lessons, and articles including body + mcqUrl
    const course = await sanityFetch(`
      *[_type == "course" && slug.current == "${slug}" && (status == "published" || !defined(status))][0] {
        _id, title, slug, description, level,
        "categoryTitle": category->title,
        "chapters": chapters[] {
          _key, chapterTitle, chapterOrder,
          "lessons": lessons[defined(@->._id) && !(@->_id in path("drafts.**"))]-> {
            _id, title, slug, order,
            "linkedArticles": linkedArticles[defined(@->._id) && !(@->_id in path("drafts.**"))]-> {
              _id, title, slug, excerpt, mcqUrl, body
            }
          }
        }
      }
    `)

    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    // Step 2: For each article with mcqUrl, fetch practice post questions
    const chapters = await Promise.all(
      (course.chapters ?? []).map(async (chapter: any) => {
        const lessons = await Promise.all(
          (chapter.lessons ?? []).map(async (lesson: any) => {
            const linkedArticles = await Promise.all(
              (lesson.linkedArticles ?? []).map(async (article: any) => {
                let quizQuestions: any[] = []
                if (article.mcqUrl) {
                  const parts = article.mcqUrl.split('/')
                  const practiceSlug = parts[parts.length - 1]
                  try {
                    const practicePost = await sanityFetch(`
                      *[_type == "practicePost" && slug.current == "${practiceSlug}" && "accountingbody" in showOnSites][0] {
                        _id, title,
                        "quizQuestions": quizQuestions[] {
                          questionText, options, correctIndex, explanation, difficulty, timeTargetMinutes
                        }
                      }
                    `)
                    quizQuestions = practicePost?.quizQuestions ?? []
                  } catch {
                    quizQuestions = []
                  }
                }
                return { ...article, quizQuestions }
              })
            )
            return { ...lesson, linkedArticles }
          })
        )
        return { ...chapter, lessons }
      })
    )

    // Step 3: Compute stats
    let totalArticles = 0
    let totalQuestions = 0
    for (const ch of chapters) {
      for (const ls of ch.lessons ?? []) {
        for (const art of ls.linkedArticles ?? []) {
          totalArticles++
          totalQuestions += art.quizQuestions?.length ?? 0
        }
      }
    }

    return NextResponse.json({
      course: { ...course, chapters },
      stats: {
        chapterCount: chapters.length,
        lessonCount: chapters.reduce((a: number, c: any) => a + (c.lessons?.length ?? 0), 0),
        articleCount: totalArticles,
        questionCount: totalQuestions,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
