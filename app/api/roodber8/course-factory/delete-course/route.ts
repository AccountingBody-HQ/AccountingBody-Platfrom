// app/api/roodber8/course-factory/delete-course/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@sanity/client'

const client = createClient({
  projectId:  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '4rllejq1',
  dataset:    process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
  apiVersion: '2024-01-01',
  token:      process.env.SANITY_API_TOKEN,
  useCdn:     false,
})

export async function DELETE(req: NextRequest) {
  try {
    const { slug } = await req.json()
    if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

    const courseId = `course-${slug}`
    const lessonIdPattern = `lesson-${slug}-*`

    const lessons = await client.fetch(
      `*[_id in path($pattern)]{ _id }`,
      { pattern: lessonIdPattern }
    )

    const lessonIds: string[] = lessons.map((l: { _id: string }) => l._id)
    const draftLessonIds = lessonIds.map((id: string) => `drafts.${id}`)
    const allLessonIds = [...lessonIds, ...draftLessonIds]

    let tx = client.transaction()
    for (const id of allLessonIds) {
      tx = tx.delete(id)
    }
    tx = tx.delete(courseId)
    tx = tx.delete(`drafts.${courseId}`)

    await tx.commit({ visibility: 'async' })

    return NextResponse.json({
      success: true,
      deleted: { lessons: lessonIds.length, courseId },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Delete failed' }, { status: 500 })
  }
}
