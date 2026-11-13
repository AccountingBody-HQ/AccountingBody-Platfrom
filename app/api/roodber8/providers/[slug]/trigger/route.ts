import { NextRequest } from 'next/server'
import { isAuthenticated, signedOutResponse } from '@/lib/admin-auth'
import { reportServerError } from '@/lib/report-error'

// ── POST /api/roodber8/providers/[slug]/trigger ── manually run ingestion now
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAuthenticated(req))) {
    return signedOutResponse()
  }

  const { slug } = await params

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return Response.json(
      { ok: false, error: 'Not configured' },
      { status: 500 }
    )
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://accountingbody.com'

  try {
    const res = await fetch(`${siteUrl}/api/ingest/${slug}?trigger=manual`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    })

    const data: unknown = await res.json()
    return Response.json(data, { status: res.status })
  } catch (err: unknown) {
    const code = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined
    console.error('admin provider run start failed', typeof code === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(code) ? code : 'no-code')
    reportServerError('admin provider run start failed', err, { area: 'admin' })
    return Response.json({ ok: false, error: 'Run failed' }, { status: 500 })
  }
}
