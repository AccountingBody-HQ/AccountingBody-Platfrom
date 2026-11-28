import type { Question, QuestionCase } from '@/lib/db'

// The quiz data QuizRenderer reads (components/QuizRenderer.tsx), built from a
// set's stored questions. Shared by the practice set page and the questions
// under a study note (PQB-4), so both show a question the same way.
export function buildQuizJson(questionType: string | undefined, questions: Question[], cases: QuestionCase[]): string {
  return JSON.stringify({
    question_type: questionType ?? 'multiple-choice',
    questions: questions.map((q, i) => ({
      id: `q${i + 1}`,
      type: q.type ?? 'multiple-choice',
      question: q.question_text,
      options: [q.option_a, q.option_b, q.option_c, q.option_d]
        .filter(Boolean)
        .map(o => ({ label: String(o), value: String(o) })),
      correctIndex: q.correct_index,
      correct: [q.option_a, q.option_b, q.option_c, q.option_d][q.correct_index ?? 0],
      explanation: q.explanation ?? '',
      writing: q.type === 'writing' ? {
        model_answer_html: q.writing_model_answer ?? '',
        explanation_html:  q.writing_explanation ?? '',
      } : undefined,
      case_id: q.case_id ?? undefined,
      meta: { primaryTopic: q.primary_topic ?? '' },
    })),
    cases: cases.map(c => ({
      case_id:      c.case_id,
      title:        c.title,
      exhibit_html: c.exhibit_html,
    })),
  })
}
