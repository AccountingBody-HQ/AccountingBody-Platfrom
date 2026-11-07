// Single source for guarding cached database reads (see CLAUDE.md, section 5).
//
// Wraps the function returned by unstable_cache. Per server instance, in
// memory, for each key (the reader's key parts plus its arguments):
//   - one refresh at a time: callers that arrive while a refresh is running
//     share its result;
//   - for HOLD_MS after a successful refresh, the remembered value is
//     returned without calling unstable_cache again;
//   - if a refresh fails and this instance has a good value no older than
//     MAX_LAST_GOOD_AGE_MS, that value is returned and one fixed line is
//     logged. The failure itself is never stored: the wrapped function
//     throws, so unstable_cache writes nothing;
//   - for BACKOFF_MS after a failed refresh the key is not refreshed again:
//     callers get the last good value if there is one, otherwise the saved
//     error is thrown at once, so the caller's own fallback runs;
//   - at most MAX_KEYS keys are kept; when full, the oldest key with no
//     refresh running is removed first.
// Memory is per instance and starts empty on a cold start; nothing here is
// shared between instances.

export const HOLD_MS = 30_000
export const BACKOFF_MS = 30_000
export const MAX_KEYS = 500
export const MAX_LAST_GOOD_AGE_MS = 24 * 60 * 60 * 1000

export const LAST_GOOD_VALUE_LOG = 'cache: refresh failed, serving last good value'

interface Entry {
  hasValue: boolean
  value: unknown
  // Time of the last successful refresh in this instance.
  valueAt: number
  running: Promise<unknown> | null
  error: unknown
  backoffUntil: number
}

const entries = new Map<string, Entry>()

// Every call returns its own copy, as unstable_cache does when it reads a
// stored entry, so one caller can never change what another caller sees.
function copy<T>(value: T): T {
  return value !== null && typeof value === 'object' ? structuredClone(value) : value
}

// Same inputs as unstable_cache's own key (its key parts plus the JSON of
// the arguments), as one JSON array so that no two different (key parts,
// arguments) pairs can produce the same string.
export function cacheGuardKey(keyParts: readonly string[], args: readonly unknown[]): string {
  return JSON.stringify([keyParts, args])
}

function makeRoom(): void {
  if (entries.size < MAX_KEYS) return
  // Map iteration order is insertion order, and a successful refresh
  // re-inserts its key, so the first idle key found is the oldest one.
  for (const [key, entry] of Array.from(entries)) {
    if (!entry.running) {
      entries.delete(key)
      if (entries.size < MAX_KEYS) return
    }
  }
  // Every key has a refresh running: nothing is removed, so a running
  // refresh is never dropped. The map shrinks again on later inserts.
}

function usableLastGood(entry: Entry, now: number): boolean {
  if (!entry.hasValue) return false
  if (now - entry.valueAt <= MAX_LAST_GOOD_AGE_MS) return true
  entry.hasValue = false
  entry.value = undefined
  return false
}

export function guardCachedRead<A extends unknown[], R>(
  keyParts: readonly string[],
  read: (...args: A) => Promise<R>
): (...args: A) => Promise<R> {
  const name = keyParts[0] ?? ''

  async function refresh(key: string, entry: Entry, args: A): Promise<R> {
    try {
      const value = await read(...args)
      entry.hasValue = true
      entry.value = value
      entry.valueAt = Date.now()
      entry.error = undefined
      entry.backoffUntil = 0
      // Move to the end, so eviction order follows the last good refresh.
      if (entries.get(key) === entry) {
        entries.delete(key)
        entries.set(key, entry)
      }
      return value
    } catch (error) {
      const now = Date.now()
      entry.error = error
      entry.backoffUntil = now + BACKOFF_MS
      if (usableLastGood(entry, now)) {
        console.warn(`${LAST_GOOD_VALUE_LOG} (${name})`)
        return entry.value as R
      }
      throw error
    } finally {
      entry.running = null
    }
  }

  return async (...args: A): Promise<R> => {
    const key = cacheGuardKey(keyParts, args)
    const now = Date.now()
    let entry = entries.get(key)

    if (entry) {
      if (entry.running) return copy((await entry.running) as R)
      if (entry.hasValue && entry.backoffUntil === 0 && now - entry.valueAt < HOLD_MS) {
        return copy(entry.value as R)
      }
      if (now < entry.backoffUntil) {
        if (usableLastGood(entry, now)) return copy(entry.value as R)
        throw entry.error
      }
    } else {
      makeRoom()
      entry = { hasValue: false, value: undefined, valueAt: 0, running: null, error: undefined, backoffUntil: 0 }
      entries.set(key, entry)
    }

    const running = refresh(key, entry, args)
    entry.running = running
    return copy(await running)
  }
}

// Tests only: forget every remembered value, error and pause.
export function resetCacheGuard(): void {
  entries.clear()
}

// Tests only: number of keys currently kept.
export function cacheGuardSize(): number {
  return entries.size
}
