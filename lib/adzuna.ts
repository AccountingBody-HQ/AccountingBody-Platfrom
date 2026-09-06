// Adzuna Jobs API client (https://developer.adzuna.com/).
// Pure fetch + normalize — no DB access here. Callers (e.g. the ingestion
// cron route) own persistence, dedup, scoring and expiry.

export interface AdzunaMarket {
  code: string
  name: string
  currency: string
  platform: string[]
}

// Confirmed final market list. Note: the country code 'et' (Ethiopia) and
// the `platform` value 'et' (the EthioTax brand) are unrelated namespaces
// that happen to share two letters — Ethiopia the market maps to
// platform ['ab', 'et'] like every other African market here, not because
// of the code collision.
export const ADZUNA_MARKETS: AdzunaMarket[] = [
  { code: 'gb', name: 'United Kingdom', currency: 'GBP', platform: ['ab'] },
  { code: 'us', name: 'United States', currency: 'USD', platform: ['ab'] },
  { code: 'ae', name: 'UAE', currency: 'AED', platform: ['ab'] },
  { code: 'sg', name: 'Singapore', currency: 'SGD', platform: ['ab'] },
  { code: 'au', name: 'Australia', currency: 'AUD', platform: ['ab'] },
  { code: 'ca', name: 'Canada', currency: 'CAD', platform: ['ab'] },
  { code: 'ng', name: 'Nigeria', currency: 'NGN', platform: ['ab', 'et'] },
  { code: 'za', name: 'South Africa', currency: 'ZAR', platform: ['ab', 'et'] },
  { code: 'ke', name: 'Kenya', currency: 'KES', platform: ['ab', 'et'] },
  { code: 'et', name: 'Ethiopia', currency: 'ETB', platform: ['ab', 'et'] },
]

// Normalized shape, field-aligned with the `jobs` table columns (see
// lib/jobs.ts `Job` / `JobInsert`) so callers can spread these straight
// into an insert row without further field-name translation.
export interface AdzunaJobResult {
  source_job_id: string
  source_url: string
  title: string
  company_name: string
  description: string
  location_text: string
  location_city: string | null
  location_country: string
  salary_min: number | null
  salary_max: number | null
  salary_text: string | null
  salary_currency: string
  employment_type: 'permanent' | 'contract' | 'part_time' | null
  category: string | null
  application_url: string
  posted_at: string | null
}

export interface AdzunaFetchResult {
  jobs: AdzunaJobResult[]
  count: number
}

export class AdzunaApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message)
    this.name = 'AdzunaApiError'
  }
}

interface RawAdzunaJob {
  id?: string
  title?: string
  description?: string
  redirect_url?: string
  company?: { display_name?: string }
  location?: { display_name?: string; area?: string[] }
  salary_min?: number
  salary_max?: number
  contract_type?: string
  contract_time?: string
  category?: { label?: string; tag?: string }
  created?: string
}

interface RawAdzunaResponse {
  results?: RawAdzunaJob[]
  count?: number
}

const ADZUNA_BASE_URL = 'https://api.adzuna.com/v1/api/jobs'

function findMarket(country: string): AdzunaMarket | undefined {
  return ADZUNA_MARKETS.find(m => m.code === country)
}

function mapEmploymentType(
  contractType: string | undefined,
  contractTime: string | undefined
): 'permanent' | 'contract' | 'part_time' | null {
  if (contractTime === 'part_time') return 'part_time'
  if (contractType === 'contract') return 'contract'
  if (contractType === 'permanent') return 'permanent'
  return null
}

function deriveCity(location: RawAdzunaJob['location']): string | null {
  const area = location?.area
  if (!area || area.length < 2) return null
  // Adzuna's `area` runs broad → narrow, e.g. ["UK", "London"] or
  // ["United States", "California", "San Francisco"] — last entry is the
  // most specific, which is the closest analogue to a "city" we get.
  return area[area.length - 1] || null
}

function formatSalaryText(
  min: number | undefined,
  max: number | undefined,
  currency: string
): string | null {
  if (!min && !max) return null
  const fmt = (n: number) => `${currency} ${Math.round(n).toLocaleString('en-US')}`
  if (min && max && min !== max) return `${fmt(min)} - ${fmt(max)}`
  return fmt(min ?? max ?? 0)
}

function normalizeAdzunaJob(raw: RawAdzunaJob, country: string): AdzunaJobResult | null {
  if (!raw.id || !raw.title || !raw.redirect_url) return null

  const market = findMarket(country)
  const countryName = market?.name ?? country.toUpperCase()
  const currency = market?.currency ?? ''

  return {
    source_job_id: raw.id,
    source_url: raw.redirect_url,
    title: raw.title.trim(),
    company_name: raw.company?.display_name?.trim() || 'Unknown',
    description: (raw.description ?? '').trim(),
    location_text: raw.location?.display_name?.trim() || countryName,
    location_city: deriveCity(raw.location),
    location_country: countryName,
    salary_min: typeof raw.salary_min === 'number' ? Math.round(raw.salary_min) : null,
    salary_max: typeof raw.salary_max === 'number' ? Math.round(raw.salary_max) : null,
    salary_text: formatSalaryText(raw.salary_min, raw.salary_max, currency),
    salary_currency: currency,
    employment_type: mapEmploymentType(raw.contract_type, raw.contract_time),
    category: raw.category?.label ?? null,
    application_url: raw.redirect_url,
    posted_at: raw.created ?? null,
  }
}

/**
 * Fetches one page of Adzuna job search results for a country/keyword pair.
 * Throws `AdzunaApiError` on missing credentials, network failure, a
 * non-2xx response (including 404 for a country code Adzuna doesn't
 * support — callers should check `err.status === 404` to distinguish that
 * case from a transient failure), or an unparsable body. Callers should
 * catch per-call so one failing combination doesn't abort a batch run.
 */
export async function fetchAdzunaJobs(
  country: string,
  keywords: string,
  page: number
): Promise<AdzunaFetchResult> {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  if (!appId || !appKey) {
    throw new AdzunaApiError('ADZUNA_APP_ID / ADZUNA_APP_KEY not configured')
  }

  const safePage = Math.max(1, Math.floor(page) || 1)
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    what: keywords,
    results_per_page: '50',
    'content-type': 'application/json',
  })
  const url = `${ADZUNA_BASE_URL}/${country}/search/${safePage}?${params.toString()}`

  let res: Response
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new AdzunaApiError(`Network error fetching Adzuna (${country}, "${keywords}", page ${safePage}): ${message}`)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new AdzunaApiError(
      `Adzuna API returned ${res.status} for ${country}/"${keywords}"/page ${safePage}: ${body.slice(0, 300)}`,
      res.status
    )
  }

  let data: RawAdzunaResponse
  try {
    data = (await res.json()) as RawAdzunaResponse
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new AdzunaApiError(`Failed to parse Adzuna response as JSON (${country}, "${keywords}", page ${safePage}): ${message}`)
  }

  const rawResults = Array.isArray(data.results) ? data.results : []
  const jobs = rawResults
    .map(raw => normalizeAdzunaJob(raw, country))
    .filter((job): job is AdzunaJobResult => job !== null)

  return {
    jobs,
    count: typeof data.count === 'number' ? data.count : jobs.length,
  }
}
