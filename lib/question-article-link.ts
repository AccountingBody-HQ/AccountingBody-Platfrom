// Keeps an article's practice link (articles.mcq_url) in step with its set.
//
// Every write is conditional: it changes the link only while it still holds
// the expected value, so a link to a different set is never touched. Nothing
// here throws for a database problem; the caller turns false into a warning,
// because its own write has already succeeded.

import type { SupabaseClient } from '@supabase/supabase-js'
import { checkRead } from './db-check'
import { BIN_TABLE, errorCode } from './recycle-bin'

const address = (setSlug: string) => `/practice-questions/${setSlug}`

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

// The published article points to the set, unless it already points somewhere.
// False when there is no such article, or not exactly one row changed.
export async function linkArticleIfEmpty(supabase: SupabaseClient, articleSlug: string, setSlug: string): Promise<boolean> {
  const read = checkRead(
    await supabase.from('articles').select('mcq_url').eq('slug', articleSlug).eq('status', 'published').limit(1).maybeSingle(),
    'question article link: article',
  )
  if (!read.ok || !read.data) return false
  if (read.data.mcq_url) return true

  const update = supabase
    .from('articles')
    .update({ mcq_url: address(setSlug), updated_at: new Date().toISOString() })
    .eq('slug', articleSlug)
    .eq('status', 'published')
  const { data, error } = await (read.data.mcq_url === '' ? update.eq('mcq_url', '') : update.is('mcq_url', null)).select('slug')
  if (error || data?.length !== 1) {
    console.error('question article link: not saved', error ? errorCode(error) : 'no_row')
    return false
  }
  return true
}

type RestoredSet = { id: string; slug: string; status: string | null; article_slug: string | null }

// After a question set came back from the recycle bin: a published set is
// linked from its article again. set is null when it could not be found.
export async function linkRestoredSet(supabase: SupabaseClient, binId: string): Promise<{ linked: boolean; set: RestoredSet | null }> {
  const item = checkRead(
    await supabase.from(BIN_TABLE).select('source_id').eq('id', binId).maybeSingle(),
    'question article link: restored item',
  )
  if (!item.ok) return { linked: false, set: null }
  if (!item.data?.source_id) return { linked: true, set: null }

  const read = checkRead(
    await supabase.from('question_sets').select('id, slug, status, article_slug').eq('id', item.data.source_id).maybeSingle(),
    'question article link: restored set',
  )
  if (!read.ok) return { linked: false, set: null }
  const set = (read.data as RestoredSet | null) ?? null
  if (!set?.article_slug || set.status !== 'published') return { linked: true, set }
  return { linked: await linkArticleIfEmpty(supabase, set.article_slug, set.slug), set }
}
