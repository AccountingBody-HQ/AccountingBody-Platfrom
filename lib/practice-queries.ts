// lib/practice-queries.ts
const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const DATASET    = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
const API_VER    = '2023-05-03'

export interface PracticePost {
  _id:           string
  title:         string
  slug:          { current: string }
  excerpt?:      string
  examBody?:     string
  difficulty?:   string
  topic?:        string
  questionType?: string
  questionCount?: number
  publishedAt?:  string
  quizJson?:     string
  body?:         unknown[]
}

async function sanityFetch<T>(query: string, params: Record<string, string> = {}, revalidate = 3600): Promise<T | null> {
  try {
    if (!PROJECT_ID) return null
    const encodedQuery  = encodeURIComponent(query)
    const encodedParams = Object.entries(params).map(([k, v]) => `$${k}=${encodeURIComponent(JSON.stringify(v))}`).join('&')
    const url = `https://${PROJECT_ID}.api.sanity.io/v${API_VER}/data/query/${DATASET}?query=${encodedQuery}${encodedParams ? `&${encodedParams}` : ''}`
    const res = await fetch(url, { next: { revalidate } })
    if (!res.ok) return null
    const data = await res.json()
    return (data.result ?? null) as T
  } catch { return null }
}

const SUMMARY_FIELDS = `
  _id, title, slug, excerpt, examBody, difficulty, topic, questionType, questionCount, publishedAt
`

export async function getPracticePosts(params: {
  examBody?: string
  difficulty?: string
  topic?: string
  search?: string
  page?: number
  perPage?: number
}): Promise<{ posts: PracticePost[]; total: number }> {
  const { examBody, difficulty, topic, search, page = 1, perPage = 12 } = params
  const filters: string[] = ['_type == "practicePost"']
  if (examBody)   filters.push(`examBody == "${examBody}"`)
  if (difficulty) filters.push(`difficulty == "${difficulty}"`)
  if (topic)      filters.push(`topic == "${topic}"`)
  if (search)     filters.push(`title match "*${search}*"`)

  const filter = filters.join(' && ')
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
  const query = `*[_type == "practicePost" && slug.current == $slug][0] {
    ${SUMMARY_FIELDS},
    "questionCount": count(quizQuestions),
    "quizQuestions": quizQuestions[] {
      id, type, questionText, options, correctIndex, explanation, primaryTopic, difficulty, timeTargetMinutes
    },
    body
  }`
  const post = await sanityFetch<any>(query, { slug })
  if (!post) return null

  // Transform quizQuestions array into quizJson string that QuizRenderer expects
  if (post.quizQuestions?.length) {
    const questions = post.quizQuestions.map((q: any) => ({
      id:           q.id,
      type:         q.type ?? 'multiple-choice',
      question:     q.questionText,
      options:      (q.options ?? []).map((o: string) => ({ label: o, value: o })),
      correctIndex: q.correctIndex,
      explanation:  q.explanation,
      meta:         { primaryTopic: q.primaryTopic },
    }))
    post.quizJson = JSON.stringify({ questions })
    post.questionCount = questions.length
  }

  return post as PracticePost
}

export async function getAllPracticePostSlugs(): Promise<string[]> {
  const query = `*[_type == "practicePost"]{ "slug": slug.current }`
  const all   = await sanityFetch<{ slug: string }[]>(query)
  return (all ?? []).map(a => a.slug).filter(Boolean)
}

export async function getPracticeFilters(): Promise<{
  examBodies: string[]
  difficulties: string[]
  topics: string[]
}> {
  const query = `{
    "examBodies":   array::unique(*[_type == "practicePost" && defined(examBody)].examBody),
    "difficulties": array::unique(*[_type == "practicePost" && defined(difficulty)].difficulty),
    "topics":       array::unique(*[_type == "practicePost" && defined(topic)].topic)
  }`
  const result = await sanityFetch<{ examBodies: string[]; difficulties: string[]; topics: string[] }>(query)
  return result ?? { examBodies: [], difficulties: [], topics: [] }
}
