'use client'

import Link from 'next/link'
import type { Job } from '@/lib/jobs'

// The only client-rendered piece of this page — everything else (the job
// fetch, lifecycle state, description, similar jobs) stays a Server
// Component. This exists solely because attaching an onClick requires a
// Client Component boundary; a plain Server Component element can't own a
// browser event handler at all (Next.js rejects it at build time).
//
// Every branch below is a real <a>/<Link> with a real href, never a plain
// button driving window.open() — so the click-tracking POST below is
// strictly additive: it never gates or replaces the navigation. Firing it
// unawaited, with no preventDefault anywhere, means the browser's default
// navigation for the anchor proceeds immediately regardless of what this
// handler does — if the fetch is slow, times out, or rejects, the user
// still reaches the employer's page exactly as fast as if this handler
// didn't exist. If JS is disabled entirely, onClick never runs at all, but
// the href still works — a native anchor doesn't need JS to navigate.
// And because every branch here opens a new tab (external, platform) or
// hands off to the OS mail client (mailto) rather than navigating the
// current tab away, this tab is never torn down mid-request — the
// fire-and-forget fetch is never at risk of being aborted by unload.
function trackApplyClick(jobId: string) {
  fetch(`/api/jobs/click/${jobId}`, { method: 'POST' }).catch(() => {})
}

// The three apply_method branches below and this copy must stay in lock
// step — exported so page.tsx can render the matching helper line beneath
// the button without re-deriving which branch fired from job.apply_method
// itself (the same "one implementation, not two" reasoning as
// getJobCanonicalUrl/getCompanyInitials elsewhere in this codebase).
export function getApplyCopy(job: Job, brandName: string): { label: string; helper: string } {
  if (job.apply_method === 'external' && job.application_url) {
    return {
      label: `Apply on ${job.company_name}`,
      helper: "Opens the employer's own listing in a new tab",
    }
  }
  if (job.apply_method === 'email' && job.application_email) {
    return {
      label: 'Email your application',
      helper: 'Opens your email app to send your application',
    }
  }
  return {
    label: `Apply on ${brandName}`,
    helper: 'Opens our application form in a new tab',
  }
}

export function ApplyButton({ job, brandColor, brandName }: { job: Job; brandColor: string; brandName: string }) {
  const { label } = getApplyCopy(job, brandName)
  const buttonClass = 'inline-flex w-full items-center justify-center h-14 rounded-xl text-sm font-bold transition-all active:scale-95'

  // Tracks every source (employer, adzuna, or any other ingestion
  // provider) — not employer-only. An employer-only restriction would mean
  // the great majority of today's traffic (adzuna-sourced) never gets
  // counted, which is exactly the gap this exists to close.
  if (job.apply_method === 'external' && job.application_url) {
    return (
      <a href={job.application_url} target="_blank" rel="noopener noreferrer"
        onClick={() => trackApplyClick(job.id)}
        className={buttonClass} style={{ background: '#D4A017', color: brandColor }}>
        {label}
      </a>
    )
  }
  if (job.apply_method === 'email' && job.application_email) {
    return (
      <a href={`mailto:${job.application_email}?subject=${encodeURIComponent('Application: ' + job.title)}`}
        onClick={() => trackApplyClick(job.id)}
        className={buttonClass} style={{ background: '#D4A017', color: brandColor }}>
        {label}
      </a>
    )
  }
  return (
    <Link href={`/jobs/apply/${job.id}`} target="_blank" rel="noopener noreferrer"
      onClick={() => trackApplyClick(job.id)}
      className={buttonClass} style={{ background: '#D4A017', color: brandColor }}>
      {label}
    </Link>
  )
}
