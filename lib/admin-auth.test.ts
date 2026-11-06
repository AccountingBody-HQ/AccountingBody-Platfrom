import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { cookieValue, redirectMock } = vi.hoisted(() => ({
  cookieValue: { current: undefined as string | undefined },
  redirectMock: vi.fn((target: string) => {
    throw new Error(`redirected to ${target}`)
  }),
}))

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) =>
      name === 'admin_token' && cookieValue.current !== undefined
        ? { name, value: cookieValue.current }
        : undefined,
  }),
}))

vi.mock('next/navigation', () => ({ redirect: redirectMock }))

import { NextRequest } from 'next/server'
import { isAuthenticated, requireAdmin } from './admin-auth'
import {
  signTestSession,
  TEST_ADMIN_PATH as ADMIN,
  TEST_ADMIN_SECRET,
  TEST_SESSION_SECRET,
} from './admin-session-fixtures'
import { ADMIN_SESSION_LIFETIME_SECONDS } from './middleware-logic'

const LOGIN = `/${ADMIN}-login`

beforeEach(() => {
  vi.stubEnv('ADMIN_PATH', ADMIN)
  vi.stubEnv('ADMIN_SECRET', TEST_ADMIN_SECRET)
  vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SESSION_SECRET)
  cookieValue.current = undefined
  redirectMock.mockClear()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('requireAdmin', () => {
  it('lets a signed-in admin continue', async () => {
    cookieValue.current = await signTestSession()
    await expect(requireAdmin()).resolves.toBeUndefined()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('sends a visitor without a session to the login page', async () => {
    await expect(requireAdmin()).rejects.toThrow(`redirected to ${LOGIN}`)
    expect(redirectMock).toHaveBeenCalledWith(LOGIN)
  })

  it('sends an unrecognised session to the login page', async () => {
    cookieValue.current = 'not-a-session'
    await expect(requireAdmin()).rejects.toThrow(`redirected to ${LOGIN}`)
  })

  it('sends an altered session to the login page', async () => {
    const value = await signTestSession()
    cookieValue.current = value.slice(0, -1) + (value.endsWith('0') ? '1' : '0')
    await expect(requireAdmin()).rejects.toThrow(`redirected to ${LOGIN}`)
  })

  it('sends a session to the login page once it has expired', async () => {
    cookieValue.current = await signTestSession()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + ADMIN_SESSION_LIFETIME_SECONDS * 1000)
    await expect(requireAdmin()).rejects.toThrow(`redirected to ${LOGIN}`)
    vi.useRealTimers()
  })

  it('sends everyone to the login page when no session secret is set', async () => {
    cookieValue.current = await signTestSession()
    vi.stubEnv('ADMIN_SESSION_SECRET', '')
    await expect(requireAdmin()).rejects.toThrow(`redirected to ${LOGIN}`)
  })
})

describe('isAuthenticated', () => {
  function request(cookie?: string): NextRequest {
    return new NextRequest('https://accountingbody.com/api/example', {
      headers: cookie ? { cookie: `admin_token=${cookie}` } : {},
    })
  }

  it('accepts a signed-in admin', async () => {
    expect(await isAuthenticated(request(await signTestSession()))).toBe(true)
  })

  it('declines a request without a session', async () => {
    expect(await isAuthenticated(request())).toBe(false)
  })

  it('declines an unrecognised session', async () => {
    expect(await isAuthenticated(request('not-a-session'))).toBe(false)
  })

  it('declines every session when no session secret is set', async () => {
    const session = await signTestSession()
    vi.stubEnv('ADMIN_SESSION_SECRET', '')
    expect(await isAuthenticated(request(session))).toBe(false)
  })

  it('declines a session issued before the admin password changed', async () => {
    const session = await signTestSession()
    vi.stubEnv('ADMIN_SECRET', 'another-admin-password')
    expect(await isAuthenticated(request(session))).toBe(false)
  })
})
