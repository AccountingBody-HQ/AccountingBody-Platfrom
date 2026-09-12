import type { Job, EmploymentType, SeniorityLevel } from '@/lib/jobs'

// Shared job-display formatting — imported by both the client-rendered
// listings page (JobListingsClient.tsx) and the server-rendered job detail
// page (app/jobs/[slug]/page.tsx) so the two never drift and show a
// different salary/label for the same job.

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  permanent:  'Permanent',
  contract:   'Contract',
  temporary:  'Temporary',
  part_time:  'Part-time',
  internship: 'Internship',
}

export const SENIORITY_LABELS: Record<SeniorityLevel, string> = {
  junior:    'Junior',
  mid:       'Mid-level',
  senior:    'Senior',
  director:  'Director',
  executive: 'Executive',
}

export function employmentTypeLabel(value: EmploymentType | null): string | null {
  if (!value) return null
  return EMPLOYMENT_TYPE_LABELS[value] ?? value.replace('_', ' ')
}

export function seniorityLabel(value: SeniorityLevel | null): string | null {
  if (!value) return null
  return SENIORITY_LABELS[value] ?? value
}

// Only currencies with a single, unambiguous, widely-recognised symbol —
// anything else falls back to its ISO code (e.g. "AUD 87,805") rather than
// guessing a symbol that could be misread (several currencies share "$").
const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
}

function formatCurrencyAmount(currency: string, amount: number): string {
  const code = currency.trim().toUpperCase()
  const symbol = CURRENCY_SYMBOLS[code]
  const rounded = Math.round(amount).toLocaleString('en-US')
  return symbol ? `${symbol}${rounded}` : `${code} ${rounded}`.trim()
}

// Matches ONLY the exact string the ingestion pipeline auto-generates when a
// source supplies numeric salary_min/max/currency but no text of its own
// (lib/ingestion/normalise.ts, "Generate display salary_text from numeric
// values if not already set": `${salaryCurrency} ${salaryMin.toLocaleString()}`,
// optionally `– ${salaryMax.toLocaleString()}`) — e.g. "USD 87,805". That
// string is stored verbatim in salary_text at ingestion time, before this
// formatter's currency-symbol logic exists to apply to it. Genuinely
// free-form salary text (an employer's own wording, or a source's own
// string, e.g. "Competitive, DOE") never matches this narrow machine-shape
// and is still shown exactly as stored.
const MACHINE_GENERATED_SALARY_TEXT = /^[a-z]{3}\s[\d,]+(\s[-–—]\s[\d,]+)?$/i

export function formatSalary(job: Pick<Job, 'salary_text' | 'salary_min' | 'salary_max' | 'salary_currency'>): string | null {
  const hasNumericAmount = job.salary_min != null || job.salary_max != null
  const isMachineGenerated = !!job.salary_text && hasNumericAmount && MACHINE_GENERATED_SALARY_TEXT.test(job.salary_text)

  if (job.salary_text && !isMachineGenerated) return job.salary_text
  if (!hasNumericAmount) return null

  const currency = job.salary_currency || ''
  const fmt = (n: number) => formatCurrencyAmount(currency, n)
  if (job.salary_min != null && job.salary_max != null && job.salary_min !== job.salary_max) {
    return `${fmt(job.salary_min)} – ${fmt(job.salary_max)}`
  }
  return fmt(job.salary_min ?? job.salary_max ?? 0)
}

export function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const ageMs = Date.now() - new Date(dateStr).getTime()
  const ageMins = Math.floor(ageMs / 60000)
  if (ageMins < 60) return ageMins <= 1 ? 'Just now' : `${ageMins}m ago`
  const ageHrs = Math.floor(ageMins / 60)
  if (ageHrs < 24) return `${ageHrs}h ago`
  const ageDays = Math.floor(ageHrs / 24)
  if (ageDays === 1) return 'Yesterday'
  if (ageDays < 7) return `${ageDays} days ago`
  const weeks = Math.floor(ageDays / 7)
  if (ageDays < 30) return `${weeks}w ago`
  const months = Math.floor(ageDays / 30)
  return `${months}mo ago`
}

// Absolute calendar date, for copy that names a specific date rather than a
// relative age (e.g. the stale/archived notice on the job detail page).
export function formatAbsoluteDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// The single source for a job's canonical URL — app/jobs/[slug]/page.tsx
// calls this from both generateMetadata (for <link rel="canonical"> /
// openGraph.url) and the page body (to hand the exact same string to
// ShareButton), rather than each computing its own copy of the
// baseUrl+slug template and risking the two silently drifting apart.
export function getJobCanonicalUrl(job: Pick<Job, 'slug'>, isEthioTax: boolean): string {
  const baseUrl = isEthioTax ? 'https://ethiotax.com' : 'https://accountingbody.com'
  return `${baseUrl}/jobs/${job.slug}`
}

// Rounds a real job count DOWN to a round display figure — never up, so the
// displayed number is never a claim the true count doesn't back up (e.g. an
// actual count of 9,870 reads as "9,000+", not "10,000+").
//
// Returns null (never the literal string "0") when there's no honest
// positive number to show — a zero count (or a failed count, which the
// underlying query functions already normalise to 0) must never be
// displayed as a stat; callers should fall back to non-numeric copy
// instead (e.g. "Live accounting and finance roles").
export function formatJobCountLabel(count: number): string | null {
  if (count <= 0) return null
  const rounded =
    count >= 1000 ? Math.floor(count / 1000) * 1000 :
    count >= 100  ? Math.floor(count / 100) * 100 :
    count >= 10   ? Math.floor(count / 10) * 10 :
    count
  return `${rounded.toLocaleString('en-US')}+`
}
