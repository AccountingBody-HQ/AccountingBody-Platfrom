// lib/sanity-queries.ts
const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const DATASET    = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
const API_VER    = '2023-05-03'

export interface Author {
  name:            string
  bio?:            string
  qualifications?: string
  image?:          { asset: { url: string } }
}

export interface ArticleSummary {
  _id:           string
  title:         string
  slug:          { current: string }
  excerpt?:      string
  category?:     string
  categoryTitle?: string
  examBody?:     string[]
  readTime?:     number
  publishedAt?:  string
  lastReviewed?: string
  author?:       Pick<Author, 'name' | 'qualifications'>
  coverImage?:   { asset: { url: string } }
}

export interface ArticleFull extends ArticleSummary {
  body:                unknown[]
  seoTitle?:           string
  seoDescription?:     string
  canonicalOwner?:     string
  showOnSites?:        string[]
  mcqUrl?:             string
  learningUrl?:        string
  shortQuestionsUrl?:  string
  scenarioUrl?:        string
  author?:             Author
  relatedArticles?:    ArticleSummary[]
}

export interface ExamBodyStat {
  examBody:       string
  count:          number
  latestArticle?: ArticleSummary
}

async function sanityFetch<T>(
  query: string,
  params: Record<string, string> = {},
  revalidate = 3600,
): Promise<T | null> {
  try {
    if (!PROJECT_ID) return null
    const encodedQuery  = encodeURIComponent(query)
    const encodedParams = Object.entries(params)
      .map(([k, v]) => `$${k}=${encodeURIComponent(JSON.stringify(v))}`)
      .join('&')
    const url = `https://${PROJECT_ID}.apicdn.sanity.io/v${API_VER}/data/query/${DATASET}?query=${encodedQuery}${encodedParams ? `&${encodedParams}` : ''}`
    const token = process.env.SANITY_API_TOKEN
    const res = await fetch(url, {
      next: { revalidate },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data.result ?? null) as T
  } catch {
    return null
  }
}

const SUMMARY_FIELDS = `
  _id,
  title,
  slug,
  excerpt,
  "category": categories[0]->slug.current,
  "categoryTitle": categories[0]->title,
  examBody,
  readTime,
  publishedAt,
  lastReviewed,
  "coverImage": featuredImage { asset -> { url } },
  "author": author -> { name, qualifications }
`

export async function getStudyLandingData(): Promise<ExamBodyStat[]> {
  const examBodies = ['acca', 'cima', 'icaew', 'aat', 'eticpa-atq']
  const query = `{
    "acca":      count(*[_type == "article" && "accountingbody" in showOnSites && "acca" in examBody]),
    "cima":      count(*[_type == "article" && "accountingbody" in showOnSites && "cima" in examBody]),
    "icaew":     count(*[_type == "article" && "accountingbody" in showOnSites && "icaew" in examBody]),
    "aat":       count(*[_type == "article" && "accountingbody" in showOnSites && "aat" in examBody]),
    "eticpa-atq":count(*[_type == "article" && "accountingbody" in showOnSites && "eticpa-atq" in examBody])
  }`
  const counts = await sanityFetch<Record<string, number>>(query, {}, 3600)
  if (!counts) return []
  return examBodies.map(examBody => ({
    examBody,
    count: counts[examBody] ?? 0,
    latestArticle: null as unknown as ArticleSummary,
  }))
}

const QUAL_SLUGS = ["acca", "cima", "icaew", "aat"]

export async function getArticlesByCategory(categorySlug: string): Promise<ArticleSummary[]> {
  const isQualPage = QUAL_SLUGS.includes(categorySlug.toLowerCase())
  const query = isQualPage
    ? `*[_type == "article" && "accountingbody" in showOnSites && $slug in examBody] | order(title asc) { ${SUMMARY_FIELDS} }`
    : `*[_type == "article" && "accountingbody" in showOnSites && categories[]->.slug.current match $cat] | order(title asc) { ${SUMMARY_FIELDS} }`
  return (await sanityFetch<ArticleSummary[]>(query, { cat: categorySlug, slug: categorySlug })) ?? []
}

export async function getArticleBySlug(slug: string): Promise<ArticleFull | null> {
  const query = `
    *[_type == "article" && slug.current == $slug][0] {
      ${SUMMARY_FIELDS},
      body[]{ ..., _type == "tableBlock" => { _type, _key, headers, rows[]{ _type, _key, cells } } },
      seoTitle,
      seoDescription,
      canonicalOwner,
      showOnSites,
      mcqUrl,
      learningUrl,
      shortQuestionsUrl,
      scenarioUrl,
      "author": author -> { name, bio, qualifications, "image": image { asset -> { url } } },
      "relatedArticles": relatedArticles[] -> { ${SUMMARY_FIELDS} }
    }
  `
  return sanityFetch<ArticleFull>(query, { slug })
}

export async function getAllArticlePaths(): Promise<Array<{ category: string; slug: string }>> {
  const query = `*[_type == "article" && ("accountingbody" in showOnSites || "ethiotax" in showOnSites)] { "slug": slug.current, examBody }`
  const all   = await sanityFetch<{ slug: string; examBody?: string[] }[]>(query)
  if (!all) return []
  const paths: Array<{ category: string; slug: string }> = []
  for (const a of all) {
    if (!a.slug) continue
    const bodies = a.examBody?.length ? a.examBody : ['acca']
    for (const body of bodies) {
      paths.push({ category: body.toLowerCase(), slug: a.slug })
    }
  }
  return paths
}

export async function getAllCategorySlugs(): Promise<string[]> {
  const query = `array::unique(*[_type == "article" && "accountingbody" in showOnSites].examBody[])`
  const all   = await sanityFetch<string[]>(query)
  return (all ?? []).filter(Boolean).map(e => e.toLowerCase())
}

export function resolveCanonicalUrl(article: ArticleFull): string | null {
  // accountingbody owns the canonical — return null so Next.js uses the default
  if (!article.canonicalOwner || article.canonicalOwner === 'accountingbody') {
    return null
  }
  if (article.canonicalOwner === 'hrlake') {
    return `https://hrlake.com/insights/${article.slug.current}/`
  }
  if (article.canonicalOwner === 'ethiotax') {
    return `https://ethiotax.com/articles/${article.slug.current}/`
  }
  return null
}
// ── Manual cards (replaces [ab_combined_cards] shortcode) ─────────────────────

export interface ManualCardDoc {
  _id:          string
  title:        string
  href:         string
  description?: string
  iconName?:    string
  pinned?:      boolean
  badge?:       string
  accentClass?: string
}

export async function getManualCards(placement?: string): Promise<ManualCardDoc[]> {
  const query = placement
    ? `*[_type == "manualCard" && placement == $placement] | order(pinned desc, _createdAt asc) { _id, title, href, description, iconName, pinned, badge, accentClass }`
    : `*[_type == "manualCard"] | order(pinned desc, _createdAt asc) { _id, title, href, description, iconName, pinned, badge, accentClass }`
  return (await sanityFetch<ManualCardDoc[]>(query, placement ? { placement } : {})) ?? []
}

export interface GlossaryCategory {
  slug:  string
  title: string
  count: number
}

export async function getGlossaryCategories(): Promise<GlossaryCategory[]> {
  const query = `*[_type == "category" && "accountingbody" in showOnSites && !defined(parentCategory)] | order(title asc) {
    "slug": slug.current,
    title,
    "count": count(*[_type == "article" && "accountingbody" in showOnSites && references(^._id)])
  }`
  const result = await sanityFetch<GlossaryCategory[]>(query, {}, 3600)
  if (!result) return []
  return result.filter(c => c.count > 0)
}

export async function getCategoryCounts(platform: string = 'accountingbody'): Promise<Record<string, number>> {
  const site = platform === 'ethiotax' ? 'ethiotax' : 'accountingbody'
  const query = `{
    "financial-accounting":  count(*[_type == "article" && "${site}" in showOnSites && categories[]->.slug.current match "financial-accounting"]),
    "financial-management":  count(*[_type == "article" && "${site}" in showOnSites && categories[]->.slug.current match "financial-management"]),
    "management-accounting": count(*[_type == "article" && "${site}" in showOnSites && categories[]->.slug.current match "management-accounting"]),
    "financial-market":      count(*[_type == "article" && "${site}" in showOnSites && categories[]->.slug.current match "financial-market"]),
    "business-management":   count(*[_type == "article" && "${site}" in showOnSites && categories[]->.slug.current match "business-management"]),
    "audit-assurance":       count(*[_type == "article" && "${site}" in showOnSites && categories[]->.slug.current match "audit-assurance"]),
    "taxation":              count(*[_type == "article" && "${site}" in showOnSites && categories[]->.slug.current match "taxation"]),
    "economics":             count(*[_type == "article" && "${site}" in showOnSites && categories[]->.slug.current match "economics"]),
    "cryptocurrency":        count(*[_type == "article" && "${site}" in showOnSites && categories[]->.slug.current match "cryptocurrency"]),
    "tools-templates":       count(*[_type == "article" && "${site}" in showOnSites && categories[]->.slug.current match "tools-templates"])
  }`
  const result = await sanityFetch<Record<string, number>>(query, {}, 3600)
  if (!result) return {}
  return result
}

export async function getETICPAArticles(): Promise<ArticleSummary[]> {
  const query = `*[_type == "article" && "ethiotax" in showOnSites] | order(_createdAt desc)[0...8] {
    ${SUMMARY_FIELDS}
  }`
  return (await sanityFetch<ArticleSummary[]>(query, {})) ?? []
}

export async function getETICPAModuleArticles(level: string, module: string): Promise<ArticleSummary[]> {
  const query = `*[_type == "article" && "ethiotax" in showOnSites && eticpaLevel == $level && eticpaModule == $module] | order(title asc) {
    ${SUMMARY_FIELDS}
  }`
  return (await sanityFetch<ArticleSummary[]>(query, { level, module })) ?? []
}
