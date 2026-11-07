// Visitor text placed into email HTML is shown as plain text: the five
// characters that have a meaning in HTML are replaced by their entities.
// Text without any of them comes out exactly as it went in.
//
// A value that is not a string is turned into text first, exactly as a
// template literal or `+` would, so plain values stay identical.

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return String(value)
  } catch {
    return ''
  }
}

export function escapeHtml(value: unknown): string {
  return asText(value).replace(/[&<>"']/g, (ch) => ENTITIES[ch])
}

// Email subject lines are a single line: carriage returns and line feeds in
// visitor text are removed, and nothing else is changed.
export function withoutLineBreaks(value: unknown): string {
  return asText(value).replace(/[\r\n]/g, '')
}
