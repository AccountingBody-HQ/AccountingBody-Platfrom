// Reads one published study note, the whole of it, for the Content Studio.
// The server always rebuilds the brief from this read, never from the browser.
import { checkRead } from '@/lib/db-check'
import { getServerSupabase } from '@/lib/supabase-server'

export interface StudyNote {
  contentId: string
  title: string
  slug: string
  category: string
  categoryTitle: string
  eticpaLevel: string | null
  eticpaModule: string | null
  html: string
  setTitle: string | null
}

export type NoteRead = { kind: 'found'; note: StudyNote } | { kind: 'not-found' } | { kind: 'error' }

const NOTE_COLUMNS = 'content_id, title, slug, category, category_title, eticpa_level, eticpa_module, content'

/** A study note ID as AB-ART-<digits>, upper-case, or null. */
export function normaliseNoteId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const id = raw.trim().toUpperCase()
  return /^AB-ART-[0-9]{1,10}$/.test(id) ? id : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function optional(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

export async function readStudyNote(contentId: string): Promise<NoteRead> {
  const supabase = getServerSupabase('admin')
  const noteRead = checkRead(
    await supabase.from('articles').select(NOTE_COLUMNS).eq('content_id', contentId).eq('status', 'published').limit(1).maybeSingle(),
    'content studio: study note',
  )
  if (!noteRead.ok) return { kind: 'error' }
  const row = noteRead.data as Record<string, unknown> | null
  if (!row) return { kind: 'not-found' }
  const html = text(row.content)
  const slug = text(row.slug)
  // A note without text or address cannot be written from: treated as not published.
  if (html.trim() === '' || slug === '' || text(row.title).trim() === '') return { kind: 'not-found' }

  const setRead = checkRead(
    await supabase.from('question_sets').select('title').eq('article_slug', slug).limit(1).maybeSingle(),
    'content studio: existing set',
  )
  if (!setRead.ok) return { kind: 'error' }
  const set = setRead.data as Record<string, unknown> | null

  return {
    kind: 'found',
    note: {
      contentId: text(row.content_id) || contentId,
      title: text(row.title),
      slug,
      category: text(row.category),
      categoryTitle: text(row.category_title),
      eticpaLevel: optional(row.eticpa_level),
      eticpaModule: optional(row.eticpa_module),
      html,
      setTitle: set ? text(set.title) || null : null,
    },
  }
}
