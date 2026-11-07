// Tells an email that was sent apart from one that was not.
//
// Resend's emails.send() returns { data, error } and does not throw when the
// provider refuses a message or cannot be reached, so `await send(...)` alone
// always looks like success. A route passes the result here with a short,
// fixed label (for example 'contact team notification') and decides what the
// visitor sees from the answer.
//
// - Returns true only when there is no error and the provider returned data.
// - On failure logs exactly one fixed line, "email: send failed (<label>)",
//   followed by the provider's short error name and status code when they
//   look like codes. The recipient, subject, body and the provider's message
//   are never logged.
// - Never throws.

export type EmailSendResultLike =
  | {
      data?: unknown
      error?: { name?: unknown; statusCode?: unknown } | null
    }
  | null
  | undefined

const SHORT_CODE = /^[A-Za-z0-9_.-]{1,64}$/

function shortCode(value: unknown): string | null {
  if (typeof value === 'string' && SHORT_CODE.test(value)) return value
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 1000) return String(value)
  return null
}

export function checkEmailSend(result: EmailSendResultLike, label: string): boolean {
  try {
    const error = result?.error
    if (result && (error === null || error === undefined) && result.data !== null && result.data !== undefined) {
      return true
    }
    const name = error && typeof error === 'object' ? shortCode(error.name) : null
    const status = error && typeof error === 'object' ? shortCode(error.statusCode) : null
    const parts = [name, status].filter((part): part is string => part !== null)
    console.error(`email: send failed (${label})` + (parts.length > 0 ? ` ${parts.join(' ')}` : ''))
  } catch {
    // Logging must never break the route.
  }
  return false
}
