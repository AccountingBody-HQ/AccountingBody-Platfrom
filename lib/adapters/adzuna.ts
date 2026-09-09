import type { ProviderAdapter, RawJob, AdapterResult } from './types'
import type { JobProvider } from '../providers'
import { fetchWithRetry } from './fetch-with-retry'
import { PROVIDER_QUERY_KEYWORDS } from '@/lib/ingestion/keywords'

export const adzunaAdapter: ProviderAdapter = {
  async fetch(provider: JobProvider): Promise<AdapterResult> {
    const appId  = process.env.ADZUNA_APP_ID
    const appKey = process.env.ADZUNA_APP_KEY

    if (!appId || !appKey) {
      throw new Error('ADZUNA_APP_ID or ADZUNA_APP_KEY not set')
    }

    const baseUrl = provider.base_url
    if (!baseUrl) throw new Error(`No base_url configured for provider ${provider.slug}`)

    const keywords: string[] = PROVIDER_QUERY_KEYWORDS

    const maxPages = provider.max_pages_per_run ?? 1
    const allJobs: RawJob[] = []
    const errors: string[] = []
    let totalPagesFetched = 0

    await Promise.allSettled(
      keywords.map(async (keyword) => {
        let page = 1
        while (page <= maxPages) {
          try {
            const url = new URL(baseUrl)
            url.searchParams.set('app_id', appId)
            url.searchParams.set('app_key', appKey)
            url.searchParams.set('results_per_page', '50')
            url.searchParams.set('what', keyword)
            url.searchParams.set('page', String(page))
            url.searchParams.set('content-type', 'application/json')

            const res = await fetchWithRetry(
              url.toString(),
              { headers: { 'Content-Type': 'application/json' } },
              3,
              1000
            )

            if (!res.ok) {
              errors.push(`Adzuna ${provider.slug} keyword "${keyword}" page ${page}: HTTP ${res.status}`)
              break
            }

            const data = await res.json() as { results?: RawJob[]; count?: number }
            const results = data.results ?? []
            totalPagesFetched++

            if (results.length === 0) break // No more results for this keyword

            allJobs.push(...results)

            // If we got fewer than 50, there are no more pages
            if (results.length < 50) break

            page++
          } catch (err: unknown) {
            errors.push(`Adzuna ${provider.slug} keyword "${keyword}" page ${page}: ${String(err)}`)
            break
          }
        }
      })
    )

    if (errors.length > 0) {
      console.warn(`[adzuna-adapter] ${provider.slug} partial errors:`, errors)
    }

    return {
      jobs: allJobs,
      pagesFetched: totalPagesFetched,
      totalAvailable: null,
    }
  }
}
