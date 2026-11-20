import { NextRequest, NextResponse } from 'next/server'
import { getJobSitemapChunk } from '@/lib/jobs'
import { jobCanonicalOwner } from '@/lib/canonical'
import { parseJobChunkFile, buildUrlset } from '@/lib/sitemap-chunks'

const AB_BASE_URL = 'https://accountingbody.com'

export const dynamic = 'force-dynamic'
// force-dynamic alone does NOT stop Next 14.2 caching fetch() calls in route
// handlers (Data Cache, up to 1 year, survives deploys). This froze the sitemap
// at 13 Sept 2026. Do not remove. See Session 15 handover.
export const fetchCache = 'force-no-store'

// Same <loc>/<lastmod>/changefreq/priority shape as the job entries in the
// old app/sitemap.ts, just scoped to one uuid leading-byte bucket
// (lib/sitemap-chunks.ts) instead of the whole table — see
// getJobSitemapChunk (lib/jobs.ts) for the query and lifecycle filtering.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params
  const bucket = parseJobChunkFile(file)
  if (bucket === null) {
    return new NextResponse('Not Found', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const result = await getJobSitemapChunk('ab', bucket)
  if (!result.ok) {
    // Mirrors getJobSitemapChunk's own "no partial results" contract: a
    // failed page must not be served as if it were a short, complete file.
    return new NextResponse('Internal Server Error', {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  // Only jobs whose one owner is accountingbody.com (owner rule D272; the
  // job page's own rule), so a job is never listed by both domains.
  const xml = buildUrlset(
    result.entries.filter(job => jobCanonicalOwner(job) === 'accountingbody').map(job => ({
      url:             `${AB_BASE_URL}/jobs/${job.slug}`,
      lastModified:    job.lastModified,
      changeFrequency: 'daily' as const,
      priority:        0.7,
    }))
  )

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
