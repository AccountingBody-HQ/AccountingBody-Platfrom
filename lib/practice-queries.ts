// lib/practice-queries.ts
const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const DATASET    = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production"
const API_VER    = "2023-05-03"

export interface PracticePost {
  _id:            string
  title:          string
  slug:           { current: string }
  excerpt?:       string
  examBody?:      string
  difficulty?:    string
  topic?:         string
  questionType?:  string
  questionCount?: number
  publishedAt?:   string
  quizJson?:      string
  body?:          unknown[]
}

// No caching — all practice data is always fresh from Sanity
async function sanityFetch<T>(query: string, params: Record<string, string> = {}): Promise<T | null> {
  try {
    if (!PROJECT_ID) return null
    const encodedQuery  = encodeURIComponent(query)
    const encodedParams = Object.entries(params).map(([k, v]) => `$${k}=${encodeURIComponent(JSON.stringify(v))}`).join("&")
    const url = `https://${PROJECT_ID}.api.sanity.io/v${API_VER}/data/query/${DATASET}?query=${encodedQuery}${encodedParams ? `&${encodedParams}` : ""}`
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    const data = await res.json()
    return (data.result ?? null) as T
  } catch { return null }
}

const SUMMARY_FIELDS = `
  _id, title, slug, excerpt, examBody, difficulty, topic, questionType, publishedAt,
  "questionCount": count(quizQuestions)
`

export async function getPracticePosts(params: {
  examBody?:  string
  difficulty?: string
  topic?:     string
  search?:    string
  page?:      number
  perPage?:   number
}): Promise<{ posts: PracticePost[]; total: number }> {
  const { examBody, difficulty, topic, search, page = 1, perPage = 12 } = params
  const filters: string[] = ["_type == \"practicePost\"", "\"accountingbody\" in showOnSites"]
  if (examBody)   filters.push(`examBody == "${examBody}"`)
  if (difficulty) filters.push(`difficulty == "${difficulty}"`)
  if (topic)      filters.push(`topic == "${topic}"`)
  if (search)     filters.push(`title match "*${search}*"`)
  const filter = filters.join(" && ")
  const start  = (page - 1) * perPage
  const end    = start + perPage
  const query = `{
    "posts": *[${filter}] | order(publishedAt desc) [${start}...${end}] { ${SUMMARY_FIELDS} },
    "total": count(*[${filter}])
  }`
  const result = await sanityFetch<{ posts: PracticePost[]; total: number }>(query)
  return result ?? { posts: [], total: 0 }
}

export async function getPracticePostBySlug(slug: string): Promise<PracticePost | null> {
  const query = `*[_type == "practicePost" && "accountingbody" in showOnSites && slug.current == $slug][0] {
    ${SUMMARY_FIELDS},
    "quizQuestions": quizQuestions[] {
      id, type, questionText, options, correctIndex, explanation, primaryTopic, difficulty, timeTargetMinutes
    },
    body
  }`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const post = await sanityFetch<any>(query, { slug })
  if (!post) return null
  try {
    if (Array.isArray(post.quizQuestions) && post.quizQuestions.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const questions = post.quizQuestions.map((q: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const options = Array.isArray(q.options) ? q.options.map((o: any) => ({ label: String(o), value: String(o) })) : []
        const correctLabel = (typeof q.correctIndex === "number" && options[q.correctIndex]) ? options[q.correctIndex].label : null
        return {
          id:          q.id ?? String(Math.random()),
          type:        q.type ?? "multiple-choice",
          question:    q.questionText ?? "",
          options,
          correct:     correctLabel,
          explanation: q.explanation ?? "",
          meta:        { primaryTopic: q.primaryTopic ?? "" },
        }
      })
      post.quizJson      = JSON.stringify({ questions })
      post.questionCount = questions.length
    }
  } catch (e) {
    console.error("practice-queries: transform failed", e)
  }
  return post as PracticePost
}

export async function getPracticeFilters(): Promise<{
  examBodies:   string[]
  difficulties: string[]
  topics:       string[]
}> {
  const query = `{
    "examBodies":   array::unique(*[_type == "practicePost" && "accountingbody" in showOnSites && defined(examBody)].examBody),
    "difficulties": array::unique(*[_type == "practicePost" && "accountingbody" in showOnSites && defined(difficulty)].difficulty),
    "topics":       array::unique(*[_type == "practicePost" && "accountingbody" in showOnSites && defined(topic)].topic)
  }`
  const result = await sanityFetch<{ examBodies: string[]; difficulties: string[]; topics: string[] }>(query)
  return result ?? { examBodies: [], difficulties: [], topics: [] }
}