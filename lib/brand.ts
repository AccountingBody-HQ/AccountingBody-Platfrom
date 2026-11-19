// lib/brand.ts — the one source for the brand NAME in template text.
//
// The brand is decided per request: the EthioTax proxy sends every
// ethiotax.com request with the x-et-platform: ethiotax header (read by the
// root layout, app/layout.tsx). Owner decision D248: on EthioTax the brand
// name becomes "EthioTax" and every other word stays the same.
//
// Pure and safe in client and server code. Server code reads the request
// with getRequestBrand() in lib/brand-server.ts; client components get the
// brand as a prop from a server parent.

export const AB_BRAND_NAME = 'Accounting Body'
export const ET_BRAND_NAME = 'EthioTax'
export type BrandName = typeof AB_BRAND_NAME | typeof ET_BRAND_NAME

export const ET_PLATFORM_HEADER = 'x-et-platform'
export const ET_PLATFORM_VALUE = 'ethiotax'

export function brandName(isEthioTax: boolean): BrandName {
  return isEthioTax ? ET_BRAND_NAME : AB_BRAND_NAME
}

// Some Accounting Body text spells the name joined ("AccountingBody");
// that text keeps its spelling, and EthioTax reads "EthioTax".
export function compactBrandName(isEthioTax: boolean): 'AccountingBody' | 'EthioTax' {
  return isEthioTax ? ET_BRAND_NAME : 'AccountingBody'
}

// The same test as app/layout.tsx: the header must be exactly 'ethiotax'.
export function isEthioTaxHeader(headersList: { get(name: string): string | null }): boolean {
  return headersList.get(ET_PLATFORM_HEADER) === ET_PLATFORM_VALUE
}

// A job's own brand, the rule lib/jobEmails.ts uses: EthioTax only for a
// job shown on EthioTax alone; shared, Accounting Body, empty or unknown
// platforms are Accounting Body.
export function isEthioTaxJobPlatform(platform: unknown): boolean {
  const list = Array.isArray(platform) ? platform : typeof platform === 'string' ? [platform] : []
  return list.includes('et') && !list.includes('ab')
}

// For the two client pages that cannot receive the brand from a server
// parent: the platform cookie the middleware sets on every response
// (middleware.ts), or the EthioTax host itself. Call it after mount only,
// so the server render and the first client render match.
export function isEthioTaxBrowser(cookie: string, hostname: string): boolean {
  const fromCookie = cookie.split('; ').some((part) => part === `${ET_PLATFORM_HEADER}=${ET_PLATFORM_VALUE}`)
  return fromCookie || hostname === 'ethiotax.com' || hostname.endsWith('.ethiotax.com')
}
