// Text rules shared by the server and browser Sentry filters. No imports, so
// this file is safe for the server, the edge runtime and the browser bundle.

export const REMOVED = '[removed]'
export const ADMIN_AREA = 'admin-area'
export const SCAN_LENGTH = 2000

const EMAIL = /[^\s@<>()[\]"',;:]+@[^\s@<>()[\]"',;:]+/g
// In paths an address ends at "/", so the rest of the path stays readable.
const EMAIL_IN_NAME = /[^\s@<>()[\]"',;:/]+@[^\s@<>()[\]"',;:/]+/g
const LONG_TOKEN = /[A-Za-z0-9_-]{20,}/g
const LONG_DIGITS = /\d{6,}/g
const QUERY_OR_FRAGMENT = /[?#][^\s]*/g

// Messages: emails, long code-like runs and long numbers are replaced.
export function replaceSecretText(text: string): string {
  return text.replace(EMAIL, REMOVED).replace(LONG_TOKEN, REMOVED).replace(LONG_DIGITS, REMOVED)
}

// Names that must stay readable (file paths, function names, routes): long
// runs are removed only when they contain a digit or are very long, so
// ordinary code names survive while random codes do not.
export function replaceSecretNameParts(text: string): string {
  return text
    .replace(EMAIL_IN_NAME, REMOVED)
    .replace(LONG_TOKEN, (run) => (/\d/.test(run) || run.length >= 40 ? REMOVED : run))
    .replace(LONG_DIGITS, REMOVED)
}

function decode(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

// Text without any query string or fragment, read in decoded form.
export function withoutQuery(text: string): string {
  const cut = text.slice(0, SCAN_LENGTH * 2).replace(QUERY_OR_FRAGMENT, '')
  return decode(cut).replace(QUERY_OR_FRAGMENT, '')
}
