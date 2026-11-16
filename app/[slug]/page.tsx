import { notFound, permanentRedirect } from 'next/navigation'
import { getArticleBySlug, getPublicQuestionSetBySlug } from '@/lib/db'
import { resolveArticlePath } from '@/lib/article-path'
import { LEGACY_RENAMED_SLUGS } from '@/lib/legacy-redirect-map'
import { LEGACY_SLUG_RE, toStoredSlug } from '@/lib/slug-param'

// Old WordPress single-segment addresses (/<slug> and /<slug>/) live on in
// Further Reading links inside published articles, in old search results and
// in outside backlinks. Version 2 sends each one in ONE permanent (308) hop to
// the current page on the same host, checking in this order:
//   1. a published article with that slug → its canonical path
//      (/study/<category>/<slug>, or /articles/<slug> without a category);
//   2. a published practice-question set → /practice-questions/<slug>;
//   3. a renamed slug from the frozen SEO redirect map
//      (lib/legacy-redirect-map.ts) → the target's current page, or 404 if
//      the target is not published.
// Otherwise 404. Current content always wins over the history map.
//
// The address is first turned into the stored slug form (lib/slug-param.ts),
// which is already escaped, so the redirect target is not encoded again. It
// never shadows a static top-level route (those always win over this dynamic
// segment), and a path that is not slug-shaped (dots, slashes, spaces,
// uppercase, bad encoding, too long — /wp-login.php, /favicon.ico and the
// like) gets a 404 without any database read. The readers' one-hour cache
// keeps repeat hits cheap. Reader errors are not caught: a database failure
// must give the 500 error page, never a 404.

const MAX_SLUG_LENGTH = 200

export default async function LegacyArticleRedirect({ params }: { params: { slug: string } }) {
  const stored = toStoredSlug(params.slug)
  if (stored === null || stored.length > MAX_SLUG_LENGTH || !LEGACY_SLUG_RE.test(stored)) notFound()

  const article = await getArticleBySlug(stored)
  if (article) permanentRedirect(resolveArticlePath(article))

  const set = await getPublicQuestionSetBySlug(stored)
  if (set) permanentRedirect('/practice-questions/' + set.slug)

  const target = LEGACY_RENAMED_SLUGS.get(stored)
  if (target?.kind === 'article') {
    const renamed = await getArticleBySlug(target.slug)
    if (renamed) permanentRedirect(resolveArticlePath(renamed))
  } else if (target?.kind === 'question-set') {
    const renamed = await getPublicQuestionSetBySlug(target.slug)
    if (renamed) permanentRedirect('/practice-questions/' + renamed.slug)
  }
  notFound()
}
