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

export function formatSalary(job: Pick<Job, 'salary_text' | 'salary_min' | 'salary_max' | 'salary_currency'>): string | null {
  if (job.salary_text) return job.salary_text
  if (job.salary_min == null && job.salary_max == null) return null
  const currency = job.salary_currency || ''
  const fmt = (n: number) => `${currency} ${Math.round(n).toLocaleString('en-US')}`.trim()
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
