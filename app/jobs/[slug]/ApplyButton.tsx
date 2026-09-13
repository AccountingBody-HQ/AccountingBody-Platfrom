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

// Standard box-with-outbound-arrow glyph. Only rendered on the 'external'
// branch — the branch that actually opens a new tab to a site other than
// this one. aria-hidden because the new-tab signal it carries visually is
// also spelled out in text for screen readers (see the sr-only span below),
// so the icon itself has nothing to announce.
function ExternalLinkIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

export function ApplyButton({ job, size = 'default' }: { job: Job; size?: keyof typeof sizeClasses }) {
  const label = getApplyLabel(job)
  const buttonClass = `flex w-full items-center justify-center gap-2 rounded-xl ${sizeClasses[size]} text-base font-semibold transition-colors bg-[#C9982A] text-[#231A02] hover:bg-[#A87C16] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0C1A3D]`

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
        <ExternalLinkIcon />
        {/* Visually hidden, not aria-hidden — this is what carries the
            new-tab signal to screen readers now that the visible caption
            below the button (which used to say this) is gone. The icon
            above stays aria-hidden so the two don't double-announce. */}
        <span className="sr-only"> (opens in a new tab)</span>
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
