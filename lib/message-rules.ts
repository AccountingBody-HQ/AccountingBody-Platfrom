// Visitor-facing texts shared by the public form routes, and the minimum
// message length for the contact and help-request forms, shared by the
// server routes and the contact form so both use the same number.
//
// The same pages are served on more than one site, so these texts name no
// site or brand.

export const SERVER_PROBLEM_TEXT = 'Something went wrong on our side. Please try again in a few minutes.'

export const CONFIRMATION_EMAIL_FAILED_TEXT =
  "We couldn't send the confirmation email. Please try again in a few minutes."

export const MESSAGE_MIN_LENGTH = 20

// Counts the message without leading or trailing spaces, as the routes do.
export function isMessageTooShort(message: string): boolean {
  return message.trim().length < MESSAGE_MIN_LENGTH
}

export function messageTooShortText(minLength: number = MESSAGE_MIN_LENGTH): string {
  return `Please write a little more so we can help (at least ${minLength} characters).`
}
