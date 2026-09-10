import type { ProviderAdapter, RawJob, AdapterResult, PreviewFetchOptions } from './types'
import type { JobProvider } from '../providers'
import { fetchWithRetry } from './fetch-with-retry'
import { ADZUNA_QUERY_KEYWORDS } from '@/lib/ingestion/keywords'

// Keywords processed per run. Sized so a run finishes well inside
// Vercel's 300s maxDuration at Adzuna's observed ~8s response time.
const KEYWORDS_PER_RUN = 12

/**
 * Fetch every page for a single keyword.
 *
 * Mirrors generic-rest's fetchAllPages:
 *   - A transport-level failure (DNS failure, connection refused/reset,
 *     request timeout) is raised by fetchWithRetry after it exhausts its
 *     retries and propagates straight out of here — never caught.
 *   - A non-200 status on the FIRST page throws.
 *   - A non-200 status (or transport error) on a LATER page is partial
 *     success: stop and return what was collected so far.
 *   - HTTP 200 with an empty results array is a legitimate end-of-results,
 *     not an error — it returns { jobs: [], pagesFetched: 1 }.
 *
 * The caller decides whether a throw from here is fatal (first keyword of the
 * run) or merely collected into AdapterResult.errors (keywords 2..N).
 */
async function fetchKeyword(
  baseUrl: string,
  appId: string,
  appKey: string,
  keyword: string,
  maxPages: number,
  providerSlug: string,
): Promise<{ jobs: RawJob[]; pagesFetched: number }> {
  const jobs: RawJob[] = []
  let pagesFetched = 0
  let page = 1

  while (page <= maxPages) {
    const url = new URL(baseUrl + '/' + String(page))
    url.searchParams.set('app_id', appId)
    url.searchParams.set('app_key', appKey)
    url.searchParams.set('results_per_page', '50')
    url.searchParams.set('what', keyword)
    url.searchParams.set('content-type', 'application/json')

    // fetchWithRetry throws on a transport-level failure once its retries
    // are spent — that exception is deliberately NOT caught here.
    const res = await fetchWithRetry(
      url.toString(),
      { headers: { 'Content-Type': 'application/json' } },
      3,
      1000,
    )

    if (!res.ok) {
      if (page === 1) {
        throw new Error(
          `Adzuna ${providerSlug} keyword "${keyword}" page 1: HTTP ${res.status}`,
        )
      }
      break // later page — partial success, keep what we already have
    }

    const data = await res.json() as { results?: RawJob[]; count?: number }
    const results = data.results ?? []
    pagesFetched++

    if (results.length === 0) break // genuine end of results for this keyword

    jobs.push(...results)

    // Fewer than a full page means there are no more pages
    if (results.length < 50) break

    page++
  }

  return { jobs, pagesFetched }
}

export const adzunaAdapter: ProviderAdapter = {
  async fetch(provider: JobProvider, opts?: PreviewFetchOptions): Promise<AdapterResult> {
    const appId  = process.env.ADZUNA_APP_ID
    const appKey = process.env.ADZUNA_APP_KEY

    if (!appId || !appKey) {
      throw new Error('ADZUNA_APP_ID or ADZUNA_APP_KEY not set')
    }

    const baseUrl = provider.base_url
    if (!baseUrl) throw new Error(`No base_url configured for provider ${provider.slug}`)

    const cursor = provider.keyword_cursor ?? 0
    const total = ADZUNA_QUERY_KEYWORDS.length
    const start = ((cursor % total) + total) % total

    let keywords: string[]
    if (opts?.keyword) {
      keywords = [opts.keyword]
    } else {
      const count = Math.min(opts?.maxKeywords ?? KEYWORDS_PER_RUN, total)
      keywords = []
      for (let i = 0; i < count; i++) {
        keywords.push(ADZUNA_QUERY_KEYWORDS[(start + i) % total])
      }
    }

    // A preview call (opts present) must never advance or persist the
    // cursor — only the real production path (no opts) computes one.
    const nextCursor = opts ? undefined : (start + keywords.length) % total

    const maxPages = opts?.maxPages ?? provider.max_pages_per_run ?? 1

    // Defensive: nothing to fetch (e.g. a preview call with maxKeywords: 0).
    // Preserves the pre-existing empty-result behaviour for this edge.
    if (keywords.length === 0) {
      return { jobs: [], pagesFetched: 0, totalAvailable: null, nextCursor }
    }

    const allJobs: RawJob[] = []
    const errors: string[] = []
    let totalPagesFetched = 0

    // The first keyword is the run's canary. If its first request can't be
    // completed at all — a transport failure or a non-200 status — that is
    // the endpoint being unreachable/broken, NOT a legitimately empty run,
    // so the error is allowed to propagate. The ingest route's catch block
    // then records the run as FAILED and increments consecutive_failures
    // (Rule 120: an adapter must never swallow a network/transport error).
    const [firstKeyword, ...restKeywords] = keywords

    const firstResult = await fetchKeyword(
      baseUrl, appId, appKey, firstKeyword, maxPages, provider.slug,
    )
    allJobs.push(...firstResult.jobs)
    totalPagesFetched += firstResult.pagesFetched

    // The first request already proved the endpoint reachable. From here a
    // single keyword failing must NOT kill an otherwise-working run — its
    // failure is collected into AdapterResult.errors instead of thrown,
    // mirroring generic-rest's keyword fan-out.
    await Promise.allSettled(
      restKeywords.map(async (keyword) => {
        try {
          const r = await fetchKeyword(
            baseUrl, appId, appKey, keyword, maxPages, provider.slug,
          )
          allJobs.push(...r.jobs)
          totalPagesFetched += r.pagesFetched
        } catch (err: unknown) {
          errors.push(
            `Adzuna ${provider.slug} keyword "${keyword}": ${err instanceof Error ? err.message : String(err)}`,
          )
        }
      }),
    )

    if (errors.length > 0) {
      console.warn(`[adzuna-adapter] ${provider.slug} partial errors:`, errors)
    }

    return {
      jobs: allJobs,
      pagesFetched: totalPagesFetched,
      totalAvailable: null,
      nextCursor,
      ...(errors.length > 0 ? { errors } : {}),
    }
  },
}
