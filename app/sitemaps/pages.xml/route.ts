import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveArticleCanonicalUrl } from '@/lib/canonical'
import { buildUrlset, type UrlsetEntry } from '@/lib/sitemap-chunks'

const AB_BASE_URL = 'https://accountingbody.com'

export const dynamic = 'force-dynamic'
// force-dynamic alone does NOT stop Next 14.2 caching fetch() calls in route
// handlers (Data Cache, up to 1 year, survives deploys). This froze the sitemap
// at 13 Sept 2026. Do not remove. See Session 15 handover.
export const fetchCache = 'force-no-store'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

// Static pages, articles and practice-question sets — moved verbatim from
// the old app/sitemap.ts (same URLs, priorities, changeFrequency values,
// and the same silent-empty-array-on-error behaviour for the two Supabase
// queries below). Jobs live in app/sitemaps/jobs/[file]/route.ts instead.
export async function GET() {
  const supabase = getSupabase()

  const staticPages: UrlsetEntry[] = [
    { url: AB_BASE_URL,                         lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${AB_BASE_URL}/study`,              lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${AB_BASE_URL}/practice-questions`, lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${AB_BASE_URL}/jobs`,               lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${AB_BASE_URL}/jobs/listings`,      lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${AB_BASE_URL}/articles`,           lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8 },
    { url: `${AB_BASE_URL}/glossary`,           lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${AB_BASE_URL}/calculators`,        lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${AB_BASE_URL}/global-payroll`,     lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${AB_BASE_URL}/dictionary`,         lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${AB_BASE_URL}/free-courses`,       lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${AB_BASE_URL}/get-help`,           lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${AB_BASE_URL}/firms-freelancers`,  lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${AB_BASE_URL}/search`,             lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${AB_BASE_URL}/about`,              lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${AB_BASE_URL}/contact`,            lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${AB_BASE_URL}/privacy-policy`,     lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${AB_BASE_URL}/terms`,              lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${AB_BASE_URL}/cookie-policy`,      lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    ...['acca', 'cima', 'aat', 'icaew'].map(body => ({
      url:             `${AB_BASE_URL}/study/${body}`,
      lastModified:    new Date(),
      changeFrequency: 'weekly' as const,
      priority:        0.85,
    })),
  ]

  const { data: articles } = await supabase
    .from('articles')
    .select('slug, updated_at, category, canonical_owner, show_on_sites')
    .eq('status', 'published')
    .eq('platform', 'ab')

  const { data: questionSets } = await supabase
    .from('question_sets')
    .select('slug, updated_at')
    .eq('status', 'published')
    .eq('platform', 'ab')

  const entries: UrlsetEntry[] = [
    ...staticPages,
    ...(articles ?? []).map(a => ({
      url:             resolveArticleCanonicalUrl(a, AB_BASE_URL),
      lastModified:    new Date(a.updated_at ?? Date.now()),
      changeFrequency: 'monthly' as const,
      priority:        0.75,
    })),
    ...(questionSets ?? []).map(p => ({
      url:             `${AB_BASE_URL}/practice-questions/${p.slug}`,
      lastModified:    new Date(p.updated_at ?? Date.now()),
      changeFrequency: 'monthly' as const,
      priority:        0.65,
    })),
  ]

  const xml = buildUrlset(entries)

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
