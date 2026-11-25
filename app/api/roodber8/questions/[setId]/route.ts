/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated, signedOutResponse } from '@/lib/admin-auth'
import { getServerSupabase } from '@/lib/supabase-server'
import { checkRead } from '@/lib/db-check'
import { linkArticleIfEmpty, replaceArticleLink, type LinkNotes } from '@/lib/question-article-link'
import { refreshQuestionCaches } from '@/lib/question-cache'
import {
  CHECKED_CASE_COLUMNS,
  CHECKED_QUESTION_COLUMNS,
  LAST_QUESTION,
  NOT_READY_EMPTY,
  SET_CHECK_FAILED,
  SLUG_LOCKED,
  UNLINK_FAILED,
  checkStoredSet,
  fixThisQuestionMessage,
  notReadyProblemsMessage,
  storedQuestionReasons,
} from '@/lib/question-publish-checks'
import { DELETE_FAILED, errorCode, keepCopyBeforeDelete, snapshotQuestionSet, snapshotRows } from '@/lib/recycle-bin'

export const runtime = 'nodejs'

const QUESTION_NOT_FOUND = 'Question not found'

function getClient() {
  return getServerSupabase('admin')
}

// ── GET /api/roodber8/questions/[setId]
// Returns the full question set with all questions ordered by question_order
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ setId: string }> }
) {
  if (!(await isAuthenticated(req)))
    return signedOutResponse()

  const { setId } = await params
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
  { params }: { params: Promise<{ setId: string }> }
) {
  if (!(await isAuthenticated(req)))
    return signedOutResponse()

  const { setId } = await params
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

    // The set as it is now. A change of status or address needs it, so a
    // failed read stops those. Otherwise it only names the caches to refresh
    // (the broad tags cover every set).
    const before = checkRead(
      await supabase
        .from('question_sets')
        .select('slug, article_slug, status, published_at, created_at')
        .eq('id', setId)
        .maybeSingle(),
      'questions/[setId]: set before update',
    )
    const statusGiven = 'status' in sanitised
    if (!before.ok && (statusGiven || 'slug' in sanitised))
      return NextResponse.json({ error: SET_CHECK_FAILED }, { status: 500 })
    if (before.ok && !before.data)
      return NextResponse.json({ error: 'Question set not found' }, { status: 404 })
    const old = before.ok ? before.data : null

    const wasPublished = old?.status === 'published'
    const isPublished = statusGiven ? sanitised.status === 'published' : wasPublished
    const slugChanged = 'slug' in sanitised && sanitised.slug !== old?.slug

    // An address that is live, or ever was, never changes. published_at is set
    // when a set first goes live, and is never cleared.
    if (slugChanged && (wasPublished || isPublished || old?.published_at))
      return NextResponse.json({ error: SLUG_LOCKED }, { status: 400 })

    // A set goes live only with questions, and only when all are complete.
    if (isPublished && !wasPublished) {
      const questions = checkRead(
        await supabase
          .from('questions')
          .select(CHECKED_QUESTION_COLUMNS)
          .eq('set_id', setId)
          .order('question_order', { ascending: true }),
        'questions/[setId]: questions before publishing',
      )
      const cases = checkRead(
        await supabase.from('question_cases').select(CHECKED_CASE_COLUMNS).eq('set_id', setId),
        'questions/[setId]: cases before publishing',
      )
      if (!questions.ok || !cases.ok)
        return NextResponse.json({ error: SET_CHECK_FAILED }, { status: 500 })
      if (!questions.data?.length)
        return NextResponse.json({ error: NOT_READY_EMPTY }, { status: 400 })
      const checked = checkStoredSet(questions.data, cases.data ?? [])
      if (!checked.ok)
        return NextResponse.json({ error: notReadyProblemsMessage(checked.problems) }, { status: 400 })
    }

    // A draft that was never published gets its date now (the public list
    // sorts by it).
    if (isPublished && !wasPublished && !old?.published_at)
      sanitised.published_at = sanitised.updated_at

    // A live set without that date keeps the sign that it was live.
    if (wasPublished && !isPublished && !old?.published_at)
      sanitised.published_at = old?.created_at ?? sanitised.updated_at

    const { error } = await supabase
      .from('question_sets')
      .update(sanitised)
      .eq('id', setId)

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 })

    // The article's link follows the set.
    let linkNotes: LinkNotes = {}
    let unlinkWarning: string | undefined
    if (old?.article_slug && old.slug) {
      if (slugChanged) {
        const newSlug = typeof sanitised.slug === 'string' && sanitised.slug.trim() ? sanitised.slug : null
        if (!(await replaceArticleLink(supabase, old.article_slug, old.slug, newSlug))) unlinkWarning = UNLINK_FAILED
      } else if (statusGiven && !isPublished) {
        if (!(await replaceArticleLink(supabase, old.article_slug, old.slug, null))) unlinkWarning = UNLINK_FAILED
      } else if (isPublished && !wasPublished) {
        linkNotes = await linkArticleIfEmpty(supabase, old.article_slug, old.slug)
      }
    }

    refreshQuestionCaches({
      slugs: [old?.slug, sanitised.slug],
      setIds: [setId],
      articleSlugs: [old?.article_slug],
    })
    return NextResponse.json({
      success: true,
      ...linkNotes,
      ...(unlinkWarning ? { unlinkWarning } : {}),
    })
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

    // The question as it would be after the edit must be complete.
    const stored = checkRead(
      await supabase
        .from('questions')
        .select(CHECKED_QUESTION_COLUMNS)
        .eq('id', questionId)
        .eq('set_id', setId) // ensure question belongs to this set
        .maybeSingle(),
      'questions/[setId]: question before update',
    )
    if (!stored.ok)
      return NextResponse.json({ error: SET_CHECK_FAILED }, { status: 500 })
    if (!stored.data)
      return NextResponse.json({ error: QUESTION_NOT_FOUND }, { status: 404 })
    const reasons = storedQuestionReasons({ ...stored.data, ...sanitised })
    if (reasons.length > 0)
      return NextResponse.json({ error: fixThisQuestionMessage(reasons) }, { status: 400 })

    const { data: updated, error } = await supabase
      .from('questions')
      .update(sanitised)
      .eq('id', questionId)
      .eq('set_id', setId)
      .select('id')

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    if (updated.length !== 1)
      return NextResponse.json({ error: QUESTION_NOT_FOUND }, { status: 404 })

    refreshQuestionCaches({ setIds: [setId] })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// ── DELETE /api/roodber8/questions/[setId]
// body: { action: 'delete_set' }
//     | { action: 'delete_question', questionId: string }
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ setId: string }> }
) {
  if (!(await isAuthenticated(req)))
    return signedOutResponse()

  const { setId } = await params
  const body = await req.json()
  const { action, questionId } = body
  const supabase = getClient()

  if (action === 'delete_set') {
    // A copy of the set, its questions and case exhibits goes to the recycle bin first.
    const kept = await keepCopyBeforeDelete(supabase, await snapshotQuestionSet(supabase, setId), {
      kind: 'question_set',
      sourceTable: 'question_sets',
      sourceId: setId,
      label: (row) => row.title,
      notFound: 'Question set not found',
    })
    if (!kept.ok)
      return NextResponse.json({ error: kept.error }, { status: kept.status })

    // CASCADE in Supabase schema handles question deletion automatically
    const { error } = await supabase
      .from('question_sets')
      .delete()
      .eq('id', setId)

    if (error) {
      console.error('questions/[setId] delete_set failed', errorCode(error))
      return NextResponse.json({ error: DELETE_FAILED }, { status: 500 })
    }

    // An article that points to this set would now point to a missing page.
    const slug = kept.row.slug as string | null | undefined
    const articleSlug = kept.row.article_slug as string | null | undefined
    const unlinked = !articleSlug || !slug || (await replaceArticleLink(supabase, articleSlug, slug, null))

    refreshQuestionCaches({
      slugs: [slug],
      setIds: [setId],
      articleSlugs: [articleSlug],
    })
    return NextResponse.json({ success: true, binId: kept.binId, ...(unlinked ? {} : { unlinkWarning: UNLINK_FAILED }) })
  }

  if (action === 'delete_question') {
    if (!questionId)
      return NextResponse.json({ error: 'questionId required' }, { status: 400 })

    // A live set is never empty.
    const set = checkRead(
      await supabase.from('question_sets').select('status').eq('id', setId).maybeSingle(),
      'questions/[setId]: set before question delete',
    )
    if (!set.ok)
      return NextResponse.json({ error: DELETE_FAILED }, { status: 500 })
    if (set.data?.status === 'published') {
      const others = checkRead(
        await supabase.from('questions').select('id').eq('set_id', setId).limit(2),
        'questions/[setId]: questions before question delete',
      )
      if (!others.ok)
        return NextResponse.json({ error: DELETE_FAILED }, { status: 500 })
      if (others.data?.length === 1 && String(others.data[0].id) === String(questionId))
        return NextResponse.json({ error: LAST_QUESTION }, { status: 400 })
    }

    // A copy of the question goes to the recycle bin first.
    const kept = await keepCopyBeforeDelete(
      supabase,
      await snapshotRows(supabase, 'questions', { id: String(questionId), set_id: setId }),
      {
        kind: 'question',
        sourceTable: 'questions',
        sourceId: String(questionId),
        label: (row) => row.question_text,
        notFound: QUESTION_NOT_FOUND,
      },
    )
    if (!kept.ok)
      return NextResponse.json({ error: kept.error }, { status: kept.status })

    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', questionId)
      .eq('set_id', setId) // ensure question belongs to this set

    if (error) {
      console.error('questions/[setId] delete_question failed', errorCode(error))
      return NextResponse.json({ error: DELETE_FAILED }, { status: 500 })
    }

    refreshQuestionCaches({ setIds: [setId] })
    return NextResponse.json({ success: true, binId: kept.binId })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// ── POST /api/roodber8/questions/[setId]
// Add a new question manually to an existing set
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ setId: string }> }
) {
  if (!(await isAuthenticated(req)))
    return signedOutResponse()

  const { setId } = await params
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
  const maxRow = checkRead(
    await supabase
      .from('questions')
      .select('question_order')
      .eq('set_id', setId)
      .order('question_order', { ascending: false })
      .limit(1)
      .maybeSingle(),
    'question order lookup',
  )
  if (!maxRow.ok)
    return NextResponse.json({ error: 'Could not work out the next position. Nothing was added.' }, { status: 500 })

  const nextOrder = ((maxRow.data?.question_order as number) ?? 0) + 1

  const {
    type = 'multiple-choice',
    question_text,
    option_a = '',
    option_b = '',
    option_c = '',
    option_d = '',
    correct_index = null,
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

  const row = {
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
  }
  const reasons = storedQuestionReasons(row)
  if (reasons.length > 0)
    return NextResponse.json({ error: fixThisQuestionMessage(reasons) }, { status: 400 })

  const { data: inserted, error: insertError } = await supabase
    .from('questions')
    .insert(row)
    .select('*')
    .single()

  if (insertError || !inserted)
    return NextResponse.json({ error: insertError?.message ?? 'Insert failed' }, { status: 500 })

  refreshQuestionCaches({ setIds: [setId] })
  return NextResponse.json({ success: true, question: inserted })
}
