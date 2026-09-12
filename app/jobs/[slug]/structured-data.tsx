import type { Job, EmploymentType } from '@/lib/jobs'

// schema.org/JobPosting field mapping, kept to Google's documented
// required + recommended properties
// (developers.google.com/search/docs/appearance/structured-data/job-posting).
// Fields we have no reliable source for are omitted, never guessed:
//  - baseSalary: Google requires a unitText of HOUR/DAY/WEEK/MONTH/YEAR: the
//    `jobs` table has salary_min/max/currency but no pay-period column at
//    all, so there is no honest value to put there.
//  - directApply: `apply_method: 'platform'` today routes to the explicitly
//    stub /jobs/apply/[id] flow, so asserting a direct-apply flag would be
//    false for that case; omitted for all apply methods rather than guessing
//    which ones "count".
//  - applicantLocationRequirements: no country-list data exists for where a
//    remote applicant may be based.

// Our `employment_type` enum has no independent full-time/part-time axis for
// permanent roles (a "permanent" listing could in principle be part-time) —
// FULL_TIME is the closest approximation for `permanent`, not a fact the
// schema actually captures.
const EMPLOYMENT_TYPE_SCHEMA_MAP: Record<EmploymentType, string> = {
  permanent:  'FULL_TIME',
  contract:   'CONTRACTOR',
  temporary:  'TEMPORARY',
  part_time:  'PART_TIME',
  internship: 'INTERN',
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Google requires description to be "HTML formatted" — wrap each paragraph
// (the same '\n'-split convention used to render the visible description)
// in <p> tags, escaping real content so it can't be mistaken for markup.
function descriptionToHtml(description: string): string {
  return description
    .split('\n')
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${escapeHtml(p)}</p>`)
    .join('')
}

function buildJobPostingSchema(job: Job, brandName: string): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: descriptionToHtml(job.description),
    datePosted: new Date(job.published_at ?? job.created_at).toISOString(),
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company_name,
    },
    identifier: {
      '@type': 'PropertyValue',
      name: brandName,
      value: job.id,
    },
  }

  if (job.location_country) {
    schema.jobLocation = {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        ...(job.location_city ? { addressLocality: job.location_city } : {}),
        addressCountry: job.location_country,
      },
    }
  }

  // Kept alongside jobLocation (not instead of it) — we don't have real
  // applicantLocationRequirements data to justify Google's fully-remote
  // exception that would let jobLocation be omitted entirely.
  if (job.location_remote) {
    schema.jobLocationType = 'TELECOMMUTE'
  }

  if (job.employment_type) {
    schema.employmentType = EMPLOYMENT_TYPE_SCHEMA_MAP[job.employment_type]
  }

  // A past validThrough is Google's own documented way to represent an
  // expired posting (rather than removing the markup) — correct for both
  // the 'stale' and 'archived' lifecycle states, where expires_at is
  // already in the past.
  if (job.expires_at) {
    schema.validThrough = new Date(job.expires_at).toISOString()
  }

  return schema
}

export function JobPostingStructuredData({ job, brandName }: { job: Job; brandName: string }) {
  const schema = buildJobPostingSchema(job, brandName)
  // Escaping '<' prevents a literal `</script>` inside employer-submitted
  // description text from closing this tag early — JSON.parse/consumers see
  // the identical string either way, so this doesn't change the data.
  const json = JSON.stringify(schema).replace(/</g, '\\u003c')

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}
