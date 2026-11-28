import { getPublicQuestionSetBySlug, getPublicQuestionsBySetId } from '@/lib/db'
import { errorCode } from '@/lib/recycle-bin'
import { reportServerError } from '@/lib/report-error'
import { linkedSetSlug } from '@/lib/question-article-link'
import { buildQuizJson } from '@/lib/quiz-data'

// PQB-4 (D351 D-4 A): five questions from the study note's own practice set,
// at the bottom of the note. Cached public reads (lib/db.ts), the first five by
// question order; answers show only after "Submit answers". Nothing is kept on
// the device (no setSlug). Any problem (no linked set, a scenario set, fewer
// than five questions, a failed read) gives null and the note shows no block;
// the note itself never fails because of it. The note's hidden labels
// (JSON-LD) are unchanged.
export const NOTE_QUESTION_COUNT = 5

export interface NotePracticeQuiz {
  quizJson:  string
  heading:   string
  intro:     string
  moreHref:  string
  moreLabel: string
}

export async function notePracticeQuiz(mcqUrl: unknown): Promise<NotePracticeQuiz | null> {
  const setSlug = linkedSetSlug(mcqUrl)
  if (!setSlug) return null
  try {
    const qset = await getPublicQuestionSetBySlug(setSlug)
    if (!qset || (qset.question_type ?? '').toLowerCase() === 'scenario') return null
    const questions = await getPublicQuestionsBySetId(qset.id)
    if (questions.length < NOTE_QUESTION_COUNT) return null
    return {
      quizJson:  buildQuizJson(qset.question_type, questions.slice(0, NOTE_QUESTION_COUNT), []),
      heading:   'Practice questions on this topic',
      intro:     'Try 5 questions from the practice set for this study note.',
      moreHref:  `/practice-questions/${qset.slug}`,
      moreLabel: `Practise all ${questions.length} questions →`,
    }
  } catch (error) {
    console.error('notePracticeQuiz error:', errorCode(error))
    reportServerError('note practice questions read failed', error, { area: 'public' })
    return null
  }
}
