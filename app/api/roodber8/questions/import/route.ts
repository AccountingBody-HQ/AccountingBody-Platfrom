/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { normalise, validateNormalisedBundle } from '@/lib/question-normaliser'

export const runtime = 'nodejs'
export const maxDuration = 30

async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray  = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const token  = req.cookies.get('admin_token')?.value
  if (!token) return false
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const expected = await sha256Hex(secret)
  return token === expected
}

// ── POST /api/roodber8/questions/import
// Accepts raw JSON text (any AI source), normalises it, returns the
// normalised bundle + diff report. Does NOT write to Supabase —
// the client reviews and then calls /api/roodber8/questions/publish.
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req)))
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

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
