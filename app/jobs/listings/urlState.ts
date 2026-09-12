// Pure state <-> URL translation for /jobs/listings. No React import here
// on purpose: JobListingsClient.tsx derives its view state by calling
// parseListingsUrlState(useSearchParams()) directly on every render — it
// never mirrors these fields into useState — and writes new state by
// calling buildListingsSearchString(nextState) and handing the result to
// router.replace(). Keeping the translation itself framework-free means it
// can be (and is, see urlState.test.ts) unit-tested without React at all,
// which is the only way to mechanically verify "a pasted URL reproduces
// that exact view" rather than just reasoning about it.
import type { EmploymentType, SeniorityLevel } from '@/lib/jobs'
import { EMPLOYMENT_TYPE_LABELS, SENIORITY_LABELS } from '@/lib/job-format'

export type PostedWithin = 'all' | '24h' | '7d' | '30d'
export type SortBy = 'relevance' | 'recent' | 'salary_high' | 'salary_low'

export interface Filters {
  qualifications:  string[]
  seniority:       SeniorityLevel[]
  employmentTypes: EmploymentType[]
  locationCountry: string
  remoteOnly:      boolean
  postedWithin:    PostedWithin
  salaryMin:       string
  salaryMax:       string
}

export const EMPTY_FILTERS: Filters = {
  qualifications:  [],
  seniority:       [],
  employmentTypes: [],
  locationCountry: 'all',
  remoteOnly:      false,
  postedWithin:    'all',
  salaryMin:       '',
  salaryMax:       '',
}

export const DEFAULT_SORT: SortBy = 'relevance'
export const DEFAULT_PAGE = 1

export const POSTED_DAYS: Record<Exclude<PostedWithin, 'all'>, number> = {
  '24h': 1, '7d': 7, '30d': 30,
}

export interface ListingsUrlState {
  search:   string
  location: string
  filters:  Filters
  sortBy:   SortBy
  page:     number
}

export const DEFAULT_URL_STATE: ListingsUrlState = {
  search:   '',
  location: '',
  filters:  EMPTY_FILTERS,
  sortBy:   DEFAULT_SORT,
  page:     DEFAULT_PAGE,
}

const VALID_SENIORITY = new Set(Object.keys(SENIORITY_LABELS))
const VALID_EMPLOYMENT_TYPES = new Set(Object.keys(EMPLOYMENT_TYPE_LABELS))
const VALID_POSTED_WITHIN = new Set<PostedWithin>(['24h', '7d', '30d'])
const VALID_SORT = new Set<SortBy>(['relevance', 'recent', 'salary_high', 'salary_low'])

function parseCommaList(value: string | null): string[] {
  if (!value) return []
  return value.split(',').map(v => v.trim()).filter(Boolean)
}

// Accepts anything that exposes .get(key) — a URLSearchParams or Next's
// ReadonlyURLSearchParams from useSearchParams() both satisfy this, without
// this module needing to import next/navigation's type.
interface ReadableParams {
  get(key: string): string | null
}

export function parseListingsUrlState(params: ReadableParams): ListingsUrlState {
  const seniority = parseCommaList(params.get('seniority'))
    .filter((v): v is SeniorityLevel => VALID_SENIORITY.has(v))
  const employmentTypes = parseCommaList(params.get('employment_types'))
    .filter((v): v is EmploymentType => VALID_EMPLOYMENT_TYPES.has(v))
  const postedWithinRaw = params.get('posted_within')
  const sortByRaw = params.get('sort_by')

  return {
    search:   params.get('search')?.trim() ?? '',
    location: params.get('location')?.trim() ?? '',
    filters: {
      qualifications:  parseCommaList(params.get('qualifications')),
      seniority,
      employmentTypes,
      locationCountry: params.get('location_country')?.trim() || 'all',
      remoteOnly:      params.get('remote') === 'true',
      postedWithin:    postedWithinRaw && VALID_POSTED_WITHIN.has(postedWithinRaw as PostedWithin)
        ? (postedWithinRaw as PostedWithin) : 'all',
      salaryMin: params.get('salary_min') ?? '',
      salaryMax: params.get('salary_max') ?? '',
    },
    sortBy: sortByRaw && VALID_SORT.has(sortByRaw as SortBy) ? (sortByRaw as SortBy) : DEFAULT_SORT,
    page: (() => {
      const n = parseInt(params.get('page') ?? '', 10)
      return Number.isFinite(n) && n >= 1 ? n : DEFAULT_PAGE
    })(),
  }
}

// Serialises state back to a URLSearchParams, omitting anything equal to
// its default — so a plain "browse everything" view is just
// /jobs/listings, not /jobs/listings?location_country=all&sort_by=relevance&page=1.
export function buildListingsUrlParams(state: ListingsUrlState): URLSearchParams {
  const params = new URLSearchParams()

  if (state.search.trim())   params.set('search', state.search.trim())
  if (state.location.trim()) params.set('location', state.location.trim())

  const f = state.filters
  if (f.qualifications.length > 0)  params.set('qualifications', f.qualifications.join(','))
  if (f.seniority.length > 0)       params.set('seniority', f.seniority.join(','))
  if (f.employmentTypes.length > 0) params.set('employment_types', f.employmentTypes.join(','))
  if (f.locationCountry !== 'all')  params.set('location_country', f.locationCountry)
  if (f.remoteOnly)                 params.set('remote', 'true')
  if (f.postedWithin !== 'all')     params.set('posted_within', f.postedWithin)
  if (f.salaryMin.trim())           params.set('salary_min', f.salaryMin.trim())
  if (f.salaryMax.trim())           params.set('salary_max', f.salaryMax.trim())

  if (state.sortBy !== DEFAULT_SORT) params.set('sort_by', state.sortBy)
  if (state.page !== DEFAULT_PAGE)   params.set('page', String(state.page))

  return params
}

// '' or '?a=b&c=d' — ready to append directly to a pathname.
export function buildListingsSearchString(state: ListingsUrlState): string {
  const qs = buildListingsUrlParams(state).toString()
  return qs ? `?${qs}` : ''
}
