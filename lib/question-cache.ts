// Refreshes the public question caches after a question write that succeeded
// (the tags are set in lib/db.ts). Call it only after the write.
//
// The broad tags are always refreshed: 'question-sets' covers every cached
// set, its questions and cases, and the list; 'questions' covers the counts.
// Known slugs and ids are refreshed as well, and the linked article's page.
//
// Never throws: the write is already done, so a refresh that fails must not
// turn a success into an error. The caches then expire on their own (1 hour).

import { revalidateTag } from 'next/cache'
import { reportServerError } from './report-error'

type Names = readonly (string | null | undefined)[]

export function refreshQuestionCaches(known: { slugs?: Names; setIds?: Names; articleSlugs?: Names } = {}): void {
  const tags = new Set(['question-sets', 'questions'])
  for (const slug of known.slugs ?? []) if (slug) tags.add(`question-set:${slug}`)
  for (const id of known.setIds ?? []) if (id) tags.add(`question-set-id:${id}`)
  for (const slug of known.articleSlugs ?? []) if (slug) tags.add(`article:${slug}`)
  try {
    tags.forEach((tag) => revalidateTag(tag))
  } catch (error) {
    console.error('question cache refresh failed')
    reportServerError('admin question cache refresh failed', error, { area: 'admin' })
  }
}
