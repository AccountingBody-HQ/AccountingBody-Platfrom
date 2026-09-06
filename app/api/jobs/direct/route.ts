import { NextRequest, NextResponse } from 'next/server'
import { getActiveDirectJobs, type JobSource, type SeniorityLevel, type EmploymentType } from '@/lib/jobs'

export const dynamic = 'force-dynamic'

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
}

const DEFAULT_LIMIT = 24

const SENIORITY_VALUES: SeniorityLevel[] = ['junior', 'mid', 'senior', 'executive', 'director']
const EMPLOYMENT_TYPE_VALUES: EmploymentType[] = ['permanent', 'contract', 'temporary', 'part_time', 'internship']

function parsePositiveInt(value: string | null, fallback: number): number {
  const n = value ? parseInt(value, 10) : NaN
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

function parseOptionalNumber(value: string | null): number | undefined {
  if (!value) return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function parseCommaList(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
}

function parseSeniorityLevels(value: string | null): SeniorityLevel[] | undefined {
  const values = parseCommaList(value).filter((v): v is SeniorityLevel => SENIORITY_VALUES.includes(v as SeniorityLevel))
  return values.length > 0 ? values : undefined
}

function parseEmploymentTypes(value: string | null): EmploymentType[] | undefined {
  const values = parseCommaList(value).filter((v): v is EmploymentType => EMPLOYMENT_TYPE_VALUES.includes(v as EmploymentType))
  return values.length > 0 ? values : undefined
}

// GET /api/jobs/direct — public, no auth. Returns active employer + Adzuna
// listings for the jobs listings page. RLS on `jobs` (status = 'active')
// already restricts this to publicly-safe rows even if a filter is ever
// missed here.
//
// `count=true` runs a count-only query (no rows returned) — used by the
// client to refresh the total without re-fetching a page of jobs. A normal
// request always includes `total` alongside `jobs` too, so the common case
// (load a page, know the total) is a single request.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.trim() || undefined
  const location = searchParams.get('location')?.trim() || undefined
  const platform = searchParams.get('platform')?.trim() || 'ab'
  const limit = parsePositiveInt(searchParams.get('limit'), DEFAULT_LIMIT)
  const offset = parsePositiveInt(searchParams.get('offset'), 0)
  const countOnly = searchParams.get('count') === 'true'

  const employmentTypes = parseEmploymentTypes(searchParams.get('employment_types'))
  const seniorityLevels = parseSeniorityLevels(searchParams.get('seniority'))
  const remoteOnly = searchParams.get('remote') === 'true' ? true : undefined
  const salaryMin = parseOptionalNumber(searchParams.get('salary_min'))
  const salaryMax = parseOptionalNumber(searchParams.get('salary_max'))
  const postedWithin = parseOptionalNumber(searchParams.get('posted_within'))
  const qualificationsList = parseCommaList(searchParams.get('qualifications'))
  const qualifications = qualificationsList.length > 0 ? qualificationsList : undefined

  const sources: JobSource[] = ['employer', 'adzuna']
  const baseParams = {
    platform,
    search,
    location,
    employmentTypes,
    sources,
    seniorityLevels,
    remoteOnly,
    salaryMin,
    salaryMax,
    postedWithin,
    qualifications,
  }

  try {
    if (countOnly) {
      const total = await getActiveDirectJobs({ ...baseParams, countOnly: true })
      return NextResponse.json({ jobs: [], total }, { headers: NO_CACHE_HEADERS })
    }

    const [jobs, total] = await Promise.all([
      getActiveDirectJobs({ ...baseParams, limit, offset }),
      getActiveDirectJobs({ ...baseParams, countOnly: true }),
    ])
    return NextResponse.json({ jobs, total }, { headers: NO_CACHE_HEADERS })
  } catch (err: unknown) {
    console.error('api/jobs/direct error:', err)
    return NextResponse.json({ jobs: [], total: 0 }, { headers: NO_CACHE_HEADERS })
  }
}
