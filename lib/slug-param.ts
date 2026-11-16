// Turns a slug route parameter into the form the database stores.
//
// Published slugs are lowercase kebab-case. A slug with a non-ASCII letter
// is stored URL-encoded with lowercase escapes (for example `beta-%ce%b2`).
// Next.js may hand a page the parameter decoded (`beta-β`), still encoded
// (`beta-%CE%B2` or `beta-%ce%b2`) or encoded twice (`beta-%25ce%25b2`), so
// this decodes at most twice, checks the fully decoded text, then encodes it
// again with lowercase escapes to match the stored form.
//
// The decoded text must be Unicode lowercase letters and decimal digits in
// groups joined by single hyphens. Anything else (slashes, spaces, uppercase,
// dots, underscores, a stray %, bad encoding, empty) gives null, so callers
// refuse it before any database read.
//
// Pure, no imports: safe for any server or client module.

const ESCAPE_RE = /%[0-9A-Fa-f]{2}/
// Built with new RegExp because the TypeScript target predates the `u` flag
// in literals; every supported runtime has it.
const DECODED_SLUG_RE = new RegExp('^[\\p{Ll}\\p{Nd}]+(?:-[\\p{Ll}\\p{Nd}]+)*$', 'u')

// The stored slug shape: lowercase letters and digits (or a lowercase %xx
// escape), in groups joined by single hyphens.
export const LEGACY_SLUG_RE = /^(?:[a-z0-9]|%[0-9a-f]{2})+(?:-(?:[a-z0-9]|%[0-9a-f]{2})+)*$/

export function toStoredSlug(param: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(param)
    if (ESCAPE_RE.test(decoded)) decoded = decodeURIComponent(decoded)
  } catch {
    return null
  }
  if (!DECODED_SLUG_RE.test(decoded)) return null
  return encodeURIComponent(decoded).replace(/%[0-9A-F]{2}/g, (escape) => escape.toLowerCase())
}
