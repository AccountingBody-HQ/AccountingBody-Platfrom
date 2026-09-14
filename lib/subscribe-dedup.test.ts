import { describe, it, expect } from 'vitest'
import { shouldSendConfirmationEmail, CONFIRMATION_RESEND_WINDOW_MS } from './subscribe-dedup'

describe('shouldSendConfirmationEmail', () => {
  const now = new Date('2026-09-14T12:00:00.000Z')

  it('returns true when no confirmation email has ever been sent', () => {
    expect(shouldSendConfirmationEmail({ lastSentAt: null, now })).toBe(true)
  })

  it('returns false when the last email was sent 59 minutes ago', () => {
    const lastSentAt = new Date(now.getTime() - 59 * 60 * 1000)
    expect(shouldSendConfirmationEmail({ lastSentAt, now })).toBe(false)
  })

  it('returns true when the last email was sent 61 minutes ago', () => {
    const lastSentAt = new Date(now.getTime() - 61 * 60 * 1000)
    expect(shouldSendConfirmationEmail({ lastSentAt, now })).toBe(true)
  })

  // Boundary choice: exactly CONFIRMATION_RESEND_WINDOW_MS old counts as
  // "the window has elapsed" (>=, not >) — the 1-hour minimum gap has been
  // fully satisfied at the instant it ticks over, so sending is allowed.
  it('returns true at exactly the window boundary (60 minutes)', () => {
    const lastSentAt = new Date(now.getTime() - CONFIRMATION_RESEND_WINDOW_MS)
    expect(shouldSendConfirmationEmail({ lastSentAt, now })).toBe(true)
  })
})
