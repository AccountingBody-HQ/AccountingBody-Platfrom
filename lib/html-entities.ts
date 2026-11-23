// Turns HTML entities in a stored job title or company name into the
// characters they stand for, for DISPLAY only ("A &#038; B" shows as "A & B").
//
// - Some provider feeds deliver names with entities still in them. The stored
//   value is kept as it is: dedup hashes, slugs and advert keys are built from
//   it, so this is never used where a value is stored, compared or keyed.
// - One pass only: "&amp;#038;" becomes "&#038;", never "&".
// - Numeric entities (&#NNN; and &#xHH;) and &amp; &lt; &gt; &quot; &apos;
//   &nbsp;. Anything else, and a number that is not a usable character, is
//   left as written.
// - The result is plain text. React still escapes it when it is shown, so a
//   decoded "<script>" stays text.

const ENTITY_RE = /&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|(amp|lt|gt|quot|apos|nbsp));/g

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function fromCodePoint(code: number, raw: string): string {
  if (!Number.isInteger(code) || code <= 0 || code > 0x10ffff) return raw
  if (code >= 0xd800 && code <= 0xdfff) return raw
  return String.fromCodePoint(code)
}

export function decodeHtmlEntities(text: string): string
export function decodeHtmlEntities(text: string | null | undefined): string | null | undefined
export function decodeHtmlEntities(text: string | null | undefined): string | null | undefined {
  if (typeof text !== 'string' || !text.includes('&')) return text
  return text.replace(ENTITY_RE, (raw: string, dec?: string, hex?: string, name?: string) => {
    if (dec !== undefined) return fromCodePoint(parseInt(dec, 10), raw)
    if (hex !== undefined) return fromCodePoint(parseInt(hex, 16), raw)
    return name !== undefined ? NAMED[name] ?? raw : raw
  })
}
