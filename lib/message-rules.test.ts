import { describe, expect, it } from 'vitest'
import {
  CONFIRMATION_EMAIL_FAILED_TEXT,
  MESSAGE_MIN_LENGTH,
  SERVER_PROBLEM_TEXT,
  isMessageTooShort,
  messageTooShortText,
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

  it('keeps the shared visitor texts free of site names and web addresses', () => {
    const siteWords = /accounting\s*body|ethio\s*tax|\.com\b|\.et\b|https?:|www\./i
    for (const text of [SERVER_PROBLEM_TEXT, CONFIRMATION_EMAIL_FAILED_TEXT, messageTooShortText()]) {
      expect(text).not.toMatch(siteWords)
    }
  })
})
