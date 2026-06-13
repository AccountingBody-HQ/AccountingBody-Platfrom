// app/sitemap.ts
import { MetadataRoute } from 'next'
import { headers } from 'next/headers'

const AB_BASE_URL = 'https://accountingbody.com'
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {

  // ── PLATFORM DETECTION ───────────────────────────────────────────────────
  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') ?? headersList.get('host') ?? ''
  const isET = host.includes('ethiotax.com')
  const BASE_URL = isET ? ET_BASE_URL : AB_BASE_URL

  // ── ETHIOTAX SITEMAP ─────────────────────────────────────────────────────
  if (isET) {
    const etStaticPages: MetadataRoute.Sitemap = [
      { url: ET_BASE_URL,                                                      lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
      { url: `${ET_BASE_URL}/get-help`,                                        lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
      { url: `${ET_BASE_URL}/get-help/tax-filing-compliance`,                  lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
      { url: `${ET_BASE_URL}/get-help/accounting-bookkeeping`,                 lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
      { url: `${ET_BASE_URL}/get-help/business-consulting`,                    lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
      { url: `${ET_BASE_URL}/get-help/payroll-services`,                       lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
      { url: `${ET_BASE_URL}/get-help/company-formation`,                      lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
      { url: `${ET_BASE_URL}/get-help/audit-assurance`,                        lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
      { url: `${ET_BASE_URL}/get-help/financial-planning-advisory`,            lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
      { url: `${ET_BASE_URL}/how-it-works`,                                    lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
      { url: `${ET_BASE_URL}/about-ethiotax`,                                  lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
      { url: `${ET_BASE_URL}/faq`,                                             lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
      { url: `${ET_BASE_URL}/study`,                                           lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
      { url: `${ET_BASE_URL}/study/eticpa`,                                    lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.85 },
      { url: `${ET_BASE_URL}/study/acca`,                                      lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
      { url: `${ET_BASE_URL}/study/cima`,                                      lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
      { url: `${ET_BASE_URL}/study/aat`,                                       lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
      { url: `${ET_BASE_URL}/free-courses`,                                    lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.75 },
      { url: `${ET_BASE_URL}/practice-questions`,                              lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8 },
      { url: `${ET_BASE_URL}/articles`,                                        lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8 },
      { url: `${ET_BASE_URL}/glossary`,                                        lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
      { url: `${ET_BASE_URL}/dictionary`,                                      lastModified: new Date(), changeFrequency: 'monthly', priority: 0.65 },
      { url: `${ET_BASE_URL}/calculators`,                                     lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
      { url: `${ET_BASE_URL}/mock-exams`,                                      lastModified: new Date(), changeFrequency: 'monthly', priority: 0.65 },
      { url: `${ET_BASE_URL}/firms-freelancers`,                               lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
      { url: `${ET_BASE_URL}/firms-freelancers/join`,                          lastModified: new Date(), changeFrequency: 'monthly', priority: 0.65 },
      { url: `${ET_BASE_URL}/firms-freelancers/directory`,                     lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
      { url: `${ET_BASE_URL}/contact`,                                         lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
      { url: `${ET_BASE_URL}/privacy-policy`,                                  lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
      { url: `${ET_BASE_URL}/terms`,                                           lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
      { url: `${ET_BASE_URL}/cookie-policy`,                                   lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
      { url: `${ET_BASE_URL}/accessibility`,                                   lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    ]

    // ET articles — only articles tagged for ethiotax
    const etArticles = await querySanity<{ slug: string; updatedAt: string }>(`
      *[_type == "article" && "ethiotax" in showOnSites && defined(slug.current)] | order(_updatedAt desc) {
        "slug": slug.current,
        "updatedAt": _updatedAt
      }
    `)

    return [
      ...etStaticPages,
      ...etArticles.map(a => ({
        url:             `${ET_BASE_URL}/articles/${a.slug}`,
        lastModified:    new Date(a.updatedAt),
        changeFrequency: 'monthly' as const,
        priority:        0.75,
      })),
    ]
  }

  // ── ACCOUNTINGBODY SITEMAP (unchanged) ───────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL,                         lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE_URL}/study`,              lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/practice-questions`, lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE_URL}/articles`,           lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8 },
    { url: `${BASE_URL}/glossary`,           lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/calculators`,        lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/global-payroll`,     lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/dictionary`,         lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/free-courses`,       lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/get-help`,           lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE_URL}/firms-freelancers`,  lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE_URL}/search`,             lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/about`,              lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/contact`,            lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/privacy-policy`,     lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE_URL}/terms`,              lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE_URL}/cookie-policy`,      lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },

    ...['acca', 'cima', 'aat', 'icaew'].map(body => ({
      url:             `${BASE_URL}/study/${body}`,
      lastModified:    new Date(),
      changeFrequency: 'weekly'  as const,
      priority:        0.85,
    })),

  ]

  const articles = await querySanity<{ slug: string; updatedAt: string }>(`
    *[_type == "article" && canonicalOwner == "accountingbody" && defined(slug.current)] {
      "slug": slug.current,
      "updatedAt": _updatedAt
    }
  `)

  const practicePosts = await querySanity<{ slug: string; updatedAt: string }>(`
    *[_type == "practicePost"] {
      "slug": slug.current,
      "updatedAt": _updatedAt
    }
  `)

  const courses = await querySanity<{ slug: string; updatedAt: string }>(`
    *[_type == "course"] {
      "slug": slug.current,
      "updatedAt": _updatedAt
    }
  `)

  const lessons = await querySanity<{ slug: string; courseSlug: string; updatedAt: string }>(`
    *[_type == "lesson"] {
      "slug": slug.current,
      "courseSlug": course->slug.current,
      "updatedAt": _updatedAt
    }
  `)


  const terms = await querySanity<{ slug: string; updatedAt: string }>(`
    *[_type == "dictionaryTerm"] {
      "slug": slug.current,
      "updatedAt": _updatedAt
    }
  `)

  return [
    ...staticPages,
    ...articles.map(a => ({
      url:             `${BASE_URL}/articles/${a.slug}`,
      lastModified:    new Date(a.updatedAt),
      changeFrequency: 'monthly' as const,
      priority:        0.75,
    })),
    ...practicePosts.map(p => ({
      url:             `${BASE_URL}/practice-questions/${p.slug}`,
      lastModified:    new Date(p.updatedAt),
      changeFrequency: 'monthly' as const,
      priority:        0.65,
    })),
    ...courses.map(c => ({
      url:             `${BASE_URL}/free-courses/${c.slug}`,
      lastModified:    new Date(c.updatedAt),
      changeFrequency: 'weekly' as const,
      priority:        0.80,
    })),
    ...lessons.filter(l => l.courseSlug && l.slug).map(l => ({
      url:             `${BASE_URL}/free-courses/${l.courseSlug}/learn/${l.slug}`,
      lastModified:    new Date(l.updatedAt),
      changeFrequency: 'monthly' as const,
      priority:        0.60,
    })),

    ...terms.map(t => ({
      url:             `${BASE_URL}/glossary/${t.slug}`,
      lastModified:    new Date(t.updatedAt),
      changeFrequency: 'monthly' as const,
      priority:        0.55,
    })),
  ]
}
