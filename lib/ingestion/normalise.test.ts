import { describe, it, expect } from 'vitest'
import { normalise } from '@/lib/ingestion/normalise'
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
