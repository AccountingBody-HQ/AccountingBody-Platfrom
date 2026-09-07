import type { ProviderAdapter, RawJob } from './types'
import type { JobProvider } from '../providers'

export const adzunaAdapter: ProviderAdapter = {
  async fetch(provider: JobProvider): Promise<RawJob[]> {
    const appId  = process.env.ADZUNA_APP_ID
    const appKey = process.env.ADZUNA_APP_KEY

    if (!appId || !appKey) {
      throw new Error('ADZUNA_APP_ID or ADZUNA_APP_KEY not set')
    }

    const keywords = provider.keywords ?? [
      'accountant', 'ACCA', 'finance manager', 'audit',
      'tax accountant', 'management accountant', 'CIMA',
    ]
    const baseUrl = provider.base_url
    if (!baseUrl) throw new Error(`No base_url configured for provider ${provider.slug}`)

    const allJobs: RawJob[] = []
    const errors: string[] = []

    // Fetch one page per keyword (same pattern as existing cron)
    await Promise.allSettled(
      keywords.map(async (keyword) => {
        try {
          const url = new URL(baseUrl)
          url.searchParams.set('app_id', appId)
          url.searchParams.set('app_key', appKey)
          url.searchParams.set('results_per_page', '50')
          url.searchParams.set('what', keyword)
          url.searchParams.set('content-type', 'application/json')

          const res = await fetch(url.toString(), {
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(15000),
          })

          if (!res.ok) {
            errors.push(`Adzuna ${provider.slug} keyword "${keyword}": HTTP ${res.status}`)
            return
          }

          const data = await res.json() as { results?: RawJob[] }
          const results = data.results ?? []
          allJobs.push(...results)

        } catch (err) {
          errors.push(`Adzuna ${provider.slug} keyword "${keyword}": ${String(err)}`)
        }
      })
    )

    if (errors.length > 0) {
      console.warn(`[adzuna-adapter] ${provider.slug} partial errors:`, errors)
    }

    return allJobs
  }
}
