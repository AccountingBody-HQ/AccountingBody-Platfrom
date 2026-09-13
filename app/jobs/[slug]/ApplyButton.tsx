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

// Label states the outcome, not the action — mirrors the branch below it
// is used in exactly, so a label change here can never drift out of sync
// with which branch actually renders.
function getApplyLabel(job: Job): string {
  if (job.apply_method === 'external' && job.application_url) {
    const companyName = job.company_name?.trim()
    return companyName ? `Apply on ${companyName}` : "Apply on the employer's site"
  }
  if (job.apply_method === 'email' && job.application_email) {
    return 'Email your application'
  }
  return 'Apply on Accounting Body'
}

const sizeClasses = {
  default: 'py-4 px-5',
  // Slightly tighter vertical padding for the sticky mobile bar, which
  // already has its own container padding — same colours/type/behaviour.
  compact: 'py-3 px-5',
} as const

export function ApplyButton({ job, size = 'default' }: { job: Job; size?: keyof typeof sizeClasses }) {
  const label = getApplyLabel(job)
  const buttonClass = `flex w-full items-center justify-center rounded-xl ${sizeClasses[size]} text-base font-semibold transition-colors bg-[#C9982A] text-[#231A02] hover:bg-[#A87C16] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0C1A3D]`

  // Tracks every source (employer, adzuna, or any other ingestion
  // provider) — not employer-only. An employer-only restriction would mean
  // the great majority of today's traffic (adzuna-sourced) never gets
  // counted, which is exactly the gap this exists to close.
  if (job.apply_method === 'external' && job.application_url) {
    return (
      <a href={job.application_url} target="_blank" rel="noopener noreferrer"
        onClick={() => trackApplyClick(job.id)}
        className={buttonClass}>
        <span className="min-w-0 truncate">{label}</span>
      </a>
    )
  }
  if (job.apply_method === 'email' && job.application_email) {
    return (
      <a href={`mailto:${job.application_email}?subject=${encodeURIComponent('Application: ' + job.title)}`}
        onClick={() => trackApplyClick(job.id)}
        className={buttonClass}>
        <span className="min-w-0 truncate">{label}</span>
      </a>
    )
  }
  return (
    <Link href={`/jobs/apply/${job.id}`} target="_blank" rel="noopener noreferrer"
      onClick={() => trackApplyClick(job.id)}
      className={buttonClass}>
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  )
}
