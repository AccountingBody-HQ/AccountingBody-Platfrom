// Tells a database read that failed apart from one that found nothing.
//
// supabase-js returns { data, error, count } and never throws for a database
// problem; a request that reaches its time limit (lib/supabase-server.ts) also
// comes back this way. A route that is about to delete, overwrite or hand out
// a number based on a read uses checkRead first, and stops when ok is false.
//
// - ok: true, data: null (or []) means the read worked and found nothing.
// - ok: false means the read did not work; the route must not act on it.
//   The error is logged under `label`, never sent to the browser.
// - Any error counts, even one with an empty message (a failed count request
//   has no body, so its message is '').
// - noRowsIsEmpty: for a .single() read whose route already treats "no rows"
//   (PGRST116) as "nothing found". Leave it off everywhere else.
// - A failed read is also reported to Sentry under `label` (lib/report-error.ts).

import { reportServerError } from './report-error'

export type DbReadError = { message: string; code?: string; details?: string | null; hint?: string | null }

export type DbResultLike<T> = {
  data: T | null
  error: DbReadError | null
  count?: number | null
}

export type CheckedRead<T> =
  | { ok: true; data: T | null; count: number | null }
  | { ok: false; error: DbReadError }

const NO_ROWS_CODE = 'PGRST116'

// R is the whole supabase-js result (a union of its success and failure
// shapes), so the row type is taken from it rather than inferred per field.
export function checkRead<R extends DbResultLike<unknown>>(
  result: R,
  label: string,
  options: { noRowsIsEmpty?: boolean } = {},
): CheckedRead<NonNullable<R['data']>> {
  const { error } = result
  if (error === null || error === undefined) {
    return { ok: true, data: (result.data ?? null) as NonNullable<R['data']> | null, count: result.count ?? null }
  }
  if (options.noRowsIsEmpty && error.code === NO_ROWS_CODE) {
    return { ok: true, data: null, count: null }
  }
  console.error(`${label} read failed:`, error)
  reportServerError(label, error)
  return { ok: false, error }
}
