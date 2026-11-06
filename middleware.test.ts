import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { NextFetchEvent } from 'next/server'
import { getMiddlewareMatchers } from 'next/dist/build/analysis/get-page-static-info'
import { getMiddlewareRouteMatcher } from 'next/dist/shared/lib/router/utils/middleware-route-matcher'
import { signedOutResponse } from '@/lib/admin-auth'
import { signTestSession, TEST_ADMIN_SECRET, TEST_SESSION_SECRET } from '@/lib/admin-session-fixtures'
import middleware, { config } from './middleware'

// The wrapper hands the request straight to the inner handler, the same way
// the real wrapper calls it, so these tests cover the site's own routing.
vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware:
    (handler: (auth: () => object, req: NextRequest, event: NextFetchEvent) => Promise<Response>) =>
    (req: NextRequest, event: NextFetchEvent) =>
      handler(() => ({}), req, event),
}))

const ORIGIN = 'https://accountingbody.com'
const ADMIN = 'test-admin-area'

async function run(path: string, headers: Record<string, string> = {}): Promise<Response> {
  const req = new NextRequest(ORIGIN + path, { headers })
  const result = await middleware(req, {} as NextFetchEvent)
  return result as Response
}

async function signedInHeaders(): Promise<Record<string, string>> {
  return { cookie: `admin_token=${await signTestSession()}` }
}

function expectPassThrough(res: Response, platform = 'accountingbody') {
  expect(res.status).toBe(200)
  expect(res.headers.get('x-middleware-next')).toBe('1')
  expect(res.headers.get('location')).toBeNull()
  expect(res.headers.getSetCookie()).toEqual([`x-et-platform=${platform}; Path=/; SameSite=lax`])
}

function expectRedirect(res: Response, status: number, location: string) {
  expect(res.status).toBe(status)
  expect(res.headers.get('location')).toBe(location)
  expect(res.headers.get('x-middleware-next')).toBeNull()
  expect(res.headers.getSetCookie()).toEqual([])
}

async function expectSignedOut(res: Response) {
  expect(res.status).toBe(401)
  expect(res.headers.get('location')).toBeNull()
  expect(res.headers.get('x-middleware-next')).toBeNull()
  expect(res.headers.get('cache-control')).toBe('no-store')
  expect(res.headers.get('content-type')).toContain('application/json')
  expect(res.headers.getSetCookie()).toEqual([])
  expect(await res.json()).toEqual({ error: 'Signed out' })
}

beforeEach(() => {
  vi.stubEnv('ADMIN_PATH', ADMIN)
  vi.stubEnv('ADMIN_SECRET', TEST_ADMIN_SECRET)
  vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SESSION_SECRET)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('public pages', () => {
  it.each([
    ['home page', '/'],
    ['job listings', '/jobs'],
    ['a job', '/jobs/senior-accountant'],
    ['an article', '/study/financial-reporting'],
    ['practice questions', '/practice-questions/taxation'],
    ['a public API route', '/api/jobs'],
  ])('%s passes through unchanged', async (_label, path) => {
    expectPassThrough(await run(path))
  })

  it.each([
    ['site map', '/sitemap.xml'],
    ['app manifest', '/manifest.json'],
  ])('%s file passes through unchanged', async (_label, path) => {
    expectPassThrough(await run(path))
  })
})

describe('retired account pages', () => {
  it.each(['/sign-in', '/sign-in/factor-one', '/sign-up', '/sign-up/verify', '/dashboard', '/dashboard/settings'])(
    '%s goes to the home page',
    async (path) => {
      expectRedirect(await run(path), 307, ORIGIN + '/')
    },
  )

  it('leaves the query string behind when going to the home page', async () => {
    expectRedirect(await run('/sign-in?from=jobs'), 307, ORIGIN + '/')
  })
})

describe('permanent redirects', () => {
  it.each([
    ['/course', '/free-courses'],
    ['/courses', '/free-courses'],
    ['/accountants-freelancers', '/firms-freelancers'],
    ['/about-us', '/about'],
    ['/cookie-policy-uk', '/cookie-policy'],
    ['/ethiotax.com', '/ethiotax'],
  ])('%s moves permanently to %s', async (from, to) => {
    expectRedirect(await run(from), 301, ORIGIN + to)
  })

  it('treats a trailing slash the same way', async () => {
    expectRedirect(await run('/about-us/'), 301, ORIGIN + '/about/')
  })

  it('keeps the query string', async () => {
    expectRedirect(await run('/courses?level=beginner'), 301, ORIGIN + '/free-courses?level=beginner')
  })

  it('applies on the EthioTax host too', async () => {
    const res = await run('/about-us', { 'x-forwarded-host': 'ethiotax.com' })
    expectRedirect(res, 301, ORIGIN + '/about')
  })
})

describe('admin pages', () => {
  const loginUrl = `${ORIGIN}/${ADMIN}-login`

  it('admin login page is reachable without a session', async () => {
    expectPassThrough(await run(`/${ADMIN}-login`))
  })

  it.each([`/${ADMIN}`, `/${ADMIN}/jobs`, `/${ADMIN}/jobs/edit`])(
    '%s without a session goes to the login page',
    async (path) => {
      expectRedirect(await run(path), 307, loginUrl)
    },
  )

  it('keeps the query string when going to the login page', async () => {
    expectRedirect(await run(`/${ADMIN}/jobs?page=2`), 307, `${loginUrl}?page=2`)
  })

  it('an unrecognised session goes to the login page', async () => {
    const res = await run(`/${ADMIN}/jobs`, { cookie: 'admin_token=not-a-session' })
    expectRedirect(res, 307, loginUrl)
  })

  it('an altered session goes to the login page', async () => {
    const { cookie } = await signedInHeaders()
    const altered = cookie.slice(0, -1) + (cookie.endsWith('0') ? '1' : '0')
    expectRedirect(await run(`/${ADMIN}/jobs`, { cookie: altered }), 307, loginUrl)
  })

  it.each([`/${ADMIN}`, `/${ADMIN}/jobs`])('signed-in admin reaches %s', async (path) => {
    expectPassThrough(await run(path, await signedInHeaders()))
  })

  it('signed-in admin reaches the login page', async () => {
    expectPassThrough(await run(`/${ADMIN}-login`, await signedInHeaders()))
  })

  it('a session goes to the login page when no session secret is set', async () => {
    const headers = await signedInHeaders()
    vi.stubEnv('ADMIN_SESSION_SECRET', '')
    expectRedirect(await run(`/${ADMIN}/jobs`, headers), 307, loginUrl)
  })

  it('a session goes to the login page after the admin password changes', async () => {
    const headers = await signedInHeaders()
    vi.stubEnv('ADMIN_SECRET', 'another-admin-password')
    expectRedirect(await run(`/${ADMIN}/jobs`, headers), 307, loginUrl)
  })
})

describe('admin API routes', () => {
  it.each([`/api/${ADMIN}`, `/api/${ADMIN}/jobs`, `/api/${ADMIN}/jobs?page=2`, `/api/${ADMIN}/`])(
    '%s without a session is answered signed out',
    async (path) => {
      await expectSignedOut(await run(path))
    },
  )

  it('an unrecognised session is answered signed out', async () => {
    await expectSignedOut(await run(`/api/${ADMIN}/jobs`, { cookie: 'admin_token=not-a-session' }))
  })

  it('every method without a session is answered signed out', async () => {
    for (const method of ['POST', 'PATCH', 'DELETE']) {
      const res = await middleware(new NextRequest(`${ORIGIN}/api/${ADMIN}/jobs`, { method }), {} as NextFetchEvent)
      await expectSignedOut(res as Response)
    }
  })

  it('an address that cannot be read is answered signed out', async () => {
    await expectSignedOut(await run(`/api/${ADMIN}/%E9`))
  })

  it('the answer matches the one route handlers give', async () => {
    const fromMiddleware = await run(`/api/${ADMIN}/jobs`)
    const fromRoute = signedOutResponse()
    expect(fromRoute.status).toBe(fromMiddleware.status)
    expect(fromRoute.headers.get('cache-control')).toBe(fromMiddleware.headers.get('cache-control'))
    expect(fromRoute.headers.get('content-type')).toBe(fromMiddleware.headers.get('content-type'))
    expect(await fromRoute.text()).toBe(await fromMiddleware.text())
  })

  it('signed-in admin reaches an admin API route', async () => {
    expectPassThrough(await run(`/api/${ADMIN}/jobs`, await signedInHeaders()))
  })

  it.each([`/api/${ADMIN}-auth`, `/api/${ADMIN}-logout`])('%s is reachable without a session', async (path) => {
    expectPassThrough(await run(path))
  })
})

describe('site platform', () => {
  it.each([
    ['forwarded host', { 'x-forwarded-host': 'ethiotax.com' }],
    ['forwarded www host', { 'x-forwarded-host': 'www.ethiotax.com' }],
    ['host', { host: 'ethiotax.com' }],
    ['platform header', { 'x-et-platform': 'ethiotax' }],
  ])('EthioTax is recognised from the %s', async (_label, headers) => {
    const res = await run('/jobs', headers)
    expectPassThrough(res, 'ethiotax')
    expect(res.headers.get('x-middleware-request-x-et-platform')).toBe('ethiotax')
    expect(res.headers.get('x-middleware-override-headers')?.split(',')).toContain('x-et-platform')
  })

  it('AccountingBody is the default site', async () => {
    const res = await run('/jobs', { host: 'accountingbody.com', 'x-forwarded-host': 'accountingbody.com' })
    expectPassThrough(res, 'accountingbody')
    expect(res.headers.get('x-middleware-request-x-et-platform')).toBeNull()
  })

  it('leaves another platform header value as it was sent', async () => {
    const res = await run('/jobs', { 'x-et-platform': 'accountingbody' })
    expectPassThrough(res, 'accountingbody')
    expect(res.headers.get('x-middleware-request-x-et-platform')).toBe('accountingbody')
  })

  it('forwards the other request headers', async () => {
    const res = await run('/jobs', { 'x-example-header': 'kept' })
    expect(res.headers.get('x-middleware-request-x-example-header')).toBe('kept')
    expect(res.headers.get('x-middleware-override-headers')?.split(',')).toContain('x-example-header')
  })

  it('signed-in admin on EthioTax passes through as EthioTax', async () => {
    const headers = { ...(await signedInHeaders()), 'x-forwarded-host': 'ethiotax.com' }
    expectPassThrough(await run(`/${ADMIN}/jobs`, headers), 'ethiotax')
  })
})

describe('admin addresses are recognised however they are written', () => {
  const loginUrl = `${ORIGIN}/${ADMIN}-login`
  const firstLetter = `%${ADMIN.charCodeAt(0).toString(16)}`
  const rest = ADMIN.slice(1)

  const spellings: [string, string][] = [
    ['encoded letter', `/${firstLetter}${rest}/jobs`],
    ['encoded twice', `/${firstLetter.replace('%', '%25')}${rest}/jobs`],
    ['encoded slash', `/${ADMIN}%2Fjobs`],
    ['encoded backslash', `/%5C${ADMIN}/jobs`],
    ['double slash', `//${ADMIN}/jobs`],
    ['parent segment', `/public/../${ADMIN}/jobs`],
    ['encoded parent segment', `/public%2F..%2F${ADMIN}%2Fjobs`],
  ]

  const apiSpellings: [string, string][] = [
    ['API with encoded letter', `/api/${firstLetter}${rest}/jobs`],
    ['API with double slash', `//api//${ADMIN}/jobs`],
  ]

  it('trailing slash goes to the login page without a session', async () => {
    expectRedirect(await run(`/${ADMIN}/`), 307, `${loginUrl}/`)
  })

  it.each(spellings)('%s goes to the login page without a session', async (_label, path) => {
    expectRedirect(await run(path), 307, loginUrl)
  })

  it.each(apiSpellings)('%s is answered signed out without a session', async (_label, path) => {
    await expectSignedOut(await run(path))
  })

  it.each([...spellings, ...apiSpellings])('%s continues for a signed-in admin', async (_label, path) => {
    expectPassThrough(await run(path, await signedInHeaders()))
  })

  it('keeps the query string when going to the login page', async () => {
    expectRedirect(await run(`/${firstLetter}${rest}/jobs?page=2`), 307, `${loginUrl}?page=2`)
  })

  it('leaves the encoded login page reachable', async () => {
    expectPassThrough(await run(`/${firstLetter}${rest}-login`))
  })

  it('leaves a public page with an encoded name alone', async () => {
    expectPassThrough(await run('/jobs/caf%C3%A9'))
  })

  it('still applies permanent redirects to the address as written', async () => {
    expectRedirect(await run('/about-us'), 301, ORIGIN + '/about')
    expectPassThrough(await run('/%61bout-us'))
  })
})

describe('an address that cannot be read is treated as an admin address', () => {
  const loginUrl = `${ORIGIN}/${ADMIN}-login`

  it.each(['/%E9', '/jobs/100%', '/%zz'])('%s goes to the login page without a session', async (path) => {
    expectRedirect(await run(path), 307, loginUrl)
  })

  it('continues for a signed-in admin', async () => {
    expectPassThrough(await run('/%E9', await signedInHeaders()))
  })
})

describe('an address is checked at every layer it can be read', () => {
  const loginUrl = `${ORIGIN}/${ADMIN}-login`
  const firstLetter = `%${ADMIN.charCodeAt(0).toString(16)}`
  const rest = ADMIN.slice(1)
  const encoded = `${firstLetter}${rest}`

  it('an address with an encoded percent sign is read once and handled normally', async () => {
    expectPassThrough(await run('/jobs/50%25-off'))
  })

  it.each([
    ['last layer unreadable', `/${encoded}/jobs%25`],
    ['parent segment at a later layer', `/${encoded}/%252e%252e/x`],
    ['parent segment, last layer unreadable', `/${encoded}/%252e%252e/x%2525`],
    ['parent segment after a double slash', `//${ADMIN}/..%2Fx`],
  ])('an admin address is recognised at every layer of encoding: %s', async (_label, path) => {
    expectRedirect(await run(path), 307, loginUrl)
  })

  it('an admin API address is recognised at every layer of encoding', async () => {
    await expectSignedOut(await run(`/api/${encoded}/jobs/..%252F..%252F..%252Fx`))
  })

  it.each([
    ['public', '/%2525252561'],
    ['admin', `/%${'25'.repeat(5)}${firstLetter.slice(1)}${rest}`],
  ])('an address with too many layers of encoding is treated as an admin address: %s', async (_label, path) => {
    expectRedirect(await run(path), 307, loginUrl)
  })

  it('continues for a signed-in admin', async () => {
    expectPassThrough(await run(`/${encoded}/%252e%252e/x`, await signedInHeaders()))
  })
})

describe('real files skip middleware; pages always reach it', () => {
  const reachesMiddleware = getMiddlewareRouteMatcher(
    getMiddlewareMatchers(config.matcher, { basePath: '', i18n: null } as never),
  )
  const reaches = (path: string) => reachesMiddleware(path, {} as never, {})

  it.each([
    '/favicon.ico',
    '/image.png',
    '/photo.jpeg',
    '/site.webmanifest',
    '/robots.txt',
    '/books/guide.docx',
    '/_next/static/x.js',
    '/_next/image',
  ])('%s skips middleware', (path) => {
    expect(reaches(path)).toBe(false)
  })

  it.each([
    '/',
    '/jobs',
    '/sitemap.xml',
    '/manifest.json',
    '/study/ico-guide',
    '/jobs/mexico-accountant',
    '/jobs/doctor-of-accounting',
    '/study/gift-aid-gif',
    '/study/html-reports',
    '/study/css-basics',
    '/study/txt-files',
    `/${ADMIN}`,
    `/${ADMIN}/providers/x-doc`,
    `/${ADMIN}/providers/x-ico`,
    `/${ADMIN}/css-editor`,
    `/api/${ADMIN}/docs`,
    '/api/report.csv',
  ])('%s reaches middleware', (path) => {
    expect(reaches(path)).toBe(true)
  })
})
