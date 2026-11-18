import { describe, expect, it } from 'vitest'
import { nextOpenSection, shouldCloseOnFocusOut } from '@/lib/nav-disclosure'

describe('desktop menu arrow button (nextOpenSection)', () => {
  it('keyboard click (detail 0) opens a closed panel', () => {
    expect(nextOpenSection(null, 'study', 0)).toBe('study')
    expect(nextOpenSection('jobs', 'study', 0)).toBe('study')
  })

  it('keyboard click (detail 0) closes its own open panel', () => {
    expect(nextOpenSection('study', 'study', 0)).toBeNull()
  })

  it('pointer click opens a closed panel', () => {
    expect(nextOpenSection(null, 'study', 1)).toBe('study')
    expect(nextOpenSection('jobs', 'study', 2)).toBe('study')
  })

  it('pointer click never closes a panel that hover already opened', () => {
    expect(nextOpenSection('study', 'study', 1)).toBe('study')
    expect(nextOpenSection('study', 'study', 2)).toBe('study')
  })
})

describe('menu item focus-out (shouldCloseOnFocusOut)', () => {
  const inside = { id: 'inside' }
  const outside = { id: 'outside' }
  const container = { contains: (n: unknown) => n === inside }

  it('closes when focus moves to another element outside the item', () => {
    expect(shouldCloseOnFocusOut(true, container, outside)).toBe(true)
  })

  it('stays open when focus moves within the item', () => {
    expect(shouldCloseOnFocusOut(true, container, inside)).toBe(false)
  })

  it('stays open when focus goes nowhere (click on blank panel space, window blur)', () => {
    expect(shouldCloseOnFocusOut(true, container, null)).toBe(false)
  })

  it('does nothing for a closed item', () => {
    expect(shouldCloseOnFocusOut(false, container, outside)).toBe(false)
  })
})
