// Shared brand values for contact-enquiry emails: the visitor-facing
// notify-team/acknowledgement emails (app/api/contact/route.ts) and the
// admin's reply to a stored enquiry (app/api/roodber8/reply/route.ts).
// Centralised so the two routes can't drift on what EthioTax's From
// address, name or colour are — the bug this fixes was exactly that drift:
// the reply route had independently hand-typed an EthioTax From address on
// ethiotax.com, a domain Resend's free plan has never verified, so it
// silently failed to send whenever it was actually reached.

// Resend's free plan has exactly one verified sending domain. Every
// outbound contact-enquiry email — for both brands — must use this
// address; only the display name differs.
export const CONTACT_SENDER_EMAIL = 'info@accountingbody.com'

export interface ContactBrand {
  name: string
  domain: string
  email: string
  color: string
}

export const AB_CONTACT_BRAND: ContactBrand = {
  name: 'Accounting Body',
  domain: 'accountingbody.com',
  email: CONTACT_SENDER_EMAIL,
  color: '#0C1A3D',
}

export const ET_CONTACT_BRAND: ContactBrand = {
  name: 'EthioTax',
  domain: 'ethiotax.com',
  email: CONTACT_SENDER_EMAIL,
  color: '#1A4731',
}

export function getContactBrand(isET: boolean): ContactBrand {
  return isET ? ET_CONTACT_BRAND : AB_CONTACT_BRAND
}

// The value contact_submissions.platform (and help_requests.platform)
// actually store, matching what app/roodber8/submissions/page.tsx's
// platform filter expects — its <select name="platform"> options are
// exactly 'ab' and 'et'.
export function contactPlatformValue(isET: boolean): 'ab' | 'et' {
  return isET ? 'et' : 'ab'
}

// Normalises a platform value forwarded from elsewhere (e.g. a stored
// row's platform column, threaded through a client request body) back to
// a strict isET boolean. Accepts both 'et' (the stored/admin-filter
// spelling) and 'ethiotax' (the x-et-platform header's own spelling)
// defensively, since a caller may end up passing either depending on where
// the value originated.
export function isEthioTaxPlatformValue(value: unknown): boolean {
  return value === 'et' || value === 'ethiotax'
}
