import { NextRequest } from 'next/server'
import { isAuthenticated, signedOutResponse } from '@/lib/admin-auth'
import { reportServerError } from '@/lib/report-error'
import { runProviderImport } from '@/lib/ingestion/run-provider-import'

export const maxDuration = 300

// ── POST (admin) providers/[slug]/trigger ── manually run ingestion now
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAuthenticated(req))) {
    return signedOutResponse()
  }

  const { slug } = await params

  // Imports start from here only where the scheduled-import secret is set.
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return Response.json(
      { ok: false, error: 'Not configured' },
      { status: 500 }
    )
  }

  try {
    // Runs the import here and passes its answer on unchanged.
    const { status, body } = await runProviderImport(slug, 'manual')
    return Response.json(body, { status })
  } catch (err: unknown) {
    const code = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined
    console.error('admin provider run start failed', typeof code === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(code) ? code : 'no-code')
    reportServerError('admin provider run start failed', err, { area: 'admin' })
    return Response.json({ ok: false, error: 'Run failed' }, { status: 500 })
  }
}
