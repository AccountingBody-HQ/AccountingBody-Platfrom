import { useCallback, useEffect, useId, useRef, useState } from 'react'

// Shared form accessibility wiring (A11-F5). Markup and ARIA only: no validation rule, message,
// field name or payload changes here.

/** Instance-unique ids for a form's fields and their error messages (safe when a form renders twice). */
export function useFormIds() {
  const base = useId()
  return {
    id: (key: string) => `${base}${key}`,
    errId: (key: string) => `${base}${key}-err`,
  }
}

/**
 * Props that mark a field invalid and point it at its visible error message. Returned only while the
 * error is shown, so aria-describedby never points at an element that is not rendered.
 */
export function invalidProps(invalid: unknown, errorId: string): { 'aria-invalid'?: true; 'aria-describedby'?: string } {
  return invalid ? { 'aria-invalid': true, 'aria-describedby': errorId } : {}
}

/**
 * After a failed step or submit, move keyboard focus to the first invalid field inside `ref` once React has
 * rendered the error state. A field announces its name, "invalid" and its error message. For an invalid group
 * (role="group"/"radiogroup") the first focusable control inside it is focused. Pass `preventScroll` when the
 * form already scrolls to the problem itself, so the two do not fight.
 */
export function useFocusFirstInvalid<T extends HTMLElement = HTMLElement>(preventScroll = false) {
  const ref = useRef<T>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!tick) return
    const first = ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
    if (!first) return
    const target = first.matches('input,select,textarea,button')
      ? first
      : first.querySelector<HTMLElement>('input,select,textarea,button')
    target?.focus({ preventScroll })
  }, [tick, preventScroll])
  const request = useCallback(() => setTick((t) => t + 1), [])
  return [ref, request] as const
}

/** Move focus to an element (e.g. a success heading with tabIndex={-1}) when it is shown in place of a form. */
export function useFocusOnShow<T extends HTMLElement = HTMLElement>(shown: boolean) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (shown) ref.current?.focus()
  }, [shown])
  return ref
}
