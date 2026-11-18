import { useEffect, useRef, type RefObject } from 'react'

// Keyboard focus for a slide-in drawer that is a modal dialog (A11-F6). While `open`:
// focus moves into the drawer, Tab and Shift+Tab wrap inside it, and Escape closes it.
// When it closes, focus returns to the element that had it before it opened (the menu
// or filter button). Markup, styling and the body scroll lock stay with the caller.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useDialogFocus(open: boolean, ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const returnTo = useRef<HTMLElement | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const el = ref.current
    if (!open || !el) return
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const items = () =>
      Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.getClientRects().length > 0)
    // Wait one frame so the drawer is no longer inert before focusing into it.
    const raf = requestAnimationFrame(() => items()[0]?.focus({ preventScroll: true }))
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const list = items()
      if (!list.length) return
      const first = list[0]
      const last = list[list.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !el.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !el.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      const back = returnTo.current
      // Return focus only if it is still inside the closing drawer (or lost), not after a deliberate move elsewhere.
      if (back && back.isConnected && (!document.activeElement || document.activeElement === document.body || el.contains(document.activeElement))) {
        back.focus({ preventScroll: true })
      }
    }
  }, [open, ref])
}
