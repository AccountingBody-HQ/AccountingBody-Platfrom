// Pure, synchronous, no Next.js-server import of any kind — safe to
// import from a Client Component (app/search/page.tsx does) as well as
// every server-side caller. lib/canonical.ts re-exports this so
// resolveArticleCanonicalUrl and every server-side link builder still get
// it from one place too; the split exists only because that file also
// imports next/headers (for domain resolution elsewhere in it), and
// Next.js errors at build time if a Client Component's module graph pulls
// in next/headers at all, even via an unrelated export it never calls.
export function resolveArticlePath(article: { slug: string; category?: string | null }): string {
  const category = article.category?.toLowerCase().trim()
  return category ? `/study/${category}/${article.slug}` : `/articles/${article.slug}`
}
