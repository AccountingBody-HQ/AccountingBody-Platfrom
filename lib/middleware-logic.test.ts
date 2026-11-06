import { describe, expect, it } from 'vitest'
import { sha256Hex } from './admin-auth'
import {
  decideRequest,
  findStaticRedirect,
  isAdminApiPath,
  isAdminPagePath,
  isAdminSessionValid,
  isRetiredAccountPath,
  resolvePlatform,
} from './middleware-logic'
import type { RequestFacts } from './middleware-logic'

const ADMIN = 'test-admin-area'
const KEY = 'test-session-key'

function facts(overrides: Partial<RequestFacts> = {}): RequestFacts {
  return {
    pathname: '/',
    adminPath: ADMIN,
    adminToken: undefined,
    adminSecret: KEY,
    headers: new Headers(),
    ...overrides,
  }
}

describe('isRetiredAccountPath', () => {
  it.each(['/sign-in', '/sign-in/factor-one', '/sign-up', '/dashboard', '/dashboard/settings'])(
    'recognises %s',
    (path) => {
      expect(isRetiredAccountPath(path)).toBe(true)
    },
  )

  it.each(['/', '/jobs', '/about'])('leaves %s alone', (path) => {
    expect(isRetiredAccountPath(path)).toBe(false)
  })
})

describe('findStaticRedirect', () => {
  it.each([
    ['/course', '/free-courses'],
    ['/courses', '/free-courses'],
    ['/accountants-freelancers', '/firms-freelancers'],
    ['/about-us', '/about'],
    ['/cookie-policy-uk', '/cookie-policy'],
    ['/ethiotax.com', '/ethiotax'],
  ])('sends %s to %s', (from, to) => {
    expect(findStaticRedirect(from)).toBe(to)
  })

  it('finds an address with a trailing slash', () => {
    expect(findStaticRedirect('/about-us/')).toBe('/about')
  })

  it.each(['/', '/jobs', '/about'])('has no entry for %s', (path) => {
    expect(findStaticRedirect(path)).toBeUndefined()
  })
})

describe('isAdminPagePath', () => {
  it.each([`/${ADMIN}`, `/${ADMIN}/jobs`])('includes %s', (path) => {
    expect(isAdminPagePath(path, ADMIN)).toBe(true)
  })

  it.each([`/${ADMIN}-login`, '/', '/jobs'])('leaves out %s', (path) => {
    expect(isAdminPagePath(path, ADMIN)).toBe(false)
  })
})

describe('isAdminApiPath', () => {
  it.each([`/api/${ADMIN}`, `/api/${ADMIN}/jobs`])('includes %s', (path) => {
    expect(isAdminApiPath(path, ADMIN)).toBe(true)
  })

  it.each([`/api/${ADMIN}-auth`, `/api/${ADMIN}-logout`, '/api/jobs'])('leaves out %s', (path) => {
    expect(isAdminApiPath(path, ADMIN)).toBe(false)
  })
})

describe('isAdminSessionValid', () => {
  it('accepts a signed-in session', async () => {
    expect(await isAdminSessionValid(await sha256Hex(KEY), KEY)).toBe(true)
  })

  it('declines a request without a session', async () => {
    expect(await isAdminSessionValid(undefined, KEY)).toBe(false)
  })

  it('declines an unrecognised session', async () => {
    expect(await isAdminSessionValid('not-a-session', KEY)).toBe(false)
  })

  it('declines an altered session', async () => {
    const value = await sha256Hex(KEY)
    const altered = value.slice(0, -1) + (value.endsWith('0') ? '1' : '0')
    expect(await isAdminSessionValid(altered, KEY)).toBe(false)
  })
})

describe('resolvePlatform', () => {
  it.each<[string, Record<string, string>]>([
    ['forwarded host', { 'x-forwarded-host': 'ethiotax.com' }],
    ['host', { host: 'www.ethiotax.com' }],
    ['platform header', { 'x-et-platform': 'ethiotax' }],
  ])('recognises EthioTax from the %s', (_label, headers) => {
    expect(resolvePlatform(new Headers(headers))).toBe('ethiotax')
  })

  it.each<[string, Record<string, string>]>([
    ['no site headers', {}],
    ['the AccountingBody host', { host: 'accountingbody.com' }],
    ['another platform value', { 'x-et-platform': 'accountingbody' }],
  ])('defaults to AccountingBody with %s', (_label, headers) => {
    expect(resolvePlatform(new Headers(headers))).toBe('accountingbody')
  })
})

describe('decideRequest', () => {
  it('sends retired account pages home', async () => {
    expect(await decideRequest(facts({ pathname: '/dashboard' }))).toEqual({ action: 'redirect-home' })
  })

  it('moves an old address to its permanent home', async () => {
    expect(await decideRequest(facts({ pathname: '/courses' }))).toEqual({
      action: 'redirect-permanent',
      pathname: '/free-courses',
    })
  })

  it('sends an admin page without a session to the login page', async () => {
    expect(await decideRequest(facts({ pathname: `/${ADMIN}/jobs` }))).toEqual({
      action: 'redirect-admin-login',
      pathname: `/${ADMIN}-login`,
    })
  })

  it('sends an admin API route without a session to the login page', async () => {
    expect(await decideRequest(facts({ pathname: `/api/${ADMIN}/jobs` }))).toEqual({
      action: 'redirect-admin-login',
      pathname: `/${ADMIN}-login`,
    })
  })

  it('lets a signed-in admin continue', async () => {
    const adminToken = await sha256Hex(KEY)
    expect(await decideRequest(facts({ pathname: `/${ADMIN}/jobs`, adminToken }))).toEqual({
      action: 'continue',
      platform: 'accountingbody',
    })
  })

  it('lets the admin login page continue without a session', async () => {
    expect(await decideRequest(facts({ pathname: `/${ADMIN}-login` }))).toEqual({
      action: 'continue',
      platform: 'accountingbody',
    })
  })

  it('lets a public page continue and reports the site platform', async () => {
    const headers = new Headers({ 'x-forwarded-host': 'ethiotax.com' })
    expect(await decideRequest(facts({ pathname: '/jobs', headers }))).toEqual({
      action: 'continue',
      platform: 'ethiotax',
    })
  })

  it('applies retired account pages before old addresses and admin pages', async () => {
    expect(await decideRequest(facts({ pathname: '/sign-in', adminPath: 'sign-in' }))).toEqual({
      action: 'redirect-home',
    })
  })
})
