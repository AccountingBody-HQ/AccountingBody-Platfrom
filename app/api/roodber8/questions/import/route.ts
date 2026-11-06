/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated, signedOutResponse } from '@/lib/admin-auth'
import { normalise, validateNormalisedBundle } from '@/lib/question-normaliser'

export const runtime = 'nodejs'
export const maxDuration = 30

// ── POST /api/roodber8/questions/import
// Accepts raw JSON text (any AI source), normalises it, returns the
// normalised bundle + diff report. Does NOT write to Supabase —
// the client reviews and then calls /api/roodber8/questions/publish.
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req)))
    return signedOutResponse()

  try {
    const body = await req.json()
    const { rawJson } = body

    if (!rawJson || typeof rawJson !== 'string' || !rawJson.trim()) {
      return NextResponse.json(
        { error: 'rawJson (string) is required' },
        { status: 400 }
      )
    }

    // Run the normaliser — throws on unrecoverable parse failure
    const { bundle, changes, warnings } = normalise(rawJson)

    // Validate for publish-readiness
    const validationErrors = validateNormalisedBundle(bundle)

    return NextResponse.json({
      bundle,
      changes,
      warnings,
      validationErrors,
      ready: validationErrors.length === 0,
      stats: {
        total:    bundle.questions.length,
        mcq:      bundle.questions.filter(q => q.type === 'multiple-choice').length,
        scenario: bundle.questions.filter(q => q.type === 'scenario').length,
        writing:  bundle.questions.filter(q => q.type === 'writing').length,
        cases:    bundle.cases.length,
      },
    })

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Failed to normalise JSON' },
      { status: 422 }
    )
  }
}
