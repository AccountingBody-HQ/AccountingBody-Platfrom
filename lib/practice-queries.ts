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
  relatedArticle?: { title: string; slug: string } | null
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
  examBody?:   string
  difficulty?: string
  topic?:      string
  search?:     string
  page?:       number
  perPage?:    number
  sortBy?:     string
}): Promise<{ posts: PracticePost[]; total: number }> {
  const { examBody, difficulty, topic, search, page = 1, perPage = 12, sortBy = 'alpha' } = params
  const filters: string[] = ["_type == \"practicePost\"", "\"accountingbody\" in showOnSites"]
  if (examBody)   filters.push(`examBody == "${examBody}"`)
  if (difficulty) filters.push(`difficulty == "${difficulty}"`)
  if (topic)      filters.push(`topic == "${topic}"`)
  if (search)     filters.push(`title match "${search}*"`)
  const filter  = filters.join(" && ")
  const orderBy = sortBy === 'newest' ? 'publishedAt desc' : 'title asc'
  const start   = (page - 1) * perPage
  const end     = start + perPage
  const query = `{
    "posts": *[${filter}] | order(${orderBy}) [${start}...${end}] { ${SUMMARY_FIELDS} },
    "total": count(*[${filter}])
  }`
  const result = await sanityFetch<{ posts: PracticePost[]; total: number }>(query)
  return result ?? { posts: [], total: 0 }
}

export async function getPracticePostBySlug(slug: string): Promise<PracticePost | null> {
  // FIX 11: fetch writingModelAnswer + writingExplanation (were missing)
  // FIX 12: fetch cases array (was missing — scenario exhibits never loaded)
  // FIX 13: fetch caseId per question (was missing — questions could not link to exhibits)
  const query = `*[_type == "practicePost" && "accountingbody" in showOnSites && slug.current == $slug][0] {
    ${SUMMARY_FIELDS},
    "quizQuestions": quizQuestions[] {
      id, type, questionText, options, correctIndex, explanation,
      primaryTopic, difficulty, timeTargetMinutes,
      writingModelAnswer, writingExplanation, caseId
    },
    "cases": cases[] {
      caseId, title, exhibitHtml
    },
    body,
    "relatedArticle": *[_type == "article" && "accountingbody" in showOnSites && mcqUrl match ("*/practice-questions/" + ^.slug.current)][0]{ title, "slug": slug.current }
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
        const correctLabel = (typeof q.correctIndex === "number" && options[q.correctIndex])
          ? options[q.correctIndex].label
          : null

        return {
          id:           q.id ?? String(Math.random()),
          // FIX 14: type preserved so QuizRenderer can switch rendering modes correctly
          type:         q.type ?? "multiple-choice",
          question:     q.questionText ?? "",
          options,
          correct:      correctLabel,
          correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : null,
          explanation:  q.explanation ?? "",
          // FIX 13: caseId mapped to case_id so scenario questions link to their exhibits
          case_id:      q.caseId ?? null,
          meta:         { primaryTopic: q.primaryTopic ?? "" },
          // FIX 11: writing fields mapped to the shape QuizRenderer expects
          writing: q.type === "writing" ? {
            model_answer_html: q.writingModelAnswer ?? "",
            explanation_html:  q.writingExplanation ?? "",
          } : undefined,
        }
      })

      // FIX 12: cases mapped to the shape QuizRenderer expects
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cases = Array.isArray(post.cases)
        ? post.cases.map((c: any) => ({  // eslint-disable-line @typescript-eslint/no-explicit-any
            case_id:      c.caseId      ?? "",
            title:        c.title       ?? "",
            exhibit_html: c.exhibitHtml ?? "",
          }))
        : []

      // FIX 14: question_type included so QuizRenderer renders the correct question mode
      post.quizJson = JSON.stringify({
        question_type: post.questionType ?? "multiple-choice",
        questions,
        cases,
      })
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
