// app/api/eticpa/mock-exam/route.ts
// ETICPA Mock Exam — pulls all practice questions tagged to a module,
// balances selection across topics, returns a fresh randomised set.
import { NextRequest, NextResponse } from 'next/server'

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '4rllejq1'
const DATASET    = process.env.NEXT_PUBLIC_SANITY_DATASET    ?? 'production'
const READ_TOKEN = process.env.SANITY_API_READ_TOKEN ?? process.env.SANITY_API_TOKEN

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface QuizQuestion {
  questionText: string
  options: string[]
  correctIndex: number
  explanation?: string
  difficulty?: string
}

interface PoolQuestion extends QuizQuestion {
  sourceTitle: string
  topic: string
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function GET(req: NextRequest) {
  const level  = req.nextUrl.searchParams.get('level')  ?? 'level-1'
  const module = req.nextUrl.searchParams.get('module') ?? 'introduction-to-accounting'
  const count  = parseInt(req.nextUrl.searchParams.get('count') ?? '50', 10)

  const query = encodeURIComponent(`
    *[_type == "practicePost" && eticpaLevel == "${level}" && eticpaModule == "${module}" && "ethiotax" in showOnSites]{
      title,
      "questions": quizQuestions[]{ questionText, options, correctIndex, explanation, difficulty, primaryTopic }
    }
  `)

  try {
    const res = await fetch(
      `https://${PROJECT_ID}.apicdn.sanity.io/v2023-05-03/data/query/${DATASET}?query=${query}`,
      { headers: READ_TOKEN ? { Authorization: `Bearer ${READ_TOKEN}` } : {}, next: { revalidate: 0 } }
    )
    if (!res.ok) return NextResponse.json({ error: 'Sanity fetch failed' }, { status: 500 })
    const data = await res.json()
    const posts: { title: string; questions: (QuizQuestion & { primaryTopic?: string })[] }[] = data.result ?? []

    // Group questions by source post (each post = one topic group)
    const groups: PoolQuestion[][] = []
    let poolTotal = 0
    for (const post of posts) {
      const qs = (post.questions ?? [])
        .filter(q => q.questionText && Array.isArray(q.options) && q.options.length > 1 && typeof q.correctIndex === 'number')
        .map(q => ({
          questionText: q.questionText,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          difficulty: q.difficulty,
          sourceTitle: post.title,
          topic: post.title.replace(/ — Practice Questions$/, ''),
        }))
      if (qs.length > 0) { groups.push(shuffle(qs)); poolTotal += qs.length }
    }

    if (poolTotal === 0) return NextResponse.json({ questions: [], poolTotal: 0 })

    // Balanced round-robin selection across topic groups
    const selected: PoolQuestion[] = []
    const target = Math.min(count, poolTotal)
    let idx = 0
    while (selected.length < target) {
      let added = false
      for (const group of groups) {
        if (selected.length >= target) break
        if (group[idx]) { selected.push(group[idx]); added = true }
      }
      if (!added) break
      idx++
    }

    return NextResponse.json({
      questions: shuffle(selected),
      poolTotal,
      topicCount: groups.length,
      served: selected.length,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
