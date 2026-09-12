import { headers } from 'next/headers'

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
