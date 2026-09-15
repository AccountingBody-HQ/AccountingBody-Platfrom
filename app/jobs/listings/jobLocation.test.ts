import { describe, expect, it } from 'vitest'
import { formatJobLocation, LOCATION_ABBREVIATIONS } from './jobLocation'

describe('formatJobLocation', () => {
  // ── base cases ──────────────────────────────────────────────────────
  it('returns the country alone when location_text is null/empty', () => {
    expect(formatJobLocation(null, 'South Africa')).toBe('South Africa')
    expect(formatJobLocation('', 'South Africa')).toBe('South Africa')
    expect(formatJobLocation(undefined, 'South Africa')).toBe('South Africa')
  })

  it('returns location_text unchanged when location_country is null/empty', () => {
    expect(formatJobLocation('Spital Tongues, Newcastle Upon Tyne', null)).toBe('Spital Tongues, Newcastle Upon Tyne')
    expect(formatJobLocation('Johannesburg, Gauteng', undefined)).toBe('Johannesburg, Gauteng')
    expect(formatJobLocation('Johannesburg, Gauteng', '')).toBe('Johannesburg, Gauteng')
  })

  it('returns the text as-is when it already equals the country', () => {
    expect(formatJobLocation('Singapore', 'Singapore')).toBe('Singapore')
    expect(formatJobLocation('South Africa', 'South Africa')).toBe('South Africa')
    expect(formatJobLocation('Canada', 'Canada')).toBe('Canada')
  })

  // ── DEFECT A: abbreviation equivalence — one test per observed pair ──
  it('resolves every abbreviation in LOCATION_ABBREVIATIONS to the country alone', () => {
    for (const [abbrev, full] of Object.entries(LOCATION_ABBREVIATIONS)) {
      expect(formatJobLocation(abbrev.toUpperCase(), full)).toBe(full)
    }
  })

  it("'UK' + 'United Kingdom' -> 'United Kingdom'", () => {
    expect(formatJobLocation('UK', 'United Kingdom')).toBe('United Kingdom')
  })

  it("'US' + 'United States' -> 'United States'", () => {
    expect(formatJobLocation('US', 'United States')).toBe('United States')
  })

  it("'USA' + 'United States' -> 'United States' (observed in the sort_by=recent sample)", () => {
    expect(formatJobLocation('USA', 'United States')).toBe('United States')
  })

  it("'London, UK' + 'United Kingdom' -> 'London · United Kingdom'", () => {
    expect(formatJobLocation('London, UK', 'United Kingdom')).toBe('London · United Kingdom')
  })

  // ── DEFECT B: region stripping — county/region/area/territory suffixes ──
  it("'Johannesburg, Gauteng' + 'South Africa' -> 'Johannesburg · South Africa'", () => {
    expect(formatJobLocation('Johannesburg, Gauteng', 'South Africa')).toBe('Johannesburg · South Africa')
  })

  it("'Pretoria, Tshwane' + 'South Africa' -> 'Pretoria · South Africa'", () => {
    expect(formatJobLocation('Pretoria, Tshwane', 'South Africa')).toBe('Pretoria · South Africa')
  })

  it("'eThekwini, KwaZulu-Natal' + 'South Africa' -> 'eThekwini · South Africa'", () => {
    expect(formatJobLocation('eThekwini, KwaZulu-Natal', 'South Africa')).toBe('eThekwini · South Africa')
  })

  it("'Golf, Palm Beach County' + 'United States' -> 'Golf · United States' (county suffix)", () => {
    expect(formatJobLocation('Golf, Palm Beach County', 'United States')).toBe('Golf · United States')
  })

  it("'Edmonton, Edmonton region' + 'Canada' -> 'Edmonton · Canada' (region suffix)", () => {
    expect(formatJobLocation('Edmonton, Edmonton region', 'Canada')).toBe('Edmonton · Canada')
  })

  it("'Sydney, Sydney Region' + 'Australia' -> 'Sydney · Australia' (Region suffix, capitalised)", () => {
    expect(formatJobLocation('Sydney, Sydney Region', 'Australia')).toBe('Sydney · Australia')
  })

  it("'Frankston, Frankston Area' + 'Australia' -> 'Frankston · Australia' (Area suffix)", () => {
    expect(formatJobLocation('Frankston, Frankston Area', 'Australia')).toBe('Frankston · Australia')
  })

  it("'Canberra Region, Australian Capital Territory' + 'Australia' -> 'Canberra Region · Australia' (Territory suffix)", () => {
    expect(formatJobLocation('Canberra Region, Australian Capital Territory', 'Australia')).toBe('Canberra Region · Australia')
  })

  it("'Toronto, Ontario' + 'Canada' -> 'Toronto · Canada' (known bare province, no suffix word)", () => {
    expect(formatJobLocation('Toronto, Ontario', 'Canada')).toBe('Toronto · Canada')
  })

  it("'Montréal, Québec' + 'Canada' -> 'Montréal · Canada' (known bare province, accented)", () => {
    expect(formatJobLocation('Montréal, Québec', 'Canada')).toBe('Montréal · Canada')
  })

  // ── the existing containment guard from 2eecf05, still must win where it applies ──
  it("'Central, Singapore' + 'Singapore' -> 'Singapore' (Singapore's own planning region, not a locality)", () => {
    expect(formatJobLocation('Central, Singapore', 'Singapore')).toBe('Singapore')
  })

  it("'Gauteng, South Africa' + 'South Africa' -> 'Gauteng · South Africa' (country already named as the second segment)", () => {
    expect(formatJobLocation('Gauteng, South Africa', 'South Africa')).toBe('Gauteng · South Africa')
  })

  it("'Queensland, Australia' + 'Australia' -> 'Queensland · Australia'", () => {
    expect(formatJobLocation('Queensland, Australia', 'Australia')).toBe('Queensland · Australia')
  })

  // ── real counter-examples this fix deliberately leaves UNCHANGED ──
  // (measured live — see the report — these are genuine, distinct,
  // recognisable localities, not administrative noise, so stripping them
  // would remove real information rather than clean up redundancy)
  it('leaves a real city name in the second segment unchanged (Toronto)', () => {
    expect(formatJobLocation('North York, Toronto', 'Canada')).toBe('North York, Toronto · Canada')
  })

  it('leaves a real city name in the second segment unchanged (Vancouver)', () => {
    expect(formatJobLocation('Yaletown, Vancouver', 'Canada')).toBe('Yaletown, Vancouver · Canada')
  })

  it('leaves a real city name in the second segment unchanged (Montréal)', () => {
    expect(formatJobLocation('Anjou, Montréal', 'Canada')).toBe('Anjou, Montréal · Canada')
  })

  it('leaves a real city name in the second segment unchanged (Chicago, no county suffix)', () => {
    expect(formatJobLocation('Avondale, Chicago', 'United States')).toBe('Avondale, Chicago · United States')
  })

  it("leaves the brief's own DEFECT B example unchanged — Newcastle Upon Tyne is a real, distinct city, not a region", () => {
    expect(formatJobLocation('Spital Tongues, Newcastle Upon Tyne', 'United Kingdom')).toBe(
      'Spital Tongues, Newcastle Upon Tyne · United Kingdom',
    )
  })

  it('leaves a real UK city in the second segment unchanged (Nottingham — no structural signal distinguishes it from a county)', () => {
    expect(formatJobLocation('Some Area, Nottingham', 'United Kingdom')).toBe('Some Area, Nottingham · United Kingdom')
  })

  it("does not collapse 'Central, <country>' to the country alone for any country other than Singapore — falls through to the generic rest-equals-country rule instead ('Central · South Africa', not 'South Africa')", () => {
    expect(formatJobLocation('Central, South Africa', 'South Africa')).toBe('Central · South Africa')
  })

  it('leaves a Singapore sub-area unchanged when it is not literally "Central, Singapore"', () => {
    expect(formatJobLocation('River Valley, Central', 'Singapore')).toBe('River Valley, Central · Singapore')
  })
})
