// components/QuizBankEmbed.tsx
// Server component — fetches a quizbankQuiz document from Sanity by _id
// and renders it using QuizBankRenderer (client component).

import QuizBankRenderer, { type QuizBankData } from './QuizBankRenderer'

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const DATASET    = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'

async function fetchQuiz(id: string): Promise<QuizBankData | null> {
  if (!PROJECT_ID || !id) return null
  try {
    const query = encodeURIComponent(`
      *[_type == "quizbankQuiz" && _id == $id][0] {
        _id,
        title,
        showTimer,
        showMap,
        theme,
        "cases": cases[] {
          caseId,
          title,
          exhibitHtml
        },
        rawJson,
        "quizQuestions": quizQuestions[] {
          id,
          type,
          questionText,
          options,
          correctIndex,
          explanation,
          writingModelAnswer,
          writingExplanation,
          caseId,
          primaryTopic,
          difficulty,
          timeTargetMinutes,
          points
        }
      }
    `)
    const params = encodeURIComponent(JSON.stringify({ id }))
    const res = await fetch(
      `https://${PROJECT_ID}.api.sanity.io/v2023-05-03/data/query/${DATASET}?query=${query}&%24id=${params}`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.result ?? null
  } catch {
    return null
  }
}

interface Props {
  quizId: string
}

export default async function QuizBankEmbed({ quizId }: Props) {
  const quiz = await fetchQuiz(quizId)

  if (!quiz) {
    return (
      <div className="my-8 p-5 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 text-sm text-center">
        Quiz not found — check the quiz ID in Sanity Studio.
      </div>
    )
  }

  return <QuizBankRenderer data={quiz} />
}
