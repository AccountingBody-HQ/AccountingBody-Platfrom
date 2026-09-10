// Shared option sets for the Add and Edit Provider forms.
//
// These two forms are separate components that have drifted apart before
// (defect 2: the selects could not represent api_key_query / page_number,
// so every Adzuna row rendered a blank select that would silently
// overwrite the real value on save). Keeping the option lists and the
// defensive render helper in one module is what stops them drifting again.

/**
 * Every auth_type value that lib/adapters/generic-rest.ts actually
 * branches on in resolveAuth(). `api_key` and `api_key_query` are
 * synonyms in the adapter (both set a query-string param); both are
 * listed because real rows are stored under each spelling.
 */
export const AUTH_TYPE_OPTIONS = [
  'none',
  'api_key',
  'api_key_query',
  'api_key_header',
  'bearer',
  'basic',
] as const

/**
 * pagination_style values understood across the real providers:
 *  - none / page / offset / cursor  → generic-rest.ts fetchAllPages branches
 *  - page_number                    → what the 6 Adzuna rows are stored as.
 *    The Adzuna adapter has its own pagination logic and ignores this
 *    field, so page_number is inert metadata for it — but the form must
 *    still preserve it rather than blank it.
 */
export const PAGINATION_STYLE_OPTIONS = [
  'none',
  'page',
  'offset',
  'cursor',
  'page_number',
] as const

export interface FormSelectOption {
  value: string
  label: string
  disabled: boolean
}

/**
 * Build the <option> list for a <select> bound to `current`.
 *
 * If `current` is a non-empty value that is NOT one of `known`, it is
 * prepended as a DISABLED option that shows the raw stored string. That
 * keeps the select rendering the real database value instead of going
 * blank — a blank select silently rewrites the field to its empty/default
 * value on the next save. After the defect-2 fix every real value is in
 * `known`; this branch only fires on future enum drift, and it is a
 * general pattern used by both selects, not a per-field special case.
 */
export function buildSelectOptions(
  known: readonly string[],
  current: string | null | undefined,
): FormSelectOption[] {
  const options: FormSelectOption[] = known.map((value) => ({
    value,
    label: value,
    disabled: false,
  }))

  if (current && !known.includes(current)) {
    options.unshift({
      value: current,
      label: `${current} — stored value, not a valid option`,
      disabled: true,
    })
  }

  return options
}
