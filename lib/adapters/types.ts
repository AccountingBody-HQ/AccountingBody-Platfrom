import type { JobProvider } from '../providers'

/**
 * Raw job object from a provider API.
 * Provider-native field names and unknown shape — never modified by adapters.
 */
export type RawJob = Record<string, unknown>

/**
 * Result returned by every adapter's fetch() method.
 * jobs: the raw jobs fetched
 * pagesFetched: how many API pages were retrieved (1 for non-paginated providers)
 * totalAvailable: total jobs the provider reports (if the API exposes this), null otherwise
 */
export interface AdapterResult {
  jobs: RawJob[]
  pagesFetched: number
  totalAvailable: number | null
  nextCursor?: number
  /** Per-item failures an adapter would otherwise swallow (e.g. one keyword's
   *  fetch failing inside a fan-out) — optional, existing callers ignore it. */
  errors?: string[]
}

/**
 * Options for a bounded, non-mutating preview fetch. Entirely optional —
 * an adapter that ignores this parameter still satisfies the interface.
 */
export interface PreviewFetchOptions {
  maxKeywords?: number
  maxPages?: number
  keyword?: string
}

/**
 * Every adapter must implement this interface.
 * The adapter's ONLY job: fetch raw data and return it unchanged.
 * Zero normalisation. Zero field mapping. Zero business logic.
 */
export interface ProviderAdapter {
  fetch(provider: JobProvider, opts?: PreviewFetchOptions): Promise<AdapterResult>
}
