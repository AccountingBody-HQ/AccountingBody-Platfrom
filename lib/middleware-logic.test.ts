import { afterEach, describe, expect, it, vi } from 'vitest'
import { signTestSession, TEST_ADMIN_SECRET, TEST_SESSION_SECRET } from './admin-session-fixtures'
import {
  decideRequest,
  findStaticRedirect,
  getAdminPath,
  isAdminAddress,
  isAdminApiPath,
  isAdminPagePath,
  isAdminSessionValid,
  isRetiredAccountPath,
  normaliseAdminPathname,
  readAddressLayers,
  resolvePlatform,
  sha256Hex,
} from './middleware-logic'
import type { RequestFacts } from './middleware-logic'

const ADMIN = 'test-admin-area'

function facts(overrides: Partial<RequestFacts> = {}): RequestFacts {
  return {
    pathname: '/',
    adminPath: ADMIN,
    adminToken: undefined,
    adminSessionSecret: TEST_SESSION_SECRET,
    adminSecret: TEST_ADMIN_SECRET,
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

describe('getAdminPath', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('reads the configured admin path on each call', () => {
    vi.stubEnv('ADMIN_PATH', ADMIN)
    expect(getAdminPath()).toBe(ADMIN)
    vi.stubEnv('ADMIN_PATH', 'another-area')
    expect(getAdminPath()).toBe('another-area')
  })
})

describe('sha256Hex', () => {
  it('gives the standard hex digest', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})

describe('normaliseAdminPathname', () => {
  it.each([
    ['/', '/'],
    ['/jobs', '/jobs'],
    ['/jobs/', '/jobs'],
    ['//jobs///senior', '/jobs/senior'],
    ['/a/./b', '/a/b'],
    ['/a/b/../c', '/a/c'],
    ['/../../a', '/a'],
    ['/%61/%62', '/a/b'],
    ['/%2561', '/a'],
    ['/a%2Fb', '/a/b'],
    ['/a\\b', '/a/b'],
    ['/a/%2e%2e/b', '/b'],
    ['/caf%C3%A9', '/café'],
  ])('reads %s as %s', (input, expected) => {
    expect(normaliseAdminPathname(input)).toBe(expected)
  })

  it.each(['/%E9', '/a%', '/%zz'])('cannot read %s', (input) => {
    expect(normaliseAdminPathname(input)).toBeNull()
  })

  it('stops after a small number of decoding passes', () => {
    expect(normaliseAdminPathname('/%25252561')).toBe('/a')
    expect(normaliseAdminPathname('/%2525252561')).toBeNull()
  })

  it('reads an address as far as it can be read', () => {
    expect(normaliseAdminPathname('/jobs/50%25-off/')).toBe('/jobs/50%-off')
  })
})

describe('readAddressLayers', () => {
  it.each<[string, string[]]>([
    ['/jobs', ['/jobs']],
    ['/%61', ['/%61', '/a']],
    ['/%2561', ['/%2561', '/%61', '/a']],
    ['/%25252561', ['/%25252561', '/%252561', '/%2561', '/%61', '/a']],
  ])('lists every layer of %s', (input, expected) => {
    expect(readAddressLayers(input)).toEqual(expected)
  })

  it('keeps the layers read so far when a later layer cannot be read', () => {
    expect(readAddressLayers('/jobs/50%25-off')).toEqual(['/jobs/50%25-off', '/jobs/50%-off'])
  })

  it.each(['/%E9', '/a%', '/%zz'])('cannot read %s', (input) => {
    expect(readAddressLayers(input)).toBeNull()
  })

  it('stops after a small number of decoding passes', () => {
    expect(readAddressLayers('/%2525252561')).toBeNull()
  })
})

describe('an address is checked at every layer it can be read', () => {
  const firstLetter = `%${ADMIN.charCodeAt(0).toString(16)}`
  const rest = ADMIN.slice(1)
  const encoded = `${firstLetter}${rest}`
  const encodedTimes = (times: number) => `/%${'25'.repeat(times - 1)}${firstLetter.slice(1)}${rest}`
  const loginPage = { action: 'redirect-admin-login', pathname: `/${ADMIN}-login` }

  it('an address with an encoded percent sign is read once and handled normally', async () => {
    expect(isAdminAddress('/jobs/50%25-off', ADMIN)).toBe(false)
    expect(await decideRequest(facts({ pathname: '/jobs/50%25-off' }))).toEqual({
      action: 'continue',
      platform: 'accountingbody',
    })
  })

  it.each([
    ['letter encoded, last layer unreadable', `/${encoded}/jobs%25`],
    ['letter encoded twice', encodedTimes(2)],
    ['letter encoded four times', encodedTimes(4)],
    ['API, last layer unreadable', `/api/${encoded}/jobs%25`],
  ])('an admin address is recognised even when written with extra encoding: %s', (_label, path) => {
    expect(isAdminAddress(path, ADMIN)).toBe(true)
  })

  it.each([
    ['parent segment at a later layer', `/${encoded}/%252e%252e/x`],
    ['parent segment, last layer unreadable', `/${encoded}/%252e%252e/x%2525`],
    ['API with parent segments at a later layer', `/api/${encoded}/jobs/..%252F..%252F..%252Fx`],
    ['API, last layer unreadable', `/api/${encoded}/jobs/..%252F..%252F..%252Fx%2525`],
    ['parent segment after a double slash', `//${ADMIN}/..%2Fx`],
    ['trailing slash on the encoded login page', `/${encoded}-login/`],
  ])('an admin address is recognised at every layer of encoding: %s', async (_label, path) => {
    expect(isAdminAddress(path, ADMIN)).toBe(true)
    expect(await decideRequest(facts({ pathname: path }))).toEqual(loginPage)
  })

  it.each([
    ['public, one layer past the limit', '/%2525252561'],
    ['public, two layers past the limit', '/%252525252561'],
    ['admin, one layer past the limit', encodedTimes(5)],
    ['admin, two layers past the limit', encodedTimes(6)],
  ])('an address with too many layers of encoding is treated as an admin address: %s', async (_label, path) => {
    expect(isAdminAddress(path, ADMIN)).toBe(true)
    expect(await decideRequest(facts({ pathname: path }))).toEqual(loginPage)
  })

  it.each(['/%E9', '/a%', '/%zz', '/jobs/100%'])(
    'an address that cannot be read at all is treated as an admin address: %s',
    (path) => {
      expect(isAdminAddress(path, ADMIN)).toBe(true)
    },
  )

  it.each([
    ['the login page at a later layer', `/%25${encoded.slice(1)}-login`],
    ['a public page with parent segments', '/jobs/%252e%252e/x'],
    ['a public page with an encoded slash', '/jobs%2Fsenior'],
  ])('%s is not an admin address', (_label, path) => {
    expect(isAdminAddress(path, ADMIN)).toBe(false)
  })
})

describe('admin addresses are recognised however they are written', () => {
  const firstLetter = `%${ADMIN.charCodeAt(0).toString(16)}`
  const rest = ADMIN.slice(1)

  it.each([
    ['plain', `/${ADMIN}/jobs`],
    ['encoded letter', `/${firstLetter}${rest}/jobs`],
    ['encoded twice', `/${firstLetter.replace('%', '%25')}${rest}/jobs`],
    ['encoded slash', `/${ADMIN}%2Fjobs`],
    ['encoded leading slash', `/%2F${ADMIN}/jobs`],
    ['encoded backslash', `/%5C${ADMIN}/jobs`],
    ['double slash', `//${ADMIN}/jobs`],
    ['dot segment', `/./${ADMIN}/jobs`],
    ['parent segment', `/public/../${ADMIN}/jobs`],
    ['encoded parent segment', `/public/%2e%2e/${ADMIN}/jobs`],
    ['encoded parent segment with slashes', `/public%2F..%2F${ADMIN}%2Fjobs`],
    ['trailing slash', `/${ADMIN}/`],
    ['API with encoded letter', `/api/${firstLetter}${rest}/jobs`],
    ['API with encoded slash', `/api%2F${ADMIN}/jobs`],
    ['API with double slash', `//api//${ADMIN}/jobs`],
  ])('%s', (_label, path) => {
    expect(isAdminAddress(path, ADMIN)).toBe(true)
  })

  it.each([
    ['the login page', `/${ADMIN}-login`],
    ['the encoded login page', `/${firstLetter}${rest}-login`],
    ['the sign-in route', `/api/${ADMIN}-auth`],
    ['the encoded sign-out route', `/api/${firstLetter}${rest}-logout`],
    ['a public page', '/jobs/senior-accountant'],
    ['a public page with an encoded name', '/jobs/caf%C3%A9'],
    ['a public page with a dot in its name', '/study/ias.1-guide'],
  ])('%s is not an admin address', (_label, path) => {
    expect(isAdminAddress(path, ADMIN)).toBe(false)
  })

  it.each([`/${ADMIN}-login/`, `/api/${ADMIN}-auth/`, `/api/${ADMIN}-logout/`])(
    '%s keeps its session check',
    (path) => {
      expect(isAdminAddress(path, ADMIN)).toBe(true)
    },
  )
})

describe('an address that cannot be read is treated as an admin address', () => {
  it.each(['/%E9', '/jobs/100%', '/%zz', '/%2525252525252561'])('%s', async (path) => {
    expect(isAdminAddress(path, ADMIN)).toBe(true)
    expect(await decideRequest(facts({ pathname: path }))).toEqual({
      action: 'redirect-admin-login',
      pathname: `/${ADMIN}-login`,
    })
  })

  it('lets a signed-in admin continue', async () => {
    const adminToken = await signTestSession()
    expect(await decideRequest(facts({ pathname: '/%E9', adminToken }))).toEqual({
      action: 'continue',
      platform: 'accountingbody',
    })
  })
})

describe('isAdminSessionValid', () => {
  const check = (token: string | undefined) =>
    isAdminSessionValid(token, TEST_SESSION_SECRET, TEST_ADMIN_SECRET)

  it('accepts a signed-in session', async () => {
    expect(await check(await signTestSession())).toBe(true)
  })

  it('declines a request without a session', async () => {
    expect(await check(undefined)).toBe(false)
  })

  it('declines an unrecognised session', async () => {
    expect(await check('not-a-session')).toBe(false)
  })

  it('declines an altered session', async () => {
    const value = await signTestSession()
    const altered = value.slice(0, -1) + (value.endsWith('0') ? '1' : '0')
    expect(await check(altered)).toBe(false)
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
    const adminToken = await signTestSession()
    expect(await decideRequest(facts({ pathname: `/${ADMIN}/jobs`, adminToken }))).toEqual({
      action: 'continue',
      platform: 'accountingbody',
    })
  })

  it('sends a signed-in admin to the login page when no session secret is set', async () => {
    const adminToken = await signTestSession()
    const decision = await decideRequest(
      facts({ pathname: `/${ADMIN}/jobs`, adminToken, adminSessionSecret: undefined }),
    )
    expect(decision).toEqual({ action: 'redirect-admin-login', pathname: `/${ADMIN}-login` })
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
