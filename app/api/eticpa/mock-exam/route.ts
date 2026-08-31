// app/api/eticpa/mock-exam/route.ts
// ETICPA mock exam — fetches questions from Supabase by eticpa_level + eticpa_module
// Replaces Sanity GROQ fetch — Session 35
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface QuizQuestion {
  questionText: string
  options:      string[]
  correctIndex: number
  explanation?: string
  difficulty?:  string
}

interface PoolQuestion extends QuizQuestion {
  sourceTitle: string
  topic:       string
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
  const level      = req.nextUrl.searchParams.get('level')  ?? 'level-1'
  const moduleSlug = req.nextUrl.searchParams.get('module') ?? 'introduction-to-accounting'
  const count      = parseInt(req.nextUrl.searchParams.get('count') ?? '50', 10)

  try {
    // Fetch published ETICPA question sets for this level + module
    const supabase = getSupabase()
    const { data: questionSets, error: qsError } = await supabase
      .from('question_sets')
      .select('id, title')
      .eq('status', 'published')
      .contains('show_on_sites', ['et'])
      .eq('eticpa_level', level)
      .eq('eticpa_module', moduleSlug)

    if (qsError) return NextResponse.json({ error: qsError.message }, { status: 500 })

    if (!questionSets || questionSets.length === 0) {
      return NextResponse.json({ questions: [], poolTotal: 0 })
    }

    const setIds = questionSets.map(qs => qs.id)
    const setTitleMap = new Map(questionSets.map(qs => [qs.id, qs.title]))

    // Fetch all questions for matching sets
    const { data: questions, error: qError } = await supabase
      .from('questions')
      .select('set_id, question_text, option_a, option_b, option_c, option_d, correct_index, explanation, difficulty')
      .in('set_id', setIds)
      .order('question_order', { ascending: true })

    if (qError) return NextResponse.json({ error: qError.message }, { status: 500 })

    // Group questions by set for round-robin
    const groupMap = new Map<string, PoolQuestion[]>()
    for (const q of (questions ?? [])) {
      if (!q.question_text || typeof q.correct_index !== 'number') continue
      const options = [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean) as string[]
      if (options.length < 2) continue
      const title = setTitleMap.get(q.set_id) ?? ''
      const pq: PoolQuestion = {
        questionText: q.question_text,
        options,
        correctIndex: q.correct_index,
        explanation:  q.explanation ?? undefined,
        difficulty:   q.difficulty ?? undefined,
        sourceTitle:  title,
        topic:        title.replace(/ [—-] Practice Questions$/, ''),
      }
      const group = groupMap.get(q.set_id) ?? []
      group.push(pq)
      groupMap.set(q.set_id, group)
    }

    const groups = Array.from(groupMap.values()).map(g => shuffle(g))
    const poolTotal = groups.reduce((sum, g) => sum + g.length, 0)

    if (poolTotal === 0) {
      return NextResponse.json({ questions: [], poolTotal: 0 })
    }

    // Balanced round-robin across all question sets
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
      questions:  shuffle(selected),
      poolTotal,
      topicCount: groups.length,
      served:     selected.length,
    })

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
