import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/admin-auth'
import { normaliseArticle, validateNormalisedArticle } from '@/lib/article-normaliser'

export const runtime = 'nodejs'
export const maxDuration = 30

// ── POST /api/roodber8/articles/import
// Accepts raw article JSON (any source, any field names), normalises it via
// lib/article-normaliser.ts, returns the normalised article + diff report.
// Does NOT write to Supabase — the client reviews and then calls
// /api/roodber8/articles/publish.
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body: unknown = await req.json()
  const rawJson = (body as { rawJson?: unknown } | null)?.rawJson

  if (!rawJson || typeof rawJson !== 'string' || !rawJson.trim()) {
    return NextResponse.json(
      { error: 'rawJson (string) is required' },
      { status: 400 }
    )
  }

  try {
    // Run the normaliser — throws on unrecoverable parse failure
    const { article, changes, warnings } = normaliseArticle(rawJson)

    // Validate for publish-readiness
    const validationErrors = validateNormalisedArticle(article)

    return NextResponse.json({
      article,
      changes,
      warnings,
      validationErrors,
      ready: validationErrors.length === 0,
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to normalise JSON'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
