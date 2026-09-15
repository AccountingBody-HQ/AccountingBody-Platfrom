// Pure job-location formatting logic, shared by the client-rendered
// listings card (JobListingsClient.tsx) and the server-rendered detail
// page (app/jobs/[slug]/page.tsx) — same split as countryOptions.ts and
// components/pagination.ts, for the same reason: it needs to be
// unit-testable without React, and the two surfaces must never drift into
// showing a different location string for the same job.
//
// Every rule below was seeded from a live sample of ~100 rows per country
// (South Africa, Canada, Australia, Singapore, the US, and the UK) pulled
// from /api/jobs/direct — see tmp-audit/session16-jobs-card-polish.md for
// the full measurement. Nothing here is speculative: every mapping and
// every pattern exists because it was observed, and the several real
// counter-examples that measurement also turned up (Toronto, Vancouver,
// Montréal, Chicago, Manhattan, Newcastle Upon Tyne, Nottingham — all real,
// distinct cities that happen to sit in the "second segment" position for
// some other row) are exactly why this does NOT do a blanket "drop
// everything after the first comma."

// Abbreviation -> full name, observed directly in location_text (never
// speculated): 'UK'/'US'/'USA' all occur paired with their real country.
// Compared case-insensitively. When location_text resolves via this map to
// the same country as location_country, the country is shown alone.
export const LOCATION_ABBREVIATIONS: Record<string, string> = {
  uk: 'United Kingdom',
  us: 'United States',
  usa: 'United States',
}

// Province / metro-municipality names observed as the comma-separated
// SECOND segment of location_text for South Africa and Canada, with no
// generic suffix word to catch them structurally. Unlike a city name
// (Toronto, Vancouver, Montréal, Newcastle Upon Tyne — all deliberately
// left untouched, since dropping those would hide the one place a job
// seeker would recognise), none of these carries a distinct identity a job
// seeker would search for on its own — South Africa's provinces/metros are
// administrative context once the country is already shown, same as
// Canada's provinces. This list is closed and observed-only; it is not
// meant to (and does not attempt to) cover every country's administrative
// divisions — see the report for the UK counties this deliberately does
// NOT touch, because English county names have no structural marker to
// distinguish them from a real town name (e.g. "Nottingham" and "Dorset"
// have the same shape) and no small observed list would be reliable there.
const KNOWN_NON_LOCALITY_REGIONS = new Set([
  'gauteng', 'kwazulu-natal', 'western cape', 'eastern cape',
  'tshwane', 'ekurhuleni', 'ethekwini',
  'ontario', 'québec', 'quebec', 'alberta', 'british columbia', 'saskatchewan',
])

// Generic administrative-unit suffixes — a structural pattern, not a name
// list, so it generalises safely: across ~300 real US/Canada/Australia
// rows checked, every second-segment value ending in one of these words
// was an administrative division, and every real distinct city in the same
// samples (Chicago, Manhattan, New York, Toronto, Vancouver, Sydney,
// Melbourne, Brisbane...) had none of these endings.
const DROPPABLE_SUFFIX = /\b(county|region|area|territory)$/i

function isDroppableSegment(segment: string, country: string): boolean {
  const segmentLower = segment.toLowerCase()
  const countryLower = country.toLowerCase()
  if (segmentLower === countryLower) return true
  const resolved = LOCATION_ABBREVIATIONS[segmentLower]
  if (resolved && resolved.toLowerCase() === countryLower) return true
  if (DROPPABLE_SUFFIX.test(segment)) return true
  return KNOWN_NON_LOCALITY_REGIONS.has(segmentLower)
}

// Formats a job's location for display. Priority, matching what real data
// actually needs (see the report for the measurement behind each branch):
//   1. No country at all -> the raw text, unchanged.
//   2. No text at all -> the country alone.
//   3. Text already equals the country ('Singapore' + 'Singapore') -> as-is.
//   4. Text is a bare abbreviation of the country ('UK' + 'United Kingdom')
//      -> the country alone.
//   5. Text is "Central, <country>" -> the country alone. Observed 5x in a
//      100-row Singapore sample: 'Central' is one of Singapore's own five
//      planning regions, not a locality with any identity outside the
//      country — unlike a real first segment, which is kept (see 6).
//   6. Text is "<place>, <droppable segment>" (an abbreviation of the
//      country, a county/region/area/territory suffix, or a known
//      non-locality province/metro) -> "<place> · <country>".
//   7. Text already contains the country some other way (kept from the
//      original guard shipped in 2eecf05) -> the raw text, unchanged.
//   8. Otherwise -> "<text> · <country>".
export function formatJobLocation(
  locationText: string | null | undefined,
  locationCountry: string | null | undefined,
): string {
  const text = (locationText ?? '').trim()
  const country = (locationCountry ?? '').trim()
  if (!country) return text
  if (!text) return country
  if (text.toLowerCase() === country.toLowerCase()) return text

  const wholeResolved = LOCATION_ABBREVIATIONS[text.toLowerCase()]
  if (wholeResolved && wholeResolved.toLowerCase() === country.toLowerCase()) return country

  const commaIndex = text.indexOf(',')
  if (commaIndex !== -1) {
    const first = text.slice(0, commaIndex).trim()
    const rest = text.slice(commaIndex + 1).trim()

    if (
      country.toLowerCase() === 'singapore' &&
      first.toLowerCase() === 'central' &&
      rest.toLowerCase() === country.toLowerCase()
    ) {
      return country
    }

    if (isDroppableSegment(rest, country)) {
      if (!first || first.toLowerCase() === country.toLowerCase()) return country
      if (first.toLowerCase().includes(country.toLowerCase())) return first
      return `${first} · ${country}`
    }
  }

  if (text.toLowerCase().includes(country.toLowerCase())) return text

  return `${text} · ${country}`
}
