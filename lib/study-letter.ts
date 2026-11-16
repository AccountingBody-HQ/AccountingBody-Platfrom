// Study category pages show one letter's articles at a time.
// Pure helpers: no Next.js or database imports, so they can be unit tested.

/** Group key for titles that do not start with A–Z. */
export const OTHER_KEY = '#'

/** Query value (`?letter=other`) that selects the OTHER_KEY group. */
export const OTHER_PARAM = 'other'

function isAtoZ(ch: string): boolean {
  return ch.length === 1 && ch >= 'A' && ch <= 'Z'
}

/**
 * Groups items by the first letter of their title (A–Z, uppercased).
 * Titles that do not start with A–Z go under OTHER_KEY.
 * Groups are sorted A→Z with OTHER_KEY last; order inside a group is kept.
 */
export function groupAlphabetically<T extends { title: string }>(items: T[]): { letter: string; articles: T[] }[] {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const first = item.title.charAt(0).toUpperCase()
    const key = isAtoZ(first) ? first : OTHER_KEY
    const group = map.get(key)
    if (group) group.push(item)
    else map.set(key, [item])
  }
  return Array.from(map.keys())
    .sort((a, b) => {
      if (a === b) return 0
      if (a === OTHER_KEY) return 1
      if (b === OTHER_KEY) return -1
      return a < b ? -1 : 1
    })
    .map(letter => ({ letter, articles: map.get(letter)! }))
}

/**
 * Chooses the letter to show from the `?letter=` value.
 * Falls back to the first available letter for anything unknown or empty.
 * Returns '' when nothing is available.
 */
export function pickLetter(param: string | string[] | undefined, available: string[]): string {
  const fallback = available[0] ?? ''
  if (typeof param !== 'string') return fallback
  const value = param.trim().toUpperCase()
  const key = value === OTHER_PARAM.toUpperCase() ? OTHER_KEY : value
  if ((isAtoZ(key) || key === OTHER_KEY) && available.includes(key)) return key
  return fallback
}

/** Address of one letter's view. The default letter uses the plain category address. */
export function letterHref(category: string, key: string, defaultKey: string): string {
  const base = `/study/${category}`
  if (key === defaultKey) return base
  if (key === OTHER_KEY) return `${base}?letter=${OTHER_PARAM}`
  return `${base}?letter=${key}`
}
