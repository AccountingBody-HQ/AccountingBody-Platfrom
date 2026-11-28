// Safety rules for editing and deleting a study note (an articles row).
//
// - The web address of a published note never changes (the same rule as a
//   practice set's address). For notes, published_at is not used for this:
//   an import sets it even on a draft, so it does not mean "was live".
// - A note that a practice set links to (question_sets.article_slug, any
//   status) keeps its address and cannot be deleted. The set would otherwise
//   point at a missing note.
//
// The reads use checkRead (lib/db-check.ts): a read that fails stops the
// change, and only the error code is logged.

import type { SupabaseClient } from '@supabase/supabase-js'
import { checkRead } from './db-check'

export const NOTE_SLUG_LOCKED = 'The web address of a published study note cannot be changed.'
export const NOTE_SLUG_HAS_SET =
  'This study note has a practice set, so its web address cannot be changed. Nothing was saved.'
export const NOTE_HAS_SET =
  'This study note has a practice set. Delete the set or link it to another note first. Nothing was deleted.'
export const NOTE_CHECK_FAILED = 'Could not check this study note. Nothing was saved.'
export const NOTE_DELETE_CHECK_FAILED = 'Could not check this study note. Nothing was deleted.'

// True when the address may not change: the note is published now, or this
// save publishes it.
export function isNoteAddressLocked(wasStatus: unknown, newStatus: unknown, statusGiven: boolean): boolean {
  return wasStatus === 'published' || (statusGiven && newStatus === 'published')
}

// Whether any practice set (any status) links to this note.
// null means the read failed; the caller must not act.
export async function noteHasPracticeSet(supabase: SupabaseClient, slug: string, label: string): Promise<boolean | null> {
  const read = checkRead(
    await supabase.from('question_sets').select('id', { count: 'exact', head: true }).eq('article_slug', slug),
    label,
  )
  if (!read.ok || read.count === null) return null
  return read.count > 0
}
