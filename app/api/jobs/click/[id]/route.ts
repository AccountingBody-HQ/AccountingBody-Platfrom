import { NextRequest, NextResponse } from 'next/server'
import { incrementJobClicks } from '@/lib/jobs'
import { reportServerError } from '@/lib/report-error'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string }> }

// POST /api/jobs/click/[id] — public, no auth, fire-and-forget click
// tracking. Always returns 200; incrementJobClicks itself never throws.
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    await incrementJobClicks(id)
  } catch (err: unknown) {
    console.error('api/jobs/click error (non-fatal):', err)
    reportServerError('job click failed', err, { area: 'public' })
  }
  return NextResponse.json({ success: true })
}
