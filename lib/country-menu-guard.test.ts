import { describe, it, expect, vi } from 'vitest'
import { countryListFromPrecounts, PRECOUNT_MAX_AGE_MS } from '@/lib/jobs'
import { COUNTRY_CANONICAL_NAMES } from '@/lib/ingestion/countries'

// lib/jobs.ts is loaded for its pure function only: no database client
// is created and React's cache() is a pass-through here.
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}))

// The jobs Country menu lists only real countries: a pre-counted country
// row is kept only when its name is one of the canonical country names or
// exactly 'Worldwide'. Stored values such as provider display text ("UK",
// "London, UK", "Artington, Guildford") never reach the menu.

const NOW = new Date('2026-11-15T20:00:00Z').getTime()
const row = (name: string, value: number, updatedAt = NOW - 4 * 60_000) =>
  ({ key: `jobs_browsable:ab:country:${name}`, value, updatedAt })

describe('country menu guard (countryListFromPrecounts)', () => {
  it('keeps every canonical country name', () => {
    const rows = COUNTRY_CANONICAL_NAMES.map(name => row(name, 1))
    const kept = countryListFromPrecounts(rows, 'ab', NOW).map(c => c.country)
    expect(kept).toHaveLength(COUNTRY_CANONICAL_NAMES.length)
    expect(new Set(kept)).toEqual(new Set(COUNTRY_CANONICAL_NAMES))
  })

  it("keeps exactly 'Worldwide'", () => {
    expect(countryListFromPrecounts([row('Worldwide', 3)], 'ab', NOW))
      .toEqual([{ country: 'Worldwide', count: 3 }])
  })

  it('drops names that are not real countries', () => {
    const rows = [
      row('United Kingdom', 10),
      row('UK', 12),
      row('London, UK', 7),
      row('Artington, Guildford', 1),
      row('LATAM', 2),
      row('', 5),
      row('x'.repeat(201), 4),
      row('worldwide', 6),
      row('united kingdom', 8),
    ]
    expect(countryListFromPrecounts(rows, 'ab', NOW)).toEqual([{ country: 'United Kingdom', count: 10 }])
  })

  it('keeps the order rule: count descending, then name ascending', () => {
    const rows = [
      row('Canada', 10),
      row('UK', 99),
      row('Zambia', 50),
      row('Australia', 10),
      row('Worldwide', 10),
      row('Mexico', 1),
    ]
    expect(countryListFromPrecounts(rows, 'ab', NOW).map(c => c.country))
      .toEqual(['Zambia', 'Australia', 'Canada', 'Worldwide', 'Mexico'])
  })

  it('keeps the 6-hour freshness rule for real countries', () => {
    const rows = [
      row('Kenya', 3, NOW - PRECOUNT_MAX_AGE_MS),
      row('Ghana', 9, NOW - PRECOUNT_MAX_AGE_MS - 1),
    ]
    expect(countryListFromPrecounts(rows, 'ab', NOW)).toEqual([{ country: 'Kenya', count: 3 }])
  })
})
