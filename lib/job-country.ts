import { COUNTRY_CODES, COUNTRY_KEYS } from '@/lib/ingestion/countries'

// One real country for a job's stored location_country, or null.
//
// Used by the job page's JobPosting data, which must never name a country we
// do not know. A stored value is a real country only when it is exactly one
// country name or spelling the ingestion country list knows, or an ISO
// 3166-1 alpha-2 code. "Worldwide", "Remote", an empty value or a list of
// several countries is not one country, so it gives null.
//
// Pure: reads only the country data in lib/ingestion/countries.ts.

export interface RealCountry {
  /** ISO 3166-1 alpha-2 code, e.g. "GB". */
  code: string
  /** The canonical English name, e.g. "United Kingdom". */
  name: string
}

const has = (record: Readonly<Record<string, string>>, key: string) =>
  Object.prototype.hasOwnProperty.call(record, key)

function buildCodeByName(): Readonly<Record<string, string>> {
  const byName: Record<string, string> = Object.create(null)
  for (const [code, name] of Object.entries(COUNTRY_CODES)) byName[name] = code
  return Object.freeze(byName)
}

const CODE_BY_NAME = buildCodeByName()

export function realCountry(value: string | null | undefined): RealCountry | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '') return null

  const upper = trimmed.toUpperCase()
  if (/^[A-Z]{2}$/.test(upper) && has(COUNTRY_CODES, upper)) {
    return { code: upper, name: COUNTRY_CODES[upper] }
  }

  const key = trimmed.toLowerCase()
  if (!has(COUNTRY_KEYS, key)) return null
  const name = COUNTRY_KEYS[key]
  if (!has(CODE_BY_NAME, name)) return null
  return { code: CODE_BY_NAME[name], name }
}
