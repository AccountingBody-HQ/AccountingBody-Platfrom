// app/sitemap.ts
import { MetadataRoute } from 'next'

const BASE_URL = 'https://accountingbody.com'

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

  // ── 1. STATIC PAGES ───────────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL,                         lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE_URL}/study`,              lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/practice-questions`, lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE_URL}/articles`,           lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8 },
    { url: `${BASE_URL}/glossary`,           lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/courses`,            lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/get-help`,           lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE_URL}/hire`,               lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE_URL}/firms`,              lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE_URL}/search`,             lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/pricing`,            lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/about`,              lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/contact`,            lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/privacy-policy`,     lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE_URL}/terms`,              lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE_URL}/cookie-policy`,      lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },

    // Exam body landing pages
    ...['acca', 'cima', 'aat', 'icaew', 'att', 'cpa', 'cipfa', 'cta'].map(body => ({
      url:             `${BASE_URL}/study/${body}`,
      lastModified:    new Date(),
      changeFrequency: 'weekly'  as const,
      priority:        0.85,
    })),

    // Glossary A–Z letter pages
    ...'abcdefghijklmnopqrstuvwxyz'.split('').map(letter => ({
      url:             `${BASE_URL}/glossary/${letter}`,
      lastModified:    new Date(),
      changeFrequency: 'monthly' as const,
      priority:        0.55,
    })),
  ]

  // ── 2. ARTICLES ───────────────────────────────────────────────────────────
  // Only articles where AccountingBody is the canonical owner are submitted
  // to Google. Articles owned by hrlake or ethiotax are excluded — each site
  // claims only what it owns. showOnSites controls display; canonicalOwner
  // controls SEO ownership.
  const articles = await querySanity<{ slug: string; updatedAt: string }>(`
    *[_type == "article" && canonicalOwner == "accountingbody" && defined(slug.current)] {
      "slug": slug.current,
      "updatedAt": _updatedAt
    }
  `)

  // ── 3. PRACTICE POSTS ─────────────────────────────────────────────────────
  const practicePosts = await querySanity<{ slug: string; updatedAt: string }>(`
    *[_type == "practicePost"] {
      "slug": slug.current,
      "updatedAt": _updatedAt
    }
  `)

  // ── 4. COURSES ────────────────────────────────────────────────────────────
  const courses = await querySanity<{ slug: string; updatedAt: string }>(`
    *[_type == "course"] {
      "slug": slug.current,
      "updatedAt": _updatedAt
    }
  `)

  // ── 5. LESSONS ────────────────────────────────────────────────────────────
  const lessons = await querySanity<{ slug: string; courseSlug: string; updatedAt: string }>(`
    *[_type == "lesson"] {
      "slug": slug.current,
      "courseSlug": course->slug.current,
      "updatedAt": _updatedAt
    }
  `)

  // ── 6. QUIZZES ────────────────────────────────────────────────────────────
  const quizzes = await querySanity<{ slug: string; updatedAt: string }>(`
    *[_type == "quiz"] {
      "slug": slug.current,
      "updatedAt": _updatedAt
    }
  `)

  // ── 7. DICTIONARY TERMS ───────────────────────────────────────────────────
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
      url:             `${BASE_URL}/courses/${c.slug}`,
      lastModified:    new Date(c.updatedAt),
      changeFrequency: 'weekly' as const,
      priority:        0.80,
    })),
    ...lessons.filter(l => l.courseSlug && l.slug).map(l => ({
      url:             `${BASE_URL}/courses/${l.courseSlug}/${l.slug}`,
      lastModified:    new Date(l.updatedAt),
      changeFrequency: 'monthly' as const,
      priority:        0.60,
    })),
    ...quizzes.map(q => ({
      url:             `${BASE_URL}/quiz/${q.slug}`,
      lastModified:    new Date(q.updatedAt),
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