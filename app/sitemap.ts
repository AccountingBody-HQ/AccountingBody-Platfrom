import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { getJobSitemapEntries } from '@/lib/jobs'
import { resolveArticleCanonicalUrl } from '@/lib/canonical'

const AB_BASE_URL = 'https://accountingbody.com'

// getJobSitemapEntries (lib/jobs.ts) paginates internally at 1,000 rows/page
// to stay under this project's PostgREST row cap (commit 6dda4b5) — for
// ~9,871 active jobs that's ~10 sequential round trips, plus the articles/
// question-sets queries above. Against this project's Supabase NANO
// instance that exceeded Next's 60s static-generation budget and failed
// `next build` outright (three retries, then a hard build failure) —
// nothing below could ever ship while this file was eligible for
// build-time prerendering.
//
// `dynamic = 'force-dynamic'` is what actually prevents that: Next's build
// only adds a non-dynamic-params app route to its static-export worker
// pool (the thing that was retrying and timing out) when
// `appConfig.revalidate !== 0` (node_modules/next/dist/build/index.js,
// the `if (appConfig.revalidate !== 0) { ... isStatic = true }` block for
// app routes). Setting `dynamic = 'force-dynamic'` forces exactly that:
// node_modules/next/dist/build/utils.js unconditionally sets
// `appConfig.revalidate = 0` whenever `dynamic === 'force-dynamic'` (and
// PPR, an experimental flag this project doesn't enable, is off) — so this
// route is never added to the static-export set and getJobSitemapEntries
// never runs during `next build`. The previous `revalidate = 3600` cannot
// coexist with this: the same utils.js line overwrites it to 0 regardless
// of what's written here, so it would be actively misleading to keep it.
//
// Caching consequence — this is a real trade-off, not a free fix: Next's
// generated wrapper for the `sitemap.ts` file convention
// (next/dist/build/webpack/loaders/next-metadata-route-loader.js,
// getDynamicSiteMapRouteCode) hardcodes the response's Cache-Control to
// `public, max-age=0, must-revalidate` — a fixed string in that loader,
// not templated from anything exported here. That header cannot be
// overridden from this file while it keeps the `sitemap.ts` convention,
// so with revalidate forced to 0 as well, /sitemap.xml now has NO caching
// at any layer: every crawler hit re-runs the full paginated query set.
// See tmp-audit/sitemap-build-fix.md for the assessment and the follow-up
// this implies (rewriting this as a plain app/sitemap.xml/route.ts route
// handler, like app/et-sitemap/route.ts already is, to regain control of
// this header) — deliberately not done in this commit, which is scoped to
// unblocking the build only.
export const dynamic = 'force-dynamic'

async function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await getSupabaseClient()

  const staticPages: MetadataRoute.Sitemap = [
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
      changeFrequency: 'weekly'  as const,
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

  const jobs = await getJobSitemapEntries('ab')

  return [
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
    ...jobs.map(j => ({
      url:             `${AB_BASE_URL}/jobs/${j.slug}`,
      lastModified:    j.lastModified,
      changeFrequency: 'daily' as const,
      priority:        0.7,
    })),
  ]
}
