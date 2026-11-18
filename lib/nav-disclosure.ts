// Desktop menu (components/layout/Navigation.tsx) open/close rules, kept pure so they can be tested.

// The arrow button's click. A keyboard click (Enter or Space on a button has
// detail 0) toggles its panel. A pointer click only opens: hovering the item has
// usually opened the panel already, and a click must not close it under the pointer.
export function nextOpenSection(current: string | null, id: string, clickDetail: number): string | null {
  if (current === id) return clickDetail === 0 ? null : id
  return id
}

// Focus leaving a menu item closes its open panel only when focus moved to
// another element outside the item. No next element (a click on blank panel
// space, or the window losing focus) keeps it open.
export function shouldCloseOnFocusOut(
  isOpen: boolean,
  container: { contains(node: never): boolean },
  next: unknown,
): boolean {
  if (!isOpen || next == null) return false
  return !container.contains(next as never)
}
