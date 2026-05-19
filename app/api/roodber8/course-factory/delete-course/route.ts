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

    // Find all lesson documents for this course
    const lessons = await client.fetch(
      `*[_id in path($pattern)]{ _id }`,
      { pattern: `lesson-${slug}-*` }
    )
    const lessonIds: string[] = lessons.map((l: { _id: string }) => l._id)
    const draftLessonIds = lessonIds.map((id: string) => `drafts.${id}`)
    const allLessonIds = [...lessonIds, ...draftLessonIds]

    // Step 1 — unset parentCourse on all lessons so course has no inbound refs
    if (allLessonIds.length > 0) {
      let patchTx = client.transaction()
      for (const id of allLessonIds) {
        patchTx = patchTx.patch(id, p => p.unset(['parentCourse']))
      }
      await patchTx.commit({ visibility: 'sync' })
    }

    // Step 2 — now delete all lesson documents (no refs remaining)
    if (allLessonIds.length > 0) {
      let lessonTx = client.transaction()
      for (const id of allLessonIds) {
        lessonTx = lessonTx.delete(id)
      }
      await lessonTx.commit({ visibility: 'sync' })
    }

    // Step 3 — delete course document and its draft
    let courseTx = client.transaction()
    courseTx = courseTx.delete(courseId)
    courseTx = courseTx.delete(`drafts.${courseId}`)
    await courseTx.commit({ visibility: 'sync' })

    return NextResponse.json({
      success: true,
      deleted: { lessons: lessonIds.length, courseId },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Delete failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
