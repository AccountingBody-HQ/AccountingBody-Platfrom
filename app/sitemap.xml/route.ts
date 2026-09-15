import { NextResponse } from 'next/server'
import { indexChildUrls, buildSitemapIndex } from '@/lib/sitemap-chunks'

const AB_BASE_URL = 'https://accountingbody.com'

// A plain Route Handler (folder literally named "sitemap.xml", not the
// sitemap.ts metadata-route convention that used to live here) — needed
// so /sitemap.xml can serve a <sitemapindex> at all: Next's generated
// sitemap.ts wrapper never assembles an index, and once `generateSitemaps`
// is in play the bare /sitemap.xml path 404s instead (see Session 16
// handover / tmp-audit/session15-sitemap-split-design.md §A). Because a
// file literally named route.ts is never routed through the metadata
// loader regardless of its folder path (next-app-loader.js's
// `filename !== "route"` guard), this coexists fine as an ordinary route.
export const dynamic = 'force-dynamic'
// force-dynamic alone does NOT stop Next 14.2 caching fetch() calls in route
// handlers (Data Cache, up to 1 year, survives deploys). This froze the sitemap
// at 13 Sept 2026. Do not remove. See Session 15 handover.
export const fetchCache = 'force-no-store'

// No Supabase call here — the child list is a fixed function of
// BUCKET_COUNT (lib/sitemap-chunks.ts), not of live row counts, so the
// index never needs to query the database to know its own shape.
export async function GET() {
  const xml = buildSitemapIndex(indexChildUrls(AB_BASE_URL))

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
