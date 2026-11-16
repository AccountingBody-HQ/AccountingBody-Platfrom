import { getArticleBySlug, getPublicQuestionSetBySlug } from '@/lib/db'
import { resolveArticlePath } from '@/lib/article-path'
import { LEGACY_RENAMED_SLUGS } from '@/lib/legacy-redirect-map'

// The current page for an old, renamed slug from the frozen SEO redirect map
// (lib/legacy-redirect-map.ts): an article's canonical path, or
// /practice-questions/<slug> for a question set. Null when the slug is not in
// the map or its target is not published. A slug not in the map is never read
// from the database. Reader errors are not caught: a database failure must
// give the 500 error page, never a 404.
export async function resolveLegacyRenamedPath(stored: string): Promise<string | null> {
  const target = LEGACY_RENAMED_SLUGS.get(stored)
  if (!target) return null
  if (target.kind === 'article') {
    const found = await getArticleBySlug(target.slug)
    return found ? resolveArticlePath(found) : null
  }
  if (target.kind === 'question-set') {
    const found = await getPublicQuestionSetBySlug(target.slug)
    return found ? '/practice-questions/' + found.slug : null
  }
  return null
}
