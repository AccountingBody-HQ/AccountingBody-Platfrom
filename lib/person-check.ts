// Which site key the person-check widget uses on this page.
//
// The second site is marked by the readable `x-et-platform=ethiotax` cookie
// that the middleware sets. Screens that already receive the same decision
// from the server pass it as `isEthioTax`, which then takes precedence. The
// server picks the matching secret from the same decision.

export type SiteKeys = { ethiotax?: string; ab?: string }

export function personCheckSiteKey(cookie: string, isEthioTax: boolean | undefined, keys: SiteKeys): string {
  const secondSite = typeof isEthioTax === 'boolean' ? isEthioTax : cookie.includes('x-et-platform=ethiotax')
  return secondSite ? (keys.ethiotax ?? '') : (keys.ab ?? '')
}
