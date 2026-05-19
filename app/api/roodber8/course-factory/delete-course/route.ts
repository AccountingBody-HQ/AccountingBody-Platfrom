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

    // Find all lesson documents for this course (by type + parentCourse ref)
    const referencingDocs = await client.fetch(
      `*[_type == "lesson" && parentCourse._ref == $courseId]{ _id }`,
      { courseId }
    )
    const patternDocs = await client.fetch(
      `*[_id in path($pattern)]{ _id }`,
      { pattern: `lesson-${slug}-*` }
    )
    const allIds = Array.from(new Set([
      ...referencingDocs.map((d: { _id: string }) => d._id),
      ...patternDocs.map((d: { _id: string }) => d._id),
    ]))

    // Step 1 — clear chapters array on course (removes course→lesson refs)
    await client.transaction()
      .patch(courseId, p => p.set({ chapters: [] }))
      .patch(`drafts.${courseId}`, p => p.set({ chapters: [] }))
      .commit({ visibility: 'sync' })

    // Step 2 — clear parentCourse on all lessons (removes lesson→course refs)
    if (allIds.length > 0) {
      let tx = client.transaction()
      for (const id of allIds) {
        tx = tx.patch(id, p => p.unset(['parentCourse']))
      }
      await tx.commit({ visibility: 'sync' })
    }

    // Step 3 — delete all lesson documents
    if (allIds.length > 0) {
      let tx = client.transaction()
      for (const id of allIds) {
        tx = tx.delete(id)
      }
      await tx.commit({ visibility: 'sync' })
    }

    // Step 4 — delete course and its draft
    await client.transaction()
      .delete(courseId)
      .delete(`drafts.${courseId}`)
      .commit({ visibility: 'sync' })

    return NextResponse.json({
      success: true,
      deleted: { lessons: allIds.length, courseId },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Delete failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
