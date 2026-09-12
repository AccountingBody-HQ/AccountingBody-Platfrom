import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getJobSitemapEntries } from '@/lib/jobs'
import { resolveArticleCanonicalUrl } from '@/lib/canonical'

const ET_BASE_URL = 'https://ethiotax.com'

// Same underlying cause as app/sitemap.ts, see that file's comment for the
// full mechanism: getJobSitemapEntries' internal pagination (commit
// 6dda4b5, ~10 round trips for ~9,871 jobs) exceeded Next's 60s
// static-generation budget against this project's Supabase NANO instance
// and failed `next build` outright. `dynamic = 'force-dynamic'` keeps this
// route out of the build's static-export worker pool entirely (Next only
// adds a route there when `appConfig.revalidate !== 0`, and force-dynamic
// unconditionally zeroes that — node_modules/next/dist/build/utils.js),
// so it can no longer coexist with `revalidate = 3600`, which is removed.
//
// Unlike app/sitemap.ts, this is a plain custom Route Handler, not the
// special `sitemap.ts` file convention — its own `Cache-Control` header,
// set explicitly on the NextResponse below, is sent as-is with no
// framework override. That header (public, max-age=3600) is what now
// provides this route's only caching: with revalidate forced to 0, the
// hourly cache lives entirely at the HTTP/CDN layer, not in Next's own
// data cache.
export const dynamic = 'force-dynamic'

function url(path: string, priority: number, changefreq: string, lastmod?: Date): string {
  return `  <url>
    <loc>${ET_BASE_URL}${path}</loc>
    <lastmod>${(lastmod ?? new Date()).toISOString()}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
}

export async function GET() {
  const staticUrls = [
    // Core
    url('',                                        1.0,  'daily'),
    // Get Help services
    url('/get-help',                               0.9,  'weekly'),
    url('/get-help/tax-filing-compliance',         0.9,  'weekly'),
    url('/get-help/accounting-bookkeeping',        0.9,  'weekly'),
    url('/get-help/business-consulting',           0.9,  'weekly'),
    url('/get-help/payroll-services',              0.9,  'weekly'),
    url('/get-help/company-formation',             0.9,  'weekly'),
    url('/get-help/audit-assurance',               0.9,  'weekly'),
    url('/get-help/financial-planning-advisory',   0.9,  'weekly'),
    // Jobs
    url('/jobs',                                   0.8,  'weekly'),
    url('/jobs/listings',                          0.9,  'daily'),
    // About & info
    url('/how-it-works',                           0.8,  'monthly'),
    url('/about-ethiotax',                         0.7,  'monthly'),
    url('/faq',                                    0.7,  'monthly'),
    // Study
    url('/study',                                  0.8,  'weekly'),
    url('/study/eticpa',                           0.85, 'weekly'),
    // ETICPA ATQ Level 1
    url('/study/eticpa/atq/level-1',                              0.85, 'weekly'),
    url('/study/eticpa/atq/level-1/introduction-to-accounting',   0.85, 'weekly'),
    url('/study/eticpa/atq/level-1/cost-accounting',              0.85, 'weekly'),
    url('/study/eticpa/atq/level-1/business-skills',              0.85, 'weekly'),
    url('/study/eticpa/atq/level-1/ethiopian-business-law',       0.85, 'weekly'),
    // ETICPA ATQ Level 2
    url('/study/eticpa/atq/level-2',                                      0.85, 'weekly'),
    url('/study/eticpa/atq/level-2/financial-accounting',                 0.85, 'weekly'),
    url('/study/eticpa/atq/level-2/management-accounting',                0.85, 'weekly'),
    url('/study/eticpa/atq/level-2/assurance-controls-ethics',            0.85, 'weekly'),
    url('/study/eticpa/atq/level-2/ethiopian-taxation',                   0.85, 'weekly'),
    url('/study/eticpa/atq/level-2/ethiopian-public-sector-accounting',   0.85, 'weekly'),
    // ETICPA CPA
    url('/study/eticpa/cpa',                       0.8,  'monthly'),
    url('/study/acca',                             0.8,  'weekly'),
    url('/study/cima',                             0.8,  'weekly'),
    url('/study/aat',                              0.8,  'weekly'),
    // Learning
    url('/free-courses',                           0.75, 'weekly'),
    url('/practice-questions',                     0.8,  'daily'),
    url('/mock-exams',                             0.65, 'monthly'),
    // Content
    url('/articles',                               0.8,  'daily'),
    url('/glossary',                               0.7,  'monthly'),
    url('/dictionary',                             0.65, 'monthly'),
    url('/calculators',                            0.7,  'monthly'),
    url('/search',                                 0.6,  'monthly'),
    // Firms & talent
    url('/firms-freelancers',                      0.7,  'weekly'),
    url('/firms-freelancers/join',                 0.65, 'monthly'),
    url('/firms-freelancers/directory',            0.6,  'monthly'),
    url('/hire-talent',                            0.7,  'weekly'),
    url('/hire-talent/jobs',                       0.65, 'weekly'),
    url('/hire-talent/post-a-job',                 0.6,  'monthly'),
    // Contact
    url('/contact',                                0.5,  'monthly'),
    // Legal
    url('/privacy-policy',                         0.3,  'yearly'),
    url('/terms',                                  0.3,  'yearly'),
    url('/cookie-policy',                          0.3,  'yearly'),
    url('/accessibility',                          0.3,  'yearly'),
    url('/disclaimer',                             0.3,  'yearly'),
  ]

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
  const { data: etArticles } = await supabase
    .from('articles')
    .select('slug, updated_at, category, canonical_owner, show_on_sites')
    .eq('status', 'published')
    .eq('canonical_owner', 'ethiotax')
    .order('updated_at', { ascending: false })

  const articleUrls = (etArticles ?? []).map(a =>
    `  <url>
    <loc>${resolveArticleCanonicalUrl(a, ET_BASE_URL)}</loc>
    <lastmod>${new Date(a.updated_at).toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.75</priority>
  </url>`
  )

  const jobEntries = await getJobSitemapEntries('et')
  const jobUrls = jobEntries.map(j => url(`/jobs/${j.slug}`, 0.7, 'daily', j.lastModified))

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...articleUrls, ...jobUrls].join('\n')}
</urlset>`

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, must-revalidate',
    },
  })
}
