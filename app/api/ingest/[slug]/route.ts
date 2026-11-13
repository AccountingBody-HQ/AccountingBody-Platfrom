import { NextRequest, NextResponse } from 'next/server'
import { runProviderImport } from '@/lib/ingestion/run-provider-import'

export const maxDuration = 300

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('ingest: not configured')
    return Response.json({ error: 'Not configured' }, { status: 503 })
  }
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { slug } = params

  // 'manual' only when a call asks for it via ?trigger=manual; any other call
  // to this route keeps recording 'cron'. Neither the admin Run now button nor
  // the orchestrator calls this route: each runs runProviderImport directly,
  // with 'manual' and 'cron' respectively.
  const triggerSource = new URL(req.url).searchParams.get('trigger') === 'manual'
    ? 'manual' as const
    : 'cron' as const

  const { status, body } = await runProviderImport(slug, triggerSource)
  return NextResponse.json(body, { status })
}
