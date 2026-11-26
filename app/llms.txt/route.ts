import { headers } from 'next/headers'
import { isEthioTaxHeader } from '@/lib/brand'
import { getCachedPublishedArticleCount, getPublishedQuestionCount, getQuestionSetCount } from '@/lib/db'
import { getPublishedCoursesOrThrow } from '@/lib/coursesNew'
import { buildLlmsTxt, type LlmsCounts } from '@/lib/llms-txt'
import { getOpenMockExamSubjects, type MockExamSubject } from '@/lib/mock-exam-subjects'

// /llms.txt — a plain-English map of the site for AI tools, one file per
// brand (lib/llms-txt.ts). The counts come from the same cached reads the
// footer, /study and /free-courses already use, so this adds no new load;
// a failed read gives 0 and the sentence is written without that number.
export const dynamic = 'force-dynamic'
// The cached reads above must still be served from their cache.
export const fetchCache = 'default-no-store'

async function courseCounts(): Promise<{ courses: number; lessons: number }> {
  try {
    const courses = await getPublishedCoursesOrThrow('ab')
    return { courses: courses.length, lessons: courses.reduce((sum, c) => sum + c.lessonCount, 0) }
  } catch {
    return { courses: 0, lessons: 0 }
  }
}

export async function GET() {
  const isEthioTax = isEthioTaxHeader(await headers())
  let counts: LlmsCounts = { articles: 0, sets: 0, questions: 0, courses: 0, lessons: 0 }
  let mockExams: MockExamSubject[] = []
  if (!isEthioTax) {
    const [articles, sets, questions, course, openMockExams] = await Promise.all([
      getCachedPublishedArticleCount('ab'),
      getQuestionSetCount(),
      getPublishedQuestionCount(),
      courseCounts(),
      // Only the open subjects; one still "Coming soon" is left out.
      getOpenMockExamSubjects(),
    ])
    counts = { articles, sets, questions, ...course }
    mockExams = openMockExams
  }
  return new Response(buildLlmsTxt(isEthioTax, counts, mockExams), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // One address, two brands: never kept in a shared cache.
      'Cache-Control': 'private, max-age=3600',
      'Vary': 'x-et-platform',
    },
  })
}
