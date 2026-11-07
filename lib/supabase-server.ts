// Single source for server-side supabase-js clients.
//
// Every request made through a client from here has a time limit chosen by
// the kind of work (the context). When the limit is reached the request is
// aborted, and supabase-js turns that into its ordinary
// { data: null, error, status: 0 } result, which callers already handle.
//
// - The limit covers the whole request: waiting for the answer AND reading
//   its body. (supabase-js's own `db.timeout` stops at the headers, so it is
//   not used.)
// - The request is also raced against the limit, so it ends on time even if
//   the underlying fetch ignores its abort signal.
// - A caller's own abort signal (`.abortSignal()`) keeps working.
// - Nothing is ever retried.
// - Clients are created per call, never at module scope. supabase-js `auth`
//   options are left at their defaults.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const DB_LIMITS_MS = {
  publicRead: 6_000, // visitor pages and read APIs
  publicWrite: 15_000, // visitor forms, saves and payments
  admin: 20_000, // admin pages and APIs
  cron: 25_000, // scheduled routes (route limit 60 s)
  ingest: 60_000, // provider ingestion (route limit 300 s)
} as const

export type DbContext = keyof typeof DB_LIMITS_MS

export const DB_TIME_LIMIT_LOG = 'db: request time limit reached'

const BODY_READERS = ['text', 'json', 'arrayBuffer', 'blob'] as const

// Settles with the signal's reason as soon as the signal aborts.
function rejectOnAbort(signal: AbortSignal): Promise<never> {
  return new Promise<never>((_resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })
}

// Wraps a fetch so that each request ends within `limitMs`.
// `inner` is looked up at call time by default, as supabase-js does.
export function timeLimitedFetch(
  limitMs: number,
  inner: typeof fetch = (...args) => fetch(...args),
): typeof fetch {
  return async (input, init) => {
    const limit = new AbortController()
    const reason = new DOMException(`${DB_TIME_LIMIT_LOG} (${limitMs} ms)`, 'TimeoutError')
    const signal = init?.signal ? AbortSignal.any([init.signal, limit.signal]) : limit.signal

    // Work in progress for this request: the wait for the answer, then any
    // body read. The log line is written only when this limit (not a
    // caller's own signal) ends work that is still in progress.
    let inProgress = 0
    signal.addEventListener(
      'abort',
      () => {
        if (signal.reason === reason && inProgress > 0) console.warn(`${DB_TIME_LIMIT_LOG} (${limitMs} ms)`)
      },
      { once: true },
    )
    const aborted = rejectOnAbort(signal)
    aborted.catch(() => {})

    // Unreferenced, like AbortSignal.timeout: it never keeps a process alive.
    const timer = setTimeout(() => limit.abort(reason), limitMs)
    if (typeof timer === 'object' && timer !== null && 'unref' in timer) timer.unref()
    const finish = () => clearTimeout(timer)

    const race = async <T>(work: Promise<T>): Promise<T> => {
      work.catch(() => {})
      inProgress += 1
      try {
        return await Promise.race([work, aborted])
      } finally {
        inProgress -= 1
      }
    }

    let response: Response
    try {
      response = await race(inner(input, { ...init, signal }))
    } catch (error) {
      finish()
      throw error
    }

    // HEAD answers and empty bodies are complete once the headers arrive.
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    if (method === 'HEAD' || response.body === null) {
      finish()
      return response
    }

    // Otherwise the limit stays in force until the body has been read.
    for (const name of BODY_READERS) {
      const original = response[name]
      if (typeof original !== 'function') continue
      Object.defineProperty(response, name, {
        configurable: true,
        writable: true,
        value: async () => {
          try {
            return await race((original as () => Promise<unknown>).call(response))
          } finally {
            finish()
          }
        },
      })
    }
    return response
  }
}

export function getServerSupabase(context: DbContext): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    global: { fetch: timeLimitedFetch(DB_LIMITS_MS[context]) },
  })
}
