import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { NextFetchEvent } from 'next/server'
import { sha256Hex } from '@/lib/admin-auth'
import middleware from './middleware'

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
  return { cookie: `admin_token=${await sha256Hex('test-session-key')}` }
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

beforeEach(() => {
  vi.stubEnv('ADMIN_PATH', ADMIN)
  vi.stubEnv('ADMIN_SECRET', 'test-session-key')
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
})

describe('admin API routes', () => {
  const loginUrl = `${ORIGIN}/${ADMIN}-login`

  it.each([`/api/${ADMIN}`, `/api/${ADMIN}/jobs`])('%s without a session goes to the login page', async (path) => {
    expectRedirect(await run(path), 307, loginUrl)
  })

  it('an unrecognised session goes to the login page', async () => {
    const res = await run(`/api/${ADMIN}/jobs`, { cookie: 'admin_token=not-a-session' })
    expectRedirect(res, 307, loginUrl)
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
