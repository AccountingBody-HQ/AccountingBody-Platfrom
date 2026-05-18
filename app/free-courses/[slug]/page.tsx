// app/free-courses/[slug]/page.tsx
// Redirects to the canonical course landing page at /courses/[slug]
// All course content is served from /courses/[slug] via next.config.mjs redirects

import { redirect } from 'next/navigation'
import { getCourseBySlug } from '@/lib/coursesNew'

export default async function FreeCoursesSlugPage({
  params,
}: {
  params: { slug: string }
}) {
  const course = await getCourseBySlug(params.slug)
  if (!course) {
    redirect('/free-courses')
  }
  // Redirect to the course landing page
  redirect(`/courses/${params.slug}`)
}
