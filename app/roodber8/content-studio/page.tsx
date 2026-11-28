import ContentStudio from '@/components/content-studio/ContentStudio'
import { requireAdmin } from '@/lib/admin-auth'

// The Content Studio (D373 E2): plan, make and check practice question sets.
// All logic lives in components/content-studio and lib/content-studio.
export default async function ContentStudioPage() {
  await requireAdmin()
  return (
    <ContentStudio
      apiBase="/api/roodber8/content-studio"
      publishUrl="/api/roodber8/questions/publish"
    />
  )
}
