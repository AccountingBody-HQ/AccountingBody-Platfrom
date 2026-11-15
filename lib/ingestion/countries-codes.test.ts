import { describe, it, expect } from 'vitest'
import {
  COUNTRY_CANONICAL_NAMES,
  COUNTRY_CODES,
  COUNTRY_KEYS,
} from '@/lib/ingestion/countries'
import { normalise } from '@/lib/ingestion/normalise'
import { makeProvider } from '@/lib/test-helpers/provider-fixture'

// 2-letter ISO codes are recognised only in a provider's own country
// field (normalise() step 1), never in free location text.

const BASE_MAPPING = {
  title: 'title',
  company_name: 'company_name',
  location_text: 'location_text',
  description: 'description',
  application_url: 'application_url',
}

function countryFor(locationText: string, mappedCountry?: string) {
  const provider = makeProvider({
    field_mapping: mappedCountry === undefined
      ? BASE_MAPPING
      : { ...BASE_MAPPING, location_country: 'country' },
  })
  const job = normalise({
    title: 'Financial Accountant',
    company_name: 'Acme Ltd',
    location_text: locationText,
    description: 'A role for an accountant.',
    application_url: 'https://example.com/apply',
    ...(mappedCountry === undefined ? {} : { country: mappedCountry }),
  }, provider)
  return job.location_country
}

describe('COUNTRY_CODES shape', () => {
  it('has 249 uppercase 2-letter keys', () => {
    const keys = Object.keys(COUNTRY_CODES)
    expect(keys).toHaveLength(249)
    for (const key of keys) expect(key).toMatch(/^[A-Z]{2}$/)
  })

  it('every value is a canonical name, and every canonical name is reached exactly once', () => {
    const names = new Set(COUNTRY_CANONICAL_NAMES)
    const values = Object.values(COUNTRY_CODES)
    for (const value of values) expect(names.has(value)).toBe(true)
    expect(new Set(values).size).toBe(values.length)
    expect([...values].sort()).toEqual([...COUNTRY_CANONICAL_NAMES].sort())
  })

  it.each([
    ['GB', 'United Kingdom'],
    ['US', 'United States'],
    ['GE', 'Georgia'],
    ['CG', 'Republic of the Congo'],
    ['CD', 'Democratic Republic of the Congo'],
    ['VG', 'British Virgin Islands'],
    ['VI', 'United States Virgin Islands'],
    ['PH', 'Philippines'],
    ['TH', 'Thailand'],
    ['MX', 'Mexico'],
    ['DE', 'Germany'],
    ['AE', 'United Arab Emirates'],
    ['ZA', 'South Africa'],
    ['CA', 'Canada'],
    ['AU', 'Australia'],
    ['SG', 'Singapore'],
    ['CH', 'Switzerland'],
    ['KR', 'South Korea'],
    ['KP', 'North Korea'],
    ['MK', 'North Macedonia'],
  ])('%s → %s', (code, name) => {
    expect(COUNTRY_CODES[code]).toBe(name)
  })

  it('is frozen and has no prototype', () => {
    expect(Object.isFrozen(COUNTRY_CODES)).toBe(true)
    expect(Object.getPrototypeOf(COUNTRY_CODES)).toBeNull()
    expect(COUNTRY_CODES['constructor']).toBeUndefined()
  })

  it('Kosovo (XK) is not mapped', () => {
    expect(COUNTRY_CODES['XK']).toBeUndefined()
  })

  it('codes are not added to COUNTRY_KEYS', () => {
    for (const code of ['ph', 'th', 'mx', 'de', 'ca', 'wa', 'tx']) {
      expect(Object.prototype.hasOwnProperty.call(COUNTRY_KEYS, code)).toBe(false)
    }
  })
})

describe('a 2-letter code in the provider country field (step 1b)', () => {
  it('PH → Philippines', () => {
    expect(countryFor('Makati City', 'PH')).toBe('Philippines')
  })

  it('ignores case and spaces', () => {
    expect(countryFor('Bangkok', 'th')).toBe('Thailand')
    expect(countryFor('Monterrey', ' MX ')).toBe('Mexico')
  })

  it('GB and US behave as before', () => {
    expect(countryFor('Somewhere', 'GB')).toBe('United Kingdom')
    expect(countryFor('Somewhere', 'US')).toBe('United States')
  })

  it.each(['XK', 'ZZ', 'PHL'])('%s is not a known code and falls through to the location text', value => {
    expect(countryFor('London, UK', value)).toBe('United Kingdom')
    expect(countryFor('Somewhere', value)).toBeNull()
  })

  // Characters that are not plain A–Z letters but upper-case to a code
  // ("ß" → "SS", dotless "ı" + "t" → "IT"). Only plain 2-letter values count.
  it.each(['ß', 'ıt'])('%s is not a 2-letter code', value => {
    expect(countryFor('Somewhere', value)).toBeNull()
  })

  it('a full country name behaves as before', () => {
    expect(countryFor('Makati City', 'Philippines')).toBe('Philippines')
  })

  it('a mapped code wins over contradicting location text', () => {
    expect(countryFor('London, UK', 'PH')).toBe('Philippines')
  })
})

describe('free location text is unchanged', () => {
  it.each([
    'Los Angeles, CA',
    'Austin, TX',
    'Perth, WA',
    'Manila, PH',
  ])('%s with no mapped country → null', text => {
    expect(countryFor(text)).toBeNull()
  })

  it('London, UK → United Kingdom', () => {
    expect(countryFor('London, UK')).toBe('United Kingdom')
  })
})
