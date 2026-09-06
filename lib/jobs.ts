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

const JOB_COLUMNS = '*'

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

// ── Public reads ──────────────────────────────────────────────────────────────

interface GetActiveDirectJobsParams {
  platform: string
  search?: string
  location?: string
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
    employmentTypes,
    limit = 20,
    offset = 0,
    sources = ['employer', 'adzuna'], // now includes adzuna — see adzuna-final-architecture.md et al.
    countOnly = false,
    seniorityLevels,
    remoteOnly,
    salaryMin,
    salaryMax,
    postedWithin,
    qualifications,
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
      .in('source', sources)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)

    if (search && search.trim()) {
      countQuery = countQuery.textSearch('search_vector', search.trim(), { type: 'websearch' })
    }
    if (location && location.trim()) {
      countQuery = countQuery.ilike('location_text', `%${location.trim()}%`)
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

  let query = supabase
    .from('jobs')
    .select(JOB_COLUMNS)
    .eq('status', 'active')
    .contains('platform', [platform])
    .in('source', sources)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order('source_score', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(500) // candidate pool — re-ranked and paginated in JS below

  if (search && search.trim()) {
    query = query.textSearch('search_vector', search.trim(), { type: 'websearch' })
  }
  if (location && location.trim()) {
    query = query.ilike('location_text', `%${location.trim()}%`)
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

  const jobs = data as Job[]
  const ranked = jobs
    .map(job => ({ job, score: compositeScore(job) }))
    .sort((a, b) => b.score - a.score)
    .map(r => r.job)

  return ranked.slice(offset, offset + limit)
}

export async function getJobById(id: string): Promise<Job | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_COLUMNS)
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data as Job
}

export async function getJobBySlug(slug: string): Promise<Job | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_COLUMNS)
    .eq('slug', slug)
    .eq('status', 'active')
    .single()
  if (error || !data) return null
  return data as Job
}

// No status filter — an employer managing their own listing via its unique
// manage_token should be able to see it regardless of status (pending
// payment, under review, live, closed, etc).
export async function getJobByManageToken(token: string): Promise<Job | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_COLUMNS)
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
    .select(JOB_COLUMNS)
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

export async function getExpiringJobs(daysFromNow: number): Promise<Job[]> {
  const supabase = getSupabase()
  const threshold = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_COLUMNS)
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
    .select(JOB_COLUMNS)
    .single()

  if (error || !inserted) {
    throw error ?? new Error('createJob: insert returned no row')
  }

  return inserted as Job
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
    .select(JOB_COLUMNS)
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
    .select(JOB_COLUMNS)
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
    .select(JOB_COLUMNS)
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
    .select(JOB_COLUMNS)
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
