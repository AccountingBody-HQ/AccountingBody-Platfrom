// app/api/mock-exam/route.ts
// AB mock exam — up to 50 questions of one subject (article category). The
// subject's pool of question ids is read in pages and cached
// (lib/mock-exam-pool.ts); each attempt reads only the questions it serves.
import { NextRequest, NextResponse } from 'next/server'
import { reportServerError } from '@/lib/report-error'
import { SERVER_PROBLEM_TEXT } from '@/lib/message-rules'
import { parseMockExamCount } from '@/lib/mock-exam-question'
import { getAbMockPool, isMockPoolReadError, serveFromPool } from '@/lib/mock-exam-pool'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// force-dynamic alone does NOT stop Next caching fetch() calls in route
// handlers (Data Cache, up to 1 year, survives deploys). Do not remove.
// 'default-no-store' keeps every plain read uncached while the pool's
// unstable_cache entries are still read ('force-no-store' would skip them).
export const fetchCache = 'default-no-store'

// The visitor gets the shared text; the log keeps the short code only.
function readFailed(error: { code?: string }) {
  console.error('mock exam: read failed', error.code || 'no-code')
  return NextResponse.json({ error: SERVER_PROBLEM_TEXT }, { status: 500 })
}

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category') ?? ''
  const count    = parseMockExamCount(req.nextUrl.searchParams.get('count'))

  if (!category) {
    return NextResponse.json({ error: 'category parameter is required' }, { status: 400 })
  }

  try {
    const pool = await getAbMockPool(category)
    return NextResponse.json(await serveFromPool(pool, count))
  } catch (e: unknown) {
    if (isMockPoolReadError(e)) return readFailed(e)
    reportServerError('mock exam load failed', e, { area: 'public' })
    return NextResponse.json({ error: SERVER_PROBLEM_TEXT }, { status: 500 })
  }
}
