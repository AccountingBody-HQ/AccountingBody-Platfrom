import { NextRequest, NextResponse } from 'next/server'
import { getActiveDirectJobs } from '@/lib/jobs'

export const dynamic = 'force-dynamic'

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
}

// GET /api/jobs/direct — public, no auth. Returns active employer-direct
// listings for injection above the Careerjet feed. RLS on `jobs`
// (status = 'active') already restricts this to publicly-safe rows even if
// a filter is ever missed here.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.trim() || undefined
  const location = searchParams.get('location')?.trim() || undefined
  const employmentType = searchParams.get('employment_type')?.trim() || undefined
  const platform = searchParams.get('platform')?.trim() || 'ab'

  try {
    const jobs = await getActiveDirectJobs({ platform, search, location, employmentType })
    return NextResponse.json({ jobs }, { headers: NO_CACHE_HEADERS })
  } catch (err: unknown) {
    console.error('api/jobs/direct error:', err)
    return NextResponse.json({ jobs: [] }, { headers: NO_CACHE_HEADERS })
  }
}
