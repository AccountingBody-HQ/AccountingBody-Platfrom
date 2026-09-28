import { describe, it, expect } from 'vitest'
import { normalise, parseProviderDate } from '@/lib/ingestion/normalise'
import type { RawJob } from '@/lib/adapters/types'
import { makeProvider } from '@/lib/test-helpers/provider-fixture'

const BASE_MAPPING = {
  title: 'title',
  company_name: 'company_name',
  location_text: 'location_text',
  description: 'description',
  application_url: 'application_url',
}

describe('normalise — salary parsing', () => {
  it('a nested {min,max,currency} salary object round-trips into salary_min/salary_max/salary_currency', () => {
    // Nested salary objects are common in Greenhouse/Lever/Workday-style APIs
    // (see parseSalaryFromRaw's own docstring) — mapped here via salary_text
    // since Strategy 1 (separate salary_min/salary_max paths) is unused.
    const provider = makeProvider({
      field_mapping: { ...BASE_MAPPING, salary_text: 'salary' },
    })
    const rawJob: RawJob = {
      title: 'Group Accountant',
      company_name: 'Acme Corp',
      location_text: 'London, UK',
      description: 'A great opportunity for an experienced group accountant to join our finance team.',
      application_url: 'https://example.com/apply/1',
      salary: { min: 45000, max: 55000, currency: 'GBP' },
    }

    const job = normalise(rawJob, provider)

    expect(job.salary_min).toBe(45000)
    expect(job.salary_max).toBe(55000)
    expect(job.salary_currency).toBe('GBP')
  })

  it('a string salary range parses into the correct numeric min/max and currency', () => {
    const provider = makeProvider({
      field_mapping: { ...BASE_MAPPING, salary_text: 'salary_text' },
    })
    const rawJob: RawJob = {
      title: 'Financial Controller',
      company_name: 'Acme Corp',
      location_text: 'London, UK',
      description: 'A great opportunity for an experienced financial controller to join our team.',
      application_url: 'https://example.com/apply/2',
      salary_text: '£45,000 - £55,000 per annum',
    }

    const job = normalise(rawJob, provider)

    expect(job.salary_min).toBe(45000)
    expect(job.salary_max).toBe(55000)
    expect(job.salary_currency).toBe('GBP')
    expect(job.quality_flags).not.toContain('salary_converted_from_hourly')
  })

  it('an hourly rate string is converted to an annual figure with the conversion flag set', () => {
    const provider = makeProvider({
      field_mapping: { ...BASE_MAPPING, salary_text: 'salary_text' },
    })
    const rawJob: RawJob = {
      title: 'Bookkeeper',
      company_name: 'Acme Corp',
      location_text: 'London, UK',
      description: 'A great opportunity for an experienced bookkeeper to join our team.',
      application_url: 'https://example.com/apply/3',
      salary_text: '£20/hr',
    }

    const job = normalise(rawJob, provider)

    // 20/hour * 2080 working hours/year = 41,600
    expect(job.salary_min).toBe(41_600)
    expect(job.salary_max).toBe(41_600)
    expect(job.salary_currency).toBe('GBP')
    expect(job.quality_flags).toContain('salary_converted_from_hourly')
  })

  it('an unparseable salary string produces null salary fields, not a garbage number', () => {
    const provider = makeProvider({
      field_mapping: { ...BASE_MAPPING, salary_text: 'salary_text' },
    })
    const rawJob: RawJob = {
      title: 'Accounts Assistant',
      company_name: 'Acme Corp',
      location_text: 'London, UK',
      description: 'A great opportunity for an accounts assistant to join our team.',
      application_url: 'https://example.com/apply/4',
      salary_text: 'Competitive',
    }

    const job = normalise(rawJob, provider)

    expect(job.salary_min).toBeNull()
    expect(job.salary_max).toBeNull()
    expect(job.quality_flags).not.toContain('salary_converted_from_hourly')
  })
})

describe('normalise — description HTML stripping', () => {
  it('inline tags abutting words are separated by a space, not fused, with no double spaces', () => {
    const provider = makeProvider({ field_mapping: BASE_MAPPING })
    const rawJob: RawJob = {
      title: 'Finance Manager',
      company_name: 'Acme Corp',
      location_text: 'London, UK',
      description: 'within the<strong>FMCG</strong>sector and <em>finance</em> teams',
      application_url: 'https://example.com/apply/5',
    }

    const job = normalise(rawJob, provider)

    expect(job.description).not.toMatch(/theFMCG|FMCGsector/)
    expect(job.description).not.toMatch(/ {2,}/)
    expect(job.description).toBe('within the FMCG sector and finance teams')
  })
})

describe('normalise — published_at', () => {
  const rawJob: RawJob = {
    title: 'Group Accountant',
    company_name: 'Acme Corp',
    location_text: 'London, UK',
    description: 'A great opportunity for an experienced group accountant to join our finance team.',
    application_url: 'https://example.com/apply/1',
    created: '2026-09-20T08:15:00Z',
    pubDate: 'Mon, 21 Sep 2026 09:30:00 GMT',
  }

  it('uses the provider date named by field_mapping.published_at (Adzuna-style ISO "created")', () => {
    const provider = makeProvider({ field_mapping: { ...BASE_MAPPING, published_at: 'created' } })
    expect(normalise(rawJob, provider).published_at).toBe('2026-09-20T08:15:00.000Z')
  })

  it('parses an RSS-style RFC 822 pubDate', () => {
    const provider = makeProvider({ field_mapping: { ...BASE_MAPPING, published_at: 'pubDate' } })
    expect(normalise(rawJob, provider).published_at).toBe('2026-09-21T09:30:00.000Z')
  })

  it('falls back to now when the provider has no published_at mapping', () => {
    const provider = makeProvider({ field_mapping: BASE_MAPPING })
    const before = Date.now()
    const publishedAt = Date.parse(normalise(rawJob, provider).published_at)
    expect(publishedAt).toBeGreaterThanOrEqual(before)
    expect(publishedAt).toBeLessThanOrEqual(Date.now())
  })

  it('falls back to now when the mapped value is missing or unusable', () => {
    const provider = makeProvider({ field_mapping: { ...BASE_MAPPING, published_at: 'no_such_field' } })
    const before = Date.now()
    expect(Date.parse(normalise(rawJob, provider).published_at)).toBeGreaterThanOrEqual(before)
  })

  it('rejects unusable dates: empty, garbage, numbers and the future', () => {
    expect(parseProviderDate('')).toBeNull()
    expect(parseProviderDate('not a date')).toBeNull()
    expect(parseProviderDate(1726822500)).toBeNull()
    expect(parseProviderDate(null)).toBeNull()
    expect(parseProviderDate(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())).toBeNull()
  })

  it('accepts a past ISO date unchanged', () => {
    expect(parseProviderDate('2026-01-02T03:04:05Z')).toBe('2026-01-02T03:04:05.000Z')
  })
})
