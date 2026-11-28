// Refreshes the public article caches after an article write that succeeded
// (the tags are set in lib/db.ts, lib/articles-list.ts and
// lib/featured-articles.ts). Call it only after the write.
//
// The broad tag is always refreshed: 'articles' covers every cached note, the
// category lists, the home lists and the article counts. Known slugs are
// refreshed as well. When a change can alter a practice set's page or the
// practice list (a note's status or sites), pass practiceSets: the broad
// 'question-sets' tag covers every cached set and the list.
//
// Never throws: the write is already done, so a refresh that fails must not
// turn a success into an error. The caches then expire on their own (1 hour).

import { revalidateTag } from 'next/cache'
import { reportServerError } from './report-error'

type Names = readonly (string | null | undefined)[]

export function refreshArticleCaches(known: { slugs?: Names; practiceSets?: boolean } = {}): void {
  const tags = new Set(['articles'])
  for (const slug of known.slugs ?? []) if (slug) tags.add(`article:${slug}`)
  if (known.practiceSets) tags.add('question-sets')
  try {
    tags.forEach((tag) => revalidateTag(tag))
  } catch (error) {
    console.error('article cache refresh failed')
    reportServerError('admin article cache refresh failed', error, { area: 'admin' })
  }
}
