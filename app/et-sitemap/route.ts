import { NextResponse } from 'next/server'

const ET_BASE_URL = 'https://ethiotax.com'

async function querySanity<T>(groq: string): Promise<T[]> {
  try {
    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
    const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
    if (!projectId) return []
    const res = await fetch(
      `https://${projectId}.api.sanity.io/v2023-05-03/data/query/${dataset}?query=${encodeURIComponent(groq)}`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.result ?? []
  } catch {
    return []
  }
}

function url(path: string, priority: number, changefreq: string): string {
  return `  <url>
    <loc>${ET_BASE_URL}${path}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
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

  const etArticles = await querySanity<{ slug: string; updatedAt: string }>(`
    *[_type == "article" && canonicalOwner == "ethiotax" && defined(slug.current)] | order(_updatedAt desc) {
      "slug": slug.current,
      "updatedAt": _updatedAt
    }
  `)

  const articleUrls = etArticles.map(a =>
    `  <url>
    <loc>${ET_BASE_URL}/articles/${a.slug}</loc>
    <lastmod>${new Date(a.updatedAt).toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.75</priority>
  </url>`
  )

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...articleUrls].join('\n')}
</urlset>`

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, must-revalidate',
    },
  })
}
