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

import { requireAdmin, sha256Hex } from './admin-auth'

const ADMIN = 'test-admin-area'
const KEY = 'test-session-key'
const LOGIN = `/${ADMIN}-login`

beforeEach(() => {
  vi.stubEnv('ADMIN_PATH', ADMIN)
  vi.stubEnv('ADMIN_SECRET', KEY)
  cookieValue.current = undefined
  redirectMock.mockClear()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('requireAdmin', () => {
  it('lets a signed-in admin continue', async () => {
    cookieValue.current = await sha256Hex(KEY)
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
    const value = await sha256Hex(KEY)
    cookieValue.current = value.slice(0, -1) + (value.endsWith('0') ? '1' : '0')
    await expect(requireAdmin()).rejects.toThrow(`redirected to ${LOGIN}`)
  })
})
