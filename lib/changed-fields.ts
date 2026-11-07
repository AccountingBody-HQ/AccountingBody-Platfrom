// Lists which saved details an update changes.
//
// `before` is the row read before saving and `updates` is exactly what the
// route saves. Returns the keys of `updates` whose value differs from
// `before`, in the order of `updates`.
// - null, undefined and "" count as the same empty value: the profile update
//   routes save an empty text field as null.
// - Arrays and plain objects are compared by their JSON with object keys
//   sorted, so key order does not count; the order of array items does.
// - Any other values are compared with ===.

const isEmpty = (value: unknown) => value === null || value === undefined || value === ''

function sortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedKeys)
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, sortedKeys(record[key])]),
    )
  }
  return value
}

function sameValue(a: unknown, b: unknown): boolean {
  if (isEmpty(a) && isEmpty(b)) return true
  if (a !== null && typeof a === 'object' && b !== null && typeof b === 'object') {
    return JSON.stringify(sortedKeys(a)) === JSON.stringify(sortedKeys(b))
  }
  return a === b
}

export function changedFields(before: Record<string, unknown>, updates: Record<string, unknown>): string[] {
  return Object.keys(updates).filter((key) => !sameValue(before[key], updates[key]))
}
