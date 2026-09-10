import type { ProviderAdapter, RawJob, AdapterResult, PreviewFetchOptions } from './types'
import type { JobProvider } from '../providers'
import { fetchWithRetry } from './fetch-with-retry'

function resolveAuth(
  authType: string,
  authConfig: Record<string, unknown>,
  url: URL,
  headers: Record<string, string>
): void {
  if (authType === 'none') return

  if (authType === 'api_key' || authType === 'api_key_query') {
    const paramName = (authConfig.param_name as string | undefined) ?? 'api_key'
    const envVar    = authConfig.env_var as string | undefined
    const value     = envVar ? process.env[envVar] : undefined
    if (paramName && value) url.searchParams.set(paramName, value)
    return
  }

  if (authType === 'api_key_header') {
    const headerName = authConfig.header_name as string | undefined
    const envVar     = authConfig.env_var as string | undefined
    const value      = envVar ? process.env[envVar] : undefined
    if (headerName && value) headers[headerName] = value
    return
  }

  if (authType === 'bearer') {
    const envVar = authConfig.env_var as string | undefined
    const value  = envVar ? process.env[envVar] : undefined
    if (value) headers['Authorization'] = `Bearer ${value}`
    return
  }

  if (authType === 'basic') {
    const envVar = authConfig.env_var as string | undefined
    const value  = envVar ? process.env[envVar] : undefined
    if (value) headers['Authorization'] = `Basic ${Buffer.from(value).toString('base64')}`
    return
  }
}

function extractJobsArray(data: unknown, responsePath: string | null): RawJob[] {
  if (!responsePath || responsePath.trim() === '') {
    return Array.isArray(data) ? (data as RawJob[]) : []
  }
  const parts = responsePath.split('.')
  let current: unknown = data
  for (const part of parts) {
    if (current === null || current === undefined) return []
    if (typeof current !== 'object') return []
    current = (current as Record<string, unknown>)[part]
  }
  return Array.isArray(current) ? (current as RawJob[]) : []
}

function extractNextCursor(data: Record<string, unknown>): string | null {
  // Try common cursor field names used by various APIs
  const candidates = [
    data.next_cursor, data.nextCursor, data.cursor, data.next_page_token,
    data.nextPageToken, data.continuation_token,
    (data.meta as Record<string, unknown> | undefined)?.next_cursor,
    (data.meta as Record<string, unknown> | undefined)?.cursor,
    (data.pagination as Record<string, unknown> | undefined)?.cursor,
    (data.links as Record<string, unknown> | undefined)?.next,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c
  }
  return null
}

async function fetchAllPages(
  baseUrl: URL,
  headers: Record<string, string>,
  responsePath: string | null,
  paginationStyle: string,
  maxPages: number
): Promise<{ jobs: RawJob[]; pagesFetched: number; totalAvailable: number | null }> {
  const allJobs: RawJob[] = []
  let pagesFetched = 0
  let totalAvailable: number | null = null
  let currentPage = 1
  let currentOffset = 0
  let nextCursor: string | null = null

  while (currentPage <= maxPages) {
    const pageUrl = new URL(baseUrl.toString())

    if (paginationStyle === 'page' && currentPage > 1) {
      pageUrl.searchParams.set('page', String(currentPage))
    } else if (paginationStyle === 'offset' && currentOffset > 0) {
      pageUrl.searchParams.set('offset', String(currentOffset))
    } else if (paginationStyle === 'cursor' && nextCursor) {
      pageUrl.searchParams.set('cursor', nextCursor)
    }

    const res = await fetchWithRetry(
      pageUrl.toString(),
      { headers },
      3,
      1000
    )

    if (!res.ok) {
      if (currentPage === 1) throw new Error(`HTTP ${res.status} on first page`)
      break // Partial success — stop, return what we have
    }

    const data = await res.json() as Record<string, unknown>
    const pageJobs = extractJobsArray(data, responsePath)
    pagesFetched++

    // Try to get total available count from common field names
    if (totalAvailable === null) {
      const countCandidates = [
        data.total, data.total_results, data.totalResults, data.count,
        data.total_count, data.totalCount,
        (data.meta as Record<string, unknown> | undefined)?.total,
      ]
      for (const c of countCandidates) {
        if (typeof c === 'number') { totalAvailable = c; break }
      }
    }

    if (pageJobs.length === 0) break // No more results

    allJobs.push(...pageJobs)

    // Advance pagination state
    if (paginationStyle === 'page') {
      currentPage++
    } else if (paginationStyle === 'offset') {
      currentOffset += pageJobs.length
      currentPage++
    } else if (paginationStyle === 'cursor') {
      nextCursor = extractNextCursor(data)
      if (!nextCursor) break
      currentPage++
    } else {
      break // 'none' — single page only
    }
  }

  return { jobs: allJobs, pagesFetched, totalAvailable }
}

export const genericRestAdapter: ProviderAdapter = {
  async fetch(provider: JobProvider, opts?: PreviewFetchOptions): Promise<AdapterResult> {
    const baseUrl = provider.base_url
    if (!baseUrl) throw new Error(`No base_url configured for provider ${provider.slug}`)

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'AccountingBody/1.0',
    }
    const url = new URL(baseUrl)

    // Apply static query params from request_config
    const requestConfig = (provider.request_config ?? {}) as Record<string, unknown>
    for (const [key, val] of Object.entries(requestConfig)) {
      if (key === 'keyword_param') continue // handled separately
      if (typeof val === 'string' || typeof val === 'number') {
        url.searchParams.set(key, String(val))
      }
    }

    // Apply auth
    resolveAuth(
      provider.auth_type ?? 'none',
      (provider.auth_config ?? {}) as Record<string, unknown>,
      url,
      headers
    )

    const maxPages = opts?.maxPages ?? provider.max_pages_per_run ?? 1
    const paginationStyle = provider.pagination_style ?? 'none'

    // Keyword iteration — if keywords configured and keyword_param specified.
    // opts.keyword overrides the provider's configured keyword list with a
    // single keyword (used by the preview endpoint instead of the fan-out).
    const keywordParam = requestConfig.keyword_param as string | undefined
    const keywords = opts?.keyword
      ? [opts.keyword]
      : (Array.isArray(provider.keywords) ? provider.keywords : [])

    if (keywordParam && keywords.length > 0) {
      const allJobs: RawJob[] = []
      let totalPagesFetched = 0
      // Collected rather than discarded so a caller (the preview endpoint)
      // can see which keywords failed — production behaviour (jobs
      // returned, pages fetched) is unchanged; this only adds visibility.
      const errors: string[] = []

      await Promise.allSettled(
        keywords.map(async (keyword) => {
          const kwUrl = new URL(url.toString())
          kwUrl.searchParams.set(keywordParam, keyword)
          try {
            const result = await fetchAllPages(
              kwUrl, headers, provider.response_path, paginationStyle, maxPages
            )
            allJobs.push(...result.jobs)
            totalPagesFetched += result.pagesFetched
          } catch (err: unknown) {
            // Individual keyword failure — continue with other keywords
            errors.push(
              `generic-rest ${provider.slug} keyword "${keyword}": ${err instanceof Error ? err.message : String(err)}`
            )
          }
        })
      )

      return {
        jobs: allJobs,
        pagesFetched: totalPagesFetched,
        totalAvailable: null,
        ...(errors.length > 0 ? { errors } : {}),
      }
    }

    // Single fetch with pagination
    const result = await fetchAllPages(
      url, headers, provider.response_path, paginationStyle, maxPages
    )
    return result
  }
}
