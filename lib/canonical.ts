import { headers } from 'next/headers'
import type { ArticleFull } from '@/lib/db'
import { resolveArticlePath } from '@/lib/article-path'

export { resolveArticlePath }

// The one source of the two domains a canonical can name (owner rule D272).
export const AB_URL = 'https://accountingbody.com'
export const ET_URL = 'https://ethiotax.com'

// The owner of a page or item: the domain Google should treat as its home.
export type SiteOwner = 'accountingbody' | 'ethiotax'

const OWNER_BASE: Record<SiteOwner, string> = {
  accountingbody: AB_URL,
  ethiotax: ET_URL,
}

export function ownerUrl(owner: SiteOwner, path: string): string {
  return `${OWNER_BASE[owner]}${path}`
}

// Owner rule D272: a page names its owner's domain in its canonical and
// og:url, whatever host serves it. Pure and synchronous — it never reads the
// request — so the same page gives the same answer on accountingbody.com,
// on ethiotax.com and on a deployment address. Every new page uses this.
// alternates.canonical and openGraph.url are always the identical string.
export function ownerCanonical(owner: SiteOwner, path: string) {
  const url = ownerUrl(owner, path)
  return {
    alternates: { canonical: url },
    openGraph: { url },
  } as const
}

// Host-based: for the owner-pending pages only (the "HB" pages, whose owner
// is still to be decided). New pages must use ownerCanonical instead.
//
// Derived from the real Host / X-Forwarded-Host, not from the x-et-platform
// header that middleware sets downstream. The platform decision in
// lib/middleware-logic.ts (around line 241) treats a client-supplied
// x-et-platform header as equally authoritative as the real Host, so
// trusting that header here would let any request forge which domain's
// canonical gets emitted. Host cannot be spoofed without the request not
// actually reaching that domain.
export async function getSiteUrl(): Promise<string> {
  // headers() is async in Next 15 (this project runs Next 15.5.29), so it is
  // awaited here, in this one function, rather than at every call site.
  const headersList = await headers()
  const forwardedHost = headersList.get('x-forwarded-host') ?? ''
  const host = headersList.get('host') ?? ''
  const isEthioTax = forwardedHost.includes('ethiotax.com') || host.includes('ethiotax.com')
  return isEthioTax ? ET_URL : AB_URL
}

// Host-based canonical: for the owner-pending (HB) pages only — new pages
// must use ownerCanonical. alternates.canonical and openGraph.url must always
// be the identical string — a page whose canonical and og:url disagree is
// its own bug.
export async function canonicalMetadata(path: string) {
  const siteUrl = await getSiteUrl()
  const url = `${siteUrl}${path}`
  return {
    alternates: { canonical: url },
    openGraph: { url },
  } as const
}

// The site code (as written to show_on_sites / jobs.platform — see
// lib/site-codes.ts) that must be present before a chosen owner is trusted.
const OWNER_SITE_CODE: Record<SiteOwner, string> = {
  accountingbody: 'ab',
  ethiotax: 'et',
}

function isSiteOwner(value: string | null | undefined): value is SiteOwner {
  return value === 'accountingbody' || value === 'ethiotax'
}

// The owner chosen in admin (canonical_owner), but only when it names a
// domain this app serves AND the item's own site list confirms the item is
// meant to be reachable there. Anything else (null, a retired value, a typo,
// or the two fields disagreeing) is "not confirmed" — never a guessed domain.
function confirmedOwner(owner: string | null | undefined, sites: readonly string[] | null | undefined): SiteOwner | null {
  if (!isSiteOwner(owner)) return null
  return (sites ?? []).includes(OWNER_SITE_CODE[owner]) ? owner : null
}

// The one owner of an article or a course (lessons take their course's
// owner): the confirmed owner, otherwise accountingbody (D272's default
// owner). Never the serving host, so no item names both domains. Shared by
// the article and course pages and by both sitemaps, which must always agree.
export function contentOwner(item: { canonical_owner?: string | null; show_on_sites?: readonly string[] | null }): SiteOwner {
  return confirmedOwner(item.canonical_owner, item.show_on_sites) ?? 'accountingbody'
}

// The one owner of a job: the confirmed owner (canonical_owner whose site
// code is in platform), otherwise accountingbody when the job is listed on
// Accounting Body, else ethiotax. A job on both sites therefore has one
// owner, and an EthioTax-only job is owned by ethiotax.com. Shared by the
// job page and both job sitemaps.
export function jobCanonicalOwner(job: { platform?: readonly string[] | null; canonical_owner?: string | null }): SiteOwner {
  const platform = job.platform ?? []
  return confirmedOwner(job.canonical_owner, platform) ?? (platform.includes('ab') ? 'accountingbody' : 'ethiotax')
}

// The single source of a job's canonical URL (its metadata and both job
// sitemaps). The job page's share link is NOT this: it stays the address of
// the site the visitor is on.
export function getJobCanonicalUrl(job: { slug: string; platform?: readonly string[] | null; canonical_owner?: string | null }): string {
  return ownerUrl(jobCanonicalOwner(job), `/jobs/${job.slug}`)
}

// getArticleBySlug's return type — the only fields this function reads.
type CanonicalArticle = Pick<ArticleFull, 'slug' | 'category' | 'canonical_owner' | 'show_on_sites'>

// Pure URL resolution, shared by both article routes and both sitemaps.
// Every caller must resolve the same article to the same string.
export function resolveArticleCanonicalUrl(article: CanonicalArticle): string {
  // Path logic lives in lib/article-path.ts (re-exported above) so every
  // internal link to an article and this canonical resolve the exact same
  // way — that's the whole fix; see that file for why category, not
  // exam_body[0].
  return ownerUrl(contentOwner(article), resolveArticlePath(article))
}

// Resolves the one canonical URL for an article reachable at up to four
// URLs today: /articles/[slug] and /study/[category]/[slug], each on
// accountingbody.com and ethiotax.com. Both article routes call this with
// the same article row so they always agree with each other, and with what
// the sitemaps list (via resolveArticleCanonicalUrl above).
export function resolveArticleCanonical(article: CanonicalArticle) {
  return ownerCanonical(contentOwner(article), resolveArticlePath(article))
}

// The brand in the visible title of /articles/[slug] — NOT a canonical.
// It keeps that title exactly as it was before D272: the confirmed owner,
// otherwise the domain of the serving host.
export async function articleTitleOwner(article: Pick<ArticleFull, 'canonical_owner' | 'show_on_sites'>): Promise<SiteOwner> {
  const confirmed = confirmedOwner(article.canonical_owner, article.show_on_sites)
  if (confirmed) return confirmed
  return (await getSiteUrl()) === ET_URL ? 'ethiotax' : 'accountingbody'
}
