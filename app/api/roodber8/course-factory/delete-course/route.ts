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

    // Query ALL documents (including drafts) that reference this course
    // via parentCourse — this is the field causing the integrity block
    const referencingDocs = await client.fetch(
      `*[parentCourse._ref == $courseId]{ _id }`,
      { courseId }
    )
    const referencingIds: string[] = referencingDocs.map((d: { _id: string }) => d._id)

    // Also get by slug pattern as fallback
    const patternDocs = await client.fetch(
      `*[_id in path($pattern)]{ _id }`,
      { pattern: `lesson-${slug}-*` }
    )
    const patternIds: string[] = patternDocs.map((d: { _id: string }) => d._id)

    // Merge and deduplicate all lesson IDs
    const allIds = Array.from(new Set([...referencingIds, ...patternIds]))

    console.log('Deleting lesson IDs:', allIds)

    // Step 1 — delete all referencing lesson documents
    if (allIds.length > 0) {
      let tx = client.transaction()
      for (const id of allIds) {
        tx = tx.delete(id)
      }
      await tx.commit({ visibility: 'sync' })
    }

    // Step 2 — now no documents reference the course, safe to delete
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
