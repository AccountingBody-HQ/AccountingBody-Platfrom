/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return false
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const expected = await sha256Hex(secret)
  return token === expected
}

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

// ── GET /api/roodber8/questions/[setId]
// Returns the full question set with all questions ordered by question_order
export async function GET(
  req: NextRequest,
  { params }: { params: { setId: string } }
) {
  if (!(await isAuthenticated(req)))
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { setId } = params
  const supabase = getClient()

  const { data: set, error: setError } = await supabase
    .from('question_sets')
    .select('*')
    .eq('id', setId)
    .single()

  if (setError || !set)
    return NextResponse.json({ error: 'Question set not found' }, { status: 404 })

  const { data: questions, error: qError } = await supabase
    .from('questions')
    .select('*')
    .eq('set_id', setId)
    .order('question_order', { ascending: true })

  if (qError)
    return NextResponse.json({ error: qError.message }, { status: 500 })

  return NextResponse.json({ set, questions: questions ?? [] })
}

// ── PATCH /api/roodber8/questions/[setId]
// body: { action: 'update_set', fields: {...} }
//     | { action: 'update_question', questionId: string, fields: {...} }
//     | { action: 'reorder_questions', order: string[] }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { setId: string } }
) {
  if (!(await isAuthenticated(req)))
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { setId } = params
  const body = await req.json()
  const { action } = body
  const supabase = getClient()

  if (action === 'update_set') {
    const { fields } = body
    if (!fields || typeof fields !== 'object')
      return NextResponse.json({ error: 'fields required' }, { status: 400 })

    // Whitelist updatable set fields
    const ALLOWED_SET_FIELDS = [
      'title', 'slug', 'excerpt', 'difficulty', 'topic',
      'exam_body', 'question_type', 'status', 'show_on_sites',
      'canonical_owner', 'seo_title', 'seo_description',
    ]
    const sanitised: Record<string, any> = {}
    for (const key of ALLOWED_SET_FIELDS) {
      if (key in fields) sanitised[key] = fields[key]
    }
    sanitised.updated_at = new Date().toISOString()

    const { error } = await supabase
      .from('question_sets')
      .update(sanitised)
      .eq('id', setId)

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  }

  if (action === 'update_question') {
    const { questionId, fields } = body
    if (!questionId || !fields)
      return NextResponse.json({ error: 'questionId and fields required' }, { status: 400 })

    // Whitelist updatable question fields
    const ALLOWED_Q_FIELDS = [
      'question_text', 'option_a', 'option_b', 'option_c', 'option_d',
      'correct_index', 'explanation', 'writing_model_answer',
      'writing_explanation', 'primary_topic', 'difficulty',
      'time_target_minutes', 'points',
    ]
    const sanitised: Record<string, any> = {}
    for (const key of ALLOWED_Q_FIELDS) {
      if (key in fields) sanitised[key] = fields[key]
    }

    const { error } = await supabase
      .from('questions')
      .update(sanitised)
      .eq('id', questionId)
      .eq('set_id', setId) // ensure question belongs to this set

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// ── DELETE /api/roodber8/questions/[setId]
// body: { action: 'delete_set' }
//     | { action: 'delete_question', questionId: string }
export async function DELETE(
  req: NextRequest,
  { params }: { params: { setId: string } }
) {
  if (!(await isAuthenticated(req)))
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { setId } = params
  const body = await req.json()
  const { action, questionId } = body
  const supabase = getClient()

  if (action === 'delete_set') {
    // CASCADE in Supabase schema handles question deletion automatically
    const { error } = await supabase
      .from('question_sets')
      .delete()
      .eq('id', setId)

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  }

  if (action === 'delete_question') {
    if (!questionId)
      return NextResponse.json({ error: 'questionId required' }, { status: 400 })

    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', questionId)
      .eq('set_id', setId) // ensure question belongs to this set

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// ── POST /api/roodber8/questions/[setId]
// Add a new question manually to an existing set
export async function POST(
  req: NextRequest,
  { params }: { params: { setId: string } }
) {
  if (!(await isAuthenticated(req)))
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { setId } = params
  const body = await req.json()
  const supabase = getClient()

  // Verify set exists
  const { data: set, error: setError } = await supabase
    .from('question_sets')
    .select('id')
    .eq('id', setId)
    .single()

  if (setError || !set)
    return NextResponse.json({ error: 'Question set not found' }, { status: 404 })

  // Get current max question_order for this set
  const { data: maxRow } = await supabase
    .from('questions')
    .select('question_order')
    .eq('set_id', setId)
    .order('question_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = ((maxRow?.question_order as number) ?? 0) + 1

  const {
    type = 'multiple-choice',
    question_text,
    option_a = '',
    option_b = '',
    option_c = '',
    option_d = '',
    correct_index = 0,
    explanation = '',
    writing_model_answer = null,
    writing_explanation = null,
    primary_topic = '',
    difficulty = 'intermediate',
    time_target_minutes = 2,
    points = 2,
  } = body

  if (!question_text)
    return NextResponse.json({ error: 'question_text is required' }, { status: 400 })

  const { data: inserted, error: insertError } = await supabase
    .from('questions')
    .insert({
      set_id:               setId,
      question_order:       nextOrder,
      type,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_index:        type === 'writing' ? null : correct_index,
      explanation:          type === 'writing' ? null : explanation,
      writing_model_answer: type === 'writing' ? writing_model_answer : null,
      writing_explanation:  type === 'writing' ? writing_explanation : null,
      primary_topic,
      difficulty,
      time_target_minutes,
      points,
    })
    .select('*')
    .single()

  if (insertError || !inserted)
    return NextResponse.json({ error: insertError?.message ?? 'Insert failed' }, { status: 500 })

  return NextResponse.json({ success: true, question: inserted })
}
