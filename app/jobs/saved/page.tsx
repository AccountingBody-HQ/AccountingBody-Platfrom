import { SAVED_JOBS_RETENTION_DAYS } from '@/lib/saved-jobs'
import SavedJobsClient from './SavedJobsClient'

export const metadata = {
  title: 'Saved jobs',
  // Private, per-device list with nothing here for a crawler to rank —
  // same reasoning as the other self-service job routes (e.g.
  // app/jobs/manage-listing). Those routes don't set their own canonical
  // either (confirmed live: manage-listing emits no <link rel="canonical">
  // at all), so none is added here — matching, not inventing, that
  // pattern. `follow: true` because the saved-job rows link out to
  // /jobs/[slug] detail pages that ARE indexable, same as manage-listing.
  robots: { index: false, follow: true },
}

export const dynamic = 'force-dynamic'

export default function SavedJobsPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container-wide pt-8 pb-16 max-w-2xl">
        <h1 className="font-display text-2xl md:text-3xl font-medium text-navy-950 mb-1">Saved jobs</h1>
        <p className="text-sm text-slate-500 mb-6">
          Saved on this device. Your list is cleared after {SAVED_JOBS_RETENTION_DAYS} days without a visit.
        </p>
        <SavedJobsClient />
      </div>
    </main>
  )
}
