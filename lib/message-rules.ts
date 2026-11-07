// Visitor-facing texts shared by the public form routes, and the minimum
// message length for the contact and help-request forms, shared by the
// server routes and the contact form so both use the same number. Also the
// messages, and the choice between them, for screens reached from links in
// our emails.
//
// The same pages are served on more than one site, so these texts name no
// site or brand.

export const SERVER_PROBLEM_TEXT = 'Something went wrong on our side. Please try again in a few minutes.'

export const CONFIRMATION_EMAIL_FAILED_TEXT =
  "We couldn't send the confirmation email. Please try again in a few minutes."

export const HUMAN_CHECK_FAILED_TEXT =
  "We couldn't confirm the form was sent by a person. Please refresh the page and try again."

export const MESSAGE_MIN_LENGTH = 20

// Counts the message without leading or trailing spaces, as the routes do.
export function isMessageTooShort(message: string): boolean {
  return message.trim().length < MESSAGE_MIN_LENGTH
}

export function messageTooShortText(minLength: number = MESSAGE_MIN_LENGTH): string {
  return `Please write a little more so we can help (at least ${minLength} characters).`
}

// Links in our emails (the job-seeker verify link, the hiring brief confirm
// and cancel links) come back to a screen with one value in the address. A
// temporary problem has its own message, separate from "invalid link", so the
// visitor knows the same link can be tried again.

export const LINK_RETRY_HEADING = 'Please Try Again'

export const VERIFY_LINK_RETRY_TEXT =
  "We couldn't confirm your email just now. Please try the link again in a few minutes."

export const BRIEF_LINK_RETRY_TEXT =
  "We couldn't update your brief just now. Please try the link again in a few minutes."

export type VerifyLinkStatus = 'idle' | 'verified' | 'already' | 'invalid' | 'linkRetry'

// The job-seeker screen's state for its ?verified= value.
export function verifyLinkStatus(value: string | null): VerifyLinkStatus {
  if (value === 'true') return 'verified'
  if (value === 'already') return 'already'
  if (value === 'invalid') return 'invalid'
  if (value === 'error') return 'linkRetry'
  return 'idle'
}

export type BriefLinkStatus = 'idle' | 'confirmed' | 'cancelled' | 'invalid' | 'linkRetry'

// The hiring brief screen's state for its ?brief= value.
export function briefLinkStatus(value: string | null): BriefLinkStatus {
  if (value === 'confirmed') return 'confirmed'
  if (value === 'cancelled') return 'cancelled'
  if (value === 'invalid') return 'invalid'
  if (value === 'error') return 'linkRetry'
  return 'idle'
}
