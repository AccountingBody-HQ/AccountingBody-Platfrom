import { createHash, createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ADMIN_SESSION_LIFETIME_SECONDS,
  constantTimeEqual,
  createAdminSession,
  isAdminSessionValid,
  sha256Hex,
} from './middleware-logic'
import { signTestSession, TEST_ADMIN_SECRET, TEST_SESSION_SECRET } from './admin-session-fixtures'

const START_MS = Date.UTC(2026, 0, 15, 9, 0, 0)
const START_SECONDS = START_MS / 1000
const ID = 'ab'.repeat(16)

function isValid(token: string | undefined): Promise<boolean> {
  return isAdminSessionValid(token, TEST_SESSION_SECRET, TEST_ADMIN_SECRET)
}

// Signs with Node's own crypto, separately from the code under test.
function signClaims(
  claims: string,
  sessionSecret: string = TEST_SESSION_SECRET,
  adminSecret: string = TEST_ADMIN_SECRET,
): string {
  const fingerprint = createHash('sha256').update(`admin-session-binding:v1:${adminSecret}`).digest('hex')
  const signature = createHmac('sha256', sessionSecret).update(`${claims}\n${fingerprint}`).digest('hex')
  return `${claims}.${signature}`
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(START_MS)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('an issued session', () => {
  it('has a version, issue time, expiry, random id and signature', async () => {
    const [version, issuedAt, expiresAt, id, signature, ...rest] = (await signTestSession()).split('.')
    expect(version).toBe('v1')
    expect(Number(issuedAt)).toBe(START_SECONDS)
    expect(Number(expiresAt)).toBe(START_SECONDS + ADMIN_SESSION_LIFETIME_SECONDS)
    expect(id).toMatch(/^[0-9a-f]{32}$/)
    expect(signature).toMatch(/^[0-9a-f]{64}$/)
    expect(rest).toEqual([])
  })

  it('lasts twelve hours', () => {
    expect(ADMIN_SESSION_LIFETIME_SECONDS).toBe(43200)
  })

  it('gets a new id every time', async () => {
    const first = (await signTestSession()).split('.')[3]
    const second = (await signTestSession()).split('.')[3]
    expect(first).not.toBe(second)
  })

  it('does not contain either secret or the password fingerprint', async () => {
    const session = await signTestSession()
    const fingerprint = await sha256Hex(`admin-session-binding:v1:${TEST_ADMIN_SECRET}`)
    expect(session).not.toContain(TEST_ADMIN_SECRET)
    expect(session).not.toContain(TEST_SESSION_SECRET)
    expect(session).not.toContain(fingerprint)
    expect(session).not.toContain(await sha256Hex(TEST_ADMIN_SECRET))
  })

  it('matches a session signed separately with Node crypto', async () => {
    const claims = `v1.${START_SECONDS}.${START_SECONDS + 60}.${ID}`
    expect(await isValid(signClaims(claims))).toBe(true)
  })
})

describe('session expiry', () => {
  it('is accepted from issue until the last second before expiry', async () => {
    const session = await signTestSession()
    expect(await isValid(session)).toBe(true)
    vi.setSystemTime(START_MS + (ADMIN_SESSION_LIFETIME_SECONDS - 1) * 1000)
    expect(await isValid(session)).toBe(true)
  })

  it('is refused at the moment it expires', async () => {
    const session = await signTestSession()
    vi.setSystemTime(START_MS + ADMIN_SESSION_LIFETIME_SECONDS * 1000)
    expect(await isValid(session)).toBe(false)
  })

  it('is refused after it expires', async () => {
    const session = await signTestSession()
    vi.setSystemTime(START_MS + (ADMIN_SESSION_LIFETIME_SECONDS + 3600) * 1000)
    expect(await isValid(session)).toBe(false)
  })

  it('is refused when signed for longer than the allowed lifetime', async () => {
    const expiresAt = START_SECONDS + ADMIN_SESSION_LIFETIME_SECONDS + 1
    expect(await isValid(signClaims(`v1.${START_SECONDS}.${expiresAt}.${ID}`))).toBe(false)
  })

  it('is refused when its expiry is not after its issue time', async () => {
    const issuedAt = START_SECONDS + 100
    expect(await isValid(signClaims(`v1.${issuedAt}.${issuedAt}.${ID}`))).toBe(false)
    expect(await isValid(signClaims(`v1.${issuedAt}.${issuedAt - 1}.${ID}`))).toBe(false)
  })
})

describe('session integrity', () => {
  it('refuses a session with any byte changed', async () => {
    const session = await signTestSession()
    for (let i = 0; i < session.length; i++) {
      const original = session[i]
      const replacement = original === '0' ? '1' : '0'
      const altered = session.slice(0, i) + replacement + session.slice(i + 1)
      expect(await isValid(altered), `byte ${i}`).toBe(false)
    }
  })

  it('refuses a later expiry written over a signed session', async () => {
    const [version, issuedAt, , id, signature] = (await signTestSession()).split('.')
    const later = Number(issuedAt) + 60
    expect(await isValid([version, issuedAt, later, id, signature].join('.'))).toBe(false)
  })

  it('refuses a session signed with a different session secret', async () => {
    expect(await isValid(await signTestSession('f'.repeat(64)))).toBe(false)
  })

  it('refuses a session issued before the admin password changed', async () => {
    const session = await signTestSession()
    expect(await isAdminSessionValid(session, TEST_SESSION_SECRET, 'another-admin-password')).toBe(false)
  })

  it('refuses a signature from another claim set', async () => {
    const other = signClaims(`v1.${START_SECONDS}.${START_SECONDS + 60}.${'cd'.repeat(16)}`)
    const signature = other.split('.')[4]
    const claims = `v1.${START_SECONDS}.${START_SECONDS + 60}.${ID}`
    expect(await isValid(`${claims}.${signature}`)).toBe(false)
  })
})

describe('values that are not sessions', () => {
  const claims = `v1.${START_SECONDS}.${START_SECONDS + 60}.${ID}`

  it('refuses a hex string', async () => {
    expect(await isValid(await sha256Hex(TEST_ADMIN_SECRET))).toBe(false)
    expect(await isValid('a'.repeat(64))).toBe(false)
  })

  it.each([
    ['undefined', undefined],
    ['empty', ''],
    ['words', 'not-a-session'],
    ['dots only', '....'],
    ['version only', 'v1'],
    ['no signature', claims],
    ['empty signature', `${claims}.`],
  ])('refuses %s', async (_label, value) => {
    expect(await isValid(value)).toBe(false)
  })

  it.each([
    ['another version', (s: string) => s.replace(/^v1/, 'v2')],
    ['upper case', (s: string) => s.toUpperCase()],
    ['upper case signature', (s: string) => s.slice(0, -64) + s.slice(-64).toUpperCase()],
    ['extra segment', (s: string) => `${s}.00`],
    ['leading segment', (s: string) => `00.${s}`],
    ['trailing line break', (s: string) => `${s}\n`],
    ['leading space', (s: string) => ` ${s}`],
    ['shortened signature', (s: string) => s.slice(0, -2)],
    ['encoded dots', (s: string) => s.replaceAll('.', '%2E')],
  ])('refuses a correctly signed session with %s', async (_label, change) => {
    const session = signClaims(claims)
    expect(await isValid(session)).toBe(true)
    expect(await isValid(change(session))).toBe(false)
  })
})

describe('without usable secrets', () => {
  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['one character short', 'x'.repeat(31)],
  ])('session secret %s: nothing is accepted and nothing is issued', async (_label, secret) => {
    const session = await signTestSession()
    expect(await isAdminSessionValid(session, secret, TEST_ADMIN_SECRET)).toBe(false)
    expect(await createAdminSession(secret, TEST_ADMIN_SECRET)).toBeNull()
  })

  it('a session signed with a short secret is refused under that same secret', async () => {
    const shortSecret = 'x'.repeat(31)
    const session = signClaims(`v1.${START_SECONDS}.${START_SECONDS + 60}.${ID}`, shortSecret)
    expect(await isAdminSessionValid(session, shortSecret, TEST_ADMIN_SECRET)).toBe(false)
  })

  it.each([
    ['missing', undefined],
    ['empty', ''],
  ])('admin password %s: nothing is accepted and nothing is issued', async (_label, secret) => {
    const session = await signTestSession()
    expect(await isAdminSessionValid(session, TEST_SESSION_SECRET, secret)).toBe(false)
    expect(await createAdminSession(TEST_SESSION_SECRET, secret)).toBeNull()
  })

  it('a session secret of exactly the minimum length works', async () => {
    const secret = 'x'.repeat(32)
    const session = await createAdminSession(secret, TEST_ADMIN_SECRET)
    expect(await isAdminSessionValid(session ?? undefined, secret, TEST_ADMIN_SECRET)).toBe(true)
  })
})

describe('constantTimeEqual', () => {
  it.each([
    ['abc', 'abc', true],
    ['', '', true],
    ['abc', 'abd', false],
    ['abc', 'xbc', false],
    ['abc', 'abcd', false],
    ['', 'a', false],
  ])('%s and %s: %s', (a, b, expected) => {
    expect(constantTimeEqual(a, b)).toBe(expected)
  })
})
