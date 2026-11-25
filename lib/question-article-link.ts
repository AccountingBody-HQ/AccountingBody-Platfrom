// Keeps an article's practice link (articles.mcq_url) in step with its set,
// also when that set comes back from the recycle bin.
//
// Every write is conditional: it changes the link only while it still holds
// the expected value, so a link to a different set is never touched. Nothing
// here throws for a database problem; it becomes a warning to the admin,
// because the caller's own write has already succeeded.

import type { SupabaseClient } from '@supabase/supabase-js'
import { checkRead } from './db-check'
import {
  CHECKED_CASE_COLUMNS,
  CHECKED_QUESTION_COLUMNS,
  LINK_FAILED,
  RESTORED_AS_DRAFT,
  RESTORE_CHECK_FAILED,
  UNLINK_FAILED,
  checkStoredSet,
  notLinkedOtherSetMessage,
} from './question-publish-checks'
import { BIN_TABLE, errorCode } from './recycle-bin'

const address = (setSlug: string) => `/practice-questions/${setSlug}`

// The address of the set an article's link names (also as a full web address,
// with a trailing slash or a query), or null when it names none.
export function linkedSetSlug(mcqUrl: unknown): string | null {
  const match = typeof mcqUrl === 'string' ? mcqUrl.trim().match(/^(?:https?:\/\/[^/]+)?\/practice-questions\/([^/?#]+)/i) : null
  return match ? match[1] : null
}

// The published article's link becomes the set's, while it still is the link
// that was read. False when not exactly one row changed.
export async function setArticleLink(
  supabase: SupabaseClient,
  articleSlug: string,
  readLink: string | null,
  setSlug: string,
): Promise<boolean> {
  const update = supabase
    .from('articles')
    .update({ mcq_url: address(setSlug), updated_at: new Date().toISOString() })
    .eq('slug', articleSlug)
    .eq('status', 'published')
  const { data, error } = await (readLink === null ? update.is('mcq_url', null) : update.eq('mcq_url', readLink)).select('slug')
  if (error || data?.length !== 1) {
    console.error('question article link: not saved', error ? errorCode(error) : 'no_row')
    return false
  }
  return true
}

// The article's link to the old address becomes the new one, or is removed
// (newSlug null). No change when the article does not point to the old address.
export async function replaceArticleLink(
  supabase: SupabaseClient,
  articleSlug: string,
  oldSlug: string,
  newSlug: string | null,
): Promise<boolean> {
  const { error } = await supabase
    .from('articles')
    .update({ mcq_url: newSlug ? address(newSlug) : null, updated_at: new Date().toISOString() })
    .eq('slug', articleSlug)
    .eq('mcq_url', address(oldSlug))
  if (error) console.error('question article link: not replaced', errorCode(error))
  return !error
}

// What the admin is told when the article does not point to the set; empty
// when it does.
export type LinkNotes = { linkWarning?: string; linkNote?: string }

// The published article points to the set, unless it already points somewhere.
// A link to another set is kept, and named. The warning: there is no such
// article, not exactly one row changed, or its link is no set's address.
export async function linkArticleIfEmpty(supabase: SupabaseClient, articleSlug: string, setSlug: string): Promise<LinkNotes> {
  const failed = { linkWarning: LINK_FAILED }
  const read = checkRead(
    await supabase.from('articles').select('mcq_url').eq('slug', articleSlug).eq('status', 'published').limit(1).maybeSingle(),
    'question article link: article',
  )
  if (!read.ok || !read.data) return failed
  const link = (read.data.mcq_url as string | null | undefined) ?? null
  if (!link) return (await setArticleLink(supabase, articleSlug, link, setSlug)) ? {} : failed

  const linkedSlug = linkedSetSlug(link)
  if (linkedSlug === setSlug) return {}
  if (!linkedSlug) return failed
  const other = checkRead(
    await supabase.from('question_sets').select('title').eq('slug', linkedSlug).limit(1).maybeSingle(),
    'question article link: set the article points to',
  )
  return other.ok && other.data ? { linkNote: notLinkedOtherSetMessage(other.data.title as string) } : failed
}

type RestoredSet = {
  id: string
  slug: string
  status: string | null
  article_slug: string | null
  published_at: string | null
  created_at: string | null
}

// Whether a stored set has questions and all are complete; null when it could
// not be read.
async function isComplete(supabase: SupabaseClient, setId: string): Promise<boolean | null> {
  const questions = checkRead(
    await supabase
      .from('questions')
      .select(CHECKED_QUESTION_COLUMNS)
      .eq('set_id', setId)
      .order('question_order', { ascending: true }),
    'question restore: questions',
  )
  const cases = checkRead(
    await supabase.from('question_cases').select(CHECKED_CASE_COLUMNS).eq('set_id', setId),
    'question restore: cases',
  )
  if (!questions.ok || !cases.ok) return null
  return Boolean(questions.data?.length) && checkStoredSet(questions.data ?? [], cases.data ?? []).ok
}

// The published set becomes a draft. Its published date stays (or is filled),
// so its web address stays locked. False when not exactly one row changed.
async function makeDraft(supabase: SupabaseClient, set: RestoredSet): Promise<boolean> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('question_sets')
    .update({ status: 'draft', updated_at: now, ...(set.published_at ? {} : { published_at: set.created_at ?? now }) })
    .eq('id', set.id)
    .eq('status', 'published')
    .select('id')
  if (error || data?.length !== 1) {
    console.error('question restore: not made a draft', error ? errorCode(error) : 'no_row')
    return false
  }
  return true
}

export type RestoreNotes = LinkNotes & { restoreNote?: string; unlinkWarning?: string }

// After a question set, or one question, came back from the recycle bin. A
// published set that is not complete becomes a draft and is unlinked from its
// article; a complete set that came back is linked from its article again.
// set is null when it could not be found.
export async function settleRestoredSet(
  supabase: SupabaseClient,
  binId: string,
  restored: 'set' | 'question',
): Promise<{ set: RestoredSet | null; notes: RestoreNotes }> {
  const notes: RestoreNotes = {}
  const unread = { set: null, notes: { restoreNote: RESTORE_CHECK_FAILED, ...(restored === 'set' ? { linkWarning: LINK_FAILED } : {}) } }

  const item = checkRead(
    await supabase.from(BIN_TABLE).select('source_id').eq('id', binId).maybeSingle(),
    'question article link: restored item',
  )
  if (!item.ok) return unread
  let setId = item.data?.source_id as string | null | undefined
  if (setId && restored === 'question') {
    const question = checkRead(
      await supabase.from('questions').select('set_id').eq('id', setId).maybeSingle(),
      'question restore: restored question',
    )
    if (!question.ok) return unread
    setId = question.data?.set_id as string | null | undefined
  }
  if (!setId) return { set: null, notes }

  const read = checkRead(
    await supabase
      .from('question_sets')
      .select('id, slug, status, article_slug, published_at, created_at')
      .eq('id', setId)
      .maybeSingle(),
    'question article link: restored set',
  )
  if (!read.ok) return unread
  const set = (read.data as RestoredSet | null) ?? null
  if (set?.status !== 'published') return { set, notes }

  const complete = await isComplete(supabase, set.id)
  if (complete === false && (await makeDraft(supabase, set))) {
    notes.restoreNote = RESTORED_AS_DRAFT
    if (set.article_slug && !(await replaceArticleLink(supabase, set.article_slug, set.slug, null))) notes.unlinkWarning = UNLINK_FAILED
    return { set, notes }
  }
  if (!complete) notes.restoreNote = RESTORE_CHECK_FAILED
  if (restored === 'set' && set.article_slug) Object.assign(notes, await linkArticleIfEmpty(supabase, set.article_slug, set.slug))
  return { set, notes }
}
