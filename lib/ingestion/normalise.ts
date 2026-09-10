import type { RawJob } from '../adapters/types'
import type { JobProvider } from '../providers'

// ── Safe integer parsing for salary_min / salary_max (Postgres integer columns) ──
// Guarantees the result is either null or a finite, rounded integer — never NaN,
// Infinity, or a non-integer decimal — before it can reach an INSERT.
function parseSalaryInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.round(n)
}

// ── Module-level constants ─────────────────────────────────────────────────
// Defined once — never recreated per job or per provider.

/** Valid seniority_level values — must match jobs table CHECK constraint exactly */
export const VALID_SENIORITY_LEVELS = new Set([
  'junior', 'mid', 'senior', 'executive', 'director',
])

/** Valid employment_type values — must match jobs table CHECK constraint exactly */
export const VALID_EMPLOYMENT_TYPES = new Set([
  'permanent', 'contract', 'temporary', 'part_time', 'internship',
])

/**
 * Remote location terms — any provider returning these as location_text
 * will have location_country set to 'Worldwide' and location_remote = true.
 * Covers all known conventions across global job APIs.
 * Add new terms here — never in provider-specific code.
 */
const REMOTE_LOCATION_TERMS = new Set([
  'worldwide', 'remote', 'anywhere', 'global', 'distributed',
  'fully remote', 'remote worldwide', 'remote global', 'remote-first',
  'remote first', 'work from anywhere', 'work from home', 'wfh',
  'location independent', 'location-independent', 'virtual',
  'home based', 'home-based', 'home office', 'any location',
  'multiple locations', 'various locations', 'flexible location',
  'flexible', 'no office', '',
])

/**
 * Comprehensive employment type normalisation map.
 * Covers all major job APIs, ATS systems (Greenhouse, Lever, Workday,
 * BambooHR, Taleo, iCIMS, SmartRecruiters), and international conventions.
 * Keys are lowercase for case-insensitive matching.
 * Values must be members of VALID_EMPLOYMENT_TYPES.
 */
const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  // Full-time / Permanent
  'full time':             'permanent',
  'full-time':             'permanent',
  'fulltime':              'permanent',
  'full_time':             'permanent',
  'permanent':             'permanent',
  'perm':                  'permanent',
  'regular':               'permanent',
  'regular full-time':     'permanent',
  'regular full time':     'permanent',
  'employee':              'permanent',
  'direct hire':           'permanent',
  'direct placement':      'permanent',
  // Contract
  'contract':              'contract',
  'contractor':            'contract',
  'freelance':             'contract',
  'self-employed':         'contract',
  'self employed':         'contract',
  'fixed term':            'contract',
  'fixed-term':            'contract',
  'fixed_term':            'contract',
  'ftc':                   'contract',
  'interim':               'contract',
  'locum':                 'contract',
  'consulting':            'contract',
  'consultant':            'contract',
  'temp to perm':          'contract',
  'temporary to permanent': 'contract',
  'contract to hire':      'contract',
  'contract-to-hire':      'contract',
  'c2h':                   'contract',
  // Temporary
  'temporary':             'temporary',
  'temp':                  'temporary',
  'casual':                'temporary',
  'seasonal':              'temporary',
  'on call':               'temporary',
  'on-call':               'temporary',
  'on_call':               'temporary',
  'zero hours':            'temporary',
  'zero-hours':            'temporary',
  'zero_hours':            'temporary',
  'bank':                  'temporary',
  'ad hoc':                'temporary',
  'relief':                'temporary',
  // Part-time
  'part time':             'part_time',
  'part-time':             'part_time',
  'parttime':              'part_time',
  'part_time':             'part_time',
  'reduced hours':         'part_time',
  'job share':             'part_time',
  'job-share':             'part_time',
  'job_share':             'part_time',
  'part time permanent':   'part_time',
  'permanent part-time':   'part_time',
  // Internship / Entry-level
  'internship':            'internship',
  'intern':                'internship',
  'graduate':              'internship',
  'graduate scheme':       'internship',
  'graduate program':      'internship',
  'graduate programme':    'internship',
  'graduate trainee':      'internship',
  'trainee':               'internship',
  'traineeship':           'internship',
  'apprentice':            'internship',
  'apprenticeship':        'internship',
  'placement':             'internship',
  'work placement':        'internship',
  'industrial placement':  'internship',
  'sandwich':              'internship',
  'co-op':                 'internship',
  'coop':                  'internship',
  'co op':                 'internship',
  'volunteer':             'internship',
  'work experience':       'internship',
  'entry level':           'internship',
  'entry-level':           'internship',
  'school leaver':         'internship',
}

// ── Field path resolver ────────────────────────────────────────────────────

/**
 * Resolves a field value from a raw job object.
 *
 * Supports:
 *   Single path:     "title"                → rawJob["title"]
 *   Dot notation:    "company.display_name" → rawJob["company"]["display_name"]
 *   Array index:     "location.area[0]"     → rawJob["location"]["area"][0]
 *   Constant:        "__constant:GBP"       → "GBP" (literal string)
 *   Fallback chain:  "company.name|employer|organisation"
 *                    → first non-null, non-empty value across paths
 *
 * This is the ONLY mechanism for provider-specific field extraction.
 * All provider field names live in job_providers.field_mapping — never in code.
 */
function resolvePath(obj: RawJob, path: string): unknown {
  if (!path) return undefined
  if (path.startsWith('__constant:')) return path.slice('__constant:'.length)

  if (path.includes('|')) {
    for (const candidate of path.split('|').map(p => p.trim()).filter(Boolean)) {
      const result = resolveSinglePath(obj, candidate)
      if (result !== null && result !== undefined && result !== '') return result
    }
    return undefined
  }

  return resolveSinglePath(obj, path)
}

function resolveSinglePath(obj: RawJob, path: string): unknown {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object' && !Array.isArray(current)) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

// ── Employment type normaliser ─────────────────────────────────────────────

/**
 * Normalises any employment type string (or array of strings) to a
 * VALID_EMPLOYMENT_TYPES value, or null if unrecognised.
 * Handles: string, string[], null, undefined.
 * Case-insensitive. Tries exact match then substring match.
 */
function normaliseEmploymentType(raw: unknown): string | null {
  if (!raw) return null
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value || typeof value !== 'string') return null
  const lower = value.toLowerCase().trim()
  if (!lower) return null
  // Exact match
  if (EMPLOYMENT_TYPE_MAP[lower]) return EMPLOYMENT_TYPE_MAP[lower]
  // Substring match — longer keys first to avoid false positives
  const keys = Object.keys(EMPLOYMENT_TYPE_MAP).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (lower.includes(key)) return EMPLOYMENT_TYPE_MAP[key]
  }
  return null
}

// ── Seniority detector ─────────────────────────────────────────────────────

/**
 * Detects seniority level from job title using pattern matching.
 * Always returns a valid VALID_SENIORITY_LEVELS value — never null.
 * Patterns ordered from most specific (executive) to least (mid default).
 */
function detectSeniority(title: string): string {
  const t = title.toLowerCase()
  if (/\b(cfo|chief financial officer|chief financial|finance director|group finance director|vp of finance|vp finance|vice president finance|managing partner|senior partner|equity partner|treasurer)\b/.test(t)) return 'executive'
  if (/\b(director|head of finance|head of accounting|head of tax|head of treasury|head of fp.?a|head of financial|head of group|head of reporting)\b/.test(t)) return 'director'
  if (/\b(senior|sr\b|sr\.|lead|principal|manager|supervisor|team lead|technical lead|associate director|associate manager|experienced)\b/.test(t)) return 'senior'
  if (/\b(junior|jr\b|jr\.|graduate|trainee|assistant|apprentice|intern|entry.?level|early.?career|newly qualified|part.?qualified|student|placement|school leaver)\b/.test(t)) return 'junior'
  return 'mid'
}

// ── Remote detector ────────────────────────────────────────────────────────

function detectRemote(title: string, locationText: string): boolean {
  const combined = `${title} ${locationText}`.toLowerCase()
  return /\b(remote|hybrid|wfh|work from home|anywhere|worldwide|global|distributed|virtual|home.?based|location.?independent|flexible location)\b/.test(combined)
}

// ── HTML stripper ──────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
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

// ── Universal salary parser ────────────────────────────────────────────────

/**
 * Parses salary from any format a job API might return.
 *
 * Handles:
 *   String ranges:   "£45,000 - £55,000", "$90k - $110k", "€40,000–€50,000"
 *   Single values:   "£45,000 per annum", "$90k", "USD 50000"
 *   Abbreviated:     "45k", "90K", "£45K"
 *   Currency prefix: "GBP 45000", "USD 90000 - 110000"
 *   Nested objects:  {"min": 45000, "max": 55000, "currency": "GBP"}
 *   Unparseable:     "Competitive", "DOE", "Negotiable" → all nulls
 *   Hourly rates:    detected and converted to annual (× 2080) with flag
 *
 * Returns null for all fields when salary is unparseable or non-specific.
 * Never returns implausible values (≤0 or >10,000,000 annual).
 */
function parseSalaryFromRaw(raw: unknown): {
  min: number | null
  max: number | null
  currency: string | null
  isHourly: boolean
} {
  // Handle nested salary object (common in Greenhouse, Lever, Workday)
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>
    const min = parseSalaryInt(
      typeof obj.min === 'number' ? obj.min
        : typeof obj.minimum === 'number' ? obj.minimum
        : typeof obj.from === 'number' ? obj.from : null
    )
    const max = parseSalaryInt(
      typeof obj.max === 'number' ? obj.max
        : typeof obj.maximum === 'number' ? obj.maximum
        : typeof obj.to === 'number' ? obj.to : null
    )
    const currency = typeof obj.currency === 'string' ? obj.currency
      : typeof obj.currency_code === 'string' ? obj.currency_code : null
    return { min, max, currency, isHourly: false }
  }

  if (!raw || typeof raw !== 'string') return { min: null, max: null, currency: null, isHourly: false }
  const s = raw.trim()
  if (!s) return { min: null, max: null, currency: null, isHourly: false }

  // Non-parseable strings — explicitly reject
  if (/^(competitive|doe|negotiable|tbc|tbd|market.?rate|attractive|excellent|not specified|undisclosed|see description|varies|dependent|commensurate|equity|commission|ote|benefits|package|discussed|interview|flexible|open)$/i.test(s)) {
    return { min: null, max: null, currency: null, isHourly: false }
  }

  // Currency detection — order matters (longer/more specific symbols first).
  // ZAR uses a bare "R" symbol, which must only match when immediately
  // followed by a digit — otherwise words like "Remote"/"Senior"/"Director"
  // would be misdetected as ZAR-denominated salaries.
  const currencyPatterns: Array<[RegExp, string]> = [
    [/\bGBP\b/i, 'GBP'], [/£/, 'GBP'],
    [/\bUSD\b/i, 'USD'], [/\bUS\$/i, 'USD'],
    [/\bEUR\b/i, 'EUR'], [/€/, 'EUR'],
    [/\bAUD\b/i, 'AUD'], [/\bAU\$/i, 'AUD'],
    [/\bCAD\b/i, 'CAD'], [/\bCA\$/i, 'CAD'], [/\bC\$/i, 'CAD'],
    [/\bSGD\b/i, 'SGD'], [/\bS\$/i, 'SGD'],
    [/\bZAR\b/i, 'ZAR'],
    [/\bR(?=\s*\d)/, 'ZAR'],
    [/\bKES\b/i, 'KES'],
    [/\bNGN\b/i, 'NGN'], [/₦/, 'NGN'],
    [/\bETB\b/i, 'ETB'],
    [/\bAED\b/i, 'AED'],
    [/\bINR\b/i, 'INR'], [/₹/, 'INR'],
    [/\bNZD\b/i, 'NZD'], [/\bNZ\$/i, 'NZD'],
    [/\$/, 'USD'], // Generic $ last — after all more-specific $ prefixes
  ]

  let detectedCurrency: string | null = null
  for (const [pattern, code] of currencyPatterns) {
    if (pattern.test(s)) { detectedCurrency = code; break }
  }

  // Hourly rate detection
  const isHourly = /\b(per hour|\/hour|\/hr|p\.?h\.?|hourly|an hour|p\/h)\b/i.test(s)

  // Extract numeric values — handle k/K suffix, commas as thousands separators
  const cleaned = s.replace(/[£$€₦₹]/g, ' ')
  const numberRe = /(\d[\d,]*(?:\.\d+)?)\s*(k|K)?/g
  const numbers: number[] = []
  let nm
  while ((nm = numberRe.exec(cleaned)) !== null) {
    const digits = nm[1].replace(/,/g, '')
    let val = parseFloat(digits)
    if (nm[2]) val *= 1000 // k/K suffix
    if (val > 0) numbers.push(val)
  }

  if (numbers.length === 0) return { min: null, max: null, currency: detectedCurrency, isHourly }

  let min = Math.min(...numbers)
  let max = Math.max(...numbers)

  // Convert hourly to annual (assuming 2080 working hours/year = 52 weeks × 40 hours)
  if (isHourly) {
    min = Math.round(min * 2080)
    max = Math.round(max * 2080)
  }

  // Sanity bounds — reject implausible annual values
  if (min <= 0 || min > 10_000_000) min = 0
  if (max <= 0 || max > 10_000_000) max = 0
  if (min === 0 && max === 0) return { min: null, max: null, currency: detectedCurrency, isHourly }

  return {
    min: min > 0 ? parseSalaryInt(min) : null,
    max: max > 0 ? parseSalaryInt(max) : null,
    currency: detectedCurrency,
    isHourly,
  }
}

// ── Data completeness score ────────────────────────────────────────────────

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
    !!job.location_country,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100) / 100
}

// ── Normalised job shape ───────────────────────────────────────────────────

export interface NormalisedJob {
  title: string
  company_name: string
  location_text: string
  location_country: string | null
  location_city: string | null
  location_remote: boolean
  description: string
  excerpt: string
  slug: string
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  salary_text: string | null
  employment_type: string | null
  seniority_level: string | null
  source: string
  source_job_id: string | null
  source_url: string | null
  source_score: number
  application_url: string | null
  platform: string[]
  status: 'active'
  expires_at: string
  provider_id: string
  data_completeness: number
  quality_flags: string[]
  normalisation_version: number
  raw_source_data: RawJob
}

// ── Location string parser ─────────────────────────────────────────────────

// Country names and codes we can recognise at the tail of a
// location string. Ordered longest-first so "United Kingdom"
// wins over "United".
const KNOWN_COUNTRIES: Record<string, string> = {
  'united kingdom': 'United Kingdom',
  'great britain': 'United Kingdom',
  'england': 'United Kingdom',
  'scotland': 'United Kingdom',
  'wales': 'United Kingdom',
  'northern ireland': 'United Kingdom',
  'uk': 'United Kingdom',
  'gb': 'United Kingdom',
  'united states': 'United States',
  'usa': 'United States',
  'us': 'United States',
  'canada': 'Canada',
  'australia': 'Australia',
  'singapore': 'Singapore',
  'south africa': 'South Africa',
  'kenya': 'Kenya',
  'nigeria': 'Nigeria',
  'ethiopia': 'Ethiopia',
  'united arab emirates': 'United Arab Emirates',
  'uae': 'United Arab Emirates',
  'ireland': 'Ireland',
  'india': 'India',
  'new zealand': 'New Zealand',
}

// Split a human-readable location string into city and country.
// "Hoddesdon, Hertfordshire"  -> city Hoddesdon,  country null
// "London, UK"                -> city London,     country United Kingdom
// "The Rocks, Sydney"         -> city The Rocks,  country null
// Country is only set when the final segment is recognised.
// The first segment is treated as the city, which is correct for
// the overwhelming majority of "City, Region" and "City, Country"
// formats.
function parseLocation(locationText: string): {
  city: string | null
  country: string | null
} {
  const raw = (locationText ?? '').trim()
  if (!raw) return { city: null, country: null }

  const parts = raw.split(',').map(p => p.trim()).filter(Boolean)
  if (parts.length === 0) return { city: null, country: null }

  let country: string | null = null
  const last = parts[parts.length - 1].toLowerCase()
  if (KNOWN_COUNTRIES[last]) {
    country = KNOWN_COUNTRIES[last]
    parts.pop()
  }

  const city = parts.length > 0 ? parts[0] : null
  return { city, country }
}

// ── Main normalise function ────────────────────────────────────────────────

export function normalise(rawJob: RawJob, provider: JobProvider): NormalisedJob {
  const mapping = provider.field_mapping

  // ── Core field extraction ─────────────────────────────────────────────────
  const title = String(resolvePath(rawJob, mapping.title ?? '') ?? '').trim()
  const rawCompanyName = String(resolvePath(rawJob, mapping.company_name ?? '') ?? '').trim()
  const locationText = String(resolvePath(rawJob, mapping.location_text ?? '') ?? '').trim()

  // Company name fallback — if mapping produces empty string, try domain extraction from application_url
  let companyName = rawCompanyName
  if (!companyName && mapping.application_url) {
    const appUrlRaw = String(resolvePath(rawJob, mapping.application_url) ?? '').trim()
    if (appUrlRaw) {
      try {
        const domain = new URL(appUrlRaw).hostname
          .replace(/^www\./, '')
          .replace(/^careers\./, '')
          .replace(/^jobs\./, '')
          .split('.')[0]
        if (domain && domain.length > 1) {
          companyName = domain.charAt(0).toUpperCase() + domain.slice(1)
        }
      } catch {
        // Invalid URL — leave companyName as empty string
      }
    }
  }

  const rawDescription = String(resolvePath(rawJob, mapping.description ?? '') ?? '')
  const description = stripHtml(rawDescription)

  const applicationUrl = mapping.application_url
    ? String(resolvePath(rawJob, mapping.application_url) ?? '') || null
    : null

  const sourceJobId = mapping.source_job_id
    ? String(resolvePath(rawJob, mapping.source_job_id) ?? '') || null
    : null

  const sourceUrl = mapping.source_url
    ? String(resolvePath(rawJob, mapping.source_url) ?? '') || null
    : null

  // ── Location city + country + universal remote inference ──────────────────
  const parsedLocation = parseLocation(locationText)
  const locationCity = parsedLocation.city

  const mappedLocationCountry = mapping.location_country
    ? String(resolvePath(rawJob, mapping.location_country) ?? '') || null
    : null

  let locationCountry: string | null = null
  if (mappedLocationCountry && KNOWN_COUNTRIES[mappedLocationCountry.toLowerCase().trim()]) {
    // 1. Mapping points at a genuine, recognised country value — trust it.
    locationCountry = KNOWN_COUNTRIES[mappedLocationCountry.toLowerCase().trim()]
  } else if (parsedLocation.country) {
    // 2. Mapping was empty or unrecognised (e.g. a display string like
    //    "Hoddesdon, Hertfordshire") — fall back to what parseLocation found.
    locationCountry = parsedLocation.country
  } else {
    // 3. Universal remote inference — any provider using these terms gets Worldwide
    const lt = locationText.toLowerCase().trim()
    if (REMOTE_LOCATION_TERMS.has(lt) || lt.includes('remote') || lt.includes('worldwide')) {
      locationCountry = 'Worldwide'
    }
    // 4. Otherwise locationCountry stays null.
  }

  const locationRemote = locationCountry === 'Worldwide' || detectRemote(title, locationText)

  // ── Salary extraction ─────────────────────────────────────────────────────
  let salaryMin: number | null = null
  let salaryMax: number | null = null
  let salaryCurrency: string | null = null
  let salaryText: string | null = null
  const qualityFlags: string[] = []

  // Strategy 1: Separate numeric min/max fields from field_mapping
  if (mapping.salary_min) {
    const v = resolvePath(rawJob, mapping.salary_min)
    salaryMin = parseSalaryInt(v)
  }
  if (mapping.salary_max) {
    const v = resolvePath(rawJob, mapping.salary_max)
    salaryMax = parseSalaryInt(v)
  }
  if (mapping.salary_currency) {
    salaryCurrency = String(resolvePath(rawJob, mapping.salary_currency) ?? '') || null
  }

  // Strategy 2: Salary text or object field — used when min/max not available
  if ((salaryMin === null || salaryMax === null) && mapping.salary_text) {
    const rawSalary = resolvePath(rawJob, mapping.salary_text)
    if (rawSalary !== null && rawSalary !== undefined && rawSalary !== '') {
      const parsed = parseSalaryFromRaw(rawSalary)
      if (salaryMin === null) salaryMin = parseSalaryInt(parsed.min)
      if (salaryMax === null) salaryMax = parseSalaryInt(parsed.max)
      if (!salaryCurrency && parsed.currency) salaryCurrency = parsed.currency
      if (parsed.isHourly) qualityFlags.push('salary_converted_from_hourly')
      // Preserve original for display if it's a string
      if (typeof rawSalary === 'string') salaryText = rawSalary
    }
  }

  // Sanity bounds — reject implausible values
  if (salaryMin !== null && (salaryMin <= 0 || salaryMin > 10_000_000)) salaryMin = null
  if (salaryMax !== null && (salaryMax <= 0 || salaryMax > 10_000_000)) salaryMax = null
  // Swap inverted range
  if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
    [salaryMin, salaryMax] = [salaryMax, salaryMin]
  }

  // Generate display salary_text from numeric values if not already set
  if (!salaryText && salaryMin !== null && salaryMax !== null && salaryCurrency) {
    salaryText = salaryMin === salaryMax
      ? `${salaryCurrency} ${salaryMin.toLocaleString()}`
      : `${salaryCurrency} ${salaryMin.toLocaleString()} – ${salaryMax.toLocaleString()}`
  }

  // ── Employment type — mapped then constraint-enforced ─────────────────────
  const rawEmploymentType = mapping.employment_type
    ? resolvePath(rawJob, mapping.employment_type)
    : null
  const normalisedEmploymentType = (() => {
    const mapped = normaliseEmploymentType(rawEmploymentType)
    if (mapped && VALID_EMPLOYMENT_TYPES.has(mapped)) return mapped
    return null
  })()

  // ── Seniority — mapped, constraint-enforced, then title-based fallback ─────
  // Constraint enforcement HERE — never in validate.ts
  let seniorityLevel: string | null = null
  if (mapping.seniority_level) {
    const rawSeniority = String(resolvePath(rawJob, mapping.seniority_level) ?? '').toLowerCase().trim()
    if (rawSeniority && VALID_SENIORITY_LEVELS.has(rawSeniority)) {
      seniorityLevel = rawSeniority
    }
  }
  // Universal title-based detection — always produces a valid value
  if (!seniorityLevel) {
    seniorityLevel = detectSeniority(title)
  }

  // ── Source attribution ────────────────────────────────────────────────────
  const source = provider.source_name ?? provider.adapter_key

  // ── Slug + excerpt ────────────────────────────────────────────────────────
  const slug = generateSlug(title, companyName)
  const excerpt = generateExcerpt(description)

  // ── Expiry ────────────────────────────────────────────────────────────────
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const partial: NormalisedJob = {
    title,
    company_name: companyName,
    location_text: locationText,
    location_country: locationCountry,
    location_city: locationCity,
    location_remote: locationRemote,
    description,
    excerpt,
    slug,
    salary_min: salaryMin,
    salary_max: salaryMax,
    salary_currency: salaryCurrency,
    salary_text: salaryText,
    employment_type: normalisedEmploymentType,
    seniority_level: seniorityLevel,
    source,
    source_job_id: sourceJobId,
    source_url: sourceUrl,
    source_score: provider.source_score,
    application_url: applicationUrl,
    platform: provider.platform_tags,
    status: 'active',
    expires_at: expiresAt,
    provider_id: provider.id,
    data_completeness: 0,
    quality_flags: qualityFlags,
    normalisation_version: 2,
    raw_source_data: rawJob,
  }

  partial.data_completeness = computeDataCompleteness(partial)
  return partial
}
