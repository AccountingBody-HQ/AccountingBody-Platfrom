import type { NormalisedJob } from './normalise'
import { ACCOUNTING_FINANCE_KEYWORDS } from './keywords'

export interface ValidationResult {
  valid: NormalisedJob[]
  rejected: NormalisedJob[]
  rejectionReasons: Map<string, string>
}

// ── Relevance check ────────────────────────────────────────────────────────

// Escape a keyword for safe use inside a RegExp.
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Build a word-boundary matcher for a keyword. Matching on whole
// words only prevents 'AP' matching inside 'apply' and 'AR'
// matching inside 'career'.
// NOTE: do NOT use the /u flag — it causes TS1501 in this repo
// (see the repo's TypeScript conventions).
function buildKeywordMatcher(keyword: string): RegExp {
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(keyword.toLowerCase())}([^a-z0-9]|$)`, 'i')
}

// Precomputed once at module scope — the per-job loop must not rebuild
// 437 regexes for every job.
const KEYWORD_MATCHERS: RegExp[] = ACCOUNTING_FINANCE_KEYWORDS
  .map(buildKeywordMatcher)

// Normalise text before keyword matching. Job titles routinely
// write '&' where the taxonomy stores 'and' ("Finance & Operations
// Director" vs 'finance and operations director'), so fold them
// together rather than storing both spellings of every phrase.
// Collapse the resulting whitespace so 'A & B' and 'A and B'
// produce identical text.
function normaliseForMatching(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\s+/g, ' ')
    .trim()
}

// A job is relevant if a taxonomy keyword appears as a whole word
// in the TITLE, or if at least two distinct keywords appear as
// whole words in the description. Title matches are decisive;
// description matches require corroboration, because a single
// incidental mention ("our accounts team will contact you") is
// not evidence the ROLE is an accounting or finance role.
//
// Takes plain strings (not a NormalisedJob) so callers re-evaluating
// existing `jobs` table rows — a different shape entirely — don't have
// to fabricate a fake NormalisedJob just to reuse this logic.
export function isRelevantByText(title: string, description: string): boolean {
  const t = normaliseForMatching(title)
  for (const re of KEYWORD_MATCHERS) {
    if (re.test(t)) return true
  }
  const d = normaliseForMatching(description)
  let hits = 0
  for (const re of KEYWORD_MATCHERS) {
    if (re.test(d)) {
      hits++
      if (hits >= 2) return true
    }
  }
  return false
}

export function isAccountingFinanceRelevant(job: NormalisedJob): boolean {
  return isRelevantByText(job.title, job.description)
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
export function validate(
  jobs: NormalisedJob[],
  enforceRelevance = false
): ValidationResult {
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

    if (
      enforceRelevance &&
      job.quality_flags.includes('low_relevance')
    ) {
      rejected.push(job)
      rejectionReasons.set(job.slug, 'not_relevant')
      continue
    }

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
