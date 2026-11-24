// The words /api/search looks for in articles, question sets and courses.
// Pure, no imports. The job half of the search does not use it: that uses
// Postgres text search on the raw query (app/search/jobSearchTiers.ts).

// Strip characters that are special in PostgREST filter syntax.
// Commas delimit .or() expressions; ( ) . % have syntactic meaning.
// Stripping them from word tokens prevents filter string corruption.
export function sanitiseWord(w: string): string {
  return w.replace(/[,().%]/g, '').trim()
}

const keep = (w: string) => w.length >= 2

// The words of one space-separated part: split on hyphens, sanitise, drop
// words shorter than two characters. A short code whose pieces are all too
// short ("W-2") is kept whole; a part of hyphens only gives nothing.
function partWords(part: string): string[] {
  const words = part.split(/-+/).map(sanitiseWord).filter(keep)
  if (words.length > 0) return words
  const whole = sanitiseWord(part)
  return whole.replace(/-/g, '') === '' ? [] : [whole].filter(keep)
}

// Lower-case, split on spaces and hyphens, sanitise each word, and keep the
// first of each repeated word.
export function searchWords(q: string): string[] {
  return Array.from(new Set(q.trim().toLowerCase().split(/\s+/).flatMap(partWords)))
}
