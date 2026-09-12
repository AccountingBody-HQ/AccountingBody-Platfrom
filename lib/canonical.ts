import { headers } from 'next/headers'
import type { ArticleFull } from '@/lib/db'
import { resolveArticlePath } from '@/lib/article-path'

export { resolveArticlePath }

const AB_URL = 'https://accountingbody.com'
const ET_URL = 'https://ethiotax.com'

// Derived from the real Host / X-Forwarded-Host, not from the x-et-platform
// header that middleware.ts sets downstream. middleware.ts:74 treats a
// client-supplied x-et-platform header as equally authoritative as the real
// Host when deciding what to forward, so trusting that header here would let
// any request forge which domain's canonical gets emitted. Host cannot be
// spoofed without the request not actually reaching that domain.
export async function getSiteUrl(): Promise<string> {
  // headers() is synchronous in Next 14.2.35. It's awaited anyway so the
  // eventual Next 15 migration (where headers() becomes async) touches only
  // this one function instead of every call site — do not "simplify" this
  // away.
  const headersList = await headers()
  const forwardedHost = headersList.get('x-forwarded-host') ?? ''
  const host = headersList.get('host') ?? ''
  const isEthioTax = forwardedHost.includes('ethiotax.com') || host.includes('ethiotax.com')
  return isEthioTax ? ET_URL : AB_URL
}

// alternates.canonical and openGraph.url must always be the identical
// string — a page whose canonical and og:url disagree is its own bug.
export async function canonicalMetadata(path: string) {
  const siteUrl = await getSiteUrl()
  const url = `${siteUrl}${path}`
  return {
    alternates: { canonical: url },
    openGraph: { url },
  } as const
}

// canonical_owner values this app actually knows how to serve, and the
// site code (as written to articles.show_on_sites — see lib/site-codes.ts)
// that must also be present before a cross-domain canonical is trusted.
// 'hrlake' is a real, selectable canonical_owner value in the roodber8
// content-factory UI today (app/roodber8/content-factory/page.tsx:737,758)
// but has no deployed domain anywhere in this app — it must fall through
// to the same-host branch below, never have a URL guessed for it.
const OWNER_URL: Record<string, string> = {
  accountingbody: AB_URL,
  ethiotax: ET_URL,
}
const OWNER_SITE_CODE: Record<string, string> = {
  accountingbody: 'ab',
  ethiotax: 'et',
}

// getArticleBySlug's return type — the only fields this function reads.
type CanonicalArticle = Pick<ArticleFull, 'slug' | 'category' | 'canonical_owner' | 'show_on_sites'>

// Pure URL resolution, shared by both article routes (which derive
// `homeSiteUrl` from the live request via getSiteUrl()) and both sitemaps
// (which pass their own fixed AB_BASE_URL/ET_BASE_URL, since a sitemap has
// no "requesting host" — it IS one specific domain's declared URL list).
// Every one of these four callers must resolve the same article to the
// same string, or the whole point of this function is lost.
export function resolveArticleCanonicalUrl(article: CanonicalArticle, homeSiteUrl: string): string {
  // Cross-domain only when canonical_owner names a domain this app can
  // actually serve AND show_on_sites confirms the article is meant to be
  // reachable there. Anything else (null, 'hrlake', a typo, or
  // canonical_owner/show_on_sites disagreeing) falls back to homeSiteUrl —
  // never guess a domain to send readers to.
  const owner = article.canonical_owner ?? undefined
  const ownerUrl = owner ? OWNER_URL[owner] : undefined
  const ownerSiteCode = owner ? OWNER_SITE_CODE[owner] : undefined
  const ownerConfirmed =
    ownerUrl !== undefined &&
    ownerSiteCode !== undefined &&
    (article.show_on_sites ?? []).includes(ownerSiteCode)
  const siteUrl = ownerConfirmed ? ownerUrl : homeSiteUrl

  // Path logic lives in lib/article-path.ts (re-exported above) so every
  // internal link to an article and this canonical resolve the exact same
  // way — that's the whole fix; see that file for why category, not
  // exam_body[0].
  const path = resolveArticlePath(article)

  return `${siteUrl}${path}`
}

// Resolves the one canonical URL for an article reachable at up to four
// URLs today: /articles/[slug] and /study/[category]/[slug], each on
// accountingbody.com and ethiotax.com. Both article routes must call this
// with the same article row so they always agree with each other, and
// with what the sitemaps list (via resolveArticleCanonicalUrl above).
export async function resolveArticleCanonical(article: CanonicalArticle) {
  const homeSiteUrl = await getSiteUrl()
  const url = resolveArticleCanonicalUrl(article, homeSiteUrl)
  return {
    alternates: { canonical: url },
    openGraph: { url },
  } as const
}
