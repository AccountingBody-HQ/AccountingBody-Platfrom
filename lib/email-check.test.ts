import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkEmailSend } from './email-check'

let logged: unknown[][] = []

beforeEach(() => {
  logged = []
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    logged.push(args)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('checkEmailSend', () => {
  it('accepts a send the provider confirmed', () => {
    expect(checkEmailSend({ data: { id: 'email-1' }, error: null }, 'test')).toBe(true)
    expect(logged).toEqual([])
  })

  it('reports a send the provider refused and logs one fixed line with its short code', () => {
    const result = {
      data: null,
      error: { name: 'validation_error', statusCode: 422, message: 'Invalid `to` field: person@example.com' },
    }
    expect(checkEmailSend(result, 'contact team notification')).toBe(false)
    expect(logged).toEqual([['email: send failed (contact team notification) validation_error 422']])
  })

  it('reports a send that could not reach the provider', () => {
    const result = {
      data: null,
      error: { name: 'application_error', statusCode: null, message: 'Unable to fetch data.' },
    }
    expect(checkEmailSend(result, 'test')).toBe(false)
    expect(logged).toEqual([['email: send failed (test) application_error']])
  })

  it('reports an error even when data is also present', () => {
    expect(checkEmailSend({ data: { id: 'email-1' }, error: { name: 'rate_limit_exceeded' } }, 'test')).toBe(false)
    expect(logged).toEqual([['email: send failed (test) rate_limit_exceeded']])
  })

  it('reports a missing or empty result as not sent', () => {
    expect(checkEmailSend(undefined, 'test')).toBe(false)
    expect(checkEmailSend(null, 'test')).toBe(false)
    expect(checkEmailSend({ data: null, error: null }, 'test')).toBe(false)
    expect(logged).toEqual([
      ['email: send failed (test)'],
      ['email: send failed (test)'],
      ['email: send failed (test)'],
    ])
  })

  it('logs only values that look like short codes', () => {
    const result = { data: null, error: { name: 'Something about person@example.com', statusCode: 'x y' } }
    expect(checkEmailSend(result, 'test')).toBe(false)
    expect(logged).toEqual([['email: send failed (test)']])
  })

  it('never throws, even when reading the result fails', () => {
    const awkward = {
      get error(): never {
        throw new Error('broken result')
      },
    }
    expect(checkEmailSend(awkward as never, 'test')).toBe(false)
  })

  it('never throws when logging fails', () => {
    vi.mocked(console.error).mockImplementation(() => {
      throw new Error('log unavailable')
    })
    expect(checkEmailSend({ data: null, error: { name: 'application_error' } }, 'test')).toBe(false)
  })
})
