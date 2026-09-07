import { NextRequest } from 'next/server'

async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return false
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const expected = await sha256Hex(secret)
  return token === expected
}

// ── POST /api/roodber8/providers/[slug]/trigger ── manually run ingestion now
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  if (!(await isAuthenticated(req))) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { slug } = params
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://accountingbody.com'

  try {
    const res = await fetch(`${siteUrl}/api/ingest/${slug}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    })

    const data: unknown = await res.json()
    return Response.json(data, { status: res.status })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}
