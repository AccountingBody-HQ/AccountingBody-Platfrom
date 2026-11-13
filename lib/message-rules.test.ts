import { describe, expect, it } from 'vitest'
import {
  BRIEF_LINK_RETRY_TEXT,
  CONFIRMATION_EMAIL_FAILED_TEXT,
  LINK_RETRY_HEADING,
  MANAGE_LINK_RETRY_TEXT,
  MESSAGE_MIN_LENGTH,
  SERVER_PROBLEM_TEXT,
  VERIFY_LINK_RETRY_TEXT,
  briefLinkStatus,
  isMessageTooShort,
  messageTooShortText,
  verifyLinkStatus,
} from './message-rules'

describe('message rules', () => {
  it('keeps the minimum message length at 20 characters', () => {
    expect(MESSAGE_MIN_LENGTH).toBe(20)
  })

  it('treats a message below the minimum as too short', () => {
    expect(isMessageTooShort('Help please')).toBe(true)
    expect(isMessageTooShort('a'.repeat(MESSAGE_MIN_LENGTH - 1))).toBe(true)
    expect(isMessageTooShort('')).toBe(true)
  })

  it('accepts a message of exactly the minimum length or longer', () => {
    expect(isMessageTooShort('a'.repeat(MESSAGE_MIN_LENGTH))).toBe(false)
    expect(isMessageTooShort('I would like some help with my annual accounts.')).toBe(false)
  })

  it('does not count leading and trailing spaces', () => {
    expect(isMessageTooShort('   Help me please    ')).toBe(true)
    expect(isMessageTooShort(`  ${'a'.repeat(MESSAGE_MIN_LENGTH)}  `)).toBe(false)
  })

  it('tells the visitor the minimum length as a number', () => {
    expect(messageTooShortText()).toBe('Please write a little more so we can help (at least 20 characters).')
    expect(messageTooShortText(30)).toBe('Please write a little more so we can help (at least 30 characters).')
  })

  it('uses the agreed visitor texts', () => {
    expect(SERVER_PROBLEM_TEXT).toBe('Something went wrong on our side. Please try again in a few minutes.')
    expect(CONFIRMATION_EMAIL_FAILED_TEXT).toBe(
      "We couldn't send the confirmation email. Please try again in a few minutes.",
    )
  })

  it('uses the agreed texts for a link that can be tried again', () => {
    expect(LINK_RETRY_HEADING).toBe('Please Try Again')
    expect(VERIFY_LINK_RETRY_TEXT).toBe(
      "We couldn't confirm your email just now. Please try the link again in a few minutes.",
    )
    expect(BRIEF_LINK_RETRY_TEXT).toBe(
      "We couldn't update your brief just now. Please try the link again in a few minutes.",
    )
  })

  it('keeps the shared visitor texts free of site names and web addresses', () => {
    const siteWords = /accounting\s*body|ethio\s*tax|\.com\b|\.et\b|https?:|www\./i
    for (const text of [
      SERVER_PROBLEM_TEXT,
      CONFIRMATION_EMAIL_FAILED_TEXT,
      messageTooShortText(),
      LINK_RETRY_HEADING,
      VERIFY_LINK_RETRY_TEXT,
      BRIEF_LINK_RETRY_TEXT,
      MANAGE_LINK_RETRY_TEXT,
    ]) {
      expect(text).not.toMatch(siteWords)
    }
  })
})

describe('job-seeker screen state from its link', () => {
  it.each([
    ['true', 'verified'],
    ['already', 'already'],
    ['invalid', 'invalid'],
    ['error', 'linkRetry'],
  ] as const)('shows %s as %s', (value, status) => {
    expect(verifyLinkStatus(value)).toBe(status)
  })

  it('shows the form for no value or any other value', () => {
    for (const value of [null, '', 'retry', 'TRUE', 'confirmed']) {
      expect(verifyLinkStatus(value)).toBe('idle')
    }
  })
})

describe('hiring brief screen state from its link', () => {
  it.each([
    ['confirmed', 'confirmed'],
    ['cancelled', 'cancelled'],
    ['invalid', 'invalid'],
    ['error', 'linkRetry'],
  ] as const)('shows %s as %s', (value, status) => {
    expect(briefLinkStatus(value)).toBe(status)
  })

  it('shows the form for no value or any other value', () => {
    for (const value of [null, '', 'retry', 'Confirmed', 'true']) {
      expect(briefLinkStatus(value)).toBe('idle')
    }
  })
})
