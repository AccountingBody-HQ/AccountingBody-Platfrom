import { SignJWT, decodeJwt } from 'jose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CONFIRMATION_TOKEN_LIFE_MS,
  createConfirmationToken,
  hashConfirmationToken,
  isConfirmationFresh,
  isConfirmationTokenShape,
  listUnsubscribeHeaders,
  newsletterDomain,
  signUnsubscribeToken,
  unsubscribeUrl,
  verifyUnsubscribeToken,
} from './newsletter-tokens'

const SECRET = 'jwt-test-value-0123456789abcdef'
const ID = '3f1c2b9e-8d4a-4c1e-9b7f-0a1b2c3d4e5f'
const key = (value = SECRET) => new TextEncoder().encode(value)

beforeEach(() => {
  vi.stubEnv('JWT_SECRET', SECRET)
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('confirmation token', () => {
  it('is 32 random bytes as base64url, and only its sha256 hash is for storing', () => {
    const { token, hash } = createConfirmationToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(Buffer.from(token, 'base64url')).toHaveLength(32)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).toBe(hashConfirmationToken(token))
    expect(hash).not.toContain(token)
    expect(isConfirmationTokenShape(token)).toBe(true)
  })

  it('is different every time', () => {
    const tokens = new Set(Array.from({ length: 20 }, () => createConfirmationToken().token))
    expect(tokens.size).toBe(20)
  })

  it('hashes like sha256', () => {
    expect(hashConfirmationToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('tells a token shape from anything else', () => {
    for (const value of ['', 'abc', 'a.b.c', 'x'.repeat(44), null, 42, undefined]) {
      expect(isConfirmationTokenShape(value)).toBe(false)
    }
  })

  it('works for 7 days after it was sent, and not after', () => {
    const now = new Date('2026-06-08T09:00:00Z')
    expect(CONFIRMATION_TOKEN_LIFE_MS).toBe(604800000)
    expect(isConfirmationFresh('2026-06-01T09:00:00.000Z', now)).toBe(true)
    expect(isConfirmationFresh('2026-06-01T08:59:59.000Z', now)).toBe(false)
    expect(isConfirmationFresh('2026-06-08T08:00:00Z', now)).toBe(true)
    expect(isConfirmationFresh(null, now)).toBe(false)
    expect(isConfirmationFresh('not a date', now)).toBe(false)
  })
})

describe('unsubscribe token', () => {
  it('holds only the row id, the site code and its purpose, and no expiry', async () => {
    const token = await signUnsubscribeToken({ id: ID, platform: 'et' })
    expect(decodeJwt(token)).toEqual({ sid: ID, p: 'et', purpose: 'unsubscribe' })
    expect(token).not.toContain('@')
    expect(await verifyUnsubscribeToken(token)).toEqual({ id: ID, platform: 'et' })
  })

  it('refuses to sign without a row id or site code', async () => {
    await expect(signUnsubscribeToken({ id: 'ada@example.com', platform: 'ab' })).rejects.toThrow()
    await expect(signUnsubscribeToken({ id: ID, platform: 'xx' as 'ab' })).rejects.toThrow()
  })

  const signed = (payload: Record<string, unknown>, secret = SECRET, alg = 'HS256') =>
    new SignJWT(payload).setProtectedHeader({ alg }).sign(key(secret))

  it.each([
    ['a bad signature', () => signed({ sid: ID, p: 'ab', purpose: 'unsubscribe' }, 'another-secret-0123456789abcdef')],
    ['the wrong purpose', () => signed({ sid: ID, p: 'ab', purpose: 'confirm' })],
    ['no purpose (an old confirmation link)', () => signed({ email: 'ada@example.com', platform: 'ab' })],
    ['an id that is not a uuid', () => signed({ sid: 'ada@example.com', p: 'ab', purpose: 'unsubscribe' })],
    ['no id', () => signed({ p: 'ab', purpose: 'unsubscribe' })],
    ['a site code that is not ab or et', () => signed({ sid: ID, p: 'ethiotax', purpose: 'unsubscribe' })],
    ['a different algorithm', () => signed({ sid: ID, p: 'ab', purpose: 'unsubscribe' }, SECRET, 'HS512')],
    ['garbage', async () => 'not-a-real-token'],
    ['an empty value', async () => ''],
  ])('is refused with %s', async (_name, make) => {
    expect(await verifyUnsubscribeToken(await make())).toBeNull()
  })

  it('is refused when no signing key is set', async () => {
    const token = await signUnsubscribeToken({ id: ID, platform: 'ab' })
    vi.stubEnv('JWT_SECRET', '')
    expect(await verifyUnsubscribeToken(token)).toBeNull()
  })
})

describe('unsubscribe addresses', () => {
  it('use the site the row belongs to', async () => {
    expect(newsletterDomain('ab')).toBe('accountingbody.com')
    expect(newsletterDomain('et')).toBe('ethiotax.com')
    const ab = await unsubscribeUrl(ID, 'ab')
    const et = await unsubscribeUrl(ID, 'et')
    expect(ab).toMatch(/^https:\/\/accountingbody\.com\/unsubscribe\?token=[A-Za-z0-9_.-]+$/)
    expect(et).toMatch(/^https:\/\/ethiotax\.com\/unsubscribe\?token=[A-Za-z0-9_.-]+$/)
    const token = new URL(et).searchParams.get('token')
    expect(await verifyUnsubscribeToken(token)).toEqual({ id: ID, platform: 'et' })
    expect(ab).not.toContain('@')
  })

  it('one-click headers for future newsletters are exact', async () => {
    const headers = await listUnsubscribeHeaders(ID, 'ab')
    const token = await signUnsubscribeToken({ id: ID, platform: 'ab' })
    expect(headers).toEqual({
      'List-Unsubscribe': `<https://accountingbody.com/api/unsubscribe?token=${token}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    })
    const et = await listUnsubscribeHeaders(ID, 'et')
    expect(et['List-Unsubscribe']).toMatch(/^<https:\/\/ethiotax\.com\/api\/unsubscribe\?token=[A-Za-z0-9_.-]+>$/)
  })
})
