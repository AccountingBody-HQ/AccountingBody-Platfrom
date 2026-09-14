// One hour, chosen by the operator to stop repeat bot submissions from
// exhausting the Resend free-plan daily quota of 100, while still letting
// a real person retry the same day.
export const CONFIRMATION_RESEND_WINDOW_MS = 60 * 60 * 1000

export function shouldSendConfirmationEmail({
  lastSentAt,
  now,
}: {
  lastSentAt: Date | null
  now: Date
}): boolean {
  if (lastSentAt === null) return true
  return now.getTime() - lastSentAt.getTime() >= CONFIRMATION_RESEND_WINDOW_MS
}
