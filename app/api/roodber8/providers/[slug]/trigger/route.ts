import { NextRequest } from 'next/server'
import { isAuthenticated } from '@/lib/admin-auth'

// ── POST /api/roodber8/providers/[slug]/trigger ── manually run ingestion now
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAuthenticated(req))) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = await params

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return Response.json(
      { ok: false, error: 'CRON_SECRET is not configured' },
      { status: 500 }
    )
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://accountingbody.com'

  try {
    const res = await fetch(`${siteUrl}/api/ingest/${slug}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    })

    const data: unknown = await res.json()
    return Response.json(data, { status: res.status })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}
