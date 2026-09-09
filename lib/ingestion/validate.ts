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
  if (!job.salary_min && !job.salary_max)        flags.push('missing_salary')
  if (job.description.length < 100)              flags.push('short_description')
  if (job.description.length < 300)              flags.push('brief_description')
  if (job.title === job.title.toUpperCase()
      && job.title.length > 5)                   flags.push('all_caps_title')
  if (!job.location_text
      || job.location_text.length < 2)           flags.push('missing_location')
  if (!job.location_country)                     flags.push('missing_country')
  if (!job.employment_type)                      flags.push('missing_employment_type')
  if (!isAccountingFinanceRelevant(job))         flags.push('low_relevance')
  if (job.data_completeness < 0.5)               flags.push('low_completeness')
  return flags
}

// ── Constraint compliance (must match jobs table CHECK constraints) ────────
const VALID_EMPLOYMENT_TYPES = new Set([
  'permanent', 'contract', 'temporary', 'part_time', 'internship'
])
const VALID_SENIORITY_LEVELS = new Set([
  'junior', 'mid', 'senior', 'executive', 'director'
])
const VALID_SOURCES = new Set([
  'employer', 'careerjet', 'adzuna', 'scrape', 'manual', 'jobicy',
  'reed', 'indeed', 'remotive', 'talent', 'generic', 'generic-rest'
])

// ── Main validate function ─────────────────────────────────────────────────
export function validate(jobs: NormalisedJob[]): ValidationResult {
  const valid: NormalisedJob[] = []
  const rejected: NormalisedJob[] = []
  const rejectionReasons = new Map<string, string>()

  for (const job of jobs) {
    // ── Hard reject conditions ───────────────────────────────────────────
    if (!job.title || job.title.length < 2) {
      rejected.push(job)
      rejectionReasons.set(job.slug, 'MISSING_TITLE')
      continue
    }
    if (!job.company_name || job.company_name.length < 1) {
      rejected.push(job)
      rejectionReasons.set(job.slug, 'MISSING_COMPANY')
      continue
    }
    if (!job.application_url) {
      rejected.push(job)
      rejectionReasons.set(job.slug, 'MISSING_APPLICATION_URL')
      continue
    }
    if (job.description.length < 30) {
      rejected.push(job)
      rejectionReasons.set(job.slug, 'DESCRIPTION_TOO_SHORT')
      continue
    }

    // ── Quality flags (non-rejecting) ────────────────────────────────────
    const flags = computeQualityFlags(job)
    job.quality_flags = [...job.quality_flags, ...flags]

    // ── Pre-insert constraint compliance ─────────────────────────────────
    if (job.employment_type !== null && job.employment_type !== undefined
        && !VALID_EMPLOYMENT_TYPES.has(job.employment_type)) {
      job.employment_type = null
      job.quality_flags.push('employment_type_normalised')
    }

    if (job.seniority_level !== null && job.seniority_level !== undefined
        && !VALID_SENIORITY_LEVELS.has(job.seniority_level)) {
      job.seniority_level = null
      job.quality_flags.push('seniority_normalised')
    }

    if (!VALID_SOURCES.has(job.source)) {
      console.error(`[validate] rejecting job "${job.slug}" — invalid source value: ${JSON.stringify(job.source)}`)
      rejected.push(job)
      rejectionReasons.set(job.slug, 'invalid_source_value')
      continue
    }

    valid.push(job)
  }

  return { valid, rejected, rejectionReasons }
}
