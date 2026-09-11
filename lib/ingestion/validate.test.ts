import { describe, it, expect } from 'vitest'
import { isRelevantByText, validate } from './validate'
import type { NormalisedJob } from './normalise'

// ── Relevance filter (isRelevantByText) ──────────────────────────────────

describe('isRelevantByText', () => {
  it('a single taxonomy keyword in the title is decisive — relevant', () => {
    // "Senior Accountant" matches taxonomy keywords in the title alone;
    // the description carries no accounting/finance terms at all.
    expect(
      isRelevantByText(
        'Senior Accountant',
        'Join our team in a fast paced environment with great benefits.'
      )
    ).toBe(true)
  })

  it('a single taxonomy keyword mention in the description only is NOT enough', () => {
    // Title has no keyword. Description contains exactly one keyword
    // ("reconciliation") — the two-hit corroboration rule must reject this.
    expect(
      isRelevantByText(
        'Regional Manager',
        'We need someone confident with reconciliation tasks and spreadsheets in a busy office environment.'
      )
    ).toBe(false)
  })

  it('two distinct taxonomy keywords in the description ARE enough', () => {
    // Same generic title, but the description now carries two distinct
    // keywords ("reconciliation" and "accounts payable") — corroborated.
    expect(
      isRelevantByText(
        'Regional Manager',
        'We need someone confident with reconciliation and accounts payable experience in a busy office environment.'
      )
    ).toBe(true)
  })
})

// ── validate() hard-reject table ─────────────────────────────────────────

function makeJob(overrides: Partial<NormalisedJob> = {}): NormalisedJob {
  return {
    title: 'Senior Accountant',
    company_name: 'Acme Ltd',
    location_text: 'London, UK',
    location_country: 'United Kingdom',
    location_city: 'London',
    location_remote: false,
    description: 'A '.repeat(20).trim(), // 39 chars, well over the 30-char floor
    excerpt: 'A short excerpt.',
    slug: 'senior-accountant-acme-abcd',
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    salary_text: null,
    employment_type: 'permanent',
    seniority_level: 'senior',
    qualifications_required: [],
    source: 'manual',
    source_job_id: null,
    source_url: null,
    source_score: 1,
    application_url: 'https://example.com/apply',
    platform: [],
    status: 'active',
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    provider_id: 'provider-1',
    data_completeness: 1,
    quality_flags: [],
    normalisation_version: 2,
    raw_source_data: {},
    ...overrides,
  }
}

describe('validate — hard-reject conditions', () => {
  it.each([
    {
      name: 'missing title',
      overrides: { title: '', slug: 'missing-title' },
      reason: 'MISSING_TITLE',
    },
    {
      name: 'missing company name',
      overrides: { company_name: '', slug: 'missing-company' },
      reason: 'MISSING_COMPANY',
    },
    {
      name: 'missing application_url',
      overrides: { application_url: null, slug: 'missing-application-url' },
      reason: 'MISSING_APPLICATION_URL',
    },
    {
      name: 'description under 30 characters',
      overrides: { description: 'Too short.', slug: 'description-too-short' },
      reason: 'DESCRIPTION_TOO_SHORT',
    },
  ])('rejects $name with reason $reason', ({ overrides, reason }) => {
    const job = makeJob(overrides)
    const result = validate([job])

    expect(result.valid).toHaveLength(0)
    expect(result.rejected).toHaveLength(1)
    expect(result.rejectionReasons.get(job.slug)).toBe(reason)
  })
})
