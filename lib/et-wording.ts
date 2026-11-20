// lib/et-wording.ts — the one source for EthioTax-view WORDING in template text
// (BOARD #8 part 2, owner decisions D248 and D257).
//
// On the EthioTax view the brand name reads "EthioTax" and the ICAEW
// qualification reads "ETICPA", exactly as visitors have read it on
// ethiotax.com so far. Every other word stays the same.
//
// Pure and safe in client and server code. Use it for template text only:
// never for database content, a form or filter value, a query key, a website
// address or an e-mail address (e-mail addresses stay as they are, D274).

// The pairs, applied in this order, every occurrence.
export const ET_WORDING_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['/study/icaew', '/study/eticpa'],
  ['ICAEW / ACA', 'ETICPA / CPA'],
  ['ICAEW/ACA', 'ETICPA/CPA'],
  ['ICAEW', 'ETICPA'],
  ['ACCOUNTING BODY', 'ETHIOTAX'],
  ['Accounting Body', 'EthioTax'],
  ['AccountingBody', 'EthioTax'],
  ['@accountingbody', '@ethiotax'],
  ['@AccountingBody', '@EthioTax'],
]

// A handle such as "@accountingbody" is wording; an e-mail address such as
// "info@accountingbody.com" is not, and is kept exactly as written.
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g

function words(text: string): string {
  let out = text
  for (const [from, to] of ET_WORDING_PAIRS) out = out.split(from).join(to)
  return out
}

export function etWording(text: string): string {
  let out = ''
  let last = 0
  for (const m of Array.from(text.matchAll(EMAIL))) {
    const at = m.index ?? 0
    out += words(text.slice(last, at)) + m[0]
    last = at + m[0].length
  }
  return out + words(text.slice(last))
}

// The text for the request's view: unchanged on Accounting Body.
export function brandText(isEthioTax: boolean, text: string): string {
  return isEthioTax ? etWording(text) : text
}
