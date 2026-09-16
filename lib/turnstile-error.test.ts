import { describe, it, expect } from 'vitest'
import {
  isTurnstileInternalErrorMessage,
  safeUserFacingErrorMessage,
  GENERIC_FORM_ERROR_MESSAGE,
} from './turnstile-error'

describe('isTurnstileInternalErrorMessage', () => {
  it('recognises the observed Cloudflare Turnstile exception text', () => {
    expect(isTurnstileInternalErrorMessage('[Cloudflare Turnstile] Nothing to reset found for provided container.')).toBe(true)
  })

  it('recognises any message with the Cloudflare Turnstile prefix', () => {
    expect(isTurnstileInternalErrorMessage('[Cloudflare Turnstile] Some other internal error.')).toBe(true)
  })

  it('rejects legitimate server-composed messages', () => {
    expect(isTurnstileInternalErrorMessage('Email is required.')).toBe(false)
    expect(isTurnstileInternalErrorMessage('Name, email and message are required.')).toBe(false)
    expect(isTurnstileInternalErrorMessage("We couldn't verify your request. If you're using an ad blocker...")).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isTurnstileInternalErrorMessage('')).toBe(false)
  })
})

describe('safeUserFacingErrorMessage', () => {
  it('substitutes the generic message for Turnstile-internal exception text', () => {
    expect(safeUserFacingErrorMessage('[Cloudflare Turnstile] Nothing to reset found for provided container.'))
      .toBe(GENERIC_FORM_ERROR_MESSAGE)
  })

  it('passes legitimate server messages through unchanged', () => {
    expect(safeUserFacingErrorMessage('Email is required.')).toBe('Email is required.')
  })

  it('falls back to the generic message for null, undefined, or empty input', () => {
    expect(safeUserFacingErrorMessage(null)).toBe(GENERIC_FORM_ERROR_MESSAGE)
    expect(safeUserFacingErrorMessage(undefined)).toBe(GENERIC_FORM_ERROR_MESSAGE)
    expect(safeUserFacingErrorMessage('')).toBe(GENERIC_FORM_ERROR_MESSAGE)
  })
})
