import type { RawJob } from '../adapters/types'
import type { JobProvider } from '../providers'

// ── Field path resolver ────────────────────────────────────────────────────
// Resolves dot-notation and array-index paths from a raw job object.
// Supports:
//   "title"                → rawJob["title"]
//   "company.display_name" → rawJob["company"]["display_name"]
//   "location.area[0]"     → rawJob["location"]["area"][0]
//   "__constant:GBP"       → "GBP" (literal constant)

function resolvePath(obj: RawJob, path: string): unknown {
  if (path.startsWith('__constant:')) {
    return path.replace('__constant:', '')
  }
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

// ── Employment type normaliser ─────────────────────────────────────────────
const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  'full time': 'permanent', 'full-time': 'permanent', 'permanent': 'permanent',
  'contract': 'contract', 'contractor': 'contract', 'freelance': 'contract', 'fixed term': 'contract',
  'temporary': 'temporary', 'temp': 'temporary',
  'part time': 'part_time', 'part-time': 'part_time',
  'internship': 'internship', 'intern': 'internship', 'graduate': 'internship', 'trainee': 'internship',
}

function normaliseEmploymentType(raw: string | string[] | null | undefined): string | null {
  if (!raw) return null
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return null
  const lower = value.toLowerCase().trim()
  for (const [key, val] of Object.entries(EMPLOYMENT_TYPE_MAP)) {
    if (lower.includes(key)) return val
  }
  return null
}

// ── Seniority detector ─────────────────────────────────────────────────────
function detectSeniority(title: string): string | null {
  const t = title.toLowerCase()
  if (/\b(cfo|chief financial|finance director|vp finance|partner)\b/.test(t)) return 'executive'
  if (/\b(director|head of)\b/.test(t)) return 'director'
  if (/\b(senior|sr\.?|lead|principal|manager)\b/.test(t)) return 'senior'
  if (/\b(junior|jr\.?|graduate|trainee|assistant|apprentice|intern)\b/.test(t)) return 'junior'
  return 'mid'
}

// ── Remote detector ────────────────────────────────────────────────────────
function detectRemote(title: string, locationText: string): boolean {
  const combined = `${title} ${locationText}`.toLowerCase()
  return /\b(remote|hybrid|wfh|work from home|anywhere)\b/.test(combined)
}

// ── HTML stripper ──────────────────────────────────────────────────────────
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ── Slug generator ─────────────────────────────────────────────────────────
function generateSlug(title: string, company: string): string {
  const base = `${title} ${company}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}-${suffix}`
}

// ── Excerpt generator ──────────────────────────────────────────────────────
function generateExcerpt(description: string, maxLength = 300): string {
  const clean = description.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxLength) return clean
  const truncated = clean.slice(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  return (lastSpace > 200 ? truncated.slice(0, lastSpace) : truncated) + '…'
}

// ── Data completeness score ────────────────────────────────────────────────
// 0–1 score based on how many important fields are populated.
function computeDataCompleteness(job: NormalisedJob): number {
  const checks = [
    !!job.title,
    !!job.company_name,
    !!job.location_text,
    !!job.description && job.description.length > 100,
    !!job.application_url,
    job.salary_min !== null,
    !!job.employment_type,
    !!job.seniority_level,
  ]
  return checks.filter(Boolean).length / checks.length
}

// ── Normalised job shape ───────────────────────────────────────────────────
export interface NormalisedJob {
  // Core
  title: string
  company_name: string
  location_text: string
  location_country: string | null
  location_remote: boolean
  description: string
  excerpt: string
  slug: string
  // Salary
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  salary_text: string | null
  // Classification
  employment_type: string | null
  seniority_level: string | null
  // Source
  source: 'adzuna' | 'reed' | 'jobicy' | 'remotive' | 'careerjet' | string
  source_job_id: string | null
  source_url: string | null
  source_score: number
  application_url: string | null
  // Platform
  platform: string[]
  status: 'active'
  expires_at: string
  // Provider links
  provider_id: string
  // Quality
  data_completeness: number
  quality_flags: string[]
  normalisation_version: number
  // Raw
  raw_source_data: RawJob
}

// ── Main normalise function ────────────────────────────────────────────────
export function normalise(
  rawJob: RawJob,
  provider: JobProvider
): NormalisedJob {
  const mapping = provider.field_mapping

  // Extract fields via mapping
  const title        = String(resolvePath(rawJob, mapping.title ?? '') ?? '').trim()
  const companyName  = String(resolvePath(rawJob, mapping.company_name ?? '') ?? '').trim()
  const locationText = String(resolvePath(rawJob, mapping.location_text ?? '') ?? '').trim()
  const locationCountry = mapping.location_country
    ? String(resolvePath(rawJob, mapping.location_country) ?? '') || null
    : null
  const rawDescription = String(resolvePath(rawJob, mapping.description ?? '') ?? '')
  const description  = stripHtml(rawDescription)
  const applicationUrl = mapping.application_url
    ? String(resolvePath(rawJob, mapping.application_url) ?? '') || null
    : null
  const sourceJobId  = mapping.source_job_id
    ? String(resolvePath(rawJob, mapping.source_job_id) ?? '') || null
    : null
  const sourceUrl    = mapping.source_url
    ? String(resolvePath(rawJob, mapping.source_url) ?? '') || null
    : null

  // Salary
  let salaryMin: number | null = null
  let salaryMax: number | null = null
  if (mapping.salary_min) {
    const v = resolvePath(rawJob, mapping.salary_min)
    salaryMin = typeof v === 'number' ? v : (parseFloat(String(v)) || null)
  }
  if (mapping.salary_max) {
    const v = resolvePath(rawJob, mapping.salary_max)
    salaryMax = typeof v === 'number' ? v : (parseFloat(String(v)) || null)
  }
  // Sanity check salary values
  if (salaryMin !== null && (salaryMin <= 0 || salaryMin > 10_000_000)) salaryMin = null
  if (salaryMax !== null && (salaryMax <= 0 || salaryMax > 10_000_000)) salaryMax = null
  if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
    [salaryMin, salaryMax] = [salaryMax, salaryMin]
  }

  const salaryCurrency = mapping.salary_currency
    ? String(resolvePath(rawJob, mapping.salary_currency) ?? '') || null
    : null

  // Generate salary_text from min/max if not provided directly
  let salaryText: string | null = null
  if (salaryMin !== null && salaryMax !== null && salaryCurrency) {
    salaryText = salaryMin === salaryMax
      ? `${salaryCurrency} ${salaryMin.toLocaleString()}`
      : `${salaryCurrency} ${salaryMin.toLocaleString()} – ${salaryMax.toLocaleString()}`
  }

  // Employment type
  const rawEmploymentType = mapping.employment_type
    ? String(resolvePath(rawJob, mapping.employment_type) ?? '') || null
    : null
  const employmentType = normaliseEmploymentType(rawEmploymentType)

  // Seniority
  const rawSeniority = mapping.seniority_level
    ? String(resolvePath(rawJob, mapping.seniority_level) ?? '') || null
    : null
  const seniorityLevel = rawSeniority || detectSeniority(title)

  // Remote
  const locationRemote = detectRemote(title, locationText)

  // Slug + excerpt
  const slug    = generateSlug(title, companyName)
  const excerpt = generateExcerpt(description)

  // Expiry: 30 days for aggregator sources
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const partial: NormalisedJob = {
    title,
    company_name: companyName,
    location_text: locationText,
    location_country: locationCountry,
    location_remote: locationRemote,
    description,
    excerpt,
    slug,
    salary_min: salaryMin,
    salary_max: salaryMax,
    salary_currency: salaryCurrency,
    salary_text: salaryText,
    employment_type: employmentType,
    seniority_level: seniorityLevel,
    source: (provider as unknown as { source_name?: string | null }).source_name ?? provider.adapter_key,
    source_job_id: sourceJobId,
    source_url: sourceUrl,
    source_score: provider.source_score,
    application_url: applicationUrl,
    platform: provider.platform_tags,
    status: 'active',
    expires_at: expiresAt,
    provider_id: provider.id,
    data_completeness: 0,   // computed below
    quality_flags: [],       // computed below
    normalisation_version: 1,
    raw_source_data: rawJob,
  }

  partial.data_completeness = computeDataCompleteness(partial)

  return partial
}
