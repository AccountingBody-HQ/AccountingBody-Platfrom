import type { NormalisedJob } from './normalise'
import { ACCOUNTING_FINANCE_KEYWORDS } from './keywords'

export interface ValidationResult {
  valid: NormalisedJob[]
  rejected: NormalisedJob[]
  rejectionReasons: Map<string, string>
}

// ── Relevance check ────────────────────────────────────────────────────────
function isAccountingFinanceRelevant(job: NormalisedJob): boolean {
  const searchText = `${job.title} ${job.description}`.toLowerCase()
  return ACCOUNTING_FINANCE_KEYWORDS.some(kw => searchText.includes(kw.toLowerCase()))
}

// ── Quality flags ──────────────────────────────────────────────────────────
function computeQualityFlags(job: NormalisedJob): string[] {
  const flags: string[] = []
  if (!job.salary_min && !job.salary_max) flags.push('missing_salary')
  if (job.description.length < 100) flags.push('short_description')
  if (job.title === job.title.toUpperCase() && job.title.length > 5) flags.push('all_caps_title')
  if (!job.location_text || job.location_text.length < 2) flags.push('missing_location')
  if (!isAccountingFinanceRelevant(job)) flags.push('low_relevance')
  return flags
}

// ── Main validate function ─────────────────────────────────────────────────
export function validate(jobs: NormalisedJob[]): ValidationResult {
  const valid: NormalisedJob[] = []
  const rejected: NormalisedJob[] = []
  const rejectionReasons = new Map<string, string>()

  for (const job of jobs) {
    // Hard reject conditions
    if (!job.title || job.title.length < 3) {
      rejected.push(job)
      rejectionReasons.set(job.slug, 'MISSING_TITLE')
      continue
    }
    if (!job.company_name) {
      rejected.push(job)
      rejectionReasons.set(job.slug, 'MISSING_COMPANY')
      continue
    }
    if (!job.application_url) {
      rejected.push(job)
      rejectionReasons.set(job.slug, 'MISSING_APPLICATION_URL')
      continue
    }

    // Constraint compliance — null out invalid values before DB insert
    const VALID_EMPLOYMENT_TYPES = new Set([
      'permanent', 'contract', 'temporary', 'part_time', 'internship'
    ])
    const VALID_SENIORITY_LEVELS = new Set([
      'junior', 'mid', 'senior', 'executive', 'director'
    ])
    if (job.employment_type && !VALID_EMPLOYMENT_TYPES.has(job.employment_type)) {
      job.employment_type = null
      job.quality_flags.push('employment_type_normalised')
    }
    if (job.seniority_level && !VALID_SENIORITY_LEVELS.has(job.seniority_level)) {
      job.seniority_level = null
      job.quality_flags.push('seniority_normalised')
    }

    // Compute quality flags (non-rejecting — job is still inserted with flags)
    const flags = computeQualityFlags(job)
    job.quality_flags = [...job.quality_flags, ...flags]

    valid.push(job)
  }

  return { valid, rejected, rejectionReasons }
}
