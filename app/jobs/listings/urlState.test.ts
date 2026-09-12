import { describe, expect, it } from 'vitest'
import {
  parseListingsUrlState,
  buildListingsUrlParams,
  buildListingsSearchString,
  DEFAULT_URL_STATE,
  EMPTY_FILTERS,
  type ListingsUrlState,
} from './urlState'

describe('parseListingsUrlState', () => {
  it('returns all defaults for an empty query string', () => {
    expect(parseListingsUrlState(new URLSearchParams(''))).toEqual(DEFAULT_URL_STATE)
  })

  it('reads every field back from a fully-populated query string', () => {
    const params = new URLSearchParams(
      'search=accountant&location=London&qualifications=ACCA,CIMA&seniority=senior,director' +
      '&employment_types=permanent,contract&location_country=United+Kingdom&remote=true' +
      '&posted_within=7d&salary_min=40000&salary_max=60000&sort_by=recent&page=6'
    )
    const state = parseListingsUrlState(params)
    expect(state).toEqual({
      search: 'accountant',
      location: 'London',
      filters: {
        qualifications: ['ACCA', 'CIMA'],
        seniority: ['senior', 'director'],
        employmentTypes: ['permanent', 'contract'],
        locationCountry: 'United Kingdom',
        remoteOnly: true,
        postedWithin: '7d',
        salaryMin: '40000',
        salaryMax: '60000',
      },
      sortBy: 'recent',
      page: 6,
    })
  })

  it('falls back to safe defaults for garbage values rather than passing them through', () => {
    const params = new URLSearchParams(
      'seniority=not-a-real-level,senior&employment_types=nonsense' +
      '&posted_within=999&sort_by=made_up_sort&page=not-a-number'
    )
    const state = parseListingsUrlState(params)
    expect(state.filters.seniority).toEqual(['senior']) // invalid entry dropped, valid one kept
    expect(state.filters.employmentTypes).toEqual([])
    expect(state.filters.postedWithin).toBe('all')
    expect(state.sortBy).toBe('relevance')
    expect(state.page).toBe(1)
  })

  it('treats page=0 and negative pages as page 1', () => {
    expect(parseListingsUrlState(new URLSearchParams('page=0')).page).toBe(1)
    expect(parseListingsUrlState(new URLSearchParams('page=-5')).page).toBe(1)
  })
})

describe('buildListingsUrlParams / buildListingsSearchString', () => {
  it('omits every field that is at its default', () => {
    expect(buildListingsUrlParams(DEFAULT_URL_STATE).toString()).toBe('')
    expect(buildListingsSearchString(DEFAULT_URL_STATE)).toBe('')
  })

  it('omits page=1, sort_by=relevance and location_country=all specifically, not just when everything is default', () => {
    const state: ListingsUrlState = {
      ...DEFAULT_URL_STATE,
      search: 'tax manager',
      page: 1,
      sortBy: 'relevance',
      filters: { ...EMPTY_FILTERS, locationCountry: 'all' },
    }
    const qs = buildListingsUrlParams(state)
    expect(qs.get('search')).toBe('tax manager')
    expect(qs.has('page')).toBe(false)
    expect(qs.has('sort_by')).toBe(false)
    expect(qs.has('location_country')).toBe(false)
  })

  it('includes non-default fields', () => {
    const state: ListingsUrlState = {
      search: '', location: '',
      filters: {
        ...EMPTY_FILTERS,
        seniority: ['senior'],
        remoteOnly: true,
        locationCountry: 'United States',
      },
      sortBy: 'salary_high',
      page: 3,
    }
    const qs = buildListingsUrlParams(state)
    expect(qs.get('seniority')).toBe('senior')
    expect(qs.get('remote')).toBe('true')
    expect(qs.get('location_country')).toBe('United States')
    expect(qs.get('sort_by')).toBe('salary_high')
    expect(qs.get('page')).toBe('3')
  })
})

describe('round-trip: parse(build(state)) reproduces the same state', () => {
  const cases: ListingsUrlState[] = [
    DEFAULT_URL_STATE,
    {
      search: 'financial controller',
      location: 'Manchester',
      filters: {
        qualifications: ['ACCA', 'CFA'],
        seniority: ['mid', 'senior'],
        employmentTypes: ['contract'],
        locationCountry: 'Worldwide',
        remoteOnly: true,
        postedWithin: '30d',
        salaryMin: '35000',
        salaryMax: '',
      },
      sortBy: 'salary_low',
      page: 12,
    },
  ]

  it.each(cases)('round-trips state #%#', (state) => {
    const reparsed = parseListingsUrlState(buildListingsUrlParams(state))
    expect(reparsed).toEqual(state)
  })

  it('a pasted URL (query string built independently of the app) reproduces that exact view', () => {
    const pasted = new URLSearchParams('search=audit&location_country=Canada&seniority=director&page=6')
    const state = parseListingsUrlState(pasted)
    // Simulates opening a job from page 6, then re-deriving state as if the
    // browser navigated straight to this URL (e.g. via Back) — same result.
    const rebuilt = parseListingsUrlState(buildListingsUrlParams(state))
    expect(rebuilt).toEqual(state)
    expect(state.page).toBe(6)
    expect(state.filters.locationCountry).toBe('Canada')
    expect(state.filters.seniority).toEqual(['director'])
  })
})
