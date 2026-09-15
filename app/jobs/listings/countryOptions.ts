// Pure country-dropdown-option logic, split out of JobListingsClient.tsx
// so it can be unit-tested without importing a 'use client' component —
// same split as components/Pagination.tsx / components/pagination.ts.
import type { ActiveJobCountry } from '@/lib/jobs'

export interface CountryOption {
  value: string
  label: string
}

// Used only when the derived list (from get_active_job_countries, passed
// down via JobListingsClient's countryOptions prop) is empty — the RPC
// errored, or hasn't been migrated in yet (this Codespace cannot run
// migrations/0006 itself; see lib/jobs.ts's getActiveJobCountries). A
// filter with no options is worse than one with a stale list.
export const FALLBACK_COUNTRY_OPTIONS: CountryOption[] = [
  { value: 'all',            label: 'All countries' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'United States',  label: 'United States' },
  { value: 'Australia',      label: 'Australia' },
  { value: 'Canada',         label: 'Canada' },
  { value: 'Singapore',      label: 'Singapore' },
  { value: 'South Africa',   label: 'South Africa' },
  { value: 'Worldwide',      label: 'Worldwide / Remote' },
  { value: 'Philippines',    label: 'Philippines' },
  { value: 'Turkey',         label: 'Turkey' },
  { value: 'Mexico',         label: 'Mexico' },
  { value: 'Bulgaria',       label: 'Bulgaria' },
]

// Only 'Worldwide' needs a friendlier label than its raw stored value —
// every other value the derived list can return is already a real,
// displayable country name.
const COUNTRY_LABEL_OVERRIDES: Record<string, string> = {
  Worldwide: 'Worldwide / Remote',
}

// Builds the dropdown's real option list: the platform-scoped derived
// list (already ordered by job count descending server-side, see
// migrations/0006_active_job_countries.sql) with 'all' prepended as the
// fixed no-filter sentinel — or the hardcoded fallback above if the
// derived list is empty. Deliberately does not show a per-country count
// in the label: the count would be up to 6 hours stale (the cache TTL)
// while the underlying job count itself can change sooner than that, so
// a shown number could contradict what clicking the option actually
// returns — the same "claims something untrue" failure this filter is
// being fixed to avoid, just moved into the label instead of the results.
export function buildCountryOptions(derived: ActiveJobCountry[]): CountryOption[] {
  if (derived.length === 0) return FALLBACK_COUNTRY_OPTIONS
  return [
    { value: 'all', label: 'All countries' },
    ...derived.map(c => ({ value: c.country, label: COUNTRY_LABEL_OVERRIDES[c.country] ?? c.country })),
  ]
}
