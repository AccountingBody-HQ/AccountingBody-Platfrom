import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/admin-auth'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

const DEFAULT_ARTICLE_TASK = {
  input_type: null,
  input_value: '',
  prompt_built: false,
  prompt_copied: false,
  json_imported: false,
  published_at: null,
}

const DEFAULT_SOCIAL_TASK = {
  facebook_published: false,
  linkedin_published: false,
  published_at: null,
}

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated(req)))
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const sessionDate = todayDate()

  const { data: existing, error: fetchError } = await supabase
    .from('studio_sessions')
    .select('id, session_date, pq_tasks, article_task, social_task')
    .eq('session_date', sessionDate)
    .maybeSingle()

  if (fetchError)
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 })

  if (existing)
    return NextResponse.json({ session: existing })

  const { data: created, error: insertError } = await supabase
    .from('studio_sessions')
    .insert({
      session_date: sessionDate,
      pq_tasks: [],
      article_task: DEFAULT_ARTICLE_TASK,
      social_task: DEFAULT_SOCIAL_TASK,
    })
    .select('id, session_date, pq_tasks, article_task, social_task')
    .single()

  if (insertError || !created)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })

  return NextResponse.json({ session: created })
}

export async function PATCH(req: NextRequest) {
  if (!(await isAuthenticated(req)))
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body: unknown = await req.json()
  const { pq_tasks, article_task, social_task } = (body ?? {}) as {
    pq_tasks?: unknown
    article_task?: unknown
    social_task?: unknown
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const sessionDate = todayDate()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (pq_tasks !== undefined) updates.pq_tasks = pq_tasks
  if (article_task !== undefined) updates.article_task = article_task
  if (social_task !== undefined) updates.social_task = social_task

  const { data: existing } = await supabase
    .from('studio_sessions')
    .select('id')
    .eq('session_date', sessionDate)
    .maybeSingle()

  if (!existing) {
    const { data: created, error: insertError } = await supabase
      .from('studio_sessions')
      .insert({
        session_date: sessionDate,
        pq_tasks: pq_tasks ?? [],
        article_task: article_task ?? DEFAULT_ARTICLE_TASK,
        social_task: social_task ?? DEFAULT_SOCIAL_TASK,
      })
      .select('id, session_date, pq_tasks, article_task, social_task')
      .single()

    if (insertError || !created)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })

    return NextResponse.json({ session: created })
  }

  const { data: updated, error: updateError } = await supabase
    .from('studio_sessions')
    .update(updates)
    .eq('session_date', sessionDate)
    .select('id, session_date, pq_tasks, article_task, social_task')
    .single()

  if (updateError || !updated)
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })

  return NextResponse.json({ session: updated })
}
