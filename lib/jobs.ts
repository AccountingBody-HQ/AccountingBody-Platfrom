import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type JobSource = 'employer' | 'careerjet' | 'adzuna' | 'scrape' | 'manual'
export type JobStatus = 'draft' | 'pending_payment' | 'pending_approval' | 'active' | 'expired' | 'closed' | 'rejected'
export type PaymentStatus = 'unpaid' | 'paid' | 'free' | 'refunded'
export type ApplyMethod = 'platform' | 'external' | 'email'
export type EmploymentType = 'permanent' | 'contract' | 'temporary' | 'part_time' | 'internship'
export type SeniorityLevel = 'junior' | 'mid' | 'senior' | 'executive' | 'director'

export interface Job {
  id: string
  source: JobSource
  source_job_id: string | null
  source_url: string | null
  platform: string[]
  canonical_owner: string
  title: string
  slug: string
  company_name: string
  company_domain: string | null
  description: string
  excerpt: string | null
  location_text: string
  location_city: string | null
  location_country: string | null
  location_remote: boolean
  salary_text: string | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string
  employment_type: EmploymentType | null
  seniority_level: SeniorityLevel | null
  category: string | null
  qualifications_required: string[]
  skills_required: string[]
  skills_nice_to_have: string[]
  status: JobStatus
  published_at: string | null
  expires_at: string | null
  closed_at: string | null
  rejection_reason: string | null
  payment_status: PaymentStatus
  stripe_payment_intent_id: string | null
  stripe_session_id: string | null
  manage_token: string | null
  price_paid_pence: number | null
  employer_brief_id: string | null
  employer_email: string
  employer_name: string
  employer_company: string
  employer_phone: string | null
  apply_method: ApplyMethod
  application_url: string | null
  application_email: string | null
  source_score: number
  quality_score: number
  impression_count: number
  click_count: number
  application_count: number
  ctr: number
  dedup_hash: string | null
  admin_notes: string | null
  is_featured: boolean
  created_at: string
  updated_at: string
}

export interface JobInsert {
  title: string
  company_name: string
  description: string
  location_text: string
  employer_email: string
  employer_name: string
  employer_company: string
  employer_phone?: string
  salary_text?: string
  salary_min?: number
  salary_max?: number
  employment_type?: EmploymentType
  seniority_level?: SeniorityLevel
  category?: string
  qualifications_required?: string[]
  skills_required?: string[]
  location_city?: string
  location_country?: string
  location_remote?: boolean
  apply_method?: ApplyMethod
  application_url?: string
  application_email?: string
  platform?: string[]
  source?: JobSource
  source_job_id?: string
  source_url?: string
  raw_source_data?: Record<string, unknown>
  stripe_session_id?: string
  manage_token?: string
}

// ── Internal helpers ─────────────────────────────────────────────────────────

// Public column allowlist — every field the anonymous, unauthenticated
// jobs API (getActiveDirectJobs -> /api/jobs/direct -> the public listings
// page) is allowed to return. Deliberately excludes manage_token, employer
// contact details, payment/moderation metadata, ranking internals, and
// every other column with no business reaching an anonymous visitor.
const JOB_COLUMNS = [
  'id',
  'slug',
  'title',
  'company_name',
  'company_domain',
  'description',
  'excerpt',
  'location_text',
  'location_city',
  'location_country',
  'location_remote',
  'salary_text',
  'salary_min',
  'salary_max',
  'salary_currency',
  'employment_type',
  'seniority_level',
  'category',
  'qualifications_required',
  'skills_required',
  'skills_nice_to_have',
  'apply_method',
  'application_url',
  'application_email',
  'source',
  'source_url',
  'platform',
  'is_featured',
  'published_at',
  'created_at',
  'expires_at',
].join(', ')

// Columns needed only for the server-side relevance ranking inside
// getActiveDirectJobs (see compositeScore). Selected in addition to
// JOB_COLUMNS for that one query, then stripped from every row before it's
// returned — they must never reach the client.
const RANKING_COLUMNS = 'source_score, quality_score, ctr'

// Full row — every other read/write path in this file needs fields
// JOB_COLUMNS deliberately excludes (status, employer contact details,
// manage_token, payment/moderation metadata, ranking internals, etc).
// None of these paths hand the raw row to an anonymous JSON response as-is:
// each requires an admin session, a cron secret, or the job's own
// manage_token as a bearer credential — and app/api/jobs/manage/route.ts
// additionally applies its own field-stripping before responding.
const JOB_COLUMNS_ADMIN = '*'

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'job'
}

export function randomSuffix(length = 4): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

// Web Crypto (crypto.subtle) — not Node's `crypto` module — so this stays
// edge-runtime compatible if this route ever moves off the Node runtime.
async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function computeDedupHash(title: string, companyName: string, locationText: string): Promise<string> {
  const key = `${slugify(title)}|${slugify(companyName)}|${slugify(locationText)}`
  return sha256Hex(key)
}

export function computeExcerpt(description: string, maxLen = 300): string {
  const trimmed = description.trim()
  if (trimmed.length <= maxLen) return trimmed
  const cut = trimmed.slice(0, maxLen)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim() + '…'
}

export function computeQualityScore(data: JobInsert): number {
  let score = 0
  if (data.title) score += 0.15
  if (data.description && data.description.length > 200) score += 0.20
  if (data.salary_text || data.salary_min != null) score += 0.20
  if (data.location_city) score += 0.10
  if (data.employment_type) score += 0.10
  if (data.qualifications_required && data.qualifications_required.length > 0) score += 0.15
  if (data.skills_required && data.skills_required.length > 0) score += 0.10
  return Math.min(1, Number(score.toFixed(3)))
}

export const SOURCE_SCORE: Record<JobSource, number> = {
  employer: 1.0,
  manual: 0.8,
  scrape: 0.6,
  adzuna: 0.5,
  careerjet: 0.4,
}

// Phase 1 ranking note: true PostgreSQL ts_rank-based relevance scoring
// requires a database function (RPC) that was not part of the authorised
// Phase 1 migration. Instead, a search term is applied as a full-text MATCH
// filter via `.textSearch()` (candidates must match to be returned at all),
// and the "relevance" term of the composite score is a constant 1.0 across
// all matched rows. Ranking differentiation within the matched set comes
// from recency, source_score, quality_score and ctr — which are exactly the
// signals these columns were pre-computed for. Phase 2 should replace this
// with a Postgres RPC using ts_rank_cd() for true relevance-weighted order.
const RANK_WEIGHTS = {
  relevance: 0.40,
  recency: 0.25,
  source: 0.20,
  quality: 0.10,
  ctr: 0.05,
}

const RECENCY_HALF_LIFE_DAYS = 21

function recencyDecay(publishedAt: string | null, createdAt: string): number {
  const basis = publishedAt ?? createdAt
  const ageMs = Date.now() - new Date(basis).getTime()
  const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24))
  return Math.exp((-Math.LN2 * ageDays) / RECENCY_HALF_LIFE_DAYS)
}

function compositeScore(job: Job): number {
  const relevance = 1.0
  const recency = recencyDecay(job.published_at, job.created_at)
  return (
    relevance * RANK_WEIGHTS.relevance +
    recency * RANK_WEIGHTS.recency +
    job.source_score * RANK_WEIGHTS.source +
    job.quality_score * RANK_WEIGHTS.quality +
    job.ctr * RANK_WEIGHTS.ctr
  )
}

// Row shape returned by getActiveDirectJobs's query — JOB_COLUMNS plus the
// RANKING_COLUMNS needed only to compute compositeScore server-side.
type JobWithRanking = Job & { source_score: number; quality_score: number; ctr: number }

// Removes the ranking-only columns before a row leaves getActiveDirectJobs.
// The resulting object only actually has the JOB_COLUMNS fields at runtime;
// casting it back to Job here matches the same accepted trade-off as the
// existing `data as Job[]` casts elsewhere in this file — the public read
// path never reads a field outside JOB_COLUMNS (see step29 report).
function stripRankingColumns(job: JobWithRanking): Job {
  const { source_score, quality_score, ctr, ...publicJob } = job
  void source_score; void quality_score; void ctr
  return publicJob as Job
}

// ── Public reads ──────────────────────────────────────────────────────────────

interface GetActiveDirectJobsParams {
  platform: string
  search?: string
  location?: string
  locationCountry?: string
  employmentTypes?: EmploymentType[]
  limit?: number
  offset?: number
  sources?: JobSource[]
  countOnly?: boolean
  seniorityLevels?: SeniorityLevel[]
  remoteOnly?: boolean
  salaryMin?: number
  salaryMax?: number
  postedWithin?: number
  qualifications?: string[]
  sortBy?: 'relevance' | 'recent' | 'salary_high' | 'salary_low'
}

// PostgREST's `.or()` syntax uses commas to separate conditions and
// parentheses for grouping — strip both out of each qualification before
// interpolating it into the filter string, so a value containing them
// can't break out of the intended `title/description ILIKE` conditions.
function buildQualificationsOrFilter(qualifications: string[]): string | null {
  const clauses = qualifications
    .map(q => q.trim().replace(/[(),]/g, ''))
    .filter(Boolean)
    .flatMap(q => [`title.ilike.%${q}%`, `description.ilike.%${q}%`])

  return clauses.length > 0 ? clauses.join(',') : null
}

export async function getActiveDirectJobs(params: GetActiveDirectJobsParams & { countOnly: true }): Promise<number>
export async function getActiveDirectJobs(params: GetActiveDirectJobsParams & { countOnly?: false }): Promise<Job[]>
export async function getActiveDirectJobs(params: GetActiveDirectJobsParams): Promise<Job[] | number> {
  const supabase = getSupabase()
  const {
    platform,
    search,
    location,
    locationCountry,
    employmentTypes,
    limit = 20,
    offset = 0,
    sources, // undefined = no source restriction, every active job is public regardless of source
    countOnly = false,
    seniorityLevels,
    remoteOnly,
    salaryMin,
    salaryMax,
    postedWithin,
    qualifications,
    sortBy,
  } = params

  const nowIso = new Date().toISOString()
  const qualificationsOrFilter = qualifications && qualifications.length > 0 ? buildQualificationsOrFilter(qualifications) : null

  // Count-only path: same WHERE filters as the row query below, deliberately
  // duplicated rather than extracted into a shared builder so the existing
  // row-query path stays completely untouched.
  if (countOnly) {
    let countQuery = supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .contains('platform', [platform])
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)

    if (sources && sources.length > 0) {
      countQuery = countQuery.in('source', sources)
    }
    if (search && search.trim()) {
      countQuery = countQuery.textSearch('search_vector', search.trim(), { type: 'websearch' })
    }
    if (location && location.trim()) {
      countQuery = countQuery.ilike('location_text', `%${location.trim()}%`)
    }
    if (locationCountry && locationCountry !== 'all') {
      countQuery = countQuery.eq('location_country', locationCountry)
    }
    if (employmentTypes && employmentTypes.length > 0) {
      countQuery = countQuery.in('employment_type', employmentTypes)
    }
    if (seniorityLevels && seniorityLevels.length > 0) {
      countQuery = countQuery.in('seniority_level', seniorityLevels)
    }
    if (remoteOnly) {
      countQuery = countQuery.eq('location_remote', true)
    }
    if (salaryMin != null) {
      countQuery = countQuery.gte('salary_min', salaryMin)
    }
    if (salaryMax != null) {
      countQuery = countQuery.lte('salary_max', salaryMax)
    }
    if (postedWithin != null) {
      countQuery = countQuery.gte('created_at', new Date(Date.now() - postedWithin * 24 * 60 * 60 * 1000).toISOString())
    }
    if (qualificationsOrFilter) {
      countQuery = countQuery.or(qualificationsOrFilter)
    }

    const { count, error } = await countQuery
    if (error) {
      console.error('getActiveDirectJobs count error:', error)
      return 0
    }
    return count ?? 0
  }

  // DB-level pre-sort of the 500-row candidate pool. The JS layer below
  // (compositeScore for relevance, or an explicit sortBy branch for
  // recent/salary) determines the final order — this only shapes which 500
  // rows are pulled from a potentially much larger active set.
  let query = supabase
    .from('jobs')
    .select(`${JOB_COLUMNS}, ${RANKING_COLUMNS}`)
    .eq('status', 'active')
    .contains('platform', [platform])
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order('source_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500) // candidate pool — re-ranked and paginated in JS below

  if (sources && sources.length > 0) {
    query = query.in('source', sources)
  }
  if (search && search.trim()) {
    query = query.textSearch('search_vector', search.trim(), { type: 'websearch' })
  }
  if (location && location.trim()) {
    query = query.ilike('location_text', `%${location.trim()}%`)
  }
  if (locationCountry && locationCountry !== 'all') {
    query = query.eq('location_country', locationCountry)
  }
  if (employmentTypes && employmentTypes.length > 0) {
    query = query.in('employment_type', employmentTypes)
  }
  if (seniorityLevels && seniorityLevels.length > 0) {
    query = query.in('seniority_level', seniorityLevels)
  }
  if (remoteOnly) {
    query = query.eq('location_remote', true)
  }
  if (salaryMin != null) {
    query = query.gte('salary_min', salaryMin)
  }
  if (salaryMax != null) {
    query = query.lte('salary_max', salaryMax)
  }
  if (postedWithin != null) {
    query = query.gte('created_at', new Date(Date.now() - postedWithin * 24 * 60 * 60 * 1000).toISOString())
  }
  if (qualificationsOrFilter) {
    query = query.or(qualificationsOrFilter)
  }

  const { data, error } = await query
  if (error || !data) {
    if (error) console.error('getActiveDirectJobs error:', error)
    return []
  }

  // JOB_COLUMNS is built with Array.prototype.join, so its type is a plain
  // `string`, not a literal — Supabase's compile-time select-string parser
  // can't statically infer columns from it and falls back to an internal
  // error-placeholder type. Route through `unknown` (not `any`) to bridge
  // that gap; the actual runtime shape is exactly JOB_COLUMNS + RANKING_COLUMNS.
  const jobs = data as unknown as JobWithRanking[]
  const ranked = jobs
    .map(job => ({ job, score: compositeScore(job) }))
    .sort((a, b) => b.score - a.score)
    .map(r => r.job)

  if (sortBy === 'salary_high') {
    jobs.sort((a, b) => {
      const aMax = a.salary_max ?? a.salary_min ?? 0
      const bMax = b.salary_max ?? b.salary_min ?? 0
      return bMax - aMax
    })
    return jobs.slice(offset, offset + limit).map(stripRankingColumns)
  }
  if (sortBy === 'salary_low') {
    // Only sort jobs that have salary data; unsalaried jobs go to the end
    const withSalary = jobs.filter(j => j.salary_min != null || j.salary_max != null)
    const withoutSalary = jobs.filter(j => j.salary_min == null && j.salary_max == null)
    withSalary.sort((a, b) => {
      const aMin = a.salary_min ?? a.salary_max ?? 0
      const bMin = b.salary_min ?? b.salary_max ?? 0
      return aMin - bMin
    })
    return [...withSalary, ...withoutSalary].slice(offset, offset + limit).map(stripRankingColumns)
  }
  if (sortBy === 'recent') {
    jobs.sort((a, b) => {
      const aDate = new Date(a.created_at ?? 0).getTime()
      const bDate = new Date(b.created_at ?? 0).getTime()
      return bDate - aDate
    })
    return jobs.slice(offset, offset + limit).map(stripRankingColumns)
  }

  // Default: relevance composite score
  return ranked.slice(offset, offset + limit).map(stripRankingColumns)
}

// Used by the admin dashboard (app/api/roodber8/jobs/[id]/route.ts, itself
// cookie-gated) and by app/jobs/apply/[id]/page.tsx (a public Server
// Component that only ever interpolates title/company_name/location_text/
// description/status into rendered HTML — it never passes the fetched job
// object to a client component, so the wider row here never reaches the
// browser as raw JSON the way /api/jobs/direct's response does).
export async function getJobById(id: string): Promise<Job | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_COLUMNS_ADMIN)
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data as Job
}

// Used by the public job detail page (app/jobs/[slug]/page.tsx). Kept on
// the public allowlist (JOB_COLUMNS), never JOB_COLUMNS_ADMIN — same
// full-row-leak concern as every other public read in this file.
//
// Status filter is intentionally 'active' OR 'expired', not just 'active':
// the daily expire-jobs cron (app/api/cron/expire-jobs/route.ts) flips a
// job's status to 'expired' once its expires_at passes, but the detail page
// must keep serving a job for a long time after that (see
// getJobLifecycleState below) — so a merely time-expired job must still be
// fetchable here. This deliberately does NOT extend to 'draft',
// 'pending_payment', 'pending_approval' (never reviewed/never went live) or
// 'rejected' (explicitly rejected) — those must stay unreachable by slug,
// same as today. 'closed' (employer self-withdrawal via
// closeJobByManageToken) is also deliberately excluded: closing a job is
// independent of expires_at, so a closed-but-not-yet-expired job would
// otherwise read as lifecycle state 'active' — a live-looking page for a
// listing the employer took down. Callers wanting that case handled need a
// different fetch (out of scope here).
export async function getJobBySlug(slug: string): Promise<Job | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_COLUMNS)
    .eq('slug', slug)
    .in('status', ['active', 'expired'])
    .single()
  if (error || !data) return null
  // See the comment on the JOB_COLUMNS cast in getActiveDirectJobs — same
  // non-literal-string limitation applies here.
  return data as unknown as Job
}

// Up to `limit` other active, currently-live jobs to surface below a job
// detail page. Deliberately stricter than getJobBySlug's own fetch:
// suggestions must only ever be genuinely live roles, never expired ones,
// so this uses the same "status='active' AND not yet expired" condition as
// getActiveDirectJobs rather than getJobBySlug's broadened
// active-or-expired filter.
//
// Same country is strictly preferred over same seniority, and the two are
// never mixed unless the country alone can't fill the list: a first pass
// fetches only same-country matches; seniority-only matches (which can be
// anywhere in the world) are fetched in a second pass purely to pad up to
// `limit`, and only run at all if the first pass came up short. Country
// results are never displaced by seniority ones. (An earlier version OR'd
// both conditions in one query, which meant a same-seniority match on the
// other side of the world could — and did — fill the entire list even when
// same-country matches existed.)
export interface GetSimilarJobsParams {
  excludeId: string
  platform: string
  locationCountry?: string | null
  seniorityLevel?: SeniorityLevel | null
  limit?: number
}

export async function getSimilarJobs(params: GetSimilarJobsParams): Promise<Job[]> {
  const { excludeId, platform, locationCountry, seniorityLevel, limit = 6 } = params
  const nowIso = new Date().toISOString()

  function baseQuery() {
    return getSupabase()
      .from('jobs')
      .select(JOB_COLUMNS)
      .eq('status', 'active')
      .contains('platform', [platform])
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .neq('id', excludeId)
  }

  let sameCountry: Job[] = []
  if (locationCountry) {
    // Same defensive stripping as buildQualificationsOrFilter — this value
    // originates from the job's own row rather than raw request input, but
    // there's no cost to keeping the filter construction consistently safe.
    const cleanCountry = locationCountry.replace(/[(),]/g, '')
    const { data, error } = await baseQuery()
      .eq('location_country', cleanCountry)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) console.error('getSimilarJobs (country) error:', error)
    // See the comment on the JOB_COLUMNS cast in getActiveDirectJobs — same
    // non-literal-string limitation applies here.
    sameCountry = (data ?? []) as unknown as Job[]
  }

  if (sameCountry.length >= limit || !seniorityLevel) {
    return sameCountry.slice(0, limit)
  }

  const remaining = limit - sameCountry.length
  const cleanSeniority = seniorityLevel.replace(/[(),]/g, '')
  const excludeIds = [excludeId, ...sameCountry.map(j => j.id)]

  const { data: seniorityData, error: seniorityError } = await baseQuery()
    .eq('seniority_level', cleanSeniority)
    .not('id', 'in', `(${excludeIds.join(',')})`)
    .order('created_at', { ascending: false })
    .limit(remaining)

  if (seniorityError) {
    console.error('getSimilarJobs (seniority) error:', seniorityError)
    return sameCountry
  }

  return [...sameCountry, ...((seniorityData ?? []) as unknown as Job[])]
}

// No status filter — an employer managing their own listing via its unique
// manage_token should be able to see it regardless of status (pending
// payment, under review, live, closed, etc). Callers (app/api/jobs/manage/
// route.ts, the expire-jobs cron) read status, employer_email, and
// manage_token itself off the result, so this needs the full row.
export async function getJobByManageToken(token: string): Promise<Job | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_COLUMNS_ADMIN)
    .eq('manage_token', token)
    .single()
  if (error || !data) return null
  return data as Job
}

// ── Admin reads ──────────────────────────────────────────────────────────────

const ADMIN_PAGE_SIZE = 50

export async function getAdminJobs(params: {
  status?: string
  source?: string
  platform?: string
  search?: string
  page?: number
}): Promise<{ jobs: Job[]; total: number }> {
  const supabase = getSupabase()
  const { status, source, platform, search, page = 1 } = params

  const from = (Math.max(1, page) - 1) * ADMIN_PAGE_SIZE
  const to = from + ADMIN_PAGE_SIZE - 1

  let listQuery = supabase
    .from('jobs')
    .select(JOB_COLUMNS_ADMIN)
    .order('created_at', { ascending: false })
    .range(from, to)

  let countQuery = supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })

  if (status) {
    listQuery = listQuery.eq('status', status)
    countQuery = countQuery.eq('status', status)
  }
  if (source) {
    listQuery = listQuery.eq('source', source)
    countQuery = countQuery.eq('source', source)
  }
  if (platform) {
    listQuery = listQuery.contains('platform', [platform])
    countQuery = countQuery.contains('platform', [platform])
  }
  if (search) {
    const orFilter = `title.ilike.%${search}%,company_name.ilike.%${search}%`
    listQuery = listQuery.or(orFilter)
    countQuery = countQuery.or(orFilter)
  }

  const [{ data, error }, { count, error: countError }] = await Promise.all([listQuery, countQuery])

  if (error) console.error('getAdminJobs list error:', error)
  if (countError) console.error('getAdminJobs count error:', countError)

  return {
    jobs: (data ?? []) as Job[],
    total: count ?? 0,
  }
}

export async function getPendingJobsCount(): Promise<number> {
  const supabase = getSupabase()
  const { count } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending_approval')
  return count ?? 0
}

// Employer-paid active listings only — a narrower business metric than
// "how many jobs can a visitor browse" (most active rows today are
// Adzuna-sourced, not employer-posted, so this can legitimately read much
// lower than the site's real browsable job count). Not currently used by
// any public page — see getBrowsableJobsCount below for the footer/hub-page
// stat, which counts what /jobs/listings itself would actually return.
export async function getActiveJobsCount(platform: string): Promise<number> {
  const supabase = getSupabase()
  const { count } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
    .eq('source', 'employer')
    .contains('platform', [platform])
  return count ?? 0
}

// The real "how many jobs can a visitor currently browse" count — same
// status/platform/not-yet-expired filters as getActiveDirectJobs's own
// countOnly path (lib/jobs.ts, the `if (countOnly)` branch above),
// deliberately with NO source restriction, so this agrees with what
// /jobs/listings itself would show for an unfiltered search.
export async function getBrowsableJobsCount(platform: string): Promise<number> {
  const supabase = getSupabase()
  const nowIso = new Date().toISOString()
  const { count, error } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
    .contains('platform', [platform])
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
  if (error) {
    console.error('getBrowsableJobsCount error:', error)
    return 0
  }
  return count ?? 0
}

// Request-deduped wrapper: the root layout (Footer) and the jobs hub page
// (JobsHubClient) both need this count on the same page load. Without
// memoisation each would run its own separate COUNT query; React's cache()
// collapses repeated calls with the same platform argument into a single
// Supabase round-trip per request (never across requests — this is not a
// data cache). Deliberately not used more broadly than these two call
// sites — see the job-count fix report for why the rest of the site's
// "live jobs" copy was reworded instead of wired to a live count.
export const getCachedBrowsableJobsCount = cache(getBrowsableJobsCount)

export async function getExpiringJobs(daysFromNow: number): Promise<Job[]> {
  const supabase = getSupabase()
  const threshold = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_COLUMNS_ADMIN)
    .eq('status', 'active')
    .not('expires_at', 'is', null)
    .lte('expires_at', threshold)
    .order('expires_at', { ascending: true })

  if (error || !data) {
    if (error) console.error('getExpiringJobs error:', error)
    return []
  }
  return data as Job[]
}

// ── Writes ───────────────────────────────────────────────────────────────────

/**
 * Creates a new job row.
 *
 * Note on dedup: `dedup_hash` is enforced unique by a partial unique index
 * (excludes rejected rows). If an employer submits the same title/company/
 * location combination twice while an earlier submission is still
 * pending_payment/pending_approval/active, this insert throws a Postgres
 * unique-violation (23505) — callers (the checkout route) should surface
 * that as a clear "you already have a listing for this role" error rather
 * than retrying blindly.
 */
export async function createJob(data: JobInsert): Promise<Job> {
  const supabase = getSupabase()

  const source: JobSource = data.source ?? 'employer'
  const slug = `${slugify(data.title)}-${slugify(data.company_name)}-${randomSuffix()}`
  const dedupHash = await computeDedupHash(data.title, data.company_name, data.location_text)
  const qualityScore = computeQualityScore(data)
  const sourceScore = SOURCE_SCORE[source]
  const excerpt = computeExcerpt(data.description)

  const status: JobStatus = source === 'employer' ? 'pending_payment' : 'pending_approval'
  const paymentStatus: PaymentStatus = source === 'employer' ? 'unpaid' : 'free'

  const row = {
    source,
    source_job_id: data.source_job_id ?? null,
    source_url: data.source_url ?? null,
    platform: data.platform ?? ['ab'],
    title: data.title,
    slug,
    company_name: data.company_name,
    description: data.description,
    excerpt,
    location_text: data.location_text,
    location_city: data.location_city ?? null,
    location_country: data.location_country ?? null,
    location_remote: data.location_remote ?? false,
    salary_text: data.salary_text ?? null,
    salary_min: data.salary_min ?? null,
    salary_max: data.salary_max ?? null,
    employment_type: data.employment_type ?? null,
    seniority_level: data.seniority_level ?? null,
    category: data.category ?? null,
    qualifications_required: data.qualifications_required ?? [],
    skills_required: data.skills_required ?? [],
    status,
    payment_status: paymentStatus,
    stripe_session_id: data.stripe_session_id ?? null,
    manage_token: data.manage_token ?? null,
    employer_email: data.employer_email,
    employer_name: data.employer_name,
    employer_company: data.employer_company,
    employer_phone: data.employer_phone ?? null,
    apply_method: data.apply_method ?? 'external',
    application_url: data.application_url ?? null,
    application_email: data.application_email ?? null,
    source_score: sourceScore,
    quality_score: qualityScore,
    raw_source_data: data.raw_source_data ?? null,
    dedup_hash: dedupHash,
    expires_at: null,
  }

  const { data: inserted, error } = await supabase
    .from('jobs')
    .insert(row)
    .select(JOB_COLUMNS_ADMIN)
    .single()

  if (error || !inserted) {
    throw error ?? new Error('createJob: insert returned no row')
  }

  return inserted as Job
}

// ── Lifecycle state (derived, read-only — no cron, no stored state) ────────
//
// Distinct from the `status` column's own 'active'/'expired'/'closed'/etc
// values (see JobStatus above) — this is purely a function of expires_at at
// the moment it's called, for the public job detail page to decide what to
// render. Named 'stale' rather than 'closed' specifically so it's never
// confused with the DB status value 'closed' (employer self-withdrawal via
// closeJobByManageToken), which this function does not look at at all. A
// future provider re-verification feature that wants to change how state is
// decided should edit only this function.

export type JobLifecycleState = 'active' | 'stale' | 'archived'

const ARCHIVE_THRESHOLD_DAYS = 365

export function getJobLifecycleState(job: Pick<Job, 'expires_at'>): JobLifecycleState {
  if (!job.expires_at) return 'active'
  const expiryMs = new Date(job.expires_at).getTime()
  const nowMs = Date.now()
  if (expiryMs > nowMs) return 'active'
  const daysSinceExpiry = (nowMs - expiryMs) / (1000 * 60 * 60 * 24)
  return daysSinceExpiry > ARCHIVE_THRESHOLD_DAYS ? 'archived' : 'stale'
}

export async function approveJob(id: string, adminNotes?: string): Promise<Job> {
  const supabase = getSupabase()
  const nowIso = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()

  const update: Record<string, unknown> = {
    status: 'active',
    published_at: nowIso,
    expires_at: expiresAt,
  }
  if (adminNotes !== undefined) update.admin_notes = adminNotes

  const { data, error } = await supabase
    .from('jobs')
    .update(update)
    .eq('id', id)
    .select(JOB_COLUMNS_ADMIN)
    .single()

  if (error || !data) throw error ?? new Error('approveJob: update returned no row')
  return data as Job
}

export async function rejectJob(id: string, reason: string): Promise<Job> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('jobs')
    .update({ status: 'rejected', rejection_reason: reason })
    .eq('id', id)
    .select(JOB_COLUMNS_ADMIN)
    .single()

  if (error || !data) throw error ?? new Error('rejectJob: update returned no row')
  return data as Job
}

export async function expireJob(id: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('jobs')
    .update({ status: 'expired', closed_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

const TERMINAL_STATUSES: JobStatus[] = ['closed', 'expired', 'rejected']

/**
 * Employer self-service withdrawal via manage_token. Idempotent: if the job
 * is already in a terminal status it is returned as-is rather than erroring
 * or re-firing the close (an employer double-clicking or reloading the
 * manage page should never see a failure).
 */
export async function closeJobByManageToken(token: string): Promise<Job | null> {
  const job = await getJobByManageToken(token)
  if (!job) return null

  if (TERMINAL_STATUSES.includes(job.status)) {
    return job
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('jobs')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', job.id)
    .select(JOB_COLUMNS_ADMIN)
    .single()

  if (error || !data) throw error ?? new Error('closeJobByManageToken: update returned no row')
  return data as Job
}

/**
 * Marks a job as paid. `stripe_session_id` and `stripe_payment_intent_id`
 * are legacy column names from the original Stripe integration — they now
 * store the payment provider's references regardless of which provider
 * (Lemon Squeezy or otherwise) processed the payment. Renaming the columns
 * is out of scope; only the parameter names here are provider-agnostic.
 */
export async function markJobPaid(
  id: string,
  providerSessionId: string,
  providerOrderId: string,
  pricePaidPence: number
): Promise<Job> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('jobs')
    .update({
      payment_status: 'paid',
      stripe_session_id: providerSessionId,
      stripe_payment_intent_id: providerOrderId,
      price_paid_pence: pricePaidPence,
      status: 'pending_approval',
    })
    .eq('id', id)
    .select(JOB_COLUMNS_ADMIN)
    .single()

  if (error || !data) throw error ?? new Error('markJobPaid: update returned no row')
  return data as Job
}

// Best-effort engagement counters. These use a read-then-write pattern
// rather than an atomic SQL increment (supabase-js has no raw-expression
// update helper without an RPC), so under heavy concurrent traffic two
// simultaneous hits can race and undercount by one. Acceptable at Phase 1
// listing volumes; Phase 2 should move these to a Postgres RPC
// (e.g. `increment_job_impressions(job_id)`) for atomicity at scale.

export async function incrementJobImpressions(id: string): Promise<void> {
  try {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('jobs')
      .select('impression_count, click_count')
      .eq('id', id)
      .single()
    if (!data) return

    const impressionCount = (data.impression_count ?? 0) + 1
    const clickCount = data.click_count ?? 0
    const ctr = impressionCount > 0 ? Math.max(0.01, clickCount / impressionCount) : 0.01

    await supabase
      .from('jobs')
      .update({ impression_count: impressionCount, ctr })
      .eq('id', id)
  } catch (err: unknown) {
    console.error('incrementJobImpressions failed (non-fatal):', err)
  }
}

export async function incrementJobClicks(id: string): Promise<void> {
  try {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('jobs')
      .select('impression_count, click_count')
      .eq('id', id)
      .single()
    if (!data) return

    const clickCount = (data.click_count ?? 0) + 1
    const impressionCount = data.impression_count ?? 0
    const ctr = impressionCount > 0 ? Math.max(0.01, clickCount / impressionCount) : 0.01

    await supabase
      .from('jobs')
      .update({ click_count: clickCount, ctr })
      .eq('id', id)
  } catch (err: unknown) {
    console.error('incrementJobClicks failed (non-fatal):', err)
  }
}
