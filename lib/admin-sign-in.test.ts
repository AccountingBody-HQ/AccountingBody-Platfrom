import { createHmac } from 'node:crypto'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAdminPath, isAdminSessionValid } from './middleware-logic'
import { TEST_ADMIN_SECRET, TEST_SESSION_SECRET } from './admin-session-fixtures'

// The route folders come from the app's own default, so the name is not repeated here.
vi.stubEnv('ADMIN_PATH', undefined)
const folder = getAdminPath()
vi.unstubAllEnvs()

function loadRoute(suffix: string) {
  return import(/* @vite-ignore */ join(process.cwd(), 'app', 'api', `${folder}-${suffix}`, 'route.ts'))
}

// The shared secret from the RFC 6238 test vectors, in base32.
const TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
const TOTP_KEY = '12345678901234567890'
const NOW_MS = Date.UTC(2026, 0, 15, 9, 0, 10)
const STEP_MS = 30_000
const DENIED = { error: 'Access denied.' }

function codeAt(timeMs: number): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(timeMs / STEP_MS)))
  const digest = createHmac('sha1', TOTP_KEY).update(counter).digest()
  const offset = digest[digest.length - 1] & 0x0f
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

async function send(body: unknown): Promise<Response> {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  const { POST } = await loadRoute('auth')
  return POST(new NextRequest('https://accountingbody.com/api/sign-in', { method: 'POST', body: text }))
}

function otherCode(code: string): string {
  return code === '000000' ? '000001' : '000000'
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW_MS)
  vi.stubEnv('ADMIN_SECRET', TEST_ADMIN_SECRET)
  vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SESSION_SECRET)
  vi.stubEnv('ADMIN_TOTP_SECRET', TOTP_SECRET)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('signing in with the right password and code', () => {
  it('issues a session that the shared check accepts', async () => {
    const res = await send({ password: TEST_ADMIN_SECRET, totpCode: codeAt(NOW_MS) })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })

    const [cookie] = res.headers.getSetCookie()
    const value = cookie.split(';')[0].replace('admin_token=', '')
    expect(await isAdminSessionValid(value, TEST_SESSION_SECRET, TEST_ADMIN_SECRET)).toBe(true)
  })

  it('sets the cookie attributes', async () => {
    const res = await send({ password: TEST_ADMIN_SECRET, totpCode: codeAt(NOW_MS) })
    const cookies = res.headers.getSetCookie()
    expect(cookies).toHaveLength(1)
    const attributes = cookies[0].split('; ').slice(1).map((part) => part.toLowerCase())
    const withoutExpiryDate = attributes.filter((part) => !part.startsWith('expires=')).sort()
    expect(withoutExpiryDate).toEqual(['httponly', 'max-age=43200', 'path=/', 'samesite=strict', 'secure'])
  })

  it.each([
    ['the previous', -STEP_MS],
    ['the next', STEP_MS],
  ])('accepts the code from %s time step', async (_label, shift) => {
    const res = await send({ password: TEST_ADMIN_SECRET, totpCode: codeAt(NOW_MS + shift) })
    expect(res.status).toBe(200)
  })

  it('keeps the one-time code algorithm', async () => {
    vi.setSystemTime(59_000)
    const res = await send({ password: TEST_ADMIN_SECRET, totpCode: '287082' })
    expect(res.status).toBe(200)
  })
})

describe('every failed sign-in gets the same response', () => {
  const failures: [string, () => unknown, (() => void)?][] = [
    ['wrong password', () => ({ password: 'another-password', totpCode: codeAt(NOW_MS) })],
    ['wrong code', () => ({ password: TEST_ADMIN_SECRET, totpCode: otherCode(codeAt(NOW_MS)) })],
    ['wrong password and code', () => ({ password: 'another-password', totpCode: otherCode(codeAt(NOW_MS)) })],
    ['expired code', () => ({ password: TEST_ADMIN_SECRET, totpCode: codeAt(NOW_MS - 2 * STEP_MS) })],
    ['future code', () => ({ password: TEST_ADMIN_SECRET, totpCode: codeAt(NOW_MS + 2 * STEP_MS) })],
    ['no password', () => ({ totpCode: codeAt(NOW_MS) })],
    ['no code', () => ({ password: TEST_ADMIN_SECRET })],
    ['empty code', () => ({ password: TEST_ADMIN_SECRET, totpCode: '' })],
    ['short code', () => ({ password: TEST_ADMIN_SECRET, totpCode: '123' })],
    ['password of another type', () => ({ password: 12345, totpCode: codeAt(NOW_MS) })],
    ['code of another type', () => ({ password: TEST_ADMIN_SECRET, totpCode: Number(codeAt(NOW_MS)) })],
    ['empty body', () => ({})],
    ['null body', () => null],
    ['unreadable body', () => '{not json'],
    [
      'admin password not set up',
      () => ({ password: TEST_ADMIN_SECRET, totpCode: codeAt(NOW_MS) }),
      () => vi.stubEnv('ADMIN_SECRET', ''),
    ],
    [
      'one-time code not set up',
      () => ({ password: TEST_ADMIN_SECRET, totpCode: codeAt(NOW_MS) }),
      () => vi.stubEnv('ADMIN_TOTP_SECRET', ''),
    ],
    [
      'unusable one-time code secret',
      () => ({ password: TEST_ADMIN_SECRET, totpCode: codeAt(NOW_MS) }),
      () => vi.stubEnv('ADMIN_TOTP_SECRET', '1'),
    ],
    [
      'session secret not set up',
      () => ({ password: TEST_ADMIN_SECRET, totpCode: codeAt(NOW_MS) }),
      () => vi.stubEnv('ADMIN_SESSION_SECRET', ''),
    ],
    [
      'session secret too short',
      () => ({ password: TEST_ADMIN_SECRET, totpCode: codeAt(NOW_MS) }),
      () => vi.stubEnv('ADMIN_SESSION_SECRET', 'x'.repeat(31)),
    ],
  ]

  it.each(failures)('%s', async (_label, body, setUp) => {
    setUp?.()
    const res = await send(body())
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual(DENIED)
    expect(res.headers.getSetCookie()).toEqual([])
  })

  it('writes no secret or submitted value to the log', async () => {
    vi.stubEnv('ADMIN_SESSION_SECRET', '')
    await send({ password: TEST_ADMIN_SECRET, totpCode: codeAt(NOW_MS) })
    await send('{"password":"submitted-value"')
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls)
    expect(logged).not.toContain(TEST_ADMIN_SECRET)
    expect(logged).not.toContain('submitted-value')
  })
})

describe('signing out', () => {
  it('clears the session cookie', async () => {
    const { POST } = await loadRoute('logout')
    const res: Response = await POST()
    expect(res.status).toBe(200)
    const cookies = res.headers.getSetCookie()
    expect(cookies).toHaveLength(1)
    const [pair, ...attributes] = cookies[0].split('; ')
    expect(pair).toBe('admin_token=')
    expect(attributes.map((part) => part.toLowerCase())).toEqual(
      expect.arrayContaining(['max-age=0', 'path=/', 'httponly', 'secure', 'samesite=strict']),
    )
  })
})
