// app/api/roodber8/ab-press/preview/route.ts
// Accounting Body Press — Preview API
// Returns course structure and stats from Supabase
// Replaces Sanity GROQ fetch — Session 35
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getCourseBySlug } from '@/lib/coursesNew'

export async function GET(req: NextRequest) {
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
        // questions are stored in question_sets linked via article mcq_url
        // count not available at preview stage — show 0 until generate is run
        totalQuestions += 0
      }
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
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
