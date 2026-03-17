// lib/sanity-queries.ts
// All GROQ queries for AccountingBody.com

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
  examBody?:     string
  readTime?:     number
  publishedAt?:  string
  lastReviewed?: string
  author?:       Pick<Author, 'name' | 'qualifications'>
  coverImage?:   { asset: { url: string } }
}

export interface ArticleFull extends ArticleSummary {
  body:                 unknown[]
  canonicalOwner?:      string
  showOnSites?:         string[]
  mcqUrl?:              string
  learningUrl?:         string
  shortQuestionsUrl?:   string
  scenarioUrl?:         string
  author?:              Author
  relatedArticles?:     ArticleSummary[]
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

    const url = `https://${PROJECT_ID}.api.sanity.io/v${API_VER}/data/query/${DATASET}?query=${encodedQuery}${encodedParams ? `&${encodedParams}` : ''}`

    const res = await fetch(url, { next: { revalidate } })
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
  category,
  examBody,
  readTime,
  publishedAt,
  lastReviewed,
  "coverImage": coverImage { asset -> { url } },
  "author": author -> { name, qualifications }
`

export async function getStudyLandingData(): Promise<ExamBodyStat[]> {
  const query = `*[_type == "article"] | order(publishedAt desc) { examBody, ${SUMMARY_FIELDS} }`
  const all   = await sanityFetch<(ArticleSummary & { examBody: string })[]>(query)
  if (!all) return []

  const map: Record<string, { count: number; latest: ArticleSummary }> = {}
  for (const a of all) {
    if (!a.examBody) continue
    if (!map[a.examBody]) map[a.examBody] = { count: 0, latest: a }
    map[a.examBody].count++
  }

  return Object.entries(map).map(([examBody, v]) => ({
    examBody,
    count:         v.count,
    latestArticle: v.latest,
  }))
}

export async function getArticlesByCategory(
  categorySlug: string,
): Promise<ArticleSummary[]> {
  const query = `
    *[
      _type == "article" &&
      (lower(examBody) == $cat || lower(category) == $cat)
    ] | order(title asc) {
      ${SUMMARY_FIELDS}
    }
  `
  return (await sanityFetch<ArticleSummary[]>(query, { cat: categorySlug })) ?? []
}

export async function getArticleBySlug(slug: string): Promise<ArticleFull | null> {
  const query = `
    *[_type == "article" && slug.current == $slug][0] {
      ${SUMMARY_FIELDS},
      body,
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

export async function getAllArticlePaths(): Promise
  { category: string; slug: string }[]
> {
  const query = `*[_type == "article"] { "slug": slug.current, examBody }`
  const all   = await sanityFetch<{ slug: string; examBody?: string }[]>(query)
  if (!all) return []

  return all
    .filter(a => a.slug && a.examBody)
    .map(a => ({
      category: a.examBody!.toLowerCase(),
      slug:     a.slug,
    }))
}

export async function getAllCategorySlugs(): Promise<string[]> {
  const query = `array::unique(*[_type == "article"].examBody)`
  const all   = await sanityFetch<string[]>(query)
  return (all ?? []).filter(Boolean).map(e => e.toLowerCase())
}

export function resolveCanonicalUrl(article: ArticleFull): string | null {
  if (!article.canonicalOwner || article.canonicalOwner === 'accountingbody') {
    return null
  }
  const domains: Record<string, string> = {
    globalpayrollexpert: 'https://globalpayrollexpert.com',
    ethiotax:            'https://ethiotax.com',
  }
  const domain = domains[article.canonicalOwner]
  if (!domain) return null
  return `${domain}/study/${article.examBody?.toLowerCase() ?? ''}/${article.slug.current}`
}