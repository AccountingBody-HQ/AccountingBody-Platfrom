import { describe, expect, it } from 'vitest'
import { buildCountryOptions, FALLBACK_COUNTRY_OPTIONS } from './countryOptions'

describe('buildCountryOptions', () => {
  it('falls back to the hardcoded list when the derived list is empty', () => {
    expect(buildCountryOptions([])).toBe(FALLBACK_COUNTRY_OPTIONS)
  })

  it('prepends the all sentinel to a non-empty derived list, preserving its order', () => {
    const derived = [
      { country: 'United States', count: 2120 },
      { country: 'United Kingdom', count: 991 },
    ]
    expect(buildCountryOptions(derived)).toEqual([
      { value: 'all', label: 'All countries' },
      { value: 'United States', label: 'United States' },
      { value: 'United Kingdom', label: 'United Kingdom' },
    ])
  })

  it('does not re-sort the derived list — count-descending ordering is the RPC\'s job, not this function\'s', () => {
    const derived = [
      { country: 'Bulgaria', count: 1 },
      { country: 'United States', count: 2120 },
    ]
    expect(buildCountryOptions(derived).map(o => o.value)).toEqual(['all', 'Bulgaria', 'United States'])
  })

  it('gives Worldwide a friendlier label than its raw stored value', () => {
    const derived = [{ country: 'Worldwide', count: 38 }]
    expect(buildCountryOptions(derived)).toEqual([
      { value: 'all', label: 'All countries' },
      { value: 'Worldwide', label: 'Worldwide / Remote' },
    ])
  })

  it('does not put a job count in any label', () => {
    const derived = [{ country: 'Philippines', count: 2 }]
    const options = buildCountryOptions(derived)
    expect(options.every(o => !/\d/.test(o.label))).toBe(true)
  })
})
