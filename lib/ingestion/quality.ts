import type { NormalisedJob } from './normalise'

export interface QualityMetrics {
  relevanceRate: number | null        // 0-100, null if nothing fetched
  avgDescriptionLength: number | null
  fieldCoverage: Record<string, number>  // field -> 0-100
  status: 'good' | 'warning' | 'poor' | 'unknown'
}

const COVERAGE_FIELDS = [
  'title', 'company_name', 'location_text', 'location_city',
  'location_country', 'salary_min', 'salary_max', 'salary_currency',
  'description', 'application_url', 'employment_type', 'seniority_level',
  'qualifications_required',
] as const

function hasValue(job: NormalisedJob, field: (typeof COVERAGE_FIELDS)[number]): boolean {
  switch (field) {
    case 'salary_min':
    case 'salary_max':
      return job[field] !== null
    case 'qualifications_required':
      return job.qualifications_required.length > 0
    default:
      return !!job[field]
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// Single source of truth for ingestion data-quality metrics — computed
// once here from data already in memory (normalised jobs + the valid
// count from validate()), no extra fetch or DB read. Used both by the
// ingest route (persisted to provider_runs / job_providers) and the
// preview route (returned inline, never persisted).
export function computeQualityMetrics(
  normalised: NormalisedJob[],
  validCount: number
): QualityMetrics {
  const total = normalised.length

  const relevanceRate = total === 0 ? null : round1((validCount / total) * 100)

  const avgDescriptionLength = total === 0
    ? null
    : Math.round(normalised.reduce((sum, j) => sum + j.description.length, 0) / total)

  const fieldCoverage: Record<string, number> = {}
  for (const field of COVERAGE_FIELDS) {
    const count = normalised.filter(j => hasValue(j, field)).length
    fieldCoverage[field] = total === 0 ? 0 : round1((count / total) * 100)
  }

  const status: QualityMetrics['status'] =
    relevanceRate === null ? 'poor'
      : relevanceRate >= 80 ? 'good'
      : relevanceRate >= 50 ? 'warning'
      : 'poor'

  return { relevanceRate, avgDescriptionLength, fieldCoverage, status }
}
