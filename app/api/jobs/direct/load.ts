// The one data path for a page of the jobs list. /api/jobs/direct (route.ts)
// and the /jobs/listings server page both parse their query here and load
// through here, so the first page in the HTML and every page the browser
// asks for later come from the same cached reads in lib/jobs.ts. Kept out
// of route.ts because Next rejects non-HTTP named exports from a route file.
import {
  getBrowsableJobsTotal, getCachedListingJobs, getCachedListingJobsCount, getPrecountedFilterTotal, isUnfilteredListing,
  type Job, type ListingJob, type SeniorityLevel, type EmploymentType,
} from '@/lib/jobs'
import { parseLimit, parseOffset } from './pagination'

const TOTAL_NOT_AVAILABLE_LOG = 'api/jobs/direct: total not available, rows returned without it'
const TOTAL_STILL_COUNTING_LOG = 'api/jobs/direct: total still counting, rows returned without it'
const FIRST_PAGE_LATE_LOG = 'jobs/listings: first page not ready in time, the browser loads it'
const FIRST_PAGE_FAILED_LOG = 'jobs/listings: first page failed, the browser loads it'

// How long the total may take after the rows are ready.
const TOTAL_GRACE_MS = 1_000

// How long the /jobs/listings page waits for its first page of jobs before
// it is sent without them (the browser then loads them, as it always did).
export const FIRST_PAGE_WAIT_MS = 1_500

// The total if it arrives within the grace time, otherwise null. The count
// itself is not stopped: it finishes on its own and fills the cache for the
// next request when it can. `lookup` never rejects (see its callers).
async function totalWithinGrace(lookup: Promise<number | null>): Promise<number | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<'late'>(resolve => { timer = setTimeout(() => resolve('late'), TOTAL_GRACE_MS) })
  try {
    const result = await Promise.race([lookup, late])
    if (result !== 'late') return result
    // Fixed text only: no request values.
    console.error(TOTAL_STILL_COUNTING_LOG)
    return null
  } finally {
    clearTimeout(timer)
  }
}

const SENIORITY_VALUES: SeniorityLevel[] = ['junior', 'mid', 'senior', 'executive', 'director']
const EMPLOYMENT_TYPE_VALUES: EmploymentType[] = ['permanent', 'contract', 'temporary', 'part_time', 'internship']
const SORT_BY_VALUES = ['relevance', 'recent', 'salary_high', 'salary_low'] as const
type SortBy = (typeof SORT_BY_VALUES)[number]

function parseOptionalNumber(value: string | null): number | undefined {
  if (!value) return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function parseCommaList(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
}

function parseSeniorityLevels(value: string | null): SeniorityLevel[] | undefined {
  const values = parseCommaList(value).filter((v): v is SeniorityLevel => SENIORITY_VALUES.includes(v as SeniorityLevel))
  return values.length > 0 ? values : undefined
}

function parseEmploymentTypes(value: string | null): EmploymentType[] | undefined {
  const values = parseCommaList(value).filter((v): v is EmploymentType => EMPLOYMENT_TYPE_VALUES.includes(v as EmploymentType))
  return values.length > 0 ? values : undefined
}

function parseSortBy(value: string | null): SortBy | undefined {
  return value && (SORT_BY_VALUES as readonly string[]).includes(value) ? (value as SortBy) : undefined
}

export interface DirectJobsQuery {
  baseParams: {
    platform: string
    search?: string
    location?: string
    locationCountry?: string
    employmentTypes?: EmploymentType[]
    seniorityLevels?: SeniorityLevel[]
    remoteOnly?: boolean
    salaryMin?: number
    salaryMax?: number
    postedWithin?: number
    qualifications?: string[]
    sortBy?: SortBy
  }
  limit: number
  offset: number
  countOnly: boolean
}

export function parseDirectJobsQuery(searchParams: URLSearchParams): DirectJobsQuery {
  const search = searchParams.get('search')?.trim() || undefined
  const location = searchParams.get('location')?.trim() || undefined
  const locationCountry = searchParams.get('location_country')?.trim() || undefined
  const platform = searchParams.get('platform')?.trim() || 'ab'
  // Clamped (1-50, 0-10000) before either reaches the cache key or the
  // ranked search RPC; see ./pagination.ts.
  const limit = parseLimit(searchParams.get('limit'))
  const offset = parseOffset(searchParams.get('offset'))
  const countOnly = searchParams.get('count') === 'true'

  const employmentTypes = parseEmploymentTypes(searchParams.get('employment_types'))
  const seniorityLevels = parseSeniorityLevels(searchParams.get('seniority'))
  const remoteOnly = searchParams.get('remote') === 'true' ? true : undefined
  const salaryMin = parseOptionalNumber(searchParams.get('salary_min'))
  const salaryMax = parseOptionalNumber(searchParams.get('salary_max'))
  const postedWithin = parseOptionalNumber(searchParams.get('posted_within'))
  const qualificationsList = parseCommaList(searchParams.get('qualifications'))
  const qualifications = qualificationsList.length > 0 ? qualificationsList : undefined
  const sortBy = parseSortBy(searchParams.get('sort_by'))

  // No `sources` restriction here — every active job is public regardless of
  // source (employer, adzuna, or any ingestion pipeline provider).
  const baseParams = {
    platform,
    search,
    location,
    locationCountry,
    employmentTypes,
    seniorityLevels,
    remoteOnly,
    salaryMin,
    salaryMax,
    postedWithin,
    qualifications,
    sortBy,
  }

  return { baseParams, limit, offset, countOnly }
}

// The plain list (nothing but the platform) takes its total from
// getBrowsableJobsTotal: a pre-counted number, refreshed every 10 minutes,
// that never waits for an exact count (owner decision D108). It never
// throws; null means "not known". Filtered lists keep their exact count,
// except a list whose only filter is one country: getPrecountedFilterTotal
// answers that one (never throws; null, as for every other filtered or
// search request, means "count live as before").

// The count-only answer (`count=true`). Errors throw.
export async function loadDirectJobsTotal({ baseParams }: DirectJobsQuery): Promise<number | null> {
  return isUnfilteredListing(baseParams)
    ? await getBrowsableJobsTotal(baseParams.platform)
    : (await getPrecountedFilterTotal(baseParams)) ?? await getCachedListingJobsCount(baseParams)
}

// One page of rows and its total. Both cached for 5 minutes in lib/jobs.ts;
// the count is keyed on the filters only, so paging and re-sorting reuse it.
// Cards render `excerpt`, never `description`, so getCachedListingJobs
// already returns rows without it.
//
// The page of rows is what the visitor needs; the total only labels it.
// So a count that does not arrive becomes `total: null` ("not known")
// while the rows are still returned, and JobListingsClient pages with
// Previous/Next until a later request has the total again. The rows
// lookup is awaited first, so a rows error throws without waiting for the
// count. Once the rows are ready, the total gets at most TOTAL_GRACE_MS
// more; a count still running then (a slow filtered or word count)
// becomes `total: null` instead of holding the rows back. Both lookups
// start at the same moment.
export async function loadDirectJobsPage({ baseParams, limit, offset }: DirectJobsQuery): Promise<{ jobs: ListingJob[]; total: number | null }> {
  const rowsLookup = getCachedListingJobs({ ...baseParams, limit, offset })
  const totalLookup: Promise<number | null> = isUnfilteredListing(baseParams)
    ? getBrowsableJobsTotal(baseParams.platform)
    : getPrecountedFilterTotal(baseParams).then(precounted =>
      precounted ?? getCachedListingJobsCount(baseParams)
    ).catch((): null => {
      // Fixed text only: no request values, no upstream message.
      console.error(TOTAL_NOT_AVAILABLE_LOG)
      return null
    })
  const jobs = await rowsLookup
  const total = await totalWithinGrace(totalLookup)
  return { jobs, total }
}

// The /jobs/listings page's first page: the page itself must never fail or
// wait long because of the list, so this gives null after `boundMs` or on
// any error, and never rejects. With null the page is sent without cards
// and the browser loads them exactly as it did before. A late load keeps
// running and fills the cache for the browser's own request.
//
// A view with search words gets no server first page at all (null at once,
// nothing loaded): word searches can be slow, and the browser loads them
// exactly as before. `search` is already trimmed by parseDirectJobsQuery,
// so spaces alone are no search.
export async function loadFirstListingsPage<T = Awaited<ReturnType<typeof loadDirectJobsPage>>>(
  query: DirectJobsQuery,
  boundMs: number = FIRST_PAGE_WAIT_MS,
  load: (query: DirectJobsQuery) => Promise<T> = loadDirectJobsPage as unknown as (query: DirectJobsQuery) => Promise<T>,
): Promise<T | null> {
  if (query.baseParams.search) return null
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<'late'>(resolve => { timer = setTimeout(() => resolve('late'), boundMs) })
  const loaded = load(query).catch((): 'failed' => {
    // Fixed text only: no request values, no upstream message.
    console.error(FIRST_PAGE_FAILED_LOG)
    return 'failed'
  })
  try {
    const result = await Promise.race([loaded, late])
    if (result === 'late') {
      console.error(FIRST_PAGE_LATE_LOG)
      return null
    }
    return result === 'failed' ? null : result
  } finally {
    clearTimeout(timer)
  }
}

// The fields a job card on /jobs/listings shows. The page hands the browser
// only these for its first page; /api/jobs/direct's answer is unchanged.
export const LISTING_CARD_FIELDS = [
  'id', 'slug', 'title', 'company_name', 'source', 'excerpt',
  'location_text', 'location_country', 'location_remote',
  'employment_type', 'seniority_level', 'is_featured',
  'published_at', 'created_at',
  'salary_text', 'salary_min', 'salary_max', 'salary_currency',
] as const satisfies readonly (keyof Job)[]

export type ListingCard = Pick<Job, (typeof LISTING_CARD_FIELDS)[number]>

export function toListingCard(job: ListingJob): ListingCard {
  return {
    id: job.id,
    slug: job.slug,
    title: job.title,
    company_name: job.company_name,
    source: job.source,
    excerpt: job.excerpt,
    location_text: job.location_text,
    location_country: job.location_country,
    location_remote: job.location_remote,
    employment_type: job.employment_type,
    seniority_level: job.seniority_level,
    is_featured: job.is_featured,
    published_at: job.published_at,
    created_at: job.created_at,
    salary_text: job.salary_text,
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    salary_currency: job.salary_currency,
  }
}
