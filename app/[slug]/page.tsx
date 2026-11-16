import { notFound, permanentRedirect } from 'next/navigation'
import { getArticleBySlug } from '@/lib/db'

// Old WordPress article addresses (/<slug> and /<slug>/) live on in Further
// Reading links inside published articles (485 links, FINDINGS DX), in old
// search results and in outside backlinks. When a published article has
// that slug, this answers a permanent (308) redirect to /articles/<slug> on
// the same host; otherwise 404.
//
// It never shadows a static top-level route (those always win over this
// dynamic segment), and a path that is not slug-shaped (dots, slashes,
// uppercase, bad encoding, too long — /wp-login.php, /favicon.ico and the
// like) gets a 404 without any database read. The reader's one-hour cache
// keeps repeat hits cheap. Reader errors are not caught: a database failure
// must give the 500 error page, never a 404.

// Matches every published slug: lowercase letters and digits (or a
// lowercase %xx escape), in groups joined by single hyphens.
const LEGACY_SLUG_RE = /^(?:[a-z0-9]|%[0-9a-f]{2})+(?:-(?:[a-z0-9]|%[0-9a-f]{2})+)*$/
const MAX_SLUG_LENGTH = 200

export default async function LegacyArticleRedirect({ params }: { params: { slug: string } }) {
  let slug: string
  try {
    slug = decodeURIComponent(params.slug)
  } catch {
    notFound()
  }
  if (slug.length > MAX_SLUG_LENGTH || !LEGACY_SLUG_RE.test(slug)) notFound()

  const article = await getArticleBySlug(slug)
  if (!article) notFound()
  permanentRedirect('/articles/' + encodeURIComponent(article.slug ?? slug))
}
