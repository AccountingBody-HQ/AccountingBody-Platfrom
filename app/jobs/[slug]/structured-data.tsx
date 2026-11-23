import type { Job, EmploymentType } from '@/lib/jobs'
import { realCountry } from '@/lib/job-country'
import { decodeHtmlEntities } from '@/lib/html-entities'

// schema.org/JobPosting field mapping, kept to Google's documented
// required + recommended properties
// (developers.google.com/search/docs/appearance/structured-data/job-posting).
// The page renders this for OPEN jobs only (lib/jobs.ts
// getJobLifecycleState); a closed job's page carries no JobPosting at all.
// Fields we have no reliable source for are omitted, never guessed:
//  - baseSalary: Google requires a unitText of HOUR/DAY/WEEK/MONTH/YEAR: the
//    `jobs` table has salary_min/max/currency but no pay-period column at
//    all, so there is no honest value to put there.
//  - directApply: `apply_method: 'platform'` today routes to the explicitly
//    stub /jobs/apply/[id] flow, so asserting a direct-apply flag would be
//    false for that case; omitted for all apply methods rather than guessing
//    which ones "count".
//  - jobLocation / addressCountry: only when location_country is one real
//    country (lib/job-country.ts realCountry), given as its ISO 3166-1
//    alpha-2 code. "Worldwide", an empty value or several countries give no
//    jobLocation at all.
//  - applicantLocationRequirements: only for a remote job with one real
//    country, naming that country. A remote job without one gets
//    jobLocationType TELECOMMUTE alone.

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

export function buildJobPostingSchema(job: Job, brandName: string): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: decodeHtmlEntities(job.title),
    // `description` is NOT NULL in the schema, so the excerpt fallback is
    // currently unreachable — kept defensively rather than assuming that
    // constraint never changes.
    description: descriptionToHtml(job.description || job.excerpt || ''),
    datePosted: new Date(job.published_at ?? job.created_at).toISOString(),
    hiringOrganization: {
      '@type': 'Organization',
      name: decodeHtmlEntities(job.company_name),
    },
    identifier: {
      '@type': 'PropertyValue',
      name: brandName,
      value: job.id,
    },
  }

  const country = realCountry(job.location_country)

  if (country) {
    schema.jobLocation = {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        ...(job.location_city ? { addressLocality: job.location_city } : {}),
        addressCountry: country.code,
      },
    }
  }

  // A remote job keeps its jobLocation (when it has a real country) and,
  // with that country, says where applicants may be based.
  if (job.location_remote) {
    schema.jobLocationType = 'TELECOMMUTE'
    if (country) {
      schema.applicantLocationRequirements = { '@type': 'Country', name: country.name }
    }
  }

  if (job.employment_type) {
    schema.employmentType = EMPLOYMENT_TYPE_SCHEMA_MAP[job.employment_type]
  }

  // Open jobs only reach this builder, so validThrough is the job's future
  // end date (or absent when it has none).
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
