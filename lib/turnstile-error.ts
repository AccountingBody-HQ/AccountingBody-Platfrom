// Pure helper for the contact/subscribe forms' error handling. A caught
// error's .message is usually a legitimate, server-composed string meant
// for the visitor (e.g. "Email is required.", or one of /api/subscribe's
// turnstile_failed / turnstile_unreachable messages) — but it can also be
// a raw exception thrown by window.turnstile's own reset()/render() calls
// (e.g. "[Cloudflare Turnstile] Nothing to reset found for provided
// container."), which is never meant to reach a visitor. The structural
// fix is keeping those calls out of the try/catch that sets user-facing
// error state at all (see app/contact/ContactForm.tsx,
// components/EmailSignupForm.tsx, components/layout/Footer.tsx); this is
// a second, independent safety net in case one ever still reaches here.

const TURNSTILE_INTERNAL_ERROR_PREFIX = '[Cloudflare Turnstile]'

export const GENERIC_FORM_ERROR_MESSAGE = 'Something went wrong. Please try again.'

export function isTurnstileInternalErrorMessage(message: string): boolean {
  return message.startsWith(TURNSTILE_INTERNAL_ERROR_PREFIX)
}

// Never returns raw Turnstile-internal exception text. Anything else
// (legitimate server copy, or nothing at all) passes through unchanged,
// falling back to the generic message only when there's nothing usable.
export function safeUserFacingErrorMessage(message: string | undefined | null): string {
  if (!message) return GENERIC_FORM_ERROR_MESSAGE
  if (isTurnstileInternalErrorMessage(message)) return GENERIC_FORM_ERROR_MESSAGE
  return message
}
