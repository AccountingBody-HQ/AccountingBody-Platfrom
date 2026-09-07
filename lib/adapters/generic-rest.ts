import type { ProviderAdapter, RawJob } from './types'
import type { JobProvider } from '../providers'

function resolveAuth(
  authType: string,
  authConfig: Record<string, unknown>,
  url: URL,
  headers: Record<string, string>
): void {
  if (authType === 'none') return

  if (authType === 'api_key_query') {
    const paramName = authConfig.param_name as string
    const envVar    = authConfig.env_var as string
    const value     = process.env[envVar]
    if (paramName && value) url.searchParams.set(paramName, value)
    return
  }

  if (authType === 'api_key_header') {
    const headerName = authConfig.header_name as string
    const envVar     = authConfig.env_var as string
    const value      = process.env[envVar]
    if (headerName && value) headers[headerName] = value
    return
  }

  if (authType === 'bearer') {
    const envVar = authConfig.env_var as string
    const value  = process.env[envVar]
    if (value) headers['Authorization'] = `Bearer ${value}`
    return
  }
}

function extractJobsArray(data: unknown, responsePath: string | null): RawJob[] {
  if (!responsePath || responsePath === '') {
    if (Array.isArray(data)) return data as RawJob[]
    return []
  }
  const parts = responsePath.split('.')
  let current: unknown = data
  for (const part of parts) {
    if (current === null || current === undefined) return []
    current = (current as Record<string, unknown>)[part]
  }
  return Array.isArray(current) ? current as RawJob[] : []
}

export const genericRestAdapter: ProviderAdapter = {
  async fetch(provider: JobProvider): Promise<RawJob[]> {
    const baseUrl = provider.base_url
    if (!baseUrl) throw new Error(`No base_url configured for provider ${provider.slug}`)

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const url = new URL(baseUrl)

    // Apply static query params from request_config
    const requestConfig = provider.request_config ?? {}
    for (const [key, val] of Object.entries(requestConfig)) {
      if (typeof val === 'string' || typeof val === 'number') {
        url.searchParams.set(key, String(val))
      }
    }

    // Apply auth
    resolveAuth(provider.auth_type, provider.auth_config, url, headers)

    // Apply keyword filter if keywords are configured and request_config has a keyword param
    const keywordParam = requestConfig.keyword_param as string | undefined
    const keywords = provider.keywords ?? []

    if (keywordParam && keywords.length > 0) {
      // Fetch once per keyword (same pattern as Adzuna)
      const allJobs: RawJob[] = []
      await Promise.allSettled(
        keywords.map(async (keyword) => {
          try {
            const kwUrl = new URL(url.toString())
            kwUrl.searchParams.set(keywordParam, keyword)
            const res = await fetch(kwUrl.toString(), {
              headers,
              signal: AbortSignal.timeout(15000),
            })
            if (!res.ok) return
            const data = await res.json()
            const jobs = extractJobsArray(data, provider.response_path)
            allJobs.push(...jobs)
          } catch {
            // individual keyword failure — continue
          }
        })
      )
      return allJobs
    }

    // Single fetch (no keyword iteration)
    const res = await fetch(url.toString(), {
      headers,
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${provider.slug}`)
    }

    const data = await res.json()
    return extractJobsArray(data, provider.response_path)
  }
}
