import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  COUNTRY_CANONICAL_NAMES,
  COUNTRY_KEYS,
  EXCLUDED_COUNTRY_KEYS,
} from '@/lib/ingestion/countries'
import { normalise, SINGLE_WORD_COUNTRY_NAMES } from '@/lib/ingestion/normalise'
import { makeProvider } from '@/lib/test-helpers/provider-fixture'

// The recogniser's whole list before countries.ts existed. Every one of
// these keys must keep exactly this value.
const OLD_KNOWN_COUNTRIES: Record<string, string> = {
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

// SINGLE_WORD_COUNTRY_NAMES as it was before countries.ts. It feeds the
// locked similar-jobs feature, so it must not grow with the country list.
const FROZEN_SINGLE_WORD_NAMES = [
  'england', 'scotland', 'wales', 'uk', 'gb', 'usa', 'us', 'canada',
  'australia', 'singapore', 'kenya', 'nigeria', 'ethiopia', 'uae',
  'ireland', 'india',
]

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

describe('country recognition through normalise()', () => {
  it.each([
    ['Philippines', 'Philippines'],
    ['Manila, Philippines', 'Philippines'],
    ['Thailand', 'Thailand'],
    ['Bangkok, Thailand', 'Thailand'],
    ['Netherlands', 'Netherlands'],
    ['Amsterdam, The Netherlands', 'Netherlands'],
    ['Seoul, South Korea', 'South Korea'],
    ['Hanoi, Viet Nam', 'Vietnam'],
    ['Istanbul, Türkiye', 'Turkey'],
    ['Prague, Czechia', 'Czech Republic'],
    ['Tbilisi, Republic of Georgia', 'Georgia'],
  ])('%s → %s', (text, expected) => {
    expect(countryFor(text)).toBe(expected)
  })

  it('trusts a newly recognised country from the provider mapping (step 1)', () => {
    expect(countryFor('Makati City', 'Philippines')).toBe('Philippines')
    expect(countryFor('Makati City', '  THAILAND ')).toBe('Thailand')
  })

  it('an excluded name in the provider mapping falls back to the location text', () => {
    expect(countryFor('London, UK', 'Georgia')).toBe('United Kingdom')
  })

  // Documents the one way an old result can move: the provider's own
  // country field wins over the location text (step 1 before step 2), and
  // that field can now hold any country.
  it('a provider country field that contradicts the location text still wins', () => {
    expect(countryFor('London, UK', 'Philippines')).toBe('Philippines')
  })

  it.each([
    'Los Angeles, CA',
    'Austin, TX',
    'Perth, WA',
    'Atlanta, Georgia',
    'Georgia',
    'Hoddesdon, Hertfordshire',
    'The Rocks, Sydney',
    'Macon, South Georgia',
    'Brazzaville, Congo',
    'Toronto, ON',
    'Somewhere, constructor',
  ])('%s → null (not a country)', text => {
    expect(countryFor(text)).toBeNull()
  })

  it.each([
    'Remote',
    'Worldwide',
    'Anywhere',
    'Fully remote',
    'Remote - EMEA',
  ])('%s → Worldwide', text => {
    expect(countryFor(text)).toBe('Worldwide')
  })
})

describe('the old country list is unchanged', () => {
  it.each(Object.entries(OLD_KNOWN_COUNTRIES))('key %s still maps to %s', (key, value) => {
    expect(COUNTRY_KEYS[key]).toBe(value)
    expect(countryFor(`Somewhere, ${key.toUpperCase()}`)).toBe(value)
    expect(countryFor('Somewhere', key)).toBe(value)
  })

  it('SINGLE_WORD_COUNTRY_NAMES is exactly the frozen old set', () => {
    expect(Array.from(SINGLE_WORD_COUNTRY_NAMES).sort()).toEqual([...FROZEN_SINGLE_WORD_NAMES].sort())
  })
})

describe('country list shape', () => {
  it('has all 249 ISO 3166-1 entries, each named once', () => {
    expect(COUNTRY_CANONICAL_NAMES).toHaveLength(249)
    expect(new Set(COUNTRY_CANONICAL_NAMES).size).toBe(249)
  })

  it('every canonical value is a non-empty string of at most 200 characters without commas', () => {
    for (const value of [...COUNTRY_CANONICAL_NAMES, ...Object.values(COUNTRY_KEYS)]) {
      expect(typeof value).toBe('string')
      expect(value.trim()).toBe(value)
      expect(value.length).toBeGreaterThan(0)
      expect(value.length).toBeLessThanOrEqual(200)
      expect(value).not.toContain(',')
    }
  })

  it('every key is lowercase, trimmed, comma-free and points at a canonical name', () => {
    const names = new Set(COUNTRY_CANONICAL_NAMES)
    for (const [key, value] of Object.entries(COUNTRY_KEYS)) {
      expect(key).toBe(key.toLowerCase().trim())
      expect(key).not.toContain(',')
      expect(names.has(value)).toBe(true)
    }
  })

  it('every canonical name can be reached by some key', () => {
    const reachable = new Set(Object.values(COUNTRY_KEYS))
    expect(COUNTRY_CANONICAL_NAMES.filter(n => !reachable.has(n))).toEqual([])
  })

  it('no short code beyond the five that existed before', () => {
    const short = Object.keys(COUNTRY_KEYS).filter(k => k.length <= 3).sort()
    expect(short).toEqual(['gb', 'uae', 'uk', 'us', 'usa'])
  })

  it('excluded names are never keys', () => {
    const excluded = Array.from(EXCLUDED_COUNTRY_KEYS)
    for (const key of excluded) {
      expect(Object.prototype.hasOwnProperty.call(COUNTRY_KEYS, key)).toBe(false)
    }
    expect(excluded).toContain('georgia')
  })
})

describe('migrations/0012 matches countries.ts', () => {
  const sql = readFileSync(
    join(process.cwd(), 'migrations', '0012_backfill_job_country_from_location_text.sql'),
    'utf8',
  )

  function valuesBlocks(text: string): Array<Array<[string, string]>> {
    const blocks: Array<Array<[string, string]>> = []
    let current: Array<[string, string]> | null = null
    for (const line of text.split('\n')) {
      if (line.includes('-- country-keys:begin')) { current = []; continue }
      if (line.includes('-- country-keys:end')) {
        if (current) blocks.push(current)
        current = null
        continue
      }
      if (current) {
        const m = /^\s*\('((?:[^']|'')*)', '((?:[^']|'')*)'\),?$/.exec(line)
        if (!m) throw new Error(`Unparsable VALUES line: ${line}`)
        current.push([m[1].replace(/''/g, "'"), m[2].replace(/''/g, "'")])
      }
    }
    return blocks
  }

  const expected = Object.entries(COUNTRY_KEYS).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))

  it('has the VALUES list in Parts A, B and C, each equal to COUNTRY_KEYS', () => {
    const blocks = valuesBlocks(sql)
    expect(blocks).toHaveLength(3)
    for (const block of blocks) expect(block).toEqual(expected)
  })

  it('uses one cutoff everywhere', () => {
    const cutoffs = sql.match(/TIMESTAMPTZ '[^']*'/g) ?? []
    expect(cutoffs.length).toBeGreaterThanOrEqual(3)
    expect(new Set(cutoffs)).toEqual(new Set(["TIMESTAMPTZ '2026-11-15 00:00:00+00'"]))
  })
})
